import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Transaction, Client, Project, ProjectStatus } from '../types';
import { supabase } from '../lib/supabase';
import { financialPlanService, FinancialPlan, CustomDdsRow } from '../services/financialPlanService';
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
  [monthKey: string]: Record<string, number>;
}

const DEFAULT_TAX_RATE = 0.15;
const TAX_RATE_OPTIONS = [
  { label: '3% (ИП упрощ.)', value: 0.03 },
  { label: '10% (КПН)', value: 0.10 },
  { label: '15% (стандарт)', value: 0.15 },
  { label: '20%', value: 0.20 },
];

const formatVal = (v: number) => {
  if (isNaN(v) || v === 0) return '₸ 0';
  return `₸ ${Math.round(v).toLocaleString('ru-RU')}`;
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
  const [taxRateLoaded, setTaxRateLoaded] = useState(false);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  const [factPayroll, setFactPayroll] = useState<Record<string, number>>({});
  const [factProjectExpenses, setFactProjectExpenses] = useState<Record<string, number>>({});
  const [customDdsRows, setCustomDdsRows] = useState<CustomDdsRow[]>([]);
  const [showAddDdsRow, setShowAddDdsRow] = useState(false);
  const [newDdsRowName, setNewDdsRowName] = useState('');
  const [newDdsRowSection, setNewDdsRowSection] = useState<CustomDdsRow['section']>('operating_outflow');

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
    if (!taxRateLoaded) {
      financialPlanService.getTaxRate().then(rate => {
        setTaxRate(rate);
        setTaxRateLoaded(true);
      });
    }
  }, [taxRateLoaded]);

  useEffect(() => {
    const load = async () => {
      const orgId = getCurrentOrganizationId();
      if (!orgId || months.length === 0) return;

      const savedPlans = await financialPlanService.getRange(startMonth, endMonth);
      setPlans(savedPlans);

      const firstPlanWithRows = savedPlans.find(p => p.customDdsRows && p.customDdsRows.length > 0);
      if (firstPlanWithRows) {
        setCustomDdsRows(firstPlanWithRows.customDdsRows);
      }

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
      const ed = new Date(m.month + '-01');
      ed.setMonth(ed.getMonth() + 1);
      const mEnd = ed.toISOString().slice(0, 10);

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
    if (edited && edited[field] !== undefined) return edited[field];
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
        taxRate,
        customDdsRows,
        ddsCapex: editValues[md.month]?.ddsCapex ?? md.plan?.ddsCapex ?? 0,
        ddsFinancing: editValues[md.month]?.ddsFinancing ?? md.plan?.ddsFinancing ?? 0,
      };
    });
    await financialPlanService.bulkUpsert(bulkPlans);
    const refreshed = await financialPlanService.getRange(startMonth, endMonth);
    setPlans(refreshed);
    setEditValues({});
    setIsEditMode(false);
    setSaving(false);
  }, [monthlyData, computeRow, startMonth, endMonth, taxRate, customDdsRows, editValues]);

  const handleTaxRateChange = useCallback(async (rate: number) => {
    setTaxRate(rate);
    setShowTaxSettings(false);
    await financialPlanService.saveTaxRate(rate);
  }, []);

  const handleAddCustomDdsRow = useCallback(() => {
    if (!newDdsRowName.trim()) return;
    const newRow: CustomDdsRow = {
      id: crypto.randomUUID(),
      name: newDdsRowName.trim(),
      section: newDdsRowSection,
    };
    setCustomDdsRows(prev => [...prev, newRow]);
    setNewDdsRowName('');
    setShowAddDdsRow(false);
  }, [newDdsRowName, newDdsRowSection]);

  const handleRemoveCustomDdsRow = useCallback((rowId: string) => {
    setCustomDdsRows(prev => prev.filter(r => r.id !== rowId));
  }, []);

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

    return periodMonthKeys.map((mks, periodIdx) => {
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

      const customRowValues: Record<string, number> = {};
      for (const cr of customDdsRows) {
        let val = 0;
        for (const mk of mks) {
          val += editValues[mk]?.[`custom_${cr.id}`] ?? 0;
          const plan = plans.find(p => p.month === mk);
          if (!editValues[mk]?.[`custom_${cr.id}`] && plan) {
            const savedCustom = (plan as any)[`custom_${cr.id}`];
            if (savedCustom) val += Number(savedCustom);
          }
        }
        customRowValues[cr.id] = val;
      }

      let ddsCapex = 0;
      let ddsFinancing = 0;
      for (const mk of mks) {
        const plan = plans.find(p => p.month === mk);
        ddsCapex += editValues[mk]?.ddsCapex ?? plan?.ddsCapex ?? 0;
        ddsFinancing += editValues[mk]?.ddsFinancing ?? plan?.ddsFinancing ?? 0;
      }

      const customOperating = customDdsRows
        .filter(r => r.section === 'operating_outflow')
        .reduce((s, r) => s + (customRowValues[r.id] || 0), 0);

      const customInvesting = customDdsRows
        .filter(r => r.section === 'investing')
        .reduce((s, r) => s + (customRowValues[r.id] || 0), 0);

      const customFinancing = customDdsRows
        .filter(r => r.section === 'financing')
        .reduce((s, r) => s + (customRowValues[r.id] || 0), 0);

      const totalOutflow = salaryOut + marketingOut + officeOut + otherOut + customOperating;
      const operatingNet = inflow - totalOutflow;
      const investingFlow = -ddsCapex - customInvesting;
      const financingFlow = ddsFinancing + customFinancing;
      const totalFlow = operatingNet + investingFlow + financingFlow;
      cumulativeBalance += totalFlow;

      return {
        startBalance, inflow, salaryOut, marketingOut, officeOut, otherOut,
        totalOutflow, operatingNet, investingFlow, financingFlow, totalFlow,
        endBalance: cumulativeBalance, accruedPayroll,
        customRowValues, ddsCapex, ddsFinancing,
        monthKeys: mks,
      };
    });
  }, [transactions, months, grouping, factPayroll, customDdsRows, editValues, plans]);

  const isEditable = isEditMode && grouping === 'monthly';

  const InlineInput = ({ month, field, value }: { month: string; field: string; value: number }) => {
    const [localVal, setLocalVal] = useState(String(value || ''));
    useEffect(() => { setLocalVal(String(value || '')); }, [value]);

    if (!isEditable) {
      return (
        <td className="py-3 px-3 text-right whitespace-nowrap font-semibold text-slate-700">
          <span className="text-sm">{formatVal(value)}</span>
        </td>
      );
    }

    return (
      <td className="py-1.5 px-1.5">
        <input
          type="number"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={() => handleCellEdit(month, field, Number(localVal) || 0)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-full text-right text-sm font-semibold bg-blue-50/80 border border-blue-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all hover:border-blue-300"
          placeholder="0"
        />
      </td>
    );
  };

  const ValueCell = ({ value, accent, pct, isBold }: {
    value: number; accent?: string; pct?: number; isBold?: boolean;
  }) => {
    const color = accent === 'green' ? (value >= 0 ? 'text-emerald-600' : 'text-rose-600')
      : accent === 'blue' ? 'text-blue-600'
      : accent === 'rose' ? 'text-rose-500'
      : (value < 0 ? 'text-rose-500' : 'text-slate-700');

    return (
      <td className={`py-3 px-3 text-right whitespace-nowrap ${isBold ? 'font-bold' : 'font-semibold'} ${color}`}>
        <span className="text-sm">{formatVal(value)}</span>
        {pct !== undefined && <div className="text-[10px] text-slate-400 font-bold mt-0.5">{formatPct(pct)}</div>}
      </td>
    );
  };

  const SectionHeader = ({ label, values }: { label: string; values: number[] }) => (
    <tr className="bg-slate-50 border-y border-slate-200">
      <td className="py-3 px-5 sticky left-0 z-20 bg-slate-50 border-r border-slate-200 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
        <span className="text-xs font-black uppercase tracking-wider text-slate-800">{label}</span>
      </td>
      {values.map((v, i) => (
        <td key={i} className="py-3 px-3 text-right whitespace-nowrap font-bold text-slate-500">
          <span className="text-sm">{formatVal(v)}</span>
        </td>
      ))}
    </tr>
  );

  const TotalRow = ({ label, values, subLabel, percentages, accent }: {
    label: string; values: number[]; subLabel?: string; percentages?: number[]; accent?: string;
  }) => (
    <tr className="bg-slate-100/70 border-t-2 border-slate-200">
      <td className="py-3.5 px-5 sticky left-0 z-20 bg-slate-100 border-r border-slate-200 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
        <span className="text-xs font-black text-slate-900">{label}</span>
        {subLabel && <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{subLabel}</div>}
      </td>
      {values.map((v, i) => {
        const color = accent === 'green' ? (v >= 0 ? 'text-emerald-600' : 'text-rose-600')
          : accent === 'blue' ? 'text-blue-600' : 'text-slate-900';
        return (
          <td key={i} className={`py-3.5 px-3 text-right whitespace-nowrap font-black ${color}`}>
            <span className="text-sm">{formatVal(v)}</span>
            {percentages && <div className="text-[10px] text-slate-400 font-bold mt-0.5">{formatPct(percentages[i])}</div>}
          </td>
        );
      })}
    </tr>
  );

  const DataRow = ({ label, subLabel, children }: {
    label: string; subLabel?: string; children: React.ReactNode;
  }) => (
    <tr className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
      <td className="py-3 px-5 sticky left-0 bg-white z-20 border-r border-slate-100 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {subLabel && <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{subLabel}</div>}
      </td>
      {children}
    </tr>
  );

  const renderOPiU = () => (
    <>
      <SectionHeader label="Доход" values={displayData.map(d => d.totalIncome)} />
      <DataRow label="Всего выручки">
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="revenue" value={displayData[i]?.revenue || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.revenue} isBold />)
        }
      </DataRow>
      <DataRow label="Себестоимость (COGS)">
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="cogs" value={displayData[i]?.cogs || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.cogs} accent="rose" />)
        }
      </DataRow>
      <TotalRow label="Валовая прибыль" values={displayData.map(d => d.grossProfit)} subLabel="Валовая маржинальность" percentages={displayData.map(d => d.grossMargin)} accent="blue" />

      <SectionHeader label="Операционные расходы" values={displayData.map(d => d.marketing)} />
      <DataRow label="Продажи и маркетинг" subLabel="% от Выручки">
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="marketing" value={displayData[i]?.marketing || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.marketing} pct={d.revenue > 0 ? (d.marketing / d.revenue) * 100 : 0} />)
        }
      </DataRow>

      <SectionHeader label="Общие и административные расходы" values={displayData.map(d => d.totalAdminFixed)} />
      <DataRow label="ФОТ (Фонд оплаты труда)" subLabel="Включая налоги на ФОТ">
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="payroll" value={displayData[i]?.payroll || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.payroll} />)
        }
      </DataRow>
      <DataRow label="Расходы на офис и ПО">
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="office" value={displayData[i]?.office || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.office} />)
        }
      </DataRow>
      <DataRow label="Прочие расходы">
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="otherOpex" value={displayData[i]?.otherOpex || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.otherOpex} />)
        }
      </DataRow>
      <DataRow label="Амортизация">
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="depreciation" value={displayData[i]?.depreciation || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.depreciation} />)
        }
      </DataRow>
      <TotalRow label="Итого расходов (OpEx + COGS)" values={displayData.map(d => d.totalOpex + d.cogs)} subLabel="% от Выручки" percentages={displayData.map(d => d.revenue > 0 ? ((d.totalOpex + d.cogs) / d.revenue) * 100 : 0)} />

      <SectionHeader label="Прибыль" values={displayData.map(d => d.netProfit)} />
      <TotalRow label="EBITDA" values={displayData.map(d => d.ebitda)} subLabel="EBITDA маржа" percentages={displayData.map(d => d.ebitdaMargin)} accent="blue" />
      <DataRow label={`Налоги (${(taxRate * 100).toFixed(0)}%)`}>
        {grouping === 'monthly'
          ? monthlyData.map((md, i) => <InlineInput key={md.month} month={md.month} field="taxes" value={displayData[i]?.taxes || 0} />)
          : displayData.map((d, i) => <ValueCell key={i} value={d.taxes} accent="rose" />)
        }
      </DataRow>
      <TotalRow label="Чистая прибыль" values={displayData.map(d => d.netProfit)} subLabel="Чистая маржа" percentages={displayData.map(d => d.netMargin)} accent="green" />

      {breakEvenMonth >= 0 && grouping === 'monthly' && (
        <tr className="bg-emerald-50/60 border-t-2 border-emerald-200">
          <td className="py-3.5 px-5 sticky left-0 z-20 bg-emerald-50 border-r border-emerald-100 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
            <span className="text-xs font-black text-emerald-700">Точка безубыточности</span>
            <div className="text-[10px] text-emerald-500 font-bold mt-0.5">
              Выход в плюс: {months[breakEvenMonth]?.label}
            </div>
          </td>
          {displayData.map((_d, i) => {
            let cumulative = 0;
            for (let j = 0; j <= i; j++) cumulative += displayData[j].netProfit;
            return (
              <td key={i} className={`py-3.5 px-3 text-right whitespace-nowrap font-black text-sm ${cumulative >= 0 ? 'text-emerald-600' : 'text-rose-400'}`}>
                {formatVal(cumulative)}
              </td>
            );
          })}
        </tr>
      )}
    </>
  );

  const renderDDS = () => {
    const customOperatingRows = customDdsRows.filter(r => r.section === 'operating_outflow');
    const customInvestingRows = customDdsRows.filter(r => r.section === 'investing');
    const customFinancingRows = customDdsRows.filter(r => r.section === 'financing');

    return (
      <>
        <SectionHeader label="Операционная деятельность" values={ddsData.map(d => d.operatingNet)} />
        <DataRow label="Поступления от клиентов" subLabel="Фактические оплаты">
          {ddsData.map((d, i) => <ValueCell key={i} value={d.inflow} accent="green" />)}
        </DataRow>
        <DataRow label="Выплата зарплат (ФОТ)" subLabel="Фактические переводы">
          {grouping === 'monthly'
            ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field="dds_salaryOut" value={d.salaryOut} />)
            : ddsData.map((d, i) => <ValueCell key={i} value={-d.salaryOut} accent="rose" />)
          }
        </DataRow>
        {ddsData.some(d => d.accruedPayroll > 0) && (
          <tr className="hover:bg-amber-50/30 transition-colors border-b border-slate-50">
            <td className="py-3 px-5 sticky left-0 bg-amber-50/20 z-20 border-r border-slate-100 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
              <span className="text-sm font-semibold text-amber-700">Начислено ФОТ (ведомость)</span>
              <div className="text-[10px] text-amber-500 font-semibold mt-0.5">Разница = долг по зарплатам</div>
            </td>
            {ddsData.map((d, i) => {
              const delta = d.accruedPayroll - d.salaryOut;
              return (
                <td key={i} className="py-3 px-3 text-right whitespace-nowrap">
                  <span className="text-sm font-semibold text-amber-700">{formatVal(d.accruedPayroll)}</span>
                  {delta !== 0 && (
                    <div className={`text-[10px] font-bold mt-0.5 ${delta > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {delta > 0 ? 'Долг: ' : 'Переплата: '}{formatVal(Math.abs(delta))}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        )}
        <DataRow label="Маркетинг и реклама">
          {grouping === 'monthly'
            ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field="dds_marketingOut" value={d.marketingOut} />)
            : ddsData.map((d, i) => <ValueCell key={i} value={-d.marketingOut} accent="rose" />)
          }
        </DataRow>
        <DataRow label="Офис и ПО">
          {grouping === 'monthly'
            ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field="dds_officeOut" value={d.officeOut} />)
            : ddsData.map((d, i) => <ValueCell key={i} value={-d.officeOut} accent="rose" />)
          }
        </DataRow>
        <DataRow label="Прочие выплаты">
          {grouping === 'monthly'
            ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field="dds_otherOut" value={d.otherOut} />)
            : ddsData.map((d, i) => <ValueCell key={i} value={-d.otherOut} accent="rose" />)
          }
        </DataRow>

        {customOperatingRows.map(cr => (
          <tr key={cr.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
            <td className="py-3 px-5 sticky left-0 bg-white z-20 border-r border-slate-100 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{cr.name}</span>
                {isEditMode && (
                  <button onClick={() => handleRemoveCustomDdsRow(cr.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="Удалить строку">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </td>
            {grouping === 'monthly'
              ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field={`custom_${cr.id}`} value={d.customRowValues[cr.id] || 0} />)
              : ddsData.map((d, i) => <ValueCell key={i} value={-(d.customRowValues[cr.id] || 0)} accent="rose" />)
            }
          </tr>
        ))}

        <TotalRow label="Итого операционный ДДС" subLabel="Поступления минус выплаты" values={ddsData.map(d => d.operatingNet)} accent="blue" />

        <SectionHeader label="Инвестиционная деятельность" values={ddsData.map(d => d.investingFlow)} />
        <DataRow label="Капитальные затраты (CAPEX)">
          {grouping === 'monthly'
            ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field="ddsCapex" value={d.ddsCapex} />)
            : ddsData.map((d, i) => <ValueCell key={i} value={-d.ddsCapex} accent="rose" />)
          }
        </DataRow>
        {customInvestingRows.map(cr => (
          <tr key={cr.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
            <td className="py-3 px-5 sticky left-0 bg-white z-20 border-r border-slate-100 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{cr.name}</span>
                {isEditMode && (
                  <button onClick={() => handleRemoveCustomDdsRow(cr.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="Удалить строку">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </td>
            {grouping === 'monthly'
              ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field={`custom_${cr.id}`} value={d.customRowValues[cr.id] || 0} />)
              : ddsData.map((d, i) => <ValueCell key={i} value={-(d.customRowValues[cr.id] || 0)} accent="rose" />)
            }
          </tr>
        ))}

        <SectionHeader label="Финансовая деятельность" values={ddsData.map(d => d.financingFlow)} />
        <DataRow label="Кредиты / Займы / Дивиденды">
          {grouping === 'monthly'
            ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field="ddsFinancing" value={d.ddsFinancing} />)
            : ddsData.map((d, i) => <ValueCell key={i} value={d.ddsFinancing} />)
          }
        </DataRow>
        {customFinancingRows.map(cr => (
          <tr key={cr.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
            <td className="py-3 px-5 sticky left-0 bg-white z-20 border-r border-slate-100 min-w-[280px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{cr.name}</span>
                {isEditMode && (
                  <button onClick={() => handleRemoveCustomDdsRow(cr.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="Удалить строку">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </td>
            {grouping === 'monthly'
              ? ddsData.map((d, i) => <InlineInput key={d.monthKeys[0]} month={d.monthKeys[0]} field={`custom_${cr.id}`} value={d.customRowValues[cr.id] || 0} />)
              : ddsData.map((d, i) => <ValueCell key={i} value={d.customRowValues[cr.id] || 0} />)
            }
          </tr>
        ))}

        <TotalRow label="Чистый денежный поток за период" values={ddsData.map(d => d.totalFlow)} accent="green" />

        <SectionHeader label="Остаток денежных средств" values={ddsData.map(d => d.endBalance)} />
        <DataRow label="На начало периода">
          {ddsData.map((d, i) => <ValueCell key={i} value={d.startBalance} />)}
        </DataRow>
        <DataRow label="Движение за период">
          {ddsData.map((d, i) => <ValueCell key={i} value={d.totalFlow} accent="green" />)}
        </DataRow>
        <TotalRow label="На конец периода" values={ddsData.map(d => d.endBalance)} accent="green" />
      </>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-screen bg-white animate-fade-in">
      <div className="px-5 lg:px-8 py-4 lg:py-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4 border-b border-slate-200 shrink-0 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Финансовая модель</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewType('opiu')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewType === 'opiu' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ОПиУ
            </button>
            <button
              onClick={() => setViewType('dds')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewType === 'dds' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ДДС
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as 'monthly' | 'quarterly')}
            className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value="monthly">Ежемесячно</option>
            <option value="quarterly">Квартально</option>
          </select>

          <button
            onClick={() => setIsEditingDates(!isEditingDates)}
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 hover:bg-slate-100 transition-all cursor-pointer text-sm"
          >
            <span className="font-bold text-slate-400">Период:</span>
            <span className="font-bold text-slate-800">
              {startDate.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace('.', '')} - {endDate.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace('.', '')}
            </span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowTaxSettings(!showTaxSettings)}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 hover:bg-slate-100 transition-all cursor-pointer text-sm"
            >
              <span className="font-bold text-slate-400">Налог:</span>
              <span className="font-bold text-slate-800">{(taxRate * 100).toFixed(0)}%</span>
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showTaxSettings && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50 min-w-[200px]">
                {TAX_RATE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleTaxRateChange(opt.value)}
                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${taxRate === opt.value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="border-t border-slate-100 px-4 py-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Своя ставка (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue={(taxRate * 100).toFixed(0)}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      handleTaxRateChange(v / 100);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}
          </div>

          {isEditMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditValues({}); setIsEditMode(false); }}
                className="px-5 py-2.5 rounded-lg text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
              className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-black transition-all"
            >
              Редактирование
            </button>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="px-5 lg:px-8 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-sm font-bold text-blue-700">
              Режим редактирования: вводите значения прямо в таблице. Итоги рассчитываются автоматически.
            </span>
          </div>
          {viewType === 'dds' && (
            <button
              onClick={() => setShowAddDdsRow(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4" /></svg>
              Добавить статью
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white financial-model-scroll">
        <table className="w-full border-collapse min-w-max">
          <thead className="sticky top-0 z-30 bg-white">
            <tr className="border-b-2 border-slate-200">
              <th className="py-3.5 px-5 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider bg-white min-w-[280px] sticky left-0 z-40 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)] border-r border-slate-200">
                Статья
              </th>
              {periods.map((m, i) => (
                <th key={m.key} className={`py-3.5 px-3 text-right text-[11px] font-black uppercase tracking-wider bg-white whitespace-nowrap ${breakEvenMonth === i && grouping === 'monthly' ? 'text-emerald-600' : 'text-slate-500'}`} style={{ minWidth: isEditable ? '160px' : '140px' }}>
                  {m.label}
                  {breakEvenMonth === i && grouping === 'monthly' && (
                    <div className="text-[9px] text-emerald-500 font-black mt-0.5">BEP</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {viewType === 'opiu' ? renderOPiU() : renderDDS()}
          </tbody>
        </table>
      </div>

      <div className="bg-white border-t border-slate-200 px-5 lg:px-8 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
        <div className="flex gap-5">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Данные ERP</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> План / Прогноз</span>
          {isEditMode && <span className="flex items-center gap-1.5 text-blue-600"><div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" /> Редактируемые ячейки</span>}
        </div>
        <span className="text-[9px]">v4.0 Financial Kernel</span>
      </div>

      {isEditingDates && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsEditingDates(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-6">Изменить период</h3>
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsEditingDates(false)}
                className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all"
              >
                Применить
              </button>
              <button
                onClick={() => setIsEditingDates(false)}
                className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddDdsRow && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddDdsRow(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-2">Добавить статью расходов</h3>
            <p className="text-sm text-slate-500 mb-6">Создайте свою строку в отчете ДДС</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Название статьи</label>
                <input
                  type="text"
                  value={newDdsRowName}
                  onChange={(e) => setNewDdsRowName(e.target.value)}
                  placeholder="Например: Аренда офиса, Транспорт..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomDdsRow(); }}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Раздел ДДС</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'operating_outflow' as const, label: 'Операционная деятельность', desc: 'Регулярные расходы бизнеса' },
                    { value: 'investing' as const, label: 'Инвестиционная деятельность', desc: 'Покупка активов, оборудования' },
                    { value: 'financing' as const, label: 'Финансовая деятельность', desc: 'Кредиты, займы, дивиденды' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setNewDdsRowSection(opt.value)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${newDdsRowSection === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="text-sm font-bold text-slate-800">{opt.label}</span>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddCustomDdsRow}
                disabled={!newDdsRowName.trim()}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                Добавить
              </button>
              <button
                onClick={() => setShowAddDdsRow(false)}
                className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
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
