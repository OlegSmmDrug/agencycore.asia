import React, { useMemo } from 'react';
import { Video, Film, Clock, CheckCircle, AlertCircle, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import { Client, Project, Task, TaskStatus } from '../../types';
import { MetricCard, AlertBadge } from './DashboardWidgets';

interface VideographerDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
}

const VideographerDashboard: React.FC<VideographerDashboardProps> = ({
  clients,
  projects,
  tasks,
  currentUserId
}) => {
  const myTasks = useMemo(() =>
    tasks.filter(t =>
      t.assigneeId === currentUserId &&
      (t.type === 'Shooting' || t.type === 'Reels')
    ),
    [tasks, currentUserId]
  );

  const shootingsThisWeek = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return myTasks.filter(t => {
      if (t.type !== 'Shooting' || t.status === TaskStatus.DONE) return false;
      if (!t.deadline) return false;
      const deadline = new Date(t.deadline);
      return deadline >= now && deadline <= in7Days;
    }).length;
  }, [myTasks]);

  const inEditingCount = useMemo(() =>
    myTasks.filter(t =>
      t.type === 'Reels' &&
      t.status === TaskStatus.IN_PROGRESS
    ).length,
    [myTasks]
  );

  const onApprovalCount = useMemo(() =>
    myTasks.filter(t =>
      t.status === TaskStatus.PENDING_CLIENT ||
      t.status === TaskStatus.REVIEW
    ).length,
    [myTasks]
  );

  const completedReelsCount = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return myTasks.filter(t => {
      if (t.type !== 'Reels' || t.status !== TaskStatus.DONE) return false;
      if (!t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= sevenDaysAgo;
    }).length;
  }, [myTasks]);

  const upcomingShootings = useMemo(() => {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    return myTasks
      .filter(t => {
        if (t.type !== 'Shooting' || t.status === TaskStatus.DONE) return false;
        if (!t.deadline) return false;
        const deadline = new Date(t.deadline);
        return deadline >= now && deadline <= in14Days;
      })
      .sort((a, b) => {
        const aDate = new Date(a.deadline || 0).getTime();
        const bDate = new Date(b.deadline || 0).getTime();
        return aDate - bDate;
      });
  }, [myTasks]);

  const editingQueue = useMemo(() => {
    const todo = myTasks.filter(t =>
      t.type === 'Reels' && t.status === TaskStatus.TODO
    );
    const inProgress = myTasks.filter(t =>
      t.type === 'Reels' && t.status === TaskStatus.IN_PROGRESS
    );
    const review = myTasks.filter(t =>
      t.type === 'Reels' &&
      (t.status === TaskStatus.REVIEW || t.status === TaskStatus.PENDING_CLIENT)
    );

    return { todo, inProgress, review };
  }, [myTasks]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthTasks = myTasks.filter(t => {
      if (!t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= startOfMonth;
    });

    const reels = monthTasks.filter(t => t.type === 'Reels');
    const shootings = monthTasks.filter(t => t.type === 'Shooting');

    const totalShootingHours = shootings.reduce((sum, t) => sum + (t.duration || 0), 0);

    const averageTime = reels.length > 0
      ? reels.reduce((sum, t) => {
          const created = new Date(t.createdAt || 0);
          const completed = new Date(t.completedAt || 0);
          const diff = completed.getTime() - created.getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / reels.length
      : 0;

    const rejectsCount = reels.filter(t => (t.rejectedCount || 0) > 0).length;
    const rejectsPercent = reels.length > 0 ? (rejectsCount / reels.length) * 100 : 0;

    return {
      reelsCount: reels.length,
      shootingHours: totalShootingHours,
      averageTime: averageTime.toFixed(1),
      rejectsPercent: rejectsPercent.toFixed(0)
    };
  }, [myTasks]);

  const alerts = useMemo(() => {
    const result: Array<{ type: string; task: Task; message: string }> = [];

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    upcomingShootings.forEach(task => {
      if (!task.deadline) return;
      const deadline = new Date(task.deadline);

      if (deadline <= in24Hours && !task.equipment) {
        result.push({
          type: 'no-equipment',
          task,
          message: 'Съемка без оборудования'
        });
      }
    });

    myTasks.forEach(task => {
      if (!task.deadline || task.status === TaskStatus.DONE) return;
      const deadline = new Date(task.deadline);

      if (deadline < now) {
        result.push({
          type: 'overdue',
          task,
          message: 'Просрочен дедлайн'
        });
      }
    });

    const completedShootings = myTasks.filter(t =>
      t.type === 'Shooting' &&
      t.status === TaskStatus.DONE &&
      (!t.files || t.files.length === 0)
    );

    completedShootings.forEach(task => {
      const completed = new Date(task.completedAt || 0);
      const hoursSince = (now.getTime() - completed.getTime()) / (1000 * 60 * 60);

      if (hoursSince > 24) {
        result.push({
          type: 'no-files',
          task,
          message: 'Материалы не загружены'
        });
      }
    });

    myTasks.forEach(task => {
      if (task.status !== TaskStatus.PENDING_CLIENT) return;
      const created = new Date(task.createdAt || 0);
      const hoursSince = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

      if (hoursSince > 48) {
        result.push({
          type: 'long-approval',
          task,
          message: 'Долго на апруве'
        });
      }
    });

    return result;
  }, [myTasks, upcomingShootings]);

  const getProject = (projectId?: string) => {
    return projects.find(p => p.id === projectId);
  };

  const getClient = (clientId?: string) => {
    return clients.find(c => c.id === clientId);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${dayName}, ${day} ${month}, ${hours}:${minutes}`;
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Съемки на неделе"
          value={shootingsThisWeek}
          icon={Video}
        />

        <MetricCard
          title="В монтаже"
          value={inEditingCount}
          icon={Film}
        />

        <MetricCard
          title="На апруве"
          value={onApprovalCount}
          icon={Clock}
        />

        <MetricCard
          title="Готовые ролики (7 дн)"
          value={completedReelsCount}
          icon={CheckCircle}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <CalendarIcon className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-slate-800">Календарь съемок (14 дней)</h3>
        </div>

        {upcomingShootings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Нет запланированных съемок</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingShootings.map(task => {
              const project = getProject(task.projectId);
              const client = getClient(project?.clientId);

              return (
                <div key={task.id} className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🎬</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-semibold text-slate-800">
                          {task.deadline && formatDateTime(task.deadline)}
                        </div>
                        {task.startTime && task.duration && (
                          <span className="text-sm text-slate-600">
                            | {formatTimeRange(task.startTime, task.duration)}
                          </span>
                        )}
                      </div>

                      <div className="text-lg font-medium text-slate-800 mb-2">
                        {task.title}
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
                              Локация:
                            </div>
                            <div className="font-medium text-slate-800">
                              {task.address}
                              {task.addressLink && (
                                <a
                                  href={task.addressLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-blue-600 hover:underline"
                                >
                                  [Карта]
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {task.equipment && (
                          <div>
                            <div className="text-slate-600">Оборудование:</div>
                            <div className="font-medium text-green-700">✓ Подтверждено</div>
                          </div>
                        )}

                        {task.scenario && (
                          <div>
                            <div className="text-slate-600">Сценарий:</div>
                            <a
                              href={task.scenario}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Открыть
                            </a>
                          </div>
                        )}
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
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Очередь монтажа</h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <h4 className="font-semibold text-slate-700">К МОНТАЖУ</h4>
              <span className="text-sm text-slate-500">({editingQueue.todo.length})</span>
            </div>

            <div className="space-y-3">
              {editingQueue.todo.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);

                return (
                  <div key={task.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-2 mb-2">
                      <Film className="w-4 h-4 text-gray-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {client?.name || 'Без клиента'}
                    </div>
                    {task.deadline && (
                      <div className="text-sm text-orange-600 mt-2">
                        До: {new Date(task.deadline).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>
                );
              })}

              {editingQueue.todo.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Нет задач</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <h4 className="font-semibold text-slate-700">В РАБОТЕ</h4>
              <span className="text-sm text-slate-500">({editingQueue.inProgress.length})</span>
            </div>

            <div className="space-y-3">
              {editingQueue.inProgress.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);
                const progress = task.subtasks
                  ? Math.round((task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100)
                  : 0;

                return (
                  <div key={task.id} className="border border-purple-300 rounded-lg p-4 bg-purple-50">
                    <div className="flex items-start gap-2 mb-2">
                      <Film className="w-4 h-4 text-purple-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {client?.name || 'Без клиента'}
                    </div>
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-slate-500">{progress}%</div>
                      </div>
                    )}
                    {task.deadline && (
                      <div className="text-sm text-orange-600 mt-2">
                        До: {new Date(task.deadline).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>
                );
              })}

              {editingQueue.inProgress.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Нет задач</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <h4 className="font-semibold text-slate-700">НА РЕВЬЮ</h4>
              <span className="text-sm text-slate-500">({editingQueue.review.length})</span>
            </div>

            <div className="space-y-3">
              {editingQueue.review.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);

                return (
                  <div key={task.id} className="border border-orange-300 rounded-lg p-4 bg-orange-50">
                    <div className="flex items-start gap-2 mb-2">
                      <Film className="w-4 h-4 text-orange-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {client?.name || 'Без клиента'}
                    </div>
                    <div className="text-sm text-orange-700 mt-2">
                      {task.status === TaskStatus.PENDING_CLIENT ? 'Ожидает клиента' : 'На проверке'}
                    </div>
                  </div>
                );
              })}

              {editingQueue.review.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Нет задач</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Статистика за месяц</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="text-slate-700">Снято роликов:</div>
              <div className="text-2xl font-bold text-blue-600">{monthlyStats.reelsCount}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="text-slate-700">Часов съемки:</div>
              <div className="text-2xl font-bold text-purple-600">{monthlyStats.shootingHours}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="text-slate-700">Средний срок:</div>
              <div className="text-2xl font-bold text-green-600">{monthlyStats.averageTime} дн</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div className="text-slate-700">Переделок:</div>
              <div className="text-2xl font-bold text-orange-600">{monthlyStats.rejectsPercent}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Требуют внимания</h3>

          {alerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" />
              <p>Все отлично!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {alerts.map((alert, index) => {
                const project = getProject(alert.task.projectId);
                const client = getClient(project?.clientId);

                return (
                  <div
                    key={index}
                    className={`border-2 rounded-lg p-4 ${
                      alert.type === 'overdue' ? 'border-red-400 bg-red-50' :
                      alert.type === 'no-equipment' ? 'border-orange-400 bg-orange-50' :
                      'border-yellow-400 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 mb-1">
                          {alert.message}
                        </div>
                        <div className="text-sm text-slate-700 mb-1">
                          {alert.task.title}
                        </div>
                        <div className="text-sm text-slate-600">
                          {client?.name || 'Без клиента'}
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
    </div>
  );
};

export default VideographerDashboard;
