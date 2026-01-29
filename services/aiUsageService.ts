import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { UsageStats } from '../types';

export const aiUsageService = {
  async trackUsage(
    agentId: string,
    tokensInput: number,
    tokensOutput: number,
    cost: number,
    success: boolean = true
  ): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    const today = new Date().toISOString().split('T')[0];

    const { data: existing, error: fetchError } = await supabase
      .from('ai_usage_stats')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', organizationId)
      .eq('date', today)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching usage stats:', fetchError);
      throw fetchError;
    }

    if (existing) {
      const totalRequests = existing.requests_count + 1;
      const successCount = existing.success_rate * existing.requests_count + (success ? 1 : 0);
      const newSuccessRate = successCount / totalRequests;

      const { error: updateError } = await supabase
        .from('ai_usage_stats')
        .update({
          requests_count: totalRequests,
          tokens_input: existing.tokens_input + tokensInput,
          tokens_output: existing.tokens_output + tokensOutput,
          cost_spent: existing.cost_spent + cost,
          success_rate: newSuccessRate
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating usage stats:', updateError);
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase
        .from('ai_usage_stats')
        .insert({
          agent_id: agentId,
          organization_id: organizationId,
          date: today,
          requests_count: 1,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          cost_spent: cost,
          success_rate: success ? 1.0 : 0.0
        });

      if (insertError) {
        console.error('Error inserting usage stats:', insertError);
        throw insertError;
      }
    }
  },

  async getUsageStats(period: 'today' | 'week' | 'month' = 'today'): Promise<UsageStats> {
    const organizationId = getCurrentOrganizationId();
    const today = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(today.toISOString().split('T')[0]);
    }

    const { data, error } = await supabase
      .from('ai_usage_stats')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('date', startDate.toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching usage stats:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        requestsToday: 0,
        tokensUsed: 0,
        costSpent: 0,
        successRate: 100
      };
    }

    const requestsToday = data.reduce((sum, row) => sum + row.requests_count, 0);
    const tokensUsed = data.reduce((sum, row) => sum + row.tokens_input + row.tokens_output, 0);
    const costSpent = data.reduce((sum, row) => sum + row.cost_spent, 0);
    const avgSuccessRate = data.reduce((sum, row) => sum + row.success_rate, 0) / data.length;

    return {
      requestsToday,
      tokensUsed,
      costSpent,
      successRate: Math.round(avgSuccessRate * 100)
    };
  },

  async checkDailyLimit(agentId: string, dailyLimit: number): Promise<boolean> {
    const organizationId = getCurrentOrganizationId();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ai_usage_stats')
      .select('cost_spent')
      .eq('agent_id', agentId)
      .eq('organization_id', organizationId)
      .eq('date', today)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking daily limit:', error);
      return true;
    }

    if (!data) {
      return true;
    }

    return data.cost_spent < dailyLimit;
  },

  async getAgentStats(agentId: string, days: number = 7): Promise<any[]> {
    const organizationId = getCurrentOrganizationId();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ai_usage_stats')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', organizationId)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching agent stats:', error);
      return [];
    }

    return data || [];
  }
};
