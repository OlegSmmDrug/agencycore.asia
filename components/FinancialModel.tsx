import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, Client, Project, ProjectStatus } from '../types';
import { supabase } from '../lib/supabase';
import { financialPlanService, FinancialPlan } from '../services/financialPlanService';
import { getCurrentOrganizationId } from '../utils/organizationContext';

interface FinancialModelProps {
  transactions: Transaction[];
  clients: Client[];
  projects: Project[];
  viewMode?: 'opiu' | 'dds';
}

interface MonthData {
  month: string;
  label: string;
  plan: FinancialPlan | null;
  fact: {
    revenue: number;
    cogs: number;
    payroll: number;
    marketing: number;
    office: number;
    otherOpex: number;
  };
}

interface EditableValues {
  [monthKey: string]: {
    revenue?: number;
    cogs?: number;
    marketing?: number;
    payroll?: number;
    office?: number;
    otherOpex?: number;
    depreciation?: number;
    taxes?: number;
  };
}

const DEFAULT_TAX_RATE = 0.15;
const TAX_RATE_OPTIONS = [
  { label: '3% (ИП упрощ.)', value: 0.03 },
  { label: '10% (КПН)', value: 0.10 },
  { label: '15% (стандарт)', value: 0.15 },
  { label: '20%', value: 0.20 },
];

const formatVal = (v: number, showSign = false) => {
  if (isNaN(v) || v === 0) return '₸ 0';
  const sign = showSign && v > 0 ? '+' : '';
  return `${sign}₸ ${Math.round(v).toLocaleString()}`;
};

const formatPct = (v: number) => {
  if (isNaN(v)) return '0 %';
  return `${Math.round(v)} %`;
};

const FinancialModel: React.FC<FinancialModelProps> = ({ transactions = [], clients = [], projects = [], viewMode }) => {
  const [viewType, setViewType] = useState<'opiu' | 'dds'>(viewMode || 'opiu');
  const [grouping, setGrouping] = useState<'monthly' | 'quarterly'>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    d.setDate(1);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 9);
    d.setDate(1);
    return d;
  });
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [editValues, setEditValues] = useState<EditableValues>({});
  const [saving, setSaving] = useState(false);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  const [factPayroll, setFactPayroll] = useState<Record<string, number>>({});
  const [factProjectExpenses, setFactProjectExpenses] = useState<Record<string, number>>({});
  const editInputRef = useRef<HTMLInputElement>(null);

  const activeProjectIds = useMemo(() =>
    projects
      .filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED)
      .map(p => p.id),
    [projects]
  );

  const months = useMemo(() => {
    const list: { label: string; key: string; month: string }[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      const m = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      list.push({
        label: current.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }).replace('.', ''),
        key: m,
        month: m,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return list;
  }, [startDate, endDate]);

  const startMonth = months[0]?.month || '2025-12';
  const endMonth = months[months.length - 1]?.month || '2026-12';

  useEffect(() => {
    const load = async () => {
      const orgId = getCurrentOrganizationId();
      if (!orgId || months.length === 0) return;

      const savedPlans = await financialPlanService.getRange(startMonth, endMonth);
      setPlans(savedPlans);

      const { data: payrollData } = await supabase
        .from('payroll_records')
        .select('month, fix_salary, calculated_kpi, manual_bonus, manual_penalty')
        .eq('organization_id', orgId)
        .gte('month', startMonth)
        .lte('month', endMonth);

      const payrollMap: Record<string, number> = {};
      (payrollData || []).forEach(r => {
        const total = (Number(r.fix_salary) || 0) + (Number(r.calculated_kpi) || 0) +
          (Number(r.manual_bonus) || 0) - (Number(r.manual_penalty) || 0);
        payrollMap[r.month] = (payrollMap[r.month] || 0) + total;
      });
      setFactPayroll(payrollMap);

      if (activeProjectIds.length > 0) {
        const { data: expData } = await supabase
          .from('project_expenses')
          .select('month, total_expenses')
          .in('project_id', activeProjectIds)
          .gte('month', startMonth)
          .lte('month', endMonth);

        const expMap: Record<string, number> = {};
        (expData || []).forEach(r => {
          expMap[r.month] = (expMap[r.month] || 0) + (Number(r.total_expenses) || 0);
        });
        setFactProjectExpenses(expMap);
      } else {
        setFactProjectExpenses({});
      }
    };
    load();
  }, [months, startMonth, endMonth, activeProjectIds]);

  const monthlyData: MonthData[] = useMemo(() => {
    const safeTransactions = Array.isArray(transactions) ? transactions : [];

    return months.map(m => {
      const mStart = m.month + '-01';
      const endDate = new Date(m.month + '-01');
      endDate.setMonth(endDate.getMonth() + 1);
      const mEnd = endDate.toISOString().slice(0, 10);

      const mTxns = safeTransactions.filter(t => {
        const d = t.date?.slice(0, 10);
        return d && d >= mStart && d < mEnd;
      });

      const revenue = mTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const salariesFromTx = Math.abs(mTxns.filter(t => t.category === 'Salary').reduce((s, t) => s + t.amount, 0));
      const marketingTx = Math.abs(mTxns.filter(t => t.category === 'Marketing').reduce((s, t) => s + t.amount, 0));
      const officeTx = Math.abs(mTxns.filter(t => t.category === 'Office').reduce((s, t) => s + t.amount, 0));
      const otherTx = Math.abs(mTxns.filter(t => t.category === 'Other').reduce((s, t) => s + t.amount, 0));

      const payrollFromRecords = factPayroll[m.month] || 0;
      const salaries = Math.max(salariesFromTx, payrollFromRecords);

      const plan = plans.find(p => p.month === m.month) || null;

      return {
        month: m.month,
        label: m.label,
        plan,
        fact: {
          revenue,
          cogs: factProjectExpenses[m.month] || 0,
          payroll: salaries,
          marketing: marketingTx,
          office: officeTx,
          otherOpex: otherTx,
        },
      };
    });
  }, [months, transactions, plans, factPayroll, factProjectExpenses]);

  const getVal = useCallback((m: MonthData, field: string): number => {
    const edited = editValues[m.month];
    if (edited && (edited as any)[field] !== undefined) return (edited as any)[field];
    const factVal = (m.fact as any)[field] || 0;
    if (factVal > 0) return factVal;
    if (m.plan) {
      const planField = 'planned' + field.charAt(0).toUpperCase() + field.slice(1);
      const planVal = (m.plan as any)[planField];
      if (planVal && planVal > 0) return planVal;
    }
    return 0;
  }, [editValues]);

  const computeRow = useCallback((md: MonthData) => {
    const revenue = getVal(md, 'revenue');
    const cogs = getVal(md, 'cogs');
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const marketing = getVal(md, 'marketing');
    const payroll = getVal(md, 'payroll');
    const office = getVal(md, 'office');
    const otherOpex = getVal(md, 'otherOpex');
    const depreciation = editValues[md.month]?.depreciation ?? md.plan?.plannedDepreciation ?? 0;
    const totalOpex = marketing + payroll + office + otherOpex + depreciation;
    const ebitda = grossProfit - marketing - payroll - office - otherOpex;
    const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
    const taxes = editValues[md.month]?.taxes ?? (md.plan?.plannedTaxes || Math.max(0, Math.round(ebitda * taxRate)));
    const netProfit = ebitda - depreciation - taxes;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const totalIncome = revenue;
    const totalAdminFixed = payroll + office + otherOpex + depreciation;

    return {
      revenue, cogs, grossProfit, grossMargin,
      marketing, payroll, office, otherOpex, depreciation,
      totalOpex, ebitda, ebitdaMargin, taxes, netProfit, netMargin,
      totalIncome, totalAdminFixed,
    };
  }, [getVal, editValues, taxRate]);

  const rows = useMemo(() => monthlyData.map(computeRow), [monthlyData, computeRow]);

  const breakEvenMonth = useMemo(() => {
    let cumulativeProfit = 0;
    for (let i = 0; i < rows.length; i++) {
      cumulativeProfit += rows[i].netProfit;
      if (cumulativeProfit > 0 && rows[i].netProfit > 0) return i;
    }
    return -1;
  }, [rows]);

  const { periods, displayData, displayMonthly } = useMemo(() => {
    if (grouping === 'monthly') {
      return { periods: months, displayData: rows, displayMonthly: monthlyData };
    }
    const quarters: typeof months = [];
    const qRows: typeof rows = [];
    const qMonthly: MonthData[] = [];

    for (let i = 0; i < months.length; i += 3) {
      const chunk = rows.slice(i, i + 3);
      if (chunk.length === 0) break;
      const qNum = Math.floor(i / 3) + 1;
      const year = months[i]?.label.split(' ')[1] || '';
      quarters.push({ label: `Q${qNum} ${year}`, key: `Q${qNum}-${year}`, month: '' });
      const sum = (field: keyof typeof chunk[0]) => chunk.reduce((s, r) => s + (r[field] as number || 0), 0);
      const avg = (field: keyof typeof chunk[0]) => sum(field) / chunk.length;
      qRows.push({
        revenue: sum('revenue'), cogs: sum('cogs'), grossProfit: sum('grossProfit'),
        grossMargin: avg('grossMargin'), marketing: sum('marketing'), payroll: sum('payroll'),
        office: sum('office'), otherOpex: sum('otherOpex'), depreciation: sum('depreciation'),
        totalOpex: sum('totalOpex'), ebitda: sum('ebitda'), ebitdaMargin: avg('ebitdaMargin'),
        taxes: sum('taxes'), netProfit: sum('netProfit'), netMargin: avg('netMargin'),
        totalIncome: sum('totalIncome'), totalAdminFixed: sum('totalAdminFixed'),
      });
      qMonthly.push(monthlyData[i]);
    }
    return { periods: quarters, displayData: qRows, displayMonthly: qMonthly };
  }, [grouping, months, rows, monthlyData]);

  const handleCellEdit = useCallback((month: string, field: string, value: number) => {
    setEditValues(prev => ({
      ...prev,
      [month]: { ...prev[month], [field]: value },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const bulkPlans = monthlyData.map(md => {
      const r = computeRow(md);
      return {
        month: md.month,
        plannedRevenue: r.revenue,
        plannedCogs: r.cogs,
        plannedMarketing: r.marketing,
        plannedPayroll: r.payroll,
        plannedOffice: r.office,
        plannedOtherOpex: r.otherOpex,
        plannedDepreciation: r.depreciation,
        plannedTaxes: r.taxes,
        plannedEbitda: r.ebitda,
        plannedNetProfit: r.netProfit,
        plannedExpenses: r.totalOpex + r.cogs,
      };
    });
    await financialPlanService.bulkUpsert(bulkPlans);
    const refreshed = await financialPlanService.getRange(startMonth, endMonth);
    setPlans(refreshed);
    setEditValues({});
    setIsEditMode(false);
    setSaving(false);
  }, [monthlyData, computeRow, startMonth, endMonth]);

  const ddsData = useMemo(() => {
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    let cumulativeBalance = 0;

    const getMonthTxRange = (mk: string) => {
      const start = mk + '-01';
      const ed = new Date(mk + '-01');
      ed.setMonth(ed.getMonth() + 1);
      return { start, end: ed.toISOString().slice(0, 10) };
    };

    const periodMonthKeys: string[][] = grouping === 'monthly'
      ? months.map(m => [m.month])
      : months.reduce<string[][]>((acc, m, i) => {
          const qIdx = Math.floor(i / 3);
          if (!acc[qIdx]) acc[qIdx] = [];
          acc[qIdx].push(m.month);
          return acc;
        }, []);

    return periodMonthKeys.map(mks => {
      const startBalance = cumulativeBalance;
      let inflow = 0, salaryOut = 0, marketingOut = 0, officeOut = 0, otherOut = 0;

      for (const mk of mks) {
        const { start, end } = getMonthTxRange(mk);
        const mTx = safeTransactions.filter(t => {
          const d = t.date?.slice(0, 10);
          return d && d >= start && d < end;
        });
        inflow += mTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        salaryOut += Math.abs(mTx.filter(t => t.category === 'Salary' && t.amount < 0).reduce((s, t) => s + t.amount, 0));
        marketingOut += Math.abs(mTx.filter(t => t.category === 'Marketing' && t.amount < 0).reduce((s, t) => s + t.amount, 0));
        officeOut += Math.abs(mTx.filter(t => t.category === 'Office' && t.amount < 0).reduce((s, t) => s + t.amount, 0));
        otherOut += Math.abs(mTx.filter(t => t.category === 'Other' && t.amount < 0).reduce((s, t) => s + t.amount, 0));
      }

      let accruedPayroll = 0;
      for (const mk of mks) {
        accruedPayroll += factPayroll[mk] || 0;
      }

      const totalOutflow = salaryOut + marketingOut + officeOut + otherOut;
      const operatingNet = inflow - totalOutflow;
      const investingFlow = 0;
      const financingFlow = 0;
      const totalFlow = operatingNet + investingFlow + financingFlow;
      cumulativeBalance += totalFlow;

      return {
        startBalance, inflow, salaryOut, marketingOut, officeOut, otherOut,
        totalOutflow, operatingNet, investingFlow, financingFlow, totalFlow,
        endBalance: cumulativeBalance,
        accruedPayroll,
      };
    });
  }, [transactions, months, grouping, factPayroll]);

  const EditableCell = ({ month, field, value, isBold, isNeg }: {
    month: string; field: string; value: number; isBold?: boolean; isNeg?: boolean;
  }) => {
    const [localVal, setLocalVal] = useState(String(value || ''));
    const isActive = isEditMode && grouping === 'monthly';

    useEffect(() => { setLocalVal(String(value || '')); }, [value]);

    if (!isActive) {
      return (
        <td className={`py-2.5 px-4 text-right w-[150px] min-w-[150px] whitespace-nowrap ${isBold ? 'font-black text-slate-900' : 'font-medium text-slate-600'}`}>
          <div className={`text-xs ${isNeg && value < 0 ? 'text-rose-500' : ''}`}>{formatVal(value)}</div>
        </td>
      );
    }

    return (
      <td className="py-1.5 px-2 w-[150px] min-w-[150px]">
        <input
          type="number"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={() => {
            const num = Number(localVal) || 0;
            handleCellEdit(month, field, num);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-full text-right text-xs font-bold bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
        />
      </td>
    );
  };

  const ReadOnlyCell = ({ value, isBold, accent, pct }: {
    value: number; isBold?: boolean; accent?: string; pct?: number;
  }) => {
    const colorClass = accent === 'green' ? (value >= 0 ? 'text-emerald-600' : 'text-rose-600')
      : accent === 'blue' ? 'text-blue-600'
      : accent === 'rose' ? 'text-rose-500'
      : (value < 0 ? 'text-rose-500' : '');

    return (
      <td className={`py-2.5 px-4 text-right w-[150px] min-w-[150px] whitespace-nowrap ${isBold ? 'font-black' : 'font-medium'} ${colorClass || 'text-slate-600'}`}>
        <div className="text-xs">{formatVal(value)}</div>
        {pct !== undefined && <div className="text-[9px] text-slate-400 font-black mt-0.5">{formatPct(pct)}</div>}
      </td>
    );
  };

  const HeaderRow = ({ label, values }: { label: string; values: number[] }) => (
    <tr className="bg-[#F9FAFB] border-y border-slate-100">
      <td className="py-2.5 px-4 sticky left-0 z-20 bg-[#F9FAFB] border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
        <div className="text-xs font-black uppercase tracking-wide text-slate-900">{label}</div>
      </td>
      {values.map((v, i) => (
        <td key={i} className="py-2.5 px-4 text-right w-[150px] min-w-[150px] whitespace-nowrap font-black text-slate-500">
          <div className="text-xs">{formatVal(v)}</div>
        </td>
      ))}
    </tr>
  );

  const TotalRow = ({ label, values, subLabel, percentages, accent }: {
    label: string; values: number[]; subLabel?: string; percentages?: number[]; accent?: string;
  }) => (
    <tr className="bg-slate-50/50 border-t border-slate-200">
      <td className="py-3 px-4 sticky left-0 z-20 bg-slate-50 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
        <div className="text-xs font-black text-slate-900">{label}</div>
        {subLabel && <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{subLabel}</div>}
      </td>
      {values.map((v, i) => {
        const colorClass = accent === 'green' ? (v >= 0 ? 'text-emerald-600' : 'text-rose-600')
          : accent === 'blue' ? 'text-blue-600' : 'text-slate-900';
        return (
          <td key={i} className={`py-3 px-4 text-right w-[150px] min-w-[150px] whitespace-nowrap font-black ${colorClass}`}>
            <div className="text-xs">{formatVal(v)}</div>
            {percentages && <div className="text-[9px] text-slate-400 font-black mt-0.5">{formatPct(percentages[i])}</div>}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="flex flex-col h-full max-h-screen bg-white animate-fade-in">
      <div className="px-4 lg:px-8 py-4 lg:py-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4 border-b border-slate-100 shrink-0 bg-white">
        <div className="flex items-center gap-3 lg:gap-6">
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Финансовая модель</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewType('opiu')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewType === 'opiu' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ОПиУ
            </button>
            <button
              onClick={() => setViewType('dds')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewType === 'dds' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ДДС
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={grouping}
              onChange={(e) => setGrouping(e.target.value as 'monthly' | 'quarterly')}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="monthly">Ежемесячно</option>
              <option value="quarterly">Квартально</option>
            </select>
            <svg className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
          </div>

          <button
            onClick={() => setIsEditingDates(!isEditingDates)}
            className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-100 transition-all cursor-pointer text-xs"
          >
            <span className="font-black text-slate-400 uppercase tracking-wider">Период:</span>
            <span className="font-black text-slate-800">
              {startDate.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace('.', '')} - {endDate.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace('.', '')}
            </span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowTaxSettings(!showTaxSettings)}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-100 transition-all cursor-pointer text-xs"
            >
              <span className="font-black text-slate-400 uppercase tracking-wider">Налог:</span>
              <span className="font-black text-slate-800">{(taxRate * 100).toFixed(0)}%</span>
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showTaxSettings && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50 min-w-[180px]">
                {TAX_RATE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setTaxRate(opt.value); setShowTaxSettings(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${taxRate === opt.value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="border-t border-slate-100 px-4 py-2.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Своя ставка (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue={(taxRate * 100).toFixed(0)}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setTaxRate(v / 100);
                      setShowTaxSettings(false);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}
          </div>

          {isEditMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditValues({}); setIsEditMode(false); }}
                className="px-4 py-2 rounded-lg text-xs font-black border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Сохранить модель
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 rounded-lg text-xs font-black bg-slate-900 text-white hover:bg-black transition-all"
            >
              Редактирование
            </button>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="px-4 lg:px-8 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
          <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="text-xs font-bold text-blue-700">
            Режим редактирования: редактируйте значения прямо в таблице. Итоговые строки рассчитываются автоматически.
          </span>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-[#FBFBFF] financial-model-scroll">
        <table className="w-full border-collapse min-w-max">
          <thead className="sticky top-0 z-30 bg-white">
            <tr>
              <th className="py-3 px-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b-2 border-slate-200 bg-white w-[260px] min-w-[260px] sticky left-0 z-40 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                Статья
              </th>
              {periods.map((m, i) => (
                <th key={m.key} className={`py-3 px-4 text-right text-[10px] font-black uppercase tracking-wider border-b-2 border-slate-200 bg-white w-[150px] min-w-[150px] whitespace-nowrap ${breakEvenMonth === i && grouping === 'monthly' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {m.label}
                  {breakEvenMonth === i && grouping === 'monthly' && (
                    <div className="text-[8px] text-emerald-500 font-black mt-0.5">BEP</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {viewType === 'opiu' ? (
              <>
                <HeaderRow label="Доход" values={displayData.map(d => d.totalIncome)} />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Всего выручки</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="revenue" value={displayData[i]?.revenue || 0} isBold />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.revenue} isBold />
                      ))
                  }
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Себестоимость (COGS)</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="cogs" value={displayData[i]?.cogs || 0} isNeg />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.cogs} accent="rose" />
                      ))
                  }
                </tr>
                <TotalRow
                  label="Валовая прибыль"
                  values={displayData.map(d => d.grossProfit)}
                  subLabel="Валовая маржинальность"
                  percentages={displayData.map(d => d.grossMargin)}
                  accent="blue"
                />

                <HeaderRow label="Операционные расходы" values={displayData.map(d => d.marketing)} />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Продажи и маркетинг</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">% от Выручки</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="marketing" value={displayData[i]?.marketing || 0} />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.marketing} pct={d.revenue > 0 ? (d.marketing / d.revenue) * 100 : 0} />
                      ))
                  }
                </tr>

                <HeaderRow label="Общие и административные расходы" values={displayData.map(d => d.totalAdminFixed)} />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">ФОТ (Фонд оплаты труда)</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Включая налоги на ФОТ</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="payroll" value={displayData[i]?.payroll || 0} />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.payroll} />
                      ))
                  }
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Расходы на офис и ПО</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="office" value={displayData[i]?.office || 0} />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.office} />
                      ))
                  }
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Прочие расходы</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="otherOpex" value={displayData[i]?.otherOpex || 0} />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.otherOpex} />
                      ))
                  }
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Амортизация</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="depreciation" value={displayData[i]?.depreciation || 0} />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.depreciation} />
                      ))
                  }
                </tr>
                <TotalRow
                  label="Итого расходов (OpEx + COGS)"
                  values={displayData.map(d => d.totalOpex + d.cogs)}
                  subLabel="% от Выручки"
                  percentages={displayData.map(d => d.revenue > 0 ? ((d.totalOpex + d.cogs) / d.revenue) * 100 : 0)}
                />

                <HeaderRow label="Прибыль" values={displayData.map(d => d.netProfit)} />
                <TotalRow label="EBITDA" values={displayData.map(d => d.ebitda)} subLabel="EBITDA маржа" percentages={displayData.map(d => d.ebitdaMargin)} accent="blue" />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Налоги ({(taxRate * 100).toFixed(0)}%)</div>
                  </td>
                  {grouping === 'monthly'
                    ? monthlyData.map((md, i) => (
                        <EditableCell key={md.month} month={md.month} field="taxes" value={displayData[i]?.taxes || 0} isNeg />
                      ))
                    : displayData.map((d, i) => (
                        <ReadOnlyCell key={`q-${i}`} value={d.taxes} accent="rose" />
                      ))
                  }
                </tr>
                <TotalRow label="Чистая прибыль" values={displayData.map(d => d.netProfit)} subLabel="Чистая маржа" percentages={displayData.map(d => d.netMargin)} accent="green" />

                {breakEvenMonth >= 0 && grouping === 'monthly' && (
                  <tr className="bg-emerald-50/50 border-t-2 border-emerald-200">
                    <td className="py-3 px-4 sticky left-0 z-20 bg-emerald-50 border-r border-emerald-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                      <div className="text-xs font-black text-emerald-700">Точка безубыточности</div>
                      <div className="text-[9px] text-emerald-500 font-bold uppercase mt-0.5">
                        Выход в плюс: {months[breakEvenMonth]?.label}
                      </div>
                    </td>
                    {displayData.map((_d, i) => {
                      let cumulative = 0;
                      for (let j = 0; j <= i; j++) cumulative += displayData[j].netProfit;
                      return (
                        <td key={i} className={`py-3 px-4 text-right w-[150px] min-w-[150px] whitespace-nowrap font-black text-xs ${cumulative >= 0 ? 'text-emerald-600' : 'text-rose-400'}`}>
                          {formatVal(cumulative)}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </>
            ) : (
              <>
                <HeaderRow label="Операционная деятельность" values={ddsData.map(d => d.operatingNet)} />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-emerald-700">Поступления от клиентов</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Фактические оплаты</div>
                  </td>
                  {ddsData.map((d, i) => <ReadOnlyCell key={i} value={d.inflow} accent="green" />)}
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-rose-600">Выплата зарплат (ФОТ)</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Фактические переводы</div>
                  </td>
                  {ddsData.map((d, i) => <ReadOnlyCell key={i} value={-d.salaryOut} accent="rose" />)}
                </tr>
                {ddsData.some(d => d.accruedPayroll > 0) && (
                  <tr className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-2.5 px-4 sticky left-0 bg-amber-50/20 z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                      <div className="text-xs font-bold text-amber-700">Начислено ФОТ (ведомость)</div>
                      <div className="text-[9px] text-amber-500 font-bold uppercase mt-0.5">Разница = долг по зарплатам</div>
                    </td>
                    {ddsData.map((d, i) => {
                      const delta = d.accruedPayroll - d.salaryOut;
                      return (
                        <td key={i} className="py-2.5 px-4 text-right w-[150px] min-w-[150px] whitespace-nowrap">
                          <div className="text-xs font-bold text-amber-700">{formatVal(d.accruedPayroll)}</div>
                          {delta !== 0 && (
                            <div className={`text-[9px] font-black mt-0.5 ${delta > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {delta > 0 ? 'Долг: ' : 'Переплата: '}{formatVal(Math.abs(delta))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-rose-600">Маркетинг и реклама</div>
                  </td>
                  {ddsData.map((d, i) => <ReadOnlyCell key={i} value={-d.marketingOut} accent="rose" />)}
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-rose-600">Офис и ПО</div>
                  </td>
                  {ddsData.map((d, i) => <ReadOnlyCell key={i} value={-d.officeOut} accent="rose" />)}
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-rose-600">Прочие выплаты</div>
                  </td>
                  {ddsData.map((d, i) => <ReadOnlyCell key={i} value={-d.otherOut} accent="rose" />)}
                </tr>
                <TotalRow
                  label="Итого операционный ДДС"
                  subLabel="Поступления минус выплаты"
                  values={ddsData.map(d => d.operatingNet)}
                  accent="blue"
                />

                <HeaderRow label="Инвестиционная деятельность" values={ddsData.map(d => d.investingFlow)} />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Капитальные затраты (CAPEX)</div>
                  </td>
                  {ddsData.map((_d, i) => <ReadOnlyCell key={i} value={0} />)}
                </tr>

                <HeaderRow label="Финансовая деятельность" values={ddsData.map(d => d.financingFlow)} />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Кредиты / Займы / Дивиденды</div>
                  </td>
                  {ddsData.map((_d, i) => <ReadOnlyCell key={i} value={0} />)}
                </tr>

                <TotalRow label="Чистый денежный поток за период" values={ddsData.map(d => d.totalFlow)} accent="green" />

                <HeaderRow label="Остаток денежных средств" values={ddsData.map(d => d.endBalance)} />
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">На начало периода</div>
                  </td>
                  {ddsData.map((d, i) => <ReadOnlyCell key={i} value={d.startBalance} />)}
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[260px] min-w-[260px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    <div className="text-xs font-bold text-slate-700">Движение за период</div>
                  </td>
                  {ddsData.map((d, i) => <ReadOnlyCell key={i} value={d.totalFlow} accent="green" />)}
                </tr>
                <TotalRow label="На конец периода" values={ddsData.map(d => d.endBalance)} accent="green" />
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border-t border-slate-100 px-4 lg:px-8 py-2.5 lg:py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Данные ERP</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> План / Прогноз</span>
          {isEditMode && <span className="flex items-center gap-1.5 text-blue-600"><div className="w-1.5 h-1.5 rounded-full bg-blue-600" /> Редактируемые ячейки</span>}
        </div>
        <span className="text-[8px]">v3.0 Financial Kernel</span>
      </div>

      {isEditingDates && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsEditingDates(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-slate-900 mb-6">Изменить период</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Дата начала</label>
                <input
                  type="month"
                  value={`${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-');
                    setStartDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Дата окончания</label>
                <input
                  type="month"
                  value={`${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-');
                    setEndDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsEditingDates(false)}
                className="flex-1 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all"
              >
                Применить
              </button>
              <button
                onClick={() => setIsEditingDates(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-50 transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialModel;
