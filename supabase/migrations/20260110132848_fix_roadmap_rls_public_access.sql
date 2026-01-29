/*
  # Fix Roadmap RLS Policies for Public Access
  
  ## Changes
    - Update `roadmap_stage_level1` policies to allow public access
    - Update `project_members` policies to allow public access
    - Update `project_roadmap_templates` policies to allow public access
    - Update `roadmap_templates` policies to allow public access
    - Update `roadmap_template_stages` policies to allow public access
    - Update `roadmap_template_tasks` policies to allow public access
    - Update `project_roadmap_stages` policies to allow public access
  
  ## Notes
    - This enables the roadmap setup to work without Supabase Auth
    - Matches the public access pattern from other tables
*/

-- Fix roadmap_stage_level1 policies
DROP POLICY IF EXISTS "Allow read on roadmap_stage_level1" ON roadmap_stage_level1;
CREATE POLICY "Allow public select on roadmap_stage_level1" 
  ON roadmap_stage_level1 
  FOR SELECT 
  USING (true);

-- Fix project_members policies
DROP POLICY IF EXISTS "Allow all operations on project_members" ON project_members;
CREATE POLICY "Allow public select on project_members" 
  ON project_members 
  FOR SELECT 
  USING (true);
CREATE POLICY "Allow public insert on project_members" 
  ON project_members 
  FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "Allow public update on project_members" 
  ON project_members 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
CREATE POLICY "Allow public delete on project_members" 
  ON project_members 
  FOR DELETE 
  USING (true);

-- Fix project_roadmap_templates policies
DROP POLICY IF EXISTS "Allow all operations on project_roadmap_templates" ON project_roadmap_templates;
CREATE POLICY "Allow public select on project_roadmap_templates" 
  ON project_roadmap_templates 
  FOR SELECT 
  USING (true);
CREATE POLICY "Allow public insert on project_roadmap_templates" 
  ON project_roadmap_templates 
  FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "Allow public update on project_roadmap_templates" 
  ON project_roadmap_templates 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
CREATE POLICY "Allow public delete on project_roadmap_templates" 
  ON project_roadmap_templates 
  FOR DELETE 
  USING (true);

-- Fix roadmap_templates policies (if they exist)
DROP POLICY IF EXISTS "Allow authenticated read on roadmap_templates" ON roadmap_templates;
DROP POLICY IF EXISTS "Allow authenticated insert on roadmap_templates" ON roadmap_templates;
DROP POLICY IF EXISTS "Allow authenticated update on roadmap_templates" ON roadmap_templates;
DROP POLICY IF EXISTS "Allow authenticated delete on roadmap_templates" ON roadmap_templates;

CREATE POLICY "Allow public select on roadmap_templates" 
  ON roadmap_templates 
  FOR SELECT 
  USING (true);
CREATE POLICY "Allow public insert on roadmap_templates" 
  ON roadmap_templates 
  FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "Allow public update on roadmap_templates" 
  ON roadmap_templates 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
CREATE POLICY "Allow public delete on roadmap_templates" 
  ON roadmap_templates 
  FOR DELETE 
  USING (true);

-- Fix roadmap_template_stages policies
DROP POLICY IF EXISTS "Allow authenticated read on roadmap_template_stages" ON roadmap_template_stages;
DROP POLICY IF EXISTS "Allow authenticated insert on roadmap_template_stages" ON roadmap_template_stages;
DROP POLICY IF EXISTS "Allow authenticated update on roadmap_template_stages" ON roadmap_template_stages;
DROP POLICY IF EXISTS "Allow authenticated delete on roadmap_template_stages" ON roadmap_template_stages;

CREATE POLICY "Allow public select on roadmap_template_stages" 
  ON roadmap_template_stages 
  FOR SELECT 
  USING (true);
CREATE POLICY "Allow public insert on roadmap_template_stages" 
  ON roadmap_template_stages 
  FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "Allow public update on roadmap_template_stages" 
  ON roadmap_template_stages 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
CREATE POLICY "Allow public delete on roadmap_template_stages" 
  ON roadmap_template_stages 
  FOR DELETE 
  USING (true);

-- Fix roadmap_template_tasks policies
DROP POLICY IF EXISTS "Allow authenticated read on roadmap_template_tasks" ON roadmap_template_tasks;
DROP POLICY IF EXISTS "Allow authenticated insert on roadmap_template_tasks" ON roadmap_template_tasks;
DROP POLICY IF EXISTS "Allow authenticated update on roadmap_template_tasks" ON roadmap_template_tasks;
DROP POLICY IF EXISTS "Allow authenticated delete on roadmap_template_tasks" ON roadmap_template_tasks;

CREATE POLICY "Allow public select on roadmap_template_tasks" 
  ON roadmap_template_tasks 
  FOR SELECT 
  USING (true);
CREATE POLICY "Allow public insert on roadmap_template_tasks" 
  ON roadmap_template_tasks 
  FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "Allow public update on roadmap_template_tasks" 
  ON roadmap_template_tasks 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
CREATE POLICY "Allow public delete on roadmap_template_tasks" 
  ON roadmap_template_tasks 
  FOR DELETE 
  USING (true);

-- Fix project_roadmap_stages policies
DROP POLICY IF EXISTS "Allow authenticated read on project_roadmap_stages" ON project_roadmap_stages;
DROP POLICY IF EXISTS "Allow authenticated insert on project_roadmap_stages" ON project_roadmap_stages;
DROP POLICY IF EXISTS "Allow authenticated update on project_roadmap_stages" ON project_roadmap_stages;
DROP POLICY IF EXISTS "Allow authenticated delete on project_roadmap_stages" ON project_roadmap_stages;

CREATE POLICY "Allow public select on project_roadmap_stages" 
  ON project_roadmap_stages 
  FOR SELECT 
  USING (true);
CREATE POLICY "Allow public insert on project_roadmap_stages" 
  ON project_roadmap_stages 
  FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "Allow public update on project_roadmap_stages" 
  ON project_roadmap_stages 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
CREATE POLICY "Allow public delete on project_roadmap_stages" 
  ON project_roadmap_stages 
  FOR DELETE 
  USING (true);
