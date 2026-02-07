import React from 'react';
import { MarketingChannel, MarketingSpend } from '../../../services/marketingChannelService';
import { Client, ClientStatus } from '../../../types';
import { countUtmLeadsForChannel } from './utmMapping';

interface ChannelTableProps {
  channels: MarketingChannel[];
  spendData: MarketingSpend[];
  clients: Client[];
  allClients?: Client[];
  month: string;
  onAddChannel: () => void;
  onEditSpend: (channel: MarketingChannel) => void;
  onDeleteChannel: (id: string) => void;
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const ChannelTable: React.FC<ChannelTableProps> = ({
  channels, spendData, clients, allClients, month, onAddChannel, onEditSpend, onDeleteChannel,
}) => {
  const activeChannels = channels.filter(c => c.isActive);

  const channelMetrics = activeChannels.map(ch => {
    const spend = spendData.find(s => s.channelId === ch.id);
    const amount = spend?.amount || 0;
    const leads = spend?.leadsCount || 0;
    const clicks = spend?.clicks || 0;
    const impressions = spend?.impressions || 0;
    const cpl = leads > 0 && amount > 0 ? amount / leads : 0;
    const ctr = impressions > 0 ? (clicks / impressions * 100) : 0;
    const utmLeads = allClients ? countUtmLeadsForChannel(ch.name, allClients) : 0;

    return {
      ...ch,
      amount,
      leads,
      utmLeads,
      clicks,
      impressions,
      cpl,
      ctr,
      hasData: !!spend,
    };
  });

  const totalSpend = channelMetrics.reduce((s, c) => s + c.amount, 0);
  const totalLeads = channelMetrics.reduce((s, c) => s + c.leads, 0);

  return (
    <div className={UI.CARD}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
          <div className="w-1 h-4 bg-blue-500 rounded-full" /> Каналы трафика
        </h3>
        <button
          onClick={onAddChannel}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Добавить канал
        </button>
      </div>

      {activeChannels.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="pb-4">Канал</th>
                <th className="pb-4 text-center">Тип</th>
                <th className="pb-4 text-right">Расход</th>
                <th className="pb-4 text-right">Лиды (ручн.)</th>
                <th className="pb-4 text-right">Лиды (UTM)</th>
                <th className="pb-4 text-right">CPL</th>
                <th className="pb-4 text-right">Клики</th>
                <th className="pb-4 text-right">CTR</th>
                <th className="pb-4 text-right">Бюджет/мес</th>
                <th className="pb-4 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {channelMetrics.map(ch => (
                <tr key={ch.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                      <span className="font-bold text-sm text-slate-800">{ch.name}</span>
                      {ch.integrationId && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded border border-emerald-100">AUTO</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                      ch.channelType === 'paid' ? 'bg-amber-50 text-amber-600' :
                      ch.channelType === 'organic' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {ch.channelType === 'paid' ? 'Платный' : ch.channelType === 'organic' ? 'Органика' : 'Реферал'}
                    </span>
                  </td>
                  <td className="py-4 text-right font-black text-sm text-slate-900">
                    {ch.amount > 0 ? fmt(ch.amount) : '--'}
                  </td>
                  <td className="py-4 text-right text-sm text-slate-600 font-bold">{ch.leads || '--'}</td>
                  <td className="py-4 text-right">
                    {ch.utmLeads > 0 ? (
                      <span className="text-sm font-bold text-blue-600">{ch.utmLeads}</span>
                    ) : <span className="text-xs text-slate-300">--</span>}
                  </td>
                  <td className="py-4 text-right">
                    {ch.cpl > 0 ? (
                      <span className="text-sm font-black text-slate-900">{fmt(ch.cpl)}</span>
                    ) : <span className="text-xs text-slate-300">--</span>}
                  </td>
                  <td className="py-4 text-right text-sm text-slate-600">{ch.clicks || '--'}</td>
                  <td className="py-4 text-right">
                    {ch.ctr > 0 ? (
                      <span className="text-sm font-bold text-slate-600">{ch.ctr.toFixed(1)}%</span>
                    ) : <span className="text-xs text-slate-300">--</span>}
                  </td>
                  <td className="py-4 text-right text-xs text-slate-400 font-bold">
                    {ch.monthlyBudget > 0 ? fmt(ch.monthlyBudget) : '--'}
                  </td>
                  <td className="py-4 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditSpend(ch)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-all"
                        title="Внести данные"
                      >
                        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        onClick={() => onDeleteChannel(ch.id)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg transition-all"
                        title="Удалить"
                      >
                        <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {activeChannels.length > 1 && (
              <tfoot className="border-t-2 border-slate-200">
                <tr className="bg-slate-50/50">
                  <td className="py-4 font-black text-[10px] text-slate-600 uppercase tracking-wider">Итого</td>
                  <td className="py-4" />
                  <td className="py-4 text-right font-black text-sm text-slate-900">{totalSpend > 0 ? fmt(totalSpend) : '--'}</td>
                  <td className="py-4 text-right text-sm text-slate-600 font-bold">{totalLeads || '--'}</td>
                  <td className="py-4 text-right text-sm font-bold text-blue-600">
                    {channelMetrics.reduce((s, c) => s + c.utmLeads, 0) || '--'}
                  </td>
                  <td className="py-4 text-right font-black text-sm text-slate-900">
                    {totalLeads > 0 && totalSpend > 0 ? fmt(totalSpend / totalLeads) : '--'}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">Нет каналов трафика</p>
          <p className="text-slate-300 text-xs mt-2">Добавьте каналы для отслеживания маркетинговых расходов</p>
        </div>
      )}
    </div>
  );
};

export default ChannelTable;
