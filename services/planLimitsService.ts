import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface PlanLimits {
  maxUsers: number | null;  // null = unlimited
  maxProjects: number | null; // null = unlimited
  hasAnalytics: boolean;
  hasAPIIntegration: boolean;
  hasPayroll: boolean;
  hasAllModules: boolean;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  'Free': {
    maxUsers: 2,
    maxProjects: 10,
    hasAnalytics: false,
    hasAPIIntegration: false,
    hasPayroll: false,
    hasAllModules: false
  },
  'Starter': {
    maxUsers: 10,
    maxProjects: 100,
    hasAnalytics: false,
    hasAPIIntegration: false,
    hasPayroll: true,
    hasAllModules: false
  },
  'Professional': {
    maxUsers: 25,
    maxProjects: null,
    hasAnalytics: true,
    hasAPIIntegration: true,
    hasPayroll: true,
    hasAllModules: true
  },
  'Enterprise': {
    maxUsers: null,
    maxProjects: null,
    hasAnalytics: true,
    hasAPIIntegration: true,
    hasPayroll: true,
    hasAllModules: true
  }
};

export const planLimitsService = {
  getPlanLimits(planName: string): PlanLimits {
    return PLAN_LIMITS[planName] || PLAN_LIMITS['Free'];
  },

  async checkUsersLimit(planName: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return { allowed: false, current: 0, limit: null };
    }

    const limits = this.getPlanLimits(planName);

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

    const limits = this.getPlanLimits(planName);

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
