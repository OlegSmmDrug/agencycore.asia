import { supabase } from '../lib/supabase';
import { ProjectExpense, ProjectExpenseHistory, Project, User, DynamicExpenses, DynamicExpenseItem, SalaryCalculations, FotCalculations } from '../types';
import { GLOBAL_RATES } from './projectAnalytics';
import { serviceMappingService } from './serviceMappingService';
import { calculatorService } from './calculatorService';
import { salarySchemeService } from './salarySchemeService';
import { getLiveduneContentCounts, LiveduneContentCounts } from './contentCalculationService';
import { calculatorCategoryHelper } from './calculatorCategoryHelper';

const mapRowToExpense = (row: any): ProjectExpense => ({
  id: row.id,
  projectId: row.project_id,
  month: row.month,
  projectMonthNumber: row.project_month_number,
  periodStartDate: row.period_start_date,
  periodEndDate: row.period_end_date,

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

  fotExpenses: Number(row.fot_expenses) || 0,
  fotCalculations: row.fot_calculations || {},

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
  return expense.productionExpenses || 0;
};

export const calculateTotalExpenses = (expense: Partial<ProjectExpense>): number => {
  let dynamicTotal = 0;
  let dynamicProductionTotal = 0;

  if (expense.dynamicExpenses && typeof expense.dynamicExpenses === 'object') {
    for (const key in expense.dynamicExpenses) {
      const item = expense.dynamicExpenses[key];
      if (item && typeof item === 'object' && 'cost' in item) {
        const cost = Number(item.cost) || 0;
        dynamicTotal += cost;
        if (item.category === 'video') {
          dynamicProductionTotal += cost;
        }
      }
    }
  }

  if (dynamicTotal > 0) {
    const prodExpenses = dynamicProductionTotal > 0 ? 0 : (expense.productionExpenses || 0);
    return dynamicTotal + (expense.modelsExpenses || 0) + (expense.fotExpenses || 0) + (expense.otherExpenses || 0) + prodExpenses;
  }

  const smmExp = expense.smmExpenses || 0;
  const pmExp = expense.pmExpenses || 0;
  const prodExp = expense.productionExpenses || 0;
  const modelsExp = expense.modelsExpenses || 0;
  const targetExp = expense.targetologistExpenses || 0;
  const fotExp = expense.fotExpenses || 0;
  const otherExp = expense.otherExpenses || 0;

  return smmExp + pmExp + prodExp + modelsExp + targetExp + fotExp + otherExp;
};

export const calculateMargin = (revenue: number, totalExpenses: number): number => {
  if (revenue === 0) return 0;
  return ((revenue - totalExpenses) / revenue) * 100;
};

export const calculateProjectPeriodDates = (projectStartDate: string, monthNumber: number): { startDate: string; endDate: string } => {
  const startDate = new Date(projectStartDate);
  const periodStart = new Date(startDate);
  periodStart.setDate(periodStart.getDate() + (monthNumber - 1) * 30);

  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 29);

  return {
    startDate: periodStart.toISOString().split('T')[0],
    endDate: periodEnd.toISOString().split('T')[0]
  };
};

export const getProjectMonthsCount = (projectStartDate: string, projectDeadline?: string): number => {
  const start = new Date(projectStartDate);
  const end = projectDeadline ? new Date(projectDeadline) : new Date();

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(1, Math.ceil(diffDays / 30));
};

export const getActiveProjectsCountForUser = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .contains('team_ids', [userId])
    .eq('is_archived', false);

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

export const calculateFotExpenses = async (
  projectId: string,
  month: string
): Promise<{ fotExpenses: number; fotCalculations: FotCalculations }> => {
  const { data: project } = await supabase
    .from('projects')
    .select('team_ids')
    .eq('id', projectId)
    .maybeSingle();

  if (!project || !project.team_ids || project.team_ids.length === 0) {
    return { fotExpenses: 0, fotCalculations: {} };
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, name, job_title')
    .in('id', project.team_ids);

  if (!users || users.length === 0) {
    return { fotExpenses: 0, fotCalculations: {} };
  }

  const { data: salarySchemes } = await supabase
    .from('salary_schemes')
    .select('target_id, base_salary, kpi_rules')
    .eq('target_type', 'user')
    .in('target_id', users.map(u => u.id));

  const fotCalculations: FotCalculations = {};
  let totalFot = 0;

  for (const user of users) {
    const scheme = salarySchemes?.find(s => s.target_id === user.id);

    if (!scheme || !scheme.base_salary || scheme.base_salary <= 0) {
      continue;
    }

    const hasKpiRules = scheme.kpi_rules && Array.isArray(scheme.kpi_rules) && scheme.kpi_rules.length > 0;
    if (hasKpiRules) {
      continue;
    }

    const projectCount = await getActiveProjectsCountForUser(user.id);
    const shareForThisProject = projectCount > 0 ? scheme.base_salary / projectCount : 0;

    fotCalculations[user.id] = {
      userName: user.name,
      jobTitle: user.job_title || '',
      baseSalary: Number(scheme.base_salary),
      activeProjectsCount: projectCount,
      shareForThisProject,
      calculatedAt: new Date().toISOString(),
    };

    totalFot += shareForThisProject;
  }

  return {
    fotExpenses: totalFot,
    fotCalculations,
  };
};

interface ProductionExpensesResult {
  mobilographHours: number;
  photographerHours: number;
  videographerHours: number;
  mobilographCost: number;
  photographerCost: number;
  videographerCost: number;
  totalCost: number;
  calculatorServices: Record<string, DynamicExpenseItem>;
  details: Array<{
    taskId: string;
    taskTitle: string;
    assigneeName: string;
    jobTitle: string;
    hours: number;
    rate: number;
    cost: number;
    shootingDate: string;
  }>;
}

export const calculateProductionExpensesFromTasks = async (
  projectId: string,
  month: string
): Promise<ProductionExpensesResult> => {
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const nextMonthDate = new Date(year, monthNum, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .single();

  const organizationId = project?.organization_id;

  const { data: calculatorServices } = await supabase
    .from('calculator_services')
    .select('id, name, price, cost_price')
    .eq('organization_id', organizationId)
    .eq('category', 'video')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const calculatorServicesMap: Record<string, DynamicExpenseItem> = {};

  if (calculatorServices && calculatorServices.length > 0) {
    for (const service of calculatorServices) {
      const costPrice = service.cost_price ? Number(service.cost_price) : Number(service.price) * 0.6;
      calculatorServicesMap[service.id] = {
        serviceName: service.name,
        count: 0,
        rate: costPrice,
        cost: 0,
        category: 'video',
        syncedAt: new Date().toISOString(),
      };
    }
  }

  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      type,
      started_at,
      estimated_hours,
      assignee_id,
      users:assignee_id (
        id,
        name,
        job_title
      )
    `)
    .eq('project_id', projectId)
    .eq('status', 'Done')
    .gte('started_at', monthStart)
    .lt('started_at', nextMonth)
    .not('started_at', 'is', null);

  if (!tasks || tasks.length === 0) {
    return {
      mobilographHours: 0,
      photographerHours: 0,
      videographerHours: 0,
      mobilographCost: 0,
      photographerCost: 0,
      videographerCost: 0,
      totalCost: 0,
      calculatorServices: calculatorServicesMap,
      details: [],
    };
  }

  const details: ProductionExpensesResult['details'] = [];
  let totalCost = 0;

  for (const task of tasks) {
    const user = Array.isArray(task.users) ? task.users[0] : task.users;
    if (!user || !user.job_title || !task.type) continue;

    const { data: scheme } = await supabase
      .from('salary_schemes')
      .select('kpi_rules')
      .eq('target_type', 'user')
      .eq('target_id', user.id)
      .maybeSingle();

    let taskRate = 0;

    if (scheme?.kpi_rules && Array.isArray(scheme.kpi_rules)) {
      const rule = scheme.kpi_rules.find((r: any) => r.taskType === task.type);
      if (rule && rule.value) {
        taskRate = Number(rule.value);
      }
    }

    if (taskRate === 0) continue;

    const hours = Number(task.estimated_hours) || 1;
    const cost = taskRate * hours;
    totalCost += cost;

    details.push({
      taskId: task.id,
      taskTitle: task.title,
      assigneeName: user.name,
      jobTitle: user.job_title,
      hours: hours,
      rate: taskRate,
      cost: Math.round(cost),
      shootingDate: task.started_at.slice(0, 10),
    });
  }

  return {
    mobilographHours: 0,
    photographerHours: 0,
    videographerHours: 0,
    mobilographCost: 0,
    photographerCost: 0,
    videographerCost: 0,
    totalCost: Math.round(totalCost),
    calculatorServices: calculatorServicesMap,
    details,
  };
};

export const projectExpensesService = {
  async getExpensesByProject(projectId: string): Promise<ProjectExpense[]> {
    const { data, error } = await supabase
      .from('project_expenses')
      .select('*')
      .eq('project_id', projectId)
      .order('project_month_number', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToExpense);
  },

  async getExpenseByProjectAndPeriod(projectId: string, periodNumber: number): Promise<ProjectExpense | null> {
    const { data, error } = await supabase
      .from('project_expenses')
      .select('*')
      .eq('project_id', projectId)
      .eq('project_month_number', periodNumber)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const expense = mapRowToExpense(data);

    if (expense.revenue === 0 || !expense.revenue) {
      const { data: project } = await supabase
        .from('projects')
        .select('budget')
        .eq('id', projectId)
        .maybeSingle();

      if (project) {
        expense.revenue = project.budget || 0;
      }
    }

    return expense;
  },

  async getExpenseByProjectAndMonth(projectId: string, month: string): Promise<ProjectExpense | null> {
    const { data, error } = await supabase
      .from('project_expenses')
      .select('*')
      .eq('project_id', projectId)
      .eq('month', month)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const expense = mapRowToExpense(data);

    if (expense.revenue === 0 || !expense.revenue) {
      const { data: project } = await supabase
        .from('projects')
        .select('budget')
        .eq('id', projectId)
        .maybeSingle();

      if (project?.budget) {
        await supabase
          .from('project_expenses')
          .update({ revenue: project.budget })
          .eq('id', expense.id);

        expense.revenue = Number(project.budget);
      }
    }

    return expense;
  },

  async createOrUpdateExpense(
    expense: Partial<ProjectExpense> & { projectId: string; month: string },
    userId: string
  ): Promise<ProjectExpense> {
    const { data: project } = await supabase
      .from('projects')
      .select('start_date, deadline')
      .eq('id', expense.projectId)
      .maybeSingle();

    let projectMonthNumber = expense.projectMonthNumber;
    let periodStartDate = expense.periodStartDate;
    let periodEndDate = expense.periodEndDate;

    if (project?.start_date && !projectMonthNumber) {
      const totalMonths = getProjectMonthsCount(project.start_date, project.deadline);
      const months = Array.from({ length: totalMonths }, (_, i) => {
        const dates = calculateProjectPeriodDates(project.start_date, i + 1);
        return { monthNumber: i + 1, ...dates };
      });

      const monthDate = new Date(expense.month + '-15');
      const matchingMonth = months.find(m => {
        const start = new Date(m.startDate);
        const end = new Date(m.endDate);
        return monthDate >= start && monthDate <= end;
      });

      if (matchingMonth) {
        projectMonthNumber = matchingMonth.monthNumber;
        periodStartDate = matchingMonth.startDate;
        periodEndDate = matchingMonth.endDate;
      }
    }

    const hasDynamicExpenses = expense.dynamicExpenses && Object.keys(expense.dynamicExpenses).length > 0;

    const smmExpenses = hasDynamicExpenses ? (expense.smmExpenses || 0) : calculateSmmExpenses(expense);
    const productionExpenses = hasDynamicExpenses ? (expense.productionExpenses || 0) : calculateProductionExpenses(expense);
    const totalExpenses = calculateTotalExpenses({
      ...expense,
      smmExpenses,
      productionExpenses,
    });
    const marginPercent = calculateMargin(expense.revenue || 0, totalExpenses);

    const expenseData = {
      project_id: expense.projectId,
      month: expense.month,
      project_month_number: projectMonthNumber,
      period_start_date: periodStartDate,
      period_end_date: periodEndDate,

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

      fot_expenses: expense.fotExpenses || 0,
      fot_calculations: expense.fotCalculations || {},

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
      .select('id, name, team_ids, budget, livedune_access_token, livedune_account_id, start_date, end_date, content_metrics')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    const fullProject: Project = {
      id: project.id,
      name: project.name,
      budget: project.budget || 0,
      liveduneAccessToken: project.livedune_access_token,
      liveduneAccountId: project.livedune_account_id,
      startDate: project.start_date,
      endDate: project.end_date,
      contentMetrics: project.content_metrics || {},
    } as Project;

    const dynamicExpenses: DynamicExpenses = {};
    const now = new Date().toISOString();

    await calculatorCategoryHelper.getAllCategories();

    const { data: completedTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, assignee_id, type, completed_at, estimated_hours')
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
        const hours = Number(task.estimated_hours) || 1;
        tasksByExecutor[task.assignee_id][taskType] =
          (tasksByExecutor[task.assignee_id][taskType] || 0) + hours;
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
        const hours = taskTypeCounts[taskType];
        const kpiRule = scheme.kpiRules.find(rule => rule.taskType === taskType);

        if (kpiRule && kpiRule.value > 0) {
          const category = await calculatorCategoryHelper.getCategoryByJobTitleAndTaskType(user.job_title, taskType);

          if (category === 'video') {
            continue;
          }

          const serviceKey = `${executorId}_${taskType}`;

          dynamicExpenses[serviceKey] = {
            serviceName: `${user.name} - ${taskType}`,
            count: hours,
            rate: kpiRule.value,
            cost: hours * kpiRule.value,
            category,
            syncedAt: now
          };
        }
      }
    }

    const { data: salarySchemesByJobTitle, error: schemesError } = await supabase
      .from('salary_schemes')
      .select('id, target_id, kpi_rules')
      .eq('target_type', 'jobTitle');

    if (schemesError) {
      console.error('Error fetching salary schemes:', schemesError);
    }

    const normalizeServiceName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/ё/g, 'е');
    };

    const findKpiRule = (metricName: string) => {
      const normalizedMetric = normalizeServiceName(metricName);

      if (!salarySchemesByJobTitle) return null;

      for (const scheme of salarySchemesByJobTitle) {
        if (!scheme.kpi_rules || !Array.isArray(scheme.kpi_rules)) continue;

        for (const rule of scheme.kpi_rules as any[]) {
          const normalizedTaskType = normalizeServiceName(rule.taskType || '');

          if (normalizedTaskType === normalizedMetric) {
            return {
              taskType: rule.taskType,
              value: rule.value,
              jobTitle: scheme.target_id
            };
          }
        }
      }

      return null;
    };

    if (fullProject.contentMetrics) {
      const contentMetrics = fullProject.contentMetrics as Record<string, { fact?: number; plan?: number }>;

      for (const [metricKey, metricValue] of Object.entries(contentMetrics)) {
        const fact = metricValue?.fact || 0;
        if (fact === 0) continue;

        const kpiRule = findKpiRule(metricKey);

        if (kpiRule && kpiRule.value > 0) {
          const serviceKey = `kpi_${metricKey}`;
          const cost = fact * kpiRule.value;

          const category = await calculatorCategoryHelper.getCategoryByJobTitleAndTaskType(kpiRule.jobTitle || '', metricKey);

          dynamicExpenses[serviceKey] = {
            serviceName: kpiRule.taskType,
            count: fact,
            rate: kpiRule.value,
            cost,
            category,
            syncedAt: now
          };

          console.log(`[ProjectExpenses] Added KPI service: ${kpiRule.taskType} x ${fact} = ${cost} ₸ (${kpiRule.jobTitle}, ${category})`);
        } else {
          console.warn(`[ProjectExpenses] No KPI rule found for metric: ${metricKey}`);
        }
      }
    }

    const existing = await this.getExpenseByProjectAndMonth(projectId, month);
    const modelsExpenses = existing?.modelsExpenses || 0;

    const monthStart = new Date(`${month}-01`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const effectiveEndDate = monthEnd > today ? today : monthEnd;

    let liveduneContent: LiveduneContentCounts = { posts: 0, reels: 0, stories: 0, hasError: false };
    const hasLivedune = Boolean(fullProject.liveduneAccessToken && fullProject.liveduneAccountId);

    if (hasLivedune) {
      liveduneContent = await getLiveduneContentCounts(fullProject, {
        start: monthStart,
        end: effectiveEndDate
      });
      console.log(`[ProjectExpenses] LiveDune content for ${month}:`, liveduneContent);

      if (liveduneContent.hasError) {
        console.warn(`[ProjectExpenses] LiveDune API error detected for ${project.name}. Token may be expired or Instagram API issue. Falling back to manual data.`);
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

    if (!hasLivedune || liveduneContent.hasError || (liveduneContent.posts === 0 && liveduneContent.reels === 0 && liveduneContent.stories === 0)) {
      const manualContent = getManualContentFromMetrics();
      if (manualContent.posts > 0 || manualContent.reels > 0 || manualContent.stories > 0) {
        liveduneContent = manualContent;
        console.log(`[ProjectExpenses] Using manual content from metrics for ${month}:`, liveduneContent);
      } else if (!hasLivedune) {
        console.log(`[ProjectExpenses] No LiveDune and no manual data for ${month}`);
      }
    }

    let totalDynamicCost = 0;
    for (const serviceId in dynamicExpenses) {
      totalDynamicCost += dynamicExpenses[serviceId].cost;
    }

    const { fotExpenses, fotCalculations } = await calculateFotExpenses(projectId, month);
    const productionResult = await calculateProductionExpensesFromTasks(projectId, month);

    for (const detail of productionResult.details) {
      const taskKey = `task_${detail.taskId}`;
      const serviceName = `${detail.assigneeName} - ${detail.taskTitle}`;
      const category = await calculatorCategoryHelper.getCategoryByJobTitleAndTaskType(detail.jobTitle, detail.taskTitle);

      dynamicExpenses[taskKey] = {
        serviceName,
        count: detail.hours,
        rate: detail.rate,
        cost: detail.cost,
        category,
        syncedAt: now,
      };
      totalDynamicCost += detail.cost;
    }

    const projectRevenue = fullProject.budget || existing?.revenue || 0;
    const totalExpenses = totalDynamicCost + modelsExpenses + fotExpenses + (existing?.otherExpenses || 0);
    const marginPercent = calculateMargin(projectRevenue, totalExpenses);

    let smmExpenses = 0;
    let productionExpenses = 0;
    let targetologistExpenses = 0;
    let pmExpenses = 0;

    for (const serviceId in dynamicExpenses) {
      const item = dynamicExpenses[serviceId];
      if (item.category === 'smm') {
        smmExpenses += item.cost;
      } else if (item.category === 'video') {
        productionExpenses += item.cost;
      } else if (item.category === 'target') {
        targetologistExpenses += item.cost;
      }
    }

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
      smmExpenses,
      smmPostsCount: liveduneContent.posts,
      smmReelsCount: liveduneContent.reels,
      smmStoriesCount: liveduneContent.stories,
      smmSpecDesignCount: existing?.smmSpecDesignCount || 0,
      smmMonitoring: existing?.smmMonitoring || false,
      smmDubbingCount: existing?.smmDubbingCount || 0,
      smmScenariosCount: existing?.smmScenariosCount || 0,
      smmManualAdjustment: existing?.smmManualAdjustment || 0,
      pmExpenses,
      pmSalaryShare: existing?.pmSalaryShare || 0,
      pmProjectCount: existing?.pmProjectCount || 1,
      productionExpenses,
      productionMobilographHours: existing?.productionMobilographHours || 0,
      productionPhotographerHours: existing?.productionPhotographerHours || 0,
      productionVideographerHours: existing?.productionVideographerHours || 0,
      productionVideoCost: existing?.productionVideoCost || 0,
      productionManualAdjustment: existing?.productionManualAdjustment || 0,
      targetologistExpenses,
      targetologistSalaryShare: existing?.targetologistSalaryShare || 0,
      targetologistProjectCount: existing?.targetologistProjectCount || 1,
      fotExpenses,
      fotCalculations,
      otherExpenses: existing?.otherExpenses || 0,
      otherExpensesDescription: existing?.otherExpensesDescription || '',
      revenue: projectRevenue,
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
