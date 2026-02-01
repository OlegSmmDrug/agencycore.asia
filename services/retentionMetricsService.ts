import { supabase } from '../lib/supabase';

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

interface RetentionMetrics {
  retentionRate: number;
  totalProjects: number;
  renewedProjects: number;
  renewalRevenue: number;
  notRenewedProjects: number;
}

interface PeriodFilter {
  startDate: Date;
  endDate: Date;
}

export const retentionMetricsService = {
  getPeriodFilter(period: 'month' | 'quarter', date: Date = new Date()): PeriodFilter {
    const startDate = new Date(date);
    const endDate = new Date(date);

    if (period === 'month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const quarter = Math.floor(startDate.getMonth() / 3);
      startDate.setMonth(quarter * 3);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth((quarter + 1) * 3);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  },

  async calculateRetentionRate(
    userId: string,
    period: 'month' | 'quarter' = 'quarter',
    date?: Date
  ): Promise<RetentionMetrics> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const { startDate, endDate } = this.getPeriodFilter(period, date);
    console.log(`[Retention Debug] Calculating for user ${userId}, period: ${period}, date range: ${startDate.toISOString()} - ${endDate.toISOString()}`);

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, end_date, status')
      .eq('organization_id', organizationId)
      .contains('team_ids', [userId])
      .lte('end_date', endDate.toISOString().split('T')[0])
      .gte('end_date', startDate.toISOString().split('T')[0]);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      return {
        retentionRate: 0,
        totalProjects: 0,
        renewedProjects: 0,
        renewalRevenue: 0,
        notRenewedProjects: 0
      };
    }

    const projectIds = projects.map(p => p.id);

    const { data: renewals, error: renewalsError } = await supabase
      .from('project_renewals')
      .select('project_id, renewed_amount')
      .in('project_id', projectIds)
      .gte('renewal_date', startDate.toISOString())
      .lte('renewal_date', endDate.toISOString());

    if (renewalsError) {
      console.error('Error fetching renewals:', renewalsError);
      throw renewalsError;
    }

    const renewedProjectIds = new Set((renewals || []).map(r => r.project_id));
    const renewedProjects = renewedProjectIds.size;
    const totalProjects = projects.length;
    const retentionRate = totalProjects > 0 ? (renewedProjects / totalProjects) * 100 : 0;
    const renewalRevenue = (renewals || []).reduce((sum, r) => sum + Number(r.renewed_amount), 0);

    console.log(`[Retention Debug] Found ${totalProjects} projects, ${renewedProjects} renewed. Rate: ${retentionRate}%, Revenue: ${renewalRevenue}`);
    console.log(`[Retention Debug] Renewal records:`, renewals);

    return {
      retentionRate: Math.round(retentionRate * 100) / 100,
      totalProjects,
      renewedProjects,
      renewalRevenue,
      notRenewedProjects: totalProjects - renewedProjects
    };
  },

  async getRenewalRevenueForPeriod(
    userId: string,
    period: 'month' | 'quarter',
    date?: Date
  ): Promise<number> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const { startDate, endDate } = this.getPeriodFilter(period, date);

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId)
      .contains('team_ids', [userId]);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      return 0;
    }

    const projectIds = projects.map(p => p.id);

    const { data: renewals, error: renewalsError } = await supabase
      .from('project_renewals')
      .select('renewed_amount')
      .in('project_id', projectIds)
      .gte('renewal_date', startDate.toISOString())
      .lte('renewal_date', endDate.toISOString());

    if (renewalsError) {
      console.error('Error fetching renewals:', renewalsError);
      throw renewalsError;
    }

    return (renewals || []).reduce((sum, r) => sum + Number(r.renewed_amount), 0);
  },

  async getQuarterlyRetentionHistory(userId: string, year: number): Promise<{ quarter: number; retentionRate: number; revenue: number }[]> {
    const quarters = [];

    for (let q = 0; q < 4; q++) {
      const date = new Date(year, q * 3, 15);
      const metrics = await this.calculateRetentionRate(userId, 'quarter', date);
      quarters.push({
        quarter: q + 1,
        retentionRate: metrics.retentionRate,
        revenue: metrics.renewalRevenue
      });
    }

    return quarters;
  }
};
