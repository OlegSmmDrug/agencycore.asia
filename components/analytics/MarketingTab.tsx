import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, Transaction, ClientStatus } from '../../types';
import { marketingChannelService, MarketingChannel, MarketingSpend } from '../../services/marketingChannelService';
import { adPlatformAggregatorService, AggregatedAdData } from '../../services/adPlatformAggregatorService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, PieChart, Pie } from 'recharts';
import ChannelTable from './marketing/ChannelTable';
import AddChannelModal from './marketing/AddChannelModal';
import SpendEntryModal from './marketing/SpendEntryModal';
import UtmAnalysis from './marketing/UtmAnalysis';
import { getEffectiveChannel, CHANNEL_COLORS, SOURCE_LABELS } from './marketing/utmMapping';

interface MarketingTabProps {
  clients: Client[];
  transactions: Transaction[];
  onNavigateToTab?: (tab: string) => void;
  onNavigateToIntegrations?: () => void;
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
  LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
  VALUE: "text-2xl font-black text-slate-900 tracking-tighter",
};

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  facebook: { label: 'Facebook Ads', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  google: { label: 'Google Ads', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  tiktok: { label: 'TikTok Ads', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

type AdPeriod = '7d' | '14d' | '30d';

const AD_PERIODS: { value: AdPeriod; label: string }[] = [
  { value: '7d', label: '7 дней' },
  { value: '14d', label: '14 дней' },
  { value: '30d', label: '30 дней' },
];

const MarketingTab: React.FC<MarketingTabProps> = ({ clients, transactions, onNavigateToTab, onNavigateToIntegrations }) => {
  const [channels, setChannels] = useState<MarketingChannel[]>([]);
  const [spendData, setSpendData] = useState<MarketingSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showSpendEntry, setShowSpendEntry] = useState<MarketingChannel | null>(null);
  const [adData, setAdData] = useState<AggregatedAdData | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adPeriod, setAdPeriod] = useState<AdPeriod>('30d');

  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const navigateMonth = (direction: 'prev' | 'next') => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + (direction === 'prev' ? -1 : 1));
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ch, sp] = await Promise.all([
      marketingChannelService.getChannels(),
      marketingChannelService.getSpendRange(getMonthsAgo(5), selectedMonth),
    ]);
    setChannels(ch);
    setSpendData(sp);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setAdLoading(true);
    adPlatformAggregatorService.getAggregatedMetrics(adPeriod).then(data => {
      setAdData(data);
      setAdLoading(false);
    }).catch(() => setAdLoading(false));
  }, [adPeriod]);

  const currentMonthSpend = useMemo(() => spendData.filter(s => s.month === selectedMonth), [spendData, selectedMonth]);

  const totalSpend = useMemo(() => currentMonthSpend.reduce((s, sp) => s + sp.amount, 0), [currentMonthSpend]);
  const totalLeadsFromSpend = useMemo(() => currentMonthSpend.reduce((s, sp) => s + sp.leadsCount, 0), [currentMonthSpend]);

  const monthClients = useMemo(() => {
    const start = new Date(selectedMonth + '-01');
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return clients.filter(c => {
      const d = new Date(c.createdAt);
      return d >= start && d <= end;
    });
  }, [clients, selectedMonth]);

  const monthRevenue = useMemo(() => {
    const start = selectedMonth + '-01';
    const endDate = new Date(selectedMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().slice(0, 10);
    return transactions.filter(t => t.amount > 0 && t.date >= start && t.date < end).reduce((s, t) => s + t.amount, 0);
  }, [transactions, selectedMonth]);

  const newClientsWon = useMemo(() =>
    monthClients.filter(c => [ClientStatus.IN_WORK, ClientStatus.WON, ClientStatus.CONTRACT].includes(c.status)).length,
  [monthClients]);

  const combinedAdSpend = adData?.totalSpend || 0;
  const combinedSpend = totalSpend + combinedAdSpend;
  const totalLeads = totalLeadsFromSpend + (adData?.totalLeads || 0) || monthClients.length;
  const cpl = totalLeads > 0 && combinedSpend > 0 ? combinedSpend / totalLeads : 0;
  const cac = newClientsWon > 0 && combinedSpend > 0 ? combinedSpend / newClientsWon : 0;
  const roas = combinedSpend > 0 ? monthRevenue / combinedSpend : 0;

  const leadsByChannel = useMemo(() => {
    const channels: Record<string, number> = {};
    clients.forEach(c => {
      const ch = getEffectiveChannel(c);
      channels[ch] = (channels[ch] || 0) + 1;
    });
    const total = Object.values(channels).reduce((a, b) => a + b, 0);
    return Object.entries(channels).sort((a, b) => b[1] - a[1]).map(([channel, count]) => ({
      source: channel, count, fill: CHANNEL_COLORS[channel] || '#94a3b8', percent: total > 0 ? (count / total * 100).toFixed(1) : '0',
    }));
  }, [clients]);

  const channelConversion = useMemo(() => {
    const data: Record<string, { total: number; won: number; revenue: number }> = {};
    const clientRevenue: Record<string, number> = {};
    transactions.filter(t => t.amount > 0 && t.clientId).forEach(t => {
      clientRevenue[t.clientId!] = (clientRevenue[t.clientId!] || 0) + t.amount;
    });

    clients.forEach(c => {
      const ch = getEffectiveChannel(c);
      if (!data[ch]) data[ch] = { total: 0, won: 0, revenue: 0 };
      data[ch].total++;
      if ([ClientStatus.IN_WORK, ClientStatus.WON, ClientStatus.CONTRACT].includes(c.status)) {
        data[ch].won++;
        data[ch].revenue += clientRevenue[c.id] || 0;
      }
    });

    return Object.entries(data).map(([channel, d]) => ({
      source: channel,
      leads: d.total,
      clients: d.won,
      conversion: d.total > 0 ? (d.won / d.total * 100) : 0,
      revenue: d.revenue,
      fill: CHANNEL_COLORS[channel] || '#94a3b8',
    })).sort((a, b) => b.revenue - a.revenue);
  }, [clients, transactions]);

  const utmCoverage = useMemo(() => {
    const withUtm = clients.filter(c => c.utmSource && c.utmSource !== '-').length;
    return clients.length > 0 ? Math.round(withUtm / clients.length * 100) : 0;
  }, [clients]);

  const spendByMonth = useMemo(() => {
    const months: Record<string, Record<string, number>> = {};
    spendData.forEach(s => {
      if (!months[s.month]) months[s.month] = {};
      const ch = channels.find(c => c.id === s.channelId);
      const name = ch?.name || 'Other';
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

  const connectedPlatforms = adData?.platforms.filter(p => p.isConnected) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-slate-900">Маркетинг</h3>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1">
            {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center min-w-[140px]">
            <div className="text-sm font-black text-slate-900">{new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long' })}</div>
            <div className="text-xs text-slate-500 font-bold">{new Date(selectedMonth + '-01').getFullYear()}</div>
          </div>
          <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Расходы на маркетинг', value: combinedSpend > 0 ? fmt(combinedSpend) : '0 ₸', color: 'text-slate-900' },
          { label: 'Лиды за месяц', value: totalLeads, color: 'text-blue-600' },
          { label: 'CPL (за лид)', value: cpl > 0 ? fmt(cpl) : '--', color: cpl > 0 ? 'text-slate-900' : 'text-slate-400' },
          { label: 'CAC (за клиента)', value: cac > 0 ? fmt(cac) : '--', color: cac > 0 ? 'text-slate-900' : 'text-slate-400', onClick: () => onNavigateToTab?.('sales') },
          { label: 'ROAS', value: roas > 0 ? `${roas.toFixed(1)}x` : '--', color: roas > 2 ? 'text-emerald-600' : roas > 1 ? 'text-blue-600' : roas > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: 'Каналов активно', value: channels.filter(c => c.isActive).length, color: 'text-slate-900', onClick: onNavigateToIntegrations },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`${UI.CARD} ${kpi.onClick ? 'cursor-pointer hover:border-blue-300' : ''}`}
            onClick={kpi.onClick}
          >
            <p className={UI.LABEL}>{kpi.label}</p>
            <p className={`text-2xl font-black tracking-tighter ${kpi.color}`}>{kpi.value}</p>
            {kpi.onClick && (
              <p className="text-[8px] text-blue-400 font-bold uppercase mt-1 opacity-0 group-hover:opacity-100">
                Click to view
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={UI.CARD}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full" /> Рекламные платформы
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-xl p-0.5">
              {AD_PERIODS.map(period => (
                <button
                  key={period.value}
                  onClick={() => setAdPeriod(period.value)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    adPeriod === period.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            {adLoading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['facebook', 'google', 'tiktok'].map(platform => {
            const p = adData?.platforms.find(pp => pp.platform === platform);
            const cfg = PLATFORM_CONFIG[platform];
            const connected = p?.isConnected;

            return (
              <div key={platform} className={`p-5 rounded-2xl border transition-all ${connected ? cfg.border + ' ' + cfg.bg : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${connected ? cfg.color : 'text-slate-400'}`}>
                    {cfg.label}
                  </span>
                  {connected ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ) : (
                    <button
                      onClick={onNavigateToIntegrations}
                      className="text-[9px] font-bold text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      Подключить
                    </button>
                  )}
                </div>

                {connected && p && p.spend > 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold">Расходы</span>
                      <span className="text-sm font-black text-slate-900">{fmt(p.spend)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold">Лиды</span>
                      <span className="text-sm font-black text-blue-600">{p.leads > 0 ? p.leads : '--'}</span>
                    </div>
                    {(p.messagingConversations || 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-bold">Сообщения WhatsApp</span>
                        <span className="text-sm font-black text-emerald-600">{p.messagingConversations}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold">CPL</span>
                      <span className="text-sm font-black text-slate-700">{p.cpl > 0 ? fmt(p.cpl) : '--'}</span>
                    </div>
                    {(p.messagingConversations || 0) > 0 && (p.costPerMessage || 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-bold">Цена за сообщение</span>
                        <span className="text-sm font-black text-slate-700">{fmt(p.costPerMessage!)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold">Клики</span>
                      <span className="text-sm font-black text-slate-700">{p.clicks > 0 ? p.clicks.toLocaleString() : '--'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold">Показы</span>
                      <span className="text-sm font-black text-slate-700">{p.impressions > 0 ? p.impressions.toLocaleString() : '--'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold">CTR</span>
                      <span className="text-sm font-black text-slate-700">{p.ctr > 0 ? `${p.ctr.toFixed(2)}%` : '--'}</span>
                    </div>
                  </div>
                ) : connected && p?.error ? (
                  <div className="py-4">
                    <p className="text-[10px] text-amber-600 font-bold leading-relaxed">{p.error}</p>
                  </div>
                ) : connected ? (
                  <div className="py-4">
                    <p className="text-[10px] text-slate-400 font-bold">Нет данных за период</p>
                  </div>
                ) : (
                  <div className="py-4">
                    <p className="text-[10px] text-slate-400 font-bold">Не подключено</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ChannelTable
        channels={channels}
        spendData={currentMonthSpend}
        clients={monthClients}
        allClients={clients}
        onAddChannel={() => setShowAddChannel(true)}
        onEditSpend={setShowSpendEntry}
        onDeleteChannel={handleDeleteChannel}
        month={selectedMonth}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={UI.CARD}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full" /> Каналы привлечения
            </h3>
            {utmCoverage > 0 && (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[9px] font-black rounded-lg border border-blue-100">
                UTM: {utmCoverage}%
              </span>
            )}
          </div>
          {leadsByChannel.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadsByChannel}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {leadsByChannel.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700 }}
                      formatter={(value: any, name: string) => [`${value} leads`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {leadsByChannel.map((s, i) => (
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
            <div className="w-1 h-4 bg-emerald-500 rounded-full" /> Конверсия по каналам
          </h3>
          {channelConversion.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="pb-3">Канал</th>
                    <th className="pb-3 text-right">Лиды</th>
                    <th className="pb-3 text-right">Клиенты</th>
                    <th className="pb-3 text-right">Конверсия</th>
                    <th className="pb-3 text-right">Выручка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {channelConversion.map((s, i) => (
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

      <UtmAnalysis clients={clients} transactions={transactions} />

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
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowAddChannel(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all"
                >
                  Добавить канал
                </button>
                {onNavigateToIntegrations && (
                  <button
                    onClick={onNavigateToIntegrations}
                    className="px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-50 transition-all"
                  >
                    Подключить рекламный кабинет
                  </button>
                )}
              </div>
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
          month={selectedMonth}
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
