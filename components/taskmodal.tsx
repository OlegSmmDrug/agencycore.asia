
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, Project, User, Client, TaskStatus, TaskType, TaskPriority, Subtask, AssignmentHistoryEntry, Level1Stage, Level1StageStatus } from '../types';
import { roadmapService, RoadmapStageLevel1, RoadmapStageLevel2 } from '../services/roadmapService';
import { level1StageService } from '../services/level1StageService';
import { taskTypeService, DynamicTaskType, StaticTaskType } from '../services/taskTypeService';
import UserAvatar from './UserAvatar';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  initialTask?: Partial<Task>;
  projects: Project[];
  users: User[];
  clients: Client[];
  currentUser: User;
  allTasks?: Task[];
}

const TaskModal: React.FC<TaskModalProps> = ({
    isOpen, onClose, onSave, initialTask, projects, users, clients, currentUser, allTasks = []
}) => {
    const [task, setTask] = useState<Partial<Task>>({});
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [dateInputValue, setDateInputValue] = useState('');
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignReason, setReassignReason] = useState('');
    const [newAssigneeId, setNewAssigneeId] = useState('');
    const [newParticipant, setNewParticipant] = useState('');
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
    const [level1Stages, setLevel1Stages] = useState<RoadmapStageLevel1[]>([]);
    const [level2Stages, setLevel2Stages] = useState<RoadmapStageLevel2[]>([]);
    const [level1StageStatuses, setLevel1StageStatuses] = useState<Level1StageStatus[]>([]);
    const [selectedLevel1StageId, setSelectedLevel1StageId] = useState<string>('');
    const [dynamicTaskTypes, setDynamicTaskTypes] = useState<DynamicTaskType[]>([]);
    const [staticTaskTypes, setStaticTaskTypes] = useState<StaticTaskType[]>([]);
    const [showServiceDropdown, setShowServiceDropdown] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);
    const participantRef = useRef<HTMLDivElement>(null);
    const serviceDropdownRef = useRef<HTMLDivElement>(null);

    const shootingTasks = useMemo(() => {
        return allTasks.filter(t => t.type === 'Shooting' && t.startedAt);
    }, [allTasks]);

    const handleReassign = () => {
        if (!newAssigneeId) return;
        const historyEntry: AssignmentHistoryEntry = {
            fromUserId: task.assigneeId,
            toUserId: newAssigneeId,
            reason: reassignReason || undefined,
            timestamp: new Date().toISOString(),
            changedBy: currentUser.id
        };
        const currentHistory = task.assignmentHistory || [];
        setTask({
            ...task,
            assigneeId: newAssigneeId,
            assignmentHistory: [...currentHistory, historyEntry],
            acceptanceStatus: 'Pending'
        });
        setShowReassignModal(false);
        setReassignReason('');
        setNewAssigneeId('');
    };

    const addSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const newSubtask: Subtask = {
            id: `st-${Date.now()}`,
            title: newSubtaskTitle.trim(),
            isCompleted: false
        };
        setTask({ ...task, subtasks: [...(task.subtasks || []), newSubtask] });
        setNewSubtaskTitle('');
    };

    const toggleSubtask = (subtaskId: string) => {
        setTask({
            ...task,
            subtasks: (task.subtasks || []).map(s =>
                s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
            )
        });
    };

    const removeSubtask = (subtaskId: string) => {
        setTask({
            ...task,
            subtasks: (task.subtasks || []).filter(s => s.id !== subtaskId)
        });
    };

    const addParticipant = (userId: string) => {
        const current = task.participants || [];
        if (!current.includes(userId)) {
            setTask({ ...task, participants: [...current, userId] });
        }
        setShowParticipantDropdown(false);
    };

    const removeParticipant = (userId: string) => {
        setTask({
            ...task,
            participants: (task.participants || []).filter(id => id !== userId)
        });
    };

    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            now.setMinutes(0);
            const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

            const initial: Partial<Task> = {
                title: '',
                description: '',
                status: TaskStatus.IN_PROGRESS,
                type: 'Task' as TaskType,
                subtasks: [],
                participants: [],
                assigneeId: currentUser.id,
                creatorId: initialTask?.creatorId || currentUser.id,
                kpiValue: 0,
                estimatedHours: 1,
                startedAt: now.toISOString(),
                deadline: inOneHour.toISOString(),
                assignmentHistory: [],
                ...initialTask
            };
            setTask(initial);
            const dateToDisplay = initial.startedAt || initial.deadline || now.toISOString();
            const displayDate = new Date(dateToDisplay);
            setDateInputValue(displayDate.toLocaleDateString('ru-RU'));
            setCalendarMonth(new Date(displayDate.getFullYear(), displayDate.getMonth(), 1));

            const loadTaskTypes = async () => {
                try {
                    const staticTypes = taskTypeService.getStaticTaskTypes();
                    const dynamicTypes = await taskTypeService.getDynamicTaskTypes();
                    setStaticTaskTypes(staticTypes);
                    setDynamicTaskTypes(dynamicTypes.filter(t => !t.isDeprecated));
                } catch (error) {
                    console.error('Failed to load task types:', error);
                }
            };

            loadTaskTypes();
        } else {
            setShowServiceDropdown(false);
        }
    }, [isOpen, initialTask, currentUser.id]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
                setIsCalendarOpen(false);
            }
            if (participantRef.current && !participantRef.current.contains(e.target as Node)) {
                setShowParticipantDropdown(false);
            }
            if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(e.target as Node)) {
                setShowServiceDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const loadDynamicTypes = async () => {
            try {
                const dynamicTypes = await taskTypeService.getDynamicTaskTypes();
                setDynamicTaskTypes(dynamicTypes.filter(t => !t.isDeprecated));
            } catch (error) {
                console.error('Failed to load dynamic task types:', error);
            }
        };

        const unsubscribe = taskTypeService.subscribeToTaskTypeChanges(() => {
            loadDynamicTypes();
        });

        return () => {
            unsubscribe();
        };
    }, [isOpen]);

    useEffect(() => {
        const loadStages = async () => {
            if (!task.projectId) {
                setLevel1Stages([]);
                setLevel2Stages([]);
                setLevel1StageStatuses([]);
                return;
            }

            try {
                const [l1Stages, l2Stages, statuses] = await Promise.all([
                    roadmapService.getLevel1Stages(),
                    roadmapService.getLevel2StagesByProject(task.projectId),
                    level1StageService.getProjectStageStatus(task.projectId)
                ]);
                setLevel1Stages(l1Stages);
                setLevel2Stages(l2Stages);
                setLevel1StageStatuses(statuses);

                if (task.stage_level2_id) {
                    const selectedL2Stage = l2Stages.find(s => s.id === task.stage_level2_id);
                    if (selectedL2Stage) {
                        setSelectedLevel1StageId(selectedL2Stage.level1_stage_id || '');
                    }
                }
            } catch (error) {
                console.error('Error loading stages:', error);
            }
        };

        loadStages();
    }, [task.projectId]);

    const handleSave = () => {
        if (!task.title?.trim()) return;
        onSave(task);
    };

    const updateDate = (newDate: Date) => {
        const currentStart = new Date(task.startedAt || task.deadline || new Date());
        const currentEnd = new Date(task.deadline || task.startedAt || new Date());
        const duration = currentEnd.getTime() - currentStart.getTime();
        const newStart = new Date(newDate);
        newStart.setHours(currentStart.getHours(), currentStart.getMinutes(), 0, 0);
        const newEnd = new Date(newStart.getTime() + Math.abs(duration));
        setTask({ ...task, startedAt: newStart.toISOString(), deadline: newEnd.toISOString() });
        setDateInputValue(newStart.toLocaleDateString('ru-RU'));
        setCalendarMonth(new Date(newStart.getFullYear(), newStart.getMonth(), 1));
        setIsCalendarOpen(false);
    };

    const handleTextDateInput = (val: string) => {
        setDateInputValue(val);
        const parts = val.split('.');
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
            const day = Number(parts[0]);
            const month = Number(parts[1]);
            const year = Number(parts[2]);
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                const d = new Date(year, month - 1, day);
                if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month - 1) {
                    const currentStart = new Date(task.startedAt || task.deadline || new Date());
                    const currentEnd = new Date(task.deadline || task.startedAt || new Date());
                    const duration = currentEnd.getTime() - currentStart.getTime();
                    const newStart = new Date(d);
                    newStart.setHours(currentStart.getHours(), currentStart.getMinutes(), 0, 0);
                    const newEnd = new Date(newStart.getTime() + Math.abs(duration));
                    setTask({ ...task, startedAt: newStart.toISOString(), deadline: newEnd.toISOString() });
                    setCalendarMonth(new Date(newStart.getFullYear(), newStart.getMonth(), 1));
                }
            }
        }
    };

    const setQuickTime = (hours: number) => {
        const start = new Date(task.startedAt || task.deadline || new Date());
        const currentEnd = new Date(task.deadline || task.startedAt || new Date());
        const duration = currentEnd.getTime() - start.getTime();
        start.setHours(hours, 0, 0, 0);
        const end = new Date(start.getTime() + Math.abs(duration));
        setTask({ ...task, startedAt: start.toISOString(), deadline: end.toISOString() });
    };

    const setDurationHours = (hours: number) => {
        const start = new Date(task.startedAt || new Date());
        const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
        setTask({ ...task, deadline: end.toISOString(), estimatedHours: hours });
    };

    const getDurationHoursText = () => {
        if (!task.startedAt || !task.deadline) return '0ч';
        const diff = (new Date(task.deadline).getTime() - new Date(task.startedAt).getTime()) / (1000 * 3600);
        return `${Math.round(diff)}ч`;
    };

    const getCalendarDays = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = (firstDay.getDay() + 6) % 7;

        const days: (Date | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const changeCalendarMonth = (direction: number) => {
        const newMonth = new Date(calendarMonth);
        newMonth.setMonth(newMonth.getMonth() + direction);
        setCalendarMonth(newMonth);
    };

    const getMonthYearText = () => {
        const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        return `${months[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;
    };

    const generate2GisLink = (address: string) => {
        return `https://2gis.kz/search/${encodeURIComponent(address)}`;
    };

    const currentTaskTypeInfo = useMemo(() => {
        const staticType = staticTaskTypes.find(t => t.id === task.type);
        if (staticType) return staticType;

        const dynamicType = dynamicTaskTypes.find(t => t.name === task.type);
        if (dynamicType) {
            return {
                id: dynamicType.name,
                label: dynamicType.name.toUpperCase(),
                icon: dynamicType.icon,
                color: dynamicType.color,
                svgPath: ''
            };
        }

        return staticTaskTypes[0] || {
            id: 'Task',
            label: 'ЗАДАЧА',
            icon: '📋',
            color: 'blue',
            svgPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
        };
    }, [task.type, staticTaskTypes, dynamicTaskTypes]);

    const isServiceSelected = useMemo(() => {
        return !staticTaskTypes.some(t => t.id === task.type);
    }, [task.type, staticTaskTypes]);

    const typeColor = useMemo(() => {
        return currentTaskTypeInfo?.color || 'blue';
    }, [currentTaskTypeInfo]);

    if (!isOpen) return null;

    const renderShootingCalendar = () => {
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
        const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        const shootingDays = new Set(
            shootingTasks.map(t => {
                const d = new Date(t.startedAt!);
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            })
        );

        const selectedDay = task.startedAt ? new Date(task.startedAt) : null;
        const selectedKey = selectedDay ? `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}` : null;

        return (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Календарь съемок</h5>
                    <span className="text-[10px] font-bold text-slate-500">
                        {today.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                        <div key={d} className="text-[8px] font-bold text-slate-300 text-center py-1">{d}</div>
                    ))}
                    {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateKey = `${today.getFullYear()}-${today.getMonth()}-${day}`;
                        const hasShooting = shootingDays.has(dateKey);
                        const isSelected = dateKey === selectedKey;
                        const isToday = day === today.getDate();

                        return (
                            <button
                                key={day}
                                type="button"
                                onClick={() => {
                                    const newDate = new Date(today.getFullYear(), today.getMonth(), day);
                                    updateDate(newDate);
                                }}
                                className={`h-7 rounded-lg text-[10px] font-bold transition-all relative ${
                                    isSelected ? 'bg-rose-500 text-white shadow-md' :
                                    hasShooting ? 'bg-rose-100 text-rose-600' :
                                    isToday ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' :
                                    'hover:bg-slate-100 text-slate-500'
                                }`}
                            >
                                {day}
                                {hasShooting && !isSelected && (
                                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-rose-400" />
                                )}
                            </button>
                        );
                    })}
                </div>
                {shootingTasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 mb-2">Ближайшие съемки:</p>
                        <div className="space-y-1 max-h-20 overflow-y-auto">
                            {shootingTasks
                                .filter(t => new Date(t.startedAt!) >= today)
                                .slice(0, 3)
                                .map(t => (
                                    <div key={t.id} className="flex items-center gap-2 text-[10px]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                        <span className="font-bold text-slate-600 truncate">{t.title}</span>
                                        <span className="text-slate-400 shrink-0">
                                            {new Date(t.startedAt!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderTypeSpecificFields = () => {
        switch (task.type) {
            case 'Shooting':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Адрес съемки</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={task.address || ''}
                                    onChange={e => {
                                        const addr = e.target.value;
                                        setTask({ ...task, address: addr, addressLink: generate2GisLink(addr) });
                                    }}
                                    placeholder="Введите адрес..."
                                    className="flex-1 bg-slate-50 border border-transparent focus:border-rose-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all"
                                />
                                {task.address && (
                                    <a
                                        href={task.addressLink || generate2GisLink(task.address)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-3 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all flex items-center gap-2 shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        2ГИС
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Длительность съемки</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => setDurationHours(h)}
                                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                                            getDurationHoursText() === `${h}ч`
                                                ? 'bg-rose-50 border-rose-400 text-rose-700'
                                                : 'bg-white border-slate-100 text-slate-400 hover:border-rose-200'
                                        }`}
                                    >
                                        {h} час{h > 1 ? (h < 5 ? 'а' : 'ов') : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2" ref={participantRef}>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Команда на съемке</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(task.participants || []).map(userId => {
                                    const user = users.find(u => u.id === userId);
                                    return user ? (
                                        <div key={userId} className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5">
                                            <UserAvatar src={user.avatar} name={user.name} size="xs" />
                                            <span className="text-xs font-bold text-rose-700">{user.name}</span>
                                            <button type="button" onClick={() => removeParticipant(userId)} className="text-rose-400 hover:text-rose-600">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                                    className="w-full bg-slate-50 border border-dashed border-slate-200 hover:border-rose-300 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 outline-none transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4" /></svg>
                                    Добавить участника
                                </button>
                                {showParticipantDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {users.filter(u => !(task.participants || []).includes(u.id)).map(user => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => addParticipant(user.id)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <UserAvatar src={user.avatar} name={user.name} size="md" />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{user.name}</p>
                                                    <p className="text-[10px] text-slate-400">{user.jobTitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Дополнительные участники</label>
                            <input
                                type="text"
                                value={task.externalParticipants || ''}
                                onChange={e => setTask({ ...task, externalParticipants: e.target.value })}
                                placeholder="Модели, актеры, клиент..."
                                className="w-full bg-slate-50 border border-transparent focus:border-rose-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Аппаратура</label>
                            <textarea
                                value={task.equipment || ''}
                                onChange={e => setTask({ ...task, equipment: e.target.value })}
                                placeholder="Камера, свет, микрофоны..."
                                rows={2}
                                className="w-full bg-slate-50 border border-transparent focus:border-rose-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Сценарий / ТЗ</label>
                            <textarea
                                value={task.scenario || task.description || ''}
                                onChange={e => setTask({ ...task, scenario: e.target.value, description: e.target.value })}
                                placeholder="Опишите сценарий съемки..."
                                rows={4}
                                className="w-full bg-slate-50 border border-transparent focus:border-rose-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all resize-none"
                            />
                        </div>

                        {renderShootingCalendar()}
                    </div>
                );

            case 'Meeting':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Место встречи</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={task.address || ''}
                                    onChange={e => {
                                        const addr = e.target.value;
                                        setTask({ ...task, address: addr, addressLink: generate2GisLink(addr) });
                                    }}
                                    placeholder="Адрес или онлайн..."
                                    className="flex-1 bg-slate-50 border border-transparent focus:border-amber-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all"
                                />
                                {task.address && (
                                    <a
                                        href={task.addressLink || generate2GisLink(task.address)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-3 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all flex items-center gap-2 shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        2ГИС
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Длительность встречи</label>
                            <div className="flex gap-2">
                                {[1, 2, 3].map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => setDurationHours(h)}
                                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                                            getDurationHoursText() === `${h}ч`
                                                ? 'bg-amber-50 border-amber-400 text-amber-700'
                                                : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200'
                                        }`}
                                    >
                                        {h} час{h > 1 ? (h < 5 ? 'а' : 'ов') : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2" ref={participantRef}>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Участники от команды</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(task.participants || []).map(userId => {
                                    const user = users.find(u => u.id === userId);
                                    return user ? (
                                        <div key={userId} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                                            <UserAvatar src={user.avatar} name={user.name} size="xs" />
                                            <span className="text-xs font-bold text-amber-700">{user.name}</span>
                                            <button type="button" onClick={() => removeParticipant(userId)} className="text-amber-400 hover:text-amber-600">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                                    className="w-full bg-slate-50 border border-dashed border-slate-200 hover:border-amber-300 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 outline-none transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4" /></svg>
                                    Добавить участника
                                </button>
                                {showParticipantDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {users.filter(u => !(task.participants || []).includes(u.id)).map(user => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => addParticipant(user.id)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <UserAvatar src={user.avatar} name={user.name} size="md" />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{user.name}</p>
                                                    <p className="text-[10px] text-slate-400">{user.jobTitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">С кем встреча</label>
                            <input
                                type="text"
                                value={task.meetingWith || ''}
                                onChange={e => setTask({ ...task, meetingWith: e.target.value })}
                                placeholder="Клиент, партнер, подрядчик..."
                                className="w-full bg-slate-50 border border-transparent focus:border-amber-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Повестка / Описание</label>
                            <textarea
                                value={task.description || ''}
                                onChange={e => setTask({ ...task, description: e.target.value })}
                                placeholder="Цели встречи, вопросы для обсуждения..."
                                rows={4}
                                className="w-full bg-slate-50 border border-transparent focus:border-amber-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                );

            case 'Call':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ссылка на созвон</label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={task.callLink || ''}
                                    onChange={e => setTask({ ...task, callLink: e.target.value })}
                                    placeholder="https://meet.google.com/... или zoom.us/..."
                                    className="flex-1 bg-slate-50 border border-transparent focus:border-emerald-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all"
                                />
                                {task.callLink && (
                                    <a
                                        href={task.callLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Открыть
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2" ref={participantRef}>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Участники</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(task.participants || []).map(userId => {
                                    const user = users.find(u => u.id === userId);
                                    return user ? (
                                        <div key={userId} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                                            <UserAvatar src={user.avatar} name={user.name} size="xs" />
                                            <span className="text-xs font-bold text-emerald-700">{user.name}</span>
                                            <button type="button" onClick={() => removeParticipant(userId)} className="text-emerald-400 hover:text-emerald-600">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                                    className="w-full bg-slate-50 border border-dashed border-slate-200 hover:border-emerald-300 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 outline-none transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4" /></svg>
                                    Добавить участника
                                </button>
                                {showParticipantDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {users.filter(u => !(task.participants || []).includes(u.id)).map(user => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => addParticipant(user.id)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <UserAvatar src={user.avatar} name={user.name} size="md" />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{user.name}</p>
                                                    <p className="text-[10px] text-slate-400">{user.jobTitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Описание / Повестка</label>
                            <textarea
                                value={task.description || ''}
                                onChange={e => setTask({ ...task, description: e.target.value })}
                                placeholder="Тема звонка, вопросы..."
                                rows={4}
                                className="w-full bg-slate-50 border border-transparent focus:border-emerald-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="space-y-4">
                        <textarea
                            className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl p-6 text-sm text-slate-600 min-h-[120px] focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50/30 outline-none resize-none leading-relaxed transition-all"
                            value={task.description}
                            onChange={e => setTask({...task, description: e.target.value})}
                            placeholder="Детали, ссылки, ТЗ..."
                        />

                        <div className="space-y-3 bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Подзадачи</h4>
                                {(task.subtasks || []).length > 0 && (
                                    <span className="text-[10px] font-bold text-blue-600">
                                        {(task.subtasks || []).filter(s => s.isCompleted).length}/{(task.subtasks || []).length}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newSubtaskTitle}
                                    onChange={e => setNewSubtaskTitle(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                    placeholder="Добавить подзадачу..."
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={addSubtask}
                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all"
                                >
                                    +
                                </button>
                            </div>

                            {(task.subtasks || []).length > 0 && (
                                <div className="space-y-2 mt-3">
                                    {(task.subtasks || []).map(subtask => (
                                        <div
                                            key={subtask.id}
                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                                subtask.isCompleted
                                                    ? 'bg-emerald-50/50 border-emerald-100'
                                                    : 'bg-white border-slate-100 hover:border-slate-200'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleSubtask(subtask.id)}
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                                    subtask.isCompleted
                                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                                        : 'border-slate-300 hover:border-blue-400'
                                                }`}
                                            >
                                                {subtask.isCompleted && (
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                        <path d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                            <span className={`flex-1 text-sm ${subtask.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                                {subtask.title}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeSubtask(subtask.id)}
                                                className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
        }
    };

    const getBgColorClass = (color: string) => {
        const colorMap: Record<string, string> = {
            'rose': 'bg-rose-500',
            'amber': 'bg-amber-500',
            'emerald': 'bg-emerald-500',
            'blue': 'bg-blue-500',
            'purple': 'bg-purple-500',
            'green': 'bg-green-500',
            'red': 'bg-red-500',
            'yellow': 'bg-yellow-500',
            'indigo': 'bg-indigo-500',
            'pink': 'bg-pink-500',
            'cyan': 'bg-cyan-500',
            'teal': 'bg-teal-500',
            'orange': 'bg-orange-500'
        };
        return colorMap[color] || 'bg-blue-500';
    };

    const getBorderColorClass = (color: string) => {
        const colorMap: Record<string, string> = {
            'rose': 'border-rose-500',
            'amber': 'border-amber-500',
            'emerald': 'border-emerald-500',
            'blue': 'border-blue-500',
            'purple': 'border-purple-500',
            'green': 'border-green-500',
            'red': 'border-red-500',
            'yellow': 'border-yellow-500',
            'indigo': 'border-indigo-500',
            'pink': 'border-pink-500',
            'cyan': 'border-cyan-500',
            'teal': 'border-teal-500',
            'orange': 'border-orange-500'
        };
        return colorMap[color] || 'border-blue-500';
    };

    const getButtonColorClasses = (color: string) => {
        const colorMap: Record<string, string> = {
            'rose': 'bg-rose-600 hover:bg-rose-700',
            'amber': 'bg-amber-600 hover:bg-amber-700',
            'emerald': 'bg-emerald-600 hover:bg-emerald-700',
            'blue': 'bg-blue-600 hover:bg-blue-700',
            'purple': 'bg-purple-600 hover:bg-purple-700',
            'green': 'bg-green-600 hover:bg-green-700',
            'red': 'bg-red-600 hover:bg-red-700',
            'yellow': 'bg-yellow-600 hover:bg-yellow-700',
            'indigo': 'bg-indigo-600 hover:bg-indigo-700',
            'pink': 'bg-pink-600 hover:bg-pink-700',
            'cyan': 'bg-cyan-600 hover:bg-cyan-700',
            'teal': 'bg-teal-600 hover:bg-teal-700',
            'orange': 'bg-orange-600 hover:bg-orange-700'
        };
        return colorMap[color] || 'bg-blue-600 hover:bg-blue-700';
    };

    const getBadgeColorClasses = (color: string) => {
        const colorMap: Record<string, string> = {
            'rose': 'text-rose-600 bg-rose-50 border-rose-100',
            'amber': 'text-amber-600 bg-amber-50 border-amber-100',
            'emerald': 'text-emerald-600 bg-emerald-50 border-emerald-100',
            'blue': 'text-blue-600 bg-blue-50 border-blue-100',
            'purple': 'text-purple-600 bg-purple-50 border-purple-100',
            'green': 'text-green-600 bg-green-50 border-green-100',
            'red': 'text-red-600 bg-red-50 border-red-100',
            'yellow': 'text-yellow-600 bg-yellow-50 border-yellow-100',
            'indigo': 'text-indigo-600 bg-indigo-50 border-indigo-100',
            'pink': 'text-pink-600 bg-pink-50 border-pink-100',
            'cyan': 'text-cyan-600 bg-cyan-50 border-cyan-100',
            'teal': 'text-teal-600 bg-teal-50 border-teal-100',
            'orange': 'text-orange-600 bg-orange-50 border-orange-100'
        };
        return colorMap[color] || 'text-blue-600 bg-blue-50 border-blue-100';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">

                <div className="flex items-center justify-between px-8 py-4 border-b border-slate-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${getBgColorClass(typeColor)} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                            {currentTaskTypeInfo?.svgPath ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d={currentTaskTypeInfo.svgPath} />
                                </svg>
                            ) : (
                                <span className="text-lg">{currentTaskTypeInfo?.icon || '📋'}</span>
                            )}
                        </div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">
                            {task.type === 'Shooting' ? 'Параметры съемки' :
                             task.type === 'Meeting' ? 'Параметры встречи' :
                             task.type === 'Call' ? 'Параметры звонка' :
                             currentTaskTypeInfo?.label || 'Параметры задачи'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-900 transition-all bg-slate-50 rounded-xl">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        <div className="lg:col-span-7 space-y-6">
                            <div className="grid grid-cols-5 gap-3">
                                {staticTaskTypes.map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                            setTask({
                                                ...task,
                                                type: t.id as TaskType,
                                                serviceId: undefined
                                            });
                                            setShowServiceDropdown(false);
                                        }}
                                        className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                                            task.type === t.id
                                                ? `${getBgColorClass(t.color)} ${getBorderColorClass(t.color)} text-white shadow-xl scale-[1.02]`
                                                : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d={t.svgPath} />
                                        </svg>
                                        <span className="text-[9px] font-black tracking-widest uppercase truncate w-full px-1">{t.label}</span>
                                    </button>
                                ))}

                                <div className="relative" ref={serviceDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowServiceDropdown(!showServiceDropdown)}
                                        className={`w-full py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 relative ${
                                            isServiceSelected
                                                ? `${getBgColorClass(typeColor)} ${getBorderColorClass(typeColor)} text-white shadow-xl scale-[1.02]`
                                                : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        {isServiceSelected ? (
                                            <span className="text-2xl">{currentTaskTypeInfo?.icon || '📋'}</span>
                                        ) : (
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        )}
                                        <span className="text-[9px] font-black tracking-widest uppercase truncate w-full px-1">
                                            {isServiceSelected ? (currentTaskTypeInfo?.label || 'УСЛУГА') : 'УСЛУГА'}
                                        </span>
                                        <svg className={`w-3 h-3 absolute bottom-2 right-2 transition-transform ${showServiceDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {showServiceDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                                            {dynamicTaskTypes.length > 0 ? (
                                                dynamicTaskTypes.map(service => (
                                                    <button
                                                        key={service.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setTask({
                                                                ...task,
                                                                type: service.name as TaskType,
                                                                serviceId: service.serviceId
                                                            });
                                                            setShowServiceDropdown(false);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-b-0"
                                                    >
                                                        <span className="text-2xl">{service.icon}</span>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-slate-700">{service.name}</p>
                                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{service.category}</p>
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-6 text-center text-sm text-slate-400">
                                                    Нет доступных услуг
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <input
                                    className="w-full text-2xl font-black text-slate-900 border-none focus:ring-0 p-0 placeholder-slate-200 bg-transparent outline-none tracking-tight"
                                    value={task.title}
                                    onChange={e => setTask({...task, title: e.target.value})}
                                    placeholder={task.type === 'Shooting' ? 'Название съемки...' :
                                                task.type === 'Meeting' ? 'Тема встречи...' :
                                                task.type === 'Call' ? 'Тема звонка...' :
                                                'Название задачи...'}
                                    autoFocus
                                />
                                <div className="h-px bg-slate-100 w-full opacity-50"></div>
                            </div>

                            {renderTypeSpecificFields()}
                        </div>

                        <div className="lg:col-span-5 space-y-4">
                            <div className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm space-y-6">

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Дата и время</h4>
                                        <div className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${getBadgeColorClasses(typeColor)}`}>
                                            {getDurationHoursText()}
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative">
                                        <div className="flex gap-1.5">
                                            <div className="relative flex-[2.5] group">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border border-transparent focus:border-blue-300 focus:bg-white rounded-xl pl-9 pr-2 py-2.5 text-xs font-black text-slate-700 outline-none transition-all"
                                                    value={dateInputValue}
                                                    onChange={e => handleTextDateInput(e.target.value)}
                                                    onFocus={() => setIsCalendarOpen(true)}
                                                    onBlur={() => {
                                                        const currentDate = new Date(task.startedAt || task.deadline || new Date());
                                                        setDateInputValue(currentDate.toLocaleDateString('ru-RU'));
                                                    }}
                                                    placeholder="ДД.ММ.ГГГГ"
                                                />
                                            </div>
                                            <button onClick={() => updateDate(new Date())} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${new Date(task.startedAt || task.deadline || '').toDateString() === new Date().toDateString() ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>Сегодня</button>
                                            <button onClick={() => { const d = new Date(); d.setDate(d.getDate()+1); updateDate(d); }} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${new Date(task.startedAt || task.deadline || '').toDateString() === new Date(Date.now() + 86400000).toDateString() ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>Завтра</button>
                                        </div>

                                        {isCalendarOpen && (
                                            <div ref={calendarRef} className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 z-[120] p-4 animate-fade-in-up">
                                                <div className="flex items-center justify-between mb-3">
                                                    <button onClick={() => changeCalendarMonth(-1)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                                                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
                                                    </button>
                                                    <span className="text-xs font-black text-slate-700">{getMonthYearText()}</span>
                                                    <button onClick={() => changeCalendarMonth(1)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                                                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-7 gap-1">
                                                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <div key={d} className="text-[9px] font-black text-slate-400 text-center py-1">{d}</div>)}
                                                    {getCalendarDays().map((dayDate, i) => {
                                                        if (!dayDate) {
                                                            return <div key={`empty-${i}`} className="h-8" />;
                                                        }
                                                        const selectedDate = new Date(task.startedAt || task.deadline || '');
                                                        const isSelected = dayDate.getDate() === selectedDate.getDate() &&
                                                                         dayDate.getMonth() === selectedDate.getMonth() &&
                                                                         dayDate.getFullYear() === selectedDate.getFullYear();
                                                        const isToday = dayDate.toDateString() === new Date().toDateString();
                                                        return (
                                                            <button
                                                                key={i}
                                                                onClick={() => updateDate(dayDate)}
                                                                className={`h-8 rounded-lg text-[10px] font-black transition-all ${
                                                                    isSelected ? 'bg-blue-600 text-white shadow-md' :
                                                                    isToday ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                                                                    'hover:bg-slate-50 text-slate-600'
                                                                }`}
                                                            >
                                                                {dayDate.getDate()}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                            <div className="text-center">
                                                <span className="block text-[8px] font-black text-slate-300 uppercase mb-1">Начало</span>
                                                <input
                                                    type="time"
                                                    value={task.startedAt ? new Date(task.startedAt).toTimeString().slice(0,5) : (task.deadline ? new Date(task.deadline).toTimeString().slice(0,5) : '')}
                                                    onChange={e => {
                                                        const [h, m] = e.target.value.split(':').map(Number);
                                                        const d = new Date(task.startedAt || task.deadline || new Date());
                                                        d.setHours(h, m, 0, 0);
                                                        setTask({...task, startedAt: d.toISOString()});
                                                    }}
                                                    className="text-xl font-black text-slate-900 bg-transparent border-none outline-none text-center w-28"
                                                />
                                            </div>
                                            <svg className="w-6 h-6 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                            <div className="text-center">
                                                <span className="block text-[8px] font-black text-slate-300 uppercase mb-1">Конец</span>
                                                <input
                                                    type="time"
                                                    value={task.deadline ? new Date(task.deadline).toTimeString().slice(0,5) : ''}
                                                    onChange={e => {
                                                        const [h, m] = e.target.value.split(':').map(Number);
                                                        const d = new Date(task.deadline || task.startedAt || new Date());
                                                        d.setHours(h, m, 0, 0);
                                                        setTask({...task, deadline: d.toISOString()});
                                                    }}
                                                    className={`text-xl font-black text-${typeColor}-600 bg-transparent border-none outline-none text-center w-28`}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            {[10, 14, 18].map(h => (
                                                <button key={h} onClick={() => setQuickTime(h)} className="py-2 bg-white border border-slate-100 hover:border-blue-400 rounded-xl text-[10px] font-black text-slate-600 transition-all">{h}:00</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Проект</h4>
                                    <select
                                        value={task.projectId || ''}
                                        onChange={e => {
                                            setTask({...task, projectId: e.target.value, stage_level2_id: undefined});
                                            setSelectedLevel1StageId('');
                                        }}
                                        className="w-full bg-slate-50 border border-transparent focus:border-blue-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all"
                                    >
                                        <option value="">Без проекта</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {task.projectId && level1Stages.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Этап 1 уровня</h4>
                                        <select
                                            value={selectedLevel1StageId}
                                            onChange={e => {
                                                setSelectedLevel1StageId(e.target.value);
                                                setTask({...task, stage_level2_id: undefined});
                                            }}
                                            className="w-full bg-slate-50 border border-transparent focus:border-blue-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all"
                                        >
                                            <option value="">Выберите этап</option>
                                            {level1Stages.map(stage => {
                                                const status = level1StageStatuses.find(s => s.level1StageId === stage.id);
                                                const statusLabel = status?.status === 'locked' ? '🔒' : status?.status === 'completed' ? '✓' : '▶';
                                                return (
                                                    <option key={stage.id} value={stage.id}>
                                                        {statusLabel} {stage.icon} {stage.name}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}

                                {task.projectId && selectedLevel1StageId && level2Stages.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Этап 2 уровня</h4>
                                        <select
                                            value={task.stage_level2_id || ''}
                                            onChange={e => setTask({...task, stage_level2_id: e.target.value})}
                                            className="w-full bg-slate-50 border border-transparent focus:border-blue-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all"
                                        >
                                            <option value="">Выберите этап</option>
                                            {level2Stages
                                                .filter(stage => stage.level1_stage_id === selectedLevel1StageId)
                                                .map(stage => (
                                                    <option key={stage.id} value={stage.id}>
                                                        {stage.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                )}

                                {task.creatorId && (
                                    <div className="space-y-1">
                                        <h4 className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Кто поставил задачу</h4>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {users.find(u => u.id === task.creatorId)?.name || 'Неизвестно'}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Роль</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {task.tags && task.tags.length > 0 ? (
                                            task.tags.map((tag, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold"
                                                >
                                                    {tag}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-sm text-slate-400 italic">Роль не указана</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Исполнитель</h4>
                                        {task.id && task.assigneeId && (
                                            <button
                                                type="button"
                                                onClick={() => setShowReassignModal(true)}
                                                className="text-[9px] font-bold text-blue-600 hover:text-blue-700 uppercase"
                                            >
                                                Переназначить
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={task.assigneeId || ''}
                                        onChange={e => setTask({...task, assigneeId: e.target.value})}
                                        className="w-full bg-slate-50 border border-transparent focus:border-blue-300 focus:bg-white rounded-xl px-4 py-3 text-base font-black text-slate-800 outline-none transition-all"
                                    >
                                        <option value="">Не назначен</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Статус</h4>
                                    <select
                                        value={task.status || TaskStatus.IN_PROGRESS}
                                        onChange={e => setTask({...task, status: e.target.value as TaskStatus})}
                                        className="w-full bg-slate-50 border border-transparent focus:border-blue-300 focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all"
                                    >
                                        <option value={TaskStatus.IN_PROGRESS}>В процессе</option>
                                        <option value={TaskStatus.REVIEW}>На проверку</option>
                                        <option value={TaskStatus.DONE}>Выполнено</option>
                                    </select>
                                </div>

                                {task.type === 'Task' && (
                                    <>
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Оценка времени (часы)</h4>
                                            <div className="flex gap-2">
                                                {[1, 2, 4, 8].map(h => (
                                                    <button
                                                        key={h}
                                                        type="button"
                                                        onClick={() => setTask({...task, estimatedHours: h})}
                                                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                                                            task.estimatedHours === h
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        {h}ч
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-1">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Бонус</h4>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-sm">T</div>
                                                <input
                                                    type="number"
                                                    className="w-full bg-slate-50/50 border border-transparent focus:border-emerald-300 focus:bg-white rounded-xl pl-10 pr-4 py-3 text-lg font-black text-slate-800 outline-none transition-all"
                                                    value={task.kpiValue || ''}
                                                    onChange={e => setTask({...task, kpiValue: Number(e.target.value)})}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {task.type === 'Shooting' && (
                                    <div className="space-y-3 pt-1">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Вознаграждение с бонусами за задачу</h4>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-sm">T</div>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-50/50 border border-transparent focus:border-emerald-300 focus:bg-white rounded-xl pl-10 pr-4 py-3 text-lg font-black text-slate-800 outline-none transition-all"
                                                value={task.kpiValue || ''}
                                                onChange={e => setTask({...task, kpiValue: Number(e.target.value)})}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleSave}
                                className={`w-full ${getButtonColorClasses(typeColor)} text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.01] transition-all active:scale-[0.98] flex items-center justify-center gap-4 group`}
                            >
                                <span>
                                    {task.type === 'Shooting' ? 'Запланировать съемку' :
                                     task.type === 'Meeting' ? 'Запланировать встречу' :
                                     task.type === 'Call' ? 'Запланировать звонок' :
                                     'Сохранить задачу'}
                                </span>
                                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showReassignModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-fade-in">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Переназначить задачу</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Новый исполнитель</label>
                                <select
                                    value={newAssigneeId}
                                    onChange={e => setNewAssigneeId(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                >
                                    <option value="">Выберите сотрудника</option>
                                    {users.filter(u => u.id !== task.assigneeId).map(u => (
                                        <option key={u.id} value={u.id}>{u.name} - {u.jobTitle}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Причина (опционально)</label>
                                <textarea
                                    value={reassignReason}
                                    onChange={e => setReassignReason(e.target.value)}
                                    placeholder="Почему переназначаете задачу..."
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowReassignModal(false); setReassignReason(''); setNewAssigneeId(''); }}
                                className="flex-1 px-4 py-3 text-slate-600 font-bold text-sm rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleReassign}
                                disabled={!newAssigneeId}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Переназначить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskModal;
