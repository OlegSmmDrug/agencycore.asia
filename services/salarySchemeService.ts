import { supabase } from '../lib/supabase';
import { SalaryScheme } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export const salarySchemeService = {
  async getAll(): Promise<SalaryScheme[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('salary_schemes')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching salary schemes:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      targetId: row.target_id,
      targetType: row.target_type as 'jobTitle' | 'user',
      baseSalary: Number(row.base_salary) || 0,
      kpiRules: row.kpi_rules || [],
      pmBonusPercent: Number(row.pm_bonus_percent) || 0
    }));
  },

  async getByTarget(targetId: string, targetType: 'jobTitle' | 'user'): Promise<SalaryScheme | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return null;
    }

    const { data, error } = await supabase
      .from('salary_schemes')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('target_id', targetId)
      .eq('target_type', targetType)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching salary scheme by target:', error);
      throw error;
    }

    return {
      id: data.id,
      targetId: data.target_id,
      targetType: data.target_type as 'jobTitle' | 'user',
      baseSalary: Number(data.base_salary) || 0,
      kpiRules: data.kpi_rules || [],
      pmBonusPercent: Number(data.pm_bonus_percent) || 0
    };
  },

  async create(scheme: Omit<SalaryScheme, 'id'>): Promise<SalaryScheme> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('salary_schemes')
      .insert({
        target_id: scheme.targetId,
        target_type: scheme.targetType,
        base_salary: scheme.baseSalary,
        kpi_rules: scheme.kpiRules,
        pm_bonus_percent: scheme.pmBonusPercent || 0,
        organization_id: organizationId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating salary scheme:', error);
      throw error;
    }

    return {
      id: data.id,
      targetId: data.target_id,
      targetType: data.target_type as 'jobTitle' | 'user',
      baseSalary: Number(data.base_salary) || 0,
      kpiRules: data.kpi_rules || [],
      pmBonusPercent: Number(data.pm_bonus_percent) || 0
    };
  },

  async update(id: string, updates: Partial<SalaryScheme>): Promise<SalaryScheme> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const updateData: any = {};

    if (updates.baseSalary !== undefined) updateData.base_salary = updates.baseSalary;
    if (updates.kpiRules !== undefined) updateData.kpi_rules = updates.kpiRules;
    if (updates.pmBonusPercent !== undefined) updateData.pm_bonus_percent = updates.pmBonusPercent;

    const { data, error } = await supabase
      .from('salary_schemes')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating salary scheme:', error);
      throw error;
    }

    return {
      id: data.id,
      targetId: data.target_id,
      targetType: data.target_type as 'jobTitle' | 'user',
      baseSalary: Number(data.base_salary) || 0,
      kpiRules: data.kpi_rules || [],
      pmBonusPercent: Number(data.pm_bonus_percent) || 0
    };
  },

  async upsert(scheme: SalaryScheme): Promise<SalaryScheme> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const upsertData: any = {
      target_id: scheme.targetId,
      target_type: scheme.targetType,
      base_salary: scheme.baseSalary,
      kpi_rules: scheme.kpiRules,
      pm_bonus_percent: scheme.pmBonusPercent || 0,
      organization_id: organizationId
    };

    if (scheme.id && !scheme.id.startsWith('sch_')) {
      upsertData.id = scheme.id;
    }

    const { data, error } = await supabase
      .from('salary_schemes')
      .upsert(upsertData, {
        onConflict: 'organization_id,target_id,target_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting salary scheme:', error);
      throw error;
    }

    return {
      id: data.id,
      targetId: data.target_id,
      targetType: data.target_type as 'jobTitle' | 'user',
      baseSalary: Number(data.base_salary) || 0,
      kpiRules: data.kpi_rules || [],
      pmBonusPercent: Number(data.pm_bonus_percent) || 0
    };
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('salary_schemes')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting salary scheme:', error);
      throw error;
    }
  }
};
