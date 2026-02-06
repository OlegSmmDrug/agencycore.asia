/*
  # System Metrics RPC Functions for Super Admin

  1. New Functions
    - `get_db_size_info` - Returns database size breakdown (total, tables, indexes)
    - `get_connection_stats` - Returns connection counts grouped by state
    - `get_server_info` - Returns PostgreSQL server configuration
    - `get_performance_stats` - Returns cache hit ratios, transaction counts, uptime
    - `get_table_stats` - Returns per-table statistics (row estimates, sizes, scans, dead tuples)
    - `get_connections_by_app` - Returns connection counts grouped by application
    - `get_long_queries` - Returns queries running longer than 5 seconds

  2. Security
    - All functions use SECURITY DEFINER to access pg_stat views
    - Functions have stable volatility for safety
*/

CREATE OR REPLACE FUNCTION get_db_size_info()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_build_object(
    'database_size', pg_size_pretty(pg_database_size(current_database())),
    'tables_size', pg_size_pretty(
      (SELECT COALESCE(sum(pg_table_size(c.oid)), 0)
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r')
    ),
    'indexes_size', pg_size_pretty(
      (SELECT COALESCE(sum(pg_indexes_size(c.oid)), 0)
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r')
    )
  );
$$;

CREATE OR REPLACE FUNCTION get_connection_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object('state', COALESCE(state, 'unknown'), 'count', cnt)
    ),
    '[]'::json
  )
  FROM (
    SELECT state, count(*) as cnt
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
    ORDER BY cnt DESC
  ) sub;
$$;

CREATE OR REPLACE FUNCTION get_server_info()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_build_object(
    'version', version(),
    'shared_buffers', current_setting('shared_buffers'),
    'work_mem', current_setting('work_mem'),
    'max_connections', current_setting('max_connections'),
    'max_worker_processes', current_setting('max_worker_processes')
  );
$$;

CREATE OR REPLACE FUNCTION get_performance_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_build_object(
    'cache_hit_ratio', COALESCE(
      round(
        (sum(blks_hit)::numeric / NULLIF(sum(blks_hit) + sum(blks_read), 0)) * 100, 2
      ), 0
    ),
    'index_hit_ratio', COALESCE(
      (SELECT round(
        (sum(idx_blks_hit)::numeric / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0)) * 100, 2
      ) FROM pg_statio_user_indexes), 0
    ),
    'xact_commit', sum(xact_commit),
    'xact_rollback', sum(xact_rollback),
    'deadlocks', sum(deadlocks),
    'temp_files', sum(temp_files),
    'tup_inserted', sum(tup_inserted),
    'tup_updated', sum(tup_updated),
    'tup_deleted', sum(tup_deleted),
    'uptime', (now() - pg_postmaster_start_time())::text
  )
  FROM pg_stat_database
  WHERE datname = current_database();
$$;

CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(sub) ORDER BY sub.total_bytes DESC),
    '[]'::json
  )
  FROM (
    SELECT
      s.relname as table_name,
      s.n_live_tup as row_estimate,
      pg_size_pretty(pg_total_relation_size(s.relid)) as total_size,
      pg_total_relation_size(s.relid) as total_bytes,
      s.seq_scan,
      s.idx_scan,
      s.n_dead_tup,
      s.last_vacuum::text as last_vacuum
    FROM pg_stat_user_tables s
    WHERE s.schemaname = 'public'
    ORDER BY pg_total_relation_size(s.relid) DESC
    LIMIT 50
  ) sub;
$$;

CREATE OR REPLACE FUNCTION get_connections_by_app()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object('application_name', COALESCE(application_name, ''), 'count', cnt)
    ),
    '[]'::json
  )
  FROM (
    SELECT application_name, count(*) as cnt
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY application_name
    ORDER BY cnt DESC
  ) sub;
$$;

CREATE OR REPLACE FUNCTION get_long_queries()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(sub)),
    '[]'::json
  )
  FROM (
    SELECT
      pid,
      (now() - query_start)::text as duration,
      state,
      LEFT(query, 200) as query,
      COALESCE(application_name, '') as application_name
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND state != 'idle'
      AND query_start IS NOT NULL
      AND now() - query_start > interval '5 seconds'
      AND pid != pg_backend_pid()
    ORDER BY query_start
  ) sub;
$$;
