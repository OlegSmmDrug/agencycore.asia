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

export async function validateTikTokToken(accessToken: string): Promise<boolean> {
  try {
    return true;
  } catch (error) {
    return false;
  }
}

export async function getTikTokAdvertisers(accessToken: string): Promise<TikTokAdvertiser[]> {
  return [
    {
      advertiserId: '1234567890123456',
      name: 'Рекламный аккаунт TikTok',
      currency: 'RUB',
      timezone: 'Europe/Moscow'
    }
  ];
}

export async function getTikTokAdsStats(
  accessToken: string,
  advertiserId: string,
  dateRange: string = '30d'
): Promise<TikTokAdsStats> {
  const campaigns: TikTokCampaign[] = [
    {
      id: 'campaign_1',
      name: 'Охватная кампания',
      status: 'ACTIVE',
      objective: 'REACH',
      metrics: {
        spend: 52000,
        clicks: 2100,
        impressions: 450000,
        conversions: 95,
        ctr: 0.47,
        cpc: 24.76,
        videoViews: 38000,
        videoWatchTime: 285000
      }
    },
    {
      id: 'campaign_2',
      name: 'Конверсионная кампания',
      status: 'ACTIVE',
      objective: 'CONVERSIONS',
      metrics: {
        spend: 38000,
        clicks: 1580,
        impressions: 320000,
        conversions: 68,
        ctr: 0.49,
        cpc: 24.05,
        videoViews: 25000,
        videoWatchTime: 198000
      }
    },
    {
      id: 'campaign_3',
      name: 'Трафиковая кампания',
      status: 'PAUSED',
      objective: 'TRAFFIC',
      metrics: {
        spend: 25000,
        clicks: 1200,
        impressions: 280000,
        conversions: 42,
        ctr: 0.43,
        cpc: 20.83,
        videoViews: 18000,
        videoWatchTime: 126000
      }
    }
  ];

  const totalSpend = campaigns.reduce((sum, c) => sum + c.metrics.spend, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.metrics.clicks, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.metrics.conversions, 0);
  const totalVideoViews = campaigns.reduce((sum, c) => sum + c.metrics.videoViews, 0);

  const dailyStats = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      spend: Math.floor(Math.random() * 6000) + 2500,
      clicks: Math.floor(Math.random() * 200) + 80,
      impressions: Math.floor(Math.random() * 40000) + 20000,
      conversions: Math.floor(Math.random() * 12) + 3,
      videoViews: Math.floor(Math.random() * 3000) + 1500
    };
  });

  return {
    advertiserId,
    advertiserName: 'Рекламный аккаунт TikTok',
    totalSpend,
    totalClicks,
    totalImpressions,
    totalConversions,
    totalVideoViews,
    avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    costPerConversion: totalConversions > 0 ? totalSpend / totalConversions : 0,
    campaigns,
    dailyStats
  };
}

export async function getTikTokCampaigns(
  accessToken: string,
  advertiserId: string
): Promise<TikTokCampaign[]> {
  const stats = await getTikTokAdsStats(accessToken, advertiserId);
  return stats.campaigns;
}
