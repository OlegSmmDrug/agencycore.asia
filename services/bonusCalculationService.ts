import { BonusRule, User, TaskStatus } from '../types';
import { bonusRuleService } from './bonusRuleService';
import { salesMetricsService } from './salesMetricsService';
import { retentionMetricsService } from './retentionMetricsService';
import { taskService } from './taskService';

export interface BonusCalculationDetail {
  ruleId: string;
  ruleName: string;
  metricSource: string;
  baseValue: number;
  conditionMet: boolean;
  rewardAmount: number;
  description: string;
}

export interface BonusCalculationResult {
  totalBonus: number;
  details: BonusCalculationDetail[];
  period: string;
}

async function getMetricValue(
  rule: BonusRule,
  user: User,
  month: string
): Promise<{ value: number; baseAmount: number }> {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 15);

  switch (rule.metricSource) {
    case 'sales_revenue': {
      const period = rule.calculationPeriod === 'monthly' ? 'month' : 'quarter';
      const metrics = await salesMetricsService.calculateManagerSales(user.id, period, date);
      return { value: metrics.totalRevenue, baseAmount: metrics.totalRevenue };
    }

    case 'project_retention': {
      const period = rule.calculationPeriod === 'monthly' ? 'month' : 'quarter';
      const metrics = await retentionMetricsService.calculateRetentionRate(user.id, period, date);
      const baseAmount = rule.applyToBase ? metrics.renewalRevenue : 1;
      console.log(`[Retention Debug] User: ${user.id}, Period: ${period}, Rate: ${metrics.retentionRate}%, Revenue: ${metrics.renewalRevenue}, Base: ${baseAmount}`);
      return { value: metrics.retentionRate, baseAmount };
    }

    case 'tasks_completed': {
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      const tasks = await taskService.getAll();
      const userTasks = tasks.filter(
        t =>
          t.assigneeId === user.id &&
          t.status === TaskStatus.DONE &&
          t.completedAt &&
          new Date(t.completedAt) >= startDate &&
          new Date(t.completedAt) <= endDate
      );
      return { value: userTasks.length, baseAmount: userTasks.length };
    }

    case 'manual_kpi':
    case 'cpl_efficiency':
    case 'custom_metric':
    default:
      return { value: 0, baseAmount: 0 };
  }
}

function evaluateCondition(
  rule: BonusRule,
  metricValue: number
): { conditionMet: boolean; rewardValue: number } {
  switch (rule.conditionType) {
    case 'always':
      return { conditionMet: true, rewardValue: rule.rewardValue };

    case 'threshold': {
      const threshold = rule.thresholdValue || 0;
      const operator = rule.thresholdOperator || '>=';
      let met = false;

      switch (operator) {
        case '>=':
          met = metricValue >= threshold;
          break;
        case '<=':
          met = metricValue <= threshold;
          break;
        case '>':
          met = metricValue > threshold;
          break;
        case '<':
          met = metricValue < threshold;
          break;
        case '=':
          met = metricValue === threshold;
          break;
      }

      return { conditionMet: met, rewardValue: met ? rule.rewardValue : 0 };
    }

    case 'tiered': {
      if (!rule.tieredConfig || rule.tieredConfig.length === 0) {
        return { conditionMet: false, rewardValue: 0 };
      }

      const tier = rule.tieredConfig.find(t => metricValue >= t.min && metricValue <= t.max);

      if (tier) {
        return { conditionMet: true, rewardValue: tier.reward };
      }

      return { conditionMet: false, rewardValue: 0 };
    }

    default:
      return { conditionMet: false, rewardValue: 0 };
  }
}

function calculateReward(
  rule: BonusRule,
  baseAmount: number,
  rewardValue: number
): number {
  if (rule.rewardType === 'percent') {
    return (baseAmount * rewardValue) / 100;
  } else {
    return rewardValue;
  }
}

export const bonusCalculationService = {
  async calculateBonusesForUser(user: User, month: string): Promise<BonusCalculationResult> {
    const userRules = await bonusRuleService.getByOwner(user.id, 'user');
    const jobTitleRules = await bonusRuleService.getByOwner(user.jobTitle, 'jobTitle');
    const allRules = [...userRules, ...jobTitleRules].filter(r => r.isActive);

    const details: BonusCalculationDetail[] = [];
    let totalBonus = 0;

    for (const rule of allRules) {
      try {
        const { value: metricValue, baseAmount } = await getMetricValue(rule, user, month);
        const { conditionMet, rewardValue } = evaluateCondition(rule, metricValue);
        const rewardAmount = conditionMet ? calculateReward(rule, baseAmount, rewardValue) : 0;

        const metricLabels: Record<string, string> = {
          sales_revenue: 'Выручка от продаж',
          project_retention: 'Retention Rate',
          manual_kpi: 'Ручной KPI',
          tasks_completed: 'Выполненные задачи',
          cpl_efficiency: 'CPL эффективность',
          custom_metric: 'Пользовательская метрика'
        };

        details.push({
          ruleId: rule.id,
          ruleName: rule.name,
          metricSource: metricLabels[rule.metricSource] || rule.metricSource,
          baseValue: metricValue,
          conditionMet,
          rewardAmount,
          description: rule.description || ''
        });

        if (conditionMet) {
          totalBonus += rewardAmount;
        }
      } catch (error) {
        console.error(`Error calculating bonus for rule ${rule.id}:`, error);
      }
    }

    return {
      totalBonus,
      details,
      period: month
    };
  },

  async calculateBonusesForAllUsers(users: User[], month: string): Promise<Map<string, BonusCalculationResult>> {
    const results = new Map<string, BonusCalculationResult>();

    for (const user of users) {
      try {
        const result = await this.calculateBonusesForUser(user, month);
        results.set(user.id, result);
      } catch (error) {
        console.error(`Error calculating bonuses for user ${user.id}:`, error);
      }
    }

    return results;
  }
};
