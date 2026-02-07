import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId, getCurrentUserId } from '../utils/organizationContext';

export interface AiCreditBalance {
  balance: number;
  isAiEnabled: boolean;
  dailyLimit: number | null;
}

export interface AiTransaction {
  id: string;
  organization_id: string;
  user_id: string;
  request_id: string;
  model_slug: string;
  input_tokens: number;
  output_tokens: number;
  base_cost: number;
  markup_cost: number;
  balance_before: number;
  balance_after: number;
  request_summary: string;
  created_at: string;
}

export interface AiModelPricing {
  id: string;
  model_slug: string;
  display_name: string;
  input_price_per_1m: number;
  output_price_per_1m: number;
  markup_multiplier: number;
  is_active: boolean;
  sort_order: number;
}

export interface AiPlatformSettings {
  id: string;
  master_api_key: string;
  default_daily_limit: number;
  low_balance_threshold_percent: number;
  global_ai_enabled: boolean;
  cache_ttl_minutes: number;
  credit_price_kzt: number;
  min_topup_credits: number;
  updated_at: string;
  updated_by: string | null;
}

export const aiCreditService = {
  async getBalance(): Promise<AiCreditBalance> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return { balance: 0, isAiEnabled: false, dailyLimit: null };

    const { data, error } = await supabase
      .from('organizations')
      .select('ai_credit_balance, is_ai_enabled, ai_daily_limit')
      .eq('id', orgId)
      .maybeSingle();

    if (error || !data) return { balance: 0, isAiEnabled: false, dailyLimit: null };

    return {
      balance: data.ai_credit_balance || 0,
      isAiEnabled: data.is_ai_enabled || false,
      dailyLimit: data.ai_daily_limit,
    };
  },

  async getDailySpend(): Promise<number> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return 0;

    const { data, error } = await supabase.rpc('get_org_daily_ai_spend', { p_org_id: orgId });
    if (error) return 0;
    return data || 0;
  },

  async getTransactionHistory(limit = 50, offset = 0): Promise<AiTransaction[]> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return [];

    const { data, error } = await supabase
      .from('ai_credit_transactions')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return [];
    return data || [];
  },

  async purchaseCredits(creditAmount: number): Promise<{ success: boolean; error?: string; kztSpent?: number; balanceAfter?: number }> {
    const orgId = getCurrentOrganizationId();
    const userId = getCurrentUserId();
    if (!orgId || !userId) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('purchase_ai_credits', {
      p_org_id: orgId,
      p_user_id: userId,
      p_credit_amount: creditAmount,
    });

    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error || 'Purchase failed' };

    return {
      success: true,
      kztSpent: data.kzt_spent,
      balanceAfter: data.ai_balance_after,
    };
  },

  async toggleAi(enabled: boolean): Promise<boolean> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return false;

    const { error } = await supabase
      .from('organizations')
      .update({ is_ai_enabled: enabled })
      .eq('id', orgId);

    return !error;
  },

  async getPlatformSettings(): Promise<AiPlatformSettings | null> {
    const { data, error } = await supabase
      .from('ai_platform_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  },

  async updatePlatformSettings(updates: Partial<AiPlatformSettings>): Promise<boolean> {
    const userId = getCurrentUserId();
    const { data: existing } = await supabase
      .from('ai_platform_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) return false;

    const { error } = await supabase
      .from('ai_platform_settings')
      .update({ ...updates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    return !error;
  },

  async getModelPricing(): Promise<AiModelPricing[]> {
    const { data, error } = await supabase
      .from('ai_model_pricing')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) return [];
    return data || [];
  },

  async updateModelPricing(id: string, updates: Partial<AiModelPricing>): Promise<boolean> {
    const { error } = await supabase
      .from('ai_model_pricing')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    return !error;
  },

  async createModelPricing(model: Omit<AiModelPricing, 'id'>): Promise<boolean> {
    const { error } = await supabase
      .from('ai_model_pricing')
      .insert(model);

    return !error;
  },

  async adminTopupCredits(orgId: string, amount: number, description: string): Promise<{ success: boolean; error?: string }> {
    const adminId = getCurrentUserId();
    if (!adminId) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('topup_ai_credits', {
      p_org_id: orgId,
      p_admin_id: adminId,
      p_amount: amount,
      p_description: description,
    });

    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error || 'Top-up failed' };
    return { success: true };
  },

  async adminDeductCredits(orgId: string, amount: number, description: string): Promise<{ success: boolean; error?: string }> {
    const adminId = getCurrentUserId();
    if (!adminId) return { success: false, error: 'Not authenticated' };

    const { data: org } = await supabase
      .from('organizations')
      .select('ai_credit_balance')
      .eq('id', orgId)
      .maybeSingle();

    if (!org) return { success: false, error: 'Organization not found' };

    const newBalance = (org.ai_credit_balance || 0) - amount;
    if (newBalance < 0) return { success: false, error: 'Insufficient balance for deduction' };

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ ai_credit_balance: newBalance })
      .eq('id', orgId);

    if (updateError) return { success: false, error: updateError.message };

    await supabase.from('ai_credit_transactions').insert({
      organization_id: orgId,
      user_id: adminId,
      request_id: 'deduct_' + crypto.randomUUID(),
      model_slug: 'admin_deduct',
      input_tokens: 0,
      output_tokens: 0,
      base_cost: 0,
      markup_cost: amount,
      balance_before: org.ai_credit_balance,
      balance_after: newBalance,
      request_summary: description,
    });

    return { success: true };
  },

  async getOrgTransactions(orgId: string, limit = 50): Promise<AiTransaction[]> {
    const { data, error } = await supabase
      .from('ai_credit_transactions')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },

  async getMinTopupCredits(): Promise<number> {
    const settings = await this.getPlatformSettings();
    return settings?.min_topup_credits || 100;
  },

  async getCreditPriceKzt(): Promise<number> {
    const settings = await this.getPlatformSettings();
    return settings?.credit_price_kzt || 1;
  },
};
