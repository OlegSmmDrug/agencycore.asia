import { supabase } from '../lib/supabase';

export interface MonthlyAnalytics {
  month: string;
  new_projects: number;
  active_projects: number;
  new_clients: number;
  won_clients: number;
  publications: number;
  income: number;
  expenses: number;
  tasks_completed: number;
  team_size: number;
  avg_project_budget: number;
}

export interface AnalyticsPeriod {
  start_date: string;
  end_date: string;
}

export interface AggregatedAnalytics extends MonthlyAnalytics {
  profit: number;
  margin: number;
  cac: number;
  ltv: number;
  revenue_per_employee: number;
}

export const unifiedAnalyticsService = {
  async getMonthlyAnalytics(
    organizationId: string,
    startDate?: string
  ): Promise<MonthlyAnalytics[]> {
    try {
      const { data, error } = await supabase.rpc('get_unified_analytics', {
        p_organization_id: organizationId,
        p_start_date: startDate || '2020-01-01',
      });

      if (error) {
        console.error('Error fetching unified analytics:', error);
        return await this.getFallbackAnalytics(organizationId);
      }

      return (data || []).map((row: any) => ({
        month: row.month,
        new_projects: Number(row.new_projects) || 0,
        active_projects: Number(row.active_projects) || 0,
        new_clients: Number(row.new_clients) || 0,
        won_clients: Number(row.won_clients) || 0,
        publications: Number(row.publications) || 0,
        income: Number(row.income) || 0,
        expenses: Number(row.expenses) || 0,
        tasks_completed: Number(row.tasks_completed) || 0,
        team_size: Number(row.team_size) || 0,
        avg_project_budget: Number(row.avg_project_budget) || 0,
      }));
    } catch (error) {
      console.error('Error in getMonthlyAnalytics:', error);
      return await this.getFallbackAnalytics(organizationId);
    }
  },

  async getFallbackAnalytics(organizationId: string): Promise<MonthlyAnalytics[]> {
    try {
      const { data, error } = await supabase.rpc('get_monthly_stats_fallback', {
        p_organization_id: organizationId,
      });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        month: row.month,
        new_projects: Number(row.new_projects) || 0,
        active_projects: Number(row.active_projects) || 0,
        new_clients: Number(row.new_clients) || 0,
        won_clients: Number(row.won_clients) || 0,
        publications: Number(row.publications) || 0,
        income: Number(row.income) || 0,
        expenses: Number(row.expenses) || 0,
        tasks_completed: Number(row.tasks_completed) || 0,
        team_size: Number(row.team_size) || 0,
        avg_project_budget: Number(row.avg_project_budget) || 0,
      }));
    } catch (error) {
      console.error('Error in getFallbackAnalytics:', error);
      return [];
    }
  },

  async getAnalyticsForPeriod(
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<AggregatedAnalytics> {
    const monthlyData = await this.getMonthlyAnalytics(organizationId, startDate);

    const filteredData = monthlyData.filter(
      (row) => row.month >= startDate && row.month <= endDate
    );

    if (filteredData.length === 0) {
      return {
        month: startDate,
        new_projects: 0,
        active_projects: 0,
        new_clients: 0,
        won_clients: 0,
        publications: 0,
        income: 0,
        expenses: 0,
        tasks_completed: 0,
        team_size: 0,
        avg_project_budget: 0,
        profit: 0,
        margin: 0,
        cac: 0,
        ltv: 0,
        revenue_per_employee: 0,
      };
    }

    const totals = filteredData.reduce(
      (acc, row) => ({
        new_projects: acc.new_projects + row.new_projects,
        active_projects: acc.active_projects + row.active_projects,
        new_clients: acc.new_clients + row.new_clients,
        won_clients: acc.won_clients + row.won_clients,
        publications: acc.publications + row.publications,
        income: acc.income + row.income,
        expenses: acc.expenses + row.expenses,
        tasks_completed: acc.tasks_completed + row.tasks_completed,
        team_size: Math.max(acc.team_size, row.team_size),
        avg_project_budget: acc.avg_project_budget + row.avg_project_budget,
      }),
      {
        new_projects: 0,
        active_projects: 0,
        new_clients: 0,
        won_clients: 0,
        publications: 0,
        income: 0,
        expenses: 0,
        tasks_completed: 0,
        team_size: 0,
        avg_project_budget: 0,
      }
    );

    const profit = totals.income - totals.expenses;
    const margin = totals.income > 0 ? (profit / totals.income) * 100 : 0;
    const cac = totals.won_clients > 0 ? totals.expenses / totals.won_clients : 0;
    const ltv = totals.won_clients > 0 ? totals.income / totals.won_clients : 0;
    const revenue_per_employee = totals.team_size > 0 ? totals.income / totals.team_size : 0;

    return {
      month: startDate,
      ...totals,
      avg_project_budget:
        filteredData.length > 0 ? totals.avg_project_budget / filteredData.length : 0,
      profit,
      margin,
      cac,
      ltv,
      revenue_per_employee,
    };
  },

  async getAnalyticsForMonth(organizationId: string, month: string): Promise<AggregatedAnalytics> {
    const monthStart = new Date(month);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    return await this.getAnalyticsForPeriod(
      organizationId,
      monthStart.toISOString().split('T')[0],
      monthEnd.toISOString().split('T')[0]
    );
  },

  async getComparisonData(
    organizationId: string,
    currentPeriod: { start: string; end: string },
    previousPeriod: { start: string; end: string }
  ) {
    const [current, previous] = await Promise.all([
      this.getAnalyticsForPeriod(organizationId, currentPeriod.start, currentPeriod.end),
      this.getAnalyticsForPeriod(organizationId, previousPeriod.start, previousPeriod.end),
    ]);

    return {
      current,
      previous,
      changes: {
        income: this.calculateChange(current.income, previous.income),
        expenses: this.calculateChange(current.expenses, previous.expenses),
        profit: this.calculateChange(current.profit, previous.profit),
        margin: current.margin - previous.margin,
        new_clients: this.calculateChange(current.new_clients, previous.new_clients),
        won_clients: this.calculateChange(current.won_clients, previous.won_clients),
        new_projects: this.calculateChange(current.new_projects, previous.new_projects),
        publications: this.calculateChange(current.publications, previous.publications),
        tasks_completed: this.calculateChange(current.tasks_completed, previous.tasks_completed),
      },
    };
  },

  calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  },

  formatMonth(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' });
  },

  getMonthsList(startDate: string, endDate: string): string[] {
    const months: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    let current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      months.push(current.toISOString().split('T')[0]);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return months;
  },

  async getAdsAnalytics(organizationId: string, period: { start: string; end: string }) {
    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .in('integration_type', ['facebook_ads', 'google_ads', 'tiktok_ads']);

    return integrations || [];
  },

  async getContentAnalytics(organizationId: string, period: { start: string; end: string }) {
    const { data } = await supabase
      .from('content_publications')
      .select(
        `
        *,
        project:projects!inner(organization_id)
      `
      )
      .eq('project.organization_id', organizationId)
      .gte('published_at', period.start)
      .lte('published_at', period.end);

    return data || [];
  },

  async getProjectAnalytics(organizationId: string, period: { start: string; end: string }) {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', period.start)
      .lte('created_at', period.end);

    return data || [];
  },

  async getClientAnalytics(organizationId: string, period: { start: string; end: string }) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', period.start)
      .lte('created_at', period.end);

    return data || [];
  },

  async getTeamAnalytics(organizationId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', organizationId);

    return data || [];
  },

  async getTasksAnalytics(organizationId: string, period: { start: string; end: string }) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'Done')
      .gte('completed_at', period.start)
      .lte('completed_at', period.end);

    return data || [];
  },

  async getFinancialSummary(organizationId: string, period: { start: string; end: string }) {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('date', period.start)
      .lte('date', period.end);

    if (!data) return { income: 0, expenses: 0, profit: 0, margin: 0 };

    const income = data.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = Math.abs(
      data.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
    );
    const profit = income - expenses;
    const margin = income > 0 ? (profit / income) * 100 : 0;

    return { income, expenses, profit, margin };
  },
};
