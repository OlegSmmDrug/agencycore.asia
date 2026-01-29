import React, { useMemo } from 'react';
import { CheckSquare, Clock, CheckCircle, AlertCircle, Calendar as CalendarIcon, FileText, Film, Image as ImageIcon, LucideIcon } from 'lucide-react';
import { Client, Project, Task, TaskStatus } from '../../types';
import { MetricCard, AlertBadge } from './DashboardWidgets';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SmmDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
}

const SmmDashboard: React.FC<SmmDashboardProps> = ({
  clients,
  projects,
  tasks,
  currentUserId
}) => {
  const myTasks = useMemo(() =>
    tasks.filter(t =>
      t.assigneeId === currentUserId &&
      (t.type === 'Post' || t.type === 'Reels' || t.type === 'Stories')
    ),
    [tasks, currentUserId]
  );

  const inProgressCount = useMemo(() =>
    myTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    [myTasks]
  );

  const onApprovalCount = useMemo(() =>
    myTasks.filter(t =>
      t.status === TaskStatus.PENDING_CLIENT ||
      t.status === TaskStatus.REVIEW
    ).length,
    [myTasks]
  );

  const completedTodayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return myTasks.filter(t => {
      if (t.status !== TaskStatus.DONE || !t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === today.getTime();
    }).length;
  }, [myTasks]);

  const deadlineEndOfDayCount = useMemo(() => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return myTasks.filter(t => {
      if (!t.deadline || t.status === TaskStatus.DONE) return false;
      const deadline = new Date(t.deadline);
      return deadline <= endOfDay;
    }).length;
  }, [myTasks]);

  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const weekDays = useMemo(() => getWeekDays(), []);

  const weeklyCalendar = useMemo(() => {
    return weekDays.map(day => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTasks = myTasks.filter(t => {
        if (!t.deadline) return false;
        const deadline = new Date(t.deadline);
        return deadline >= dayStart && deadline <= dayEnd;
      });

      return {
        date: day,
        posts: dayTasks.filter(t => t.type === 'Post').length,
        reels: dayTasks.filter(t => t.type === 'Reels').length,
        stories: dayTasks.filter(t => t.type === 'Stories').length,
        tasks: dayTasks
      };
    });
  }, [myTasks, weekDays]);

  const weeklyStats = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekTasks = myTasks.filter(t => {
      if (!t.deadline) return false;
      const deadline = new Date(t.deadline);
      return deadline >= startOfWeek && deadline <= endOfWeek;
    });

    const posts = weekTasks.filter(t => t.type === 'Post');
    const reels = weekTasks.filter(t => t.type === 'Reels');
    const stories = weekTasks.filter(t => t.type === 'Stories');

    return {
      posts: {
        done: posts.filter(t => t.status === TaskStatus.DONE).length,
        total: posts.length
      },
      reels: {
        done: reels.filter(t => t.status === TaskStatus.DONE).length,
        total: reels.length
      },
      stories: {
        done: stories.filter(t => t.status === TaskStatus.DONE).length,
        total: stories.length
      }
    };
  }, [myTasks]);

  const chartData = useMemo(() => {
    return weeklyCalendar.map((day, index) => ({
      name: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][index],
      Посты: day.posts,
      Reels: day.reels,
      Stories: day.stories
    }));
  }, [weeklyCalendar]);

  const awaitingApproval = useMemo(() =>
    myTasks
      .filter(t => t.status === TaskStatus.PENDING_CLIENT)
      .sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return aDate - bDate;
      }),
    [myTasks]
  );

  const urgentTasks = useMemo(() => {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return myTasks
      .filter(t => {
        if (!t.deadline || t.status === TaskStatus.DONE) return false;
        const deadline = new Date(t.deadline);
        const isOverdue = deadline < now;
        const isUrgent = deadline < in24Hours;
        return isOverdue || isUrgent;
      })
      .sort((a, b) => {
        const aDate = new Date(a.deadline || 0).getTime();
        const bDate = new Date(b.deadline || 0).getTime();
        return aDate - bDate;
      });
  }, [myTasks]);

  const todayTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    return myTasks
      .filter(t => {
        if (!t.deadline || t.status === TaskStatus.DONE) return false;
        const deadline = new Date(t.deadline);
        return deadline >= today && deadline <= endOfDay;
      })
      .sort((a, b) => {
        const aDate = new Date(a.deadline || 0).getTime();
        const bDate = new Date(b.deadline || 0).getTime();
        return aDate - bDate;
      });
  }, [myTasks]);

  const weekTasks = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return myTasks
      .filter(t => {
        if (!t.deadline || t.status === TaskStatus.DONE) return false;
        const deadline = new Date(t.deadline);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return deadline > today && deadline <= in7Days;
      })
      .sort((a, b) => {
        const aDate = new Date(a.deadline || 0).getTime();
        const bDate = new Date(b.deadline || 0).getTime();
        return aDate - bDate;
      });
  }, [myTasks]);

  const getProject = (projectId?: string) => {
    return projects.find(p => p.id === projectId);
  };

  const getClient = (clientId?: string) => {
    return clients.find(c => c.id === clientId);
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'Post': return <FileText className="w-4 h-4" />;
      case 'Reels': return <Film className="w-4 h-4" />;
      case 'Stories': return <ImageIcon className="w-4 h-4" />;
      default: return <CheckSquare className="w-4 h-4" />;
    }
  };

  const formatTimeUntil = (deadline: string) => {
    const now = new Date();
    const target = new Date(deadline);
    const diff = target.getTime() - now.getTime();

    if (diff < 0) {
      const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      if (days > 0) return `Просрочено на ${days} дн.`;
      return `Просрочено на ${hours} ч.`;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `Через ${days} дн.`;
    if (hours > 0) return `Через ${hours} ч.`;
    return 'Менее часа';
  };

  const getWaitingTime = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diff = now.getTime() - created.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} дн. ${hours} ч.`;
    return `${hours} ч.`;
  };

  const getStatusColor = (task: Task) => {
    if (!task.deadline) return 'bg-gray-100 border-gray-300';
    const now = new Date();
    const deadline = new Date(task.deadline);

    if (task.status === TaskStatus.DONE) return 'bg-green-50 border-green-300';
    if (deadline < now) return 'bg-red-50 border-red-400';
    if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.REVIEW) {
      return 'bg-yellow-50 border-yellow-300';
    }
    return 'bg-gray-50 border-gray-300';
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Моя загрузка сегодня"
          value={inProgressCount}
          icon={CheckSquare}
        />

        <MetricCard
          title="На апруве"
          value={onApprovalCount}
          icon={Clock}
          alert={onApprovalCount > 3 ? 'warning' : undefined}
        />

        <MetricCard
          title="Готово сегодня"
          value={completedTodayCount}
          icon={CheckCircle}
        />

        <MetricCard
          title="Дедлайн до конца дня"
          value={deadlineEndOfDayCount}
          icon={AlertCircle}
          alert={deadlineEndOfDayCount > 0 ? 'danger' : undefined}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">Контент-план на неделю</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {weeklyCalendar.map((day, index) => {
            const dayName = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][index];
            const dateStr = `${day.date.getDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][day.date.getMonth()]}`;

            return (
              <div key={index} className="border border-slate-200 rounded-lg p-4">
                <div className="text-center mb-3">
                  <div className="font-semibold text-slate-800">{dayName}</div>
                  <div className="text-xs text-slate-500">{dateStr}</div>
                </div>

                <div className="space-y-2">
                  {day.posts > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-slate-700">{day.posts} постов</span>
                    </div>
                  )}

                  {day.reels > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Film className="w-4 h-4 text-purple-600" />
                      <span className="text-slate-700">{day.reels} reels</span>
                    </div>
                  )}

                  {day.stories > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <ImageIcon className="w-4 h-4 text-pink-600" />
                      <span className="text-slate-700">{day.stories} stories</span>
                    </div>
                  )}

                  {day.posts === 0 && day.reels === 0 && day.stories === 0 && (
                    <div className="text-xs text-slate-400 text-center">Нет задач</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Статистика за неделю</h3>

          <div className="mb-6" style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Посты" fill="#3b82f6" />
                <Bar dataKey="Reels" fill="#a855f7" />
                <Bar dataKey="Stories" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3 bg-slate-50 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-700 mb-2">Выполнено за неделю:</div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-slate-700">Постов:</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-800">{weeklyStats.posts.done}</span>
                <span className="text-slate-500"> из {weeklyStats.posts.total}</span>
                {weeklyStats.posts.total > 0 && (
                  <span className="text-slate-500 ml-1">
                    ({Math.round(weeklyStats.posts.done / weeklyStats.posts.total * 100)}%)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-slate-700">Reels:</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-800">{weeklyStats.reels.done}</span>
                <span className="text-slate-500"> из {weeklyStats.reels.total}</span>
                {weeklyStats.reels.total > 0 && (
                  <span className="text-slate-500 ml-1">
                    ({Math.round(weeklyStats.reels.done / weeklyStats.reels.total * 100)}%)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-pink-600" />
                <span className="text-sm text-slate-700">Stories:</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-800">{weeklyStats.stories.done}</span>
                <span className="text-slate-500"> из {weeklyStats.stories.total}</span>
                {weeklyStats.stories.total > 0 && (
                  <span className="text-slate-500 ml-1">
                    ({Math.round(weeklyStats.stories.done / weeklyStats.stories.total * 100)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Ожидают апрува</h3>

          {awaitingApproval.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Нет задач на апруве</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {awaitingApproval.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);
                const waitTime = getWaitingTime(task.createdAt || new Date().toISOString());
                const isLongWait = new Date().getTime() - new Date(task.createdAt || 0).getTime() > 48 * 60 * 60 * 1000;

                return (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-4 ${isLongWait ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {task.type === 'Post' && '📝'}
                        {task.type === 'Reels' && '🎬'}
                        {task.type === 'Stories' && '📸'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                        <div className="text-sm text-slate-600 mt-1">
                          Клиент: {client?.name || 'Неизвестно'}
                        </div>
                        <div className={`text-sm mt-1 ${isLongWait ? 'text-red-700 font-medium' : 'text-orange-700'}`}>
                          Ожидает: {waitTime}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Мои задачи</h3>

        <div className="space-y-6">
          {urgentTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <h4 className="font-semibold text-red-700">СРОЧНО</h4>
              </div>
              <div className="space-y-2">
                {urgentTasks.map(task => {
                  const project = getProject(task.projectId);
                  const client = getClient(project?.clientId);

                  return (
                    <div key={task.id} className={`border-2 rounded-lg p-4 ${getStatusColor(task)}`}>
                      <div className="flex items-center gap-3">
                        <div className="text-slate-700">{getTaskIcon(task.type)}</div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{task.title}</div>
                          <div className="text-sm text-slate-600">
                            {client?.name || project?.name || 'Без проекта'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-red-700">
                            {task.deadline && formatTimeUntil(task.deadline)}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {task.priority === 'High' && '🔴'}
                            {task.priority === 'Medium' && '🟡'}
                            {task.priority === 'Low' && '🟢'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {todayTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h4 className="font-semibold text-orange-700">СЕГОДНЯ</h4>
              </div>
              <div className="space-y-2">
                {todayTasks.map(task => {
                  const project = getProject(task.projectId);
                  const client = getClient(project?.clientId);

                  return (
                    <div key={task.id} className={`border-2 rounded-lg p-4 ${getStatusColor(task)}`}>
                      <div className="flex items-center gap-3">
                        <div className="text-slate-700">{getTaskIcon(task.type)}</div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{task.title}</div>
                          <div className="text-sm text-slate-600">
                            {client?.name || project?.name || 'Без проекта'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-orange-700">
                            {task.deadline && formatTimeUntil(task.deadline)}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {task.priority === 'High' && '🔴'}
                            {task.priority === 'Medium' && '🟡'}
                            {task.priority === 'Low' && '🟢'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {weekTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h4 className="font-semibold text-blue-700">НА ЭТОЙ НЕДЕЛЕ</h4>
              </div>
              <div className="space-y-2">
                {weekTasks.map(task => {
                  const project = getProject(task.projectId);
                  const client = getClient(project?.clientId);

                  return (
                    <div key={task.id} className={`border-2 rounded-lg p-4 ${getStatusColor(task)}`}>
                      <div className="flex items-center gap-3">
                        <div className="text-slate-700">{getTaskIcon(task.type)}</div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{task.title}</div>
                          <div className="text-sm text-slate-600">
                            {client?.name || project?.name || 'Без проекта'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-blue-700">
                            {task.deadline && formatTimeUntil(task.deadline)}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {task.priority === 'High' && '🔴'}
                            {task.priority === 'Medium' && '🟡'}
                            {task.priority === 'Low' && '🟢'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {urgentTasks.length === 0 && todayTasks.length === 0 && weekTasks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Нет активных задач на ближайшее время</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmmDashboard;
