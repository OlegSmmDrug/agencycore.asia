import React, { useMemo } from 'react';
import { Client, User, Transaction, ClientStatus } from '../../types';
import { financialEngineService, PipelineForecast } from '../../services/financialEngineService';

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

const SalesTab: React.FC<SalesTabProps> = ({ clients, users, transactions }) => {
  const salesData = useMemo(() => {
    const newLeads = clients.filter(c => c.status === ClientStatus.NEW_LEAD).length;
    const contacted = clients.filter(c => c.status === ClientStatus.CONTACTED).length;
    const presentation = clients.filter(c => c.status === ClientStatus.PRESENTATION).length;
    const contractSigning = clients.filter(c => c.status === ClientStatus.CONTRACT).length;
    const inWork = clients.filter(c => c.status === ClientStatus.IN_WORK).length;
    const won = clients.filter(c => c.status === ClientStatus.WON).length;
    const lost = clients.filter(c => c.status === ClientStatus.LOST).length;

    const totalLeads = clients.filter(c => c.status !== ('Archived' as any)).length;
    const activeClients = inWork + won;
    const contractsTotal = contractSigning + inWork + won;

    const funnel = [
      { name: 'Новые лиды', value: newLeads, fill: '#94a3b8' },
      { name: 'Контакт установлен', value: contacted, fill: '#60a5fa' },
      { name: 'Презентация', value: presentation, fill: '#3b82f6' },
      { name: 'Подписание договора', value: contractSigning, fill: '#f59e0b' },
      { name: 'В работе', value: inWork, fill: '#10b981' },
      { name: 'Закрыт (Won)', value: won, fill: '#059669' },
    ];

    const overallConversion = totalLeads > 0 ? (activeClients / totalLeads) * 100 : 0;
    const lostRate = totalLeads > 0 ? (lost / totalLeads) * 100 : 0;

    const marketingCost = Math.abs(transactions.filter(t => t.category === 'Marketing').reduce((s, t) => s + (t.amount || 0), 0));
    const cac = marketingCost > 0 && contractsTotal > 0 ? marketingCost / contractsTotal : 0;

    const clientRevenue: Record<string, number> = {};
    transactions.filter(t => t.amount > 0).forEach(t => {
      if (t.clientId) clientRevenue[t.clientId] = (clientRevenue[t.clientId] || 0) + t.amount;
    });

    const managerPerformance = users
      .filter(u => u.jobTitle && (u.jobTitle.toLowerCase().includes('sales') || u.jobTitle === 'CEO'))
      .map(u => {
        const mc = clients.filter(c => c.managerId === u.id);
        const mWon = mc.filter(c => [ClientStatus.WON, ClientStatus.IN_WORK, ClientStatus.CONTRACT].includes(c.status));
        const rev = mc.reduce((s, c) => s + (clientRevenue[c.id] || 0), 0);
        return { name: u.name, revenue: rev, leads: mc.length, won: mWon.length, lost: mc.filter(c => c.status === ClientStatus.LOST).length };
      })
      .map(m => ({
        ...m,
        conversion: m.leads > 0 ? (m.won / m.leads) * 100 : 0,
        avgCheck: m.won > 0 ? m.revenue / m.won : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const avgDealSize = activeClients > 0
      ? transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0) / activeClients : 0;

    return { funnel, managerPerformance, cac, overallConversion, lostRate, totalLeads, activeClients, lost, avgDealSize };
  }, [clients, users, transactions]);

  const pipeline = useMemo(() => financialEngineService.calcPipelineForecast(clients), [clients]);
  const pipelineTotal = useMemo(() => pipeline.reduce((s, p) => s + p.weightedValue, 0), [pipeline]);
  const salesCycle = useMemo(() => financialEngineService.calcSalesCycle(clients), [clients]);

  const revenueByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    transactions.filter(t => t.amount > 0).forEach(t => {
      const m = t.date?.slice(0, 7);
      if (m) months[m] = (months[m] || 0) + t.amount;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [transactions]);

  const leadsByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    clients.forEach(c => {
      const m = c.createdAt?.slice(0, 7);
      if (m) months[m] = (months[m] || 0) + 1;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [clients]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Всего лидов</p>
          <p className={UI.VALUE}>{salesData.totalLeads}</p>
        </div>
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Активных клиентов</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tighter">{salesData.activeClients}</p>
        </div>
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Конверсия в клиента</p>
          <p className={`text-2xl font-black tracking-tighter ${
            salesData.overallConversion > 20 ? 'text-emerald-600' : salesData.overallConversion > 10 ? 'text-blue-600' : 'text-amber-600'
          }`}>
            {salesData.overallConversion.toFixed(1)}%
          </p>
        </div>
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Потеряно (Lost)</p>
          <p className="text-2xl font-black text-rose-600 tracking-tighter">{salesData.lost}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{salesData.lostRate.toFixed(0)}% от всех</p>
        </div>
        <div className={UI.CARD}>
          <div className="group relative">
            <p className={UI.LABEL}>
              Цикл сделки
              <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
            </p>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-56 shadow-xl">
              Среднее количество дней от создания лида до перехода в статус "В работе".
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 tracking-tighter">
            {salesCycle.avgDays > 0 ? `${salesCycle.avgDays} дн.` : '--'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className={`${UI.CARD} xl:col-span-5`}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900">Воронка продаж (CRM)</h3>
          <div className="space-y-6">
            {salesData.funnel.map((step, i) => {
              const maxVal = Math.max(...salesData.funnel.map(f => f.value), 1);
              return (
                <div key={i} className="relative">
                  <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase mb-2">
                    <span>{step.name}</span>
                    <span className="text-slate-900">{step.value}</span>
                  </div>
                  <div className="h-5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${(step.value / maxVal) * 100}%`, backgroundColor: step.fill }}
                    />
                  </div>
                  {i < salesData.funnel.length - 1 && step.value > 0 && salesData.funnel[i + 1].value > 0 && (
                    <div className="absolute left-1/2 -bottom-4 -translate-x-1/2 text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      &darr; {Math.round((salesData.funnel[i + 1].value / step.value) * 100)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-8 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">CAC (стоимость клиента)</p>
              <p className="text-lg font-black text-slate-900">
                {salesData.cac > 0 ? fmt(salesData.cac) : 'Нет данных'}
              </p>
              {salesData.cac === 0 && <p className="text-[8px] text-slate-400">Разметьте расходы категорией "Маркетинг"</p>}
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Средний чек</p>
              <p className="text-lg font-black text-slate-900">
                {salesData.avgDealSize > 0 ? fmt(salesData.avgDealSize) : '--'}
              </p>
            </div>
          </div>
        </div>

        <div className={`${UI.CARD} xl:col-span-7`}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900">Эффективность менеджеров продаж</h3>
          {salesData.managerPerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="pb-5 px-4 text-center">#</th>
                    <th className="pb-5">Менеджер</th>
                    <th className="pb-5 text-right">Выручка (факт)</th>
                    <th className="pb-5 text-right">Лиды</th>
                    <th className="pb-5 text-right">Клиенты</th>
                    <th className="pb-5 text-right">Конверсия</th>
                    <th className="pb-5 text-right">Ср. чек</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {salesData.managerPerformance.map((m, i) => (
                    <tr key={i} className="group hover:bg-slate-50/50 transition-all">
                      <td className="py-5 px-4 text-center">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black ${
                          i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                        }`}>{i + 1}</span>
                      </td>
                      <td className="py-5 font-black text-slate-800 text-sm">{m.name}</td>
                      <td className="py-5 text-right font-black text-slate-900">{m.revenue.toLocaleString()} &#8376;</td>
                      <td className="py-5 text-right text-slate-600 text-sm">{m.leads}</td>
                      <td className="py-5 text-right text-emerald-600 font-black text-sm">{m.won}</td>
                      <td className="py-5 text-right">
                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${
                          m.conversion > 30 ? 'bg-emerald-50 text-emerald-600' : m.conversion > 15 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {m.conversion.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-5 text-right text-slate-500 font-mono text-sm">{Math.round(m.avgCheck).toLocaleString()} &#8376;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">Нет данных по менеджерам продаж</p>
              <p className="text-slate-300 text-xs mt-2">Добавьте сотрудников с должностью "Sales manager" или "CEO"</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={UI.CARD}>
          <div className="group relative inline-block">
            <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full" />
              Pipeline прогноз
              <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help">?</span>
            </h3>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-64 shadow-xl">
              Прогноз поступлений на основе текущей воронки. Бюджет клиента умножается на вероятность закрытия сделки на каждом этапе.
            </div>
          </div>
          <div className="space-y-4">
            {pipeline.map((p, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600">{p.stage}</span>
                    <span className="text-[9px] text-slate-400 font-bold">{p.count} кл.</span>
                    <span className="text-[9px] text-blue-500 font-bold">{p.probability}%</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{fmt(p.weightedValue)}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${pipelineTotal > 0 ? (p.weightedValue / pipelineTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-900 uppercase">Итого прогноз</span>
                <span className="text-xl font-black text-blue-600">{fmt(pipelineTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" /> Динамика лидов по месяцам
          </h3>
          {leadsByMonth.length > 0 ? (
            <div className="space-y-3">
              {leadsByMonth.map(([month, count], i) => {
                const maxCount = Math.max(...leadsByMonth.map(([, c]) => c));
                const label = new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
                return (
                  <div key={i}>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                      <span>{label}</span>
                      <span className="text-slate-900 font-black">{count}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">Нет данных</p>
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
                Рекомендации: 1) Проанализируйте причины отказа на этапе "Презентация" -- {clients.filter(c => c.status === ClientStatus.PRESENTATION).length} клиентов застряли.
                2) Проверьте скорость реакции менеджеров -- долгий ответ = потеря лида.
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
