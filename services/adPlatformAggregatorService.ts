import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { integrationCredentialService } from './integrationCredentialService';
import { getAdAccountStats } from './facebookAdsService';

export interface AdPlatformMetrics {
  platform: 'facebook' | 'google' | 'tiktok';
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  cpl: number;
  ctr: number;
  isConnected: boolean;
  lastSyncAt?: string;
  error?: string;
}

export interface AggregatedAdData {
  platforms: AdPlatformMetrics[];
  totalSpend: number;
  totalLeads: number;
  totalClicks: number;
  totalImpressions: number;
  avgCpl: number;
  avgCtr: number;
}

const EMPTY_METRICS = (platform: AdPlatformMetrics['platform']): AdPlatformMetrics => ({
  platform,
  spend: 0,
  leads: 0,
  clicks: 0,
  impressions: 0,
  cpl: 0,
  ctr: 0,
  isConnected: false,
});

class AdPlatformAggregatorService {
  async getAggregatedMetrics(dateRange: string = '30d'): Promise<AggregatedAdData> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return this.emptyResult();

    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, integration_type, status, config, is_active')
      .eq('organization_id', orgId)
      .in('integration_type', ['facebook_ads', 'google_ads', 'tiktok_ads'])
      .eq('is_active', true);

    const platforms: AdPlatformMetrics[] = [];

    for (const integration of (integrations || [])) {
      try {
        const metrics = await this.fetchPlatformMetrics(integration, dateRange);
        platforms.push(metrics);
      } catch (e) {
        const platformType = this.mapIntegrationType(integration.integration_type);
        platforms.push({
          ...EMPTY_METRICS(platformType),
          isConnected: true,
          error: 'Failed to fetch data',
        });
      }
    }

    if (!platforms.find(p => p.platform === 'facebook')) {
      const fbFromProjects = await this.getFacebookFromProjects(orgId, dateRange);
      if (fbFromProjects) platforms.push(fbFromProjects);
      else platforms.push(EMPTY_METRICS('facebook'));
    }
    if (!platforms.find(p => p.platform === 'google')) {
      platforms.push(EMPTY_METRICS('google'));
    }
    if (!platforms.find(p => p.platform === 'tiktok')) {
      platforms.push(EMPTY_METRICS('tiktok'));
    }

    const totalSpend = platforms.reduce((s, p) => s + p.spend, 0);
    const totalLeads = platforms.reduce((s, p) => s + p.leads, 0);
    const totalClicks = platforms.reduce((s, p) => s + p.clicks, 0);
    const totalImpressions = platforms.reduce((s, p) => s + p.impressions, 0);

    return {
      platforms,
      totalSpend,
      totalLeads,
      totalClicks,
      totalImpressions,
      avgCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    };
  }

  private async fetchPlatformMetrics(
    integration: any,
    dateRange: string
  ): Promise<AdPlatformMetrics> {
    const platformType = this.mapIntegrationType(integration.integration_type);

    if (integration.integration_type === 'facebook_ads') {
      return this.fetchFacebookMetrics(integration, dateRange);
    }

    if (integration.integration_type === 'google_ads') {
      return this.fetchGoogleMetrics(integration, dateRange);
    }

    if (integration.integration_type === 'tiktok_ads') {
      return this.fetchTikTokMetrics(integration, dateRange);
    }

    return { ...EMPTY_METRICS(platformType), isConnected: true };
  }

  private async fetchFacebookMetrics(
    integration: any,
    dateRange: string
  ): Promise<AdPlatformMetrics> {
    let accessToken = '';
    let adAccountId = '';

    try {
      accessToken = await integrationCredentialService.getCredential(integration.id, 'access_token') || '';
      adAccountId = await integrationCredentialService.getCredential(integration.id, 'ad_account_id') || '';
    } catch {
      accessToken = integration.config?.access_token || '';
      adAccountId = integration.config?.ad_account_id || '';
    }

    if (!accessToken || !adAccountId) {
      return { ...EMPTY_METRICS('facebook'), isConnected: true, error: 'Missing credentials' };
    }

    const stats = await getAdAccountStats({ accessToken, adAccountId }, dateRange);
    if (!stats) {
      return { ...EMPTY_METRICS('facebook'), isConnected: true, error: 'API error' };
    }

    return {
      platform: 'facebook',
      spend: stats.totalSpend,
      leads: stats.totalLeads,
      clicks: stats.dailyStats?.reduce((s: number, d: any) => s + (d.clicks || 0), 0) || 0,
      impressions: stats.dailyStats?.reduce((s: number, d: any) => s + (d.impressions || 0), 0) || 0,
      cpl: stats.averageCpl,
      ctr: stats.ctr,
      isConnected: true,
      lastSyncAt: new Date().toISOString(),
    };
  }

  private async fetchGoogleMetrics(
    integration: any,
    _dateRange: string
  ): Promise<AdPlatformMetrics> {
    let accessToken = '';
    try {
      accessToken = await integrationCredentialService.getCredential(integration.id, 'access_token') || '';
    } catch {
      accessToken = integration.config?.access_token || '';
    }

    if (!accessToken) {
      return { ...EMPTY_METRICS('google'), isConnected: true, error: 'Missing credentials' };
    }

    return {
      ...EMPTY_METRICS('google'),
      isConnected: true,
      error: 'API integration pending',
    };
  }

  private async fetchTikTokMetrics(
    integration: any,
    _dateRange: string
  ): Promise<AdPlatformMetrics> {
    let accessToken = '';
    try {
      accessToken = await integrationCredentialService.getCredential(integration.id, 'access_token') || '';
    } catch {
      accessToken = integration.config?.access_token || '';
    }

    if (!accessToken) {
      return { ...EMPTY_METRICS('tiktok'), isConnected: true, error: 'Missing credentials' };
    }

    return {
      ...EMPTY_METRICS('tiktok'),
      isConnected: true,
      error: 'API integration pending',
    };
  }

  private async getFacebookFromProjects(
    orgId: string,
    dateRange: string
  ): Promise<AdPlatformMetrics | null> {
    const { data: projects } = await supabase
      .from('projects')
      .select('facebook_access_token, ad_account_id')
      .eq('organization_id', orgId)
      .not('facebook_access_token', 'is', null)
      .not('ad_account_id', 'is', null)
      .limit(1);

    const project = projects?.[0];
    if (!project?.facebook_access_token || !project?.ad_account_id) return null;

    const stats = await getAdAccountStats(
      { accessToken: project.facebook_access_token, adAccountId: project.ad_account_id },
      dateRange
    );

    if (!stats) return null;

    return {
      platform: 'facebook',
      spend: stats.totalSpend,
      leads: stats.totalLeads,
      clicks: stats.dailyStats?.reduce((s: number, d: any) => s + (d.clicks || 0), 0) || 0,
      impressions: stats.dailyStats?.reduce((s: number, d: any) => s + (d.impressions || 0), 0) || 0,
      cpl: stats.averageCpl,
      ctr: stats.ctr,
      isConnected: true,
      lastSyncAt: new Date().toISOString(),
    };
  }

  private mapIntegrationType(type: string): AdPlatformMetrics['platform'] {
    if (type === 'facebook_ads') return 'facebook';
    if (type === 'google_ads') return 'google';
    return 'tiktok';
  }

  private emptyResult(): AggregatedAdData {
    return {
      platforms: [EMPTY_METRICS('facebook'), EMPTY_METRICS('google'), EMPTY_METRICS('tiktok')],
      totalSpend: 0,
      totalLeads: 0,
      totalClicks: 0,
      totalImpressions: 0,
      avgCpl: 0,
      avgCtr: 0,
    };
  }
}

export const adPlatformAggregatorService = new AdPlatformAggregatorService();
