import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface AutomationRule {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  trigger_type: 'client_created' | 'client_status_changed' | 'task_created' | 'task_completed' | 'payment_received' | 'deadline_approaching' | 'project_created' | 'project_status_changed';
  trigger_config: Record<string, any>;
  condition_config: Record<string, any>;
  action_type: 'create_task' | 'send_whatsapp' | 'send_email' | 'change_status' | 'assign_manager' | 'webhook' | 'create_notification';
  action_config: Record<string, any>;
  is_active: boolean;
  execution_count: number;
  last_executed_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const automationRuleService = {
  async getAllRules(): Promise<AutomationRule[]> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getActiveRules(): Promise<AutomationRule[]> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getRulesByTrigger(triggerType: string): Promise<AutomationRule[]> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('trigger_type', triggerType)
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  },

  async getRuleById(id: string): Promise<AutomationRule | null> {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createRule(rule: Partial<AutomationRule>): Promise<AutomationRule> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        ...rule,
        organization_id: organizationId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateRule(id: string, updates: Partial<AutomationRule>): Promise<AutomationRule> {
    const { data, error } = await supabase
      .from('automation_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteRule(id: string): Promise<void> {
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleRule(id: string, isActive: boolean): Promise<void> {
    await this.updateRule(id, { is_active: isActive });
  },

  async recordExecution(id: string): Promise<void> {
    const rule = await this.getRuleById(id);
    if (!rule) return;

    await this.updateRule(id, {
      execution_count: rule.execution_count + 1,
      last_executed_at: new Date().toISOString(),
    });
  },

  async evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): Promise<boolean> {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    for (const [field, condition] of Object.entries(conditions)) {
      const value = context[field];

      if (condition.operator === 'equals' && value !== condition.value) {
        return false;
      }

      if (condition.operator === 'not_equals' && value === condition.value) {
        return false;
      }

      if (condition.operator === 'greater_than' && !(value > condition.value)) {
        return false;
      }

      if (condition.operator === 'less_than' && !(value < condition.value)) {
        return false;
      }

      if (condition.operator === 'contains' && !String(value).includes(condition.value)) {
        return false;
      }

      if (condition.operator === 'in' && !condition.value.includes(value)) {
        return false;
      }
    }

    return true;
  },

  async executeAction(actionType: string, actionConfig: Record<string, any>, context: Record<string, any>): Promise<void> {
    switch (actionType) {
      case 'create_task':
        await this.executeCreateTask(actionConfig, context);
        break;
      case 'send_whatsapp':
        await this.executeSendWhatsApp(actionConfig, context);
        break;
      case 'send_email':
        await this.executeSendEmail(actionConfig, context);
        break;
      case 'change_status':
        await this.executeChangeStatus(actionConfig, context);
        break;
      case 'assign_manager':
        await this.executeAssignManager(actionConfig, context);
        break;
      case 'webhook':
        await this.executeWebhook(actionConfig, context);
        break;
      case 'create_notification':
        await this.executeCreateNotification(actionConfig, context);
        break;
      default:
        console.warn(`Unknown action type: ${actionType}`);
    }
  },

  async executeCreateTask(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    const { taskService } = await import('./taskService');

    const title = this.replaceVariables(config.title, context);
    const description = this.replaceVariables(config.description || '', context);

    const { TaskStatus } = await import('../types');

    await taskService.create({
      title,
      description,
      projectId: context.project_id || config.project_id,
      assigneeId: config.assigned_to,
      type: config.task_type || 'default',
      priority: config.priority || 'Medium',
      deadline: config.due_date,
      status: TaskStatus.TODO,
    });
  },

  async executeSendWhatsApp(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    const message = this.replaceVariables(config.message, context);
    const phoneNumber = context.client_phone || config.phone_number;

    if (phoneNumber) {
      console.log('WhatsApp message would be sent to:', phoneNumber, message);
    }
  },

  async executeSendEmail(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    console.log('Email sending not yet implemented');
  },

  async executeChangeStatus(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    if (context.client_id && config.new_status) {
      const { clientService } = await import('./clientService');
      await clientService.update(context.client_id, {
        status: config.new_status,
      });
    }
  },

  async executeAssignManager(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    if (context.client_id && config.manager_id) {
      const { clientService } = await import('./clientService');
      await clientService.update(context.client_id, {
        managerId: config.manager_id,
      });
    }
  },

  async executeWebhook(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    const url = config.webhook_url;
    const payload = this.replaceVariablesInObject(config.payload || {}, context);

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {}),
        },
        body: JSON.stringify({ ...payload, ...context }),
      });
    } catch (error) {
      console.error('Webhook execution failed:', error);
    }
  },

  async executeCreateNotification(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    const { notificationService } = await import('./notificationService');

    const message = this.replaceVariables(config.message, context);

    await notificationService.create({
      userId: config.user_id || context.user_id,
      title: config.title || 'Automation Notification',
      message,
      type: config.notification_type || 'info',
    });
  },

  replaceVariables(template: string, context: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(context)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  },

  replaceVariablesInObject(obj: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.replaceVariables(value, context);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.replaceVariablesInObject(value, context);
      } else {
        result[key] = value;
      }
    }
    return result;
  },

  async triggerRules(triggerType: string, context: Record<string, any>): Promise<void> {
    const rules = await this.getRulesByTrigger(triggerType);

    for (const rule of rules) {
      try {
        const conditionsMet = await this.evaluateConditions(rule.condition_config, context);

        if (conditionsMet) {
          await this.executeAction(rule.action_type, rule.action_config, context);
          await this.recordExecution(rule.id);
        }
      } catch (error) {
        console.error(`Failed to execute rule ${rule.id}:`, error);
      }
    }
  },
};
