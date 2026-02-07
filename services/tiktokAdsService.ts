export interface TikTokAdvertiser {
  advertiserId: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface TikTokCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  metrics: {
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    ctr: number;
    cpc: number;
    videoViews: number;
    videoWatchTime: number;
  };
}

export interface TikTokAdsStats {
  advertiserId: string;
  advertiserName: string;
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  totalVideoViews: number;
  avgCpc: number;
  avgCtr: number;
  costPerConversion: number;
  campaigns: TikTokCampaign[];
  dailyStats: Array<{
    date: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    videoViews: number;
  }>;
}

const TIKTOK_API_URL = 'https://business-api.tiktok.com/open_api/v1.3';

export async function validateTikTokToken(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const response = await fetch(`${TIKTOK_API_URL}/oauth2/advertiser/get/`, {
      headers: { 'Access-Token': accessToken },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getTikTokAdvertisers(accessToken: string): Promise<TikTokAdvertiser[]> {
  if (!accessToken) return [];

  try {
    const response = await fetch(`${TIKTOK_API_URL}/oauth2/advertiser/get/`, {
      headers: { 'Access-Token': accessToken },
    });

    if (!response.ok) return [];
    const data = await response.json();

    return (data.data?.list || []).map((adv: any) => ({
      advertiserId: adv.advertiser_id,
      name: adv.advertiser_name || adv.advertiser_id,
      currency: adv.currency || 'USD',
      timezone: adv.timezone || 'UTC',
    }));
  } catch {
    return [];
  }
}

export async function getTikTokAdsStats(
  accessToken: string,
  advertiserId: string,
  dateRange?: string,
  customDateRange?: { since: string; until: string }
): Promise<TikTokAdsStats> {
  if (!accessToken || !advertiserId) {
    return emptyTikTokStats(advertiserId);
  }

  let startDate: string;
  let endDate: string;

  if (customDateRange?.since && customDateRange?.until) {
    startDate = customDateRange.since;
    endDate = customDateRange.until;
  } else {
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : dateRange === '90d' ? 90 : 30;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    startDate = start.toISOString().split('T')[0];
    endDate = end.toISOString().split('T')[0];
  }

  try {
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      report_type: 'BASIC',
      data_level: 'AUCTION_CAMPAIGN',
      dimensions: '["campaign_id"]',
      metrics: '["spend","clicks","impressions","conversion","ctr","cpc","video_play_actions","video_watched_6s"]',
      start_date: startDate,
      end_date: endDate,
    });

    const response = await fetch(`${TIKTOK_API_URL}/report/integrated/get/?${params}`, {
      headers: { 'Access-Token': accessToken },
    });

    if (!response.ok) {
      return emptyTikTokStats(advertiserId);
    }

    const data = await response.json();
    const rows = data.data?.list || [];

    const campaigns: TikTokCampaign[] = rows.map((row: any) => ({
      id: row.dimensions?.campaign_id || '',
      name: row.dimensions?.campaign_name || row.dimensions?.campaign_id || '',
      status: 'ACTIVE',
      objective: '',
      metrics: {
        spend: Number(row.metrics?.spend || 0),
        clicks: Number(row.metrics?.clicks || 0),
        impressions: Number(row.metrics?.impressions || 0),
        conversions: Number(row.metrics?.conversion || 0),
        ctr: Number(row.metrics?.ctr || 0) * 100,
        cpc: Number(row.metrics?.cpc || 0),
        videoViews: Number(row.metrics?.video_play_actions || 0),
        videoWatchTime: Number(row.metrics?.video_watched_6s || 0),
      },
    }));

    const totalSpend = campaigns.reduce((s, c) => s + c.metrics.spend, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.metrics.clicks, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.metrics.impressions, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.metrics.conversions, 0);
    const totalVideoViews = campaigns.reduce((s, c) => s + c.metrics.videoViews, 0);

    return {
      advertiserId,
      advertiserName: advertiserId,
      totalSpend,
      totalClicks,
      totalImpressions,
      totalConversions,
      totalVideoViews,
      avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      costPerConversion: totalConversions > 0 ? totalSpend / totalConversions : 0,
      campaigns,
      dailyStats: [],
    };
  } catch {
    return emptyTikTokStats(advertiserId);
  }
}

export async function getTikTokCampaigns(
  accessToken: string,
  advertiserId: string
): Promise<TikTokCampaign[]> {
  const stats = await getTikTokAdsStats(accessToken, advertiserId);
  return stats.campaigns;
}

function emptyTikTokStats(advertiserId: string): TikTokAdsStats {
  return {
    advertiserId,
    advertiserName: '',
    totalSpend: 0,
    totalClicks: 0,
    totalImpressions: 0,
    totalConversions: 0,
    totalVideoViews: 0,
    avgCpc: 0,
    avgCtr: 0,
    costPerConversion: 0,
    campaigns: [],
    dailyStats: [],
  };
}
