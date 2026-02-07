import React from 'react';

interface FunnelStep {
  name: string;
  key: string;
  value: number;
  fill: string;
}

interface SalesFunnelProps {
  funnel: FunnelStep[];
  cac: number;
  avgDealSize: number;
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const SalesFunnel: React.FC<SalesFunnelProps> = ({ funnel, cac, avgDealSize }) => {
  const maxVal = Math.max(...funnel.map(f => f.value), 1);

  return (
    <div className={UI.CARD}>
      <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900">Воронка продаж (CRM)</h3>
      <div className="space-y-6">
        {funnel.map((step, i) => {
          const prevValue = i > 0 ? funnel[i - 1].value : 0;
          const stageConversion = prevValue > 0 ? (step.value / prevValue) * 100 : 0;
          const isAnomaly = stageConversion > 100 && i > 0;

          return (
            <div key={step.key} className="relative">
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
              {i < funnel.length - 1 && step.value > 0 && funnel[i + 1].value > 0 && (
                <div className={`absolute left-1/2 -bottom-4 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full border ${
                  isAnomaly
                    ? 'text-rose-600 bg-rose-50 border-rose-200'
                    : Math.round((funnel[i + 1].value / step.value) * 100) < 30
                      ? 'text-amber-600 bg-amber-50 border-amber-100'
                      : 'text-blue-500 bg-blue-50 border-blue-100'
                }`}>
                  &darr; {Math.round((funnel[i + 1].value / step.value) * 100)}%
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
            {cac > 0 ? fmt(cac) : 'Нет данных'}
          </p>
          {cac === 0 && <p className="text-[8px] text-slate-400">Добавьте данные во вкладке "Маркетинг"</p>}
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Средний чек</p>
          <p className="text-lg font-black text-slate-900">
            {avgDealSize > 0 ? fmt(avgDealSize) : '--'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SalesFunnel;
