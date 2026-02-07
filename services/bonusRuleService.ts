import { supabase } from '../lib/supabase';
import { BonusRule, TieredConfigItem } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export const bonusRuleService = {
  async getAll(): Promise<BonusRule[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('bonus_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bonus rules:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      ownerType: row.owner_type as 'jobTitle' | 'user',
      ownerId: row.owner_id,
      name: row.name,
      metricSource: row.metric_source,
      conditionType: row.condition_type,
      thresholdValue: row.threshold_value ? Number(row.threshold_value) : undefined,
      thresholdOperator: row.threshold_operator,
      tieredConfig: row.tiered_config as TieredConfigItem[],
      rewardType: row.reward_type,
      rewardValue: Number(row.reward_value) || 0,
      applyToBase: row.apply_to_base,
      isActive: row.is_active,
      calculationPeriod: row.calculation_period,
      description: row.description,
      organizationId: row.organization_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },

  async getByOwner(ownerId: string, ownerType: 'jobTitle' | 'user'): Promise<BonusRule[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('bonus_rules')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('owner_type', ownerType)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bonus rules by owner:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      ownerType: row.owner_type as 'jobTitle' | 'user',
      ownerId: row.owner_id,
      name: row.name,
      metricSource: row.metric_source,
      conditionType: row.condition_type,
      thresholdValue: row.threshold_value ? Number(row.threshold_value) : undefined,
      thresholdOperator: row.threshold_operator,
      tieredConfig: row.tiered_config as TieredConfigItem[],
      rewardType: row.reward_type,
      rewardValue: Number(row.reward_value) || 0,
      applyToBase: row.apply_to_base,
      isActive: row.is_active,
      calculationPeriod: row.calculation_period,
      description: row.description,
      organizationId: row.organization_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },

  async create(rule: Omit<BonusRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<BonusRule> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('bonus_rules')
      .insert({
        owner_type: rule.ownerType,
        owner_id: rule.ownerId,
        name: rule.name,
        metric_source: rule.metricSource,
        condition_type: rule.conditionType,
        threshold_value: rule.thresholdValue || null,
        threshold_operator: rule.thresholdOperator || '>=',
        tiered_config: rule.tieredConfig || [],
        reward_type: rule.rewardType,
        reward_value: rule.rewardValue,
        apply_to_base: rule.applyToBase,
        is_active: rule.isActive,
        calculation_period: rule.calculationPeriod,
        description: rule.description || null,
        organization_id: organizationId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bonus rule:', error);
      throw error;
    }

    return {
      id: data.id,
      ownerType: data.owner_type as 'jobTitle' | 'user',
      ownerId: data.owner_id,
      name: data.name,
      metricSource: data.metric_source,
      conditionType: data.condition_type,
      thresholdValue: data.threshold_value ? Number(data.threshold_value) : undefined,
      thresholdOperator: data.threshold_operator,
      tieredConfig: data.tiered_config as TieredConfigItem[],
      rewardType: data.reward_type,
      rewardValue: Number(data.reward_value) || 0,
      applyToBase: data.apply_to_base,
      isActive: data.is_active,
      calculationPeriod: data.calculation_period,
      description: data.description,
      organizationId: data.organization_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  async update(id: string, updates: Partial<BonusRule>): Promise<BonusRule> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.metricSource !== undefined) updateData.metric_source = updates.metricSource;
    if (updates.conditionType !== undefined) updateData.condition_type = updates.conditionType;
    if (updates.thresholdValue !== undefined) updateData.threshold_value = updates.thresholdValue;
    if (updates.thresholdOperator !== undefined) updateData.threshold_operator = updates.thresholdOperator;
    if (updates.tieredConfig !== undefined) updateData.tiered_config = updates.tieredConfig;
    if (updates.rewardType !== undefined) updateData.reward_type = updates.rewardType;
    if (updates.rewardValue !== undefined) updateData.reward_value = updates.rewardValue;
    if (updates.applyToBase !== undefined) updateData.apply_to_base = updates.applyToBase;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.calculationPeriod !== undefined) updateData.calculation_period = updates.calculationPeriod;
    if (updates.description !== undefined) updateData.description = updates.description;

    const { data, error } = await supabase
      .from('bonus_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating bonus rule:', error);
      throw error;
    }

    return {
      id: data.id,
      ownerType: data.owner_type as 'jobTitle' | 'user',
      ownerId: data.owner_id,
      name: data.name,
      metricSource: data.metric_source,
      conditionType: data.condition_type,
      thresholdValue: data.threshold_value ? Number(data.threshold_value) : undefined,
      thresholdOperator: data.threshold_operator,
      tieredConfig: data.tiered_config as TieredConfigItem[],
      rewardType: data.reward_type,
      rewardValue: Number(data.reward_value) || 0,
      applyToBase: data.apply_to_base,
      isActive: data.is_active,
      calculationPeriod: data.calculation_period,
      description: data.description,
      organizationId: data.organization_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('bonus_rules')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting bonus rule:', error);
      throw error;
    }
  },

  async toggleActive(id: string, isActive: boolean): Promise<BonusRule> {
    return this.update(id, { isActive });
  }
};
