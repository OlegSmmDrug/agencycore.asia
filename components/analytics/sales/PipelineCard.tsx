import React from 'react';
import { PipelineForecast } from '../../../services/financialEngineService';

interface PipelineCardProps {
  pipeline: PipelineForecast[];
  pipelineTotal: number;
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const PipelineCard: React.FC<PipelineCardProps> = ({ pipeline, pipelineTotal }) => {
  return (
    <div className={UI.CARD}>
      <div className="group relative inline-block">
        <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
          <div className="w-1 h-4 bg-blue-500 rounded-full" />
          Pipeline прогноз
          <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help">?</span>
        </h3>
        <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-72 shadow-xl">
          Прогноз поступлений на основе текущей воронки. Бюджет клиента умножается на вероятность закрытия. Если бюджет не указан, используется средний чек.
        </div>
      </div>
      <div className="space-y-4">
        {pipeline.map((p, i) => {
          const hasEstimated = p.estimatedValue > 0;
          const confirmedPercent = pipelineTotal > 0 ? (p.confirmedValue / pipelineTotal) * 100 : 0;
          const estimatedPercent = pipelineTotal > 0 ? (p.estimatedValue / pipelineTotal) * 100 : 0;

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">{p.stage}</span>
                  <span className="text-[9px] text-slate-400 font-bold">{p.count} кл.</span>
                  <span className="text-[9px] text-blue-500 font-bold">{p.probability}%</span>
                </div>
                <div className="flex items-center gap-1">
                  {hasEstimated && (
                    <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      ~{fmt(p.estimatedValue)}
                    </span>
                  )}
                  <span className="text-sm font-black text-slate-900">{fmt(p.weightedValue)}</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                {confirmedPercent > 0 && (
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${confirmedPercent}%` }}
                  />
                )}
                {estimatedPercent > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${estimatedPercent}%`,
                      background: 'repeating-linear-gradient(45deg, #93c5fd, #93c5fd 2px, #bfdbfe 2px, #bfdbfe 4px)',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-900 uppercase">Итого прогноз</span>
            <span className="text-xl font-black text-blue-600">{fmt(pipelineTotal)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 bg-blue-500 rounded-sm" />
            <span className="text-[9px] text-slate-400 font-bold">Подтвержденный бюджет</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #93c5fd, #93c5fd 1px, #bfdbfe 1px, #bfdbfe 2px)' }} />
            <span className="text-[9px] text-slate-400 font-bold">Оценка по ср. чеку</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineCard;
