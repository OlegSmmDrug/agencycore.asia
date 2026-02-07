import { AdCampaign, AdAccountStats, AdAccount, AdSet, Ad } from '../types';
import { integrationCredentialService } from './integrationCredentialService';

const FB_API_VERSION = 'v19.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

interface FacebookApiConfig {
  accessToken: string;
  adAccountId: string;
}

export const getAdAccounts = async (accessToken: string): Promise<AdAccount[]> => {
  if (!accessToken) {
    return [];
  }

  try {
    const response = await fetch(
      `${FB_GRAPH_URL}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch ad accounts');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.data || []).map((acc: any) => ({
      id: acc.id,
      name: acc.name || acc.id,
      status: acc.account_status === 1 ? 'ACTIVE' : 'INACTIVE'
    }));
  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    return [];
  }
};

export const getAdAccountStats = async (
  config: FacebookApiConfig,
  dateRange?: string,
  customDateRange?: { since: string; until: string }
): Promise<AdAccountStats | null> => {
  if (!config.accessToken || !config.adAccountId) {
    return null;
  }

  const accountId = config.adAccountId.startsWith('act_')
    ? config.adAccountId
    : `act_${config.adAccountId}`;

  let dateParams = '';
  if (customDateRange?.since && customDateRange?.until) {
    dateParams = `&time_range={'since':'${customDateRange.since}','until':'${customDateRange.until}'}`;
  } else {
    const datePreset = getDatePreset(dateRange || '30d');
    dateParams = `&date_preset=${datePreset}`;
  }

  try {
    const response = await fetch(
      `${FB_GRAPH_URL}/${accountId}/insights?` +
      `fields=spend,impressions,clicks,ctr,cpm,actions,cost_per_action_type,reach` +
      dateParams +
      `&access_token=${config.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch account stats');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const insights = data.data?.[0] || {};
    const leads = getActionValue(insights.actions, 'lead') ||
                  getActionValue(insights.actions, 'onsite_conversion.lead_grouped') || 0;
    const messagingConversations = getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d') || 0;
    const spend = parseFloat(insights.spend || '0');
    const cpl = leads > 0 ? spend / leads : 0;
    const costPerMessaging = messagingConversations > 0 ? spend / messagingConversations : 0;

    const dailyStats = await getDailyStats(config, dateRange, customDateRange);

    return {
      currency: 'USD',
      totalSpend: Math.round(spend),
      totalLeads: leads,
      averageCpl: Number(cpl.toFixed(2)),
      averageRoas: calculateRoas(insights),
      ctr: parseFloat(insights.ctr || '0'),
      cpm: parseFloat(insights.cpm || '0'),
      totalMessagingConversations: messagingConversations,
      costPerMessagingConversation: Number(costPerMessaging.toFixed(2)),
      dailyStats
    };
  } catch (error) {
    console.error('Error fetching ad account stats:', error);
    return null;
  }
};

export const getAdCampaigns = async (config: FacebookApiConfig, dateRange: string = '30d'): Promise<AdCampaign[]> => {
  if (!config.accessToken || !config.adAccountId) {
    return [];
  }

  const accountId = config.adAccountId.startsWith('act_')
    ? config.adAccountId
    : `act_${config.adAccountId}`;
  const datePreset = getDatePreset(dateRange);

  try {
    const response = await fetch(
      `${FB_GRAPH_URL}/${accountId}/campaigns?` +
      `fields=id,name,status,objective,insights.date_preset(${datePreset}){spend,impressions,clicks,reach,frequency,ctr,cpc,actions,cost_per_action_type}` +
      `&limit=50` +
      `&access_token=${config.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch campaigns');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.data || []).map((camp: any) => {
      const insights = camp.insights?.data?.[0] || {};
      const leads = getActionValue(insights.actions, 'lead') ||
                    getActionValue(insights.actions, 'onsite_conversion.lead_grouped') || 0;
      const messagingConversations = getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d') || 0;
      const spend = parseFloat(insights.spend || '0');

      return {
        id: camp.id,
        name: camp.name,
        status: camp.status,
        objective: camp.objective,
        spend: spend,
        impressions: parseInt(insights.impressions || '0'),
        clicks: parseInt(insights.clicks || '0'),
        reach: parseInt(insights.reach || '0'),
        frequency: parseFloat(insights.frequency || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        leads: leads,
        cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : 0,
        roas: calculateRoas(insights),
        messaging_conversations_started: messagingConversations,
        cost_per_messaging_conversation_started: messagingConversations > 0 ? Number((spend / messagingConversations).toFixed(2)) : 0
      };
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return [];
  }
};

export const getAdSets = async (config: FacebookApiConfig, campaignId?: string, dateRange: string = '30d'): Promise<AdSet[]> => {
  if (!config.accessToken || !config.adAccountId) {
    return [];
  }

  const accountId = config.adAccountId.startsWith('act_')
    ? config.adAccountId
    : `act_${config.adAccountId}`;
  const datePreset = getDatePreset(dateRange);

  try {
    const endpoint = campaignId
      ? `${FB_GRAPH_URL}/${campaignId}/adsets?`
      : `${FB_GRAPH_URL}/${accountId}/adsets?`;

    const response = await fetch(
      endpoint +
      `fields=id,name,campaign_id,status,insights.date_preset(${datePreset}){spend,impressions,clicks,reach,ctr,cpc,actions,cost_per_action_type}` +
      `&limit=100` +
      `&access_token=${config.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch ad sets');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.data || []).map((adset: any) => {
      const insights = adset.insights?.data?.[0] || {};
      const leads = getActionValue(insights.actions, 'lead') ||
                    getActionValue(insights.actions, 'onsite_conversion.lead_grouped') || 0;
      const messagingConversations = getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d') || 0;
      const spend = parseFloat(insights.spend || '0');

      return {
        id: adset.id,
        name: adset.name,
        campaignId: adset.campaign_id,
        status: adset.status,
        spend: spend,
        impressions: parseInt(insights.impressions || '0'),
        clicks: parseInt(insights.clicks || '0'),
        reach: parseInt(insights.reach || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        leads: leads,
        cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : 0,
        roas: calculateRoas(insights),
        messaging_conversations_started: messagingConversations,
        cost_per_messaging_conversation_started: messagingConversations > 0 ? Number((spend / messagingConversations).toFixed(2)) : 0
      };
    });
  } catch (error) {
    console.error('Error fetching ad sets:', error);
    return [];
  }
};

export const getAds = async (config: FacebookApiConfig, adsetId?: string, dateRange: string = '30d'): Promise<Ad[]> => {
  if (!config.accessToken || !config.adAccountId) {
    return [];
  }

  const accountId = config.adAccountId.startsWith('act_')
    ? config.adAccountId
    : `act_${config.adAccountId}`;
  const datePreset = getDatePreset(dateRange);

  try {
    const endpoint = adsetId
      ? `${FB_GRAPH_URL}/${adsetId}/ads?`
      : `${FB_GRAPH_URL}/${accountId}/ads?`;

    const response = await fetch(
      endpoint +
      `fields=id,name,adset_id,campaign_id,status,insights.date_preset(${datePreset}){spend,impressions,clicks,reach,ctr,cpc,actions,cost_per_action_type}` +
      `&limit=100` +
      `&access_token=${config.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch ads');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.data || []).map((ad: any) => {
      const insights = ad.insights?.data?.[0] || {};
      const leads = getActionValue(insights.actions, 'lead') ||
                    getActionValue(insights.actions, 'onsite_conversion.lead_grouped') || 0;
      const messagingConversations = getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d') || 0;
      const spend = parseFloat(insights.spend || '0');

      return {
        id: ad.id,
        name: ad.name,
        adsetId: ad.adset_id,
        campaignId: ad.campaign_id,
        status: ad.status,
        spend: spend,
        impressions: parseInt(insights.impressions || '0'),
        clicks: parseInt(insights.clicks || '0'),
        reach: parseInt(insights.reach || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        leads: leads,
        cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : 0,
        roas: calculateRoas(insights),
        messaging_conversations_started: messagingConversations,
        cost_per_messaging_conversation_started: messagingConversations > 0 ? Number((spend / messagingConversations).toFixed(2)) : 0
      };
    });
  } catch (error) {
    console.error('Error fetching ads:', error);
    return [];
  }
};

const getDailyStats = async (
  config: FacebookApiConfig,
  dateRange?: string,
  customDateRange?: { since: string; until: string }
) => {
  const accountId = config.adAccountId.startsWith('act_')
    ? config.adAccountId
    : `act_${config.adAccountId}`;

  let dateParams = '';
  if (customDateRange?.since && customDateRange?.until) {
    dateParams = `&time_range={'since':'${customDateRange.since}','until':'${customDateRange.until}'}`;
  } else {
    const datePreset = getDatePreset(dateRange || '30d');
    dateParams = `&date_preset=${datePreset}`;
  }

  try {
    const response = await fetch(
      `${FB_GRAPH_URL}/${accountId}/insights?` +
      `fields=spend,actions&time_increment=1` +
      dateParams +
      `&access_token=${config.accessToken}`
    );

    if (!response.ok) {
      return generateMockDailyStats(dateRange || '30d', customDateRange);
    }

    const data = await response.json();

    if (data.error || !data.data?.length) {
      return generateMockDailyStats(dateRange || '30d', customDateRange);
    }

    return data.data.map((day: any) => {
      const leads = getActionValue(day.actions, 'lead') ||
                    getActionValue(day.actions, 'onsite_conversion.lead_grouped') || 0;
      const messagingConversations = getActionValue(day.actions, 'onsite_conversion.messaging_conversation_started_7d') || 0;
      const spend = parseFloat(day.spend || '0');

      return {
        date: formatDate(day.date_start),
        spend: Math.round(spend),
        leads: leads,
        roas: leads > 0 ? Number((spend / leads * 0.3).toFixed(2)) : 0,
        messaging_conversations: messagingConversations
      };
    });
  } catch (error) {
    return generateMockDailyStats(dateRange || '30d', customDateRange);
  }
};

const getActionValue = (actions: any[], actionType: string): number => {
  if (!actions) return 0;
  const action = actions.find((a: any) => a.action_type === actionType);
  return action ? parseInt(action.value || '0') : 0;
};

const calculateRoas = (insights: any): number => {
  const purchaseValue = getActionValue(insights.actions, 'purchase') ||
                        getActionValue(insights.actions, 'omni_purchase');
  const spend = parseFloat(insights.spend || '0');
  if (spend === 0) return 0;
  return purchaseValue > 0 ? Number((purchaseValue / spend).toFixed(2)) : 0;
};

const getDatePreset = (dateRange: string): string => {
  switch (dateRange) {
    case '7d': return 'last_7d';
    case '14d': return 'last_14d';
    case '30d': return 'last_30d';
    case '90d': return 'last_90d';
    case 'ytd': return 'this_year';
    default: return 'last_30d';
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

const generateMockDailyStats = (_dateRange: string, _customDateRange?: { since: string; until: string }) => {
  return [];
};

export const validateAccessToken = async (accessToken: string): Promise<boolean> => {
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${FB_GRAPH_URL}/me?access_token=${accessToken}`
    );
    const data = await response.json();
    return !data.error;
  } catch {
    return false;
  }
};

const EMPTY_STATS: AdAccountStats = {
  currency: 'USD',
  totalSpend: 0,
  totalLeads: 0,
  averageCpl: 0,
  averageRoas: 0,
  ctr: 0,
  cpm: 0,
  totalMessagingConversations: 0,
  costPerMessagingConversation: 0,
  dailyStats: [],
  totalImpressions: 0,
  totalClicks: 0,
  averageCtr: 0,
};

export const facebookAdsService = {
  async getAdMetrics(integrationId: string, dateRange?: string): Promise<AdAccountStats> {
    let accessToken = '';
    let adAccountId = '';

    try {
      accessToken = await integrationCredentialService.getCredential(integrationId, 'access_token') || '';
      adAccountId = await integrationCredentialService.getCredential(integrationId, 'ad_account_id') || '';
    } catch {
      return { ...EMPTY_STATS };
    }

    if (!accessToken || !adAccountId) {
      return { ...EMPTY_STATS };
    }

    const config: FacebookApiConfig = { accessToken, adAccountId };
    const stats = await getAdAccountStats(config, dateRange || '30d');

    if (!stats) {
      return { ...EMPTY_STATS };
    }

    return {
      ...stats,
      totalImpressions: stats.dailyStats?.reduce((sum, d: any) => sum + (d.impressions || 0), 0) || 0,
      totalClicks: stats.dailyStats?.reduce((sum, d: any) => sum + (d.clicks || 0), 0) || 0,
      averageCtr: stats.ctr,
    };
  },
};
