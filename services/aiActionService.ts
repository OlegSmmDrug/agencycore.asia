import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { AIAction, ActionStatus, TaskStatus } from '../types';
import { clientService } from './clientService';
import { taskService } from './taskService';
import { projectService } from './projectService';
import { aiLeadService } from './aiLeadService';

export const aiActionService = {
  async getAllActions(): Promise<AIAction[]> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching actions:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name || 'Unknown Agent',
      organizationId: row.organization_id,
      actionType: row.action_type,
      description: row.description,
      reasoning: row.reasoning,
      data: row.data || {},
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : undefined,
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async getPendingActions(): Promise<AIAction[]> {
    const allActions = await this.getAllActions();
    return allActions.filter(action => action.status === 'pending');
  },

  async createAction(action: Partial<AIAction>): Promise<AIAction> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_actions')
      .insert({
        organization_id: organizationId,
        agent_id: action.agentId,
        agent_name: action.agentName || 'Unknown Agent',
        action_type: action.actionType,
        description: action.description,
        reasoning: action.reasoning,
        data: action.data || {},
        status: action.status || 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating action:', error);
      throw error;
    }

    return {
      id: data.id,
      agentId: data.agent_id,
      agentName: data.agent_name,
      organizationId: data.organization_id,
      actionType: data.action_type,
      description: data.description,
      reasoning: data.reasoning,
      data: data.data || {},
      status: data.status,
      reviewedBy: data.reviewed_by,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at).getTime() : undefined,
      createdAt: new Date(data.created_at).getTime()
    };
  },

  async approveAction(id: string, reviewerId: string): Promise<void> {
    const { data: action, error: fetchError } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !action) {
      throw new Error('Action not found');
    }

    const { error: updateError } = await supabase
      .from('ai_actions')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error approving action:', updateError);
      throw updateError;
    }

    await this.executeAction({
      id: action.id,
      agentId: action.agent_id,
      agentName: action.agent_name,
      actionType: action.action_type,
      description: action.description,
      reasoning: action.reasoning,
      data: action.data || {},
      status: 'approved',
      createdAt: new Date(action.created_at).getTime()
    });

    await supabase
      .from('ai_actions')
      .update({ status: 'executed' })
      .eq('id', id);
  },

  async rejectAction(id: string, reviewerId: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('ai_actions')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        data: { rejection_reason: reason }
      })
      .eq('id', id);

    if (error) {
      console.error('Error rejecting action:', error);
      throw error;
    }
  },

  async executeAction(action: AIAction): Promise<void> {
    const actionData = action.data;

    switch (action.actionType) {
      case 'create_lead':
        await aiLeadService.createLead({
          agentId: action.agentId,
          name: actionData.name || 'Новый лид',
          phone: actionData.phone,
          email: actionData.email,
          budget: parseFloat(actionData.budget) || 0,
          status: 'qualified',
          score: parseInt(actionData.score) || 5,
          extractedData: actionData,
          source: 'ai_agent'
        });
        break;

      case 'create_task':
        await taskService.create({
          title: actionData.title || 'Новая задача от ИИ',
          description: actionData.description || '',
          priority: actionData.priority || 'Medium',
          type: actionData.type || 'Task',
          status: TaskStatus.TODO,
          assigneeId: actionData.assigneeId,
          projectId: actionData.projectId,
          deadline: actionData.deadline,
          createdAt: new Date().toISOString()
        });
        break;

      case 'update_client':
        if (actionData.clientId) {
          await clientService.update(actionData.clientId, actionData.updates);
        }
        break;

      case 'create_project':
        await projectService.create({
          name: actionData.name || 'Новый проект',
          clientId: actionData.clientId,
          status: actionData.status || 'Strategy/KP',
          startDate: actionData.startDate || new Date().toISOString(),
          endDate: actionData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          budget: parseFloat(actionData.budget) || 0,
          duration: parseInt(actionData.duration) || 30,
          totalLTV: parseFloat(actionData.budget) || 0,
          description: actionData.description || '',
          teamIds: actionData.teamIds || [],
          services: actionData.services || ['SMM']
        });
        break;

      default:
        console.warn(`Unknown action type: ${action.actionType}`);
    }
  }
};
