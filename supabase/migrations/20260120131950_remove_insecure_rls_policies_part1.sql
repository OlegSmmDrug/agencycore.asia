/*
  # Remove Insecure RLS Policies - Part 1

  1. Security Fixes
    - Drops all "Allow public" policies that bypass RLS with USING (true)
    - Removes duplicate permissive policies
    - Keeps only organization-scoped secure policies

  2. Tables Affected (Part 1)
    - activity_log, calculator_services, clients
    - documents, job_titles, notifications
    - project_level1_stage_status, project_members
    - project_roadmap_stages, project_roadmap_templates
    - projects

  CRITICAL: These policies allow unrestricted access and must be removed!
*/

-- Activity log - keep organization-scoped policies
DROP POLICY IF EXISTS "Allow public delete on activity_log" ON activity_log;
DROP POLICY IF EXISTS "Allow public insert on activity_log" ON activity_log;
DROP POLICY IF EXISTS "Allow public select on activity_log" ON activity_log;
DROP POLICY IF EXISTS "Allow public update on activity_log" ON activity_log;

-- Calculator services
DROP POLICY IF EXISTS "Allow public delete on calculator_services" ON calculator_services;
DROP POLICY IF EXISTS "Allow public insert on calculator_services" ON calculator_services;
DROP POLICY IF EXISTS "Allow public update on calculator_services" ON calculator_services;

-- Clients
DROP POLICY IF EXISTS "Allow public delete on clients" ON clients;
DROP POLICY IF EXISTS "Allow public insert on clients" ON clients;
DROP POLICY IF EXISTS "Allow public select on clients" ON clients;
DROP POLICY IF EXISTS "Allow public update on clients" ON clients;

-- Documents
DROP POLICY IF EXISTS "Allow public delete on documents" ON documents;
DROP POLICY IF EXISTS "Allow public insert on documents" ON documents;
DROP POLICY IF EXISTS "Allow public select on documents" ON documents;
DROP POLICY IF EXISTS "Allow public update on documents" ON documents;

-- Job titles
DROP POLICY IF EXISTS "Allow public insert to job_titles" ON job_titles;
DROP POLICY IF EXISTS "Allow public update to job_titles" ON job_titles;

-- Notifications - remove anon role policies
DROP POLICY IF EXISTS "Public delete notifications" ON notifications;
DROP POLICY IF EXISTS "Public insert notifications" ON notifications;
DROP POLICY IF EXISTS "Public read notifications" ON notifications;
DROP POLICY IF EXISTS "Public update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON notifications;

-- Project level1 stage status
DROP POLICY IF EXISTS "Allow public delete from project_level1_stage_status" ON project_level1_stage_status;
DROP POLICY IF EXISTS "Allow public insert to project_level1_stage_status" ON project_level1_stage_status;
DROP POLICY IF EXISTS "Allow public update to project_level1_stage_status" ON project_level1_stage_status;

-- Project members
DROP POLICY IF EXISTS "Allow public delete on project_members" ON project_members;
DROP POLICY IF EXISTS "Allow public insert on project_members" ON project_members;
DROP POLICY IF EXISTS "Allow public update on project_members" ON project_members;

-- Project roadmap stages
DROP POLICY IF EXISTS "Allow public delete on project_roadmap_stages" ON project_roadmap_stages;
DROP POLICY IF EXISTS "Allow public insert on project_roadmap_stages" ON project_roadmap_stages;
DROP POLICY IF EXISTS "Allow public select on project_roadmap_stages" ON project_roadmap_stages;
DROP POLICY IF EXISTS "Allow public update on project_roadmap_stages" ON project_roadmap_stages;
DROP POLICY IF EXISTS "Users can manage project roadmap stages" ON project_roadmap_stages;

-- Project roadmap templates
DROP POLICY IF EXISTS "Allow public delete on project_roadmap_templates" ON project_roadmap_templates;
DROP POLICY IF EXISTS "Allow public insert on project_roadmap_templates" ON project_roadmap_templates;
DROP POLICY IF EXISTS "Allow public update on project_roadmap_templates" ON project_roadmap_templates;

-- Projects
DROP POLICY IF EXISTS "Allow public delete on projects" ON projects;
DROP POLICY IF EXISTS "Allow public insert on projects" ON projects;
DROP POLICY IF EXISTS "Allow public select on projects" ON projects;
DROP POLICY IF EXISTS "Allow public update on projects" ON projects;