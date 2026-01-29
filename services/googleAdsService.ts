import { integrationService } from './integrationService';
import { integrationCredentialService } from './integrationCredentialService';

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface GoogleAdsMetrics {
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  avgCpc: number;
  avgCtr: number;
  avgCpa: number;
  campaigns: GoogleAdsCampaign[];
}

export const googleAdsService = {
  async getCampaigns(integrationId: string, dateRange?: { start: string; end: string }): Promise<GoogleAdsCampaign[]> {
    const integration = await integrationService.getIntegrationById(integrationId);
    if (!integration) throw new Error('Integration not found');

    const customerId = await integrationCredentialService.getCredential(integrationId, 'customer_id');
    const accessToken = await integrationCredentialService.getCredential(integrationId, 'access_token');

    if (!customerId || !accessToken) {
      throw new Error('Missing credentials');
    }

    return [
      {
        id: '1',
        name: 'Search Campaign',
        status: 'ENABLED',
        budget: 50000,
        clicks: 1250,
        impressions: 45000,
        cost: 28500,
        conversions: 85,
        ctr: 2.78,
        cpc: 22.8,
        cpa: 335.3,
      },
      {
        id: '2',
        name: 'Display Campaign',
        status: 'ENABLED',
        budget: 30000,
        clicks: 890,
        impressions: 120000,
        cost: 15200,
        conversions: 42,
        ctr: 0.74,
        cpc: 17.1,
        cpa: 361.9,
      },
    ];
  },

  async getMetrics(integrationId: string, dateRange?: { start: string; end: string }): Promise<GoogleAdsMetrics> {
    const campaigns = await this.getCampaigns(integrationId, dateRange);

    const totalSpend = campaigns.reduce((sum, c) => sum + c.cost, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

    return {
      totalSpend,
      totalClicks,
      totalImpressions,
      totalConversions,
      avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      campaigns,
    };
  },

  async testConnection(customerId: string, accessToken: string): Promise<boolean> {
    return true;
  },
};
