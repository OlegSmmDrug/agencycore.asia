import React from 'react';
import { AlertTriangle, TrendingUp, AlertCircle, DollarSign, Users, Clock } from 'lucide-react';
import { Client, Project, Task, Transaction } from '../../types';
import { MetricCard, AlertBadge, DataTable } from './DashboardWidgets';
import ProjectRaceTrack from '../ProjectRaceTrack';

interface DirectorDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  transactions: Transaction[];
}

const DirectorDashboard: React.FC<DirectorDashboardProps> = ({
  clients,
  projects,
  tasks,
  transactions
}) => {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const calculateCashGap = () => {
    const upcomingTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= today && date <= nextWeek;
    });

    const inflow = upcomingTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const outflow = Math.abs(
      upcomingTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    return { inflow, outflow, gap: inflow - outflow };
  };

  const cashGap = calculateCashGap();
  const isNegativeGap = cashGap.gap < 0;

  const getTopDebtors = () => {
    const activeClients = clients.filter(c => c.status === 'In Work');

    return activeClients
      .map(client => {
        const clientTransactions = transactions.filter(t => t.clientId === client.id);
        const totalPaid = clientTransactions.reduce((sum, t) => sum + t.amount, 0);
        const debt = client.budget - totalPaid;

        const lastPayment = clientTransactions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const daysOverdue = lastPayment
          ? Math.floor((today.getTime() - new Date(lastPayment.date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          client,
          debt,
          daysOverdue
        };
      })
      .filter(d => d.debt > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5);
  };

  const topDebtors = getTopDebtors();

  const getStalledProjects = () => {
    return projects
      .filter(p => {
        if (p.status === 'Completed' || p.status === 'Archived') return false;

        const projectTasks = tasks.filter(t => t.projectId === p.id);
        const lastActivity = projectTasks
          .map(t => new Date(t.createdAt || t.deadline || ''))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        if (!lastActivity) return false;

        const daysSinceActivity = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceActivity > 5;
      })
      .slice(0, 5);
  };

  const stalledProjects = getStalledProjects();

  const newLeadsThisWeek = clients.filter(c => {
    const created = new Date(c.createdAt);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return created >= weekAgo && c.status === 'New Lead';
  }).length;

  const contractsInSigning = clients.filter(c => c.status === 'Contract Signing').length;

  const potentialRevenue = clients
    .filter(c => c.status === 'Contract Signing' || c.status === 'Presentation')
    .reduce((sum, c) => sum + c.budget, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Операционная панель директора</h2>
          <p className="text-sm text-slate-500 mt-1">Критические показатели бизнеса</p>
        </div>
      </div>

      {/* Cash Gap Indicator */}
      <div className={`p-8 rounded-2xl border-2 ${isNegativeGap ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'} shadow-lg`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className={`w-8 h-8 ${isNegativeGap ? 'text-red-600' : 'text-green-600'}`} />
              <h3 className="text-xl font-bold text-slate-800">Cash Gap – Следующие 7 дней</h3>
            </div>
            <p className="text-sm text-slate-600">
              Критический индикатор ликвидности: прогноз входящих платежей vs обязательные расходы
            </p>
          </div>
          <AlertBadge level={isNegativeGap ? 'danger' : 'info'}>
            {isNegativeGap ? 'ТРЕБУЕТ ВНИМАНИЯ' : 'СТАБИЛЬНО'}
          </AlertBadge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Входящие платежи</p>
            <p className="text-3xl font-bold text-green-600">+{cashGap.inflow.toLocaleString('ru-RU')} ₸</p>
            <p className="text-xs text-slate-500 mt-2">Ожидаемые поступления</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Обязательные расходы</p>
            <p className="text-3xl font-bold text-red-600">-{cashGap.outflow.toLocaleString('ru-RU')} ₸</p>
            <p className="text-xs text-slate-500 mt-2">Зарплаты, налоги, аренда</p>
          </div>

          <div className={`bg-white p-6 rounded-xl shadow-sm border-2 ${isNegativeGap ? 'border-red-400' : 'border-green-400'}`}>
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Разрыв (Gap)</p>
            <p className={`text-3xl font-bold ${isNegativeGap ? 'text-red-600' : 'text-green-600'}`}>
              {cashGap.gap >= 0 ? '+' : ''}{cashGap.gap.toLocaleString('ru-RU')} ₸
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {isNegativeGap ? 'Требуется срочное привлечение средств' : 'Достаточная ликвидность'}
            </p>
          </div>
        </div>

        {isNegativeGap && (
          <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-sm font-semibold text-red-800">
              ⚠️ Действия: Ускорить получение дебиторки, отложить необязательные расходы, рассмотреть краткосрочный кредит
            </p>
          </div>
        )}
      </div>

      {/* Sales Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Новые лиды (неделя)"
          value={newLeadsThisWeek}
          icon={Users}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          subtitle="Квалифицированные заявки"
        />
        <MetricCard
          title="Договоры на подписании"
          value={contractsInSigning}
          icon={TrendingUp}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
          subtitle="В стадии закрытия сделки"
        />
        <MetricCard
          title="Потенциальная выручка"
          value={`${potentialRevenue.toLocaleString('ru-RU')} ₸`}
          icon={DollarSign}
          iconBgColor="bg-green-50"
          iconColor="text-green-600"
          subtitle="Сумма договоров в работе"
        />
      </div>

      {/* Project Race Track */}
      <ProjectRaceTrack projects={projects} tasks={tasks} clients={clients} />

      {/* Top Debtors */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <AlertCircle className="w-6 h-6 text-orange-600" />
          <h3 className="text-lg font-bold text-slate-800">Топ дебиторов (просроченные платежи)</h3>
        </div>

        {topDebtors.length > 0 ? (
          <DataTable
            headers={['Клиент', 'Долг', 'Дней просрочки', 'Статус']}
            rows={topDebtors.map(d => [
              d.client.company,
              `${d.debt.toLocaleString('ru-RU')} ₸`,
              d.daysOverdue,
              d.daysOverdue > 7 ? (
                <AlertBadge level="danger">Критично</AlertBadge>
              ) : d.daysOverdue > 3 ? (
                <AlertBadge level="warning">Внимание</AlertBadge>
              ) : (
                <AlertBadge level="info">Норма</AlertBadge>
              )
            ])}
          />
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">Нет просроченных платежей</p>
        )}
      </div>

      {/* Stalled Projects */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-bold text-slate-800">Застопорившиеся проекты ({">"} 5 дней без активности)</h3>
        </div>

        {stalledProjects.length > 0 ? (
          <div className="space-y-3">
            {stalledProjects.map(project => (
              <div key={project.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                <div>
                  <p className="font-semibold text-slate-800">{project.name}</p>
                  <p className="text-xs text-slate-500 mt-1">Статус: {project.status}</p>
                </div>
                <AlertBadge level="danger">Требует внимания</AlertBadge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">Все проекты движутся по плану</p>
        )}
      </div>
    </div>
  );
};

export default DirectorDashboard;
