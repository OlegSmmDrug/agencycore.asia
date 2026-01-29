import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Project } from '../types';
import { INITIAL_JOB_TITLES } from '../constants';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Clock, Calendar, User as UserIcon } from 'lucide-react';

interface RoadmapEditorProps {
    project: Project;
    users: User[];
    onSave: (stages: any) => void;
    onSaveAndApply?: (stages: any) => void;
    initialStages?: any[];
    onStagesChange?: (stages: any) => void;
}

export const L1_METADATA = [
    { id: 'prep', label: 'Подготовка', color: 'border-blue-500', bg: 'bg-blue-50', accent: 'bg-blue-500', icon: '📋', defaultDays: 5 },
    { id: 'prod', label: 'Продакшн', color: 'border-amber-500', bg: 'bg-amber-50', accent: 'bg-amber-500', icon: '🎬', defaultDays: 10 },
    { id: 'launch', label: 'Запуск', color: 'border-emerald-500', bg: 'bg-emerald-50', accent: 'bg-emerald-500', icon: '🚀', defaultDays: 3 },
    { id: 'final', label: 'Финал', color: 'border-slate-500', bg: 'bg-slate-50', accent: 'bg-slate-500', icon: '🏁', defaultDays: 2 },
];

const RoadmapEditor: React.FC<RoadmapEditorProps> = ({ project, users, onSave, onSaveAndApply, initialStages, onStagesChange }) => {
    const [l1Stages, setL1Stages] = useState<any[]>(() => {
        if (initialStages && initialStages.length > 0) {
            return initialStages.map(s => ({ ...s, expanded: true }));
        }

        const today = new Date().toISOString().split('T')[0];
        return L1_METADATA.map(meta => ({
            ...meta,
            durationDays: meta.defaultDays,
            expanded: true,
            subStages: [
                {
                    id: `l2_${Date.now()}_${meta.id}`,
                    title: 'Рабочий спринт',
                    durationDays: Math.ceil(meta.defaultDays / 2),
                    tasks: [
                        {
                            id: `t_${Date.now()}_1`,
                            title: 'Стартовая задача',
                            role: 'Project Manager',
                            duration: 4,
                            durationUnit: 'hours'
                        }
                    ]
                }
            ]
        }));
    });

    const [expandedL2, setExpandedL2] = useState<Record<string, boolean>>({});
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (onStagesChange) {
            const timeoutId = setTimeout(() => {
                onStagesChange(l1Stages);
            }, 1000);

            return () => clearTimeout(timeoutId);
        }
    }, [l1Stages, onStagesChange]);

    const toggleL1 = (idx: number) => {
        const next = [...l1Stages];
        next[idx].expanded = !next[idx].expanded;
        setL1Stages(next);
    };

    const toggleL2 = (l2Id: string) => {
        setExpandedL2(prev => ({ ...prev, [l2Id]: !prev[l2Id] }));
    };

    const addL2 = (l1Idx: number) => {
        const next = [...l1Stages];
        const newId = `l2_${Date.now()}`;
        next[l1Idx].subStages.push({
            id: newId,
            title: 'Новый этап',
            durationDays: 2,
            tasks: []
        });
        setL1Stages(next);
        setExpandedL2(prev => ({ ...prev, [newId]: true }));
    };

    const removeL2 = (l1Idx: number, l2Idx: number) => {
        const next = [...l1Stages];
        next[l1Idx].subStages.splice(l2Idx, 1);
        setL1Stages(next);
    };

    const updateL2 = (l1Idx: number, l2Idx: number, updates: any) => {
        const next = [...l1Stages];
        next[l1Idx].subStages[l2Idx] = { ...next[l1Idx].subStages[l2Idx], ...updates };
        setL1Stages(next);
    };

    const addTask = (l1Idx: number, l2Idx: number) => {
        const next = [...l1Stages];
        next[l1Idx].subStages[l2Idx].tasks.push({
            id: `t_${Date.now()}_${Math.random()}`,
            title: '',
            role: 'SMM Специалист',
            duration: 4,
            durationUnit: 'hours'
        });
        setL1Stages(next);
    };

    const updateTask = (l1Idx: number, l2Idx: number, tIdx: number, updates: any) => {
        const next = [...l1Stages];
        next[l1Idx].subStages[l2Idx].tasks[tIdx] = { ...next[l1Idx].subStages[l2Idx].tasks[tIdx], ...updates };
        setL1Stages(next);
    };

    const removeTask = (l1Idx: number, l2Idx: number, tIdx: number) => {
        const next = [...l1Stages];
        next[l1Idx].subStages[l2Idx].tasks.splice(tIdx, 1);
        setL1Stages(next);
    };

    const totalTasks = useMemo(() => {
        return l1Stages.reduce((acc, s) =>
            acc + s.subStages.reduce((a2: number, l2: any) => a2 + (l2.tasks?.length || 0), 0), 0);
    }, [l1Stages]);

    return (
        <div className="space-y-4 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <p className="text-sm text-slate-500">Всего задач: <span className="font-bold text-slate-700">{totalTasks}</span></p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={() => onSave(l1Stages)}
                        className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Сохранить шаблон
                    </button>
                    {onSaveAndApply && (
                        <button
                            onClick={() => onSaveAndApply(l1Stages)}
                            className="w-full sm:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Применить к проекту
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {l1Stages.map((stage, l1Idx) => {
                    const taskCount = stage.subStages.reduce((a: number, l2: any) => a + (l2.tasks?.length || 0), 0);

                    return (
                        <div key={stage.id} className={`bg-white rounded-xl border-l-4 ${stage.color} shadow-sm overflow-hidden`}>
                            <button
                                onClick={() => toggleL1(l1Idx)}
                                className={`w-full px-4 py-3 ${stage.bg} flex items-center justify-between hover:bg-opacity-80 transition-colors`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{stage.icon}</span>
                                    <div className="text-left">
                                        <h3 className="font-bold text-slate-800">{stage.label}</h3>
                                        <p className="text-xs text-slate-500">
                                            {stage.subStages.length} этапов, {taskCount} задач
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`${stage.accent} text-white text-xs font-bold px-2 py-1 rounded`}>
                                        Фаза {l1Idx + 1}
                                    </span>
                                    {stage.expanded ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {stage.expanded && (
                                <div className="p-3 sm:p-4 space-y-3 bg-slate-50/50">
                                    {stage.subStages.map((l2: any, l2Idx: number) => {
                                        const isExpanded = expandedL2[l2.id] !== false;

                                        return (
                                            <div key={l2.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                <div
                                                    className="px-3 sm:px-4 py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                                                    onClick={() => toggleL2(l2.id)}
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0 hidden sm:block" />
                                                        <input
                                                            className="flex-1 min-w-0 bg-transparent font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
                                                            placeholder="Название этапа..."
                                                            value={l2.title}
                                                            onClick={e => e.stopPropagation()}
                                                            onChange={(e) => updateL2(l1Idx, l2Idx, { title: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium">
                                                            {l2.tasks?.length || 0} задач
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeL2(l1Idx, l2Idx);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        {isExpanded ? (
                                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                                        )}
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="px-3 sm:px-4 pb-4 space-y-2">
                                                        {l2.tasks && l2.tasks.length > 0 ? (
                                                            l2.tasks.map((task: any, tIdx: number) => (
                                                                <div
                                                                    key={task.id}
                                                                    className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                                                                >
                                                                    <div className="flex items-start gap-2 mb-3">
                                                                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                                                        <input
                                                                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                            placeholder="Название задачи..."
                                                                            value={task.title}
                                                                            onChange={(e) => updateTask(l1Idx, l2Idx, tIdx, { title: e.target.value })}
                                                                        />
                                                                        <button
                                                                            onClick={() => removeTask(l1Idx, l2Idx, tIdx)}
                                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>

                                                                    <div className="space-y-2 pl-4">
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                            <div>
                                                                                <label className="text-xs text-slate-500 mb-1 block">Должность</label>
                                                                                <select
                                                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                                    value={task.role}
                                                                                    onChange={(e) => updateTask(l1Idx, l2Idx, tIdx, { role: e.target.value })}
                                                                                >
                                                                                    {INITIAL_JOB_TITLES.map(role => (
                                                                                        <option key={role} value={role}>{role}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            <div>
                                                                                <label className="text-xs text-slate-500 mb-1 block">Длительность</label>
                                                                                <div className="flex gap-2">
                                                                                    <input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                                        value={task.duration || 1}
                                                                                        onChange={(e) => updateTask(l1Idx, l2Idx, tIdx, { duration: parseInt(e.target.value) || 1 })}
                                                                                    />
                                                                                    <select
                                                                                        className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                                        value={task.durationUnit || 'hours'}
                                                                                        onChange={(e) => updateTask(l1Idx, l2Idx, tIdx, { durationUnit: e.target.value })}
                                                                                    >
                                                                                        <option value="hours">часов</option>
                                                                                        <option value="days">дней</option>
                                                                                    </select>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-6 text-center text-slate-400 text-sm">
                                                                Нет задач. Добавьте первую задачу.
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={() => addTask(l1Idx, l2Idx)}
                                                            className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            Добавить задачу
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <button
                                        onClick={() => addL2(l1Idx)}
                                        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-white transition-colors font-medium flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Добавить этап
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                <button
                    onClick={() => onSave(l1Stages)}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Сохранить шаблон
                </button>
                {onSaveAndApply && (
                    <button
                        onClick={() => onSaveAndApply(l1Stages)}
                        className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Применить к проекту
                    </button>
                )}
            </div>
        </div>
    );
};

export default RoadmapEditor;
