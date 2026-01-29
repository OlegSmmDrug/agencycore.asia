import { Project, ProjectKpi } from '../types';
import { getLiveduneAnalytics, getLiveduneDetailedAnalytics } from './liveduneService';
import { getAdAccountStats } from './facebookAdsService';

interface KpiSyncResult {
  kpis: ProjectKpi[];
  lastSyncedAt: string;
}

export const syncAllProjectKpis = async (
  project: Project,
  dateRange: string = '30d'
): Promise<KpiSyncResult | null> => {
  if (!project.kpis || project.kpis.length === 0) {
    return null;
  }

  const kpisToSync = project.kpis.filter(kpi => kpi.autoUpdate && kpi.source && kpi.metricKey);

  if (kpisToSync.length === 0) {
    return null;
  }

  let liveduneData: any = null;
  let facebookData: any = null;

  if (project.liveduneAccessToken && project.liveduneAccountId) {
    try {
      liveduneData = await getLiveduneDetailedAnalytics(
        {
          accessToken: project.liveduneAccessToken,
          accountId: project.liveduneAccountId
        },
        dateRange
      );
    } catch (error) {
      console.error('Error fetching LiveDune data:', error);
    }
  }

  if (project.facebookAccessToken && project.adAccountId) {
    try {
      facebookData = await getAdAccountStats(
        {
          accessToken: project.facebookAccessToken,
          adAccountId: project.adAccountId
        },
        dateRange
      );
    } catch (error) {
      console.error('Error fetching Facebook data:', error);
    }
  }

  const now = new Date().toISOString();
  const updatedKpis = project.kpis.map(kpi => {
    if (!kpi.autoUpdate || !kpi.source || !kpi.metricKey) {
      return kpi;
    }

    const value = getKpiValue(kpi.source, kpi.metricKey, liveduneData, facebookData);

    if (value !== null) {
      return {
        ...kpi,
        fact: value,
        lastSyncedAt: now
      };
    }

    return kpi;
  });

  return {
    kpis: updatedKpis,
    lastSyncedAt: now
  };
};

export const syncSingleKpi = async (
  project: Project,
  kpiId: string,
  dateRange: string = '30d'
): Promise<ProjectKpi | null> => {
  const kpi = project.kpis?.find(k => k.id === kpiId);

  if (!kpi || !kpi.autoUpdate || !kpi.source || !kpi.metricKey) {
    return null;
  }

  let data: any = null;

  if (kpi.source === 'livedune' && project.liveduneAccessToken && project.liveduneAccountId) {
    try {
      data = await getLiveduneDetailedAnalytics(
        {
          accessToken: project.liveduneAccessToken,
          accountId: project.liveduneAccountId
        },
        dateRange
      );
    } catch (error) {
      console.error('Error fetching LiveDune data:', error);
      return null;
    }
  } else if (kpi.source === 'facebook' && project.facebookAccessToken && project.adAccountId) {
    try {
      data = await getAdAccountStats(
        {
          accessToken: project.facebookAccessToken,
          adAccountId: project.adAccountId
        },
        dateRange
      );
    } catch (error) {
      console.error('Error fetching Facebook data:', error);
      return null;
    }
  }

  if (!data) {
    return null;
  }

  const value = getKpiValue(kpi.source, kpi.metricKey,
    kpi.source === 'livedune' ? data : null,
    kpi.source === 'facebook' ? data : null
  );

  if (value !== null) {
    return {
      ...kpi,
      fact: value,
      lastSyncedAt: new Date().toISOString()
    };
  }

  return null;
};

const getKpiValue = (
  source: string,
  metricKey: string,
  liveduneData: any,
  facebookData: any
): number | null => {
  if (source === 'livedune' && liveduneData) {
    return getLiveduneKpiValue(metricKey, liveduneData);
  } else if (source === 'facebook' && facebookData) {
    return getFacebookKpiValue(metricKey, facebookData);
  }

  return null;
};

const getLiveduneKpiValue = (metricKey: string, data: any): number | null => {
  const mapping: Record<string, number> = {
    'reach': data.monthly_reach || data.reach || 0,
    'er': data.er || 0,
    'followers': data.followers || 0,
    'followers_diff': data.followers_diff || 0,
    'views': data.views || 0,
    'likes_avg': data.likes_avg || 0,
    'comments_avg': data.comments_avg || 0,
    'saves': data.saves || 0,
    'posts': data.posts || 0,
    'stories_views': data.stories_views || 0,
    'reels_views': data.reels_views || 0
  };

  return mapping[metricKey] ?? null;
};

const getFacebookKpiValue = (metricKey: string, data: any): number | null => {
  const mapping: Record<string, number> = {
    'ctr': data.ctr || 0,
    'cpc': data.cpm || 0,
    'cpm': data.cpm || 0,
    'cpl': data.averageCpl || 0,
    'roas': data.averageRoas || 0,
    'leads': data.totalLeads || 0,
    'reach': data.totalSpend || 0,
    'spend': data.totalSpend || 0,
    'conversions': data.totalLeads || 0,
    'messaging_conversations': data.totalMessagingConversations || 0
  };

  return mapping[metricKey] ?? null;
};

export const shouldSyncKpis = (project: Project): boolean => {
  const autoUpdateKpis = project.kpis?.filter(kpi => kpi.autoUpdate) || [];

  if (autoUpdateKpis.length === 0) {
    return false;
  }

  let lastSyncDate: string | undefined = project.kpiLastSyncedAt;

  if (!lastSyncDate && project.kpis) {
    const kpisWithSync = project.kpis.filter(kpi => kpi.lastSyncedAt);
    if (kpisWithSync.length > 0) {
      lastSyncDate = kpisWithSync
        .map(kpi => kpi.lastSyncedAt!)
        .sort()
        .reverse()[0];
    }
  }

  if (!lastSyncDate) {
    return true;
  }

  const lastSync = new Date(lastSyncDate);
  const now = new Date();
  const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

  return hoursSinceSync >= 1;
};
