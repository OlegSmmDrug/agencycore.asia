import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Client, User, Transaction, ClientStatus } from '../../types';
import { financialEngineService, PipelineForecast } from '../../services/financialEngineService';
import { marketingChannelService, SalesTarget } from '../../services/marketingChannelService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell, AreaChart, Area } from 'recharts';
import SalesFunnel from './sales/SalesFunnel';
import ManagerTable from './sales/ManagerTable';
import PipelineCard from './sales/PipelineCard';

interface SalesTabProps {
  clients: Client[];
  users: User[];
  transactions: Transaction[];
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
  LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
  VALUE: "text-2xl font-black text-slate-900 tracking-tighter"
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Все время' },
  { value: 'month', label: 'Текущий месяц' },
  { value: 'quarter', label: 'Текущий квартал' },
  { value: 'prev_month', label: 'Прошлый месяц' },
];

function getPeriodRange(period: string): { start: Date; end: Date } | null {
  const now = new Date();
  if (period === 'all') return null;
  if (period === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  }
  if (period === 'prev_month') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
  }
  if (period === 'quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), qStart, 1), end: new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59) };
  }
  return null;
}

const SalesTab: React.FC<SalesTabProps> = ({ clients, users, transactions }) => {
  const [payrollCosts, setPayrollCosts] = useState<Record<string, number>>({});
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);
  const [period, setPeriod] = useState('all');
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [cacData, setCacData] = useState<{ cac: number; totalSpend: number; source: string }>({ cac: 0, totalSpend: 0, source: 'transactions' });
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  useEffect(() => {
    financialEngineService.loadPayrollCostPerUser(currentMonth).then(setPayrollCosts);
    marketingChannelService.getSalesTargets(currentMonth).then(setSalesTargets);
    financialEngineService.calcMarketingCAC(clients, transactions).then(setCacData);
  }, [currentMonth, clients, transactions]);

  const periodRange = useMemo(() => getPeriodRange(period), [period]);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (periodRange) {
      result = result.filter(c => {
        const d = new Date(c.createdAt);
        return d >= periodRange.start && d <= periodRange.end;
      });
    }
    if (selectedManager) {
      result = result.filter(c => c.managerId === selectedManager);
    }
    return result;
  }, [clients, periodRange, selectedManager]);

  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (periodRange) {
      result = result.filter(t => {
        const d = new Date(t.date);
        return d >= periodRange.start && d <= periodRange.end;
      });
    }
    if (selectedManager) {
      const managerClientIds = new Set(clients.filter(c => c.managerId === selectedManager).map(c => c.id));
      result = result.filter(t => t.clientId && managerClientIds.has(t.clientId));
    }
    return result;
  }, [transactions, periodRange, selectedManager, clients]);

  const allClientsForPipeline = useMemo(() => {
    if (selectedManager) return clients.filter(c => c.managerId === selectedManager);
    return clients;
  }, [clients, selectedManager]);

  const salesData = useMemo(() => {
    const fc = filteredClients;
    const newLeads = fc.filter(c => c.status === ClientStatus.NEW_LEAD).length;
    const contacted = fc.filter(c => c.status === ClientStatus.CONTACTED).length;
    const presentation = fc.filter(c => c.status === ClientStatus.PRESENTATION).length;
    const contractSigning = fc.filter(c => c.status === ClientStatus.CONTRACT).length;
    const inWork = fc.filter(c => c.status === ClientStatus.IN_WORK).length;
    const won = fc.filter(c => c.status === ClientStatus.WON).length;
    const lost = fc.filter(c => c.status === ClientStatus.LOST).length;

    const totalLeads = fc.filter(c => c.status !== ('Archived' as any)).length;
    const activeClients = inWork + won;
    const contractsTotal = contractSigning + inWork + won;

    const funnel = [
      { name: 'Новые лиды', key: 'new_lead', value: newLeads, fill: '#94a3b8' },
      { name: 'Контакт установлен', key: 'contacted', value: contacted, fill: '#60a5fa' },
      { name: 'Презентация', key: 'presentation', value: presentation, fill: '#3b82f6' },
      { name: 'Подписание договора', key: 'contract', value: contractSigning, fill: '#f59e0b' },
      { name: 'В работе', key: 'in_work', value: inWork, fill: '#10b981' },
      { name: 'Закрыт (Won)', key: 'won', value: won, fill: '#059669' },
    ];

    const overallConversion = totalLeads > 0 ? (activeClients / totalLeads) * 100 : 0;
    const lostRate = totalLeads > 0 ? (lost / totalLeads) * 100 : 0;

    const clientRevenue: Record<string, number> = {};
    filteredTransactions.filter(t => t.amount > 0).forEach(t => {
      if (t.clientId) clientRevenue[t.clientId] = (clientRevenue[t.clientId] || 0) + t.amount;
    });

    const managerPerformance = users
      .filter(u => financialEngineService.isSalesRole(u.jobTitle))
      .map(u => {
        const mc = fc.filter(c => c.managerId === u.id);
        const allManagerClients = clients.filter(c => c.managerId === u.id);
        const mWon = mc.filter(c => [ClientStatus.WON, ClientStatus.IN_WORK, ClientStatus.CONTRACT].includes(c.status));
        const rev = allManagerClients.reduce((s, c) => s + (clientRevenue[c.id] || 0), 0);
        const cost = payrollCosts[u.id] || 0;
        const target = salesTargets.find(t => t.userId === u.id);

        let avgDaysToClose = 0;
        const wonWithDates = mWon.filter(c => c.createdAt && c.statusChangedAt);
        if (wonWithDates.length > 0) {
          const totalDays = wonWithDates.reduce((s, c) => {
            const days = Math.floor((new Date(c.statusChangedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000);
            return s + (days > 0 && days < 365 ? days : 0);
          }, 0);
          avgDaysToClose = Math.round(totalDays / wonWithDates.length);
        }

        return {
          id: u.id,
          name: u.name,
          revenue: rev,
          leads: mc.length,
          won: mWon.length,
          lost: mc.filter(c => c.status === ClientStatus.LOST).length,
          cost,
          avgDaysToClose,
          revenueTarget: target?.revenueTarget || 0,
        };
      })
      .map(m => ({
        ...m,
        conversion: m.leads > 0 ? (m.won / m.leads) * 100 : 0,
        avgCheck: m.won > 0 ? m.revenue / m.won : 0,
        roi: m.cost > 0 ? ((m.revenue / m.cost) - 1) * 100 : 0,
        planPercent: m.revenueTarget > 0 ? (m.revenue / m.revenueTarget) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totals = managerPerformance.reduce((acc, m) => ({
      revenue: acc.revenue + m.revenue,
      leads: acc.leads + m.leads,
      won: acc.won + m.won,
      lost: acc.lost + m.lost,
      cost: acc.cost + m.cost,
    }), { revenue: 0, leads: 0, won: 0, lost: 0, cost: 0 });

    const avgDealSize = activeClients > 0
      ? filteredTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0) / activeClients : 0;

    return {
      funnel, managerPerformance, totals,
      cac: cacData.cac, cacSource: cacData.source,
      overallConversion, lostRate, totalLeads, activeClients, lost, avgDealSize, contractsTotal
    };
  }, [filteredClients, filteredTransactions, users, payrollCosts, salesTargets, clients, cacData]);

  const pipeline = useMemo(() => financialEngineService.calcPipelineForecast(allClientsForPipeline, salesData.avgDealSize), [allClientsForPipeline, salesData.avgDealSize]);
  const pipelineTotal = useMemo(() => pipeline.reduce((s, p) => s + p.weightedValue, 0), [pipeline]);
  const salesCycle = useMemo(() => financialEngineService.calcSalesCycle(allClientsForPipeline), [allClientsForPipeline]);

  const leadsByMonth = useMemo(() => {
    const baseClients = selectedManager ? clients.filter(c => c.managerId === selectedManager) : clients;
    const months: Record<string, number> = {};
    baseClients.forEach(c => {
      const m = c.createdAt?.slice(0, 7);
      if (m) months[m] = (months[m] || 0) + 1;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, count]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      leads: count,
    }));
  }, [clients, selectedManager]);

  const revenueByMonth = useMemo(() => {
    const baseTx = selectedManager
      ? transactions.filter(t => {
          const managerClients = new Set(clients.filter(c => c.managerId === selectedManager).map(c => c.id));
          return t.clientId && managerClients.has(t.clientId);
        })
      : transactions;
    const months: Record<string, number> = {};
    baseTx.filter(t => t.amount > 0).forEach(t => {
      const m = t.date?.slice(0, 7);
      if (m) months[m] = (months[m] || 0) + t.amount;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, revenue]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      revenue: Math.round(revenue),
    }));
  }, [transactions, clients, selectedManager]);

  const leadsBySource = useMemo(() => {
    const baseClients = selectedManager ? clients.filter(c => c.managerId === selectedManager) : clients;
    const sources: Record<string, number> = {};
    baseClients.forEach(c => {
      const src = c.source || 'Other';
      sources[src] = (sources[src] || 0) + 1;
    });
    const colors: Record<string, string> = {
      Website: '#3b82f6', Referral: '#10b981', 'Cold Call': '#f59e0b',
      Socials: '#ec4899', Creatium: '#06b6d4', Other: '#94a3b8', Manual: '#64748b',
    };
    return Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([source, count]) => ({
      source, count, fill: colors[source] || '#94a3b8',
    }));
  }, [clients, selectedManager]);

  const stalledDeals = useMemo(() => {
    const now = new Date();
    const stalled = allClientsForPipeline
      .filter(c => c.status !== ClientStatus.IN_WORK && c.status !== ClientStatus.WON && c.status !== ClientStatus.LOST && c.status !== ('Archived' as any))
      .filter(c => {
        const lastUpdate = new Date(c.statusChangedAt || c.createdAt);
        return (now.getTime() - lastUpdate.getTime()) / 86400000 > 7;
      })
      .map(c => {
        const days = Math.floor((now.getTime() - new Date(c.statusChangedAt || c.createdAt).getTime()) / 86400000);
        const manager = users.find(u => u.id === c.managerId);
        return { id: c.id, name: c.name || c.company || 'Без имени', status: c.status, days, manager: manager?.name || '--' };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);
    return stalled;
  }, [allClientsForPipeline, users]);

  const handleManagerClick = useCallback((managerId: string) => {
    setSelectedManager(prev => prev === managerId ? null : managerId);
  }, []);

  const selectedManagerName = selectedManager ? users.find(u => u.id === selectedManager)?.name : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                period === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {selectedManager && (
          <button
            onClick={() => setSelectedManager(null)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-blue-200 hover:bg-blue-100 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {selectedManagerName}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Всего лидов', value: salesData.totalLeads, color: 'text-slate-900' },
          { label: 'Активных клиентов', value: salesData.activeClients, color: 'text-emerald-600' },
          { label: 'Конверсия', value: `${salesData.overallConversion.toFixed(1)}%`, color: salesData.overallConversion > 20 ? 'text-emerald-600' : salesData.overallConversion > 10 ? 'text-blue-600' : 'text-amber-600' },
          { label: 'Потеряно', value: salesData.lost, color: 'text-rose-600', sub: `${salesData.lostRate.toFixed(0)}% от всех` },
          { label: 'Цикл сделки', value: salesCycle.avgDays > 0 ? `${salesCycle.avgDays} дн.` : '--', color: 'text-blue-600' },
          { label: 'CAC', value: salesData.cac > 0 ? fmt(salesData.cac) : 'Нет данных', color: salesData.cac > 0 ? 'text-slate-900' : 'text-slate-400', sub: salesData.cac === 0 ? 'Добавьте данные в Маркетинг' : undefined },
        ].map((kpi, i) => (
          <div key={i} className={UI.CARD}>
            <p className={UI.LABEL}>{kpi.label}</p>
            <p className={`text-2xl font-black tracking-tighter ${kpi.color}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5">
          <SalesFunnel funnel={salesData.funnel} cac={salesData.cac} avgDealSize={salesData.avgDealSize} />
        </div>
        <div className="xl:col-span-7">
          <ManagerTable
            managers={salesData.managerPerformance}
            totals={salesData.totals}
            selectedManager={selectedManager}
            onManagerClick={handleManagerClick}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PipelineCard pipeline={pipeline} pipelineTotal={pipelineTotal} />

        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" /> Динамика лидов и выручки
          </h3>
          {leadsByMonth.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leadsByMonth.map((l, i) => ({
                  ...l,
                  revenue: revenueByMonth[i]?.revenue || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 11, fontWeight: 700 }}
                    formatter={(value: any, name: string) => [
                      name === 'leads' ? value : `${Math.round(value).toLocaleString()} ₸`,
                      name === 'leads' ? 'Лиды' : 'Выручка'
                    ]}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="leads" stroke="#10b981" fill="#10b98120" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                  <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
                  <Legend
                    formatter={(value: string) => <span className="text-[10px] font-bold uppercase tracking-wider">{value === 'leads' ? 'Лиды' : 'Выручка'}</span>}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12"><p className="text-slate-400 text-sm">Нет данных</p></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-cyan-500 rounded-full" /> Источники лидов
          </h3>
          {leadsBySource.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsBySource} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 11, fontWeight: 700 }}
                    formatter={(value: any) => [`${value} лидов`, 'Количество']}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={24}>
                    {leadsBySource.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12"><p className="text-slate-400 text-sm">Нет данных</p></div>
          )}
        </div>

        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full" /> Застрявшие сделки
            {stalledDeals.length > 0 && (
              <span className="ml-auto text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">{stalledDeals.length}</span>
            )}
          </h3>
          {stalledDeals.length > 0 ? (
            <div className="space-y-3">
              {stalledDeals.map((deal, i) => (
                <div key={deal.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{deal.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{deal.manager} / {deal.status}</p>
                  </div>
                  <div className={`text-right shrink-0 ml-3 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                    deal.days > 14 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {deal.days} дн.
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-slate-500 text-sm font-bold">Все сделки в движении</p>
            </div>
          )}
        </div>
      </div>

      {salesData.lostRate > 25 && (
        <div className={`${UI.CARD} border-l-4 border-l-amber-400 bg-amber-50/30`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Высокий уровень потерь клиентов: {salesData.lostRate.toFixed(0)}%</p>
              <p className="text-xs text-slate-600 mt-1">
                Рекомендации: 1) Проанализируйте причины отказа на этапе "Презентация" -- {filteredClients.filter(c => c.status === ClientStatus.PRESENTATION).length} клиентов застряли.
                2) Проверьте скорость реакции менеджеров.
                3) Пересмотрите ценообразование если клиенты уходят после озвучивания стоимости.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;
