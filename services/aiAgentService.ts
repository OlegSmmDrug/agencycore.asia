import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { AIAgent, AgentStatus } from '../types';

export const aiAgentService = {
  async getAllAgents(): Promise<AIAgent[]> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      model: row.model,
      role: row.role,
      status: row.status,
      triggers: row.triggers || [],
      settings: {
        communicationStyle: row.communication_style,
        systemPrompt: row.system_prompt,
        temperature: row.temperature,
        maxTokens: row.max_tokens,
        useKnowledgeBase: row.use_knowledge_base,
        dailyCostLimit: row.daily_cost_limit,
        autoMode: row.auto_mode
      },
      permissions: row.permissions || {},
      knowledgeBase: {
        faqs: [],
        documents: []
      },
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      createdBy: row.created_by
    }));
  },

  async getAgentById(id: string): Promise<AIAgent | null> {
    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching agent:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      model: data.model,
      role: data.role,
      status: data.status,
      triggers: data.triggers || [],
      settings: {
        communicationStyle: data.communication_style,
        systemPrompt: data.system_prompt,
        temperature: data.temperature,
        maxTokens: data.max_tokens,
        useKnowledgeBase: data.use_knowledge_base,
        dailyCostLimit: data.daily_cost_limit,
        autoMode: data.auto_mode
      },
      permissions: data.permissions || {},
      knowledgeBase: {
        faqs: [],
        documents: []
      },
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      createdBy: data.created_by
    };
  },

  async createAgent(agent: Partial<AIAgent>): Promise<AIAgent> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_agents')
      .insert({
        organization_id: organizationId,
        name: agent.name,
        model: agent.model,
        role: agent.role,
        status: agent.status || 'inactive',
        triggers: agent.triggers || [],
        communication_style: agent.settings?.communicationStyle || 'conversational',
        system_prompt: agent.settings?.systemPrompt || '',
        temperature: agent.settings?.temperature || 0.7,
        max_tokens: agent.settings?.maxTokens || 2000,
        use_knowledge_base: agent.settings?.useKnowledgeBase ?? true,
        daily_cost_limit: agent.settings?.dailyCostLimit || 5.0,
        auto_mode: agent.settings?.autoMode || false,
        permissions: agent.permissions || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating agent:', error);
      throw error;
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      model: data.model,
      role: data.role,
      status: data.status,
      triggers: data.triggers || [],
      settings: {
        communicationStyle: data.communication_style,
        systemPrompt: data.system_prompt,
        temperature: data.temperature,
        maxTokens: data.max_tokens,
        useKnowledgeBase: data.use_knowledge_base,
        dailyCostLimit: data.daily_cost_limit,
        autoMode: data.auto_mode
      },
      permissions: data.permissions || {},
      knowledgeBase: {
        faqs: [],
        documents: []
      },
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      createdBy: data.created_by
    };
  },

  async updateAgent(id: string, updates: Partial<AIAgent>): Promise<AIAgent> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.model) updateData.model = updates.model;
    if (updates.status) updateData.status = updates.status;
    if (updates.triggers) updateData.triggers = updates.triggers;

    if (updates.settings) {
      if (updates.settings.communicationStyle) updateData.communication_style = updates.settings.communicationStyle;
      if (updates.settings.systemPrompt !== undefined) updateData.system_prompt = updates.settings.systemPrompt;
      if (updates.settings.temperature !== undefined) updateData.temperature = updates.settings.temperature;
      if (updates.settings.maxTokens !== undefined) updateData.max_tokens = updates.settings.maxTokens;
      if (updates.settings.useKnowledgeBase !== undefined) updateData.use_knowledge_base = updates.settings.useKnowledgeBase;
      if (updates.settings.dailyCostLimit !== undefined) updateData.daily_cost_limit = updates.settings.dailyCostLimit;
      if (updates.settings.autoMode !== undefined) updateData.auto_mode = updates.settings.autoMode;
    }

    if (updates.permissions) updateData.permissions = updates.permissions;

    const { data, error } = await supabase
      .from('ai_agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating agent:', error);
      throw error;
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      model: data.model,
      role: data.role,
      status: data.status,
      triggers: data.triggers || [],
      settings: {
        communicationStyle: data.communication_style,
        systemPrompt: data.system_prompt,
        temperature: data.temperature,
        maxTokens: data.max_tokens,
        useKnowledgeBase: data.use_knowledge_base,
        dailyCostLimit: data.daily_cost_limit,
        autoMode: data.auto_mode
      },
      permissions: data.permissions || {},
      knowledgeBase: {
        faqs: [],
        documents: []
      },
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      createdBy: data.created_by
    };
  },

  async deleteAgent(id: string): Promise<void> {
    const { error } = await supabase
      .from('ai_agents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  },

  async toggleAgentStatus(id: string, status: AgentStatus): Promise<void> {
    const { error } = await supabase
      .from('ai_agents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error toggling agent status:', error);
      throw error;
    }
  }
};
