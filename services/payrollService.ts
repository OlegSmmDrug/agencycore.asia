import { User, Task, Project, SalaryScheme, TaskStatus, TaskType } from '../types';
import { bonusCalculationService, BonusCalculationDetail } from './bonusCalculationService';
import { calculateProjectContentPayroll } from './projectContentPayrollService';

interface KpiDetail {
  taskType: TaskType;
  count: number;
  rate: number;
  total: number;
}

interface UserStatsResult {
  baseSalary: number;
  kpiEarned: number;
  bonusesEarned: number;
  details: KpiDetail[];
  bonusDetails: BonusCalculationDetail[];
  totalEarnings: number;
}

export async function calculateUserStats(
  user: User,
  tasks: Task[],
  projects: Project[],
  salarySchemes: SalaryScheme[],
  month: string
): Promise<UserStatsResult> {
  console.log(`[Payroll Debug] === Calculating for ${user.name} (${user.jobTitle}) - Month: ${month} ===`);
  console.log(`[Payroll Debug] Total salary schemes available: ${salarySchemes.length}`);
  console.log(`[Payroll Debug] Looking for user scheme with targetId: ${user.id}`);
  console.log(`[Payroll Debug] Looking for jobTitle scheme with targetId: ${user.jobTitle}`);

  const userScheme = salarySchemes.find(
    s => s.targetType === 'user' && s.targetId === user.id
  );
  const jobTitleScheme = salarySchemes.find(
    s => s.targetType === 'jobTitle' && s.targetId === user.jobTitle
  );

  console.log(`[Payroll Debug] User scheme found:`, userScheme ? 'YES' : 'NO');
  console.log(`[Payroll Debug] JobTitle scheme found:`, jobTitleScheme ? 'YES' : 'NO');

  const scheme = userScheme || jobTitleScheme;
  const baseSalary = scheme?.baseSalary || user.salary || 0;

  console.log(`[Payroll Debug] Using scheme:`, scheme ? `${scheme.targetType}/${scheme.targetId}` : 'NONE');
  console.log(`[Payroll Debug] Base salary: ${baseSalary}`);
  console.log(`[Payroll Debug] KPI rules count: ${scheme?.kpiRules?.length || 0}`);

  if (scheme && scheme.kpiRules.length > 0) {
    console.log(`[Payroll Debug] Expected task types in scheme:`, JSON.stringify(scheme.kpiRules.map(r => r.taskType), null, 2));
  }

  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  const completedTasks = tasks.filter(t => {
    if (t.assigneeId !== user.id) return false;
    if (t.status !== TaskStatus.DONE) return false;
    if (!t.completedAt) return false;
    const completedDate = new Date(t.completedAt);
    return completedDate >= monthStart && completedDate <= monthEnd;
  });

  const allUserTasks = tasks.filter(t => t.assigneeId === user.id);
  const doneTasks = allUserTasks.filter(t => t.status === TaskStatus.DONE);
  const doneWithDate = doneTasks.filter(t => t.completedAt);

  console.log(`[Payroll Debug] Total tasks assigned: ${allUserTasks.length}`);
  console.log(`[Payroll Debug] DONE tasks: ${doneTasks.length}`);
  console.log(`[Payroll Debug] DONE with completedAt: ${doneWithDate.length}`);
  console.log(`[Payroll Debug] Completed in period: ${completedTasks.length}`);

  if (allUserTasks.length > 0) {
    const allTypesDistribution = allUserTasks.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[Payroll Debug] ALL tasks types:`, JSON.stringify(allTypesDistribution, null, 2));
  }

  if (doneTasks.length > 0) {
    const doneTypesDistribution = doneTasks.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[Payroll Debug] DONE tasks types:`, JSON.stringify(doneTypesDistribution, null, 2));

    const missingDates = doneTasks.filter(t => !t.completedAt).map(t => ({
      title: t.title,
      type: t.type,
      status: t.status,
      deadline: t.deadline
    }));
    if (missingDates.length > 0) {
      console.log(`[Payroll Debug] ⚠️ DONE tasks WITHOUT completedAt:`, JSON.stringify(missingDates, null, 2));
    }
  }

  if (completedTasks.length > 0) {
    const taskTypeDistribution = completedTasks.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[Payroll Debug] Tasks in period types:`, JSON.stringify(taskTypeDistribution, null, 2));
  }

  const details: KpiDetail[] = [];
  let totalKpi = 0;

  if (scheme) {
    console.log(`[Payroll Debug] Processing KPI rules...`);
    for (const rule of scheme.kpiRules) {
      const tasksOfType = completedTasks.filter(t => t.type === rule.taskType);
      const count = tasksOfType.length;
      const total = count * rule.value;

      console.log(`[Payroll Debug] Rule: "${rule.taskType}" @ ${rule.value} per task`);
      console.log(`[Payroll Debug]   - Searching for type: "${rule.taskType}"`);
      console.log(`[Payroll Debug]   - Found ${count} tasks of this type`);
      if (count === 0 && completedTasks.length > 0) {
        const availableTypes = [...new Set(completedTasks.map(t => t.type))];
        console.log(`[Payroll Debug]   - ⚠️ Available types in completed tasks:`, JSON.stringify(availableTypes, null, 2));
      }
      console.log(`[Payroll Debug]   - Total earnings: ${total}`);

      totalKpi += total;

      if (count > 0) {
        details.push({
          taskType: rule.taskType,
          count,
          rate: rule.value,
          total
        });
      }
    }
    console.log(`[Payroll Debug] Total KPI earned from tasks: ${totalKpi}`);
  } else {
    console.log(`[Payroll Debug] No scheme found - skipping KPI calculation`);
  }

  const projectContentResult = calculateProjectContentPayroll(user, projects, salarySchemes, month);
  console.log(`[Payroll Debug] Project content KPI: ${projectContentResult.totalEarnings}`);

  const totalKpiWithContent = totalKpi + projectContentResult.totalEarnings;
  console.log(`[Payroll Debug] Total KPI (tasks + content): ${totalKpiWithContent}`);

  let bonusResult;
  try {
    bonusResult = await bonusCalculationService.calculateBonusesForUser(user, month);
  } catch (error) {
    console.error('Error calculating bonuses:', error);
    bonusResult = { totalBonus: 0, details: [], period: month };
  }

  const totalEarnings = baseSalary + totalKpiWithContent + bonusResult.totalBonus;

  return {
    baseSalary,
    kpiEarned: totalKpiWithContent,
    bonusesEarned: bonusResult.totalBonus,
    details,
    bonusDetails: bonusResult.details,
    totalEarnings
  };
}
