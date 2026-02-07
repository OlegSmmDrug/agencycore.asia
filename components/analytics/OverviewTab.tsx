import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Client, User, Task, Project, Transaction, ProjectStatus, ClientStatus, TaskStatus } from '../../types';
import { financialEngineService, BusinessHealthResult, LtvMetrics, BurnRateResult, PayrollBreakdown } from '../../services/financialEngineService';

interface OverviewTabProps {
  clients: Client[];
  users: User[];
  tasks: Task[];
  projects: Project[];
  transactions: Transaction[];
  unitProjectList: { id: string; name: string; revenue: number; expenses: number; profit: number; margin: number }[];
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
  LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
  VALUE: "text-2xl font-black text-slate-900 tracking-tighter"
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const OverviewTab: React.FC<OverviewTabProps> = ({
  clients, users, tasks, projects, transactions, unitProjectList
}) => {
  const [health, setHealth] = useState<BusinessHealthResult | null>(null);
  const [ltv, setLtv] = useState<LtvMetrics | null>(null);
  const [payrollBreakdown, setPayrollBreakdown] = useState<PayrollBreakdown | null>(null);
  const [payrollTotal, setPayrollTotal] = useState(0);

  const safeTrans = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const overview = useMemo(() => {
    const totalIncome = safeTrans.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalExpenses = Math.abs(safeTrans.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    const now = new Date();
    const thisMonthStart = now.toISOString().slice(0, 7) + '-01';
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonthEnd = nextMonth.toISOString().slice(0, 10);

    const thisMonthIncome = safeTrans
      .filter(t => t.amount > 0 && t.date?.slice(0, 10) >= thisMonthStart && t.date?.slice(0, 10) < thisMonthEnd)
      .reduce((s, t) => s + t.amount, 0);

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = lastMonthDate.toISOString().slice(0, 7) + '-01';
    const lastMonthEnd = thisMonthStart;

    const lastMonthIncome = safeTrans
      .filter(t => t.amount > 0 && t.date?.slice(0, 10) >= lastMonthStart && t.date?.slice(0, 10) < lastMonthEnd)
      .reduce((s, t) => s + t.amount, 0);

    const incomeGrowth = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;

    const monthlyExpenses = Math.abs(safeTrans
      .filter(t => t.amount < 0 && t.date?.slice(0, 10) >= thisMonthStart && t.date?.slice(0, 10) < thisMonthEnd)
      .reduce((s, t) => s + t.amount, 0));

    const salaryFromTx = Math.abs(safeTrans.filter(t => t.category === 'Salary').reduce((s, t) => s + t.amount, 0));
    const salaryExpenses = Math.max(salaryFromTx, payrollTotal);
    const fotPercent = totalIncome > 0 ? (salaryExpenses / totalIncome) * 100 : 0;

    const activeProjects = projects.filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED);
    const activeClients = clients.filter(c => c.status === ClientStatus.IN_WORK || c.status === ClientStatus.WON).length;
    const newLeads = clients.filter(c => c.status === ClientStatus.NEW_LEAD).length;
    const lostClients = clients.filter(c => c.status === ClientStatus.LOST).length;
    const totalLeads = clients.filter(c => c.status !== 'Archived' as any).length;
    const lostRate = totalLeads > 0 ? (lostClients / totalLeads) * 100 : 0;

    return {
      totalIncome, totalExpenses, profit, margin,
      activeProjects: activeProjects.length, activeClients, newLeads, lostClients,
      thisMonthIncome, lastMonthIncome, incomeGrowth,
      monthlyExpenses, salaryExpenses, fotPercent,
      totalEmployees: users.length,
      revPerEmployee: totalIncome / (users.length || 1),
      lostRate,
    };
  }, [safeTrans, projects, clients, users, payrollTotal]);

  const burnRate = useMemo(() => financialEngineService.calcBurnRate(safeTrans), [safeTrans]);

  const ar = useMemo(
    () => financialEngineService.calcAccountsReceivable(clients, safeTrans),
    [clients, safeTrans]
  );

  const pipeline = useMemo(
    () => financialEngineService.calcPipelineForecast(clients),
    [clients]
  );

  const pipelineTotal = useMemo(
    () => pipeline.reduce((s, p) => s + p.weightedValue, 0),
    [pipeline]
  );

  const revenueByMonth = useMemo(() => {
    const months: Record<string, { income: number; expenses: number }> = {};
    safeTrans.forEach(t => {
      const m = t.date?.slice(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { income: 0, expenses: 0 };
      if (t.amount > 0) months[m].income += t.amount;
      else months[m].expenses += Math.abs(t.amount);
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([m, d]) => ({
        month: new Date(m + '-01').toLocaleDateString('ru-RU', { month: 'short' }),
        income: d.income,
        expenses: d.expenses,
        profit: d.income - d.expenses
      }));
  }, [safeTrans]);

  useEffect(() => {
    financialEngineService.loadPayrollBreakdown(currentMonth).then(result => {
      setPayrollTotal(result.total);
      setPayrollBreakdown(result);
    });
  }, [currentMonth]);

  useEffect(() => {
    financialEngineService.calcLtv(clients, safeTrans).then(setLtv);
  }, [clients, safeTrans]);

  useEffect(() => {
    const pnl = financialEngineService.calcPnl(safeTrans, 0, 0);
    const result = financialEngineService.calcBusinessHealth(
      pnl, burnRate, overview.fotPercent, overview.lostRate, ar.total, overview.totalIncome
    );
    setHealth(result);
  }, [safeTrans, burnRate, overview, ar]);

  const problematicProjects = useMemo(() => unitProjectList.filter(p => p.margin < 15), [unitProjectList]);
  const topProjects = useMemo(() => unitProjectList.slice(0, 5), [unitProjectList]);

  return (
    <div className="space-y-6 animate-fade-in">
      {health && (
        <div className={`${UI.CARD} border-l-4 ${
          health.level === 'healthy' ? 'border-l-emerald-500' :
          health.level === 'warning' ? 'border-l-amber-500' : 'border-l-rose-500'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-center gap-4 shrink-0">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white ${
                health.level === 'healthy' ? 'bg-emerald-500' :
                health.level === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
              }`}>
                {health.score}
              </div>
              <div>
                <p className="font-black text-slate-900 text-lg">{health.label}</p>
                <p className="text-xs text-slate-500">Индекс здоровья бизнеса</p>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-3">
              {health.factors.map((f, i) => (
                <div key={i} className="group relative">
                  <div className={`p-3 rounded-xl border ${
                    f.status === 'good' ? 'border-emerald-200 bg-emerald-50' :
                    f.status === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'
                  }`}>
                    <div className={`text-[9px] font-black uppercase ${
                      f.status === 'good' ? 'text-emerald-600' :
                      f.status === 'warning' ? 'text-amber-600' : 'text-rose-600'
                    }`}>{f.name}</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{f.value}</div>
                  </div>
                  <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-56 shadow-xl">
                    {f.tip}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Выручка (этот месяц)</p>
          <p className={UI.VALUE}>{fmt(overview.thisMonthIncome)}</p>
          {overview.incomeGrowth !== 0 && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-2 inline-block ${
              overview.incomeGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {overview.incomeGrowth >= 0 ? '+' : ''}{overview.incomeGrowth.toFixed(0)}% к пр. месяцу
            </span>
          )}
        </div>
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Чистая прибыль (месяц)</p>
          <p className={`text-2xl font-black tracking-tighter ${overview.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmt(overview.thisMonthIncome - overview.monthlyExpenses)}
          </p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Маржа: {overview.margin.toFixed(1)}%</p>
        </div>
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Баланс (Cash)</p>
          <p className={`text-2xl font-black tracking-tighter ${burnRate.currentCash >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
            {fmt(burnRate.currentCash)}
          </p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
            {burnRate.monthlyBurn > 0
              ? `Burn Rate: ${fmt(burnRate.monthlyBurn)}/мес`
              : 'Нет данных по расходам'}
          </p>
        </div>
        <div className={UI.CARD}>
          <div className="group relative">
            <p className={UI.LABEL}>
              Запас прочности
              <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
            </p>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-56 shadow-xl">
              На сколько месяцев хватит текущих средств при текущем уровне расходов (без учета новых поступлений).
            </div>
          </div>
          <p className={`text-2xl font-black tracking-tighter ${
            burnRate.runway > 3 ? 'text-emerald-600' : burnRate.runway > 1 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {burnRate.monthlyBurn > 0
              ? `${burnRate.runway.toFixed(1)} мес.`
              : '--'}
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3">
            <div
              className={`h-full rounded-full transition-all ${
                burnRate.runway > 3 ? 'bg-emerald-500' : burnRate.runway > 1 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, (burnRate.runway / 6) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Воронка продаж</p>
          <div className="flex items-end gap-3 mt-2">
            <div className="text-center">
              <p className="text-lg font-black text-slate-900">{overview.newLeads}</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Новых лидов</p>
            </div>
            <div className="text-slate-300 text-lg">&rarr;</div>
            <div className="text-center">
              <p className="text-lg font-black text-emerald-600">{overview.activeClients}</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Клиентов</p>
            </div>
            <div className="text-slate-300 text-lg">|</div>
            <div className="text-center">
              <p className="text-lg font-black text-rose-600">{overview.lostClients}</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Потеряно</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="group relative">
              <p className="text-[9px] font-bold text-slate-400 uppercase">
                Pipeline прогноз
                <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
              </p>
              <div className="hidden group-hover:block absolute left-0 bottom-full mb-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-56 shadow-xl">
                Ожидаемая выручка из текущей воронки с учетом вероятности закрытия на каждом этапе.
              </div>
            </div>
            <p className="text-lg font-black text-blue-600 mt-1">{fmt(pipelineTotal)}</p>
          </div>
        </div>

        <div className={UI.CARD}>
          <p className={UI.LABEL}>ФОТ / Выручка</p>
          <p className={`text-2xl font-black tracking-tighter ${
            overview.fotPercent > 40 ? 'text-rose-600' : overview.fotPercent > 25 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {overview.fotPercent.toFixed(1)}%
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3">
            <div
              className={`h-full rounded-full transition-all ${
                overview.fotPercent > 40 ? 'bg-rose-500' : overview.fotPercent > 25 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, overview.fotPercent)}%` }}
            />
          </div>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-1.5">Норма для агентства: 25-35%</p>
          {payrollBreakdown && payrollBreakdown.total > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-slate-500 font-bold">Оклады</span>
                <span className="text-[10px] font-black text-slate-700">{fmt(payrollBreakdown.fixSalary)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-slate-500 font-bold">KPI</span>
                <span className="text-[10px] font-black text-blue-600">{fmt(payrollBreakdown.kpiEarned)}</span>
              </div>
              {payrollBreakdown.bonuses > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 font-bold">Бонусы</span>
                  <span className="text-[10px] font-black text-emerald-600">{fmt(payrollBreakdown.bonuses)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                <span className="text-[9px] text-slate-400 font-bold">{payrollBreakdown.employeeCount} чел.</span>
                <span className="text-[10px] font-black text-slate-900">{fmt(payrollBreakdown.total)}</span>
              </div>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Сотрудников</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-lg font-black text-slate-900">{overview.totalEmployees}</p>
              <p className="text-[10px] text-slate-400 font-bold mb-0.5">{fmt(overview.revPerEmployee)} / чел</p>
            </div>
          </div>
        </div>

        <div className={UI.CARD}>
          <div className="group relative">
            <p className={UI.LABEL}>
              Дебиторская задолженность
              <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
            </p>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-60 shadow-xl">
              Сумма, которую должны вам клиенты. Разница между бюджетом проекта и фактически оплаченными суммами.
            </div>
          </div>
          <p className={`text-2xl font-black tracking-tighter ${
            ar.total === 0 ? 'text-emerald-600' : ar.total > overview.thisMonthIncome * 0.5 ? 'text-rose-600' : 'text-amber-600'
          }`}>
            {fmt(ar.total)}
          </p>
          {ar.buckets.some(b => b.amount > 0) && (
            <div className="mt-3 space-y-1.5">
              {ar.buckets.filter(b => b.amount > 0).map((b, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 font-bold">{b.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400">{b.count} кл.</span>
                    <span className={`text-[10px] font-black ${
                      b.label.includes('90') ? 'text-rose-600' : b.label.includes('61') ? 'text-amber-600' : 'text-slate-700'
                    }`}>{fmt(b.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {ltv && ltv.ltv > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={UI.CARD}>
            <div className="group relative">
              <p className={UI.LABEL}>
                LTV клиента
                <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
              </p>
              <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-56 shadow-xl">
                Lifetime Value -- сколько в среднем приносит один клиент за все время работы.
              </div>
            </div>
            <p className="text-2xl font-black text-blue-600 tracking-tighter">{fmt(ltv.ltv)}</p>
          </div>
          <div className={UI.CARD}>
            <p className={UI.LABEL}>Ср. время жизни клиента</p>
            <p className={UI.VALUE}>{ltv.avgLifespanMonths.toFixed(1)} мес.</p>
          </div>
          <div className={UI.CARD}>
            <p className={UI.LABEL}>Ср. выручка / мес / клиент</p>
            <p className={UI.VALUE}>{fmt(ltv.avgMonthlyRevenue)}</p>
          </div>
          <div className={UI.CARD}>
            <div className="group relative">
              <p className={UI.LABEL}>
                LTV / CAC
                <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
              </p>
              <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-56 shadow-xl">
                Соотношение LTV к стоимости привлечения клиента. Выше 3x -- отлично, 1-3x -- нормально, ниже 1x -- убыточно.
              </div>
            </div>
            <p className={`text-2xl font-black tracking-tighter ${
              ltv.cacToLtv > 3 ? 'text-emerald-600' : ltv.cacToLtv > 1 ? 'text-blue-600' : 'text-rose-600'
            }`}>
              {ltv.cacToLtv > 0 ? `${ltv.cacToLtv.toFixed(1)}x` : 'Нет данных'}
            </p>
            {ltv.cacToLtv === 0 && (
              <p className="text-[8px] text-slate-400 mt-1">Разметьте расходы категорией "Маркетинг"</p>
            )}
          </div>
        </div>
      )}

      {revenueByMonth.length > 1 && (
        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-600 rounded-full" /> Динамика доходов и расходов
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(v: number) => fmt(v)}
                />
                <Bar dataKey="income" name="Доходы" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={30} />
                <Bar dataKey="expenses" name="Расходы" fill="#f87171" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {ar.debtors.length > 0 && (
        <div className={`${UI.CARD} border-l-4 border-l-amber-400`}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-4 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full" /> Топ дебиторов
          </h3>
          <div className="space-y-3">
            {ar.debtors.slice(0, 5).map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-bold text-slate-800">{d.name}</p>
                  <p className="text-[9px] text-slate-400">
                    {d.daysSinceLastPayment < 999 ? `Последний платеж: ${d.daysSinceLastPayment} дн. назад` : 'Платежей не было'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${
                  d.daysSinceLastPayment > 60 ? 'bg-rose-100 text-rose-700' :
                  d.daysSinceLastPayment > 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {fmt(d.debt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {problematicProjects.length > 0 && (
        <div className={`${UI.CARD} border-l-4 border-l-rose-400`}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-4 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-rose-500 rounded-full" /> Проекты требующие внимания (маржа ниже 15%)
          </h3>
          <div className="space-y-3">
            {problematicProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-bold text-slate-800">{p.name}</p>
                  <p className="text-[9px] text-slate-400">
                    Выручка: {(p.revenue / 1000).toFixed(0)}k | Расходы: {(p.expenses / 1000).toFixed(0)}k
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${
                  p.margin < 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {p.margin.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topProjects.length > 0 && (
        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-4 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" /> Топ-5 проектов по прибыли
          </h3>
          <div className="space-y-3">
            {topProjects.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black ${
                    i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                  }`}>{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{p.name}</p>
                    <p className="text-[9px] text-slate-400">Прибыль: {(p.profit / 1000).toFixed(0)}k</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${
                  p.margin >= 30 ? 'bg-emerald-50 text-emerald-600' : p.margin >= 15 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {p.margin.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
