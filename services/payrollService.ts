import { User, Task, Project, SalaryScheme, TaskStatus, TaskType } from '../types';
import { bonusCalculationService, BonusCalculationDetail } from './bonusCalculationService';

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
  const userScheme = salarySchemes.find(
    s => s.targetType === 'user' && s.targetId === user.id
  );
  const jobTitleScheme = salarySchemes.find(
    s => s.targetType === 'jobTitle' && s.targetId === user.jobTitle
  );

  const scheme = userScheme || jobTitleScheme;
  const baseSalary = scheme?.baseSalary || user.salary || 0;

  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  const completedTasks = tasks.filter(t => {
    if (t.assigneeId !== user.id) return false;
    if (t.status !== TaskStatus.DONE) return false;
    if (!t.completedAt) return false;
    const completedDate = new Date(t.completedAt);
    return completedDate >= monthStart && completedDate <= monthEnd;
  });

  const details: KpiDetail[] = [];
  let totalKpi = 0;

  if (scheme) {
    for (const rule of scheme.kpiRules) {
      const tasksOfType = completedTasks.filter(t => t.type === rule.taskType);
      const count = tasksOfType.length;
      const total = count * rule.value;
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
  }

  let bonusResult;
  try {
    bonusResult = await bonusCalculationService.calculateBonusesForUser(user, month);
  } catch (error) {
    console.error('Error calculating bonuses:', error);
    bonusResult = { totalBonus: 0, details: [], period: month };
  }

  const totalEarnings = baseSalary + totalKpi + bonusResult.totalBonus;

  return {
    baseSalary,
    kpiEarned: totalKpi,
    bonusesEarned: bonusResult.totalBonus,
    details,
    bonusDetails: bonusResult.details,
    totalEarnings
  };
}
