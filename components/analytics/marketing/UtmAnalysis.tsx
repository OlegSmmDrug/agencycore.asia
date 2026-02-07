import React, { useMemo } from 'react';
import { Client, Transaction, ClientStatus } from '../../../types';

interface UtmAnalysisProps {
  clients: Client[];
  transactions: Transaction[];
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const WON_STATUSES = [ClientStatus.IN_WORK, ClientStatus.WON, ClientStatus.CONTRACT];

const UtmAnalysis: React.FC<UtmAnalysisProps> = ({ clients, transactions }) => {
  const clientRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.amount > 0 && t.clientId).forEach(t => {
      map[t.clientId!] = (map[t.clientId!] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  const campaignData = useMemo(() => {
    const data: Record<string, { total: number; won: number; revenue: number; source: string; term: string }> = {};

    clients.forEach(c => {
      const campaign = c.utmCampaign;
      if (!campaign || campaign === '-') return;

      if (!data[campaign]) data[campaign] = { total: 0, won: 0, revenue: 0, source: c.utmSource || '', term: '' };
      data[campaign].total++;
      if (!data[campaign].source && c.utmSource) data[campaign].source = c.utmSource;
      if (!data[campaign].term && c.utmTerm) data[campaign].term = c.utmTerm;

      if (WON_STATUSES.includes(c.status)) {
        data[campaign].won++;
        data[campaign].revenue += clientRevenue[c.id] || 0;
      }
    });

    return Object.entries(data)
      .map(([campaign, d]) => ({
        campaign,
        source: d.source,
        term: d.term,
        leads: d.total,
        clients: d.won,
        conversion: d.total > 0 ? (d.won / d.total * 100) : 0,
        revenue: d.revenue,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 15);
  }, [clients, clientRevenue]);

  const searchTermData = useMemo(() => {
    const data: Record<string, { total: number; won: number; revenue: number; source: string }> = {};

    clients.forEach(c => {
      const term = c.utmTerm;
      if (!term || term === '-') return;

      if (!data[term]) data[term] = { total: 0, won: 0, revenue: 0, source: c.utmSource || '' };
      data[term].total++;
      if (!data[term].source && c.utmSource) data[term].source = c.utmSource;

      if (WON_STATUSES.includes(c.status)) {
        data[term].won++;
        data[term].revenue += clientRevenue[c.id] || 0;
      }
    });

    return Object.entries(data)
      .map(([term, d]) => ({
        term,
        source: d.source,
        leads: d.total,
        clients: d.won,
        conversion: d.total > 0 ? (d.won / d.total * 100) : 0,
        revenue: d.revenue,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 15);
  }, [clients, clientRevenue]);

  const hasUtmData = campaignData.length > 0 || searchTermData.length > 0;

  if (!hasUtmData) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {campaignData.length > 0 && (
        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full" /> UTM Кампании
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="pb-3">Кампания</th>
                  <th className="pb-3 text-right">Лиды</th>
                  <th className="pb-3 text-right">Клиенты</th>
                  <th className="pb-3 text-right">CR</th>
                  <th className="pb-3 text-right">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaignData.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-all">
                    <td className="py-3">
                      <div className="text-sm font-bold text-slate-700 max-w-[200px] truncate" title={c.campaign}>
                        {c.campaign}
                      </div>
                      {c.source && (
                        <div className="text-[10px] text-slate-400 font-medium">{c.source}</div>
                      )}
                    </td>
                    <td className="py-3 text-right text-sm font-bold text-slate-600">{c.leads}</td>
                    <td className="py-3 text-right text-sm font-bold text-emerald-600">{c.clients}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        c.conversion > 25 ? 'bg-emerald-50 text-emerald-600' : c.conversion > 10 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {c.conversion.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm font-black text-slate-900">{c.revenue > 0 ? fmt(c.revenue) : '0 ₸'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searchTermData.length > 0 && (
        <div className={UI.CARD}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-teal-500 rounded-full" /> Поисковые запросы (UTM Term)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="pb-3">Запрос</th>
                  <th className="pb-3 text-right">Лиды</th>
                  <th className="pb-3 text-right">Клиенты</th>
                  <th className="pb-3 text-right">CR</th>
                  <th className="pb-3 text-right">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {searchTermData.map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-all">
                    <td className="py-3">
                      <div className="text-sm font-bold text-slate-700 max-w-[200px] truncate" title={t.term}>
                        {t.term}
                      </div>
                      {t.source && (
                        <div className="text-[10px] text-slate-400 font-medium">{t.source}</div>
                      )}
                    </td>
                    <td className="py-3 text-right text-sm font-bold text-slate-600">{t.leads}</td>
                    <td className="py-3 text-right text-sm font-bold text-emerald-600">{t.clients}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        t.conversion > 25 ? 'bg-emerald-50 text-emerald-600' : t.conversion > 10 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {t.conversion.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm font-black text-slate-900">{t.revenue > 0 ? fmt(t.revenue) : '0 ₸'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UtmAnalysis;
