import { supabase } from '../lib/supabase';

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

interface SalesMetrics {
  totalRevenue: number;
  transactionCount: number;
  clientCount: number;
  averageTransactionValue: number;
}

interface PeriodFilter {
  startDate: Date;
  endDate: Date;
}

export const salesMetricsService = {
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

  async calculateManagerSales(
    managerId: string,
    period: 'month' | 'quarter',
    date?: Date
  ): Promise<SalesMetrics> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const { startDate, endDate } = this.getPeriodFilter(period, date);

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('manager_id', managerId)
      .eq('organization_id', organizationId);

    if (clientsError) {
      console.error('Error fetching manager clients:', clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      return {
        totalRevenue: 0,
        transactionCount: 0,
        clientCount: 0,
        averageTransactionValue: 0
      };
    }

    const clientIds = clients.map(c => c.id);

    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('amount, date')
      .in('client_id', clientIds)
      .eq('type', 'income')
      .eq('is_verified', true)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      throw transactionsError;
    }

    const totalRevenue = (transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionCount = transactions?.length || 0;
    const averageTransactionValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    return {
      totalRevenue,
      transactionCount,
      clientCount: clientIds.length,
      averageTransactionValue
    };
  },

  async getManagerClients(managerId: string): Promise<string[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('manager_id', managerId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error fetching manager clients:', error);
      throw error;
    }

    return (data || []).map(c => c.id);
  },

  async getManagerSalesByMonth(managerId: string, year: number): Promise<{ month: number; revenue: number }[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const clientIds = await this.getManagerClients(managerId);
    if (clientIds.length === 0) {
      return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0 }));
    }

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, date')
      .in('client_id', clientIds)
      .eq('type', 'income')
      .eq('is_verified', true)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) {
      console.error('Error fetching transactions for year:', error);
      throw error;
    }

    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0 }));

    (transactions || []).forEach(t => {
      const month = new Date(t.date).getMonth();
      monthlyRevenue[month].revenue += Number(t.amount);
    });

    return monthlyRevenue;
  }
};
