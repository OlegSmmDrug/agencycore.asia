import React from 'react';
import { Briefcase, Clock, CheckCircle, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Client, Project, Task, ProjectStatus, TaskStatus } from '../../types';
import { MetricCard, AlertBadge } from './DashboardWidgets';
import ProjectRaceTrack from '../ProjectRaceTrack';

interface ProjectManagerDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
}

const ProjectManagerDashboard: React.FC<ProjectManagerDashboardProps> = ({
  clients,
  projects,
  tasks,
  currentUserId
}) => {

  const myTasks = tasks.filter(t => t.assigneeId === currentUserId || t.creatorId === currentUserId);
  const myProjectIds = [...new Set(myTasks.map(t => t.projectId).filter(Boolean))];
  const myProjects = projects.filter(p => myProjectIds.includes(p.id) || p.teamIds?.includes(currentUserId));
  const myProjectTasks = tasks.filter(t => myProjectIds.includes(t.projectId || ''));

  const activeProjects = myProjects.filter(p =>
    p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED
  );

  const getAwaitingApproval = () => {
    return myProjectTasks.filter(t => t.status === TaskStatus.PENDING_CLIENT);
  };

  const awaitingApproval = getAwaitingApproval();

  const getUpcomingDeadlines = () => {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    return myProjectTasks.filter(t => {
      if (!t.deadline) return false;
      if (t.status === TaskStatus.DONE) return false;

      const deadline = new Date(t.deadline);
      const now = new Date();
      return deadline <= twoDaysFromNow && deadline >= now;
    });
  };

  const upcomingDeadlines = getUpcomingDeadlines();


  const getReadyForPayment = () => {
    return myProjectTasks.filter(t => {
      if (t.status !== TaskStatus.DONE) return false;

      const taskTypes: TaskStatus[] = ['Post' as any, 'Reels' as any, 'Stories' as any];
      return taskTypes.includes(t.type as any);
    });
  };

  const readyForPayment = getReadyForPayment();

  const getContentCalendar = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todayContent = myProjectTasks.filter(t =>
      t.deadline?.startsWith(todayStr) &&
      (t.type === 'Post' || t.type === 'Reels' || t.type === 'Stories')
    );

    const tomorrowContent = myProjectTasks.filter(t =>
      t.deadline?.startsWith(tomorrowStr) &&
      (t.type === 'Post' || t.type === 'Reels' || t.type === 'Stories')
    );

    return { todayContent, tomorrowContent };
  };

  const { todayContent, tomorrowContent } = getContentCalendar();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Управление проектами</h2>
          <p className="text-sm text-slate-500 mt-1">Контроль потока и дедлайнов</p>
        </div>
      </div>

      {/* Operational Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Проектов в работе"
          value={activeProjects.length}
          icon={Briefcase}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          subtitle="Активных проектов"
        />
        <MetricCard
          title="Ожидают клиента"
          value={awaitingApproval.length}
          icon={AlertCircle}
          iconBgColor="bg-orange-50"
          iconColor="text-orange-600"
          subtitle="Задач на аппруве"
          alert={awaitingApproval.length > 0 ? 'warning' : undefined}
        />
        <MetricCard
          title="Срочные дедлайны"
          value={upcomingDeadlines.length}
          icon={Clock}
          iconBgColor="bg-red-50"
          iconColor="text-red-600"
          subtitle="< 48 часов"
          alert={upcomingDeadlines.length > 0 ? 'danger' : undefined}
        />
        <MetricCard
          title="К оплате"
          value={readyForPayment.length}
          icon={CheckCircle}
          iconBgColor="bg-green-50"
          iconColor="text-green-600"
          subtitle="Готов к расчету"
        />
      </div>

      {/* Project Race Track */}
      <ProjectRaceTrack projects={myProjects} tasks={myProjectTasks} clients={clients} />


      {/* Bottom Row: Content Calendar + Urgent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content Calendar Widget */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <CalendarIcon className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-bold text-slate-800">Контент-календарь</h3>
          </div>

          <div className="space-y-4">
            {/* Today */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase">Сегодня</p>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                  {todayContent.length}
                </span>
              </div>

              {todayContent.length > 0 ? (
                <div className="space-y-2">
                  {todayContent.slice(0, 3).map(task => (
                    <div key={task.id} className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          task.type === 'Post' ? 'bg-purple-100 text-purple-700' :
                          task.type === 'Reels' ? 'bg-pink-100 text-pink-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {task.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium">{task.title}</p>
                    </div>
                  ))}
                  {todayContent.length > 3 && (
                    <p className="text-xs text-center text-blue-600 font-semibold">
                      +{todayContent.length - 3} ещё
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Публикаций нет</p>
              )}
            </div>

            {/* Tomorrow */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase">Завтра</p>
                <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs font-bold">
                  {tomorrowContent.length}
                </span>
              </div>

              {tomorrowContent.length > 0 ? (
                <div className="space-y-2">
                  {tomorrowContent.slice(0, 3).map(task => (
                    <div key={task.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          task.type === 'Post' ? 'bg-purple-100 text-purple-700' :
                          task.type === 'Reels' ? 'bg-pink-100 text-pink-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {task.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium">{task.title}</p>
                    </div>
                  ))}
                  {tomorrowContent.length > 3 && (
                    <p className="text-xs text-center text-slate-600 font-semibold">
                      +{tomorrowContent.length - 3} ещё
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Публикаций нет</p>
              )}
            </div>
          </div>
        </div>

        {/* Urgent Deadlines */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-slate-800">Срочные дедлайны</h3>
          </div>

          {upcomingDeadlines.length > 0 ? (
            <div className="space-y-3">
              {upcomingDeadlines.slice(0, 5).map(task => {
                const project = myProjects.find(p => p.id === task.projectId);
                const hoursLeft = Math.floor((new Date(task.deadline!).getTime() - new Date().getTime()) / (1000 * 60 * 60));

                return (
                  <div key={task.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-slate-800 text-sm">{task.title}</p>
                      <AlertBadge level="danger">{hoursLeft}ч</AlertBadge>
                    </div>
                    <p className="text-xs text-slate-600">{project?.name}</p>
                    <p className="text-xs text-red-600 font-semibold mt-1">
                      {new Date(task.deadline!).toLocaleDateString('ru-RU')} в {new Date(task.deadline!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-12">
              Нет срочных дедлайнов
            </p>
          )}
        </div>

        {/* Awaiting Client */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6 text-orange-600" />
            <h3 className="text-lg font-bold text-slate-800">Ожидают клиента</h3>
          </div>

          {awaitingApproval.length > 0 ? (
            <div className="space-y-3">
              {awaitingApproval.slice(0, 5).map(task => {
                const project = myProjects.find(p => p.id === task.projectId);
                const client = clients.find(c => c.id === project?.clientId);

                return (
                  <div key={task.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="font-semibold text-slate-800 text-sm mb-1">{task.title}</p>
                    <p className="text-xs text-slate-600">{client?.company}</p>
                    <div className="flex items-center justify-between mt-2">
                      <AlertBadge level="warning">На аппруве</AlertBadge>
                      <span className="text-[10px] text-slate-500">
                        {project?.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-12">
              Все задачи в работе
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManagerDashboard;
