import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Task, Project, User, TaskStatus } from '../types';

interface TaskGanttProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  onTaskClick: (task: Task) => void;
}

type GanttView = '1week' | '2weeks' | 'month';
type GroupBy = 'assignee' | 'project' | 'status';

const TaskGantt: React.FC<TaskGanttProps> = ({ tasks, projects, users, onTaskClick }) => {
  const [view, setView] = useState<GanttView>('1week');
  const [groupBy, setGroupBy] = useState<GroupBy>('assignee');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(100);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const minZoom = 60;
  const maxZoom = 200;

  const dayWidth = useMemo(() => {
    const baseWidth = view === '1week' ? 120 : view === '2weeks' ? 70 : 40;
    return baseWidth * (zoomLevel / 100);
  }, [view, zoomLevel]);

  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const days = view === '1week' ? 7 : view === '2weeks' ? 14 : 30;

    const day = start.getDay();
    start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));

    if (view === 'month') {
      start.setDate(1);
    }
    start.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate, view]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoomLevel(prev => Math.min(maxZoom, Math.max(minZoom, prev + delta)));
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const groupedTasks = useMemo(() => {
    const groups: { id: string; name: string; avatar?: string; tasks: Task[]; color: string }[] = [];

    if (groupBy === 'assignee') {
      const unassigned: Task[] = [];
      const userMap = new Map<string, Task[]>();

      tasks.forEach(task => {
        if (task.assigneeId) {
          const existing = userMap.get(task.assigneeId) || [];
          existing.push(task);
          userMap.set(task.assigneeId, existing);
        } else {
          unassigned.push(task);
        }
      });

      users.forEach(user => {
        const userTasks = userMap.get(user.id);
        if (userTasks && userTasks.length > 0) {
          groups.push({
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            tasks: userTasks.sort((a, b) => new Date(a.startedAt || a.deadline || 0).getTime() - new Date(b.startedAt || b.deadline || 0).getTime()),
            color: 'bg-blue-500'
          });
        }
      });

      if (unassigned.length > 0) {
        groups.push({
          id: 'unassigned',
          name: 'Не назначено',
          tasks: unassigned,
          color: 'bg-slate-400'
        });
      }
    } else if (groupBy === 'project') {
      const projectMap = new Map<string, Task[]>();
      const noProject: Task[] = [];

      tasks.forEach(task => {
        if (task.projectId) {
          const existing = projectMap.get(task.projectId) || [];
          existing.push(task);
          projectMap.set(task.projectId, existing);
        } else {
          noProject.push(task);
        }
      });

      projects.forEach(project => {
        const projectTasks = projectMap.get(project.id);
        if (projectTasks && projectTasks.length > 0) {
          groups.push({
            id: project.id,
            name: project.name,
            tasks: projectTasks.sort((a, b) => new Date(a.startedAt || a.deadline || 0).getTime() - new Date(b.startedAt || b.deadline || 0).getTime()),
            color: 'bg-emerald-500'
          });
        }
      });

      if (noProject.length > 0) {
        groups.push({
          id: 'no-project',
          name: 'Без проекта',
          tasks: noProject,
          color: 'bg-slate-400'
        });
      }
    } else {
      const statusOrder = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.PENDING_CLIENT, TaskStatus.APPROVED, TaskStatus.REJECTED, TaskStatus.READY, TaskStatus.DONE];
      const statusColors: Record<TaskStatus, string> = {
        [TaskStatus.TODO]: 'bg-slate-400',
        [TaskStatus.IN_PROGRESS]: 'bg-blue-500',
        [TaskStatus.REVIEW]: 'bg-indigo-500',
        [TaskStatus.PENDING_CLIENT]: 'bg-yellow-500',
        [TaskStatus.APPROVED]: 'bg-green-500',
        [TaskStatus.REJECTED]: 'bg-red-500',
        [TaskStatus.READY]: 'bg-cyan-500',
        [TaskStatus.DONE]: 'bg-emerald-500'
      };
      const statusNames: Record<TaskStatus, string> = {
        [TaskStatus.TODO]: 'К выполнению',
        [TaskStatus.IN_PROGRESS]: 'В работе',
        [TaskStatus.REVIEW]: 'На проверке',
        [TaskStatus.PENDING_CLIENT]: 'Ждет клиента',
        [TaskStatus.APPROVED]: 'Утверждено',
        [TaskStatus.REJECTED]: 'На доработке',
        [TaskStatus.READY]: 'Готово',
        [TaskStatus.DONE]: 'Выполнено'
      };

      statusOrder.forEach(status => {
        const statusTasks = tasks.filter(t => t.status === status);
        if (statusTasks.length > 0) {
          groups.push({
            id: status,
            name: statusNames[status],
            tasks: statusTasks.sort((a, b) => new Date(a.startedAt || a.deadline || 0).getTime() - new Date(b.startedAt || b.deadline || 0).getTime()),
            color: statusColors[status]
          });
        }
      });
    }

    return groups;
  }, [tasks, users, projects, groupBy]);

  const getTaskPosition = (task: Task) => {
    const startDate = task.startedAt ? new Date(task.startedAt) : task.deadline ? new Date(task.deadline) : null;
    const endDate = task.deadline ? new Date(task.deadline) : startDate;

    if (!startDate || !endDate) return null;

    const rangeStart = dateRange[0].getTime();
    const rangeEnd = dateRange[dateRange.length - 1].getTime() + 24 * 60 * 60 * 1000;

    const taskStart = Math.max(startDate.getTime(), rangeStart);
    const taskEnd = Math.min(endDate.getTime() + 24 * 60 * 60 * 1000, rangeEnd);

    if (taskEnd < rangeStart || taskStart > rangeEnd) return null;

    const totalWidth = dateRange.length * dayWidth;
    const left = ((taskStart - rangeStart) / (rangeEnd - rangeStart)) * totalWidth;
    const width = Math.max(dayWidth * 0.9, ((taskEnd - taskStart) / (rangeEnd - rangeStart)) * totalWidth);

    return { left, width: Math.min(width, totalWidth - left), taskStart, taskEnd };
  };

  const calculateTaskLanes = (tasks: Task[]) => {
    const tasksWithPos = tasks.map(task => {
      const pos = getTaskPosition(task);
      return pos ? { task, ...pos } : null;
    }).filter(Boolean) as Array<{ task: Task; left: number; width: number; taskStart: number; taskEnd: number }>;

    tasksWithPos.sort((a, b) => a.left - b.left);

    const lanes: Array<Array<{ task: Task; left: number; width: number; taskStart: number; taskEnd: number }>> = [];

    tasksWithPos.forEach(taskData => {
      let placed = false;

      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const lastInLane = lane[lane.length - 1];

        if (lastInLane.left + lastInLane.width <= taskData.left) {
          lane.push(taskData);
          placed = true;
          break;
        }
      }

      if (!placed) {
        lanes.push([taskData]);
      }
    });

    const taskToLane = new Map<string, number>();
    lanes.forEach((lane, laneIndex) => {
      lane.forEach(({ task }) => {
        taskToLane.set(task.id, laneIndex);
      });
    });

    return { taskToLane, totalLanes: lanes.length };
  };

  const navigate = (direction: number) => {
    const next = new Date(currentDate);
    if (view === '1week') {
      next.setDate(next.getDate() + direction * 7);
    } else if (view === '2weeks') {
      next.setDate(next.getDate() + direction * 7);
    } else {
      next.setMonth(next.getMonth() + direction);
    }
    setCurrentDate(next);
  };

  const getHeader = () => {
    const start = dateRange[0];
    const end = dateRange[dateRange.length - 1];
    if (view === 'month') {
      return currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    }
    return `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const priorityColors: Record<string, string> = {
    High: 'from-red-500 to-red-600',
    Medium: 'from-blue-500 to-blue-600',
    Low: 'from-slate-400 to-slate-500'
  };

  const rowHeight = zoomLevel > 120 ? 70 : zoomLevel > 80 ? 60 : 50;
  const taskBarHeight = zoomLevel > 120 ? 36 : zoomLevel > 80 ? 32 : 28;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{getHeader()}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Таймлайн задач</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="assignee">По исполнителю</option>
            <option value="project">По проекту</option>
            <option value="status">По статусу</option>
          </select>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <button
              onClick={() => setZoomLevel(prev => Math.max(minZoom, prev - 20))}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Уменьшить"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 12H4" /></svg>
            </button>
            <span className="text-[10px] font-bold text-slate-500 w-10 text-center">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(maxZoom, prev + 20))}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Увеличить"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {(['1week', '2weeks', 'month'] as GanttView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${
                  view === v ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {v === '1week' ? '1 нед' : v === '2weeks' ? '2 нед' : 'Месяц'}
              </button>
            ))}
          </div>

          <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-600 hover:text-blue-600 transition-colors border-x border-slate-100"
            >
              Сегодня
            </button>
            <button onClick={() => navigate(1)} className="p-2 hover:bg-slate-50 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div style={{ minWidth: `${240 + dateRange.length * dayWidth}px` }}>
          <div className="flex border-b border-slate-100 bg-slate-50 sticky top-0 z-20">
            <div className="w-60 shrink-0 px-4 py-3 border-r border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
              {groupBy === 'assignee' ? 'Исполнитель' : groupBy === 'project' ? 'Проект' : 'Статус'}
            </div>
            <div className="flex" ref={timelineRef}>
              {dateRange.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const showMonth = i === 0 || date.getDate() === 1;
                return (
                  <div
                    key={i}
                    style={{ width: `${dayWidth}px` }}
                    className={`text-center py-2 border-r border-slate-50 last:border-r-0 shrink-0 ${
                      isToday ? 'bg-blue-50' : isWeekend ? 'bg-slate-50/50' : ''
                    }`}
                  >
                    {showMonth && (
                      <p className="text-[8px] font-bold text-slate-400 uppercase">
                        {date.toLocaleDateString('ru-RU', { month: 'short' })}
                      </p>
                    )}
                    <p className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                      {date.getDate()}
                    </p>
                    <p className="text-[8px] text-slate-400">
                      {date.toLocaleDateString('ru-RU', { weekday: 'short' })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {groupedTasks.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium">Нет задач в выбранном периоде</p>
              </div>
            </div>
          ) : (
            groupedTasks.map(group => {
              const { taskToLane, totalLanes } = calculateTaskLanes(group.tasks);
              const groupHeight = Math.max(rowHeight, totalLanes * (taskBarHeight + 8) + 16);

              return (
                <div key={group.id} className="border-b border-slate-50 last:border-b-0">
                  <div className="flex items-stretch bg-slate-50/30" style={{ minHeight: `${groupHeight}px` }}>
                    <div className="w-60 shrink-0 px-4 py-3 border-r border-slate-100 flex items-center gap-3">
                      {group.avatar ? (
                        <img src={group.avatar} className="w-9 h-9 rounded-lg object-cover border-2 border-white shadow" />
                      ) : (
                        <div className={`w-9 h-9 rounded-lg ${group.color} flex items-center justify-center`}>
                          <span className="text-white text-sm font-bold">{group.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{group.name}</p>
                        <p className="text-[10px] text-slate-400">{group.tasks.length} задач</p>
                      </div>
                    </div>
                    <div className="flex-1 relative py-2" style={{ width: `${dateRange.length * dayWidth}px` }}>
                      {dateRange.map((date, i) => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        return (
                          <div
                            key={i}
                            className={`absolute top-0 bottom-0 border-r border-slate-50 ${isToday ? 'bg-blue-50/30' : ''}`}
                            style={{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }}
                          />
                        );
                      })}
                      {group.tasks.map(task => {
                        const pos = getTaskPosition(task);
                        if (!pos) return null;
                        const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                        const isDone = task.status === TaskStatus.DONE;
                        const isHovered = hoveredTask === task.id;
                        const laneIndex = taskToLane.get(task.id) || 0;
                        const topOffset = 8 + laneIndex * (taskBarHeight + 8);

                        const now = new Date();
                        const rangeStart = dateRange[0].getTime();
                        const rangeEnd = dateRange[dateRange.length - 1].getTime() + 24 * 60 * 60 * 1000;
                        const totalWidth = dateRange.length * dayWidth;

                        const overdueInfo = isOverdue && task.deadline ? (() => {
                          const deadlineTime = new Date(task.deadline).getTime() + 24 * 60 * 60 * 1000;
                          const nowTime = Math.min(now.getTime(), rangeEnd);
                          const overdueDuration = nowTime - deadlineTime;

                          if (overdueDuration > 0) {
                            const extensionStart = ((deadlineTime - rangeStart) / (rangeEnd - rangeStart)) * totalWidth;
                            const extensionWidth = ((overdueDuration) / (rangeEnd - rangeStart)) * totalWidth;

                            const overdueDays = Math.floor(overdueDuration / (24 * 60 * 60 * 1000));
                            const overdueHours = Math.floor(overdueDuration / (60 * 60 * 1000));

                            let overdueText = '';
                            if (overdueDays >= 1) {
                              overdueText = `${overdueDays}д`;
                            } else {
                              overdueText = `${overdueHours}ч`;
                            }

                            return { left: extensionStart, width: extensionWidth, text: overdueText };
                          }
                          return null;
                        })() : null;

                        return (
                          <React.Fragment key={task.id}>
                            {overdueInfo && (
                              <div
                                className="absolute rounded-lg pointer-events-none"
                                style={{
                                  left: `${overdueInfo.left}px`,
                                  width: `${overdueInfo.width}px`,
                                  height: `${taskBarHeight}px`,
                                  top: `${topOffset}px`,
                                  background: 'linear-gradient(to right, rgba(239, 68, 68, 0.6), rgba(239, 68, 68, 0.2))',
                                  zIndex: 5
                                }}
                              />
                            )}
                            <div
                              onClick={() => onTaskClick(task)}
                              onMouseEnter={() => setHoveredTask(task.id)}
                              onMouseLeave={() => setHoveredTask(null)}
                              className={`absolute rounded-lg cursor-pointer transition-all z-10 flex items-center px-3 overflow-hidden shadow-sm ${
                                isDone ? 'opacity-60' : ''
                              } ${isHovered ? 'scale-[1.03] shadow-lg z-20' : 'hover:shadow-md'}`}
                              style={{
                                left: `${pos.left}px`,
                                width: `${pos.width}px`,
                                height: `${taskBarHeight}px`,
                                top: `${topOffset}px`
                              }}
                            >
                              <div className={`absolute inset-0 bg-gradient-to-r ${
                                isDone ? 'from-emerald-400 to-emerald-500' :
                                isOverdue ? 'from-red-500 to-red-600' :
                                priorityColors[task.priority]
                              } rounded-lg`} />

                              <div className="relative flex items-center gap-2 w-full min-w-0">
                                <span className={`font-bold text-white drop-shadow-sm truncate ${
                                  zoomLevel > 100 ? 'text-xs' : 'text-[11px]'
                                }`}>
                                  {task.title}
                                </span>
                                {overdueInfo && pos.width > 60 && (
                                  <span className="ml-auto text-[9px] font-bold text-white shrink-0 bg-black/20 px-1.5 py-0.5 rounded">
                                    {overdueInfo.text}
                                  </span>
                                )}
                                {!overdueInfo && task.estimatedHours && pos.width > 80 && (
                                  <span className="ml-auto text-[9px] font-bold text-white/70 shrink-0 bg-black/10 px-1.5 py-0.5 rounded">
                                    {task.estimatedHours}ч
                                  </span>
                                )}
                              </div>

                              {isHovered && (
                                <div className="absolute left-0 top-full mt-2 z-50 bg-slate-900 text-white p-3 rounded-xl shadow-xl min-w-[200px] max-w-[300px]"
                                     style={{ pointerEvents: 'none' }}>
                                  <p className="font-bold text-sm mb-1">{task.title}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-300">
                                    {task.estimatedHours && <span>{task.estimatedHours}ч</span>}
                                    {task.deadline && (
                                      <span>до {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                                    )}
                                  </div>
                                  {task.description && (
                                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="flex items-stretch min-h-[30px] border-t border-slate-100 bg-white sticky bottom-0">
            <div className="w-60 shrink-0 px-4 py-2 border-r border-slate-100 text-[9px] font-bold text-slate-400 uppercase">
              Всего: {tasks.length} задач
            </div>
            <div className="flex-1 relative" style={{ width: `${dateRange.length * dayWidth}px` }}>
              {dateRange.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString();
                if (isToday) {
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-30"
                      style={{ left: `${(i + 0.5) * dayWidth}px` }}
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-red-500 to-red-600" />
            <span className="text-[10px] font-bold text-slate-500">Высокий</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-blue-600" />
            <span className="text-[10px] font-bold text-slate-500">Средний</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-emerald-400 to-emerald-500" />
            <span className="text-[10px] font-bold text-slate-500">Выполнено</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-red-500 to-red-600 ring-2 ring-red-200" />
            <span className="text-[10px] font-bold text-slate-500">Просрочено</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400">
          Ctrl + колесо мыши для масштабирования
        </div>
      </div>
    </div>
  );
};

export default TaskGantt;
