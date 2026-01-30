import React, { useMemo } from 'react';
import { Project, Task, TaskStatus } from '../types';

interface SmartDashboardProps {
  project: Project;
  tasks: Task[];
  onSuggestKpi?: () => void;
  onEditKpi?: () => void;
  onEditContent?: () => void;
  onSyncKpis?: () => void;
  isSyncingKpis?: boolean;
}

const SmartDashboard: React.FC<SmartDashboardProps> = ({
  project,
  tasks,
  onSuggestKpi,
  onEditKpi,
  onEditContent,
  onSyncKpis,
  isSyncingKpis = false
}) => {
  const stats = useMemo(() => {
    const projectTasks = tasks.filter(t => t.projectId === project.id);

    const kpis = project.kpis || [];
    const kpiTotal = kpis.reduce((acc, k) => ({ plan: acc.plan + k.plan, fact: acc.fact + k.fact }), { plan: 0, fact: 0 });
    const kpiPercent = kpiTotal.plan > 0 ? Math.round((kpiTotal.fact / kpiTotal.plan) * 100) : 0;

    const hasOverdue = projectTasks.some(t =>
      t.deadline && new Date(t.deadline) < new Date() && t.status !== TaskStatus.DONE
    );

    const hasKpiData = kpis.length > 0 && kpiTotal.plan > 0;
    const kpiHealth = hasKpiData && kpiPercent < 50;
    const hasRisks = (project.risks && project.risks.length > 0) || hasOverdue || kpiHealth;

    const contentMetrics = project.contentMetrics || {};
    let contentArray = Object.entries(contentMetrics).map(([key, value]) => ({
      key,
      label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      done: value.fact || 0,
      total: value.plan || 0
    }));

    if (project.contentMetricsVisible && project.contentMetricsVisible.length > 0) {
      contentArray = contentArray.filter(item => project.contentMetricsVisible!.includes(item.key));
    }

    const hasContentMetrics = contentArray.length > 0;

    const legacyContent = {
      posts: { done: project.postsFact || 0, total: project.postsPlan || 0 },
      reels: { done: project.reelsFact || 0, total: project.reelsPlan || 0 },
      stories: { done: project.storiesFact || 0, total: project.storiesPlan || 0 }
    };

    return { kpiTotal, kpiPercent, hasOverdue, hasRisks, kpiHealth, hasKpiData, contentMetrics: contentArray, hasContentMetrics, legacyContent };
  }, [project, tasks]);

  const hasKpis = project.kpis && project.kpis.length > 0;
  const hasAutoUpdateKpis = project.kpis && project.kpis.some(kpi => kpi.autoUpdate);

  return (
    <div className="w-full bg-[#0F172A] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-800/60">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KPI</span>
            {hasAutoUpdateKpis && (
              <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                АВТО
              </span>
            )}
          </div>

          {hasKpis ? (
            <div className="space-y-2.5">
              {project.kpis!.slice(0, 3).map((kpi, index) => {
                const percent = kpi.plan > 0 ? Math.round((kpi.fact / kpi.plan) * 100) : 0;
                return (
                  <div key={kpi.id || index}>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-white">
                          {kpi.fact.toLocaleString()}{kpi.unit === '%' ? '%' : ''}
                        </span>
                        {kpi.plan > 0 && (
                          <span className="text-slate-500 text-xs font-medium">
                            / {kpi.plan.toLocaleString()}{kpi.unit === '%' ? '%' : ''}
                          </span>
                        )}
                      </div>
                      {kpi.plan > 0 && (
                        <span className={`text-sm font-bold ${percent >= 100 ? 'text-emerald-400' : percent >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {percent}%
                        </span>
                      )}
                    </div>
                    {kpi.plan > 0 && (
                      <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${percent >= 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    )}
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mt-1 block">
                      {kpi.name}
                    </span>
                  </div>
                );
              })}
              {project.kpis!.length > 3 && (
                <span className="text-[9px] text-slate-500 font-medium">+{project.kpis!.length - 3} ещё</span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-6">
              <span className="text-slate-600 text-sm">Нет KPI</span>
            </div>
          )}
        </div>

        <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-800/60">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 block">Здоровье</span>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              stats.hasRisks ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {stats.hasRisks ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <p className={`text-sm font-bold ${stats.hasRisks ? 'text-rose-400' : 'text-emerald-400'}`}>
                {stats.hasRisks ? 'Есть риски' : 'Все хорошо'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                {stats.hasOverdue ? 'Просроченные задачи' :
                 stats.kpiHealth ? 'KPI ниже 50%' :
                 !stats.hasKpiData ? 'Настройте KPI' :
                 'Рисков нет'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-[1.2] p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Контент</span>
            {project.contentAutoCalculate !== false && (
              <span className="text-[9px] text-blue-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                АВТО
              </span>
            )}
          </div>

          {stats.hasContentMetrics ? (
            <div className="flex items-center justify-between">
              {stats.contentMetrics.slice(0, 3).map((item, i) => (
                <div key={item.key} className={`flex-1 text-center ${i < stats.contentMetrics.length - 1 && i < 2 ? 'border-r border-slate-800/60' : ''}`}>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-bold text-white">{item.done}</span>
                    <span className="text-slate-500 text-xs font-medium">/ {item.total}</span>
                  </div>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mt-1 block truncate px-1">{item.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {[
                { label: 'Посты', val: stats.legacyContent.posts },
                { label: 'Reels', val: stats.legacyContent.reels },
                { label: 'Stories', val: stats.legacyContent.stories }
              ].map((item, i) => (
                <div key={item.label} className={`flex-1 text-center ${i < 2 ? 'border-r border-slate-800/60' : ''}`}>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-bold text-white">{item.val.done}</span>
                    <span className="text-slate-500 text-xs font-medium">/ {item.val.total}</span>
                  </div>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mt-1 block">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
        {!hasKpis && onSuggestKpi && (
          <button
            onClick={onSuggestKpi}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Предложить KPI
          </button>
        )}

        {hasAutoUpdateKpis && onSyncKpis && (
          <button
            onClick={onSyncKpis}
            disabled={isSyncingKpis}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSyncingKpis ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {isSyncingKpis ? 'Обновление...' : 'Обновить'}
          </button>
        )}

        <div className="flex-1" />

        {onEditKpi && (
          <button
            onClick={onEditKpi}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            KPI
          </button>
        )}

        {onEditContent && (
          <button
            onClick={onEditContent}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Контент
          </button>
        )}
      </div>
    </div>
  );
};

export default SmartDashboard;
