import { User, Task, Project, SalaryScheme, TaskStatus, TaskType } from '../types';
import { bonusCalculationService, BonusCalculationDetail } from './bonusCalculationService';
import { calculateProjectContentPayroll } from './projectContentPayrollService';

interface KpiDetail {
  taskType: TaskType;
  count: number;
  hours: number;
  rate: number;
  total: number;
}

export interface ContentPayrollDetail {
  projectId: string;
  projectName: string;
  contentType: string;
  quantity: number;
  rate: number;
  total: number;
  sharePercentage: number;
}

interface UserStatsResult {
  baseSalary: number;
  kpiEarned: number;
  bonusesEarned: number;
  details: KpiDetail[];
  contentDetails: ContentPayrollDetail[];
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
  const userScheme = salarySchemes.find(
    s => s.targetType === 'user' && s.targetId === user.id
  );
  const jobTitleScheme = salarySchemes.find(
    s => s.targetType === 'jobTitle' && s.targetId === user.jobTitle
  );

  const scheme = userScheme || jobTitleScheme;
  const baseSalary = scheme?.baseSalary || user.salary || 0;

  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

  const completedTasks = tasks.filter(t => {
    if (t.assigneeId !== user.id) return false;
    if (t.status !== TaskStatus.DONE) return false;

    const dateToUse = t.completedAt || t.deadline;
    if (!dateToUse) return false;

    const completedDate = new Date(dateToUse);
    return completedDate >= monthStart && completedDate <= monthEnd;
  });

  const details: KpiDetail[] = [];
  let totalKpi = 0;

  if (scheme) {
    for (const rule of scheme.kpiRules) {
      const tasksOfType = completedTasks.filter(t => t.type === rule.taskType);
      const count = tasksOfType.length;

      const totalHours = tasksOfType.reduce((sum, t) => {
        const hours = parseFloat(String(t.estimatedHours || 1));
        return sum + hours;
      }, 0);

      const total = totalHours * rule.value;
      totalKpi += total;

      if (count > 0) {
        details.push({
          taskType: rule.taskType,
          count,
          hours: totalHours,
          rate: rule.value,
          total
        });
      }
    }
  }

  const projectContentResult = await calculateProjectContentPayroll(user, projects, salarySchemes, month);
  const totalKpiWithContent = totalKpi + projectContentResult.totalEarnings;

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
    contentDetails: projectContentResult.details,
    bonusDetails: bonusResult.details,
    totalEarnings
  };
}
