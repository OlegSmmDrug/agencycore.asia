
import React from 'react';
import { Project } from '../types';
import { ExternalLink, Target, CreditCard, Calendar, CheckCircle2, ListChecks } from 'lucide-react';

interface Props {
  project: Project;
}

const OverviewTab: React.FC<Props> = ({ project }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Professional Banner */}
      <div className="relative h-64 rounded-xl overflow-hidden shadow-sm border border-slate-200">
        <img 
          src={project.imageUrl} 
          alt={project.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent flex items-end">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">Проект активен</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{project.name}</h2>
            <p className="text-slate-200 max-w-2xl text-sm leading-relaxed font-medium opacity-90 line-clamp-2">
              {project.description}
            </p>
          </div>
        </div>
      </div>

      {/* Refined Stats Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card divide-y lg:divide-y-0 lg:divide-x divide-slate-100 grid grid-cols-1 lg:grid-cols-4">
        {[
          { label: 'Общий бюджет', value: `${project.budget.toLocaleString()} ₸`, icon: CreditCard, color: 'text-blue-600' },
          { label: 'Медиа бюджет', value: `${project.mediaBudget.toLocaleString()} ₸`, icon: Target, color: 'text-indigo-600' },
          { label: 'Дата старта', value: new Date(project.startDate).toLocaleDateString('ru-RU'), icon: Calendar, color: 'text-slate-600' },
          { label: 'Дедлайн', value: new Date(project.endDate).toLocaleDateString('ru-RU'), icon: CheckCircle2, color: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className="p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1.5">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color} opacity-80`} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
            </div>
            <p className="text-lg font-extrabold text-slate-900 leading-none">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scope of Work Section */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-blue-600" />
              Объем работ по проекту
            </h3>
            <div className="grid grid-cols-1 gap-1">
              {project.scopeOfWork.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between py-3 px-4 rounded-lg transition-colors ${idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}
                >
                  <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md min-w-[50px] text-center">
                    {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-4 bg-emerald-500 rounded-full" />
              Показатели эффективности (KPI)
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {project.kpis.map((kpi) => {
                const progress = (kpi.fact / kpi.plan) * 100;
                return (
                  <div key={kpi.id}>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold text-slate-700">{kpi.name}</p>
                      <p className="text-[10px] font-bold text-blue-600">{progress.toFixed(0)}%</p>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1.5">
                      Текущий результат: {kpi.fact} / {kpi.plan} {kpi.unit}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Services and Links Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-600 rounded-full" />
              Список услуг
            </h3>
            <div className="flex flex-wrap gap-2">
              {project.services.map((service, i) => (
                <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 uppercase tracking-tight">
                  {service}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-indigo-600 rounded-full" />
              Полезные ссылки
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {project.quickLinks.map((link) => (
                <a 
                  key={link.id} 
                  href={link.url} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-white transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${link.color}`} />
                    <span className="text-xs font-bold text-slate-700">{link.name}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
