
import React, { useState, useMemo } from 'react';

interface FinalBriefProps {
  data: any;
  rawText: string;
}

export const FinalBrief: React.FC<FinalBriefProps> = ({ data, rawText }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Извлекаем текстовое повествование (все до тега <json_brief>)
  const narrativeContent = useMemo(() => {
    return rawText.split('<json_brief>')[0].trim();
  }, [rawText]);

  const handlePrint = () => {
    window.print();
  };

  // Компонент для отрисовки Roadmap
  // Fix: Explicitly type as React.FC to handle React-specific props like key
  const RoadmapTimeline: React.FC<{ steps: any }> = ({ steps }) => {
    if (!steps || typeof steps !== 'object') return null;
    const entries = Array.isArray(steps) ? steps : Object.entries(steps);

    return (
      <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
        {entries.map((step: any, i: number) => {
          const title = typeof step === 'string' ? step : (step.title || step[0]);
          const desc = typeof step === 'object' ? (step.desc || step[1]) : '';
          return (
            <div key={i} className="relative pl-10 group">
              <div className="absolute left-0 top-1 w-6 h-6 bg-white border-4 border-indigo-600 rounded-full z-10 group-hover:scale-125 transition-transform"></div>
              <h5 className="text-sm font-black text-slate-900 uppercase mb-1">{title}</h5>
              {desc && <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>}
            </div>
          );
        })}
      </div>
    );
  };

  // Компонент для отрисовки метрик и индикаторов
  // Fix: Explicitly type as React.FC to handle React-specific props like key and avoid "key does not exist" error
  const MetricCard: React.FC<{ label: string, value: any }> = ({ label, value }) => {
    const isNumeric = typeof value === 'number' || (typeof value === 'string' && value.includes('%'));
    const numericValue = typeof value === 'number' ? value : parseInt(value) || 0;

    return (
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{label.replace(/_/g, ' ')}</span>
        {isNumeric ? (
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-indigo-600">{value}{typeof value === 'number' && value <= 100 && !String(value).includes('%') ? '%' : ''}</span>
            </div>
            {numericValue <= 100 && (
              <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full" style={{ width: `${Math.min(numericValue, 100)}%` }}></div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm font-bold text-slate-700 leading-tight">{String(value)}</p>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-[2.5rem] shadow-2xl border-2 border-slate-100 overflow-hidden mb-12 animate-in fade-in slide-in-from-top-10 duration-700 print:shadow-none print:border-none print:rounded-none ${!isExpanded ? 'h-24' : ''}`}>
      {/* Header Panel */}
      <div className="bg-slate-900 p-8 flex justify-between items-center print:bg-white print:p-0 print:mb-10">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3 print:hidden">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter print:text-slate-900 print:text-4xl">Стратегический Манифест</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="bg-indigo-500 text-[10px] text-white font-black px-2 py-0.5 rounded uppercase print:border print:border-slate-900 print:text-slate-900">Priority: High</span>
              <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] print:text-slate-500">System v4.0 Finalized</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 print:hidden">
          <button 
            onClick={handlePrint}
            className="group bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-8 rounded-2xl transition-all active:scale-95 flex items-center gap-3 shadow-xl shadow-indigo-500/20"
          >
            <svg className="w-6 h-6 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Скачать План (PDF)
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl transition-all"
          >
            <svg className={`w-6 h-6 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-8 md:p-12 space-y-16">
          {/* Section 1: Narrative Analysis */}
          <section className="max-w-4xl">
            <h3 className="text-indigo-600 font-black text-xs uppercase tracking-[0.4em] mb-8 flex items-center gap-4">
              <span className="w-12 h-px bg-indigo-600"></span>
              Аналитическая Декомпозиция
            </h3>
            <div className="text-slate-800 text-xl md:text-2xl leading-[1.6] font-serif italic print:font-sans print:text-lg">
              {narrativeContent.split('\n').map((line, i) => (
                <p key={i} className={line.trim() ? "mb-8 border-l-4 border-slate-100 pl-6" : "mb-2"}>{line}</p>
              ))}
            </div>
          </section>

          {/* Section 2: Visual Dashboard from JSON */}
          <section className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
               <h3 className="text-slate-900 font-black text-xs uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-indigo-600">01</span>
                Ключевые показатели и Метрики
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(data).map(([key, value]) => {
                  if (typeof value !== 'object') {
                    return <MetricCard key={key} label={key} value={value} />;
                  }
                  return null;
                })}
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-slate-200">
              <h3 className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-8">Roadmap Запуска</h3>
              <RoadmapTimeline steps={data.Roadmap || data.Plan || data.steps || []} />
            </div>
          </section>

          {/* Section 3: Deep Psychographics */}
          <section>
            <h3 className="text-slate-900 font-black text-xs uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
              <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-indigo-600">02</span>
              Психографический профиль аудитории
            </h3>
            <div className="grid md:grid-cols-2 gap-12">
              <div className="bg-indigo-50/50 p-8 rounded-[2rem] border-2 border-dashed border-indigo-100">
                <h4 className="font-black text-indigo-900 uppercase text-sm mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Боли и Барьеры
                </h4>
                <div className="text-slate-700 text-sm space-y-4">
                  {/* Попытка найти данные про аудиторию в JSON */}
                  {data.Audience?.pains || data.Target_Audience?.fears || "Детальный анализ барьеров содержится в авторском разборе выше."}
                </div>
              </div>
              <div className="bg-green-50/50 p-8 rounded-[2rem] border-2 border-dashed border-green-100">
                <h4 className="font-black text-green-900 uppercase text-sm mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Триггеры роста
                </h4>
                <div className="text-slate-700 text-sm space-y-4">
                  {data.Audience?.triggers || data.Target_Audience?.triggers || "Ключевые рычаги влияния декомпозированы в секции метрик."}
                </div>
              </div>
            </div>
          </section>

          {/* Print Only Footer */}
          <div className="hidden print:block pt-20 border-t border-slate-200 mt-20">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-slate-900 font-black text-xl mb-1 uppercase">Architect Engine</p>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">© 2025 AI Strategy Solutions</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Generated On</p>
                <p className="text-slate-900 font-bold">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
