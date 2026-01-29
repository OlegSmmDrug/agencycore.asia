export interface GoogleAdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  metrics: {
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    ctr: number;
    cpc: number;
  };
}

export interface GoogleAdsAccountStats {
  customerId: string;
  accountName: string;
  totalCost: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  avgCpc: number;
  avgCtr: number;
  costPerConversion: number;
  campaigns: GoogleAdsCampaign[];
  dailyStats: Array<{
    date: string;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
  }>;
}

export async function validateGoogleAdsToken(accessToken: string): Promise<boolean> {
  try {
    return true;
  } catch (error) {
    return false;
  }
}

export async function getGoogleAdsAccounts(accessToken: string): Promise<GoogleAdsAccount[]> {
  return [
    {
      customerId: '123-456-7890',
      descriptiveName: 'Рекламный аккаунт Google Ads',
      currencyCode: 'RUB',
      timeZone: 'Europe/Moscow'
    }
  ];
}

export async function getGoogleAdsAccountStats(
  accessToken: string,
  customerId: string,
  dateRange: string = '30d'
): Promise<GoogleAdsAccountStats> {
  const campaigns: GoogleAdsCampaign[] = [
    {
      id: 'campaign_1',
      name: 'Поисковая реклама',
      status: 'ENABLED',
      metrics: {
        cost: 45000,
        clicks: 1250,
        impressions: 35000,
        conversions: 85,
        ctr: 3.57,
        cpc: 36
      }
    },
    {
      id: 'campaign_2',
      name: 'Медийная реклама',
      status: 'ENABLED',
      metrics: {
        cost: 32000,
        clicks: 890,
        impressions: 120000,
        conversions: 42,
        ctr: 0.74,
        cpc: 35.96
      }
    },
    {
      id: 'campaign_3',
      name: 'Ремаркетинг',
      status: 'PAUSED',
      metrics: {
        cost: 18000,
        clicks: 620,
        impressions: 85000,
        conversions: 28,
        ctr: 0.73,
        cpc: 29.03
      }
    }
  ];

  const totalCost = campaigns.reduce((sum, c) => sum + c.metrics.cost, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.metrics.clicks, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.metrics.conversions, 0);

  const dailyStats = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      cost: Math.floor(Math.random() * 5000) + 2000,
      clicks: Math.floor(Math.random() * 150) + 50,
      impressions: Math.floor(Math.random() * 5000) + 2000,
      conversions: Math.floor(Math.random() * 10) + 2
    };
  });

  return {
    customerId,
    accountName: 'Рекламный аккаунт Google Ads',
    totalCost,
    totalClicks,
    totalImpressions,
    totalConversions,
    avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
    campaigns,
    dailyStats
  };
}

export async function getGoogleAdsCampaigns(
  accessToken: string,
  customerId: string
): Promise<GoogleAdsCampaign[]> {
  const stats = await getGoogleAdsAccountStats(accessToken, customerId);
  return stats.campaigns;
}
