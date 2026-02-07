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

const GOOGLE_ADS_API_URL = 'https://googleads.googleapis.com/v16';

export async function validateGoogleAdsToken(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `access_token=${accessToken}`,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getGoogleAdsAccounts(accessToken: string): Promise<GoogleAdsAccount[]> {
  if (!accessToken) return [];

  try {
    const response = await fetch(
      `${GOOGLE_ADS_API_URL}/customers:listAccessibleCustomers`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) return [];
    const data = await response.json();

    return (data.resourceNames || []).map((name: string) => ({
      customerId: name.replace('customers/', ''),
      descriptiveName: name.replace('customers/', ''),
      currencyCode: 'KZT',
      timeZone: 'Asia/Almaty',
    }));
  } catch {
    return [];
  }
}

export async function getGoogleAdsAccountStats(
  accessToken: string,
  customerId: string,
  dateRange?: string,
  customDateRange?: { since: string; until: string }
): Promise<GoogleAdsAccountStats> {
  if (!accessToken || !customerId) {
    return emptyGoogleStats(customerId);
  }

  const cleanCustomerId = customerId.replace(/-/g, '');
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
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
    `;

    const response = await fetch(
      `${GOOGLE_ADS_API_URL}/customers/${cleanCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'developer-token': '',
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      return emptyGoogleStats(customerId);
    }

    const data = await response.json();
    const results = data[0]?.results || [];

    const campaigns: GoogleAdsCampaign[] = results.map((r: any) => ({
      id: r.campaign?.id || '',
      name: r.campaign?.name || '',
      status: r.campaign?.status || 'UNKNOWN',
      metrics: {
        cost: (r.metrics?.costMicros || 0) / 1_000_000,
        clicks: r.metrics?.clicks || 0,
        impressions: r.metrics?.impressions || 0,
        conversions: r.metrics?.conversions || 0,
        ctr: (r.metrics?.ctr || 0) * 100,
        cpc: (r.metrics?.averageCpc || 0) / 1_000_000,
      },
    }));

    const totalCost = campaigns.reduce((s, c) => s + c.metrics.cost, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.metrics.clicks, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.metrics.impressions, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.metrics.conversions, 0);

    return {
      customerId,
      accountName: customerId,
      totalCost,
      totalClicks,
      totalImpressions,
      totalConversions,
      avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
      campaigns,
      dailyStats: [],
    };
  } catch {
    return emptyGoogleStats(customerId);
  }
}

export async function getGoogleAdsCampaigns(
  accessToken: string,
  customerId: string
): Promise<GoogleAdsCampaign[]> {
  const stats = await getGoogleAdsAccountStats(accessToken, customerId);
  return stats.campaigns;
}

function emptyGoogleStats(customerId: string): GoogleAdsAccountStats {
  return {
    customerId,
    accountName: '',
    totalCost: 0,
    totalClicks: 0,
    totalImpressions: 0,
    totalConversions: 0,
    avgCpc: 0,
    avgCtr: 0,
    costPerConversion: 0,
    campaigns: [],
    dailyStats: [],
  };
}
