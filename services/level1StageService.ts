import { supabase } from '../lib/supabase';

export interface Level1StageStatus {
  id: string;
  projectId: string;
  level1StageId: string;
  status: 'locked' | 'active' | 'completed';
  startedAt?: string;
  completedAt?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface Level1Stage {
  id: string;
  name: string;
  orderIndex: number;
  color?: string;
  icon?: string;
  createdAt: string;
}

export const level1StageService = {
  async getLevel1Stages(): Promise<Level1Stage[]> {
    const { data, error } = await supabase
      .from('roadmap_stage_level1')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data || []).map(stage => ({
      id: stage.id,
      name: stage.name,
      orderIndex: stage.order_index,
      color: stage.color,
      icon: stage.icon,
      createdAt: stage.created_at
    }));
  },

  async getProjectStageStatus(projectId: string): Promise<Level1StageStatus[]> {
    const { data, error } = await supabase
      .from('project_level1_stage_status')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data || []).map(status => ({
      id: status.id,
      projectId: status.project_id,
      level1StageId: status.level1_stage_id,
      status: status.status as 'locked' | 'active' | 'completed',
      startedAt: status.started_at,
      completedAt: status.completed_at,
      orderIndex: status.order_index,
      createdAt: status.created_at,
      updatedAt: status.updated_at
    }));
  },

  async initializeProjectStages(projectId: string): Promise<void> {
    const stages = await this.getLevel1Stages();

    const stageStatuses = stages.map((stage, index) => ({
      project_id: projectId,
      level1_stage_id: stage.id,
      status: index === 0 ? 'active' : 'locked',
      order_index: stage.orderIndex,
      started_at: index === 0 ? new Date().toISOString() : null
    }));

    const { error } = await supabase
      .from('project_level1_stage_status')
      .insert(stageStatuses);

    if (error) throw error;
  },

  async updateStageStatus(
    projectId: string,
    level1StageId: string,
    status: 'locked' | 'active' | 'completed'
  ): Promise<void> {
    const updates: any = { status };

    if (status === 'active') {
      updates.started_at = new Date().toISOString();
      updates.completed_at = null;
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      const current = await supabase
        .from('project_level1_stage_status')
        .select('started_at')
        .eq('project_id', projectId)
        .eq('level1_stage_id', level1StageId)
        .maybeSingle();

      if (!current?.data?.started_at) {
        updates.started_at = new Date().toISOString();
      }
    } else if (status === 'locked') {
      updates.started_at = null;
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from('project_level1_stage_status')
      .update(updates)
      .eq('project_id', projectId)
      .eq('level1_stage_id', level1StageId);

    if (error) throw error;
  },

  async completeStage(projectId: string, level1StageId: string): Promise<void> {
    await this.updateStageStatus(projectId, level1StageId, 'completed');
  },

  async getActiveStage(projectId: string): Promise<Level1StageStatus | null> {
    const { data, error } = await supabase
      .from('project_level1_stage_status')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      projectId: data.project_id,
      level1StageId: data.level1_stage_id,
      status: data.status as 'locked' | 'active' | 'completed',
      startedAt: data.started_at,
      completedAt: data.completed_at,
      orderIndex: data.order_index,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
};
