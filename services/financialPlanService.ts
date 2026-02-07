import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface CustomDdsRow {
  id: string;
  name: string;
  section: 'operating_outflow' | 'investing' | 'financing';
}

export interface FinancialPlan {
  id: string;
  organizationId: string;
  month: string;
  plannedRevenue: number;
  plannedNetProfit: number;
  plannedEbitda: number;
  plannedExpenses: number;
  plannedCogs: number;
  plannedMarketing: number;
  plannedPayroll: number;
  plannedOffice: number;
  plannedOtherOpex: number;
  plannedTaxes: number;
  plannedDepreciation: number;
  taxRate: number;
  customDdsRows: CustomDdsRow[];
  ddsCapex: number;
  ddsFinancing: number;
  isEditable: boolean;
  notes: string;
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
    plannedCogs: Number(row.planned_cogs) || 0,
    plannedMarketing: Number(row.planned_marketing) || 0,
    plannedPayroll: Number(row.planned_payroll) || 0,
    plannedOffice: Number(row.planned_office) || 0,
    plannedOtherOpex: Number(row.planned_other_opex) || 0,
    plannedTaxes: Number(row.planned_taxes) || 0,
    plannedDepreciation: Number(row.planned_depreciation) || 0,
    taxRate: Number(row.tax_rate) || 0.15,
    customDdsRows: Array.isArray(row.custom_dds_rows) ? row.custom_dds_rows : [],
    ddsCapex: Number(row.dds_capex) || 0,
    ddsFinancing: Number(row.dds_financing) || 0,
    isEditable: row.is_editable ?? true,
    notes: row.notes || '',
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

  async getRange(startMonth: string, endMonth: string): Promise<FinancialPlan[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('financial_plans')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true });

    if (error || !data) return [];
    return data.map(mapRow);
  },

  async upsert(month: string, plan: Partial<Omit<FinancialPlan, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<FinancialPlan | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return null;

    const upsertData: any = {
      organization_id: organizationId,
      month,
      updated_at: new Date().toISOString(),
    };

    if (plan.plannedRevenue !== undefined) upsertData.planned_revenue = plan.plannedRevenue;
    if (plan.plannedNetProfit !== undefined) upsertData.planned_net_profit = plan.plannedNetProfit;
    if (plan.plannedEbitda !== undefined) upsertData.planned_ebitda = plan.plannedEbitda;
    if (plan.plannedExpenses !== undefined) upsertData.planned_expenses = plan.plannedExpenses;
    if (plan.plannedCogs !== undefined) upsertData.planned_cogs = plan.plannedCogs;
    if (plan.plannedMarketing !== undefined) upsertData.planned_marketing = plan.plannedMarketing;
    if (plan.plannedPayroll !== undefined) upsertData.planned_payroll = plan.plannedPayroll;
    if (plan.plannedOffice !== undefined) upsertData.planned_office = plan.plannedOffice;
    if (plan.plannedOtherOpex !== undefined) upsertData.planned_other_opex = plan.plannedOtherOpex;
    if (plan.plannedTaxes !== undefined) upsertData.planned_taxes = plan.plannedTaxes;
    if (plan.plannedDepreciation !== undefined) upsertData.planned_depreciation = plan.plannedDepreciation;
    if (plan.isEditable !== undefined) upsertData.is_editable = plan.isEditable;
    if (plan.notes !== undefined) upsertData.notes = plan.notes;

    const { data, error } = await supabase
      .from('financial_plans')
      .upsert(upsertData, { onConflict: 'organization_id,month' })
      .select()
      .maybeSingle();

    if (error || !data) return null;
    return mapRow(data);
  },

  async bulkUpsert(plans: Array<{ month: string } & Partial<Omit<FinancialPlan, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>>): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const rows = plans.map(p => ({
      organization_id: organizationId,
      month: p.month,
      planned_revenue: p.plannedRevenue ?? 0,
      planned_cogs: p.plannedCogs ?? 0,
      planned_marketing: p.plannedMarketing ?? 0,
      planned_payroll: p.plannedPayroll ?? 0,
      planned_office: p.plannedOffice ?? 0,
      planned_other_opex: p.plannedOtherOpex ?? 0,
      planned_taxes: p.plannedTaxes ?? 0,
      planned_depreciation: p.plannedDepreciation ?? 0,
      planned_net_profit: p.plannedNetProfit ?? 0,
      planned_ebitda: p.plannedEbitda ?? 0,
      planned_expenses: p.plannedExpenses ?? 0,
      tax_rate: (p as any).taxRate ?? 0.15,
      custom_dds_rows: (p as any).customDdsRows ?? [],
      dds_capex: (p as any).ddsCapex ?? 0,
      dds_financing: (p as any).ddsFinancing ?? 0,
      updated_at: new Date().toISOString(),
    }));

    await supabase
      .from('financial_plans')
      .upsert(rows, { onConflict: 'organization_id,month' });
  },

  async getTaxRate(): Promise<number> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return 0.15;

    const { data } = await supabase
      .from('company_settings')
      .select('tax_rate')
      .eq('organization_id', organizationId)
      .maybeSingle();

    return data?.tax_rate != null ? Number(data.tax_rate) : 0.15;
  },

  async saveTaxRate(rate: number): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('company_settings')
        .update({ tax_rate: rate })
        .eq('organization_id', organizationId);
    } else {
      await supabase
        .from('company_settings')
        .insert({ organization_id: organizationId, tax_rate: rate });
    }
  },
};
