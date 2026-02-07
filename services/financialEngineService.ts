import { supabase } from '../lib/supabase';
import { Transaction, Project, ProjectStatus } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface PnlResult {
  revenue: number;
  cogs: number;
  cogsFot: number;
  grossProfit: number;
  grossMargin: number;
  salaries: number;
  salariesRaw: number;
  salariesSource: 'transactions' | 'payroll' | 'none';
  marketing: number;
  office: number;
  otherExpenses: number;
  totalOpex: number;
  ebitda: number;
  taxes: number;
  netProfit: number;
  netMargin: number;
}

export interface PayrollBreakdown {
  fixSalary: number;
  kpiEarned: number;
  bonuses: number;
  penalties: number;
  total: number;
  byStatus: { draft: number; frozen: number; paid: number };
  employeeCount: number;
}

export interface PayrollUserBreakdown {
  userId: string;
  fixSalary: number;
  kpiEarned: number;
  bonuses: number;
  penalties: number;
  total: number;
  status: string;
}

export interface CogsBreakdown {
  smm: number;
  production: number;
  target: number;
  fot: number;
  kpiInCogs: number;
  models: number;
  other: number;
  total: number;
}

export interface CashFlowResult {
  openingBalance: number;
  operatingInflow: number;
  operatingOutflow: number;
  operatingNet: number;
  investingNet: number;
  financingNet: number;
  totalNet: number;
  closingBalance: number;
  arChange: number;
  apChange: number;
}

export interface BusinessHealthResult {
  score: number;
  level: 'healthy' | 'warning' | 'danger';
  label: string;
  factors: { name: string; status: 'good' | 'warning' | 'danger'; value: string; tip: string }[];
}

export interface LtvMetrics {
  avgLifespanMonths: number;
  avgMonthlyRevenue: number;
  ltv: number;
  cacToLtv: number;
}

export interface ArAgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface BurnRateResult {
  monthlyBurn: number;
  runway: number;
  currentCash: number;
}

export interface PipelineForecast {
  stage: string;
  count: number;
  weightedValue: number;
  confirmedValue: number;
  estimatedValue: number;
  probability: number;
}

function getMonthRange(month: string) {
  const start = month + '-01';
  const endDate = new Date(month + '-01');
  endDate.setMonth(endDate.getMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function filterTransactionsByMonth(transactions: Transaction[], month: string) {
  const { start, end } = getMonthRange(month);
  return (Array.isArray(transactions) ? transactions : []).filter(t => {
    const d = t.date?.slice(0, 10);
    return d && d >= start && d < end;
  });
}

export const financialEngineService = {
  calcPnl(
    transactions: Transaction[],
    payrollTotal: number,
    projectExpensesTotal: number,
    taxRate: number = 0.15,
    cogsFotTotal: number = 0
  ): PnlResult {
    const revenue = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

    const salariesFromTx = Math.abs(transactions.filter(t => t.category === 'Salary').reduce((s, t) => s + t.amount, 0));
    const marketingFromTx = Math.abs(transactions.filter(t => t.category === 'Marketing').reduce((s, t) => s + t.amount, 0));
    const officeFromTx = Math.abs(transactions.filter(t => t.category === 'Office').reduce((s, t) => s + t.amount, 0));
    const otherFromTx = Math.abs(transactions.filter(t => t.category === 'Other' && t.amount < 0).reduce((s, t) => s + t.amount, 0));

    const salariesRaw = Math.max(salariesFromTx, payrollTotal);
    const salariesSource: PnlResult['salariesSource'] =
      salariesFromTx === 0 && payrollTotal === 0 ? 'none' :
      payrollTotal >= salariesFromTx ? 'payroll' : 'transactions';

    const salaries = Math.max(0, salariesRaw - cogsFotTotal);
    const marketing = marketingFromTx;
    const office = officeFromTx;
    const otherExpenses = otherFromTx;

    const cogs = projectExpensesTotal;
    const cogsFot = cogsFotTotal;
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    const totalOpex = salaries + marketing + office + otherExpenses;
    const ebitda = grossProfit - totalOpex;
    const taxes = Math.max(0, ebitda * taxRate);
    const netProfit = ebitda - taxes;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue, cogs, cogsFot, grossProfit, grossMargin,
      salaries, salariesRaw, salariesSource, marketing, office, otherExpenses,
      totalOpex, ebitda, taxes, netProfit, netMargin
    };
  },

  calcPnlForMonth(
    allTransactions: Transaction[],
    month: string,
    payrollTotal: number,
    projectExpensesTotal: number,
    taxRate?: number,
    cogsFotTotal?: number
  ): PnlResult {
    const monthTx = filterTransactionsByMonth(allTransactions, month);
    return this.calcPnl(monthTx, payrollTotal, projectExpensesTotal, taxRate, cogsFotTotal);
  },

  calcCashFlow(
    transactions: Transaction[],
    month: string,
    prevMonthClosingBalance: number = 0
  ): CashFlowResult {
    const monthTx = filterTransactionsByMonth(transactions, month);

    const operatingInflow = monthTx
      .filter(t => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);

    const operatingOutflow = Math.abs(
      monthTx
        .filter(t => t.amount < 0)
        .reduce((s, t) => s + t.amount, 0)
    );

    const operatingNet = operatingInflow - operatingOutflow;
    const investingNet = 0;
    const financingNet = 0;
    const totalNet = operatingNet + investingNet + financingNet;
    const closingBalance = prevMonthClosingBalance + totalNet;

    return {
      openingBalance: prevMonthClosingBalance,
      operatingInflow,
      operatingOutflow,
      operatingNet,
      investingNet,
      financingNet,
      totalNet,
      closingBalance,
      arChange: 0,
      apChange: 0
    };
  },

  calcBusinessHealth(
    pnl: PnlResult,
    burnRate: BurnRateResult,
    fotPercent: number,
    lostRate: number,
    arTotal: number,
    revenue: number
  ): BusinessHealthResult {
    const factors: BusinessHealthResult['factors'] = [];

    const marginStatus = pnl.netMargin > 20 ? 'good' : pnl.netMargin > 5 ? 'warning' : 'danger';
    factors.push({
      name: 'Рентабельность',
      status: marginStatus,
      value: `${pnl.netMargin.toFixed(1)}%`,
      tip: pnl.netMargin > 20 ? 'Отличная маржинальность' : pnl.netMargin > 5 ? 'Маржинальность в допустимых пределах, но есть потенциал роста' : 'Критически низкая маржинальность, необходимо оптимизировать расходы'
    });

    const fotStatus = fotPercent < 35 ? 'good' : fotPercent < 50 ? 'warning' : 'danger';
    factors.push({
      name: 'ФОТ / Выручка',
      status: fotStatus,
      value: `${fotPercent.toFixed(1)}%`,
      tip: fotPercent < 35 ? 'ФОТ в норме для агентства (25-35%)' : fotPercent < 50 ? 'ФОТ выше нормы, рассмотрите оптимизацию команды или повышение цен' : 'ФОТ критически высок, бизнес работает на сотрудников, а не на прибыль'
    });

    const runwayStatus = burnRate.runway > 3 ? 'good' : burnRate.runway > 1 ? 'warning' : 'danger';
    factors.push({
      name: 'Запас прочности',
      status: runwayStatus,
      value: burnRate.monthlyBurn > 0 ? `${burnRate.runway.toFixed(1)} мес.` : 'N/A',
      tip: burnRate.runway > 3 ? 'Достаточный запас для стабильной работы' : burnRate.runway > 1 ? 'Рекомендуется увеличить финансовую подушку' : 'Критически низкий запас, срочно нужны поступления'
    });

    const lostStatus = lostRate < 20 ? 'good' : lostRate < 35 ? 'warning' : 'danger';
    factors.push({
      name: 'Потери клиентов',
      status: lostStatus,
      value: `${lostRate.toFixed(0)}%`,
      tip: lostRate < 20 ? 'Отток в пределах нормы' : lostRate < 35 ? 'Повышенный отток, проанализируйте причины на этапе Презентация' : 'Критический уровень потерь, необходимо срочно пересмотреть процесс продаж'
    });

    const arPercent = revenue > 0 ? (arTotal / revenue) * 100 : 0;
    const arStatus = arPercent < 30 ? 'good' : arPercent < 60 ? 'warning' : 'danger';
    factors.push({
      name: 'Дебиторская задолженность',
      status: arStatus,
      value: arTotal > 0 ? `${Math.round(arTotal).toLocaleString()} ₸` : 'Нет',
      tip: arPercent < 30 ? 'Дебиторка в пределах нормы' : arPercent < 60 ? 'Высокая дебиторка, ускорьте сбор платежей' : 'Критически высокая дебиторка, кассовый разрыв неизбежен'
    });

    const scores: number[] = factors.map(f => f.status === 'good' ? 2 : f.status === 'warning' ? 1 : 0);
    const total = scores.reduce((a, b) => a + b, 0);
    const maxScore = factors.length * 2;
    const score = Math.round((total / maxScore) * 100);

    const level = score >= 70 ? 'healthy' : score >= 40 ? 'warning' : 'danger';
    const label = level === 'healthy' ? 'Бизнес здоров' : level === 'warning' ? 'Требует внимания' : 'Критическая ситуация';

    return { score, level, label, factors };
  },

  async calcLtv(clients: any[], transactions: Transaction[]): Promise<LtvMetrics> {
    const activeClients = clients.filter(c =>
      c.status === 'In Work' || c.status === 'Won'
    );

    if (activeClients.length === 0) {
      return { avgLifespanMonths: 0, avgMonthlyRevenue: 0, ltv: 0, cacToLtv: 0 };
    }

    const clientRevenue: Record<string, { total: number; firstDate: string | null; lastDate: string | null }> = {};

    transactions.filter(t => t.amount > 0 && t.clientId).forEach(t => {
      if (!clientRevenue[t.clientId!]) {
        clientRevenue[t.clientId!] = { total: 0, firstDate: null, lastDate: null };
      }
      const entry = clientRevenue[t.clientId!];
      entry.total += t.amount;
      if (!entry.firstDate || t.date < entry.firstDate) entry.firstDate = t.date;
      if (!entry.lastDate || t.date > entry.lastDate) entry.lastDate = t.date;
    });

    let totalLifespan = 0;
    let totalRevenue = 0;
    let clientsWithData = 0;

    for (const client of activeClients) {
      const data = clientRevenue[client.id];
      if (data && data.firstDate && data.lastDate) {
        const first = new Date(data.firstDate);
        const last = new Date(data.lastDate);
        const months = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 30));
        totalLifespan += months;
        totalRevenue += data.total;
        clientsWithData++;
      }
    }

    if (clientsWithData === 0) {
      return { avgLifespanMonths: 0, avgMonthlyRevenue: 0, ltv: 0, cacToLtv: 0 };
    }

    const avgLifespanMonths = totalLifespan / clientsWithData;
    const avgMonthlyRevenue = totalRevenue / totalLifespan;
    const ltv = avgMonthlyRevenue * avgLifespanMonths;

    const marketingSpend = Math.abs(
      transactions.filter(t => t.category === 'Marketing').reduce((s, t) => s + t.amount, 0)
    );
    const cac = activeClients.length > 0 && marketingSpend > 0
      ? marketingSpend / activeClients.length
      : 0;
    const cacToLtv = cac > 0 ? ltv / cac : 0;

    return { avgLifespanMonths, avgMonthlyRevenue, ltv, cacToLtv };
  },

  calcAccountsReceivable(
    clients: any[],
    transactions: Transaction[]
  ): { total: number; buckets: ArAgingBucket[]; debtors: { name: string; debt: number; daysSinceLastPayment: number }[] } {
    const now = new Date();
    const clientPaid: Record<string, { total: number; lastDate: string | null }> = {};

    transactions.filter(t => t.amount > 0 && t.clientId).forEach(t => {
      if (!clientPaid[t.clientId!]) clientPaid[t.clientId!] = { total: 0, lastDate: null };
      clientPaid[t.clientId!].total += t.amount;
      if (!clientPaid[t.clientId!].lastDate || t.date > clientPaid[t.clientId!].lastDate!) {
        clientPaid[t.clientId!].lastDate = t.date;
      }
    });

    const debtors: { name: string; debt: number; daysSinceLastPayment: number }[] = [];
    const activeClients = clients.filter(c =>
      c.status === 'In Work' || c.status === 'Won' || c.status === 'Contract Signing'
    );

    let total = 0;
    const bucketRanges = [
      { label: '0-30 дней', min: 0, max: 30, amount: 0, count: 0 },
      { label: '31-60 дней', min: 31, max: 60, amount: 0, count: 0 },
      { label: '61-90 дней', min: 61, max: 90, amount: 0, count: 0 },
      { label: '90+ дней', min: 91, max: Infinity, amount: 0, count: 0 },
    ];

    for (const client of activeClients) {
      const budget = Number(client.budget) || 0;
      const paid = clientPaid[client.id]?.total || 0;
      const debt = budget - paid;

      if (debt > 0) {
        const lastPayDate = clientPaid[client.id]?.lastDate;
        const daysSince = lastPayDate
          ? Math.floor((now.getTime() - new Date(lastPayDate).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        total += debt;
        debtors.push({ name: client.name || client.company || 'Без имени', debt, daysSinceLastPayment: daysSince });

        for (const bucket of bucketRanges) {
          if (daysSince >= bucket.min && daysSince <= bucket.max) {
            bucket.amount += debt;
            bucket.count++;
            break;
          }
        }
      }
    }

    debtors.sort((a, b) => b.debt - a.debt);

    return {
      total,
      buckets: bucketRanges.map(b => ({ label: b.label, amount: b.amount, count: b.count })),
      debtors: debtors.slice(0, 10)
    };
  },

  calcBurnRate(transactions: Transaction[]): BurnRateResult {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentExpenses = transactions.filter(t => {
      const d = t.date?.slice(0, 10);
      return d && t.amount < 0 && new Date(d) >= threeMonthsAgo;
    });

    const totalExpenses = Math.abs(recentExpenses.reduce((s, t) => s + t.amount, 0));
    const monthlyBurn = totalExpenses / 3;

    const currentCash = transactions.reduce((s, t) => s + t.amount, 0);
    const runway = monthlyBurn > 0 ? currentCash / monthlyBurn : Infinity;

    return { monthlyBurn, runway: Math.max(0, runway), currentCash };
  },

  calcPipelineForecast(clients: any[], avgDealSizeFallback?: number): PipelineForecast[] {
    const stageWeights: Record<string, number> = {
      'New Lead': 0.05,
      'Contact Established': 0.15,
      'Presentation': 0.30,
      'Contract Signing': 0.60,
    };

    const activeClients = clients.filter(c => c.status === 'In Work' || c.status === 'Won');
    const budgets = activeClients.map(c => Number(c.budget) || 0).filter(b => b > 0);
    const avgDealSize = avgDealSizeFallback || (budgets.length > 0 ? budgets.reduce((a, b) => a + b, 0) / budgets.length : 0);

    const stages = Object.entries(stageWeights).map(([stage, probability]) => {
      const stageClients = clients.filter(c => c.status === stage);
      let confirmedValue = 0;
      let estimatedValue = 0;

      stageClients.forEach(c => {
        const budget = Number(c.budget) || 0;
        if (budget > 0) {
          confirmedValue += budget;
        } else {
          estimatedValue += avgDealSize;
        }
      });

      const totalBudget = confirmedValue + estimatedValue;

      return {
        stage,
        count: stageClients.length,
        weightedValue: totalBudget * probability,
        confirmedValue: confirmedValue * probability,
        estimatedValue: estimatedValue * probability,
        probability: probability * 100,
      };
    });

    return stages;
  },

  calcSalesCycle(clients: any[]): { avgDays: number; byStage: { stage: string; avgDays: number }[] } {
    const wonClients = clients.filter(c =>
      c.status === 'In Work' || c.status === 'Won'
    );

    if (wonClients.length === 0) return { avgDays: 0, byStage: [] };

    let totalDays = 0;
    let counted = 0;

    for (const c of wonClients) {
      if (c.createdAt) {
        const created = new Date(c.createdAt);
        const updated = c.updatedAt ? new Date(c.updatedAt) : new Date();
        const days = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0 && days < 365) {
          totalDays += days;
          counted++;
        }
      }
    }

    return {
      avgDays: counted > 0 ? Math.round(totalDays / counted) : 0,
      byStage: []
    };
  },

  async loadPayrollForMonth(month: string): Promise<number> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return 0;

    const { data } = await supabase
      .from('payroll_records')
      .select('fix_salary, calculated_kpi, manual_bonus, manual_penalty')
      .eq('organization_id', orgId)
      .eq('month', month)
      .in('status', ['FROZEN', 'PAID']);

    return (data || []).reduce((sum, r) =>
      sum + (Number(r.fix_salary) || 0) + (Number(r.calculated_kpi) || 0) +
      (Number(r.manual_bonus) || 0) - (Number(r.manual_penalty) || 0), 0);
  },

  async loadProjectExpensesForMonth(month: string, projects: Project[]): Promise<number> {
    const activeProjectIds = projects
      .filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED)
      .map(p => p.id);

    if (activeProjectIds.length === 0) return 0;

    const { data } = await supabase
      .from('project_expenses')
      .select('total_expenses')
      .in('project_id', activeProjectIds)
      .eq('month', month);

    return (data || []).reduce((sum, r) => sum + (Number(r.total_expenses) || 0), 0);
  },

  async loadPayrollCostPerUser(month: string): Promise<Record<string, number>> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return {};

    const { data } = await supabase
      .from('payroll_records')
      .select('user_id, fix_salary, calculated_kpi, manual_bonus, manual_penalty')
      .eq('organization_id', orgId)
      .eq('month', month);

    const result: Record<string, number> = {};
    (data || []).forEach(r => {
      const cost = (Number(r.fix_salary) || 0) + (Number(r.calculated_kpi) || 0) +
        (Number(r.manual_bonus) || 0) - (Number(r.manual_penalty) || 0);
      result[r.user_id] = (result[r.user_id] || 0) + cost;
    });
    return result;
  },

  async loadPayrollBreakdown(month: string): Promise<PayrollBreakdown> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return { fixSalary: 0, kpiEarned: 0, bonuses: 0, penalties: 0, total: 0, byStatus: { draft: 0, frozen: 0, paid: 0 }, employeeCount: 0 };

    const { data } = await supabase
      .from('payroll_records')
      .select('user_id, fix_salary, calculated_kpi, manual_bonus, manual_penalty, status')
      .eq('organization_id', orgId)
      .eq('month', month);

    if (!data || data.length === 0) {
      return { fixSalary: 0, kpiEarned: 0, bonuses: 0, penalties: 0, total: 0, byStatus: { draft: 0, frozen: 0, paid: 0 }, employeeCount: 0 };
    }

    const uniqueUsers = new Set(data.map(r => r.user_id));
    let fixSalary = 0, kpiEarned = 0, bonuses = 0, penalties = 0;
    const byStatus = { draft: 0, frozen: 0, paid: 0 };

    data.forEach(r => {
      const fix = Number(r.fix_salary) || 0;
      const kpi = Number(r.calculated_kpi) || 0;
      const bonus = Number(r.manual_bonus) || 0;
      const penalty = Number(r.manual_penalty) || 0;
      const rowTotal = fix + kpi + bonus - penalty;

      fixSalary += fix;
      kpiEarned += kpi;
      bonuses += bonus;
      penalties += penalty;

      const st = (r.status || 'DRAFT').toUpperCase();
      if (st === 'PAID') byStatus.paid += rowTotal;
      else if (st === 'FROZEN') byStatus.frozen += rowTotal;
      else byStatus.draft += rowTotal;
    });

    return { fixSalary, kpiEarned, bonuses, penalties, total: fixSalary + kpiEarned + bonuses - penalties, byStatus, employeeCount: uniqueUsers.size };
  },

  async loadPayrollBreakdownPerUser(month: string): Promise<PayrollUserBreakdown[]> {
    const orgId = getCurrentOrganizationId();
    if (!orgId) return [];

    const { data } = await supabase
      .from('payroll_records')
      .select('user_id, fix_salary, calculated_kpi, manual_bonus, manual_penalty, status')
      .eq('organization_id', orgId)
      .eq('month', month);

    return (data || []).map(r => ({
      userId: r.user_id,
      fixSalary: Number(r.fix_salary) || 0,
      kpiEarned: Number(r.calculated_kpi) || 0,
      bonuses: Number(r.manual_bonus) || 0,
      penalties: Number(r.manual_penalty) || 0,
      total: (Number(r.fix_salary) || 0) + (Number(r.calculated_kpi) || 0) + (Number(r.manual_bonus) || 0) - (Number(r.manual_penalty) || 0),
      status: r.status || 'DRAFT',
    }));
  },

  async loadCogsBreakdown(month: string, projects: Project[]): Promise<CogsBreakdown> {
    const activeProjectIds = projects
      .filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED)
      .map(p => p.id);

    if (activeProjectIds.length === 0) return { smm: 0, production: 0, target: 0, fot: 0, kpiInCogs: 0, models: 0, other: 0, total: 0 };

    const { data } = await supabase
      .from('project_expenses')
      .select('smm_expenses, production_expenses, targetologist_expenses, fot_expenses, models_expenses, other_expenses, total_expenses, dynamic_expenses')
      .in('project_id', activeProjectIds)
      .eq('month', month);

    if (!data || data.length === 0) return { smm: 0, production: 0, target: 0, fot: 0, kpiInCogs: 0, models: 0, other: 0, total: 0 };

    const result = { smm: 0, production: 0, target: 0, fot: 0, kpiInCogs: 0, models: 0, other: 0, total: 0 };
    data.forEach(r => {
      result.smm += Number(r.smm_expenses) || 0;
      result.production += Number(r.production_expenses) || 0;
      result.target += Number(r.targetologist_expenses) || 0;
      result.fot += Number(r.fot_expenses) || 0;
      result.models += Number(r.models_expenses) || 0;
      result.other += Number(r.other_expenses) || 0;
      result.total += Number(r.total_expenses) || 0;

      if (r.dynamic_expenses && typeof r.dynamic_expenses === 'object') {
        for (const key in r.dynamic_expenses) {
          if (key.startsWith('task_')) {
            const item = (r.dynamic_expenses as Record<string, any>)[key];
            if (item && typeof item === 'object' && 'cost' in item) {
              result.kpiInCogs += Number(item.cost) || 0;
            }
          }
        }
      }
    });
    return result;
  },

  calcPayrollTax(grossPayroll: number, taxRate: number = 0.155): number {
    return Math.round(grossPayroll * taxRate);
  },

  isSalesRole(jobTitle: string | undefined): boolean {
    if (!jobTitle) return false;
    const lower = jobTitle.toLowerCase();
    return lower.includes('sales') ||
      lower.includes('продаж') ||
      lower.includes('аккаунт') ||
      lower.includes('коммерческ') ||
      lower === 'ceo' ||
      lower === 'директор';
  },

  async calcMarketingCAC(clients: any[], transactions: Transaction[]): Promise<{ cac: number; totalSpend: number; source: 'marketing_spend' | 'transactions' }> {
    const orgId = getCurrentOrganizationId();
    const activeClients = clients.filter(c => c.status === 'In Work' || c.status === 'Won' || c.status === 'Contract Signing');
    if (activeClients.length === 0) return { cac: 0, totalSpend: 0, source: 'transactions' };

    if (orgId) {
      const { data } = await supabase
        .from('marketing_spend')
        .select('amount')
        .eq('organization_id', orgId);

      const mktSpend = (data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      if (mktSpend > 0) {
        return { cac: mktSpend / activeClients.length, totalSpend: mktSpend, source: 'marketing_spend' };
      }
    }

    const txSpend = Math.abs(transactions.filter(t => t.category === 'Marketing').reduce((s, t) => s + (t.amount || 0), 0));
    return { cac: txSpend > 0 ? txSpend / activeClients.length : 0, totalSpend: txSpend, source: 'transactions' };
  }
};
