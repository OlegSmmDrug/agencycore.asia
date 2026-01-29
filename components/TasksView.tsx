import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, User, Project, Client, SystemRole } from '../types';
import NewTaskBoard from './taskboard';
import TaskCalendar from './taskcalendar';
import TaskGantt from './taskgantt';

type ViewMode = 'board' | 'calendar' | 'gantt' | 'workload';
type TaskFilter = 'my' | 'all' | 'team' | string;

interface TasksViewProps {
    tasks: Task[];
    projects: Project[];
    users: User[];
    clients: Client[];
    currentUser: User;
    onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
    onTaskClick: (task: Task) => void;
    onAddTask: (initialData?: Partial<Task>) => void;
    onAcceptTask: (taskId: string) => void;
    onRejectTask: (taskId: string) => void;
}

const TasksView: React.FC<TasksViewProps> = ({
    tasks,
    projects,
    users,
    clients,
    currentUser,
    onTaskStatusChange,
    onTaskClick,
    onAddTask,
    onAcceptTask,
    onRejectTask
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('board');
    const [taskFilter, setTaskFilter] = useState<TaskFilter>('my');

    const teamMembers = useMemo(() => {
        if (currentUser.systemRole === SystemRole.ADMIN) {
            return users;
        }
        return users.filter(u => u.teamLeadId === currentUser.id || u.id === currentUser.id);
    }, [users, currentUser]);

    const nonArchivedTasks = useMemo(() => {
        return tasks.filter(task => {
            if (!task.projectId) return true;
            const project = projects.find(p => p.id === task.projectId);
            return !project?.isArchived;
        });
    }, [tasks, projects]);

    const filteredTasks = useMemo(() => {
        if (taskFilter === 'all') return nonArchivedTasks;
        if (taskFilter === 'my') return nonArchivedTasks.filter(t => t.assigneeId === currentUser.id);
        if (taskFilter === 'team') {
            const teamIds = teamMembers.map(u => u.id);
            return nonArchivedTasks.filter(t => t.assigneeId && teamIds.includes(t.assigneeId));
        }
        return nonArchivedTasks.filter(t => t.assigneeId === taskFilter);
    }, [nonArchivedTasks, taskFilter, currentUser.id, teamMembers]);

    const workloadData = useMemo(() => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const relevantUsers = taskFilter === 'team' ? teamMembers :
                             taskFilter === 'all' ? users :
                             taskFilter === 'my' ? [currentUser] :
                             users.filter(u => u.id === taskFilter);

        return relevantUsers.map(user => {
            const userTasks = tasks.filter(t =>
                t.assigneeId === user.id &&
                t.status !== TaskStatus.DONE &&
                t.deadline &&
                new Date(t.deadline) >= weekStart &&
                new Date(t.deadline) <= weekEnd
            );

            const totalHours = userTasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
            const maxHours = 40;
            const percentage = Math.min(100, (totalHours / maxHours) * 100);

            const tasksByStatus = {
                todo: userTasks.filter(t => t.status === TaskStatus.TODO).length,
                inProgress: userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
                review: userTasks.filter(t => t.status === TaskStatus.REVIEW).length
            };

            const overdueTasks = userTasks.filter(t => new Date(t.deadline!) < now).length;

            return {
                user,
                tasks: userTasks,
                totalHours,
                percentage,
                tasksByStatus,
                overdueTasks,
                isOverloaded: percentage > 80
            };
        }).sort((a, b) => b.percentage - a.percentage);
    }, [tasks, users, teamMembers, currentUser, taskFilter]);

    const isTeamLead = teamMembers.length > 1 || currentUser.systemRole === SystemRole.ADMIN;

    const viewModes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        {
            id: 'board',
            label: 'Канбан',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
            )
        },
        {
            id: 'calendar',
            label: 'Календарь',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            id: 'gantt',
            label: 'Таймлайн',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
            )
        },
        {
            id: 'workload',
            label: 'Загрузка',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        }
    ];

    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            <div className="flex flex-col gap-4 mb-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-slate-900">Задачи</h1>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                            {filteredTasks.length} из {nonArchivedTasks.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            {viewModes.map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setViewMode(mode.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        viewMode === mode.id
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {mode.icon}
                                    <span className="hidden sm:inline">{mode.label}</span>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => onAddTask()}
                            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">Новая задача</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setTaskFilter('my')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            taskFilter === 'my'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                        }`}
                    >
                        Мои задачи
                    </button>
                    {isTeamLead && (
                        <button
                            onClick={() => setTaskFilter('team')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                taskFilter === 'team'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                            }`}
                        >
                            Моя команда
                        </button>
                    )}
                    <button
                        onClick={() => setTaskFilter('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            taskFilter === 'all'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                        }`}
                    >
                        Все задачи
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-2"></div>
                    <select
                        value={taskFilter !== 'my' && taskFilter !== 'all' && taskFilter !== 'team' ? taskFilter : ''}
                        onChange={(e) => e.target.value && setTaskFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="">Выбрать сотрудника</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                {viewMode === 'board' && (
                    <NewTaskBoard
                        tasks={filteredTasks}
                        projects={projects}
                        users={users}
                        currentUser={currentUser}
                        onTaskStatusChange={onTaskStatusChange}
                        onTaskClick={onTaskClick}
                        onAddTask={onAddTask}
                        onAcceptTask={onAcceptTask}
                        onRejectTask={onRejectTask}
                    />
                )}
                {viewMode === 'calendar' && (
                    <TaskCalendar
                        tasks={filteredTasks}
                        users={users}
                        projects={projects}
                        onTaskClick={onTaskClick}
                    />
                )}
                {viewMode === 'gantt' && (
                    <TaskGantt
                        tasks={filteredTasks}
                        projects={projects}
                        users={users}
                        onTaskClick={onTaskClick}
                    />
                )}
                {viewMode === 'workload' && (
                    <WorkloadView
                        workloadData={workloadData}
                        onTaskClick={onTaskClick}
                        onUserClick={(userId) => setTaskFilter(userId)}
                    />
                )}
            </div>
        </div>
    );
};

interface WorkloadViewProps {
    workloadData: {
        user: User;
        tasks: Task[];
        totalHours: number;
        percentage: number;
        tasksByStatus: { todo: number; inProgress: number; review: number };
        overdueTasks: number;
        isOverloaded: boolean;
    }[];
    onTaskClick: (task: Task) => void;
    onUserClick: (userId: string) => void;
}

const WorkloadView: React.FC<WorkloadViewProps> = ({ workloadData, onTaskClick, onUserClick }) => {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const selectedUserData = workloadData.find(d => d.user.id === selectedUserId);

    return (
        <div className="h-full flex gap-6 animate-fade-in">
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Загрузка команды</h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">Текущая неделя</p>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100%-70px)] custom-scrollbar">
                    {workloadData.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <p className="text-sm font-medium">Нет данных о загрузке</p>
                        </div>
                    ) : (
                        workloadData.map(({ user, totalHours, percentage, tasksByStatus, overdueTasks, isOverloaded }) => (
                            <div
                                key={user.id}
                                onClick={() => { setSelectedUserId(user.id); onUserClick(user.id); }}
                                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                                    selectedUserId === user.id
                                        ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-100'
                                        : isOverloaded
                                            ? 'border-red-200 bg-red-50/30'
                                            : 'border-slate-100 hover:border-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <img
                                        src={user.avatar}
                                        alt={user.name}
                                        className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                isOverloaded ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {totalHours}ч / 40ч
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400">{user.jobTitle}</p>
                                        <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[9px] font-bold text-slate-400">
                                                <span className="text-blue-600">{tasksByStatus.todo}</span> в очереди
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                <span className="text-amber-600">{tasksByStatus.inProgress}</span> в работе
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                <span className="text-emerald-600">{tasksByStatus.review}</span> на проверке
                                            </span>
                                            {overdueTasks > 0 && (
                                                <span className="text-[9px] font-bold text-red-600">
                                                    {overdueTasks} просрочено
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {selectedUserData && (
                <div className="w-96 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <img
                            src={selectedUserData.user.avatar}
                            alt={selectedUserData.user.name}
                            className="w-8 h-8 rounded-lg object-cover"
                        />
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">{selectedUserData.user.name}</h3>
                            <p className="text-[10px] text-slate-400">{selectedUserData.tasks.length} задач на неделе</p>
                        </div>
                    </div>
                    <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100%-70px)] custom-scrollbar">
                        {selectedUserData.tasks.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <p className="text-sm">Нет задач на этой неделе</p>
                            </div>
                        ) : (
                            selectedUserData.tasks.map(task => {
                                const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => onTaskClick(task)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                                            isOverdue ? 'border-red-200 bg-red-50/50' : 'border-slate-100 hover:border-slate-200'
                                        }`}
                                    >
                                        <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                task.status === TaskStatus.TODO ? 'bg-slate-100 text-slate-500' :
                                                task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-600' :
                                                task.status === TaskStatus.REVIEW ? 'bg-amber-100 text-amber-600' :
                                                'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {task.status}
                                            </span>
                                            <span className="text-[9px] text-slate-400">
                                                {task.estimatedHours || 1}ч
                                            </span>
                                            {task.deadline && (
                                                <span className={`text-[9px] ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                                                    {new Date(task.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksView;
