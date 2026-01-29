import { supabase } from '../lib/supabase';

export interface RoadmapStageLevel1 {
  id: string;
  name: string;
  order_index: number;
  color: string;
  icon: string;
  created_at: string;
}

export interface RoadmapStageLevel2 {
  id: string;
  project_id: string;
  level1_stage_id: string;
  template_stage_id?: string;
  name: string;
  description: string;
  order_index: number;
  color: string;
  status: 'locked' | 'active' | 'completed';
  started_at?: string;
  completed_at?: string;
  duration_days: number;
  template_name?: string;
  created_at: string;
}

export interface RoadmapTemplate {
  id: string;
  name: string;
  description: string;
  service_type: string;
  is_active: boolean;
  created_at: string;
}

export interface RoadmapTemplateStage {
  id: string;
  template_id: string;
  name: string;
  description: string;
  order_index: number;
  color: string;
  duration_days: number;
  level1_stage_id?: string;
  created_at: string;
}

export interface RoadmapTemplateTask {
  id: string;
  stage_id: string;
  title: string;
  description: string;
  tags: string[];
  order_index: number;
  estimated_hours: number;
  duration_days: number;
  job_title_required?: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export const roadmapService = {
  async getLevel1Stages(): Promise<RoadmapStageLevel1[]> {
    const { data, error } = await supabase
      .from('roadmap_stage_level1')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getLevel2StagesByProject(projectId: string): Promise<RoadmapStageLevel2[]> {
    const { data, error } = await supabase
      .from('project_roadmap_stages')
      .select(`
        *,
        roadmap_template_stages!template_stage_id(
          roadmap_templates!template_id(
            name,
            service_type
          )
        )
      `)
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data || []).map(stage => {
      const templateData = stage.roadmap_template_stages as any;
      let template_name = undefined;

      if (templateData) {
        const templateInfo = Array.isArray(templateData) ? templateData[0]?.roadmap_templates : templateData?.roadmap_templates;
        if (templateInfo) {
          template_name = Array.isArray(templateInfo) ? templateInfo[0]?.name : templateInfo?.name;
        }
      }

      return {
        id: stage.id,
        project_id: stage.project_id,
        level1_stage_id: stage.level1_stage_id,
        template_stage_id: stage.template_stage_id,
        name: stage.name,
        description: stage.description,
        order_index: stage.order_index,
        color: stage.color,
        status: stage.status || 'locked',
        started_at: stage.started_at,
        completed_at: stage.completed_at,
        duration_days: stage.duration_days || 7,
        created_at: stage.created_at,
        template_name
      };
    });
  },

  async createLevel2Stage(stage: Partial<RoadmapStageLevel2>): Promise<RoadmapStageLevel2> {
    const { data, error } = await supabase
      .from('project_roadmap_stages')
      .insert([stage])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateLevel2Stage(id: string, updates: Partial<RoadmapStageLevel2>): Promise<void> {
    const { error } = await supabase
      .from('project_roadmap_stages')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteLevel2Stage(id: string, deleteTasksCascade: boolean = true): Promise<void> {
    if (deleteTasksCascade) {
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('stage_level2_id', id);

      if (tasksError) throw tasksError;
    } else {
      const { error: unlinkError } = await supabase
        .from('tasks')
        .update({ stage_level2_id: null })
        .eq('stage_level2_id', id);

      if (unlinkError) throw unlinkError;
    }

    const { error } = await supabase
      .from('project_roadmap_stages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getStageTaskCount(stageId: string): Promise<number> {
    const { count, error } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('stage_level2_id', stageId);

    if (error) throw error;
    return count || 0;
  },

  async deleteProjectRoadmap(projectId: string): Promise<{
    deletedStages: number;
    deletedTasks: number;
  }> {
    const level2Stages = await this.getLevel2StagesByProject(projectId);

    let totalTasksDeleted = 0;
    for (const stage of level2Stages) {
      const taskCount = await this.getStageTaskCount(stage.id);
      totalTasksDeleted += taskCount;
    }

    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .in('stage_level2_id', level2Stages.map(s => s.id));

    if (tasksError) throw tasksError;

    const { error: stagesError } = await supabase
      .from('project_roadmap_stages')
      .delete()
      .eq('project_id', projectId);

    if (stagesError) throw stagesError;

    const { error: templatesError } = await supabase
      .from('project_roadmap_templates')
      .delete()
      .eq('project_id', projectId);

    if (templatesError) throw templatesError;

    const { error: statusError } = await supabase
      .from('project_level1_stage_status')
      .delete()
      .eq('project_id', projectId);

    if (statusError) throw statusError;

    return {
      deletedStages: level2Stages.length,
      deletedTasks: totalTasksDeleted
    };
  },

  async getRoadmapTemplates(): Promise<RoadmapTemplate[]> {
    const { data, error } = await supabase
      .from('roadmap_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getTemplateStages(templateId: string): Promise<RoadmapTemplateStage[]> {
    const { data, error } = await supabase
      .from('roadmap_template_stages')
      .select('*')
      .eq('template_id', templateId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getTemplateTasks(stageId: string): Promise<RoadmapTemplateTask[]> {
    const { data, error } = await supabase
      .from('roadmap_template_tasks')
      .select('*')
      .eq('stage_id', stageId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getProjectTemplates(projectId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('project_roadmap_templates')
      .select('template_id')
      .eq('project_id', projectId);

    if (error) throw error;
    return data?.map(item => item.template_id) || [];
  },

  async assignTemplateToProject(projectId: string, templateId: string): Promise<void> {
    const { error } = await supabase
      .from('project_roadmap_templates')
      .insert([{ project_id: projectId, template_id: templateId }]);

    if (error && error.code !== '23505') throw error;
  },

  async removeTemplateFromProject(projectId: string, templateId: string): Promise<void> {
    const { error } = await supabase
      .from('project_roadmap_templates')
      .delete()
      .eq('project_id', projectId)
      .eq('template_id', templateId);

    if (error) throw error;
  },

  async autoAssignTaskByJobTitle(projectId: string, jobTitle: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('auto_assign_task_by_job_title', {
      p_project_id: projectId,
      p_job_title: jobTitle
    });

    if (error) {
      console.error('Error auto-assigning task:', error);
      return null;
    }

    return data;
  },

  async calculateTaskDeadlines(stageId: string, startDate: Date): Promise<void> {
    const { error } = await supabase.rpc('calculate_task_deadlines', {
      p_stage_id: stageId,
      p_start_date: startDate.toISOString()
    });

    if (error) {
      console.error('Error calculating task deadlines:', error);
      throw error;
    }
  },

  async applyTemplateToProject(projectId: string, templateId: string): Promise<void> {
    const templateStages = await this.getTemplateStages(templateId);

    const projectLevel1Status = await this.getProjectLevel1Status(projectId);
    if (projectLevel1Status.length === 0) {
      await this.initializeProjectStagesStatus(projectId);
    }

    const level1Stages = await this.getLevel1Stages();

    for (const templateStage of templateStages) {
      const level1StageId = templateStage.level1_stage_id || level1Stages[0].id;

      await this.createLevel2Stage({
        project_id: projectId,
        level1_stage_id: level1StageId,
        template_stage_id: templateStage.id,
        name: templateStage.name,
        description: templateStage.description,
        order_index: templateStage.order_index,
        color: templateStage.color,
        status: 'locked',
        duration_days: templateStage.duration_days || 7
      });
    }

    await this.assignTemplateToProject(projectId, templateId);
  },

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);

    if (error) throw error;
    return data || [];
  },

  async addProjectMember(projectId: string, userId: string, role: string = 'member'): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .insert([{ project_id: projectId, user_id: userId, role }]);

    if (error && error.code !== '23505') throw error;

    await this.syncProjectTeamIds(projectId);
  },

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;

    await this.syncProjectTeamIds(projectId);
  },

  async syncProjectTeamIds(projectId: string): Promise<void> {
    const members = await this.getProjectMembers(projectId);
    const teamIds = members.map(m => m.user_id);

    const { error } = await supabase
      .from('projects')
      .update({ team_ids: teamIds })
      .eq('id', projectId);

    if (error) throw error;
  },

  async createTemplate(template: Partial<RoadmapTemplate>): Promise<RoadmapTemplate> {
    const { data, error } = await supabase
      .from('roadmap_templates')
      .insert([{
        name: template.name,
        description: template.description,
        service_type: template.service_type,
        is_active: template.is_active ?? true
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTemplate(id: string, updates: Partial<RoadmapTemplate>): Promise<void> {
    const { error } = await supabase
      .from('roadmap_templates')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('roadmap_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getTemplateWithDetails(templateId: string): Promise<{
    template: RoadmapTemplate;
    stages: (RoadmapTemplateStage & { tasks: RoadmapTemplateTask[] })[];
  }> {
    const [template, stages] = await Promise.all([
      this.getRoadmapTemplates().then(templates => templates.find(t => t.id === templateId)),
      this.getTemplateStages(templateId)
    ]);

    if (!template) throw new Error('Template not found');

    const stagesWithTasks = await Promise.all(
      stages.map(async (stage) => ({
        ...stage,
        tasks: await this.getTemplateTasks(stage.id)
      }))
    );

    return { template, stages: stagesWithTasks };
  },

  async createTemplateStage(stage: Partial<RoadmapTemplateStage>): Promise<RoadmapTemplateStage> {
    const { data, error } = await supabase
      .from('roadmap_template_stages')
      .insert([stage])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTemplateStage(id: string, updates: Partial<RoadmapTemplateStage>): Promise<void> {
    const { error } = await supabase
      .from('roadmap_template_stages')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteTemplateStage(id: string): Promise<void> {
    const { error } = await supabase
      .from('roadmap_template_stages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async createTemplateTask(task: Partial<RoadmapTemplateTask>): Promise<RoadmapTemplateTask> {
    const { data, error } = await supabase
      .from('roadmap_template_tasks')
      .insert([task])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTemplateTask(id: string, updates: Partial<RoadmapTemplateTask>): Promise<void> {
    const { error } = await supabase
      .from('roadmap_template_tasks')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteTemplateTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('roadmap_template_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteAllTemplateStages(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('roadmap_template_stages')
      .delete()
      .eq('template_id', templateId);

    if (error) throw error;
  },

  async createTemplateStagesBatch(stages: Partial<RoadmapTemplateStage>[]): Promise<RoadmapTemplateStage[]> {
    if (stages.length === 0) return [];

    const { data, error } = await supabase
      .from('roadmap_template_stages')
      .insert(stages)
      .select();

    if (error) throw error;
    return data;
  },

  async createTemplateTasksBatch(tasks: Partial<RoadmapTemplateTask>[]): Promise<RoadmapTemplateTask[]> {
    if (tasks.length === 0) return [];

    const { data, error } = await supabase
      .from('roadmap_template_tasks')
      .insert(tasks)
      .select();

    if (error) throw error;
    return data;
  },

  async startLevel2Stage(stageId: string): Promise<void> {
    const { error } = await supabase.rpc('start_level2_stage', {
      p_stage_id: stageId
    });

    if (error) throw error;
  },

  async completeLevel2Stage(stageId: string): Promise<{
    success: boolean;
    next_stage_id: string | null;
    message: string;
  }> {
    const { data, error } = await supabase.rpc('complete_level2_stage', {
      stage_id: stageId
    });

    if (error) throw error;
    return data;
  },

  async checkStageTasksCompleted(stageId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_stage_tasks_completed', {
      stage_id: stageId
    });

    if (error) throw error;
    return data;
  },

  async updateStageStatus(
    stageId: string,
    status: 'locked' | 'active' | 'completed'
  ): Promise<void> {
    const updates: any = { status };

    if (status === 'active') {
      updates.started_at = new Date().toISOString();
      updates.completed_at = null;
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      if (!updates.started_at) {
        updates.started_at = new Date().toISOString();
      }
    } else if (status === 'locked') {
      updates.started_at = null;
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from('project_roadmap_stages')
      .update(updates)
      .eq('id', stageId);

    if (error) throw error;
  },

  async completeLevel1Stage(projectId: string, level1StageId: string): Promise<{
    success: boolean;
    next_level1_id: string | null;
    message: string;
  }> {
    const { data, error } = await supabase.rpc('complete_level1_stage', {
      project_id: projectId,
      level1_stage_id: level1StageId
    });

    if (error) throw error;
    return data;
  },

  async initializeProjectStagesStatus(projectId: string): Promise<void> {
    const level1Stages = await this.getLevel1Stages();

    for (const stage of level1Stages) {
      await supabase
        .from('project_level1_stage_status')
        .insert([{
          project_id: projectId,
          level1_stage_id: stage.id,
          status: stage.order_index === 1 ? 'active' : 'locked',
          order_index: stage.order_index,
          started_at: stage.order_index === 1 ? new Date().toISOString() : null
        }])
        .select();
    }
  },

  async getProjectLevel1Status(projectId: string) {
    const { data, error } = await supabase
      .from('project_level1_stage_status')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getPlannedTasksForStage(stageId: string): Promise<RoadmapTemplateTask[]> {
    const { data: stage, error: stageError } = await supabase
      .from('project_roadmap_stages')
      .select('template_stage_id')
      .eq('id', stageId)
      .single();

    if (stageError) throw stageError;

    if (!stage?.template_stage_id) {
      return [];
    }

    const { data, error } = await supabase
      .from('roadmap_template_tasks')
      .select('*')
      .eq('stage_id', stage.template_stage_id)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getTaskCountForTemplate(templateStageId: string): Promise<number> {
    const { data, error, count } = await supabase
      .from('roadmap_template_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('stage_id', templateStageId);

    if (error) throw error;
    return count || 0;
  }
};
