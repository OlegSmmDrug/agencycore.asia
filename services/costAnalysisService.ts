import { ProjectExpense, CostAnalysis, CategoryCostBreakdown } from '../types';

export const costAnalysisService = {
  analyzeCosts(expense: ProjectExpense): CostAnalysis {
    const categories: CategoryCostBreakdown[] = [];

    const smmCategory = this.analyzeSmmCosts(expense);
    if (smmCategory.totalCost > 0) categories.push(smmCategory);

    const videoCategory = this.analyzeVideoCosts(expense);
    if (videoCategory.totalCost > 0) categories.push(videoCategory);

    const targetCategory = this.analyzeTargetCosts(expense);
    if (targetCategory.totalCost > 0) categories.push(targetCategory);

    const sitesCategory = this.analyzeSitesCosts(expense);
    if (sitesCategory.totalCost > 0) categories.push(sitesCategory);

    const salariesCategory = this.analyzeSalariesCosts(expense);
    if (salariesCategory.totalCost > 0) categories.push(salariesCategory);

    const modelsCategory = this.analyzeModelsCosts(expense);
    if (modelsCategory.totalCost > 0) categories.push(modelsCategory);

    const otherCategory = this.analyzeOtherCosts(expense);
    if (otherCategory.totalCost > 0) categories.push(otherCategory);

    const totalCost = categories.reduce((sum, cat) => sum + cat.totalCost, 0);

    categories.forEach(cat => {
      cat.percentage = totalCost > 0 ? (cat.totalCost / totalCost) * 100 : 0;
    });

    const topExpenseCategories = categories
      .map(cat => ({
        category: cat.categoryName,
        amount: cat.totalCost,
        percentage: cat.percentage
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const netProfit = expense.revenue - totalCost;
    const marginPercent = expense.revenue > 0 ? (netProfit / expense.revenue) * 100 : 0;

    return {
      totalCost,
      totalRevenue: expense.revenue,
      netProfit,
      marginPercent,
      categories,
      topExpenseCategories
    };
  },

  analyzeSmmCosts(expense: ProjectExpense): CategoryCostBreakdown {
    const items: CategoryCostBreakdown['items'] = [];

    if (expense.dynamicExpenses) {
      Object.entries(expense.dynamicExpenses).forEach(([_, item]) => {
        if (item.category === 'smm') {
          items.push({
            name: item.serviceName,
            count: item.count,
            rate: item.rate,
            cost: item.cost
          });
        }
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.cost, 0) + (expense.smmExpenses || 0);

    return {
      category: 'smm',
      categoryName: 'SMM',
      totalCost,
      percentage: 0,
      items
    };
  },

  analyzeVideoCosts(expense: ProjectExpense): CategoryCostBreakdown {
    const items: CategoryCostBreakdown['items'] = [];

    if (expense.dynamicExpenses) {
      Object.entries(expense.dynamicExpenses).forEach(([_, item]) => {
        if (item.category === 'video') {
          items.push({
            name: item.serviceName,
            count: item.count,
            rate: item.rate,
            cost: item.cost
          });
        }
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.cost, 0) + (expense.productionExpenses || 0);

    return {
      category: 'video',
      categoryName: 'Production',
      totalCost,
      percentage: 0,
      items
    };
  },

  analyzeTargetCosts(expense: ProjectExpense): CategoryCostBreakdown {
    const items: CategoryCostBreakdown['items'] = [];

    if (expense.dynamicExpenses) {
      Object.entries(expense.dynamicExpenses).forEach(([_, item]) => {
        if (item.category === 'target') {
          items.push({
            name: item.serviceName,
            count: item.count,
            rate: item.rate,
            cost: item.cost
          });
        }
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.cost, 0) + (expense.targetologistExpenses || 0);

    return {
      category: 'target',
      categoryName: 'Таргет',
      totalCost,
      percentage: 0,
      items
    };
  },

  analyzeSitesCosts(expense: ProjectExpense): CategoryCostBreakdown {
    const items: CategoryCostBreakdown['items'] = [];

    if (expense.dynamicExpenses) {
      Object.entries(expense.dynamicExpenses).forEach(([_, item]) => {
        if (item.category === 'sites') {
          items.push({
            name: item.serviceName,
            count: item.count,
            rate: item.rate,
            cost: item.cost
          });
        }
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

    return {
      category: 'sites',
      categoryName: 'Сайты',
      totalCost,
      percentage: 0,
      items
    };
  },

  analyzeSalariesCosts(expense: ProjectExpense): CategoryCostBreakdown {
    const items: CategoryCostBreakdown['items'] = [];

    if (expense.salaryCalculations) {
      Object.entries(expense.salaryCalculations).forEach(([_, calc]) => {
        items.push({
          name: `${calc.userName} (${calc.jobTitle})`,
          cost: calc.shareForThisProject
        });
      });
    }

    if (expense.pmExpenses > 0) {
      items.push({
        name: 'Проджект-менеджер (Legacy)',
        cost: expense.pmExpenses
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

    return {
      category: 'salaries',
      categoryName: 'Зарплаты',
      totalCost,
      percentage: 0,
      items
    };
  },

  analyzeModelsCosts(expense: ProjectExpense): CategoryCostBreakdown {
    const items: CategoryCostBreakdown['items'] = [];

    if (expense.modelsExpenses > 0) {
      items.push({
        name: 'Модели',
        cost: expense.modelsExpenses
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

    return {
      category: 'models',
      categoryName: 'Модели',
      totalCost,
      percentage: 0,
      items
    };
  },

  analyzeOtherCosts(expense: ProjectExpense): CategoryCostBreakdown {
    const items: CategoryCostBreakdown['items'] = [];

    if (expense.otherExpenses > 0) {
      items.push({
        name: expense.otherExpensesDescription || 'Прочие расходы',
        cost: expense.otherExpenses
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

    return {
      category: 'other',
      categoryName: 'Прочие',
      totalCost,
      percentage: 0,
      items
    };
  }
};
