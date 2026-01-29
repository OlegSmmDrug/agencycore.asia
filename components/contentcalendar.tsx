
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskType } from '../types';
import { taskTypeService } from '../services/taskTypeService';

interface ContentCalendarProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskMove: (taskId: string, newDate: string) => void;
  viewMode?: 'day' | 'week' | 'month';
  onViewModeChange?: (mode: 'day' | 'week' | 'month') => void;
}

const ContentCalendar: React.FC<ContentCalendarProps> = ({
  tasks,
  onTaskClick,
  onTaskMove,
  viewMode = 'month',
  onViewModeChange
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarDays = useMemo(() => {
    if (viewMode === 'day') {
      return [{ date: new Date(currentDate), currentMonth: true }];
    }

    if (viewMode === 'week') {
      const days = [];
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = startOfWeek.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeek.setDate(startOfWeek.getDate() + diff);

      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        days.push({ date: day, currentMonth: true });
      }
      return days;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();

    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    const calendarDays = [];
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
        calendarDays.push({ date: new Date(year, month - 1, prevMonthDays - i), currentMonth: false });
    }
    for (let i = 1; i <= days; i++) {
        calendarDays.push({ date: new Date(year, month, i), currentMonth: true });
    }
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
        calendarDays.push({ date: new Date(year, month + 1, i), currentMonth: false });
    }
    return calendarDays;
  }, [currentDate, viewMode]);

  const getTypeIcon = (task: Task) => {
    const type = task.type;

    const iconMap: Record<string, string> = {
      'Reels': '🎬',
      'Post': '🖼',
      'Stories': '📱',
      'Task': '📋',
      'Meeting': '👥',
      'Call': '📞',
      'Shooting': '🎥'
    };

    if (iconMap[type]) {
      return iconMap[type];
    }

    return taskTypeService.getDefaultIconForType(type);
  };

  const getStatusColor = (task: Task) => {
    if (task.deadline && new Date(task.deadline) < new Date() && task.status !== TaskStatus.DONE) {
        return 'bg-rose-50 border-rose-200 text-rose-700 ring-1 ring-rose-100';
    }

    switch(task.status) {
      case TaskStatus.DONE: return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case TaskStatus.APPROVED: return 'bg-green-50 border-green-200 text-green-700';
      case TaskStatus.READY: return 'bg-blue-50 border-blue-200 text-blue-700';
      case TaskStatus.PENDING_CLIENT: return 'bg-yellow-50 border-yellow-300 text-yellow-700 animate-pulse';
      case TaskStatus.REJECTED: return 'bg-red-50 border-red-200 text-red-700';
      case TaskStatus.REVIEW: return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      default: return 'bg-slate-50 border-slate-100 text-slate-500';
    }
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
        const newDate = new Date(date);
        newDate.setHours(12, 0, 0, 0);
        onTaskMove(taskId, newDate.toISOString());
    }
  };

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDateRangeText = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = startOfWeek.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeek.setDate(startOfWeek.getDate() + diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
      <div className="px-8 py-5 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {getDateRangeText()}
            </h2>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                <button onClick={navigatePrev} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={navigateNext} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
            {onViewModeChange && (
              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => onViewModeChange('day')}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                    viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  День
                </button>
                <button
                  onClick={() => onViewModeChange('week')}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                    viewMode === 'week' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Неделя
                </button>
                <button
                  onClick={() => onViewModeChange('month')}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                    viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Месяц
                </button>
              </div>
            )}
        </div>
        <div className="flex gap-4">
             {[
                 { l: 'Черновик', c: 'bg-slate-200' },
                 { l: 'Проверка', c: 'bg-indigo-400' },
                 { l: 'Ждет клиента', c: 'bg-yellow-400' },
                 { l: 'Утверждено', c: 'bg-green-500' },
                 { l: 'Опубликовано', c: 'bg-emerald-500' }
             ].map(i => (
                 <div key={i.l} className="flex items-center gap-1.5">
                     <div className={`w-2 h-2 rounded-full ${i.c}`}></div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.l}</span>
                 </div>
             ))}
        </div>
      </div>

      <div className={`bg-slate-100 gap-px ${
        viewMode === 'day'
          ? 'grid grid-cols-1'
          : viewMode === 'week'
          ? 'grid grid-cols-7'
          : 'grid grid-cols-7 auto-rows-fr'
      }`}>
        {viewMode !== 'day' && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white border-b border-slate-50">{d}</div>
        ))}
        {calendarDays.map((cell, idx) => {
            const dateStr = cell.date.toDateString();
            const dayTasks = tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === dateStr);
            const isToday = cell.date.toDateString() === new Date().toDateString();
            
            const minHeight = viewMode === 'day' ? 'min-h-[600px]' : viewMode === 'week' ? 'min-h-[400px]' : 'min-h-[100px]';
            const textSize = viewMode === 'day' ? 'text-base' : 'text-[9px]';
            const dateSize = viewMode === 'day' ? 'text-2xl' : 'text-[10px]';

            return (
                <div
                    key={idx}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, cell.date)}
                    className={`${minHeight} bg-white p-4 transition-all hover:bg-blue-50/20 group relative flex flex-col ${!cell.currentMonth ? 'opacity-30' : ''}`}
                >
                    <div className="flex justify-between items-start mb-3">
                        <span className={`${dateSize} font-mono font-black ${isToday ? 'text-blue-600' : 'text-slate-300'}`}>
                            {viewMode === 'day'
                              ? cell.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric' })
                              : cell.date.getDate()
                            }
                        </span>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                        {dayTasks.map(t => (
                            <div
                                key={t.id}
                                onClick={() => onTaskClick(t)}
                                className={`px-3 py-2.5 rounded-lg ${textSize} font-bold border transition-all hover:scale-[1.03] cursor-pointer shadow-sm ${getStatusColor(t)}`}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <span className={viewMode === 'day' ? '' : 'truncate'}>{getTypeIcon(t)} {t.title}</span>
                                    <span className={`${viewMode === 'day' ? 'text-sm' : 'text-[8px]'} opacity-60 shrink-0`}>
                                      {new Date(t.deadline!).getHours()}:00
                                    </span>
                                </div>
                                {t.isDeprecated && (
                                    <div className={`mt-1 ${viewMode === 'day' ? 'text-xs' : 'text-[8px]'} font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-center`}>
                                        ⚠️ Устаревший тип
                                    </div>
                                )}
                                {t.rejectedCount && t.rejectedCount > 0 && (
                                    <div className={`mt-2 ${viewMode === 'day' ? 'text-xs' : 'text-[8px]'} font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded text-center`}>
                                        Rev #{t.rejectedCount + 1}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default ContentCalendar;
