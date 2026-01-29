import React from 'react';
import { Target, Phone, Calendar, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { Client, Task, Transaction, ClientStatus, TaskStatus } from '../../types';
import { MetricCard, ProgressCard, AlertBadge } from './DashboardWidgets';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface SalesManagerDashboardProps {
  clients: Client[];
  tasks: Task[];
  transactions: Transaction[];
  currentUserId: string;
  currentUserSalary: number;
}

const SalesManagerDashboard: React.FC<SalesManagerDashboardProps> = ({
  clients,
  tasks,
  transactions,
  currentUserId,
  currentUserSalary
}) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const myClients = clients.filter(c => c.managerId === currentUserId);
  const myTransactions = transactions.filter(t =>
    myClients.some(c => c.id === t.clientId)
  );
  const myTasks = tasks.filter(t => t.assigneeId === currentUserId);

  const monthlyGoal = 10000000;

  const monthRevenue = myTransactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.amount > 0;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const commission = monthRevenue * 0.10;
  const totalIncome = currentUserSalary + commission;

  const dailyCallsGoal = 20;
  const dailyMeetingsGoal = 3;

  const todayStr = today.toISOString().split('T')[0];
  const callsToday = myTasks.filter(t =>
    t.type === 'Call' &&
    t.deadline?.startsWith(todayStr)
  ).length;

  const meetingsToday = myTasks.filter(t =>
    t.type === 'Meeting' &&
    t.deadline?.startsWith(todayStr) &&
    t.status !== TaskStatus.DONE
  ).length;

  const getFunnelData = () => {
    const statusOrder = [
      ClientStatus.NEW_LEAD,
      ClientStatus.CONTACTED,
      ClientStatus.PRESENTATION,
      ClientStatus.CONTRACT,
      ClientStatus.IN_WORK
    ];

    const statusLabels: Record<ClientStatus, string> = {
      [ClientStatus.NEW_LEAD]: 'Новый лид',
      [ClientStatus.CONTACTED]: 'Контакт',
      [ClientStatus.PRESENTATION]: 'Презентация',
      [ClientStatus.CONTRACT]: 'Договор',
      [ClientStatus.IN_WORK]: 'В работе',
      [ClientStatus.WON]: 'Выиграно',
      [ClientStatus.LOST]: 'Потеряно',
      [ClientStatus.ARCHIVED]: 'Архив'
    };

    return statusOrder.map(status => ({
      name: statusLabels[status],
      count: myClients.filter(c => c.status === status).length
    }));
  };

  const funnelData = getFunnelData();

  const getActionableLeads = () => {
    const newLeads = myClients.filter(c => c.status === ClientStatus.NEW_LEAD);

    const stalledDeals = myClients
      .filter(c => {
        if (c.status === ClientStatus.IN_WORK || c.status === ClientStatus.WON || c.status === ClientStatus.LOST) {
          return false;
        }

        const statusDate = new Date(c.statusChangedAt || c.createdAt);
        const hoursSinceUpdate = (today.getTime() - statusDate.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate > 24;
      });

    return { newLeads, stalledDeals };
  };

  const { newLeads, stalledDeals } = getActionableLeads();

  const getTodayTasks = () => {
    return myTasks
      .filter(t => t.deadline?.startsWith(todayStr) && t.status !== TaskStatus.DONE)
      .sort((a, b) => {
        const order = { Call: 1, Meeting: 2, Task: 3 };
        return (order[a.type as keyof typeof order] || 99) - (order[b.type as keyof typeof order] || 99);
      });
  };

  const todayTasks = getTodayTasks();

  const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Кабинет менеджера по продажам</h2>
          <p className="text-sm text-slate-500 mt-1">Личная эффективность и воронка продаж</p>
        </div>
      </div>

      {/* Quota Progress - Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-blue-100 text-sm font-semibold uppercase tracking-wider mb-2">Прогресс по квоте</p>
            <h3 className="text-4xl font-black">
              {monthRevenue.toLocaleString('ru-RU')} ₸
            </h3>
            <p className="text-blue-200 text-sm mt-1">
              из {monthlyGoal.toLocaleString('ru-RU')} ₸ месячной цели
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black text-blue-200">
              {((monthRevenue / monthlyGoal) * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="w-full bg-blue-900/50 rounded-full h-6 overflow-hidden mb-6">
          <div
            className="bg-gradient-to-r from-green-400 to-green-500 h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-3"
            style={{ width: `${Math.min((monthRevenue / monthlyGoal) * 100, 100)}%` }}
          >
            {monthRevenue > 0 && (
              <span className="text-white text-xs font-bold">
                {((monthRevenue / monthlyGoal) * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-700/50 rounded-lg p-4">
            <p className="text-blue-200 text-xs font-semibold mb-1">Мой доход</p>
            <p className="text-2xl font-bold">{totalIncome.toLocaleString('ru-RU')} ₸</p>
          </div>
          <div className="bg-blue-700/50 rounded-lg p-4">
            <p className="text-blue-200 text-xs font-semibold mb-1">Бонус (10%)</p>
            <p className="text-2xl font-bold text-green-300">+{commission.toLocaleString('ru-RU')} ₸</p>
          </div>
          <div className="bg-blue-700/50 rounded-lg p-4">
            <p className="text-blue-200 text-xs font-semibold mb-1">До цели</p>
            <p className="text-2xl font-bold">{(monthlyGoal - monthRevenue).toLocaleString('ru-RU')} ₸</p>
          </div>
        </div>
      </div>

      {/* Daily Activity Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Звонки сегодня</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">{callsToday} / {dailyCallsGoal}</p>
            </div>
            <div className="relative w-24 h-24">
              <svg className="transform -rotate-90" width="96" height="96">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(callsToday / dailyCallsGoal) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Phone className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {callsToday >= dailyCallsGoal ? '✓ План выполнен!' : `Осталось ${dailyCallsGoal - callsToday} звонков`}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Встречи сегодня</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">{meetingsToday} / {dailyMeetingsGoal}</p>
            </div>
            <div className="relative w-24 h-24">
              <svg className="transform -rotate-90" width="96" height="96">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(meetingsToday / dailyMeetingsGoal) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {meetingsToday >= dailyMeetingsGoal ? '✓ План выполнен!' : `Осталось ${dailyMeetingsGoal - meetingsToday} встреч`}
          </p>
        </div>
      </div>

      {/* Sales Funnel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-800">Моя воронка продаж</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                angle={-15}
                textAnchor="end"
                height={80}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  padding: '12px'
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={60}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Focus Zone - Actionable Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Leads */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6 text-orange-600" />
            <h3 className="text-lg font-bold text-slate-800">Новые лиды ({newLeads.length})</h3>
          </div>

          {newLeads.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {newLeads.map(client => (
                <div key={client.id} className="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-slate-800">{client.company}</p>
                    <AlertBadge level="warning">Новый</AlertBadge>
                  </div>
                  <p className="text-sm text-slate-600">{client.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{client.phone} • {client.email}</p>
                  <p className="text-xs font-semibold text-orange-600 mt-2">
                    Бюджет: {client.budget.toLocaleString('ru-RU')} ₸
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Новых лидов нет</p>
          )}
        </div>

        {/* Stalled Deals */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-slate-800">Застопорившиеся сделки ({stalledDeals.length})</h3>
          </div>

          {stalledDeals.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {stalledDeals.map(client => (
                <div key={client.id} className="p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-slate-800">{client.company}</p>
                    <AlertBadge level="danger">{">"}24ч</AlertBadge>
                  </div>
                  <p className="text-sm text-slate-600">Статус: {client.status}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Последнее обновление: {new Date(client.statusChangedAt || client.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Все сделки в работе</p>
          )}
        </div>
      </div>

      {/* Today's Task Feed */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-800">Задачи на сегодня ({todayTasks.length})</h3>
        </div>

        {todayTasks.length > 0 ? (
          <div className="space-y-2">
            {todayTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {task.deadline && new Date(task.deadline).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  task.type === 'Call' ? 'bg-blue-100 text-blue-700' :
                  task.type === 'Meeting' ? 'bg-green-100 text-green-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {task.type}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">На сегодня задач нет</p>
        )}
      </div>
    </div>
  );
};

export default SalesManagerDashboard;
