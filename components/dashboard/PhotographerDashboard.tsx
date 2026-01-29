import React, { useMemo } from 'react';
import { Camera, Image as ImageIcon, Clock, CheckCircle, AlertCircle, MapPin, Calendar as CalendarIcon, Settings } from 'lucide-react';
import { Client, Project, Task, TaskStatus } from '../../types';
import { MetricCard, AlertBadge } from './DashboardWidgets';

interface PhotographerDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
}

const PhotographerDashboard: React.FC<PhotographerDashboardProps> = ({
  clients,
  projects,
  tasks,
  currentUserId
}) => {
  const myTasks = useMemo(() =>
    tasks.filter(t =>
      t.assigneeId === currentUserId &&
      (t.type === 'Shooting' || t.type === 'Task')
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

  const inProcessingCount = useMemo(() =>
    myTasks.filter(t =>
      t.type === 'Task' &&
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

  const completedPhotoSets = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return myTasks.filter(t => {
      if (t.status !== TaskStatus.DONE || !t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= sevenDaysAgo;
    }).length;
  }, [myTasks]);

  const upcomingShootings = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return myTasks
      .filter(t => {
        if (t.type !== 'Shooting' || t.status === TaskStatus.DONE) return false;
        if (!t.deadline) return false;
        const deadline = new Date(t.deadline);
        return deadline >= now && deadline <= in7Days;
      })
      .sort((a, b) => {
        const aDate = new Date(a.deadline || 0).getTime();
        const bDate = new Date(b.deadline || 0).getTime();
        return aDate - bDate;
      });
  }, [myTasks]);

  const processingQueue = useMemo(() => {
    const rawMaterials = myTasks.filter(t =>
      t.type === 'Task' && t.status === TaskStatus.TODO
    );
    const inProcessing = myTasks.filter(t =>
      t.type === 'Task' && t.status === TaskStatus.IN_PROGRESS
    );
    const onApproval = myTasks.filter(t =>
      t.type === 'Task' &&
      (t.status === TaskStatus.REVIEW || t.status === TaskStatus.PENDING_CLIENT)
    );

    return { rawMaterials, inProcessing, onApproval };
  }, [myTasks]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthTasks = myTasks.filter(t => {
      if (!t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= startOfMonth;
    });

    const shootings = monthTasks.filter(t => t.type === 'Shooting');
    const processed = monthTasks.filter(t => t.type === 'Task');

    const totalShootingHours = shootings.reduce((sum, t) => sum + (t.duration || 0), 0);

    const averageTime = processed.length > 0
      ? processed.reduce((sum, t) => {
          const created = new Date(t.createdAt || 0);
          const completed = new Date(t.completedAt || 0);
          const diff = completed.getTime() - created.getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / processed.length
      : 0;

    const rejectsCount = processed.filter(t => (t.rejectedCount || 0) > 0).length;
    const rejectsPercent = processed.length > 0 ? (rejectsCount / processed.length) * 100 : 0;

    return {
      shootingsCount: shootings.length,
      photosProcessed: processed.reduce((sum, t) => sum + (t.files?.length || 0), 0),
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

      if (deadline <= in24Hours && (!task.equipment || !task.scenario)) {
        result.push({
          type: 'no-preparation',
          task,
          message: task.equipment ? 'Съемка без брифа' : 'Съемка без оборудования'
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

    return `${dayName}, ${day} ${month}`;
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
          title="Съемок на неделе"
          value={shootingsThisWeek}
          icon={Camera}
        />

        <MetricCard
          title="На обработке"
          value={inProcessingCount}
          icon={ImageIcon}
        />

        <MetricCard
          title="На апруве у клиента"
          value={onApprovalCount}
          icon={Clock}
        />

        <MetricCard
          title="Готовых фотосетов (7 дн)"
          value={completedPhotoSets}
          icon={CheckCircle}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">Календарь съемок (7 дней)</h3>
        </div>

        {upcomingShootings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Нет запланированных съемок</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingShootings.map(task => {
              const project = getProject(task.projectId);
              const client = getClient(project?.clientId);
              const hasEquipment = !!task.equipment;
              const hasBrief = !!task.scenario;

              return (
                <div key={task.id} className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🌅</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-semibold text-slate-800">
                          {task.deadline && formatDateTime(task.deadline)}
                        </div>
                        {task.startTime && (
                          <>
                            <span className="text-slate-600">|</span>
                            <span className="text-slate-700">
                              {formatTimeRange(task.startTime, task.duration)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="text-lg font-medium text-slate-800 mb-3">
                        {task.title}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
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

                        {task.description && (
                          <div className="col-span-2">
                            <div className="text-slate-600">Тип съемки:</div>
                            <div className="font-medium text-slate-800">
                              {task.description}
                            </div>
                          </div>
                        )}
                      </div>

                      {task.equipment && (
                        <div className="bg-white rounded-lg p-4 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Settings className="w-4 h-4 text-slate-600" />
                            <div className="font-semibold text-slate-700">Чек-лист оборудования:</div>
                          </div>
                          <div className="text-sm text-slate-600 whitespace-pre-line">
                            {task.equipment}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-sm">
                        <div className={`px-3 py-1.5 rounded-lg font-medium ${
                          hasEquipment ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {hasEquipment ? '✓ Оборудование готово' : '⚠️ Подготовить оборудование'}
                        </div>

                        <div className={`px-3 py-1.5 rounded-lg font-medium ${
                          hasBrief ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {hasBrief ? '✓ Бриф получен' : '⚠️ Ждем бриф'}
                        </div>

                        {task.scenario && (
                          <a
                            href={task.scenario}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Открыть бриф
                          </a>
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
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Очередь обработки</h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <h4 className="font-semibold text-slate-700">СЫРЫЕ МАТЕРИАЛЫ</h4>
              <span className="text-sm text-slate-500">({processingQueue.rawMaterials.length})</span>
            </div>

            <div className="space-y-3">
              {processingQueue.rawMaterials.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);

                return (
                  <div key={task.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-2 mb-2">
                      <ImageIcon className="w-4 h-4 text-gray-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {client?.name || 'Без клиента'}
                    </div>
                    {task.files && task.files.length > 0 && (
                      <div className="text-sm text-slate-500">
                        Фото: {task.files.length} RAW файлов
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

              {processingQueue.rawMaterials.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Нет задач</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <h4 className="font-semibold text-slate-700">В ОБРАБОТКЕ</h4>
              <span className="text-sm text-slate-500">({processingQueue.inProcessing.length})</span>
            </div>

            <div className="space-y-3">
              {processingQueue.inProcessing.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);
                const progress = task.subtasks
                  ? Math.round((task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100)
                  : 0;

                return (
                  <div key={task.id} className="border border-purple-300 rounded-lg p-4 bg-purple-50">
                    <div className="flex items-start gap-2 mb-2">
                      <ImageIcon className="w-4 h-4 text-purple-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      {client?.name || 'Без клиента'}
                    </div>
                    {task.subtasks && task.subtasks.length > 0 ? (
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-slate-500">Прогресс: {progress}%</div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        Статус: Цветокоррекция
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

              {processingQueue.inProcessing.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Нет задач</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <h4 className="font-semibold text-slate-700">НА АПРУВЕ</h4>
              <span className="text-sm text-slate-500">({processingQueue.onApproval.length})</span>
            </div>

            <div className="space-y-3">
              {processingQueue.onApproval.map(task => {
                const project = getProject(task.projectId);
                const client = getClient(project?.clientId);
                const createdDate = new Date(task.createdAt || 0);
                const daysSince = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <div key={task.id} className="border border-orange-300 rounded-lg p-4 bg-orange-50">
                    <div className="flex items-start gap-2 mb-2">
                      <ImageIcon className="w-4 h-4 text-orange-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {client?.name || 'Без клиента'}
                    </div>
                    <div className="text-sm text-orange-700 mt-2">
                      {task.status === TaskStatus.PENDING_CLIENT
                        ? `Ожидает ${daysSince > 0 ? `${daysSince} дн.` : 'менее дня'}`
                        : 'На проверке'}
                    </div>
                  </div>
                );
              })}

              {processingQueue.onApproval.length === 0 && (
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
          <h3 className="text-lg font-semibold text-slate-800 mb-4">📊 Моя продуктивность</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="text-slate-700">Съемок проведено:</div>
              <div className="text-2xl font-bold text-blue-600">{monthlyStats.shootingsCount}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="text-slate-700">Фото обработано:</div>
              <div className="text-2xl font-bold text-purple-600">{monthlyStats.photosProcessed}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="text-slate-700">Съемочных часов:</div>
              <div className="text-2xl font-bold text-green-600">{monthlyStats.shootingHours}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div className="text-slate-700">Средняя обработка:</div>
              <div className="text-2xl font-bold text-yellow-600">{monthlyStats.averageTime} дн</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div className="text-slate-700">Переделок:</div>
              <div className="text-2xl font-bold text-orange-600">{monthlyStats.rejectsPercent}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">🚨 Требуют внимания</h3>

          {alerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" />
              <p>Все отлично!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {alerts.map((alert, index) => {
                const project = getProject(alert.task.projectId);
                const client = getClient(project?.clientId);

                return (
                  <div
                    key={index}
                    className={`border-2 rounded-lg p-4 ${
                      alert.type === 'overdue' ? 'border-red-400 bg-red-50' :
                      alert.type === 'no-preparation' ? 'border-orange-400 bg-orange-50' :
                      alert.type === 'no-files' ? 'border-yellow-400 bg-yellow-50' :
                      'border-blue-400 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className={`w-5 h-5 mt-0.5 ${
                        alert.type === 'overdue' ? 'text-red-600' :
                        alert.type === 'no-preparation' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />
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
                        {alert.task.deadline && (
                          <div className="text-sm text-slate-500 mt-1">
                            {alert.type === 'overdue' ? 'Дедлайн: ' : 'Съемка: '}
                            {formatDateTime(alert.task.deadline)}
                          </div>
                        )}
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

export default PhotographerDashboard;
