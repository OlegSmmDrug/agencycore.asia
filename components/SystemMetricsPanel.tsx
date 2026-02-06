import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Database, HardDrive, Cpu, Activity, RefreshCw,
  Server, Zap, Clock, AlertTriangle, CheckCircle2,
  BarChart3, Table2, Folder
} from 'lucide-react';

interface DbSizeInfo {
  database_size: string;
  tables_size: string;
  indexes_size: string;
}

interface ConnectionInfo {
  state: string;
  count: number;
}

interface ServerInfo {
  version: string;
  shared_buffers: string;
  work_mem: string;
  max_connections: string;
  max_worker_processes: string;
}

interface PerformanceInfo {
  cache_hit_ratio: number;
  index_hit_ratio: number;
  xact_commit: number;
  xact_rollback: number;
  deadlocks: number;
  temp_files: number;
  tup_inserted: number;
  tup_updated: number;
  tup_deleted: number;
  uptime: string;
}

interface TableStats {
  table_name: string;
  row_estimate: number;
  total_size: string;
  seq_scan: number;
  idx_scan: number;
  n_dead_tup: number;
  last_vacuum: string | null;
}

interface ConnectionByApp {
  application_name: string;
  count: number;
}

interface LongQuery {
  pid: number;
  duration: string;
  state: string;
  query: string;
  application_name: string;
}

interface StorageBucket {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
}

const SystemMetricsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbSize, setDbSize] = useState<DbSizeInfo | null>(null);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [performance, setPerformance] = useState<PerformanceInfo | null>(null);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [connectionsByApp, setConnectionsByApp] = useState<ConnectionByApp[]>([]);
  const [longQueries, setLongQueries] = useState<LongQuery[]>([]);
  const [storageBuckets, setStorageBuckets] = useState<StorageBucket[]>([]);
  const [detailTab, setDetailTab] = useState<'tables' | 'connections' | 'queries' | 'storage'>('tables');

  const loadMetrics = useCallback(async () => {
    try {
      const [
        sizeRes,
        connRes,
        serverRes,
        perfRes,
        tableRes,
        connAppRes,
        longQRes,
        bucketsRes,
      ] = await Promise.all([
        supabase.rpc('get_db_size_info'),
        supabase.rpc('get_connection_stats'),
        supabase.rpc('get_server_info'),
        supabase.rpc('get_performance_stats'),
        supabase.rpc('get_table_stats'),
        supabase.rpc('get_connections_by_app'),
        supabase.rpc('get_long_queries'),
        supabase.from('objects').select('bucket_id').limit(0),
      ]);

      if (sizeRes.data) setDbSize(sizeRes.data);
      if (connRes.data) setConnections(connRes.data);
      if (serverRes.data) setServerInfo(serverRes.data);
      if (perfRes.data) setPerformance(perfRes.data);
      if (tableRes.data) setTableStats(tableRes.data);
      if (connAppRes.data) setConnectionsByApp(connAppRes.data);
      if (longQRes.data) setLongQueries(longQRes.data);

      const { data: buckets } = await supabase
        .from('buckets' as any)
        .select('*');
      if (buckets) setStorageBuckets(buckets as any);
    } catch (err) {
      console.error('Error loading system metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMetrics();
  };

  const totalConnections = connections.reduce((s, c) => s + c.count, 0);
  const activeConnections = connections.find(c => c.state === 'active')?.count || 0;
  const idleConnections = connections.find(c => c.state === 'idle')?.count || 0;
  const maxConn = serverInfo ? parseInt(serverInfo.max_connections) || 100 : 100;

  const getHealthScore = () => {
    if (!performance) return { score: 0, label: 'N/A', color: 'text-slate-400' };
    let score = 0;
    if (performance.cache_hit_ratio > 99) score += 30;
    else if (performance.cache_hit_ratio > 95) score += 20;
    else score += 10;

    if (performance.index_hit_ratio > 99) score += 30;
    else if (performance.index_hit_ratio > 95) score += 20;
    else score += 10;

    if (performance.deadlocks === 0) score += 20;
    else score += 5;

    const connUsage = totalConnections / maxConn;
    if (connUsage < 0.5) score += 20;
    else if (connUsage < 0.8) score += 10;
    else score += 0;

    if (score >= 90) return { score, label: 'Отлично', color: 'text-emerald-600' };
    if (score >= 70) return { score, label: 'Хорошо', color: 'text-blue-600' };
    if (score >= 50) return { score, label: 'Удовлетворительно', color: 'text-amber-600' };
    return { score, label: 'Требует внимания', color: 'text-red-600' };
  };

  const health = getHealthScore();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            health.score >= 90 ? 'bg-emerald-50' :
            health.score >= 70 ? 'bg-blue-50' :
            health.score >= 50 ? 'bg-amber-50' : 'bg-red-50'
          }`}>
            {health.score >= 70 ? (
              <CheckCircle2 className={`w-4 h-4 ${health.color}`} />
            ) : (
              <AlertTriangle className={`w-4 h-4 ${health.color}`} />
            )}
            <span className={`text-sm font-semibold ${health.color}`}>
              {health.label} ({health.score}/100)
            </span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Размер БД</p>
              <h3 className="text-xl font-bold text-slate-800">{dbSize?.database_size || 'N/A'}</h3>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Таблицы:</span>
              <span className="font-medium text-slate-700">{dbSize?.tables_size || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Индексы:</span>
              <span className="font-medium text-slate-700">{dbSize?.indexes_size || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Подключения</p>
              <h3 className="text-xl font-bold text-slate-800">{totalConnections} <span className="text-sm font-normal text-slate-400">/ {maxConn}</span></h3>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Zap className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${
                totalConnections / maxConn > 0.8 ? 'bg-red-500' :
                totalConnections / maxConn > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min((totalConnections / maxConn) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Active: <span className="font-medium text-emerald-600">{activeConnections}</span></span>
            <span>Idle: <span className="font-medium text-slate-600">{idleConnections}</span></span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Сервер</p>
              <h3 className="text-sm font-bold text-slate-800 truncate">{serverInfo?.version?.split(' ').slice(0, 2).join(' ') || 'N/A'}</h3>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <Server className="w-4 h-4 text-orange-600" />
            </div>
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>shared_buffers:</span>
              <span className="font-medium text-slate-700">{serverInfo?.shared_buffers || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>work_mem:</span>
              <span className="font-medium text-slate-700">{serverInfo?.work_mem || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>workers:</span>
              <span className="font-medium text-slate-700">{serverInfo?.max_worker_processes || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Производительность</p>
              <h3 className="text-xl font-bold text-emerald-600">
                {performance ? `${performance.cache_hit_ratio.toFixed(1)}%` : 'N/A'}
              </h3>
            </div>
            <div className="p-2 bg-teal-100 rounded-lg">
              <Activity className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Cache hit:</span>
              <span className="font-medium text-slate-700">{performance?.cache_hit_ratio.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Index hit:</span>
              <span className="font-medium text-slate-700">{performance?.index_hit_ratio.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="font-medium text-slate-700">{performance?.uptime || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            Транзакции
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Commits:</span>
              <span className="font-semibold text-slate-800">{(performance?.xact_commit || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rollbacks:</span>
              <span className="font-semibold text-slate-800">{(performance?.xact_rollback || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Deadlocks:</span>
              <span className={`font-semibold ${(performance?.deadlocks || 0) > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {performance?.deadlocks || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Temp files:</span>
              <span className="font-semibold text-slate-800">{performance?.temp_files || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            Операции с данными
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">INSERT:</span>
              <span className="font-semibold text-slate-800">{(performance?.tup_inserted || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">UPDATE:</span>
              <span className="font-semibold text-slate-800">{(performance?.tup_updated || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">DELETE:</span>
              <span className="font-semibold text-slate-800">{(performance?.tup_deleted || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-400" />
            Подключения по приложениям
          </h4>
          <div className="space-y-2 text-sm">
            {connectionsByApp.length > 0 ? connectionsByApp.slice(0, 5).map((c) => (
              <div key={c.application_name} className="flex justify-between">
                <span className="text-slate-500 truncate mr-2">{c.application_name || '(без имени)'}</span>
                <span className="font-semibold text-slate-800">{c.count}</span>
              </div>
            )) : (
              <p className="text-slate-400 text-xs">Нет данных</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex gap-2 mb-4">
          {([
            { key: 'tables' as const, label: 'Таблицы', icon: Table2 },
            { key: 'connections' as const, label: 'Подключения', icon: Zap },
            { key: 'queries' as const, label: 'Долгие запросы', icon: Clock },
            { key: 'storage' as const, label: 'Storage', icon: Folder },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setDetailTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                detailTab === key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {detailTab === 'tables' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Таблица</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-600">Строк (прибл.)</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-600">Размер</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-600">Seq Scans</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-600">Idx Scans</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-600">Dead Tuples</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Last Vacuum</th>
                  </tr>
                </thead>
                <tbody>
                  {tableStats.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">Нет данных</td></tr>
                  ) : (
                    tableStats.map((t) => (
                      <tr key={t.table_name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-2.5 text-sm font-medium text-slate-800">{t.table_name}</td>
                        <td className="px-5 py-2.5 text-sm text-right text-slate-600">{Math.round(t.row_estimate).toLocaleString()}</td>
                        <td className="px-5 py-2.5 text-sm text-right text-slate-600">{t.total_size}</td>
                        <td className="px-5 py-2.5 text-sm text-right text-slate-600">{(t.seq_scan || 0).toLocaleString()}</td>
                        <td className="px-5 py-2.5 text-sm text-right text-slate-600">{(t.idx_scan || 0).toLocaleString()}</td>
                        <td className="px-5 py-2.5 text-sm text-right">
                          <span className={t.n_dead_tup > 10000 ? 'text-red-600 font-medium' : 'text-slate-600'}>
                            {(t.n_dead_tup || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-slate-500">
                          {t.last_vacuum ? new Date(t.last_vacuum).toLocaleString('ru-RU') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detailTab === 'connections' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Приложение</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-600">Кол-во подключений</th>
                  </tr>
                </thead>
                <tbody>
                  {connectionsByApp.length === 0 ? (
                    <tr><td colSpan={2} className="py-10 text-center text-sm text-slate-400">Нет данных</td></tr>
                  ) : (
                    connectionsByApp.map((c) => (
                      <tr key={c.application_name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-2.5 text-sm font-medium text-slate-800">{c.application_name || '(без имени)'}</td>
                        <td className="px-5 py-2.5 text-sm text-right text-slate-600">{c.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detailTab === 'queries' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">PID</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Длительность</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Состояние</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Приложение</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Запрос</th>
                  </tr>
                </thead>
                <tbody>
                  {longQueries.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">Долгих запросов нет (&gt; 5 сек)</td></tr>
                  ) : (
                    longQueries.map((q) => (
                      <tr key={q.pid} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-2.5 text-sm font-mono text-slate-800">{q.pid}</td>
                        <td className="px-5 py-2.5 text-sm text-red-600 font-medium">{q.duration}</td>
                        <td className="px-5 py-2.5 text-sm text-slate-600">{q.state}</td>
                        <td className="px-5 py-2.5 text-sm text-slate-600">{q.application_name || '-'}</td>
                        <td className="px-5 py-2.5 text-xs text-slate-500 max-w-xs truncate font-mono">{q.query}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detailTab === 'storage' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Bucket</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Публичный</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {storageBuckets.length === 0 ? (
                    <tr><td colSpan={3} className="py-10 text-center text-sm text-slate-400">Нет данных о buckets</td></tr>
                  ) : (
                    storageBuckets.map((b) => (
                      <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-2.5 text-sm font-medium text-slate-800">{b.name}</td>
                        <td className="px-5 py-2.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            b.public ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {b.public ? 'Да' : 'Нет'}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-sm text-slate-500">
                          {new Date(b.created_at).toLocaleDateString('ru-RU')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemMetricsPanel;
