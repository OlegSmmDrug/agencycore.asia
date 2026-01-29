/*
  # Remove Insecure RLS Policies - Part 2

  1. Security Fixes
    - Drops all "Allow public" policies for roadmap templates
    - Removes overly permissive policies for salary and payroll
    - Removes insecure policies for services, tasks, transactions

  2. Tables Affected (Part 2)
    - roadmap_template_stages, roadmap_template_tasks
    - roadmap_templates, salary_schemes, payroll_records
    - services, tasks, transactions, users

  CRITICAL: These policies allow unrestricted access!
*/

-- Roadmap template stages
DROP POLICY IF EXISTS "Allow public delete on roadmap_template_stages" ON roadmap_template_stages;
DROP POLICY IF EXISTS "Allow public insert on roadmap_template_stages" ON roadmap_template_stages;
DROP POLICY IF EXISTS "Allow public select on roadmap_template_stages" ON roadmap_template_stages;
DROP POLICY IF EXISTS "Allow public update on roadmap_template_stages" ON roadmap_template_stages;
DROP POLICY IF EXISTS "Admins can manage template stages" ON roadmap_template_stages;

-- Roadmap template tasks
DROP POLICY IF EXISTS "Allow public delete on roadmap_template_tasks" ON roadmap_template_tasks;
DROP POLICY IF EXISTS "Allow public insert on roadmap_template_tasks" ON roadmap_template_tasks;
DROP POLICY IF EXISTS "Allow public select on roadmap_template_tasks" ON roadmap_template_tasks;
DROP POLICY IF EXISTS "Allow public update on roadmap_template_tasks" ON roadmap_template_tasks;
DROP POLICY IF EXISTS "Admins can manage template tasks" ON roadmap_template_tasks;

-- Roadmap templates
DROP POLICY IF EXISTS "Allow public delete on roadmap_templates" ON roadmap_templates;
DROP POLICY IF EXISTS "Allow public insert on roadmap_templates" ON roadmap_templates;
DROP POLICY IF EXISTS "Allow public select on roadmap_templates" ON roadmap_templates;
DROP POLICY IF EXISTS "Allow public update on roadmap_templates" ON roadmap_templates;
DROP POLICY IF EXISTS "Admins can manage roadmap templates" ON roadmap_templates;

-- Salary schemes
DROP POLICY IF EXISTS "Allow public delete from salary_schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Allow public insert to salary_schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Allow public read access to salary_schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Allow public update to salary_schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Authenticated users can delete salary schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Authenticated users can insert salary schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Authenticated users can view salary schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Authenticated users can update salary schemes" ON salary_schemes;

-- Payroll records
DROP POLICY IF EXISTS "Allow public delete from payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "Allow public insert to payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "Allow public read access to payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "Allow public update to payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "Authenticated users can delete payroll records" ON payroll_records;
DROP POLICY IF EXISTS "Authenticated users can insert payroll records" ON payroll_records;
DROP POLICY IF EXISTS "Authenticated users can view payroll records" ON payroll_records;
DROP POLICY IF EXISTS "Authenticated users can update payroll records" ON payroll_records;

-- Services
DROP POLICY IF EXISTS "Allow public delete on services" ON services;
DROP POLICY IF EXISTS "Allow public insert on services" ON services;
DROP POLICY IF EXISTS "Allow public update on services" ON services;

-- Tasks
DROP POLICY IF EXISTS "Allow public delete on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public insert on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public select on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public update on tasks" ON tasks;

-- Transactions
DROP POLICY IF EXISTS "Allow public delete on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public insert on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public select on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public update on transactions" ON transactions;

-- Users - remove overly permissive policies
DROP POLICY IF EXISTS "Allow public delete on users" ON users;
DROP POLICY IF EXISTS "Allow public insert on users" ON users;
DROP POLICY IF EXISTS "Allow public select on users" ON users;
DROP POLICY IF EXISTS "Allow public update on users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;