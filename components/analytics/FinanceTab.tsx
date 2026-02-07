import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Transaction, Project, ProjectStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { financialPlanService, FinancialPlan } from '../../services/financialPlanService';
import { financialEngineService, CashFlowResult, BurnRateResult, PayrollBreakdown, CogsBreakdown } from '../../services/financialEngineService';
import { getCurrentOrganizationId } from '../../utils/organizationContext';

interface FinanceTabProps {
  transactions: Transaction[];
  projects: Project[];
  onNavigateToTab?: (tab: string) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#06b6d4'];

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
  LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
  VALUE: "text-2xl font-black text-slate-900 tracking-tighter"
};

const formatCurrency = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const TAX_RATE_OPTIONS = [
  { label: '3% (ИП упрощ.)', value: 0.03 },
  { label: '10% (КПН)', value: 0.10 },
  { label: '15% (стандарт)', value: 0.15 },
  { label: '20%', value: 0.20 },
];

const FinanceTab: React.FC<FinanceTabProps> = ({ transactions, projects, onNavigateToTab }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [payrollTotal, setPayrollTotal] = useState(0);
  const [projectExpensesTotal, setProjectExpensesTotal] = useState(0);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({ revenue: 0, payroll: 0, expenses: 0, netProfit: 0 });
  const [loading, setLoading] = useState(false);
  const [prevPayrollTotal, setPrevPayrollTotal] = useState(0);
  const [prevProjectExpensesTotal, setPrevProjectExpensesTotal] = useState(0);
  const [taxRate, setTaxRate] = useState(0.15);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  const [payrollBreakdown, setPayrollBreakdown] = useState<PayrollBreakdown | null>(null);
  const [cogsBreakdown, setCogsBreakdown] = useState<CogsBreakdown | null>(null);
  const [prevCogsBreakdown, setPrevCogsBreakdown] = useState<CogsBreakdown | null>(null);
  const [showFotDetail, setShowFotDetail] = useState(false);
  const [showCogsDetail, setShowCogsDetail] = useState(false);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + (direction === 'prev' ? -1 : 1));
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const prevMonth = useMemo(() => {
    const d = new Date(selectedMonth + '-01');
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }, [selectedMonth]);

  const monthLabel = useMemo(() => {
    return new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const orgId = getCurrentOrganizationId();
      if (!orgId) { setLoading(false); return; }

      const [planData, breakdown, cogs, prevCogs] = await Promise.all([
        financialPlanService.getByMonth(selectedMonth),
        financialEngineService.loadPayrollBreakdown(selectedMonth),
        financialEngineService.loadCogsBreakdown(selectedMonth, projects),
        financialEngineService.loadCogsBreakdown(prevMonth, projects),
      ]);

      setPlan(planData);
      setPayrollBreakdown(breakdown);
      setCogsBreakdown(cogs);
      setPrevCogsBreakdown(prevCogs);

      if (planData) {
        setPlanForm({
          revenue: planData.plannedRevenue,
          payroll: planData.plannedPayroll || 0,
          expenses: planData.plannedExpenses,
          netProfit: planData.plannedNetProfit,
        });
      } else {
        setPlanForm({ revenue: 0, payroll: 0, expenses: 0, netProfit: 0 });
      }

      const { data: payrollData } = await supabase
        .from('payroll_records')
        .select('month, fix_salary, calculated_kpi, manual_bonus, manual_penalty, status')
        .eq('organization_id', orgId)
        .in('month', [selectedMonth, prevMonth])
        .in('status', ['FROZEN', 'PAID']);

      const calcPayroll = (records: typeof payrollData, m: string) =>
        (records || []).filter(r => r.month === m).reduce((sum, r) =>
          sum + (Number(r.fix_salary) || 0) + (Number(r.calculated_kpi) || 0) +
          (Number(r.manual_bonus) || 0) - (Number(r.manual_penalty) || 0), 0);

      setPayrollTotal(calcPayroll(payrollData, selectedMonth));
      setPrevPayrollTotal(calcPayroll(payrollData, prevMonth));

      const activeProjectIds = projects
        .filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED)
        .map(p => p.id);

      if (activeProjectIds.length > 0) {
        const { data: expData } = await supabase
          .from('project_expenses')
          .select('month, total_expenses')
          .in('project_id', activeProjectIds)
          .in('month', [selectedMonth, prevMonth]);

        const calcExp = (records: typeof expData, m: string) =>
          (records || []).filter(r => r.month === m).reduce((sum, r) => sum + (Number(r.total_expenses) || 0), 0);

        setProjectExpensesTotal(calcExp(expData, selectedMonth));
        setPrevProjectExpensesTotal(calcExp(expData, prevMonth));
      } else {
        setProjectExpensesTotal(0);
        setPrevProjectExpensesTotal(0);
      }

      setLoading(false);
    };

    loadData();
  }, [selectedMonth, projects]);

  const monthTransactions = useMemo(() => {
    const start = selectedMonth + '-01';
    const endDate = new Date(selectedMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().slice(0, 10);
    return (Array.isArray(transactions) ? transactions : []).filter(t => {
      const d = t.date?.slice(0, 10);
      return d && d >= start && d < end;
    });
  }, [transactions, selectedMonth]);

  const prevMonthTransactions = useMemo(() => {
    const start = prevMonth + '-01';
    const endDate = new Date(prevMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().slice(0, 10);
    return (Array.isArray(transactions) ? transactions : []).filter(t => {
      const d = t.date?.slice(0, 10);
      return d && d >= start && d < end;
    });
  }, [transactions, prevMonth]);

  const cogsFot = (cogsBreakdown?.fot || 0) + (cogsBreakdown?.kpiInCogs || 0);
  const prevCogsFot = (prevCogsBreakdown?.fot || 0) + (prevCogsBreakdown?.kpiInCogs || 0);

  const pnl = useMemo(() =>
    financialEngineService.calcPnl(monthTransactions, payrollTotal, projectExpensesTotal, taxRate, cogsFot),
    [monthTransactions, payrollTotal, projectExpensesTotal, taxRate, cogsFot]
  );

  const prevPnl = useMemo(() =>
    financialEngineService.calcPnl(prevMonthTransactions, prevPayrollTotal, prevProjectExpensesTotal, taxRate, prevCogsFot),
    [prevMonthTransactions, prevPayrollTotal, prevProjectExpensesTotal, taxRate, prevCogsFot]
  );

  const cashFlow = useMemo(() =>
    financialEngineService.calcCashFlow(transactions, selectedMonth, 0),
    [transactions, selectedMonth]
  );

  const burnRate = useMemo(() =>
    financialEngineService.calcBurnRate(transactions),
    [transactions]
  );

  const expenseStructure = useMemo(() => [
    { name: 'Себестоимость (COGS)', value: pnl.cogs },
    { name: 'ФОТ (Зарплаты)', value: pnl.salaries },
    { name: 'Маркетинг', value: pnl.marketing },
    { name: 'Офис и ПО', value: pnl.office },
    { name: 'Прочее', value: pnl.otherExpenses },
  ].filter(e => e.value > 0), [pnl]);

  const planFact = useMemo(() => {
    const items = [
      { name: 'Выручка', plan: plan?.plannedRevenue || 0, fact: pnl.revenue },
      { name: 'ФОТ', plan: plan?.plannedPayroll || planForm.payroll || 0, fact: pnl.salariesRaw },
      { name: 'Чистая прибыль', plan: plan?.plannedNetProfit || 0, fact: pnl.netProfit },
    ];
    return items;
  }, [plan, pnl, planForm]);

  const getChangePercent = (current: number, prev: number) => {
    if (prev === 0) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
  };

  const revenuePlanPercent = useMemo(() => {
    if (!plan?.plannedRevenue || plan.plannedRevenue === 0) return null;
    return ((pnl.revenue / plan.plannedRevenue) - 1) * 100;
  }, [pnl.revenue, plan]);

  const fotPlanPercent = useMemo(() => {
    const plannedPayroll = plan?.plannedPayroll || 0;
    if (plannedPayroll === 0) return null;
    return ((pnl.salariesRaw / plannedPayroll) - 1) * 100;
  }, [pnl.salariesRaw, plan]);

  const revenueVsPrev = getChangePercent(pnl.revenue, prevPnl.revenue);

  const handleSavePlan = useCallback(async () => {
    await financialPlanService.upsert(selectedMonth, {
      plannedRevenue: planForm.revenue,
      plannedPayroll: planForm.payroll,
      plannedExpenses: planForm.expenses,
      plannedNetProfit: planForm.netProfit,
    });
    const updated = await financialPlanService.getByMonth(selectedMonth);
    setPlan(updated);
    setEditingPlan(false);
  }, [selectedMonth, planForm]);

  const totalAllExpenses = pnl.cogs + pnl.totalOpex;

  const fotPercent = pnl.revenue > 0 ? (pnl.salariesRaw / pnl.revenue) * 100 : 0;

  const insights = useMemo(() => {
    const items: { type: 'success' | 'warning' | 'danger'; title: string; text: string }[] = [];

    if (pnl.revenue > 0 && pnl.netMargin < 5) {
      items.push({
        type: 'danger',
        title: `Рентабельность критически низкая: ${pnl.netMargin.toFixed(1)}%`,
        text: 'Для агентства рекомендуемая чистая маржа -- 15-25%. Пересмотрите ценообразование услуг или оптимизируйте операционные расходы.'
      });
    } else if (pnl.revenue > 0 && pnl.netMargin < 15) {
      items.push({
        type: 'warning',
        title: `Маржинальность ниже целевой: ${pnl.netMargin.toFixed(1)}%`,
        text: 'Целевой показатель для digital-агентств 15-25%. Проверьте, какие проекты тянут маржу вниз через вкладку Юнит-экономика.'
      });
    }

    if (fotPercent > 50) {
      items.push({
        type: 'danger',
        title: `ФОТ = ${fotPercent.toFixed(0)}% от выручки`,
        text: 'Бизнес работает преимущественно на зарплаты. Норма для агентства -- 25-35%. Рассмотрите оптимизацию штата или повышение тарифов.'
      });
    } else if (fotPercent > 35 && pnl.revenue > 0) {
      items.push({
        type: 'warning',
        title: `ФОТ = ${fotPercent.toFixed(0)}% от выручки (норма 25-35%)`,
        text: 'Фонд оплаты труда выше рекомендуемого. Проверьте загрузку команды во вкладке "Команда и HR".'
      });
    }

    if (payrollBreakdown && payrollBreakdown.byStatus.draft > 0) {
      items.push({
        type: 'warning',
        title: `Незафиксированный ФОТ: ${formatCurrency(payrollBreakdown.byStatus.draft)}`,
        text: `${formatCurrency(payrollBreakdown.byStatus.draft)} находится в статусе "Черновик". Зафиксируйте расчет зарплат в модуле "Расчет Зарплат" для корректного учета.`
      });
    }

    if (fotPlanPercent !== null && fotPlanPercent > 20) {
      items.push({
        type: 'danger',
        title: `ФОТ превышает план на ${fotPlanPercent.toFixed(0)}%`,
        text: `Факт: ${formatCurrency(pnl.salariesRaw)} vs План: ${formatCurrency(plan?.plannedPayroll || 0)}. Проверьте, какие KPI-выплаты или бонусы вызвали перерасход.`
      });
    }

    if (plan && plan.plannedRevenue > 0) {
      const planDelta = ((pnl.revenue / plan.plannedRevenue) - 1) * 100;
      if (planDelta < -20) {
        items.push({
          type: 'danger',
          title: `Выручка отстает от плана на ${Math.abs(planDelta).toFixed(0)}%`,
          text: `Факт: ${formatCurrency(pnl.revenue)} vs План: ${formatCurrency(plan.plannedRevenue)}. Пересмотрите план продаж или усильте лидогенерацию.`
        });
      } else if (planDelta < -5) {
        items.push({
          type: 'warning',
          title: `Выручка ниже плана на ${Math.abs(planDelta).toFixed(0)}%`,
          text: `До конца месяца нужно привлечь еще ${formatCurrency(plan.plannedRevenue - pnl.revenue)} для выполнения плана.`
        });
      }
    }

    if (cashFlow.operatingOutflow > cashFlow.operatingInflow && cashFlow.operatingInflow > 0) {
      items.push({
        type: 'danger',
        title: 'Отрицательный денежный поток в этом месяце',
        text: `Расход (${formatCurrency(cashFlow.operatingOutflow)}) превышает поступления (${formatCurrency(cashFlow.operatingInflow)}). Проверьте дебиторку и ускорьте сбор платежей.`
      });
    }

    if (burnRate.runway < 2 && burnRate.monthlyBurn > 0) {
      items.push({
        type: 'danger',
        title: `Runway всего ${burnRate.runway.toFixed(1)} мес.`,
        text: `При текущем burn rate (${formatCurrency(burnRate.monthlyBurn)}/мес.) и остатке ${formatCurrency(burnRate.currentCash)} денег хватит менее чем на 2 месяца.`
      });
    }

    if (cogsFot > 0 && pnl.salariesRaw > 0) {
      const salariesFromTx = Math.abs(monthTransactions.filter(t => t.category === 'Salary').reduce((s, t) => s + t.amount, 0));
      if (salariesFromTx > 0 || payrollTotal > 0) {
        const fotPart = cogsBreakdown?.fot || 0;
        const kpiPart = cogsBreakdown?.kpiInCogs || 0;
        const details = [
          fotPart > 0 ? `оклады: ${formatCurrency(fotPart)}` : '',
          kpiPart > 0 ? `KPI за задачи: ${formatCurrency(kpiPart)}` : '',
        ].filter(Boolean).join(', ');
        items.push({
          type: 'warning',
          title: `ФОТ дедупликация: ${formatCurrency(cogsFot)} вычтено`,
          text: `Зарплаты сотрудников (${formatCurrency(pnl.salariesRaw)}) уже частично учтены в себестоимости проектов (${details}). Система автоматически вычла эту сумму из строки ФОТ, чтобы избежать двойного учета.`
        });
      }
    }

    if (cogsFot > pnl.salariesRaw && pnl.salariesRaw > 0) {
      items.push({
        type: 'danger',
        title: `Расхождение: ФОТ в себестоимости (${formatCurrency(cogsFot)}) превышает общий ФОТ (${formatCurrency(pnl.salariesRaw)})`,
        text: 'ФОТ, распределенный по проектам, больше фактического фонда оплаты труда. Проверьте корректность зарплатных схем и расчетов себестоимости проектов.'
      });
    }

    if (pnl.revenue > 0 && pnl.netMargin > 20 && items.length === 0) {
      items.push({
        type: 'success',
        title: `Финансовое здоровье в норме`,
        text: `Маржинальность ${pnl.netMargin.toFixed(1)}%, ФОТ ${fotPercent.toFixed(0)}%. Показатели в рамках целевых значений.`
      });
    }

    return items;
  }, [pnl, plan, cashFlow, burnRate, payrollBreakdown, fotPercent, fotPlanPercent, cogsFot, monthTransactions, payrollTotal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-slate-600 font-semibold">Загрузка P&L за {monthLabel}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-slate-900">P&L -- Финансы</h3>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1">
            Отчет о прибылях и убытках за {monthLabel}
          </p>
        </div>
        <MonthNavigator selectedMonth={selectedMonth} onNavigate={navigateMonth} />
      </div>

      {insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((item, i) => (
            <InsightCard key={i} type={item.type} title={item.title} text={item.text} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Выручка" value={formatCurrency(pnl.revenue)}>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {revenuePlanPercent !== null && (
              <Badge positive={revenuePlanPercent >= 0} label={`${revenuePlanPercent >= 0 ? '↑' : '↓'} ${Math.abs(revenuePlanPercent).toFixed(0)}% к плану`} />
            )}
            {revenueVsPrev !== null && (
              <Badge positive={revenueVsPrev >= 0} label={`${revenueVsPrev >= 0 ? '↑' : '↓'} ${Math.abs(revenueVsPrev).toFixed(0)}% MoM`} alt />
            )}
          </div>
        </KpiCard>

        <div className={UI.CARD}>
          <div className="group relative">
            <p className={UI.LABEL}>EBITDA <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help">?</span></p>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-64 shadow-xl">
              Прибыль до вычета налогов и амортизации. Показывает, сколько зарабатывает бизнес от операционной деятельности.
            </div>
          </div>
          <p className={`text-2xl font-black tracking-tighter ${pnl.ebitda >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
            {formatCurrency(pnl.ebitda)}
          </p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
            Выручка - Себестоимость - Расходы
          </p>
        </div>

        <div className={UI.CARD}>
          <div className="group relative">
            <p className={UI.LABEL}>Рентабельность <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help">?</span></p>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-64 shadow-xl">
              Какой % от выручки остается в прибыли. Выше 20% -- отлично, 10-20% -- хорошо, ниже 10% -- требует внимания.
            </div>
          </div>
          <p className={`text-2xl font-black tracking-tighter ${pnl.netMargin > 20 ? 'text-emerald-500' : pnl.netMargin > 0 ? 'text-blue-500' : 'text-rose-500'}`}>
            {pnl.netMargin.toFixed(1)}%
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3">
            <div
              className={`h-full rounded-full transition-all ${pnl.netMargin > 20 ? 'bg-emerald-500' : pnl.netMargin > 0 ? 'bg-blue-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, pnl.netMargin))}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1.5">Чистая маржа = Прибыль / Выручка</p>
        </div>

        <div className={UI.CARD}>
          <div className="flex items-start justify-between">
            <div>
              <p className={UI.LABEL}>Чистая прибыль</p>
              <p className={`text-2xl font-black tracking-tighter ${pnl.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(pnl.netProfit)}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTaxSettings(!showTaxSettings)}
                className="text-[9px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Налог: {(taxRate * 100).toFixed(0)}%
              </button>
              {showTaxSettings && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-2 min-w-[160px]">
                  {TAX_RATE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setTaxRate(opt.value); setShowTaxSettings(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${taxRate === opt.value ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
            EBITDA - налог ({(taxRate * 100).toFixed(0)}%)
          </p>
        </div>
      </div>

      <div className={UI.CARD}>
        <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
          <div className="w-1 h-4 bg-slate-900 rounded-full" /> Каскад P&L
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="pb-4 pr-4">Статья</th>
                <th className="pb-4 text-right">Сумма</th>
                <th className="pb-4 text-right">% от выручки</th>
                <th className="pb-4 text-right">План</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <PnlRow label="Выручка" value={pnl.revenue} revenue={pnl.revenue} planValue={plan?.plannedRevenue} bold />
              <PnlRow label="Себестоимость (COGS)" value={-pnl.cogs} revenue={pnl.revenue} sub
                expandable={!!cogsBreakdown && cogsBreakdown.total > 0}
                expanded={showCogsDetail}
                onToggle={() => setShowCogsDetail(!showCogsDetail)}
                onClick={() => onNavigateToTab?.('unit')} />
              {showCogsDetail && cogsBreakdown && (
                <>
                  {cogsBreakdown.smm > 0 && <PnlRow label="SMM-контент" value={-cogsBreakdown.smm} revenue={pnl.revenue} indent />}
                  {cogsBreakdown.production > 0 && <PnlRow label="Продакшен (видео/фото)" value={-cogsBreakdown.production} revenue={pnl.revenue} indent />}
                  {cogsBreakdown.target > 0 && <PnlRow label="Таргетинг" value={-cogsBreakdown.target} revenue={pnl.revenue} indent />}
                  {cogsBreakdown.fot > 0 && <PnlRow label="ФОТ (доля на проекты)" value={-cogsBreakdown.fot} revenue={pnl.revenue} indent />}
                  {cogsBreakdown.models > 0 && <PnlRow label="Модели" value={-cogsBreakdown.models} revenue={pnl.revenue} indent />}
                  {cogsBreakdown.other > 0 && <PnlRow label="Прочее" value={-cogsBreakdown.other} revenue={pnl.revenue} indent />}
                </>
              )}
              <PnlRow label="Валовая прибыль" value={pnl.grossProfit} revenue={pnl.revenue} bold accent="blue" />
              <PnlRow label="ФОТ (Зарплаты)" value={-pnl.salaries} revenue={pnl.revenue} sub
                planValue={plan?.plannedPayroll}
                expandable
                expanded={showFotDetail}
                onToggle={() => setShowFotDetail(!showFotDetail)}
                onClick={() => onNavigateToTab?.('team')} />
              {showFotDetail && (
                <>
                  {pnl.salariesSource === 'transactions' && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={4} className="py-1.5 px-10">
                        <span className="text-[9px] font-bold text-blue-600">
                          Источник: банковская выписка (категория "ФОТ")
                        </span>
                      </td>
                    </tr>
                  )}
                  {pnl.salariesSource === 'payroll' && payrollBreakdown && (
                    <>
                      <tr className="bg-blue-50/30">
                        <td colSpan={4} className="py-1.5 px-10">
                          <span className="text-[9px] font-bold text-blue-600">Источник: модуль расчета зарплат</span>
                        </td>
                      </tr>
                      <PnlRow label="Оклады (фикс)" value={-payrollBreakdown.fixSalary} revenue={pnl.revenue} indent />
                      <PnlRow label="KPI за задачи" value={-payrollBreakdown.kpiEarned} revenue={pnl.revenue} indent />
                      {payrollBreakdown.bonuses > 0 && <PnlRow label="Бонусы" value={-payrollBreakdown.bonuses} revenue={pnl.revenue} indent />}
                      {payrollBreakdown.penalties > 0 && <PnlRow label="Штрафы (вычет)" value={payrollBreakdown.penalties} revenue={pnl.revenue} indent accent="emerald" />}
                    </>
                  )}
                  <PnlRow label="Всего ФОТ (до вычета)" value={-pnl.salariesRaw} revenue={pnl.revenue} indent />
                  {cogsFot > 0 && (
                    <PnlRow label="Уже учтено в себестоимости" value={cogsFot} revenue={pnl.revenue} indent accent="emerald" />
                  )}
                  {payrollBreakdown && payrollBreakdown.total > 0 && (
                    <tr className="bg-slate-50/30">
                      <td colSpan={4} className="py-2 px-6">
                        <div className="flex items-center gap-4 text-[9px] font-bold">
                          <span className="text-slate-400">Статус:</span>
                          {payrollBreakdown.byStatus.paid > 0 && <span className="text-emerald-600">Выплачено: {formatCurrency(payrollBreakdown.byStatus.paid)}</span>}
                          {payrollBreakdown.byStatus.frozen > 0 && <span className="text-blue-600">Зафиксировано: {formatCurrency(payrollBreakdown.byStatus.frozen)}</span>}
                          {payrollBreakdown.byStatus.draft > 0 && <span className="text-amber-600">Черновик: {formatCurrency(payrollBreakdown.byStatus.draft)}</span>}
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-500">{payrollBreakdown.employeeCount} сотрудников</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )}
              <PnlRow label="Маркетинг" value={-pnl.marketing} revenue={pnl.revenue} sub planValue={plan?.plannedMarketing} onClick={() => onNavigateToTab?.('marketing')} />
              <PnlRow label="Офис и ПО" value={-pnl.office} revenue={pnl.revenue} sub planValue={plan?.plannedOffice} />
              <PnlRow label="Прочие расходы" value={-pnl.otherExpenses} revenue={pnl.revenue} sub />
              <PnlRow label="EBITDA" value={pnl.ebitda} revenue={pnl.revenue} bold accent="emerald" planValue={plan?.plannedEbitda} />
              <PnlRow label={`Налоги (${(taxRate * 100).toFixed(0)}%)`} value={-pnl.taxes} revenue={pnl.revenue} sub />
              <PnlRow label="Чистая прибыль" value={pnl.netProfit} revenue={pnl.revenue} bold accent="emerald" planValue={plan?.plannedNetProfit} />
            </tbody>
          </table>
        </div>
      </div>

      <CashFlowSummary cashFlow={cashFlow} burnRate={burnRate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlanFactChart
          editingPlan={editingPlan}
          setEditingPlan={setEditingPlan}
          planForm={planForm}
          setPlanForm={setPlanForm}
          handleSavePlan={handleSavePlan}
          plan={plan}
          planFact={planFact}
        />

        <ExpenseStructureChart
          expenseStructure={expenseStructure}
          totalAllExpenses={totalAllExpenses}
        />
      </div>

      {pnl.revenue === 0 && totalAllExpenses === 0 && (
        <div className={`${UI.CARD} border-l-4 border-l-amber-400 bg-amber-50/50`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Нет данных за {monthLabel}</p>
              <p className="text-xs text-slate-600 mt-1">
                Для корректного P&L отчета необходимо: входящие платежи (выручка), расходы проектов (COGS),
                и данные из зарплатной ведомости (ФОТ). Попробуйте выбрать другой месяц.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MonthNavigator = ({ selectedMonth, onNavigate }: { selectedMonth: string; onNavigate: (d: 'prev' | 'next') => void }) => (
  <div className="flex items-center gap-3">
    <button onClick={() => onNavigate('prev')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <div className="text-center min-w-[140px]">
      <div className="text-sm font-black text-slate-900">
        {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long' })}
      </div>
      <div className="text-xs text-slate-500 font-bold">
        {new Date(selectedMonth + '-01').getFullYear()}
      </div>
    </div>
    <button onClick={() => onNavigate('next')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
);

const KpiCard = ({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) => (
  <div className={UI.CARD}>
    <p className={UI.LABEL}>{label}</p>
    <p className={UI.VALUE}>{value}</p>
    {children}
  </div>
);

const Badge = ({ positive, label, alt }: { positive: boolean; label: string; alt?: boolean }) => (
  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
    alt
      ? (positive ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600')
      : (positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')
  }`}>
    {label}
  </span>
);

const InsightCard = ({ type, title, text }: { type: 'success' | 'warning' | 'danger'; title: string; text: string }) => {
  const styles = {
    success: { border: 'border-l-emerald-500 bg-emerald-50/30', icon: 'bg-emerald-100 text-emerald-600' },
    warning: { border: 'border-l-amber-400 bg-amber-50/30', icon: 'bg-amber-100 text-amber-600' },
    danger: { border: 'border-l-rose-500 bg-rose-50/30', icon: 'bg-rose-100 text-rose-600' },
  };
  const s = styles[type];
  const iconPath = type === 'success'
    ? 'M5 13l4 4L19 7'
    : 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z';

  return (
    <div className={`${UI.CARD} border-l-4 ${s.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 ${s.icon} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
        </div>
        <div>
          <p className="font-black text-slate-900 text-sm">{title}</p>
          <p className="text-xs text-slate-600 mt-1">{text}</p>
        </div>
      </div>
    </div>
  );
};

const CashFlowSummary = ({ cashFlow, burnRate }: { cashFlow: CashFlowResult; burnRate: BurnRateResult }) => {
  if (cashFlow.operatingInflow === 0 && cashFlow.operatingOutflow === 0) return null;

  return (
    <div className={UI.CARD}>
      <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
        <div className="w-1 h-4 bg-blue-600 rounded-full" /> Движение денежных средств (ДДС)
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Поступления</p>
          <p className="text-lg font-black text-emerald-700">{formatCurrency(cashFlow.operatingInflow)}</p>
        </div>
        <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
          <p className="text-[9px] font-black text-rose-600 uppercase mb-1">Списания</p>
          <p className="text-lg font-black text-rose-700">{formatCurrency(cashFlow.operatingOutflow)}</p>
        </div>
        <div className={`rounded-2xl p-4 border ${cashFlow.operatingNet >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
          <p className={`text-[9px] font-black uppercase mb-1 ${cashFlow.operatingNet >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
            Чистый поток
          </p>
          <p className={`text-lg font-black ${cashFlow.operatingNet >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
            {cashFlow.operatingNet >= 0 ? '+' : ''}{formatCurrency(cashFlow.operatingNet)}
          </p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Остаток на счете</p>
          <p className="text-lg font-black text-slate-900">{formatCurrency(burnRate.currentCash)}</p>
        </div>
        <div className={`rounded-2xl p-4 border ${burnRate.runway > 3 ? 'bg-emerald-50 border-emerald-100' : burnRate.runway > 1 ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
          <p className={`text-[9px] font-black uppercase mb-1 ${burnRate.runway > 3 ? 'text-emerald-600' : burnRate.runway > 1 ? 'text-amber-600' : 'text-rose-600'}`}>
            Runway
          </p>
          <p className={`text-lg font-black ${burnRate.runway > 3 ? 'text-emerald-700' : burnRate.runway > 1 ? 'text-amber-700' : 'text-rose-700'}`}>
            {burnRate.monthlyBurn > 0 ? `${burnRate.runway.toFixed(1)} мес.` : '--'}
          </p>
          {burnRate.monthlyBurn > 0 && (
            <p className="text-[8px] text-slate-400 font-bold mt-1">Burn: {formatCurrency(burnRate.monthlyBurn)}/мес</p>
          )}
        </div>
      </div>
    </div>
  );
};

const PlanFactChart = ({
  editingPlan, setEditingPlan, planForm, setPlanForm, handleSavePlan, plan, planFact
}: {
  editingPlan: boolean;
  setEditingPlan: (v: boolean) => void;
  planForm: { revenue: number; payroll: number; expenses: number; netProfit: number };
  setPlanForm: React.Dispatch<React.SetStateAction<{ revenue: number; payroll: number; expenses: number; netProfit: number }>>;
  handleSavePlan: () => void;
  plan: FinancialPlan | null;
  planFact: { name: string; plan: number; fact: number }[];
}) => (
  <div className={UI.CARD}>
    <div className="flex items-center justify-between mb-8">
      <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
        <div className="w-1 h-4 bg-blue-600 rounded-full" /> Выполнение фин. плана
      </h3>
      <button
        onClick={() => setEditingPlan(!editingPlan)}
        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors px-3 py-1 rounded-lg hover:bg-blue-50"
      >
        {editingPlan ? 'Отмена' : 'Задать план'}
      </button>
    </div>

    {editingPlan && (
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">План выручки</label>
          <input
            type="number" value={planForm.revenue || ''}
            onChange={e => setPlanForm(p => ({ ...p, revenue: Number(e.target.value) }))}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" placeholder="0"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">План ФОТ</label>
          <input
            type="number" value={planForm.payroll || ''}
            onChange={e => setPlanForm(p => ({ ...p, payroll: Number(e.target.value) }))}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" placeholder="0"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">План расходов (итого)</label>
          <input
            type="number" value={planForm.expenses || ''}
            onChange={e => setPlanForm(p => ({ ...p, expenses: Number(e.target.value) }))}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" placeholder="0"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">План чистой прибыли</label>
          <input
            type="number" value={planForm.netProfit || ''}
            onChange={e => setPlanForm(p => ({ ...p, netProfit: Number(e.target.value) }))}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" placeholder="0"
          />
        </div>
        <button
          onClick={handleSavePlan}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase hover:bg-blue-700 transition-colors"
        >
          Сохранить план
        </button>
      </div>
    )}

    {plan && (plan.plannedRevenue > 0 || plan.plannedNetProfit > 0) ? (
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={planFact} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              formatter={(v: number) => formatCurrency(v)}
            />
            <Bar dataKey="plan" name="План" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={40} />
            <Bar dataKey="fact" name="Факт" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-bold">План не задан</p>
        <p className="text-slate-400 text-xs mt-1">Нажмите "Задать план" чтобы установить цели</p>
      </div>
    )}
  </div>
);

const ExpenseStructureChart = ({
  expenseStructure, totalAllExpenses
}: {
  expenseStructure: { name: string; value: number }[];
  totalAllExpenses: number;
}) => (
  <div className={UI.CARD}>
    <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900 flex items-center gap-2">
      <div className="w-1 h-4 bg-emerald-500 rounded-full" /> Структура расходов
    </h3>
    {totalAllExpenses > 0 ? (
      <div className="h-[350px] w-full flex flex-col md:flex-row items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={expenseStructure} innerRadius={80} outerRadius={110} paddingAngle={4} dataKey="value">
              {expenseStructure.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="w-full md:w-80 space-y-4 px-4">
          {expenseStructure.map((item, i) => {
            const pct = totalAllExpenses > 0 ? (item.value / totalAllExpenses) * 100 : 0;
            return (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[11px] text-slate-600 font-bold uppercase">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 text-xs">{pct.toFixed(0)}%</span>
                    <span className="text-[9px] text-slate-400 ml-2">{formatCurrency(item.value)}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-1000"
                    style={{ backgroundColor: COLORS[i % COLORS.length], width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-900 font-black uppercase">Итого расходов</span>
              <span className="font-black text-slate-900 text-sm">{formatCurrency(totalAllExpenses)}</span>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-bold">Нет данных по расходам</p>
        <p className="text-slate-400 text-xs mt-1">Заполните расходы проектов или добавьте исходящие платежи</p>
      </div>
    )}
  </div>
);

const PnlRow = ({ label, value, revenue, bold, sub, accent, indent, expandable, expanded, onToggle, planValue, onClick }: {
  label: string; value: number; revenue: number; bold?: boolean; sub?: boolean; accent?: string; indent?: boolean;
  expandable?: boolean; expanded?: boolean; onToggle?: () => void; planValue?: number; onClick?: () => void;
}) => {
  const pct = revenue > 0 ? (Math.abs(value) / revenue) * 100 : 0;
  const colorClass = accent === 'emerald'
    ? (value >= 0 ? 'text-emerald-600' : 'text-rose-600')
    : accent === 'blue' ? 'text-blue-600'
    : (value < 0 ? 'text-rose-500' : 'text-slate-900');

  const planDeviation = planValue && planValue > 0 && Math.abs(value) > 0
    ? ((Math.abs(value) / planValue) - 1) * 100
    : null;

  return (
    <tr className={`group hover:bg-slate-50/50 transition-all ${bold ? 'bg-slate-50/30' : ''} ${indent ? 'bg-slate-50/20' : ''} ${onClick ? 'cursor-pointer' : ''}`} onClick={(e) => { if (onClick && !expandable) { e.stopPropagation(); onClick(); } }}>
      <td className={`py-3 pr-4 ${bold ? 'font-black text-slate-900 text-sm' : 'text-xs text-slate-600 font-bold'} ${sub ? 'pl-6' : ''} ${indent ? 'pl-10' : ''}`}>
        <div className="flex items-center gap-1.5">
          {sub && !indent && <span className="text-slate-300 mr-1">-</span>}
          {indent && <span className="text-slate-200 mr-1 text-[9px]">&#9492;</span>}
          <span>{label}</span>
          {expandable && (
            <button onClick={onToggle} className="ml-1 text-blue-500 hover:text-blue-700 transition-colors">
              <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </td>
      <td className={`py-3 text-right ${bold ? 'font-black text-sm' : 'text-xs font-bold'} ${colorClass}`}>
        {formatCurrency(value)}
      </td>
      <td className="py-3 text-right text-[10px] font-bold text-slate-400">
        {value === revenue && revenue > 0 ? '100%' : `${pct.toFixed(1)}%`}
      </td>
      <td className="py-3 text-right text-[10px] font-bold">
        {planValue && planValue > 0 ? (
          <div>
            <span className="text-slate-400">{formatCurrency(planValue)}</span>
            {planDeviation !== null && (
              <span className={`ml-1 ${Math.abs(planDeviation) < 5 ? 'text-emerald-500' : planDeviation > 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                ({planDeviation > 0 ? '+' : ''}{planDeviation.toFixed(0)}%)
              </span>
            )}
          </div>
        ) : indent ? null : (
          <span className="text-slate-200">--</span>
        )}
      </td>
    </tr>
  );
};

export default FinanceTab;
