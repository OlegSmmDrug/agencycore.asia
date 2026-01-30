import { supabase } from '../lib/supabase';
import { ProjectExpense, ProjectExpenseHistory, Project, User, DynamicExpenses, DynamicExpenseItem, SalaryCalculations } from '../types';
import { GLOBAL_RATES } from './projectAnalytics';
import { serviceMappingService } from './serviceMappingService';
import { calculatorService } from './calculatorService';
import { salarySchemeService } from './salarySchemeService';
import { getLiveduneContentCounts, LiveduneContentCounts } from './contentCalculationService';

const mapRowToExpense = (row: any): ProjectExpense => ({
  id: row.id,
  projectId: row.project_id,
  month: row.month,

  smmExpenses: Number(row.smm_expenses) || 0,
  smmPostsCount: row.smm_posts_count || 0,
  smmReelsCount: row.smm_reels_count || 0,
  smmStoriesCount: row.smm_stories_count || 0,
  smmSpecDesignCount: row.smm_spec_design_count || 0,
  smmMonitoring: row.smm_monitoring || false,
  smmDubbingCount: row.smm_dubbing_count || 0,
  smmScenariosCount: row.smm_scenarios_count || 0,
  smmManualAdjustment: Number(row.smm_manual_adjustment) || 0,

  pmExpenses: Number(row.pm_expenses) || 0,
  pmSalaryShare: Number(row.pm_salary_share) || 0,
  pmProjectCount: row.pm_project_count || 1,

  productionExpenses: Number(row.production_expenses) || 0,
  productionMobilographHours: Number(row.production_mobilograph_hours) || 0,
  productionPhotographerHours: Number(row.production_photographer_hours) || 0,
  productionVideographerHours: Number(row.production_videographer_hours) || 0,
  productionVideoCost: Number(row.production_video_cost) || 0,
  productionManualAdjustment: Number(row.production_manual_adjustment) || 0,

  modelsExpenses: Number(row.models_expenses) || 0,

  targetologistExpenses: Number(row.targetologist_expenses) || 0,
  targetologistSalaryShare: Number(row.targetologist_salary_share) || 0,
  targetologistProjectCount: row.targetologist_project_count || 1,

  otherExpenses: Number(row.other_expenses) || 0,
  otherExpensesDescription: row.other_expenses_description || '',

  totalExpenses: Number(row.total_expenses) || 0,
  revenue: Number(row.revenue) || 0,
  marginPercent: Number(row.margin_percent) || 0,

  notes: row.notes || '',
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,

  dynamicExpenses: row.dynamic_expenses || {},
  lastSyncedAt: row.last_synced_at,
  syncSource: row.sync_source || 'manual',
  salaryCalculations: row.salary_calculations || {},
});

export const calculateSmmExpenses = (expense: Partial<ProjectExpense>): number => {
  const baseExpenses =
    (expense.smmPostsCount || 0) * GLOBAL_RATES.SMM.post +
    (expense.smmReelsCount || 0) * GLOBAL_RATES.SMM.reel +
    (expense.smmStoriesCount || 0) * GLOBAL_RATES.SMM.story +
    (expense.smmSpecDesignCount || 0) * GLOBAL_RATES.SMM.specDesign +
    (expense.smmMonitoring ? GLOBAL_RATES.SMM.monitoring : 0) +
    (expense.smmDubbingCount || 0) * GLOBAL_RATES.SMM.dubbing +
    (expense.smmScenariosCount || 0) * GLOBAL_RATES.SMM.scenario;

  return baseExpenses + (expense.smmManualAdjustment || 0);
};

export const calculateProductionExpenses = (expense: Partial<ProjectExpense>): number => {
  const hourlyExpenses =
    ((expense.productionMobilographHours || 0) +
     (expense.productionPhotographerHours || 0) +
     (expense.productionVideographerHours || 0)) * GLOBAL_RATES.PRODUCTION.hourly;

  return hourlyExpenses + (expense.productionVideoCost || 0) + (expense.productionManualAdjustment || 0);
};

export const calculateTotalExpenses = (expense: Partial<ProjectExpense>): number => {
  const smmExp = expense.smmExpenses || 0;
  const pmExp = expense.pmExpenses || 0;
  const prodExp = expense.productionExpenses || 0;
  const modelsExp = expense.modelsExpenses || 0;
  const targetExp = expense.targetologistExpenses || 0;
  const otherExp = expense.otherExpenses || 0;

  return smmExp + pmExp + prodExp + modelsExp + targetExp + otherExp;
};

export const calculateMargin = (revenue: number, totalExpenses: number): number => {
  if (revenue === 0) return 0;
  return ((revenue - totalExpenses) / revenue) * 100;
};

export const getActiveProjectsCountForUser = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .contains('team_ids', [userId])
    .eq('is_archived', false)
    .in('status', ['В работе', 'Продакшн']);

  if (error) {
    console.error('Error getting active projects count:', error);
    return 1;
  }

  return data?.length || 1;
};

export const distributePMSalary = async (
  projectId: string,
  userId: string,
  totalSalary: number
): Promise<{ pmExpenses: number; pmProjectCount: number }> => {
  const projectCount = await getActiveProjectsCountForUser(userId);
  const pmExpenses = projectCount > 0 ? totalSalary / projectCount : 0;

  return {
    pmExpenses,
    pmProjectCount: projectCount,
  };
};

export const projectExpensesService = {
  async getExpensesByProject(projectId: string): Promise<ProjectExpense[]> {
    const { data, error } = await supabase
      .from('project_expenses')
      .select('*')
      .eq('project_id', projectId)
      .order('month', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToExpense);
  },

  async getExpenseByProjectAndMonth(projectId: string, month: string): Promise<ProjectExpense | null> {
    const { data, error } = await supabase
      .from('project_expenses')
      .select('*')
      .eq('project_id', projectId)
      .eq('month', month)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToExpense(data) : null;
  },

  async createOrUpdateExpense(
    expense: Partial<ProjectExpense> & { projectId: string; month: string },
    userId: string
  ): Promise<ProjectExpense> {
    const smmExpenses = calculateSmmExpenses(expense);
    const productionExpenses = calculateProductionExpenses(expense);
    const totalExpenses = calculateTotalExpenses({
      ...expense,
      smmExpenses,
      productionExpenses,
    });
    const marginPercent = calculateMargin(expense.revenue || 0, totalExpenses);

    const expenseData = {
      project_id: expense.projectId,
      month: expense.month,

      smm_expenses: smmExpenses,
      smm_posts_count: expense.smmPostsCount || 0,
      smm_reels_count: expense.smmReelsCount || 0,
      smm_stories_count: expense.smmStoriesCount || 0,
      smm_spec_design_count: expense.smmSpecDesignCount || 0,
      smm_monitoring: expense.smmMonitoring || false,
      smm_dubbing_count: expense.smmDubbingCount || 0,
      smm_scenarios_count: expense.smmScenariosCount || 0,
      smm_manual_adjustment: expense.smmManualAdjustment || 0,

      pm_expenses: expense.pmExpenses || 0,
      pm_salary_share: expense.pmSalaryShare || 0,
      pm_project_count: expense.pmProjectCount || 1,

      production_expenses: productionExpenses,
      production_mobilograph_hours: expense.productionMobilographHours || 0,
      production_photographer_hours: expense.productionPhotographerHours || 0,
      production_videographer_hours: expense.productionVideographerHours || 0,
      production_video_cost: expense.productionVideoCost || 0,
      production_manual_adjustment: expense.productionManualAdjustment || 0,

      models_expenses: expense.modelsExpenses || 0,

      targetologist_expenses: expense.targetologistExpenses || 0,
      targetologist_salary_share: expense.targetologistSalaryShare || 0,
      targetologist_project_count: expense.targetologistProjectCount || 1,

      other_expenses: expense.otherExpenses || 0,
      other_expenses_description: expense.otherExpensesDescription || '',

      total_expenses: totalExpenses,
      revenue: expense.revenue || 0,
      margin_percent: marginPercent,

      notes: expense.notes || '',
      updated_by: userId,

      dynamic_expenses: expense.dynamicExpenses || {},
      last_synced_at: expense.lastSyncedAt,
      sync_source: expense.syncSource || 'manual',
      salary_calculations: expense.salaryCalculations || {},
    };

    const existing = await this.getExpenseByProjectAndMonth(expense.projectId, expense.month);

    if (existing) {
      const { data, error } = await supabase
        .from('project_expenses')
        .update(expenseData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return mapRowToExpense(data);
    } else {
      const { data, error } = await supabase
        .from('project_expenses')
        .insert({ ...expenseData, created_by: userId })
        .select()
        .single();

      if (error) throw error;
      return mapRowToExpense(data);
    }
  },

  async syncFromProjectContent(projectId: string, month: string, userId: string): Promise<ProjectExpense> {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('posts_fact, reels_fact, stories_fact, content_metrics')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    const existing = await this.getExpenseByProjectAndMonth(projectId, month);

    let smmPostsCount = 0;
    let smmReelsCount = 0;
    let smmStoriesCount = 0;

    if (project.content_metrics && Object.keys(project.content_metrics).length > 0) {
      const metrics = project.content_metrics as any;

      for (const key in metrics) {
        const metric = metrics[key];
        const lowerKey = key.toLowerCase();

        if (lowerKey.includes('post') && !lowerKey.includes('repost')) {
          smmPostsCount = metric.fact || 0;
        } else if (lowerKey.includes('reel')) {
          smmReelsCount = metric.fact || 0;
        } else if (lowerKey.includes('stor')) {
          smmStoriesCount = metric.fact || 0;
        }
      }
    } else {
      smmPostsCount = project.posts_fact || 0;
      smmReelsCount = project.reels_fact || 0;
      smmStoriesCount = project.stories_fact || 0;
    }

    return await this.createOrUpdateExpense(
      {
        projectId,
        month,
        smmPostsCount,
        smmReelsCount,
        smmStoriesCount,
        smmSpecDesignCount: existing?.smmSpecDesignCount || 0,
        smmMonitoring: existing?.smmMonitoring || false,
        smmDubbingCount: existing?.smmDubbingCount || 0,
        smmScenariosCount: existing?.smmScenariosCount || 0,
        smmManualAdjustment: existing?.smmManualAdjustment || 0,
        pmExpenses: existing?.pmExpenses || 0,
        pmSalaryShare: existing?.pmSalaryShare || 0,
        pmProjectCount: existing?.pmProjectCount || 1,
        productionExpenses: existing?.productionExpenses || 0,
        productionMobilographHours: existing?.productionMobilographHours || 0,
        productionPhotographerHours: existing?.productionPhotographerHours || 0,
        productionVideographerHours: existing?.productionVideographerHours || 0,
        productionVideoCost: existing?.productionVideoCost || 0,
        productionManualAdjustment: existing?.productionManualAdjustment || 0,
        modelsExpenses: existing?.modelsExpenses || 0,
        targetologistExpenses: existing?.targetologistExpenses || 0,
        targetologistSalaryShare: existing?.targetologistSalaryShare || 0,
        targetologistProjectCount: existing?.targetologistProjectCount || 1,
        otherExpenses: existing?.otherExpenses || 0,
        otherExpensesDescription: existing?.otherExpensesDescription || '',
        revenue: existing?.revenue || 0,
        notes: existing?.notes || '',
      },
      userId
    );
  },

  async deleteExpense(expenseId: string): Promise<void> {
    const { error } = await supabase
      .from('project_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) throw error;
  },

  async getExpenseHistory(expenseId: string): Promise<ProjectExpenseHistory[]> {
    const { data, error } = await supabase
      .from('project_expenses_history')
      .select('*')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      expenseId: row.expense_id,
      changedBy: row.changed_by,
      fieldName: row.field_name,
      oldValue: row.old_value || '',
      newValue: row.new_value || '',
      changeReason: row.change_reason || '',
      createdAt: row.created_at,
    }));
  },

  async getCurrentMonthExpense(projectId: string, userId: string): Promise<ProjectExpense> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existing = await this.getExpenseByProjectAndMonth(projectId, currentMonth);

    if (existing) {
      return existing;
    }

    return await this.syncFromProjectContent(projectId, currentMonth, userId);
  },

  async syncDynamicExpenses(
    projectId: string,
    month: string,
    userId: string
  ): Promise<ProjectExpense> {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, calculator_data, team_ids, livedune_access_token, livedune_account_id, start_date, end_date, content_metrics')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    const fullProject: Project = {
      id: project.id,
      name: project.name,
      liveduneAccessToken: project.livedune_access_token,
      liveduneAccountId: project.livedune_account_id,
      startDate: project.start_date,
      endDate: project.end_date,
      contentMetrics: project.content_metrics || {},
    } as Project;

    const dynamicExpenses: DynamicExpenses = {};
    const now = new Date().toISOString();

    const { data: completedTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, assignee_id, type, completed_at')
      .eq('project_id', projectId)
      .eq('status', 'Done');

    if (tasksError) {
      console.error('Error fetching completed tasks:', tasksError);
    }

    const tasksByExecutor: Record<string, Record<string, number>> = {};

    if (completedTasks && completedTasks.length > 0) {
      for (const task of completedTasks) {
        if (!task.assignee_id || !task.type) continue;

        if (!tasksByExecutor[task.assignee_id]) {
          tasksByExecutor[task.assignee_id] = {};
        }

        const taskType = task.type;
        tasksByExecutor[task.assignee_id][taskType] =
          (tasksByExecutor[task.assignee_id][taskType] || 0) + 1;
      }
    }

    const salarySchemes = await salarySchemeService.getAll();
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, job_title')
      .in('id', Object.keys(tasksByExecutor));

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    for (const executorId in tasksByExecutor) {
      const user = users?.find(u => u.id === executorId);
      if (!user) continue;

      const userScheme = salarySchemes.find(
        s => s.targetType === 'user' && s.targetId === executorId
      );
      const jobTitleScheme = salarySchemes.find(
        s => s.targetType === 'jobTitle' && s.targetId === user.job_title
      );

      const scheme = userScheme || jobTitleScheme;
      if (!scheme || !scheme.kpiRules || scheme.kpiRules.length === 0) continue;

      const taskTypeCounts = tasksByExecutor[executorId];

      for (const taskType in taskTypeCounts) {
        const count = taskTypeCounts[taskType];
        const kpiRule = scheme.kpiRules.find(rule => rule.taskType === taskType);

        if (kpiRule && kpiRule.value > 0) {
          const serviceKey = `${executorId}_${taskType}`;
          dynamicExpenses[serviceKey] = {
            serviceName: `${user.name} - ${taskType}`,
            count,
            rate: kpiRule.value,
            cost: count * kpiRule.value,
            category: 'KPI',
            syncedAt: now
          };
        }
      }
    }

    let modelsExpenses = 0;
    if (project.calculator_data && project.calculator_data.items) {
      const modelItem = project.calculator_data.items.find((item: any) =>
        item.name && item.name.toLowerCase().includes('модел')
      );
      if (modelItem && modelItem.quantity > 0) {
        modelsExpenses = modelItem.price * modelItem.quantity;
      }
    }

    const existing = await this.getExpenseByProjectAndMonth(projectId, month);

    const monthStart = new Date(`${month}-01`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const effectiveEndDate = monthEnd > today ? today : monthEnd;

    let liveduneContent: LiveduneContentCounts = { posts: 0, reels: 0, stories: 0 };
    const hasLivedune = Boolean(fullProject.liveduneAccessToken && fullProject.liveduneAccountId);

    if (hasLivedune) {
      try {
        liveduneContent = await getLiveduneContentCounts(fullProject, {
          start: monthStart,
          end: effectiveEndDate
        });
        console.log(`[ProjectExpenses] LiveDune content for ${month}:`, liveduneContent);
      } catch (error) {
        console.error('[ProjectExpenses] Error fetching LiveDune content:', error);
      }
    }

    const getManualContentFromMetrics = (): LiveduneContentCounts => {
      const metrics = fullProject.contentMetrics || {};
      let posts = 0;
      let reels = 0;
      let stories = 0;

      for (const [key, value] of Object.entries(metrics)) {
        const keyLower = key.toLowerCase();
        const factValue = (value as any).fact || 0;

        if ((keyLower.includes('post') || keyLower.includes('пост')) && !keyLower.includes('reel') && !keyLower.includes('stor')) {
          posts += factValue;
        } else if (keyLower.includes('reel') || keyLower.includes('рилс')) {
          reels += factValue;
        } else if (keyLower.includes('stor') || keyLower.includes('стори')) {
          stories += factValue;
        }
      }

      return { posts, reels, stories };
    };

    if (!hasLivedune || (liveduneContent.posts === 0 && liveduneContent.reels === 0 && liveduneContent.stories === 0)) {
      const manualContent = getManualContentFromMetrics();
      if (manualContent.posts > 0 || manualContent.reels > 0 || manualContent.stories > 0) {
        liveduneContent = manualContent;
        console.log(`[ProjectExpenses] Using manual content from metrics for ${month}:`, liveduneContent);
      }
    }

    let totalDynamicCost = 0;
    for (const serviceId in dynamicExpenses) {
      totalDynamicCost += dynamicExpenses[serviceId].cost;
    }

    const tempSmmData = {
      smmPostsCount: liveduneContent.posts,
      smmReelsCount: liveduneContent.reels,
      smmStoriesCount: liveduneContent.stories,
      smmSpecDesignCount: existing?.smmSpecDesignCount || 0,
      smmMonitoring: existing?.smmMonitoring || false,
      smmDubbingCount: existing?.smmDubbingCount || 0,
      smmScenariosCount: existing?.smmScenariosCount || 0,
      smmManualAdjustment: existing?.smmManualAdjustment || 0,
    };

    const calculatedSmmExpenses = calculateSmmExpenses(tempSmmData);

    const totalExpenses = calculatedSmmExpenses + totalDynamicCost + modelsExpenses + (existing?.otherExpenses || 0);
    const marginPercent = calculateMargin(existing?.revenue || 0, totalExpenses);

    const expenseData: Partial<ProjectExpense> & { projectId: string; month: string } = {
      projectId,
      month,
      dynamicExpenses,
      lastSyncedAt: now,
      syncSource: existing?.syncSource === 'manual' ? 'mixed' : 'auto',
      salaryCalculations: existing?.salaryCalculations || {},
      modelsExpenses,
      totalExpenses,
      marginPercent,
      smmExpenses: calculatedSmmExpenses,
      smmPostsCount: liveduneContent.posts,
      smmReelsCount: liveduneContent.reels,
      smmStoriesCount: liveduneContent.stories,
      smmSpecDesignCount: existing?.smmSpecDesignCount || 0,
      smmMonitoring: existing?.smmMonitoring || false,
      smmDubbingCount: existing?.smmDubbingCount || 0,
      smmScenariosCount: existing?.smmScenariosCount || 0,
      smmManualAdjustment: existing?.smmManualAdjustment || 0,
      pmExpenses: existing?.pmExpenses || 0,
      pmSalaryShare: existing?.pmSalaryShare || 0,
      pmProjectCount: existing?.pmProjectCount || 1,
      productionExpenses: existing?.productionExpenses || 0,
      productionMobilographHours: existing?.productionMobilographHours || 0,
      productionPhotographerHours: existing?.productionPhotographerHours || 0,
      productionVideographerHours: existing?.productionVideographerHours || 0,
      productionVideoCost: existing?.productionVideoCost || 0,
      productionManualAdjustment: existing?.productionManualAdjustment || 0,
      targetologistExpenses: existing?.targetologistExpenses || 0,
      targetologistSalaryShare: existing?.targetologistSalaryShare || 0,
      targetologistProjectCount: existing?.targetologistProjectCount || 1,
      otherExpenses: existing?.otherExpenses || 0,
      otherExpensesDescription: existing?.otherExpensesDescription || '',
      revenue: existing?.revenue || 0,
      notes: existing?.notes || '',
    };

    return await this.createOrUpdateExpense(expenseData, userId);
  },

  async calculateTeamSalaries(teamIds: string[], projectId: string): Promise<SalaryCalculations> {
    if (!teamIds || teamIds.length === 0) {
      return {};
    }

    const salaryCalculations: SalaryCalculations = {};
    const now = new Date().toISOString();

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, job_title, salary')
      .in('id', teamIds);

    if (usersError) {
      console.error('Error fetching team users:', usersError);
      return {};
    }

    const salarySchemes = await salarySchemeService.getAll();

    for (const user of users) {
      const userScheme = salarySchemes.find(
        s => s.targetType === 'user' && s.targetId === user.id
      );
      const jobTitleScheme = salarySchemes.find(
        s => s.targetType === 'jobTitle' && s.targetId === user.job_title
      );

      const scheme = userScheme || jobTitleScheme;
      const baseSalary = scheme?.baseSalary || user.salary || 0;

      if (baseSalary > 0) {
        const activeProjectsCount = await getActiveProjectsCountForUser(user.id);
        const shareForThisProject = activeProjectsCount > 0 ? baseSalary / activeProjectsCount : 0;

        salaryCalculations[user.id] = {
          userName: user.name,
          jobTitle: user.job_title,
          baseSalary,
          activeProjectsCount,
          shareForThisProject,
          calculatedAt: now
        };
      }
    }

    return salaryCalculations;
  },
};
