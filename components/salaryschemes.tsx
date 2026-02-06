
import React, { useState, useEffect, useMemo } from 'react';
import { User, SalaryScheme, TaskType } from '../types';
import { INITIAL_JOB_TITLES } from '../constants';
import BonusRuleBuilder from './BonusRuleBuilder';
import { calculatorService } from '../services/calculatorService';
import { taskTypeService, DynamicTaskType, StaticTaskType } from '../services/taskTypeService';
import { calculatorCategoryHelper, CalculatorCategoryInfo } from '../services/calculatorCategoryHelper';
import { useNumberInput } from '../hooks/useNumberInput';
import UserAvatar from './UserAvatar';

interface SalarySchemesProps {
    users: User[];
    schemes: SalaryScheme[];
    onUpdateScheme: (scheme: SalaryScheme) => void;
    availableJobTitles?: string[];
}

const STATIC_TASK_TYPES: TaskType[] = ['Meeting', 'Task', 'Shooting', 'Call'];

interface KpiRuleInputProps {
    taskType: TaskType;
    initialValue: number;
    onUpdate: (type: TaskType, value: number) => void;
    label: string;
    icon?: string;
}

const KpiRuleInput: React.FC<KpiRuleInputProps> = ({ taskType, initialValue, onUpdate, label, icon }) => {
    const input = useNumberInput(
        initialValue,
        (value) => onUpdate(taskType, value),
        800
    );

    return (
        <div className="group">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">
                {icon && <span>{icon}</span>}
                <span>{label}</span>
            </label>
            <input
                type="number"
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-blue-600 focus:bg-white transition-all outline-none"
                {...input}
            />
        </div>
    );
};

const SalarySchemes: React.FC<SalarySchemesProps> = ({ users, schemes, onUpdateScheme, availableJobTitles = [] }) => {
    const jobTitles = availableJobTitles.length > 0 ? availableJobTitles : INITIAL_JOB_TITLES;
    const [selectedTab, setSelectedTab] = useState<'titles' | 'users'>('titles');
    const [activeTarget, setActiveTarget] = useState<string>(jobTitles[0]);
    const [dynamicTypes, setDynamicTypes] = useState<DynamicTaskType[]>([]);
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);
    const [categories, setCategories] = useState<CalculatorCategoryInfo[]>([]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

    const allTaskTypes = [...STATIC_TASK_TYPES, ...dynamicTypes.map(dt => dt.name as TaskType)];

    const foundScheme = schemes.find(s => s.targetId === activeTarget);

    const currentScheme = useMemo(() => {
        const baseScheme = foundScheme || {
            id: `sch_${activeTarget}`,
            targetId: activeTarget,
            targetType: selectedTab === 'titles' ? 'jobTitle' : 'user',
            baseSalary: 0,
            kpiRules: [],
            pmBonusPercent: 0
        };

        const existingRules = new Map(baseScheme.kpiRules.map(r => [r.taskType, r.value]));
        const syncedRules = allTaskTypes.map(t => ({
            taskType: t,
            value: existingRules.get(t) || 0
        }));

        return {
            ...baseScheme,
            kpiRules: syncedRules
        };
    }, [foundScheme, activeTarget, selectedTab, allTaskTypes]);

    useEffect(() => {
        const loadDynamicTypes = async () => {
            setIsLoadingTypes(true);
            try {
                const [types, cats] = await Promise.all([
                    taskTypeService.getDynamicTaskTypes(),
                    calculatorCategoryHelper.getAllCategories()
                ]);
                setDynamicTypes(types.filter(t => !t.isDeprecated));
                setCategories(cats);
            } catch (error) {
                console.error('Failed to load dynamic task types:', error);
            } finally {
                setIsLoadingTypes(false);
            }
        };

        loadDynamicTypes();

        const unsubscribe = taskTypeService.subscribeToTaskTypeChanges(() => {
            loadDynamicTypes();
        });

        return unsubscribe;
    }, []);

    const handleUpdate = (updates: Partial<SalaryScheme>) => {
        const schemeToUpdate: SalaryScheme = {
            ...(foundScheme || {
                id: `sch_${activeTarget}`,
                targetId: activeTarget,
                targetType: selectedTab === 'titles' ? 'jobTitle' : 'user',
                baseSalary: 0,
                kpiRules: [],
                pmBonusPercent: 0
            }),
            ...updates
        };
        console.log(`[Salary Scheme] Saving scheme for ${selectedTab}/${activeTarget}:`, schemeToUpdate);
        console.log(`[Salary Scheme] KPI Rules (${schemeToUpdate.kpiRules.length}):`, schemeToUpdate.kpiRules);
        onUpdateScheme(schemeToUpdate);
    };

    const baseSalaryInput = useNumberInput(
        currentScheme.baseSalary,
        (value) => handleUpdate({ baseSalary: value }),
        800
    );

    const updateKpiRule = (type: TaskType, val: number) => {
        const sanitizedValue = isNaN(val) ? 0 : val;
        const baseRules = foundScheme?.kpiRules || [];
        const newRules = [...baseRules];
        const idx = newRules.findIndex(r => r.taskType === type);
        if (idx > -1) {
            if (sanitizedValue === 0) {
                newRules.splice(idx, 1);
            } else {
                newRules[idx].value = sanitizedValue;
            }
        } else if (sanitizedValue > 0) {
            newRules.push({ taskType: type, value: sanitizedValue });
        }
        console.log(`[Salary Scheme] Updated rule ${type}: ${sanitizedValue}, total rules: ${newRules.length}`);
        handleUpdate({ kpiRules: newRules });
    };

    return (
        <div className="flex h-full bg-white animate-fade-in relative">
            {mobileSidebarOpen && (
              <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
            )}
            <div className={`
              fixed inset-y-0 left-0 z-40 w-72 md:static md:z-auto
              border-r border-slate-100 flex flex-col shrink-0 bg-white
              transition-transform duration-200 ease-in-out
              ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-4 flex bg-slate-50 border-b border-slate-100">
                    <button
                        onClick={() => { setSelectedTab('titles'); setActiveTarget(jobTitles[0]); }}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${selectedTab === 'titles' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >
                        Должности
                    </button>
                    <button 
                        onClick={() => { setSelectedTab('users'); setActiveTarget(users[0]?.id); }}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${selectedTab === 'users' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >
                        Сотрудники
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {selectedTab === 'titles' ? (
                        jobTitles.map(t => (
                            <button
                                key={t}
                                onClick={() => { setActiveTarget(t); setMobileSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTarget === t ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                                {t}
                            </button>
                        ))
                    ) : (
                        users.map(u => (
                            <button
                                key={u.id}
                                onClick={() => { setActiveTarget(u.id); setMobileSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${activeTarget === u.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                                <UserAvatar src={u.avatar} name={u.name} size="sm" />
                                <span className="truncate">{u.name}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-50/30">
                <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
                    <div className="flex items-center gap-3">
                        <button
                          onClick={() => setMobileSidebarOpen(true)}
                          className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <div>
                            <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight uppercase">Схема: {activeTarget}</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase mt-1">Настройка правил начислений</p>
                        </div>
                    </div>

                    <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm space-y-6 md:space-y-8">
                        {/* Base Fix */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Базовая ставка (Fix)</h3>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 md:px-6 py-3 md:py-4 text-xl md:text-2xl font-black text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    {...baseSalaryInput}
                                />
                                <span className="text-xl font-black text-slate-300">₸</span>
                            </div>
                        </div>

                        {/* KPI Task Rules */}
                        <div className="space-y-6 pt-6 border-t border-slate-50">
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Сдельная оплата за KPI (₸)</h3>
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        <span className="font-bold">Автоматическая оплата:</span> При завершении задачи система автоматически начислит оплату исполнителю согласно установленной ставке. Количество часов берется из поля "Оценка времени" в задаче.
                                    </p>
                                </div>
                            </div>

                            {isLoadingTypes ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Служебные типы */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Служебные задачи</h4>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {STATIC_TASK_TYPES.map(type => (
                                                <KpiRuleInput
                                                    key={type}
                                                    taskType={type}
                                                    initialValue={currentScheme.kpiRules.find(r => r.taskType === type)?.value || 0}
                                                    onUpdate={updateKpiRule}
                                                    label={type}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Динамические типы по категориям */}
                                    {categories.map(category => {
                                        const categoryTypes = dynamicTypes.filter(dt => dt.category === category.id);
                                        if (categoryTypes.length === 0) return null;

                                        return (
                                            <div key={category.id} className="space-y-4 pt-4 border-t border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                        <span>{category.icon}</span>
                                                        <span>{category.name}</span>
                                                    </h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {categoryTypes.map(dt => (
                                                        <KpiRuleInput
                                                            key={dt.id}
                                                            taskType={dt.name as TaskType}
                                                            initialValue={currentScheme.kpiRules.find(r => r.taskType === dt.name)?.value || 0}
                                                            onUpdate={updateKpiRule}
                                                            label={dt.name}
                                                            icon={dt.icon}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        {/* Bonus Rules Builder */}
                        <div className="pt-6 border-t border-slate-50">
                            <BonusRuleBuilder
                                ownerId={activeTarget}
                                ownerType={selectedTab === 'titles' ? 'jobTitle' : 'user'}
                                ownerLabel={selectedTab === 'titles' ? activeTarget : users.find(u => u.id === activeTarget)?.name || ''}
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex gap-4 items-start">
                        <span className="text-2xl">💡</span>
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            Если настроена схема для конкретного сотрудника, она имеет приоритет над должностной схемой. 
                            Автоматический расчет в ведомости будет использовать эти значения.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalarySchemes;
