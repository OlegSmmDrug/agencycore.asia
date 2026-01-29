import React from 'react';
import { Target, TrendingUp, AlertTriangle, DollarSign, Users, Zap } from 'lucide-react';
import { Client, Project, Task } from '../../types';
import { MetricCard, AlertBadge } from './DashboardWidgets';

interface TargetologistDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
}

interface ProjectCardData {
  project: Project;
  client: Client;
  dailySpend: number;
  dailyLimit: number;
  currentCPL: number;
  targetCPL: number;
  leadsToday: number;
  status: 'active' | 'learning' | 'paused' | 'rejected';
  platform: 'facebook' | 'instagram' | 'tiktok' | 'google';
}

const TargetologistDashboard: React.FC<TargetologistDashboardProps> = ({
  clients,
  projects,
  tasks,
  currentUserId
}) => {
  const myTasks = tasks.filter(t => t.assigneeId === currentUserId);
  const myProjectIds = [...new Set(myTasks.map(t => t.projectId).filter(Boolean))];
  const myProjects = projects.filter(p => myProjectIds.includes(p.id));

  const generateProjectCards = (): ProjectCardData[] => {
    return myProjects.map(project => {
      const client = clients.find(c => c.id === project.clientId);
      if (!client) return null;

      const mediaBudget = project.mediaBudget || 0;
      const daysInMonth = 30;
      const dailyLimit = mediaBudget / daysInMonth;

      const dailySpend = dailyLimit * (0.7 + Math.random() * 0.5);

      const targetCPL = 5000;
      const currentCPL = targetCPL * (0.8 + Math.random() * 0.6);

      const leadsToday = Math.floor(dailySpend / currentCPL);

      const platforms: ProjectCardData['platform'][] = ['facebook', 'instagram', 'google', 'tiktok'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];

      const statuses: ProjectCardData['status'][] = ['active', 'learning', 'paused'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      return {
        project,
        client,
        dailySpend,
        dailyLimit,
        currentCPL,
        targetCPL,
        leadsToday,
        status,
        platform
      };
    }).filter(Boolean) as ProjectCardData[];
  };

  const projectCards = generateProjectCards();

  const totalSpendToday = projectCards.reduce((sum, card) => sum + card.dailySpend, 0);
  const totalLeadsToday = projectCards.reduce((sum, card) => sum + card.leadsToday, 0);
  const activeProjects = projectCards.filter(c => c.status === 'active').length;
  const projectsOverBudget = projectCards.filter(c => c.dailySpend > c.dailyLimit).length;

  const getPlatformIcon = (platform: ProjectCardData['platform']) => {
    const icons = {
      facebook: '👤',
      instagram: '📸',
      tiktok: '🎵',
      google: '🔍'
    };
    return icons[platform];
  };

  const getStatusColor = (status: ProjectCardData['status']) => {
    const colors = {
      active: 'bg-green-100 text-green-700 border-green-200',
      learning: 'bg-blue-100 text-blue-700 border-blue-200',
      paused: 'bg-slate-100 text-slate-700 border-slate-200',
      rejected: 'bg-red-100 text-red-700 border-red-200'
    };
    return colors[status];
  };

  const getStatusLabel = (status: ProjectCardData['status']) => {
    const labels = {
      active: 'Активна',
      learning: 'Обучение',
      paused: 'На паузе',
      rejected: 'Отклонена'
    };
    return labels[status];
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Панель таргетолога</h2>
          <p className="text-sm text-slate-500 mt-1">Мониторинг рекламных кампаний и бюджетов</p>
        </div>
      </div>

      {/* Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Потрачено сегодня"
          value={`${totalSpendToday.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸`}
          icon={DollarSign}
          iconBgColor="bg-orange-50"
          iconColor="text-orange-600"
          subtitle="Суммарный расход"
        />
        <MetricCard
          title="Лидов сегодня"
          value={totalLeadsToday}
          icon={Users}
          iconBgColor="bg-green-50"
          iconColor="text-green-600"
          subtitle="Всего по всем проектам"
        />
        <MetricCard
          title="Активных кампаний"
          value={activeProjects}
          icon={Zap}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          subtitle="Сейчас в работе"
        />
        <MetricCard
          title="Превышение бюджета"
          value={projectsOverBudget}
          icon={AlertTriangle}
          iconBgColor="bg-red-50"
          iconColor="text-red-600"
          subtitle="Требуют внимания"
          alert={projectsOverBudget > 0 ? 'warning' : undefined}
        />
      </div>

      {/* Project Cards Grid */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-800">Мои проекты ({projectCards.length})</h3>
        </div>

        {projectCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectCards.map(card => {
              const budgetPercentage = Math.min((card.dailySpend / card.dailyLimit) * 100, 100);
              const isOverBudget = card.dailySpend > card.dailyLimit;
              const isCPLGood = card.currentCPL <= card.targetCPL;

              return (
                <div
                  key={card.project.id}
                  className={`bg-white rounded-xl border-2 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden ${
                    isOverBudget ? 'border-red-300' : 'border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="text-white font-bold text-lg leading-tight">
                          {card.client.company}
                        </p>
                        <p className="text-slate-300 text-xs mt-1">{card.project.name}</p>
                      </div>
                      <span className="text-3xl ml-2">{getPlatformIcon(card.platform)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(card.status)}`}>
                        {getStatusLabel(card.status)}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4">
                    {/* Budget Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Дневной бюджет</span>
                        <span className={`text-xs font-bold ${isOverBudget ? 'text-red-600' : 'text-slate-700'}`}>
                          {budgetPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOverBudget ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${budgetPercentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-slate-600">
                          Потрачено: <span className="font-bold">{card.dailySpend.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸</span>
                        </span>
                        <span className="text-xs text-slate-500">
                          Лимит: {card.dailyLimit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                        </span>
                      </div>
                    </div>

                    {/* CPL Indicator */}
                    <div className={`p-4 rounded-lg border-2 ${isCPLGood ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-600 uppercase">Стоимость лида (CPL)</span>
                        {isCPLGood ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black ${isCPLGood ? 'text-green-700' : 'text-red-700'}`}>
                          {card.currentCPL.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                        </span>
                        <span className="text-sm text-slate-500">
                          / цель: {card.targetCPL.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                        </span>
                      </div>
                      <p className="text-xs font-semibold mt-2 text-slate-600">
                        {isCPLGood ? '✓ В пределах целевого показателя' : '⚠ Выше целевого показателя'}
                      </p>
                    </div>

                    {/* Leads Today */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-600">Лидов сегодня</span>
                      <span className="text-2xl font-bold text-blue-600">{card.leadsToday}</span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  {isOverBudget && (
                    <div className="bg-red-50 border-t-2 border-red-200 p-3">
                      <p className="text-xs font-bold text-red-700 text-center">
                        ⚠️ ПРЕВЫШЕН ДНЕВНОЙ БЮДЖЕТ
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
            <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Нет активных проектов</h3>
            <p className="text-sm text-slate-500">
              У вас пока нет назначенных рекламных кампаний
            </p>
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          Рекомендации
        </h4>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Проверяйте CPL каждые 2-3 часа в активных кампаниях</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>При CPL {">"} 120% от целевого — отключите неэффективные связки</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Масштабируйте бюджет на связках с CPL {"<"} 80% от целевого</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default TargetologistDashboard;
