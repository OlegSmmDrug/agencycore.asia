import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface FinancialPlan {
  id: string;
  organizationId: string;
  month: string;
  plannedRevenue: number;
  plannedNetProfit: number;
  plannedEbitda: number;
  plannedExpenses: number;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): FinancialPlan {
  return {
    id: row.id,
    organizationId: row.organization_id,
    month: row.month,
    plannedRevenue: Number(row.planned_revenue) || 0,
    plannedNetProfit: Number(row.planned_net_profit) || 0,
    plannedEbitda: Number(row.planned_ebitda) || 0,
    plannedExpenses: Number(row.planned_expenses) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const financialPlanService = {
  async getByMonth(month: string): Promise<FinancialPlan | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return null;

    const { data, error } = await supabase
      .from('financial_plans')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('month', month)
      .maybeSingle();

    if (error || !data) return null;
    return mapRow(data);
  },

  async upsert(month: string, plan: Partial<Omit<FinancialPlan, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<FinancialPlan | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return null;

    const { data, error } = await supabase
      .from('financial_plans')
      .upsert({
        organization_id: organizationId,
        month,
        planned_revenue: plan.plannedRevenue ?? 0,
        planned_net_profit: plan.plannedNetProfit ?? 0,
        planned_ebitda: plan.plannedEbitda ?? 0,
        planned_expenses: plan.plannedExpenses ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,month' })
      .select()
      .maybeSingle();

    if (error || !data) return null;
    return mapRow(data);
  },
};
