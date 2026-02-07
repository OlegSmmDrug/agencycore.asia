import React from 'react';

interface ManagerData {
  id: string;
  name: string;
  revenue: number;
  leads: number;
  won: number;
  lost: number;
  cost: number;
  avgDaysToClose: number;
  revenueTarget: number;
  conversion: number;
  avgCheck: number;
  roi: number;
  planPercent: number;
}

interface Totals {
  revenue: number;
  leads: number;
  won: number;
  lost: number;
  cost: number;
}

interface ManagerTableProps {
  managers: ManagerData[];
  totals: Totals;
  selectedManager: string | null;
  onManagerClick: (id: string) => void;
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const ManagerTable: React.FC<ManagerTableProps> = ({ managers, totals, selectedManager, onManagerClick }) => {
  const avgConversion = totals.leads > 0 ? (totals.won / totals.leads) * 100 : 0;

  return (
    <div className={UI.CARD}>
      <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900">Эффективность менеджеров продаж</h3>
      {managers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="pb-5 px-3 text-center">#</th>
                <th className="pb-5">Менеджер</th>
                <th className="pb-5 text-right">Выручка</th>
                <th className="pb-5 text-right">Лиды</th>
                <th className="pb-5 text-right">Клиенты</th>
                <th className="pb-5 text-right">Конверсия</th>
                <th className="pb-5 text-right">Цикл</th>
                <th className="pb-5 text-right">План</th>
                <th className="pb-5 text-right">ФОТ</th>
                <th className="pb-5 text-right">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {managers.map((m, i) => {
                const isSelected = selectedManager === m.id;
                return (
                  <tr
                    key={m.id}
                    onClick={() => onManagerClick(m.id)}
                    className={`group cursor-pointer transition-all ${
                      isSelected ? 'bg-blue-50/50 ring-1 ring-blue-200' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="py-4 px-3 text-center">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black ${
                        i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                      }`}>{i + 1}</span>
                    </td>
                    <td className="py-4 font-black text-slate-800 text-sm whitespace-nowrap">
                      {m.name}
                      {isSelected && <span className="ml-2 w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                    </td>
                    <td className="py-4 text-right font-black text-slate-900 text-sm">{m.revenue > 0 ? fmt(m.revenue) : '0 ₸'}</td>
                    <td className="py-4 text-right text-slate-600 text-sm">{m.leads}</td>
                    <td className="py-4 text-right text-emerald-600 font-black text-sm">{m.won}</td>
                    <td className="py-4 text-right">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${
                        m.conversion > 25 ? 'bg-emerald-50 text-emerald-600' : m.conversion > 15 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {m.conversion.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 text-right text-slate-500 text-[11px] font-bold">
                      {m.avgDaysToClose > 0 ? `${m.avgDaysToClose} дн.` : '--'}
                    </td>
                    <td className="py-4 text-right">
                      {m.planPercent > 0 ? (
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${
                          m.planPercent >= 100 ? 'bg-emerald-50 text-emerald-600' : m.planPercent >= 60 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {m.planPercent.toFixed(0)}%
                        </span>
                      ) : <span className="text-xs text-slate-300">--</span>}
                    </td>
                    <td className="py-4 text-right text-xs font-bold text-slate-500">
                      {m.cost > 0 ? fmt(m.cost) : '--'}
                    </td>
                    <td className="py-4 text-right">
                      {m.cost > 0 ? (
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                          m.roi > 200 ? 'bg-emerald-50 text-emerald-600' :
                          m.roi > 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {m.roi > 0 ? '+' : ''}{m.roi.toFixed(0)}%
                        </span>
                      ) : <span className="text-xs text-slate-300">--</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200">
              <tr className="bg-slate-50/50">
                <td className="py-4 px-3" />
                <td className="py-4 font-black text-slate-600 text-[10px] uppercase tracking-wider">Итого / Среднее</td>
                <td className="py-4 text-right font-black text-slate-900 text-sm">{fmt(totals.revenue)}</td>
                <td className="py-4 text-right text-slate-600 font-bold text-sm">{totals.leads}</td>
                <td className="py-4 text-right text-emerald-600 font-black text-sm">{totals.won}</td>
                <td className="py-4 text-right">
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-100 text-slate-600">
                    {avgConversion.toFixed(1)}%
                  </span>
                </td>
                <td className="py-4" />
                <td className="py-4" />
                <td className="py-4 text-right text-xs font-bold text-slate-500">{totals.cost > 0 ? fmt(totals.cost) : '--'}</td>
                <td className="py-4 text-right">
                  {totals.cost > 0 ? (
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                      totals.revenue / totals.cost > 3 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {totals.revenue > 0 ? `+${(((totals.revenue / totals.cost) - 1) * 100).toFixed(0)}%` : '0%'}
                    </span>
                  ) : <span className="text-xs text-slate-300">--</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">Нет данных по менеджерам продаж</p>
          <p className="text-slate-300 text-xs mt-2">Добавьте сотрудников с должностью "Sales manager", "Аккаунт-менеджер", "Менеджер по продажам" или "CEO/Директор"</p>
        </div>
      )}
    </div>
  );
};

export default ManagerTable;
