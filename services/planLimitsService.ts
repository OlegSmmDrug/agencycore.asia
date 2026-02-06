import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface PlanLimits {
  maxUsers: number | null;
  maxProjects: number | null;
}

const FALLBACK_LIMITS: Record<string, PlanLimits> = {
  'Free': { maxUsers: 2, maxProjects: 10 },
  'Starter': { maxUsers: 10, maxProjects: 100 },
  'Professional': { maxUsers: 25, maxProjects: null },
  'Enterprise': { maxUsers: null, maxProjects: null },
};

let cachedLimits: Record<string, PlanLimits> | null = null;

async function loadLimitsFromDB(): Promise<Record<string, PlanLimits>> {
  if (cachedLimits) return cachedLimits;

  try {
    const { data } = await supabase
      .from('subscription_plans')
      .select('name, max_users, max_projects')
      .eq('is_active', true);

    if (data && data.length > 0) {
      const map: Record<string, PlanLimits> = {};
      data.forEach((p: any) => {
        const titleCase = p.name === 'FREE' ? 'Free'
          : p.name === 'STARTER' ? 'Starter'
          : p.name === 'PROFESSIONAL' ? 'Professional'
          : p.name === 'ENTERPRISE' ? 'Enterprise'
          : p.name;
        map[titleCase] = {
          maxUsers: p.max_users,
          maxProjects: p.max_projects,
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
    return limits[planName] || limits['Free'] || FALLBACK_LIMITS['Free'];
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

  async getUsageStats(planName: string): Promise<{
    users: { current: number; limit: number | null; percentage: number };
    projects: { current: number; limit: number | null; percentage: number };
  }> {
    const [usersCheck, projectsCheck] = await Promise.all([
      this.checkUsersLimit(planName),
      this.checkProjectsLimit(planName)
    ]);

    const usersPercentage = usersCheck.limit
      ? Math.round((usersCheck.current / usersCheck.limit) * 100)
      : 0;

    const projectsPercentage = projectsCheck.limit
      ? Math.round((projectsCheck.current / projectsCheck.limit) * 100)
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
      }
    };
  }
};
