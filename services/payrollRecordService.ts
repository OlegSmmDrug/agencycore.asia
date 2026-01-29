import { supabase } from '../lib/supabase';
import { PayrollRecord } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export const payrollRecordService = {
  async getAll(): Promise<PayrollRecord[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('organization_id', organizationId)
      .order('month', { ascending: false });

    if (error) {
      console.error('Error fetching payroll records:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      month: row.month,
      fixSalary: Number(row.fix_salary) || 0,
      calculatedKpi: Number(row.calculated_kpi) || 0,
      manualBonus: Number(row.manual_bonus) || 0,
      manualPenalty: Number(row.manual_penalty) || 0,
      advance: Number(row.advance) || 0,
      status: row.status,
      balanceAtStart: Number(row.balance_at_start) || 0,
      paidAt: row.paid_at || undefined,
      taskPayments: row.task_payments || []
    }));
  },

  async getByMonth(month: string): Promise<PayrollRecord[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('month', month);

    if (error) {
      console.error('Error fetching payroll records by month:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      month: row.month,
      fixSalary: Number(row.fix_salary) || 0,
      calculatedKpi: Number(row.calculated_kpi) || 0,
      manualBonus: Number(row.manual_bonus) || 0,
      manualPenalty: Number(row.manual_penalty) || 0,
      advance: Number(row.advance) || 0,
      status: row.status,
      balanceAtStart: Number(row.balance_at_start) || 0,
      paidAt: row.paid_at || undefined,
      taskPayments: row.task_payments || []
    }));
  },

  async getByUser(userId: string): Promise<PayrollRecord[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .order('month', { ascending: false });

    if (error) {
      console.error('Error fetching payroll records by user:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      month: row.month,
      fixSalary: Number(row.fix_salary) || 0,
      calculatedKpi: Number(row.calculated_kpi) || 0,
      manualBonus: Number(row.manual_bonus) || 0,
      manualPenalty: Number(row.manual_penalty) || 0,
      advance: Number(row.advance) || 0,
      status: row.status,
      balanceAtStart: Number(row.balance_at_start) || 0,
      paidAt: row.paid_at || undefined,
      taskPayments: row.task_payments || []
    }));
  },

  async findByUserAndMonth(userId: string, month: string): Promise<PayrollRecord | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return null;
    }

    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('Error fetching payroll record by user and month:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      month: data.month,
      fixSalary: Number(data.fix_salary) || 0,
      calculatedKpi: Number(data.calculated_kpi) || 0,
      manualBonus: Number(data.manual_bonus) || 0,
      manualPenalty: Number(data.manual_penalty) || 0,
      advance: Number(data.advance) || 0,
      status: data.status,
      balanceAtStart: Number(data.balance_at_start) || 0,
      paidAt: data.paid_at || undefined,
      taskPayments: data.task_payments || []
    };
  },

  async create(record: Omit<PayrollRecord, 'id'>): Promise<PayrollRecord> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('payroll_records')
      .insert({
        user_id: record.userId,
        month: record.month,
        fix_salary: record.fixSalary,
        calculated_kpi: record.calculatedKpi,
        manual_bonus: record.manualBonus,
        manual_penalty: record.manualPenalty,
        advance: record.advance,
        status: record.status,
        balance_at_start: record.balanceAtStart,
        paid_at: record.paidAt || null,
        organization_id: organizationId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payroll record:', error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      month: data.month,
      fixSalary: Number(data.fix_salary) || 0,
      calculatedKpi: Number(data.calculated_kpi) || 0,
      manualBonus: Number(data.manual_bonus) || 0,
      manualPenalty: Number(data.manual_penalty) || 0,
      advance: Number(data.advance) || 0,
      status: data.status,
      balanceAtStart: Number(data.balance_at_start) || 0,
      paidAt: data.paid_at || undefined,
      taskPayments: data.task_payments || []
    };
  },

  async update(id: string, updates: Partial<PayrollRecord>): Promise<PayrollRecord> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const updateData: any = {};

    if (updates.fixSalary !== undefined) updateData.fix_salary = updates.fixSalary;
    if (updates.calculatedKpi !== undefined) updateData.calculated_kpi = updates.calculatedKpi;
    if (updates.manualBonus !== undefined) updateData.manual_bonus = updates.manualBonus;
    if (updates.manualPenalty !== undefined) updateData.manual_penalty = updates.manualPenalty;
    if (updates.advance !== undefined) updateData.advance = updates.advance;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.balanceAtStart !== undefined) updateData.balance_at_start = updates.balanceAtStart;
    if (updates.paidAt !== undefined) updateData.paid_at = updates.paidAt;

    const { data, error } = await supabase
      .from('payroll_records')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating payroll record:', error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      month: data.month,
      fixSalary: Number(data.fix_salary) || 0,
      calculatedKpi: Number(data.calculated_kpi) || 0,
      manualBonus: Number(data.manual_bonus) || 0,
      manualPenalty: Number(data.manual_penalty) || 0,
      advance: Number(data.advance) || 0,
      status: data.status,
      balanceAtStart: Number(data.balance_at_start) || 0,
      paidAt: data.paid_at || undefined,
      taskPayments: data.task_payments || []
    };
  },

  async upsert(record: PayrollRecord): Promise<PayrollRecord> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('payroll_records')
      .upsert({
        id: record.id,
        user_id: record.userId,
        month: record.month,
        fix_salary: record.fixSalary,
        calculated_kpi: record.calculatedKpi,
        manual_bonus: record.manualBonus,
        manual_penalty: record.manualPenalty,
        advance: record.advance,
        status: record.status,
        balance_at_start: record.balanceAtStart,
        paid_at: record.paidAt || null,
        organization_id: organizationId
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting payroll record:', error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      month: data.month,
      fixSalary: Number(data.fix_salary) || 0,
      calculatedKpi: Number(data.calculated_kpi) || 0,
      manualBonus: Number(data.manual_bonus) || 0,
      manualPenalty: Number(data.manual_penalty) || 0,
      advance: Number(data.advance) || 0,
      status: data.status,
      balanceAtStart: Number(data.balance_at_start) || 0,
      paidAt: data.paid_at || undefined,
      taskPayments: data.task_payments || []
    };
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('payroll_records')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting payroll record:', error);
      throw error;
    }
  }
};
