/*
  # Remove Insecure RLS Policies - Part 3

  1. Security Fixes
    - Removes insecure policies for WhatsApp, webhooks, and admin functions
    - Removes overly permissive "super admin" policies
    - Removes insecure policies for guest access, contracts, and company settings

  2. Tables Affected (Part 3)
    - whatsapp_messages, whatsapp_templates, webhook_logs
    - wazzup_channels, organizations, subscription_plans
    - addon_subscriptions, organization_subscriptions
    - usage_metrics, guest_access, guest_users
    - guest_project_access, project_legal_documents
    - executor_company_info, company_settings
    - contract_instances, crm_activity_log, crm_activity_logs
    - project_expenses, project_expenses_history
    - service_calculator_items

  CRITICAL: These policies allow unrestricted access!
*/

-- WhatsApp messages
DROP POLICY IF EXISTS "Public can delete messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Public can insert messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Public can view messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Public can update messages" ON whatsapp_messages;

-- WhatsApp templates
DROP POLICY IF EXISTS "Users can manage templates" ON whatsapp_templates;

-- Webhook logs
DROP POLICY IF EXISTS "Allow public insert on webhook_logs" ON webhook_logs;

-- Wazzup channels
DROP POLICY IF EXISTS "Admins can manage channels" ON wazzup_channels;

-- Organizations - remove super admin bypass policies
DROP POLICY IF EXISTS "Super admin can delete organizations" ON organizations;
DROP POLICY IF EXISTS "Super admin can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Super admin can update organizations" ON organizations;

-- Subscription plans
DROP POLICY IF EXISTS "Super admin can manage subscription plans" ON subscription_plans;

-- Addon subscriptions
DROP POLICY IF EXISTS "Super admin can manage addons" ON addon_subscriptions;

-- Organization subscriptions
DROP POLICY IF EXISTS "Super admin can manage subscriptions" ON organization_subscriptions;

-- Usage metrics
DROP POLICY IF EXISTS "Super admin can manage usage metrics" ON usage_metrics;

-- Guest access
DROP POLICY IF EXISTS "Team can manage guest access" ON guest_access;

-- Guest users
DROP POLICY IF EXISTS "Anyone can register as guest" ON guest_users;
DROP POLICY IF EXISTS "Guests can update own profile" ON guest_users;

-- Guest project access
DROP POLICY IF EXISTS "Anyone can link guest to project" ON guest_project_access;

-- Project legal documents
DROP POLICY IF EXISTS "Anyone can delete project legal documents" ON project_legal_documents;
DROP POLICY IF EXISTS "Anyone can upload project legal documents" ON project_legal_documents;

-- Executor company info
DROP POLICY IF EXISTS "Authenticated users can delete executor company info" ON executor_company_info;
DROP POLICY IF EXISTS "Authenticated users can insert executor company info" ON executor_company_info;
DROP POLICY IF EXISTS "Authenticated users can update executor company info" ON executor_company_info;

-- Company settings
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;

-- Contract instances
DROP POLICY IF EXISTS "Authenticated users can create instances" ON contract_instances;
DROP POLICY IF EXISTS "Authenticated users can delete instances" ON contract_instances;
DROP POLICY IF EXISTS "Authenticated users can update instances" ON contract_instances;

-- CRM activity log
DROP POLICY IF EXISTS "Users can insert crm activity log" ON crm_activity_log;

-- CRM activity logs
DROP POLICY IF EXISTS "Users can insert activity logs" ON crm_activity_logs;

-- Project expenses (Russian policies)
DROP POLICY IF EXISTS "Проджекты могут обновлять расходы" ON project_expenses;
DROP POLICY IF EXISTS "Проджекты могут создавать расходы" ON project_expenses;
DROP POLICY IF EXISTS "Проджекты могут удалять расходы" ON project_expenses;

-- Project expenses history
DROP POLICY IF EXISTS "Система может записывать историю" ON project_expenses_history;

-- Service calculator items
DROP POLICY IF EXISTS "Authenticated users can delete calculator items" ON service_calculator_items;
DROP POLICY IF EXISTS "Authenticated users can insert calculator items" ON service_calculator_items;
DROP POLICY IF EXISTS "Authenticated users can update calculator items" ON service_calculator_items;