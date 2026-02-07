import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, Transaction, ClientStatus } from '../../types';
import { marketingChannelService, MarketingChannel, MarketingSpend, ChannelPerformance } from '../../services/marketingChannelService';
import { financialEngineService } from '../../services/financialEngineService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, Legend, PieChart, Pie } from 'recharts';
import ChannelTable from './marketing/ChannelTable';
import AddChannelModal from './marketing/AddChannelModal';
import SpendEntryModal from './marketing/SpendEntryModal';

interface MarketingTabProps {
  clients: Client[];
  transactions: Transaction[];
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
  LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
  VALUE: "text-2xl font-black text-slate-900 tracking-tighter",
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const MarketingTab: React.FC<MarketingTabProps> = ({ clients, transactions }) => {
  const [channels, setChannels] = useState<MarketingChannel[]>([]);
  const [spendData, setSpendData] = useState<MarketingSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showSpendEntry, setShowSpendEntry] = useState<MarketingChannel | null>(null);
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ch, sp] = await Promise.all([
      marketingChannelService.getChannels(),
      marketingChannelService.getSpendRange(getMonthsAgo(5), currentMonth),
    ]);
    setChannels(ch);
    setSpendData(sp);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const currentMonthSpend = useMemo(() => spendData.filter(s => s.month === currentMonth), [spendData, currentMonth]);

  const totalSpend = useMemo(() => currentMonthSpend.reduce((s, sp) => s + sp.amount, 0), [currentMonthSpend]);
  const totalLeadsFromSpend = useMemo(() => currentMonthSpend.reduce((s, sp) => s + sp.leadsCount, 0), [currentMonthSpend]);

  const monthClients = useMemo(() => {
    const start = new Date(currentMonth + '-01');
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return clients.filter(c => {
      const d = new Date(c.createdAt);
      return d >= start && d <= end;
    });
  }, [clients, currentMonth]);

  const monthRevenue = useMemo(() => {
    const start = currentMonth + '-01';
    const endDate = new Date(currentMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().slice(0, 10);
    return transactions.filter(t => t.amount > 0 && t.date >= start && t.date < end).reduce((s, t) => s + t.amount, 0);
  }, [transactions, currentMonth]);

  const newClientsWon = useMemo(() =>
    monthClients.filter(c => [ClientStatus.IN_WORK, ClientStatus.WON, ClientStatus.CONTRACT].includes(c.status)).length,
  [monthClients]);

  const totalLeads = totalLeadsFromSpend || monthClients.length;
  const cpl = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : 0;
  const cac = newClientsWon > 0 && totalSpend > 0 ? totalSpend / newClientsWon : 0;
  const roas = totalSpend > 0 ? monthRevenue / totalSpend : 0;

  const leadsBySource = useMemo(() => {
    const sources: Record<string, number> = {};
    clients.forEach(c => {
      const src = c.source || 'Other';
      sources[src] = (sources[src] || 0) + 1;
    });
    const colors: Record<string, string> = {
      Website: '#3b82f6', Referral: '#10b981', 'Cold Call': '#f59e0b',
      Socials: '#ec4899', Creatium: '#06b6d4', Other: '#94a3b8', Manual: '#64748b',
    };
    const total = Object.values(sources).reduce((a, b) => a + b, 0);
    return Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([source, count]) => ({
      source, count, fill: colors[source] || '#94a3b8', percent: total > 0 ? (count / total * 100).toFixed(1) : '0',
    }));
  }, [clients]);

  const sourceConversion = useMemo(() => {
    const data: Record<string, { total: number; won: number; revenue: number }> = {};
    const clientRevenue: Record<string, number> = {};
    transactions.filter(t => t.amount > 0 && t.clientId).forEach(t => {
      clientRevenue[t.clientId!] = (clientRevenue[t.clientId!] || 0) + t.amount;
    });

    clients.forEach(c => {
      const src = c.source || 'Other';
      if (!data[src]) data[src] = { total: 0, won: 0, revenue: 0 };
      data[src].total++;
      if ([ClientStatus.IN_WORK, ClientStatus.WON, ClientStatus.CONTRACT].includes(c.status)) {
        data[src].won++;
        data[src].revenue += clientRevenue[c.id] || 0;
      }
    });

    const colors: Record<string, string> = {
      Website: '#3b82f6', Referral: '#10b981', 'Cold Call': '#f59e0b',
      Socials: '#ec4899', Creatium: '#06b6d4', Other: '#94a3b8', Manual: '#64748b',
    };

    return Object.entries(data).map(([source, d]) => ({
      source,
      leads: d.total,
      clients: d.won,
      conversion: d.total > 0 ? (d.won / d.total * 100) : 0,
      revenue: d.revenue,
      fill: colors[source] || '#94a3b8',
    })).sort((a, b) => b.revenue - a.revenue);
  }, [clients, transactions]);

  const spendByMonth = useMemo(() => {
    const months: Record<string, Record<string, number>> = {};
    spendData.forEach(s => {
      if (!months[s.month]) months[s.month] = {};
      const ch = channels.find(c => c.id === s.channelId);
      const name = ch?.name || 'Другое';
      months[s.month][name] = (months[s.month][name] || 0) + s.amount;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, chData]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      ...chData,
      total: Object.values(chData).reduce((a, b) => a + b, 0),
    }));
  }, [spendData, channels]);

  const cplByMonth = useMemo(() => {
    const months: Record<string, { spend: number; leads: number }> = {};
    spendData.forEach(s => {
      if (!months[s.month]) months[s.month] = { spend: 0, leads: 0 };
      months[s.month].spend += s.amount;
      months[s.month].leads += s.leadsCount;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      cpl: d.leads > 0 ? Math.round(d.spend / d.leads) : 0,
      spend: Math.round(d.spend),
    }));
  }, [spendData]);

  const handleAddChannel = async (name: string, type: string, color: string) => {
    await marketingChannelService.createChannel({ name, channelType: type as any, color });
    setShowAddChannel(false);
    loadData();
  };

  const handleSaveSpend = async (channelId: string, month: string, data: Partial<MarketingSpend>) => {
    await marketingChannelService.upsertSpend({ ...data, channelId, month });
    setShowSpendEntry(null);
    loadData();
  };

  const handleDeleteChannel = async (id: string) => {
    await marketingChannelService.deleteChannel(id);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Расходы на маркетинг', value: totalSpend > 0 ? fmt(totalSpend) : '0 ₸', color: 'text-slate-900', sub: currentMonth },
          { label: 'Лиды за месяц', value: totalLeads, color: 'text-blue-600' },
          { label: 'CPL (за лид)', value: cpl > 0 ? fmt(cpl) : '--', color: cpl > 0 ? 'text-slate-900' : 'text-slate-400' },
          { label: 'CAC (за клиента)', value: cac > 0 ? fmt(cac) : '--', color: cac > 0 ? 'text-slate-900' : 'text-slate-400' },
          { label: 'ROAS', value: roas > 0 ? `${roas.toFixed(1)}x` : '--', color: roas > 2 ? 'text-emerald-600' : roas > 1 ? 'text-blue-600' : roas > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: 'Каналов активно', value: channels.filter(c => c.isActive).length, color: 'text-slate-900' },
        ].map((kpi, i) => (
          <div key={i} className={UI.CARD}>
            <p className={UI.LABEL}>{kpi.label}</p>
            <p className={`text-2xl font-black tracking-tighter ${kpi.color}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      <ChannelTable
        channels={channels}
        spendData={currentMonthSpend}
        clients={monthClients}
        onAddChannel={() => setShowAddChannel(true)}
        onEditSpend={setShowSpendEntry}
        onDeleteChannel={handleDeleteChannel}
        month={currentMonth}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full" /> Атрибуция лидов по источникам
          </h3>
          {leadsBySource.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadsBySource}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {leadsBySource.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700 }}
                      formatter={(value: any, name: string) => [`${value} лидов`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {leadsBySource.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                    <span className="text-[11px] font-bold text-slate-600 flex-1">{s.source}</span>
                    <span className="text-[11px] font-black text-slate-900">{s.count}</span>
                    <span className="text-[10px] text-slate-400 font-bold w-12 text-right">{s.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12"><p className="text-slate-400 text-sm">Нет данных</p></div>
          )}
        </div>

        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" /> Конверсия по источникам
          </h3>
          {sourceConversion.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="pb-3">Источник</th>
                    <th className="pb-3 text-right">Лиды</th>
                    <th className="pb-3 text-right">Клиенты</th>
                    <th className="pb-3 text-right">Конверсия</th>
                    <th className="pb-3 text-right">Выручка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sourceConversion.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                          <span className="text-sm font-bold text-slate-700">{s.source}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-sm text-slate-600">{s.leads}</td>
                      <td className="py-3 text-right text-sm font-bold text-emerald-600">{s.clients}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                          s.conversion > 25 ? 'bg-emerald-50 text-emerald-600' : s.conversion > 10 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {s.conversion.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-sm font-black text-slate-900">{s.revenue > 0 ? fmt(s.revenue) : '0 ₸'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12"><p className="text-slate-400 text-sm">Нет данных</p></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full" /> Расходы по месяцам
          </h3>
          {spendByMonth.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700 }}
                    formatter={(value: any) => [fmt(value), '']}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">Нет данных о расходах</p>
              <p className="text-slate-300 text-xs mt-2">Добавьте каналы и внесите расходы</p>
            </div>
          )}
        </div>

        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-cyan-500 rounded-full" /> Динамика CPL
          </h3>
          {cplByMonth.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cplByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700 }}
                    formatter={(value: any) => [fmt(value), 'CPL']}
                  />
                  <Line type="monotone" dataKey="cpl" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 4, fill: '#06b6d4' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">Нет данных</p>
              <p className="text-slate-300 text-xs mt-2">CPL появится после добавления расходов и лидов по каналам</p>
            </div>
          )}
        </div>
      </div>

      {channels.length === 0 && (
        <div className={`${UI.CARD} border-l-4 border-l-blue-400 bg-blue-50/30`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Добавьте каналы трафика</p>
              <p className="text-xs text-slate-600 mt-1">
                Настройте маркетинговые каналы (Google Ads, Facebook Ads, SEO и др.) и начните отслеживать расходы.
                Это позволит считать CAC, CPL и ROAS для принятия решений по бюджету.
              </p>
              <button
                onClick={() => setShowAddChannel(true)}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all"
              >
                Добавить канал
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddChannel && (
        <AddChannelModal
          onSave={handleAddChannel}
          onClose={() => setShowAddChannel(false)}
        />
      )}

      {showSpendEntry && (
        <SpendEntryModal
          channel={showSpendEntry}
          month={currentMonth}
          existingData={currentMonthSpend.find(s => s.channelId === showSpendEntry.id)}
          onSave={handleSaveSpend}
          onClose={() => setShowSpendEntry(null)}
        />
      )}
    </div>
  );
};

function getMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

export default MarketingTab;
