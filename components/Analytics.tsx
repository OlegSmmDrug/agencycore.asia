import React, { useState, useMemo, useEffect } from 'react';
import {
    ComposedChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Line
} from 'recharts';
import { Client, User, Task, Project, Transaction, ProjectStatus, ClientStatus, TaskStatus, ProjectFinancials } from '../types';
import FinancialModel from './FinancialModel';
import TransactionJournal from './TransactionJournal';
import FinanceTab from './analytics/FinanceTab';
import OverviewTab from './analytics/OverviewTab';
import SalesTab from './analytics/SalesTab';
import TeamTab from './analytics/TeamTab';
import { supabase } from '../lib/supabase';

interface AnalyticsProps {
    clients: Client[];
    users: User[];
    tasks: Task[];
    projects: Project[];
    transactions: Transaction[];
    pnlData?: Record<string, ProjectFinancials>;
    activeTab?: string;
    onUpdatePnl?: (id: string, d: ProjectFinancials) => void;
    onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'isVerified'>) => void;
    onCreateClient?: (client: { name: string; company: string; bin: string }) => Promise<Client>;
    onReconcile?: (existingId: string, bankData: { amount: number; clientName: string; bin: string; docNumber: string }) => Promise<void>;
    currentUser: User;
}

const UI = {
    CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
    LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
    VALUE: "text-2xl font-black text-slate-900 tracking-tighter"
};

const Analytics: React.FC<AnalyticsProps> = ({
    clients = [],
    users = [],
    tasks = [],
    projects = [],
    transactions = [],
    activeTab: externalTab,
    onAddTransaction,
    onCreateClient,
    onReconcile,
    currentUser
}) => {
    const initialTab = useMemo(() => {
        if (externalTab === 'pnl') return 'finance';
        if (externalTab === 'sales_analytics') return 'sales';
        if (externalTab === 'unit_economics') return 'unit';
        if (externalTab === 'team_performance') return 'team';
        if (externalTab === 'financial_model') return 'finmodel';
        if (externalTab === 'payments') return 'payments';
        return 'overview';
    }, [externalTab]);

    const [activeTab, setActiveTab] = useState<'overview' | 'finance' | 'sales' | 'unit' | 'team' | 'finmodel' | 'payments'>(initialTab);

    useEffect(() => {
        if (!externalTab) return;
        if (externalTab === 'pnl') setActiveTab('finance');
        else if (externalTab === 'sales_analytics') setActiveTab('sales');
        else if (externalTab === 'unit_economics') setActiveTab('unit');
        else if (externalTab === 'team_performance') setActiveTab('team');
        else if (externalTab === 'financial_model') setActiveTab('finmodel');
        else if (externalTab === 'payments') setActiveTab('payments');
    }, [externalTab]);

    const [projectExpensesData, setProjectExpensesData] = useState<Record<string, any>>({});
    const [prevMonthExpensesData, setPrevMonthExpensesData] = useState<Record<string, any>>({});
    const [loadingExpenses, setLoadingExpenses] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

    const navigateMonth = (direction: 'prev' | 'next') => {
        const date = new Date(selectedMonth + '-01');
        date.setMonth(date.getMonth() + (direction === 'prev' ? -1 : 1));
        setSelectedMonth(date.toISOString().slice(0, 7));
    };

    const getPreviousMonth = (month: string): string => {
        const date = new Date(month + '-01');
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().slice(0, 7);
    };

    useEffect(() => {
        const loadProjectExpenses = async () => {
            const prevMonth = getPreviousMonth(selectedMonth);
            const activeProjects = projects.filter(p =>
                p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED
            );

            if (activeProjects.length === 0) { setLoadingExpenses(false); return; }

            setLoadingExpenses(true);
            const expensesMap: Record<string, any> = {};
            const prevExpensesMap: Record<string, any> = {};

            for (const project of activeProjects) {
                try {
                    const { data: currentData } = await supabase
                        .from('project_expenses').select('*')
                        .eq('project_id', project.id).eq('month', selectedMonth).maybeSingle();

                    const { data: prevData } = await supabase
                        .from('project_expenses').select('*')
                        .eq('project_id', project.id).eq('month', prevMonth).maybeSingle();

                    if (currentData) {
                        const dynamicExpenses = currentData.dynamic_expenses || {};
                        const categoryBreakdown: Record<string, number> = {
                            smm: 0, video: 0, target: 0, sites: 0,
                            fot: Number(currentData.fot_expenses) || 0,
                            models: Number(currentData.models_expenses) || 0,
                            other: Number(currentData.other_expenses) || 0
                        };

                        for (const key in dynamicExpenses) {
                            const item = dynamicExpenses[key];
                            const category = item.category || 'other';
                            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + (item.cost || 0);
                        }

                        if (Object.keys(dynamicExpenses).length === 0) {
                            categoryBreakdown.smm = Number(currentData.smm_expenses) || 0;
                            categoryBreakdown.video = Number(currentData.production_expenses) || 0;
                            categoryBreakdown.target = Number(currentData.targetologist_expenses) || 0;
                        }

                        expensesMap[project.id] = {
                            month: currentData.month, revenue: Number(currentData.revenue) || 0,
                            expenses: Number(currentData.total_expenses) || 0,
                            margin: Number(currentData.margin_percent) || 0, categoryBreakdown, hasData: true
                        };
                    } else {
                        const est = (project.budget || 0) * 0.55;
                        expensesMap[project.id] = {
                            month: selectedMonth, revenue: project.budget || 0, expenses: est,
                            margin: project.budget > 0 ? ((project.budget - est) / project.budget) * 100 : 0,
                            categoryBreakdown: {}, hasData: false, isEstimated: true
                        };
                    }

                    if (prevData) {
                        prevExpensesMap[project.id] = {
                            revenue: Number(prevData.revenue) || 0,
                            expenses: Number(prevData.total_expenses) || 0,
                            margin: Number(prevData.margin_percent) || 0
                        };
                    }

                    setProjectExpensesData(prev => ({ ...prev, [project.id]: expensesMap[project.id] }));
                    if (prevExpensesMap[project.id]) {
                        setPrevMonthExpensesData(prev => ({ ...prev, [project.id]: prevExpensesMap[project.id] }));
                    }
                } catch (error) {
                    console.error('Error loading expenses for project:', project.id, error);
                }
            }
            setLoadingExpenses(false);
        };

        if (projects.length > 0) loadProjectExpenses();
        else setLoadingExpenses(false);
    }, [projects, selectedMonth]);

    const unitData = useMemo(() => {
        const activeProjects = projects.filter(p =>
            p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED
        );

        const serviceTypes = ['SMM', 'Таргет', 'Комплекс', 'Сайты'];
        const profitabilityByService = serviceTypes.map(s => {
            const serviceProjects = s === 'Комплекс'
                ? activeProjects.filter(p => p.services && p.services.length > 1)
                : activeProjects.filter(p => p.services && p.services.length === 1 && p.services[0] === s);

            let totalRev = 0, totalExp = 0;
            serviceProjects.forEach(p => {
                const ed = projectExpensesData[p.id];
                if (ed) { totalRev += ed.revenue || 0; totalExp += ed.expenses || 0; }
            });

            return { name: s, revenue: totalRev, expenses: totalExp, margin: totalRev > 0 ? ((totalRev - totalExp) / totalRev) * 100 : 0 };
        });

        const projectList = activeProjects.map(p => {
            const ed = projectExpensesData[p.id];
            const prevEd = prevMonthExpensesData[p.id];
            const rev = ed?.revenue || p.budget || 0;
            const exp = ed?.expenses || ((p.budget || 0) * 0.55);
            const margin = ed?.margin || (rev > 0 ? ((rev - exp) / rev) * 100 : 0);
            const prevMargin = prevEd?.margin || 0;
            const marginChange = prevMargin > 0 ? margin - prevMargin : 0;

            return {
                id: p.id, name: p.name, revenue: rev, expenses: exp, profit: rev - exp,
                margin, categoryBreakdown: ed?.categoryBreakdown || {}, month: ed?.month || selectedMonth,
                isEstimated: ed?.isEstimated || false, hasData: ed?.hasData || false,
                marginChange, hasComparison: prevEd && prevEd.margin > 0
            };
        }).sort((a, b) => b.profit - a.profit);

        const totalCurrentRevenue = projectList.reduce((s, p) => s + p.revenue, 0);
        const totalCurrentExpenses = projectList.reduce((s, p) => s + p.expenses, 0);
        const totalCurrentMargin = totalCurrentRevenue > 0 ? ((totalCurrentRevenue - totalCurrentExpenses) / totalCurrentRevenue) * 100 : 0;

        const totalPrevRevenue = activeProjects.reduce((s, p) => s + (prevMonthExpensesData[p.id]?.revenue || 0), 0);
        const totalPrevExpenses = activeProjects.reduce((s, p) => s + (prevMonthExpensesData[p.id]?.expenses || 0), 0);
        const totalPrevMargin = totalPrevRevenue > 0 ? ((totalPrevRevenue - totalPrevExpenses) / totalPrevRevenue) * 100 : 0;
        const overallMarginChange = totalPrevMargin > 0 ? totalCurrentMargin - totalPrevMargin : 0;

        return { profitabilityByService, projectList, totalCurrentRevenue, totalCurrentExpenses, totalCurrentMargin, overallMarginChange, hasOverallComparison: totalPrevMargin > 0 };
    }, [projects, projectExpensesData, prevMonthExpensesData, selectedMonth]);

    const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

    return (
        <div className="flex flex-col h-full bg-[#FBFBFF] overflow-hidden">
            <div className="p-4 md:p-8 shrink-0 pb-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Терминал данных</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Analytical Intelligence Terminal v4.2</p>
                    </div>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full xl:w-auto overflow-x-auto hide-scrollbar border border-slate-200">
                        {[
                            { id: 'overview', label: 'Сводка' },
                            { id: 'finance', label: 'Финансы (P&L)' },
                            { id: 'finmodel', label: 'Фин. модель' },
                            { id: 'payments', label: 'Журнал платежей' },
                            { id: 'sales', label: 'Продажи' },
                            { id: 'unit', label: 'Юнит-экономика' },
                            { id: 'team', label: 'Команда и HR' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:px-8 pb-20">
                {activeTab === 'overview' ? (
                    <OverviewTab
                        clients={clients} users={users} tasks={tasks} projects={projects}
                        transactions={transactions} unitProjectList={unitData.projectList}
                    />
                ) : activeTab === 'finmodel' ? (
                    <div className="h-full rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-white">
                        <FinancialModel transactions={transactions} clients={clients} projects={projects} />
                    </div>
                ) : activeTab === 'payments' ? (
                    <div className="h-full rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-white">
                        {onAddTransaction ? (
                            <TransactionJournal
                                transactions={transactions} clients={clients} projects={projects}
                                users={users} onAddTransaction={onAddTransaction}
                                onCreateClient={onCreateClient} onReconcile={onReconcile}
                            />
                        ) : (
                            <div className="p-8 text-center text-slate-500">Функция добавления платежей недоступна</div>
                        )}
                    </div>
                ) : activeTab === 'finance' ? (
                    <FinanceTab transactions={transactions} projects={projects} />
                ) : activeTab === 'sales' ? (
                    <SalesTab clients={clients} users={users} transactions={transactions} />
                ) : activeTab === 'unit' ? (
                    <UnitEconomicsSection
                        unitData={unitData} selectedMonth={selectedMonth} navigateMonth={navigateMonth}
                        loadingExpenses={loadingExpenses} projectExpensesData={projectExpensesData} fmt={fmt}
                    />
                ) : (
                    <TeamTab users={users} tasks={tasks} projects={projects} transactions={transactions} />
                )}
            </div>
        </div>
    );
};

interface UnitSectionProps {
    unitData: any;
    selectedMonth: string;
    navigateMonth: (dir: 'prev' | 'next') => void;
    loadingExpenses: boolean;
    projectExpensesData: Record<string, any>;
    fmt: (v: number) => string;
}

const UnitEconomicsSection: React.FC<UnitSectionProps> = ({
    unitData, selectedMonth, navigateMonth, loadingExpenses, projectExpensesData, fmt
}) => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-2xl font-black text-slate-900">Юнит-экономика</h3>
                <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                    Анализ рентабельности по проектам -- {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                </p>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-center min-w-[140px]">
                    <div className="text-sm font-black text-slate-900">{new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long' })}</div>
                    <div className="text-xs text-slate-500 font-bold">{new Date(selectedMonth + '-01').getFullYear()}</div>
                </div>
                <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>

        {unitData.hasOverallComparison && (
            <div className={`bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm border-l-4 ${
                Math.abs(unitData.overallMarginChange) < 2 ? 'border-l-blue-500 bg-blue-50' :
                unitData.overallMarginChange > 0 ? 'border-l-emerald-500 bg-emerald-50' : 'border-l-rose-500 bg-rose-50'
            }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-black text-slate-900 text-sm">Сравнение с прошлым месяцем</div>
                        <div className={`text-xs font-bold ${
                            Math.abs(unitData.overallMarginChange) < 2 ? 'text-blue-700' :
                            unitData.overallMarginChange > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                            {Math.abs(unitData.overallMarginChange) < 2
                                ? `Маржинальность стабильна (${unitData.overallMarginChange > 0 ? '+' : ''}${unitData.overallMarginChange.toFixed(1)}%)`
                                : unitData.overallMarginChange > 0
                                    ? `Маржинальность выше на ${unitData.overallMarginChange.toFixed(1)}%`
                                    : `Маржинальность ниже на ${Math.abs(unitData.overallMarginChange).toFixed(1)}%`}
                        </div>
                    </div>
                    <div className={`text-2xl font-black ${
                        Math.abs(unitData.overallMarginChange) < 2 ? 'text-blue-600' :
                        unitData.overallMarginChange > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                        {unitData.overallMarginChange > 0 ? '+' : ''}{unitData.overallMarginChange.toFixed(1)}%
                    </div>
                </div>
            </div>
        )}

        {loadingExpenses ? (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-slate-600 font-semibold">Загрузка...</span>
                </div>
            </div>
        ) : (
            <>
                {unitData.profitabilityByService.some((s: any) => s.revenue > 0) && (
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="font-black text-xs uppercase tracking-widest mb-10 text-slate-900 flex items-center gap-2">
                            <div className="w-1 h-4 bg-blue-600 rounded-full" /> Рентабельность услуг
                        </h3>
                        <div className="h-[380px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={unitData.profitabilityByService}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#3b82f6', fontSize: 10 }} unit="%" />
                                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                    <Bar yAxisId="left" dataKey="revenue" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={70} name="Выручка" />
                                    <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#3b82f6" strokeWidth={4} dot={{ r: 8, fill: '#3b82f6', strokeWidth: 3, stroke: '#fff' }} name="Маржа %" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900 flex items-center gap-2">
                        <div className="w-1 h-4 bg-emerald-600 rounded-full" /> Детальная сводка по проектам
                    </h3>
                    {unitData.projectList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {unitData.projectList.map((proj: any, index: number) => {
                                const catBreakdown = proj.categoryBreakdown || {};
                                const hasBreakdown = Object.keys(catBreakdown).length > 0;

                                return (
                                    <div key={proj.id} className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all flex flex-col h-full">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                                                    index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                                                }`}>{index + 1}</div>
                                                {proj.isEstimated && (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded">Оценка</span>
                                                )}
                                            </div>
                                            <div className={`text-2xl font-black ${proj.margin >= 30 ? 'text-emerald-600' : proj.margin >= 15 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                {proj.margin.toFixed(1)}%
                                            </div>
                                        </div>
                                        <h4 className="font-black text-slate-900 text-sm mb-1 line-clamp-2">{proj.name}</h4>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">
                                            {new Date(proj.month + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                                        </p>
                                        {proj.hasComparison && (
                                            <div className={`text-[9px] font-bold mb-3 flex items-center gap-1 px-2 py-1 rounded ${
                                                Math.abs(proj.marginChange) < 2 ? 'bg-blue-50 text-blue-600' :
                                                proj.marginChange > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                                {Math.abs(proj.marginChange) < 2 ? 'Стабильно' : proj.marginChange > 0 ? `+${proj.marginChange.toFixed(1)}%` : `${proj.marginChange.toFixed(1)}%`}
                                            </div>
                                        )}
                                        <div className="space-y-2 mb-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Выручка</span>
                                                <span className="text-sm font-black text-blue-600">{(proj.revenue / 1000).toFixed(0)}k &#8376;</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Расходы</span>
                                                <span className="text-sm font-black text-rose-600">{(proj.expenses / 1000).toFixed(0)}k &#8376;</span>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Прибыль</span>
                                                <span className={`text-base font-black ${proj.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {(proj.profit / 1000).toFixed(0)}k &#8376;
                                                </span>
                                            </div>
                                        </div>
                                        {hasBreakdown && (
                                            <div className="mt-auto">
                                                <div className="text-[8px] text-slate-500 font-bold uppercase mb-2">Структура</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {catBreakdown.smm > 0 && <CatBadge label="SMM" value={catBreakdown.smm} color="blue" />}
                                                    {catBreakdown.video > 0 && <CatBadge label="Продакшн" value={catBreakdown.video} color="teal" />}
                                                    {catBreakdown.target > 0 && <CatBadge label="Таргет" value={catBreakdown.target} color="orange" />}
                                                    {catBreakdown.fot > 0 && <CatBadge label="ФОТ" value={catBreakdown.fot} color="emerald" />}
                                                    {catBreakdown.models > 0 && <CatBadge label="Модели" value={catBreakdown.models} color="pink" />}
                                                    {catBreakdown.other > 0 && <CatBadge label="Прочие" value={catBreakdown.other} color="slate" />}
                                                </div>
                                            </div>
                                        )}
                                        <div className="mt-3 pt-2 border-t border-slate-100">
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${proj.margin >= 30 ? 'bg-emerald-500' : proj.margin >= 15 ? 'bg-blue-500' : 'bg-rose-500'}`}
                                                    style={{ width: `${Math.min(100, proj.margin)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-slate-400 text-sm">Нет данных по проектам</p>
                        </div>
                    )}
                </div>
            </>
        )}
    </div>
);

const CatBadge = ({ label, value, color }: { label: string; value: number; color: string }) => {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        teal: 'bg-teal-50 border-teal-100 text-teal-600',
        orange: 'bg-orange-50 border-orange-100 text-orange-600',
        emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
        pink: 'bg-pink-50 border-pink-100 text-pink-600',
        slate: 'bg-slate-50 border-slate-100 text-slate-600',
    };
    const cls = colorMap[color] || colorMap.slate;
    return (
        <div className={`border rounded px-2 py-1.5 ${cls}`}>
            <div className="text-[7px] font-bold uppercase">{label}</div>
            <div className="text-xs font-black">{(value / 1000).toFixed(0)}k</div>
        </div>
    );
};

export default Analytics;
