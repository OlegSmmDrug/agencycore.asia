import React, { useState, useMemo } from 'react';
import { Task, User, TaskStatus, Project } from '../types';
import UserAvatar from './UserAvatar';

interface TaskCalendarProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  onTaskClick: (task: Task) => void;
  onTaskMove?: (taskId: string, newDate: string) => void;
}

type CalendarView = 'month' | 'week' | 'day';

const TaskCalendar: React.FC<TaskCalendarProps> = ({ tasks, users, projects, onTaskClick, onTaskMove }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [view, setView] = useState<CalendarView>('month');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();

    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    const calendarDays = [];
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      calendarDays.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    for (let i = 1; i <= days; i++) {
      calendarDays.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
    }
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
    }
    return calendarDays;
  }, [currentDate]);

  const weekDates = useMemo(() => {
    const weekStart = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    const next = new Date(currentDate);
    next.setMonth(currentDate.getMonth() + offset);
    setCurrentDate(next);
    setSelectedDay(null);
  };

  const changeWeek = (offset: number) => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + offset * 7);
    setCurrentDate(next);
  };

  const changeDay = (offset: number) => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + offset);
    setCurrentDate(next);
  };

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return tasks.filter(t => {
      const taskDate = t.startedAt ? new Date(t.startedAt) : t.deadline ? new Date(t.deadline) : null;
      return taskDate && taskDate.toDateString() === dateStr;
    });
  };

  const getTasksForHour = (date: Date, hour: number) => {
    return tasks.filter(t => {
      const taskStart = t.startedAt ? new Date(t.startedAt) : t.deadline ? new Date(t.deadline) : null;
      if (!taskStart) return false;
      return taskStart.toDateString() === date.toDateString() && taskStart.getHours() === hour;
    });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, date: Date, hour?: number) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onTaskMove) {
      const newDate = new Date(date);
      if (hour !== undefined) {
        newDate.setHours(hour, 0, 0, 0);
      }
      onTaskMove(taskId, newDate.toISOString());
    }
    setDraggedTaskId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getMonthName = (date: Date) => date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const getWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('ru-RU', { month: 'long' })}`;
    }
    return `${start.getDate()} ${start.toLocaleDateString('ru-RU', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('ru-RU', { month: 'short' })}`;
  };

  const getProject = (projectId?: string) => projects.find(p => p.id === projectId);

  const totalHoursForDay = (date: Date) => {
    const dayTasks = getTasksForDate(date).filter(t => t.status !== TaskStatus.DONE);
    return dayTasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
  };

  const renderTaskPill = (task: Task, compact = false) => {
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== TaskStatus.DONE;
    const isDone = task.status === TaskStatus.DONE;

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
        className={`
          px-2 py-1.5 rounded-lg text-[10px] font-bold truncate border transition-all cursor-pointer
          ${isDone ? 'bg-emerald-50 border-emerald-100 text-emerald-700 line-through opacity-60' :
            isOverdue ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-white border-slate-100 text-slate-700 hover:border-blue-300 hover:shadow-sm'}
        `}
      >
        {!compact && task.startedAt && (
          <span className="text-slate-400 mr-1">
            {new Date(task.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {task.title}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in relative">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight capitalize">
              {view === 'month' && getMonthName(currentDate)}
              {view === 'week' && getWeekRange()}
              {view === 'day' && currentDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">График задач</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {(['month', 'week', 'day'] as CalendarView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${
                  view === v ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {v === 'month' ? 'Месяц' : v === 'week' ? 'Неделя' : 'День'}
              </button>
            ))}
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => view === 'month' ? changeMonth(-1) : view === 'week' ? changeWeek(-1) : changeDay(-1)}
              className="p-2 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => { setCurrentDate(new Date()); setSelectedDay(null); }}
              className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-600 hover:text-blue-600 transition-colors border-x border-slate-100"
            >
              Сегодня
            </button>
            <button
              onClick={() => view === 'month' ? changeMonth(1) : view === 'week' ? changeWeek(1) : changeDay(1)}
              className="p-2 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {view === 'month' && (
          <div className="grid grid-cols-7 bg-slate-100 gap-px min-h-full">
            <div className="contents">
              {weekDays.map(d => (
                <div key={d} className="py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">{d}</div>
              ))}
            </div>
            {daysInMonth.map((cell, idx) => {
              const dayTasks = getTasksForDate(cell.date);
              const isToday = cell.date.toDateString() === new Date().toDateString();
              const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
              const hoursPlanned = totalHoursForDay(cell.date);

              return (
                <div
                  key={idx}
                  onClick={() => { setSelectedDay(cell.date); setView('day'); setCurrentDate(cell.date); }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, cell.date)}
                  className={`min-h-[100px] bg-white p-2 transition-all cursor-pointer hover:bg-blue-50/50 group flex flex-col ${
                    !cell.currentMonth ? 'bg-slate-50/50 opacity-50' : ''
                  } ${isWeekend ? 'bg-slate-50/30' : ''} ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''} ${
                    draggedTaskId ? 'hover:ring-2 hover:ring-blue-300' : ''
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-xs font-bold ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-400'}`}>
                      {cell.day}
                    </span>
                    <div className="flex items-center gap-1">
                      {hoursPlanned > 0 && (
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                          hoursPlanned > 8 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {hoursPlanned}ч
                        </span>
                      )}
                      {dayTasks.length > 0 && (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {dayTasks.slice(0, 2).map(t => renderTaskPill(t, true))}
                    {dayTasks.length > 2 && (
                      <div className="text-[9px] font-bold text-blue-500 pl-1">
                        +{dayTasks.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'week' && (
          <div className="flex flex-col h-full">
            <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
              <div className="p-2 text-center text-[10px] font-bold text-slate-400 uppercase border-r border-slate-100">Время</div>
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const hoursPlanned = totalHoursForDay(date);
                return (
                  <div key={i} className={`p-2 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{weekDays[i]}</p>
                    <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{date.getDate()}</p>
                    {hoursPlanned > 0 && (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                        hoursPlanned > 8 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {hoursPlanned}ч
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex-1 overflow-y-auto">
              {hours.filter(h => h >= 8 && h <= 20).map(hour => (
                <div key={hour} className="grid grid-cols-8 border-b border-slate-50 min-h-[60px]">
                  <div className="p-2 text-[10px] font-bold text-slate-400 border-r border-slate-100 flex items-start justify-center">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {weekDates.map((date, i) => {
                    const hourTasks = getTasksForHour(date, hour);
                    return (
                      <div
                        key={i}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, date, hour)}
                        className={`p-1 border-r border-slate-50 last:border-r-0 ${
                          draggedTaskId ? 'hover:bg-blue-50' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          {hourTasks.map(t => renderTaskPill(t))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'day' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              {hours.filter(h => h >= 6 && h <= 22).map(hour => {
                const hourTasks = getTasksForHour(currentDate, hour);
                return (
                  <div
                    key={hour}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, currentDate, hour)}
                    className={`flex border-b border-slate-50 min-h-[80px] ${
                      draggedTaskId ? 'hover:bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-20 p-3 text-sm font-bold text-slate-400 border-r border-slate-100 shrink-0">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 p-2 space-y-2">
                      {hourTasks.map(task => {
                        const project = getProject(task.projectId);
                        const assignee = users.find(u => u.id === task.assigneeId);
                        const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== TaskStatus.DONE;

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => onTaskClick(task)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                              task.status === TaskStatus.DONE ? 'bg-emerald-50 border-emerald-100 opacity-60' :
                              isOverdue ? 'bg-red-50 border-red-200' :
                              'border-slate-100 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-1 h-full min-h-[40px] rounded-full shrink-0 ${
                                task.status === TaskStatus.DONE ? 'bg-emerald-500' : 'bg-blue-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                    task.type === 'Shooting' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                    task.type === 'Meeting' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    task.type === 'Call' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    'bg-slate-50 text-slate-500 border-slate-100'
                                  }`}>
                                    {task.type === 'Task' ? 'Задача' : task.type === 'Shooting' ? 'Съемка' : task.type === 'Call' ? 'Звонок' : 'Встреча'}
                                  </span>
                                  {project && (
                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded truncate">
                                      {project.name}
                                    </span>
                                  )}
                                  {task.estimatedHours && (
                                    <span className="text-[9px] font-bold text-slate-400">
                                      {task.estimatedHours}ч
                                    </span>
                                  )}
                                </div>
                                <h4 className={`font-bold text-slate-800 leading-tight ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : ''}`}>
                                  {task.title}
                                </h4>
                                {task.deadline && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {new Date(task.startedAt || task.deadline).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                    {' - '}
                                    {new Date(task.deadline).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                              </div>
                              {assignee && (
                                <UserAvatar src={assignee.avatar} name={assignee.name} size="md" className="!rounded-lg shrink-0" borderClassName="border-2 border-white shadow" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCalendar;
