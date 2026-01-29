
import React from 'react';
import { AIAgent, UsageStats, AgentRole, Lead } from '../../types';
import { ROLE_TEMPLATES } from '../../constants/aiAgents';

interface HubProps {
  agents: AIAgent[];
  stats: UsageStats;
  leads: Lead[];
  onNavigateAgents: () => void;
}

const Hub: React.FC<HubProps> = ({ agents, stats, leads, onNavigateAgents }) => {
  const roles: AgentRole[] = ['seller', 'project_writer', 'tz_writer', 'executor_controller', 'finalizer', 'review_collector'];

  return (
    <div className="p-8 space-y-10 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Запросы (Месяц)', value: stats.requestsToday, icon: '⚡', color: 'indigo' },
          { label: 'Новые лиды', value: leads.length, icon: '🎯', color: 'blue' },
          { label: 'Расходы ИИ', value: `$${stats.costSpent.toFixed(3)}`, icon: '💰', color: 'green' },
          { label: 'ROI проекта', value: '380%', icon: '🚀', color: 'amber' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 transition-transform hover:scale-105">
             <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center text-2xl`}>
                {stat.icon}
             </div>
             <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-gray-900 leading-none mt-1">{stat.value}</p>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-black text-gray-800 tracking-tight">Воронка продаж <span className="text-indigo-400">(онлайн)</span></h3>
            <button className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">Полная воронка →</button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
             {[{en: 'Qualified', ru: 'Квалификация'}, {en: 'Proposal', ru: 'Предложение'}, {en: 'Contract', ru: 'Договор'}].map(step => (
               <div key={step.en} className="bg-gray-100/50 p-4 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-4">{step.ru}</p>
                  <div className="space-y-3">
                    {leads.filter(l => step.en.toLowerCase().includes(l.status)).slice(0, 3).map(lead => (
                      <div key={lead.id} className="bg-white p-3 rounded-2xl border shadow-sm text-xs font-bold flex items-center justify-between">
                         <span className="truncate w-24">{lead.name}</span>
                         <span className="text-green-500">{lead.score}/10</span>
                      </div>
                    ))}
                    {leads.length === 0 && <div className="text-[10px] text-gray-300 italic py-4">Нет данных</div>}
                  </div>
               </div>
             ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => {
              const agent = agents.find(a => a.role === role);
              const template = ROLE_TEMPLATES[role];
              return (
                <div key={role} className={`group bg-white p-5 rounded-3xl border transition-all ${agent?.status === 'active' ? 'border-indigo-100 shadow-sm' : 'opacity-40 hover:opacity-100'}`}>
                  <div className="flex items-start justify-between mb-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${agent?.status === 'active' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                        {role === 'seller' ? '💰' : role === 'project_writer' ? '📝' : role === 'tz_writer' ? '📐' : role === 'executor_controller' ? '👁️' : role === 'finalizer' ? '🎁' : '⭐'}
                     </div>
                     <span className={`w-2 h-2 rounded-full ${agent?.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                  </div>
                  <h4 className="font-black text-gray-900 text-sm">{template.name}</h4>
                  <div className="mt-4 flex justify-between text-[9px] font-black text-gray-400 uppercase">
                     <span>Задач: {Math.floor(Math.random() * 20)}</span>
                     <span>Время работы: 99.9%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
           <div className="bg-[#1e1e2d] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl h-full">
              <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                 Системная аналитика
              </h3>
              <div className="space-y-6 relative z-10">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <p className="text-xs font-bold text-indigo-400 mb-2 uppercase tracking-widest">Аналитика диалогов</p>
                    <p className="text-xs text-gray-300 leading-relaxed italic">
                      "ИИ Продавец выявил 3 новых лида с бюджетом выше 100к. Рекомендую передать данные ИИ Составителю ТЗ для подготовки документов."
                    </p>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <p className="text-xs font-bold text-amber-400 mb-2 uppercase tracking-widest">Бюджетный риск</p>
                    <p className="text-xs text-gray-300 leading-relaxed italic">
                      "При текущей нагрузке лимит в $20 будет исчерпан за 22 дня. Включите Claude Haiku для простых FAQ."
                    </p>
                 </div>
              </div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
           </div>
        </aside>
      </div>
    </div>
  );
};

export default Hub;
