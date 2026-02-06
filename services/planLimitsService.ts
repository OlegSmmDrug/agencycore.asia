import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface PlanLimits {
  maxUsers: number | null;
  maxProjects: number | null;
  maxStorageMb: number | null;
}

const FALLBACK_LIMITS: Record<string, PlanLimits> = {
  'FREE': { maxUsers: 2, maxProjects: 10, maxStorageMb: 500 },
  'STARTER': { maxUsers: 10, maxProjects: 100, maxStorageMb: 5120 },
  'PROFESSIONAL': { maxUsers: 25, maxProjects: null, maxStorageMb: 10240 },
  'ENTERPRISE': { maxUsers: null, maxProjects: null, maxStorageMb: null },
};

let cachedLimits: Record<string, PlanLimits> | null = null;

async function loadLimitsFromDB(): Promise<Record<string, PlanLimits>> {
  if (cachedLimits) return cachedLimits;

  try {
    const { data } = await supabase
      .from('subscription_plans')
      .select('name, max_users, max_projects, max_storage_mb')
      .eq('is_active', true);

    if (data && data.length > 0) {
      const map: Record<string, PlanLimits> = {};
      data.forEach((p: any) => {
        map[p.name.toUpperCase()] = {
          maxUsers: p.max_users,
          maxProjects: p.max_projects,
          maxStorageMb: p.max_storage_mb,
        };
      });
      cachedLimits = map;
      return map;
    }
  } catch (err) {
    console.error('Error loading plan limits from DB:', err);
  }

  return FALLBACK_LIMITS;
}

export const planLimitsService = {
  invalidateCache() {
    cachedLimits = null;
  },

  async getPlanLimits(planName: string): Promise<PlanLimits> {
    const limits = await loadLimitsFromDB();
    const key = (planName || 'FREE').toUpperCase();
    return limits[key] || limits['FREE'] || FALLBACK_LIMITS['FREE'];
  },

  async checkUsersLimit(planName: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return { allowed: false, current: 0, limit: null };
    }

    const limits = await this.getPlanLimits(planName);

    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    const current = count || 0;
    const limit = limits.maxUsers;

    if (limit === null) {
      return { allowed: true, current, limit };
    }

    return { allowed: current < limit, current, limit };
  },

  async checkProjectsLimit(planName: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return { allowed: false, current: 0, limit: null };
    }

    const limits = await this.getPlanLimits(planName);

    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('status', 'archived');

    const current = count || 0;
    const limit = limits.maxProjects;

    if (limit === null) {
      return { allowed: true, current, limit };
    }

    return { allowed: current < limit, current, limit };
  },

  async checkStorageLimit(planName: string): Promise<{ allowed: boolean; currentMb: number; limitMb: number | null }> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return { allowed: false, currentMb: 0, limitMb: null };
    }

    const limits = await this.getPlanLimits(planName);

    const { data } = await supabase.rpc('get_organization_storage_usage_mb', { org_id: organizationId });
    const currentMb = Number(data) || 0;
    const limitMb = limits.maxStorageMb;

    if (limitMb === null) {
      return { allowed: true, currentMb, limitMb };
    }

    return { allowed: currentMb < limitMb, currentMb, limitMb };
  },

  async getUsageStats(planName: string): Promise<{
    users: { current: number; limit: number | null; percentage: number };
    projects: { current: number; limit: number | null; percentage: number };
    storage: { currentMb: number; limitMb: number | null; percentage: number };
  }> {
    const [usersCheck, projectsCheck, storageCheck] = await Promise.all([
      this.checkUsersLimit(planName),
      this.checkProjectsLimit(planName),
      this.checkStorageLimit(planName),
    ]);

    const usersPercentage = usersCheck.limit
      ? Math.round((usersCheck.current / usersCheck.limit) * 100)
      : 0;

    const projectsPercentage = projectsCheck.limit
      ? Math.round((projectsCheck.current / projectsCheck.limit) * 100)
      : 0;

    const storagePercentage = storageCheck.limitMb
      ? Math.round((storageCheck.currentMb / storageCheck.limitMb) * 100)
      : 0;

    return {
      users: {
        current: usersCheck.current,
        limit: usersCheck.limit,
        percentage: usersPercentage
      },
      projects: {
        current: projectsCheck.current,
        limit: projectsCheck.limit,
        percentage: projectsPercentage
      },
      storage: {
        currentMb: storageCheck.currentMb,
        limitMb: storageCheck.limitMb,
        percentage: storagePercentage
      }
    };
  }
};
