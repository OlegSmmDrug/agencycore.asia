import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface MarketingChannel {
  id: string;
  organizationId: string;
  name: string;
  channelType: 'paid' | 'organic' | 'referral';
  monthlyBudget: number;
  isActive: boolean;
  integrationId?: string | null;
  icon: string;
  color: string;
  createdAt: string;
}

export interface MarketingSpend {
  id: string;
  organizationId: string;
  channelId: string;
  month: string;
  amount: number;
  leadsCount: number;
  impressions: number;
  clicks: number;
  conversions: number;
  notes: string;
  createdAt: string;
}

export interface SalesTarget {
  id: string;
  organizationId: string;
  userId: string;
  month: string;
  revenueTarget: number;
  leadsTarget: number;
  conversionTarget: number;
}

export interface ChannelPerformance {
  channelId: string;
  channelName: string;
  channelType: string;
  color: string;
  spend: number;
  leads: number;
  cpl: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  revenue: number;
  roi: number;
  isIntegrated: boolean;
}

class MarketingChannelService {
  async getChannels(): Promise<MarketingChannel[]> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return [];

    const { data } = await supabase
      .from('marketing_channels')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    return (data || []).map(this.mapChannel);
  }

  async createChannel(channel: Partial<MarketingChannel>): Promise<MarketingChannel | null> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return null;

    const { data } = await supabase
      .from('marketing_channels')
      .insert({
        organization_id: orgId,
        name: channel.name,
        channel_type: channel.channelType || 'paid',
        monthly_budget: channel.monthlyBudget || 0,
        is_active: true,
        integration_id: channel.integrationId || null,
        icon: channel.icon || '',
        color: channel.color || '#3b82f6',
      })
      .select()
      .single();

    return data ? this.mapChannel(data) : null;
  }

  async updateChannel(id: string, updates: Partial<MarketingChannel>): Promise<void> {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.channelType !== undefined) payload.channel_type = updates.channelType;
    if (updates.monthlyBudget !== undefined) payload.monthly_budget = updates.monthlyBudget;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.color !== undefined) payload.color = updates.color;

    await supabase.from('marketing_channels').update(payload).eq('id', id);
  }

  async deleteChannel(id: string): Promise<void> {
    await supabase.from('marketing_channels').delete().eq('id', id);
  }

  async getSpend(month?: string): Promise<MarketingSpend[]> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return [];

    let query = supabase
      .from('marketing_spend')
      .select('*')
      .eq('organization_id', orgId);

    if (month) query = query.eq('month', month);

    const { data } = await query.order('month', { ascending: false });
    return (data || []).map(this.mapSpend);
  }

  async getSpendRange(startMonth: string, endMonth: string): Promise<MarketingSpend[]> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return [];

    const { data } = await supabase
      .from('marketing_spend')
      .select('*')
      .eq('organization_id', orgId)
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true });

    return (data || []).map(this.mapSpend);
  }

  async upsertSpend(spend: Partial<MarketingSpend>): Promise<void> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return;

    await supabase
      .from('marketing_spend')
      .upsert({
        organization_id: orgId,
        channel_id: spend.channelId,
        month: spend.month,
        amount: spend.amount || 0,
        leads_count: spend.leadsCount || 0,
        impressions: spend.impressions || 0,
        clicks: spend.clicks || 0,
        conversions: spend.conversions || 0,
        notes: spend.notes || '',
      }, { onConflict: 'organization_id,channel_id,month' });
  }

  async getSalesTargets(month: string): Promise<SalesTarget[]> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return [];

    const { data } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('organization_id', orgId)
      .eq('month', month);

    return (data || []).map(this.mapTarget);
  }

  async upsertSalesTarget(target: Partial<SalesTarget>): Promise<void> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return;

    await supabase
      .from('sales_targets')
      .upsert({
        organization_id: orgId,
        user_id: target.userId,
        month: target.month,
        revenue_target: target.revenueTarget || 0,
        leads_target: target.leadsTarget || 0,
        conversion_target: target.conversionTarget || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id,month' });
  }

  async getChannelPerformance(month: string, clients: any[], transactions: any[]): Promise<ChannelPerformance[]> {
    const channels = await this.getChannels();
    const spendData = await this.getSpend(month);

    const sourceToChannel: Record<string, string> = {};
    channels.forEach(ch => {
      const lower = ch.name.toLowerCase();
      if (lower.includes('google')) sourceToChannel['Website'] = ch.id;
      if (lower.includes('facebook') || lower.includes('instagram') || lower.includes('socials')) sourceToChannel['Socials'] = ch.id;
      if (lower.includes('referral') || lower.includes('реферал')) sourceToChannel['Referral'] = ch.id;
      if (lower.includes('cold') || lower.includes('холодн')) sourceToChannel['Cold Call'] = ch.id;
      if (lower.includes('creatium')) sourceToChannel['Creatium'] = ch.id;
    });

    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const monthClients = clients.filter(c => {
      const created = new Date(c.createdAt);
      return created >= monthStart && created <= monthEnd;
    });

    const clientRevenue: Record<string, number> = {};
    transactions.filter(t => t.amount > 0).forEach(t => {
      if (t.clientId) clientRevenue[t.clientId] = (clientRevenue[t.clientId] || 0) + t.amount;
    });

    return channels.filter(ch => ch.isActive).map(ch => {
      const spend = spendData.find(s => s.channelId === ch.id);
      const channelClients = monthClients.filter(c => sourceToChannel[c.source] === ch.id);
      const leads = spend?.leadsCount || channelClients.length;
      const revenue = channelClients.reduce((s, c) => s + (clientRevenue[c.id] || 0), 0);
      const spendAmount = spend?.amount || 0;

      return {
        channelId: ch.id,
        channelName: ch.name,
        channelType: ch.channelType,
        color: ch.color,
        spend: spendAmount,
        leads,
        cpl: leads > 0 ? spendAmount / leads : 0,
        clicks: spend?.clicks || 0,
        impressions: spend?.impressions || 0,
        conversions: spend?.conversions || 0,
        ctr: (spend?.impressions || 0) > 0 ? ((spend?.clicks || 0) / spend!.impressions) * 100 : 0,
        revenue,
        roi: spendAmount > 0 ? ((revenue - spendAmount) / spendAmount) * 100 : 0,
        isIntegrated: !!ch.integrationId,
      };
    });
  }

  private mapChannel(row: any): MarketingChannel {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      channelType: row.channel_type,
      monthlyBudget: Number(row.monthly_budget) || 0,
      isActive: row.is_active,
      integrationId: row.integration_id,
      icon: row.icon || '',
      color: row.color || '#3b82f6',
      createdAt: row.created_at,
    };
  }

  private mapSpend(row: any): MarketingSpend {
    return {
      id: row.id,
      organizationId: row.organization_id,
      channelId: row.channel_id,
      month: row.month,
      amount: Number(row.amount) || 0,
      leadsCount: row.leads_count || 0,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      conversions: row.conversions || 0,
      notes: row.notes || '',
      createdAt: row.created_at,
    };
  }

  private mapTarget(row: any): SalesTarget {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      month: row.month,
      revenueTarget: Number(row.revenue_target) || 0,
      leadsTarget: row.leads_target || 0,
      conversionTarget: Number(row.conversion_target) || 0,
    };
  }
}

export const marketingChannelService = new MarketingChannelService();
