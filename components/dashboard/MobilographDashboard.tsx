import React, { useMemo, useState, useEffect } from 'react';
import { Smartphone, Film, Clock, CheckCircle, MapPin, Calendar as CalendarIcon, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Client, Project, Task, TaskStatus } from '../../types';
import { MetricCard, AlertBadge } from './DashboardWidgets';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MobilographDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
}

const MobilographDashboard: React.FC<MobilographDashboardProps> = ({
  clients,
  projects,
  tasks,
  currentUserId
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const myTasks = useMemo(() =>
    tasks.filter(t =>
      t.assigneeId === currentUserId &&
      (t.type === 'Shooting' || t.type === 'Stories' || t.type === 'Reels')
    ),
    [tasks, currentUserId]
  );

  const shootingsTodayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    return myTasks.filter(t => {
      if (t.type !== 'Shooting' || !t.deadline) return false;
      const deadline = new Date(t.deadline);
      return deadline >= today && deadline <= endOfDay;
    }).length;
  }, [myTasks]);

  const storiesQueueCount = useMemo(() =>
    myTasks.filter(t =>
      t.type === 'Stories' &&
      (t.status === TaskStatus.TODO || t.status === TaskStatus.IN_PROGRESS)
    ).length,
    [myTasks]);

  const onApprovalCount = useMemo(() =>
    myTasks.filter(t => t.status === TaskStatus.PENDING_CLIENT).length,
    [myTasks]
  );

  const completedWeekCount = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return myTasks.filter(t => {
      if (t.status !== TaskStatus.DONE || !t.completedAt) return false;
      if (t.type !== 'Stories' && t.type !== 'Reels') return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= sevenDaysAgo;
    }).length;
  }, [myTasks]);

  const todayShootings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    return myTasks
      .filter(t => {
        if (t.type !== 'Shooting' || !t.deadline) return false;
        const deadline = new Date(t.deadline);
        return deadline >= today && deadline <= endOfDay;
      })
      .sort((a, b) => {
        const aTime = new Date(a.startTime || a.deadline || 0).getTime();
        const bTime = new Date(b.startTime || b.deadline || 0).getTime();
        return aTime - bTime;
      });
  }, [myTasks]);

  const quickStories = useMemo(() => {
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    return myTasks
      .filter(t => {
        if (t.type !== 'Stories' || !t.deadline || t.status === TaskStatus.DONE) return false;
        const deadline = new Date(t.deadline);
        return deadline <= in2Hours && deadline >= now;
      })
      .sort((a, b) => {
        const aDate = new Date(a.deadline || 0).getTime();
        const bDate = new Date(b.deadline || 0).getTime();
        return aDate - bDate;
      });
  }, [myTasks, currentTime]);

  const weeklyCalendar = useMemo(() => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTasks = myTasks.filter(t => {
        if (!t.deadline) return false;
        const deadline = new Date(t.deadline);
        return deadline >= dayStart && deadline <= dayEnd;
      });

      days.push({
        date,
        stories: dayTasks.filter(t => t.type === 'Stories').length,
        reels: dayTasks.filter(t => t.type === 'Reels').length,
        shootings: dayTasks.filter(t => t.type === 'Shooting').length
      });
    }

    return days;
  }, [myTasks]);

  const chartData = useMemo(() => {
    return weeklyCalendar.map((day, index) => ({
      name: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][index],
      Stories: day.stories,
      Reels: day.reels,
      Съемки: day.shootings
    }));
  }, [weeklyCalendar]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthTasks = myTasks.filter(t => {
      if (t.status !== TaskStatus.DONE || !t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= startOfMonth;
    });

    const stories = monthTasks.filter(t => t.type === 'Stories');
    const reels = monthTasks.filter(t => t.type === 'Reels');
    const shootings = monthTasks.filter(t => t.type === 'Shooting');

    const shootingDays = new Set(
      shootings.map(t => {
        const date = new Date(t.completedAt || 0);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      })
    ).size;

    const rejectsCount = [...stories, ...reels].filter(t => (t.rejectedCount || 0) > 0).length;
    const totalContent = stories.length + reels.length;
    const rejectsPercent = totalContent > 0 ? (rejectsCount / totalContent) * 100 : 0;

    return {
      storiesCount: stories.length,
      reelsCount: reels.length,
      shootingDays,
      rejectsPercent: rejectsPercent.toFixed(0)
    };
  }, [myTasks]);

  const materialsToUpload = useMemo(() => {
    const now = new Date();

    return myTasks.filter(t => {
      if (t.type !== 'Shooting' || t.status !== TaskStatus.DONE) return false;
      if (t.files && t.files.length > 0) return false;

      const completed = new Date(t.completedAt || 0);
      const hoursSince = (now.getTime() - completed.getTime()) / (1000 * 60 * 60);

      return hoursSince > 0;
    }).sort((a, b) => {
      const aDate = new Date(a.completedAt || 0).getTime();
      const bDate = new Date(b.completedAt || 0).getTime();
      return aDate - bDate;
    });
  }, [myTasks]);

  const getProject = (projectId?: string) => {
    return projects.find(p => p.id === projectId);
  };

  const getClient = (clientId?: string) => {
    return clients.find(c => c.id === clientId);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatTimeRange = (start: string, duration?: number) => {
    const startDate = new Date(start);
    const hours = startDate.getHours().toString().padStart(2, '0');
    const minutes = startDate.getMinutes().toString().padStart(2, '0');

    if (duration) {
      const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
      const endHours = endDate.getHours().toString().padStart(2, '0');
      const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}-${endHours}:${endMinutes}`;
    }

    return `${hours}:${minutes}`;
  };

  const getTimeUntilDeadline = (deadline: string) => {
    const now = currentTime;
    const target = new Date(deadline);
    const diff = target.getTime() - now.getTime();

    if (diff < 0) {
      return { text: 'Просрочено', color: 'text-red-700' };
    }

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 1) {
      return { text: `${remainingMinutes} мин`, color: 'text-red-700' };
    }

    if (hours < 2) {
      return { text: `${hours} ч ${remainingMinutes} мин`, color: 'text-orange-700' };
    }

    return { text: `${hours} ч`, color: 'text-yellow-700' };
  };

  const getUploadDelay = (completedAt: string) => {
    const now = new Date();
    const completed = new Date(completedAt);
    const diff = now.getTime() - completed.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} дн. назад`;
    if (hours > 0) return `${hours} ч. назад`;
    return 'Недавно';
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Съемок сегодня"
          value={shootingsTodayCount}
          icon={Smartphone}
        />

        <MetricCard
          title="Stories в очереди"
          value={storiesQueueCount}
          icon={Film}
        />

        <MetricCard
          title="На апруве"
          value={onApprovalCount}
          icon={Clock}
        />

        <MetricCard
          title="Готово за неделю"
          value={completedWeekCount}
          icon={CheckCircle}
        />
      </div>

      {quickStories.length > 0 && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h3 className="text-xl font-bold">⚡ БЫСТРЫЕ STORIES (дедлайн &lt; 2 часов)</h3>
          </div>

          <div className="space-y-3">
            {quickStories.map(task => {
              const project = getProject(task.projectId);
              const client = getClient(project?.clientId);
              const timeInfo = task.deadline ? getTimeUntilDeadline(task.deadline) : null;

              return (
                <div
                  key={task.id}
                  className={`bg-white/20 backdrop-blur-sm border-2 border-white/40 rounded-lg p-4 ${
                    timeInfo?.color === 'text-red-700' ? 'ring-4 ring-white/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-lg font-semibold mb-1">{task.title}</div>
                      <div className="text-white/90">
                        Клиент: {client?.name || 'Неизвестно'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold mb-1">
                        {timeInfo?.text}
                      </div>
                      <button className="bg-white text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-50 transition-colors">
                        СНЯТЬ СЕЙЧАС
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">🕐 Съемки сегодня</h3>
        </div>

        {todayShootings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Нет съемок на сегодня</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todayShootings.map(task => {
              const project = getProject(task.projectId);
              const client = getClient(project?.clientId);

              return (
                <div key={task.id} className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">📱</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-bold text-lg text-slate-800">
                          {task.startTime
                            ? formatTimeRange(task.startTime, task.duration)
                            : task.deadline && formatTime(task.deadline)}
                        </div>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-700">{task.title}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-slate-600">Клиент:</div>
                          <div className="font-medium text-slate-800">
                            {client?.name || 'Неизвестно'}
                          </div>
                        </div>

                        {task.address && (
                          <div>
                            <div className="text-slate-600 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Адрес:
                            </div>
                            <div className="font-medium text-slate-800">
                              {task.address}
                            </div>
                          </div>
                        )}

                        {task.description && (
                          <div className="col-span-2">
                            <div className="text-slate-600">🎯 Задача:</div>
                            <div className="font-medium text-slate-800">
                              {task.description}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-4">
                        {task.addressLink && (
                          <a
                            href={task.addressLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Маршрут
                          </a>
                        )}
                        {client?.phone && (
                          <a
                            href={`tel:${client.phone}`}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            Позвонить
                          </a>
                        )}
                        <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
                          Начать
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Контент-план на неделю</h3>

        <div className="mb-6" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Stories" fill="#ec4899" />
              <Bar dataKey="Reels" fill="#a855f7" />
              <Bar dataKey="Съемки" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {weeklyCalendar.map((day, index) => {
            const dayName = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][index];
            const dateStr = `${day.date.getDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][day.date.getMonth()]}`;

            return (
              <div key={index} className="border border-slate-200 rounded-lg p-3">
                <div className="text-center mb-2">
                  <div className="font-semibold text-slate-800">{dayName}</div>
                  <div className="text-xs text-slate-500">{dateStr}</div>
                </div>

                <div className="space-y-1 text-xs">
                  {day.stories > 0 && (
                    <div className="flex items-center gap-1 text-pink-700">
                      <ImageIcon className="w-3 h-3" />
                      <span>{day.stories}</span>
                    </div>
                  )}

                  {day.reels > 0 && (
                    <div className="flex items-center gap-1 text-purple-700">
                      <Film className="w-3 h-3" />
                      <span>{day.reels}</span>
                    </div>
                  )}

                  {day.shootings > 0 && (
                    <div className="flex items-center gap-1 text-slate-700">
                      <Smartphone className="w-3 h-3" />
                      <span>{day.shootings}</span>
                    </div>
                  )}

                  {day.stories === 0 && day.reels === 0 && day.shootings === 0 && (
                    <div className="text-slate-400 text-center">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">📊 Моя продуктивность</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-pink-50 rounded-lg">
              <div className="text-slate-700">Stories снято:</div>
              <div className="text-2xl font-bold text-pink-600">{monthlyStats.storiesCount}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="text-slate-700">Reels снято:</div>
              <div className="text-2xl font-bold text-purple-600">{monthlyStats.reelsCount}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="text-slate-700">Съемочных дней:</div>
              <div className="text-2xl font-bold text-blue-600">{monthlyStats.shootingDays}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div className="text-slate-700">Переделок:</div>
              <div className="text-2xl font-bold text-orange-600">{monthlyStats.rejectsPercent}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">⚠️ Материалы на загрузку</h3>

          {materialsToUpload.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" />
              <p>Все материалы загружены</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {materialsToUpload.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);
                const delay = getUploadDelay(task.completedAt || '');
                const isLongDelay = new Date().getTime() - new Date(task.completedAt || 0).getTime() > 24 * 60 * 60 * 1000;

                return (
                  <div
                    key={task.id}
                    className={`border-2 rounded-lg p-4 ${
                      isLongDelay ? 'border-red-400 bg-red-50' : 'border-yellow-400 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-slate-800 mb-1">
                          {task.title}
                        </div>
                        <div className="text-sm text-slate-600">
                          Снято: {delay}
                        </div>
                        <div className="text-sm text-slate-600">
                          Клиент: {client?.name || 'Неизвестно'}
                        </div>
                      </div>
                      <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap">
                        Загрузить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobilographDashboard;
