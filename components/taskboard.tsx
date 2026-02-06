
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, User, TaskType, Project } from '../types';
import { parseQuickTask } from '../services/geminiService';
import UserAvatar from './UserAvatar';

interface TaskBoardProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  currentUser: User;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (initialData?: Partial<Task>) => void;
  onAcceptTask: (taskId: string) => void;
  onRejectTask: (taskId: string) => void;
}

type BoardView = 'status' | 'timeline';

const TaskBoard: React.FC<TaskBoardProps> = ({
    tasks = [], projects = [], users = [], currentUser,
    onTaskStatusChange, onTaskClick, onAddTask, onAcceptTask, onRejectTask
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [boardView, setBoardView] = useState<BoardView>('status');

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickInput.trim()) return;
      setIsAiParsing(true);
      try {
          const smartData = await parseQuickTask(quickInput, projects);
          onAddTask({
              ...smartData,
              projectId: smartData.projectId || (filterProject !== 'all' ? filterProject : undefined),
              assigneeId: currentUser.id,
              status: TaskStatus.TODO,
          });
          setQuickInput('');
      } catch (err) {
          console.error("Ошибка ИИ:", err);
          onAddTask({ title: quickInput });
      } finally {
          setIsAiParsing(false);
      }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => filterProject === 'all' ? true : task.projectId === filterProject);
  }, [tasks, filterProject]);

  const getTodayStart = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const getTodayEnd = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  };

  const getWeekEnd = () => {
    const week = new Date();
    week.setDate(week.getDate() + (7 - week.getDay()));
    week.setHours(23, 59, 59, 999);
    return week;
  };

  const timelineColumns = useMemo(() => {
    const todayStart = getTodayStart();
    const todayEnd = getTodayEnd();
    const weekEnd = getWeekEnd();

    const queueTasks = filteredTasks.filter(t => t.status === TaskStatus.TODO);

    const todayTasks = filteredTasks.filter(t => {
      if (!t.deadline) return false;
      const deadline = new Date(t.deadline);
      return deadline >= todayStart && deadline <= todayEnd && t.status !== TaskStatus.DONE;
    });

    const weekTasks = filteredTasks.filter(t => {
      if (!t.deadline) return false;
      const deadline = new Date(t.deadline);
      return deadline > todayEnd && deadline <= weekEnd && t.status !== TaskStatus.DONE;
    });

    return [
      { id: 'queue', label: 'В ОЧЕРЕДИ', color: 'bg-slate-300', tasks: queueTasks },
      { id: 'today', label: 'ЗАДАЧИ НА СЕГОДНЯ', color: 'bg-orange-500', tasks: todayTasks },
      { id: 'week', label: 'ЗАДАЧИ НА НЕДЕЛЕ', color: 'bg-blue-500', tasks: weekTasks }
    ];
  }, [filteredTasks]);

  const statusColumns = [
    { id: TaskStatus.TODO, label: 'В ОЧЕРЕДИ', color: 'bg-slate-300' },
    { id: TaskStatus.IN_PROGRESS, label: 'В ПРОЦЕССЕ', color: 'bg-blue-600' },
    { id: TaskStatus.REVIEW, label: 'ПРОВЕРКА', color: 'bg-amber-400' },
    { id: TaskStatus.DONE, label: 'ВЫПОЛНЕНО', color: 'bg-emerald-500' }
  ];

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in max-w-full mx-auto overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <form onSubmit={handleQuickAdd} className="relative flex-1 w-full">
                <input
                    type="text"
                    value={quickInput}
                    onChange={e => setQuickInput(e.target.value)}
                    disabled={isAiParsing}
                    placeholder={isAiParsing ? "Магия ИИ..." : "Пример: Съемка Reels завтра с 10 до 12 срочно"}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-28 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {isAiParsing ? <span className="animate-spin inline-block">...</span> : <span className="text-lg">*</span>}
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100 uppercase">AI</span>
                </div>
            </form>

            <div className="flex items-center gap-3">
                <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setBoardView('status')}
                        className={`px-4 py-2.5 text-[10px] font-bold uppercase transition-all ${
                            boardView === 'status' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        По статусу
                    </button>
                    <button
                        onClick={() => setBoardView('timeline')}
                        className={`px-4 py-2.5 text-[10px] font-bold uppercase transition-all ${
                            boardView === 'timeline' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        По времени
                    </button>
                </div>

                <select
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                >
                    <option value="all">Все проекты</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
        </div>

        <div className="flex-1 flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x snap-mandatory px-1">
            {boardView === 'status' ? (
                statusColumns.map(col => {
                    const colTasks = filteredTasks.filter(t => t.status === col.id);
                    return (
                        <div
                            key={col.id}
                            className="flex-shrink-0 w-[82vw] sm:w-[300px] md:w-[340px] flex flex-col snap-center rounded-2xl bg-slate-100/40 border border-slate-200/50 overflow-hidden"
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => {
                                const tid = e.dataTransfer.getData('taskId');
                                if(tid) onTaskStatusChange(tid, col.id);
                            }}
                        >
                            <div className="p-4 flex justify-between items-center bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${col.color}`}></div>
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{col.label}</h3>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">{colTasks.length}</span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                {colTasks.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 py-20">
                                        <p className="text-[10px] font-bold uppercase tracking-widest italic">Пусто</p>
                                    </div>
                                )}
                                {colTasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        users={users}
                                        currentUser={currentUser}
                                        projects={projects}
                                        onClick={() => onTaskClick(task)}
                                        onAccept={onAcceptTask}
                                        onStatusChange={onTaskStatusChange}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })
            ) : (
                timelineColumns.map(col => (
                    <div
                        key={col.id}
                        className="flex-shrink-0 w-[82vw] sm:w-[300px] md:w-[340px] flex flex-col snap-center rounded-2xl bg-slate-100/40 border border-slate-200/50 overflow-hidden"
                    >
                        <div className="p-4 flex justify-between items-center bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${col.color}`}></div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{col.label}</h3>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">{col.tasks.length}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                            {col.tasks.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 py-20">
                                    <p className="text-[10px] font-bold uppercase tracking-widest italic">Пусто</p>
                                </div>
                            )}
                            {col.tasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    users={users}
                                    currentUser={currentUser}
                                    projects={projects}
                                    onClick={() => onTaskClick(task)}
                                    onAccept={onAcceptTask}
                                    onStatusChange={onTaskStatusChange}
                                />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

const TaskCard = ({ task, users, currentUser, projects, onClick, onAccept, onStatusChange }: any) => {
    const assignee = users.find((u: any) => u.id === task.assigneeId);
    const creator = users.find((u: any) => u.id === task.creatorId);
    const project = projects.find((p: any) => p.id === task.projectId);

    const now = new Date();
    const isDeadlineToday = task.deadline && new Date(task.deadline).toDateString() === now.toDateString();
    const isOverdue = task.deadline && new Date(task.deadline) < now && task.status !== TaskStatus.DONE;
    const isDone = task.status === TaskStatus.DONE;

    const isBurning = (isDeadlineToday || isOverdue) && !isDone;

    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter((s: any) => s.isCompleted).length;
    const subtaskProgress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

    const getPriorityStyles = () => {
        if (isDone) return 'bg-white opacity-60 grayscale-[0.3] border-slate-200';
        return 'bg-white border-slate-200';
    };

    const formatTimeRange = () => {
        if (!task.startedAt && !task.deadline) return null;
        const start = task.startedAt ? new Date(task.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';
        const end = task.deadline ? new Date(task.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';
        return `${start} - ${end}`;
    };

    return (
        <div
            draggable
            onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
            onClick={onClick}
            className={`
                rounded-2xl border transition-all duration-300 cursor-pointer relative group flex flex-col
                hover:shadow-xl ${getPriorityStyles()} ${isBurning ? 'urgent-burn' : ''}
            `}
        >
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-1 overflow-hidden flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border inline-block tracking-tight uppercase ${getTypeStyles(task.type)}`}>
                                {getTypeLabel(task.type)}
                            </span>
                            {isBurning && <span className="text-sm animate-bounce" title="Дедлайн горит!">!</span>}
                        </div>
                        {project && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded truncate max-w-full inline-block">
                                {project.name}
                            </span>
                        )}
                    </div>
                    {(task.kpiValue ?? 0) > 0 && (
                        <div className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 shrink-0">
                            +{(task.kpiValue ?? 0).toLocaleString()} T
                        </div>
                    )}
                </div>

                <h4 className={`text-[14px] font-bold text-slate-800 leading-tight mb-3 line-clamp-2 ${isDone ? 'line-through text-slate-400' : ''}`}>
                    {task.title}
                </h4>

                {subtasks.length > 0 && (
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Подзадачи</span>
                            <span className="text-[10px] font-bold text-slate-500">{completedSubtasks}/{subtasks.length}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${subtaskProgress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${subtaskProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                    <div className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${isBurning ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                        {formatTimeRange() || 'Весь день'}
                    </div>
                    {task.deadline && (
                        <div className={`text-[10px] font-bold flex items-center gap-1 ${isOverdue || isDeadlineToday ? 'text-red-600' : 'text-slate-400'}`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {new Date(task.deadline).toLocaleDateString('ru-RU', {day:'2-digit', month:'short'})}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100/60">
                    <div className="flex items-center gap-2">
                        {assignee && (
                            <UserAvatar
                                src={assignee.avatar}
                                name={assignee.name}
                                size="md"
                                className="!rounded-lg"
                                borderClassName="border-2 border-blue-200 shadow-sm"
                            />
                        )}
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-slate-700">{assignee?.name?.split(' ')[0] || 'Не назначен'}</span>
                            <span className="text-[9px] text-slate-400">исполнитель</span>
                        </div>
                    </div>
                    {creator && (
                        <div className="flex items-center gap-1.5" title={`Поставил: ${creator.name}`}>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-medium text-slate-600">{creator.name?.split(' ')[0]}</span>
                                <span className="text-[8px] text-slate-400">поставил</span>
                            </div>
                            <UserAvatar
                                src={creator.avatar}
                                name={creator.name}
                                size="sm"
                                className="!rounded"
                                borderClassName="border border-slate-200"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                    {task.status === TaskStatus.TODO && task.assigneeId === currentUser.id && task.acceptanceStatus !== 'Accepted' ? (
                        <button
                            onClick={e => { e.stopPropagation(); onAccept(task.id); }}
                            className="w-full bg-slate-900 text-white text-[10px] font-bold py-2.5 rounded-lg hover:bg-black transition-all active:scale-95"
                        >
                            В РАБОТУ
                        </button>
                    ) : (
                        <select
                            value={task.status}
                            onChange={e => { e.stopPropagation(); onStatusChange(task.id, e.target.value as TaskStatus); }}
                            className="w-full bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold py-2.5 px-3 rounded-lg transition-all border border-slate-200 outline-none cursor-pointer"
                            onClick={e => e.stopPropagation()}
                        >
                            <option value={TaskStatus.IN_PROGRESS}>В процессе</option>
                            <option value={TaskStatus.REVIEW}>На проверку</option>
                            <option value={TaskStatus.DONE}>Выполнено</option>
                        </select>
                    )}
                </div>
            </div>
        </div>
    );
};

const getTypeLabel = (type: TaskType) => {
    switch(type) {
        case 'Shooting': return 'Съемка';
        case 'Meeting': return 'Встреча';
        case 'Call': return 'Звонок';
        default: return 'Задача';
    }
};

const getTypeStyles = (type: TaskType) => {
    switch(type) {
        case 'Shooting': return 'text-rose-600 bg-rose-50 border-rose-100';
        case 'Meeting': return 'text-amber-600 bg-amber-50 border-amber-100';
        case 'Call': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        default: return 'text-blue-500 bg-blue-50 border-blue-100';
    }
};

export default TaskBoard;
