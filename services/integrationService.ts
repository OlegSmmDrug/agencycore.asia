import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface Integration {
  id: string;
  organization_id: string;
  integration_type: string;
  name: string;
  description: string;
  category: 'crm_automation' | 'analytics' | 'communication' | 'marketplace';
  status: 'active' | 'inactive' | 'error' | 'needs_config';
  config: Record<string, any>;
  last_sync_at?: string;
  next_sync_at?: string;
  sync_frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  error_message?: string;
  error_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCredential {
  id: string;
  integration_id: string;
  credential_key: string;
  encrypted_value: any;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSyncLog {
  id: string;
  integration_id: string;
  sync_started_at: string;
  sync_finished_at?: string;
  status: 'running' | 'success' | 'failed' | 'partial';
  records_synced: number;
  records_failed: number;
  error_message?: string;
  details: Record<string, any>;
  created_at: string;
}

export const integrationService = {
  async getAllIntegrations(): Promise<Integration[]> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getIntegrationById(id: string): Promise<Integration | null> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getIntegrationsByCategory(category: string): Promise<Integration[]> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getIntegrationsByType(type: string): Promise<Integration[]> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_type', type)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createIntegration(integration: Partial<Integration>): Promise<Integration> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('integrations')
      .insert({
        ...integration,
        organization_id: organizationId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('integrations')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteIntegration(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw error;
  },

  async activateIntegration(id: string): Promise<void> {
    await this.updateIntegration(id, {
      is_active: true,
      status: 'active',
      error_message: undefined,
      error_count: 0,
    });
  },

  async deactivateIntegration(id: string): Promise<void> {
    await this.updateIntegration(id, {
      is_active: false,
      status: 'inactive',
    });
  },

  async recordError(id: string, errorMessage: string): Promise<void> {
    const integration = await this.getIntegrationById(id);
    if (!integration) return;

    await this.updateIntegration(id, {
      status: 'error',
      error_message: errorMessage,
      error_count: integration.error_count + 1,
    });
  },

  async clearError(id: string): Promise<void> {
    await this.updateIntegration(id, {
      status: 'active',
      error_message: undefined,
      error_count: 0,
    });
  },

  async updateSyncSchedule(id: string, frequency: string, nextSyncAt?: string): Promise<void> {
    await this.updateIntegration(id, {
      sync_frequency: frequency as any,
      next_sync_at: nextSyncAt,
    });
  },

  async getSyncLogs(integrationId: string, limit: number = 50): Promise<IntegrationSyncLog[]> {
    const { data, error } = await supabase
      .from('integration_sync_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async createSyncLog(log: Partial<IntegrationSyncLog>): Promise<IntegrationSyncLog> {
    const { data, error } = await supabase
      .from('integration_sync_logs')
      .insert(log)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSyncLog(id: string, updates: Partial<IntegrationSyncLog>): Promise<void> {
    const { error } = await supabase
      .from('integration_sync_logs')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async getActiveIntegrationsForSync(): Promise<Integration[]> {
    const organizationId = getCurrentOrganizationId();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .neq('sync_frequency', 'manual')
      .lte('next_sync_at', now);

    if (error) throw error;
    return data || [];
  },

  async trackApiCall(
    integrationId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    isSuccess: boolean,
    errorMessage?: string
  ): Promise<void> {
    await supabase.from('integration_api_calls').insert({
      integration_id: integrationId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      is_success: isSuccess,
      error_message: errorMessage,
    });
  },

  async getApiCallStats(integrationId: string, hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('integration_api_calls')
      .select('*')
      .eq('integration_id', integrationId)
      .gte('created_at', since);

    if (error) throw error;

    const calls = data || [];
    return {
      total_calls: calls.length,
      success_count: calls.filter(c => c.is_success).length,
      error_count: calls.filter(c => !c.is_success).length,
      avg_response_time: calls.reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / (calls.length || 1),
      quota_used: calls.reduce((sum, c) => sum + (c.quota_used || 1), 0),
    };
  },
};
