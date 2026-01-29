import { supabase } from '../lib/supabase';
import { ClientStatus } from '../types';

export interface CrmPipelineStage {
  id: string;
  organizationId: string;
  statusKey: ClientStatus;
  label: string;
  hint?: string;
  level: number;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

class CrmPipelineStagesService {
  async getActiveStages(organizationId: string): Promise<CrmPipelineStage[]> {
    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching CRM stages:', error);
      return [];
    }

    return (data || []).map(stage => ({
      id: stage.id,
      organizationId: stage.organization_id,
      statusKey: stage.status_key as ClientStatus,
      label: stage.label,
      hint: stage.hint,
      level: stage.level,
      color: stage.color,
      sortOrder: stage.sort_order,
      isActive: stage.is_active,
      isSystem: stage.is_system,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at
    }));
  }

  async getAllStages(organizationId: string): Promise<CrmPipelineStage[]> {
    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching all CRM stages:', error);
      return [];
    }

    return (data || []).map(stage => ({
      id: stage.id,
      organizationId: stage.organization_id,
      statusKey: stage.status_key as ClientStatus,
      label: stage.label,
      hint: stage.hint,
      level: stage.level,
      color: stage.color,
      sortOrder: stage.sort_order,
      isActive: stage.is_active,
      isSystem: stage.is_system,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at
    }));
  }

  async createStage(organizationId: string, stage: Partial<CrmPipelineStage>): Promise<CrmPipelineStage | null> {
    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .insert({
        organization_id: organizationId,
        status_key: stage.statusKey,
        label: stage.label,
        hint: stage.hint,
        level: stage.level || 0,
        color: stage.color || 'border-t-4 border-slate-300',
        sort_order: stage.sortOrder || 999,
        is_active: stage.isActive !== false,
        is_system: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating CRM stage:', error);
      return null;
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      statusKey: data.status_key as ClientStatus,
      label: data.label,
      hint: data.hint,
      level: data.level,
      color: data.color,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      isSystem: data.is_system,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateStage(stageId: string, updates: Partial<CrmPipelineStage>): Promise<boolean> {
    const updateData: any = {};

    if (updates.label !== undefined) updateData.label = updates.label;
    if (updates.hint !== undefined) updateData.hint = updates.hint;
    if (updates.level !== undefined) updateData.level = updates.level;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('crm_pipeline_stages')
      .update(updateData)
      .eq('id', stageId);

    if (error) {
      console.error('Error updating CRM stage:', error);
      return false;
    }

    return true;
  }

  async deleteStage(stageId: string): Promise<boolean> {
    // Проверяем что это не системный этап
    const { data: stage } = await supabase
      .from('crm_pipeline_stages')
      .select('is_system')
      .eq('id', stageId)
      .single();

    if (stage?.is_system) {
      console.error('Cannot delete system stage');
      return false;
    }

    const { error } = await supabase
      .from('crm_pipeline_stages')
      .delete()
      .eq('id', stageId);

    if (error) {
      console.error('Error deleting CRM stage:', error);
      return false;
    }

    return true;
  }

  async toggleStageActive(stageId: string): Promise<boolean> {
    const { data: stage } = await supabase
      .from('crm_pipeline_stages')
      .select('is_active, is_system')
      .eq('id', stageId)
      .single();

    if (!stage) return false;

    // Системные этапы нельзя деактивировать
    if (stage.is_system && stage.is_active) {
      console.error('Cannot deactivate system stage');
      return false;
    }

    const { error } = await supabase
      .from('crm_pipeline_stages')
      .update({
        is_active: !stage.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', stageId);

    if (error) {
      console.error('Error toggling stage active:', error);
      return false;
    }

    return true;
  }

  async reorderStages(organizationId: string, stageIds: string[]): Promise<boolean> {
    try {
      // Обновляем sort_order для всех этапов
      const updates = stageIds.map((stageId, index) =>
        supabase
          .from('crm_pipeline_stages')
          .update({
            sort_order: index + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', stageId)
          .eq('organization_id', organizationId)
      );

      await Promise.all(updates);
      return true;
    } catch (error) {
      console.error('Error reordering stages:', error);
      return false;
    }
  }
}

export const crmPipelineStagesService = new CrmPipelineStagesService();
