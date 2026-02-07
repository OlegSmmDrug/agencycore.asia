
import React, { useState, useMemo, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend, ComposedChart
} from 'recharts';
import { Client, User, Task, Project, Transaction, ProjectStatus, ClientStatus, SystemRole, ProjectFinancials } from '../types';
import FinancialModel from './FinancialModel';
import TransactionJournal from './TransactionJournal';
import FinanceTab from './analytics/FinanceTab';
import { supabase } from '../lib/supabase';
import UserAvatar from './UserAvatar';

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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
    // Initialize tab from prop if possible to avoid empty initial render
    const initialTab = useMemo(() => {
        if (externalTab === 'pnl') return 'finance';
        if (externalTab === 'sales_analytics') return 'sales';
        if (externalTab === 'unit_economics') return 'unit';
        if (externalTab === 'team_performance') return 'team';
        if (externalTab === 'financial_model') return 'finmodel';
        if (externalTab === 'payments') return 'payments';
        return 'finance';
    }, [externalTab]);

    const [activeTab, setActiveTab] = useState<'finance' | 'sales' | 'unit' | 'team' | 'finmodel' | 'payments'>(initialTab);

    useEffect(() => {
        if (!externalTab) return;
        if (externalTab === 'pnl') setActiveTab('finance');
        else if (externalTab === 'sales_analytics') setActiveTab('sales');
        else if (externalTab === 'unit_economics') setActiveTab('unit');
        else if (externalTab === 'team_performance') setActiveTab('team');
        else if (externalTab === 'financial_model') setActiveTab('finmodel');
        else if (externalTab === 'payments') setActiveTab('payments');
    }, [externalTab]);

    // --- 1. FINANCE CALCULATIONS (P&L) - Now handled by FinanceTab component ---
    const financeData = useMemo(() => {
        const safeTrans = Array.isArray(transactions) ? transactions : [];
        const income = safeTrans.filter(t => t.amount > 0).reduce((acc, t) => acc + (t.amount || 0), 0);
        return { income };
    }, [transactions]);

    // --- 2. SALES CALCULATIONS ---
    const salesData = useMemo(() => {
        const funnel = [
            { name: 'Лиды', value: clients.length, fill: '#3b82f6' },
            { name: 'Встречи', value: Math.floor(clients.length * 0.62), fill: '#60a5fa' },
            { name: 'Договоры', value: clients.filter(c => [ClientStatus.CONTRACT, ClientStatus.IN_WORK, ClientStatus.WON].includes(c.status)).length, fill: '#10b981' },
        ];

        const marketingAgencyCost = Math.abs(transactions.filter(t => t.category === 'Marketing').reduce((acc, t) => acc + (t.amount || 0), 0));
        const wonCount = clients.filter(c => c.status === ClientStatus.WON).length || 1;
        const cac = marketingAgencyCost / wonCount;

        const managerPerformance = users
            .filter(u => u.jobTitle && (u.jobTitle.toLowerCase().includes('sales') || u.jobTitle === 'CEO'))
            .map(u => ({
                name: u.name,
                revenue: clients.filter(c => c.managerId === u.id && c.status === ClientStatus.WON).reduce((acc, c) => acc + (c.budget || 0), 0),
                leads: clients.filter(c => c.managerId === u.id).length,
                won: clients.filter(c => c.managerId === u.id && c.status === ClientStatus.WON).length,
            }))
            .map(m => ({
                ...m,
                conversion: m.leads > 0 ? (m.won / m.leads) * 100 : 0,
                avgCheck: m.won > 0 ? m.revenue / m.won : 0
            }))
            .sort((a, b) => b.revenue - a.revenue);

        return { funnel, managerPerformance, cac };
    }, [clients, users, transactions]);

    // --- 3. UNIT ECONOMICS (REAL DATA) ---
    const [projectExpensesData, setProjectExpensesData] = useState<Record<string, any>>({});
    const [prevMonthExpensesData, setPrevMonthExpensesData] = useState<Record<string, any>>({});
    const [loadingExpenses, setLoadingExpenses] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

    const navigateMonth = (direction: 'prev' | 'next') => {
        const date = new Date(selectedMonth + '-01');
        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
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
                p.status !== ProjectStatus.COMPLETED &&
                p.status !== ProjectStatus.ARCHIVED
            );

            if (activeProjects.length === 0) {
                setLoadingExpenses(false);
                return;
            }

            setLoadingExpenses(true);
            const expensesMap: Record<string, any> = {};
            const prevExpensesMap: Record<string, any> = {};

            for (const project of activeProjects) {
                try {
                    const { data: currentData, error: currentError } = await supabase
                        .from('project_expenses')
                        .select('*')
                        .eq('project_id', project.id)
                        .eq('month', selectedMonth)
                        .maybeSingle();

                    const { data: prevData, error: prevError } = await supabase
                        .from('project_expenses')
                        .select('*')
                        .eq('project_id', project.id)
                        .eq('month', prevMonth)
                        .maybeSingle();

                    if (!currentError && currentData) {
                        const dynamicExpenses = currentData.dynamic_expenses || {};

                        const categoryBreakdown: Record<string, number> = {
                            smm: 0,
                            video: 0,
                            target: 0,
                            sites: 0,
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
                            month: currentData.month,
                            revenue: Number(currentData.revenue) || 0,
                            expenses: Number(currentData.total_expenses) || 0,
                            margin: Number(currentData.margin_percent) || 0,
                            categoryBreakdown,
                            hasData: true
                        };
                    } else {
                        const estimatedExpenses = (project.budget || 0) * 0.55;
                        expensesMap[project.id] = {
                            month: selectedMonth,
                            revenue: project.budget || 0,
                            expenses: estimatedExpenses,
                            margin: project.budget > 0 ? ((project.budget - estimatedExpenses) / project.budget) * 100 : 0,
                            categoryBreakdown: {},
                            hasData: false,
                            isEstimated: true
                        };
                    }

                    if (!prevError && prevData) {
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

        if (projects.length > 0) {
            loadProjectExpenses();
        } else {
            setLoadingExpenses(false);
        }
    }, [projects, selectedMonth]);

    const unitData = useMemo(() => {
        const activeProjects = projects.filter(p =>
            p.status !== ProjectStatus.COMPLETED &&
            p.status !== ProjectStatus.ARCHIVED
        );

        const serviceTypes = ['SMM', 'Таргет', 'Комплекс', 'Сайты'];
        const profitabilityByService = serviceTypes.map(s => {
            let serviceProjects;

            if (s === 'Комплекс') {
                serviceProjects = activeProjects.filter(p =>
                    p.services && p.services.length > 1
                );
            } else {
                serviceProjects = activeProjects.filter(p =>
                    p.services &&
                    p.services.length === 1 &&
                    p.services[0] === s
                );
            }

            let totalRev = 0;
            let totalExp = 0;

            serviceProjects.forEach(p => {
                const expData = projectExpensesData[p.id];
                if (expData) {
                    totalRev += expData.revenue || 0;
                    totalExp += expData.expenses || 0;
                }
            });

            return {
                name: s,
                revenue: totalRev,
                expenses: totalExp,
                margin: totalRev > 0 ? ((totalRev - totalExp) / totalRev) * 100 : 0
            };
        });

        const projectList = activeProjects.map(p => {
            const expData = projectExpensesData[p.id];
            const prevExpData = prevMonthExpensesData[p.id];

            const rev = expData?.revenue || p.budget || 0;
            const exp = expData?.expenses || ((p.budget || 0) * 0.55);
            const margin = expData?.margin || (rev > 0 ? ((rev - exp) / rev) * 100 : 0);

            const prevMargin = prevExpData?.margin || 0;
            const marginChange = prevMargin > 0 ? margin - prevMargin : 0;
            const hasComparison = prevExpData && prevExpData.margin > 0;

            return {
                id: p.id,
                name: p.name,
                revenue: rev,
                expenses: exp,
                profit: rev - exp,
                margin: margin,
                categoryBreakdown: expData?.categoryBreakdown || {},
                month: expData?.month || selectedMonth,
                isEstimated: expData?.isEstimated || false,
                hasData: expData?.hasData || false,
                marginChange,
                hasComparison
            };
        }).sort((a, b) => b.profit - a.profit);

        const totalCurrentRevenue = projectList.reduce((sum, p) => sum + p.revenue, 0);
        const totalCurrentExpenses = projectList.reduce((sum, p) => sum + p.expenses, 0);
        const totalCurrentMargin = totalCurrentRevenue > 0 ? ((totalCurrentRevenue - totalCurrentExpenses) / totalCurrentRevenue) * 100 : 0;

        const totalPrevRevenue = activeProjects.reduce((sum, p) => {
            const prevData = prevMonthExpensesData[p.id];
            return sum + (prevData?.revenue || 0);
        }, 0);
        const totalPrevExpenses = activeProjects.reduce((sum, p) => {
            const prevData = prevMonthExpensesData[p.id];
            return sum + (prevData?.expenses || 0);
        }, 0);
        const totalPrevMargin = totalPrevRevenue > 0 ? ((totalPrevRevenue - totalPrevExpenses) / totalPrevRevenue) * 100 : 0;

        const overallMarginChange = totalPrevMargin > 0 ? totalCurrentMargin - totalPrevMargin : 0;
        const hasOverallComparison = totalPrevMargin > 0;

        return {
            profitabilityByService,
            projectList,
            totalCurrentRevenue,
            totalCurrentExpenses,
            totalCurrentMargin,
            overallMarginChange,
            hasOverallComparison
        };
    }, [projects, projectExpensesData, prevMonthExpensesData, selectedMonth]);

    // --- 4. TEAM PERFORMANCE ---
    const teamData = useMemo(() => {
        const revPerEmployee = financeData.income / (users.length || 1);
        
        const workload = users.map(u => {
            const activeProjects = projects.filter(p => p.teamIds && p.teamIds.includes(u.id) && p.status !== ProjectStatus.COMPLETED);
            return {
                name: u.name,
                count: activeProjects.length,
                avatar: u.avatar,
                role: u.jobTitle
            };
        }).sort((a, b) => b.count - a.count);

        return { revPerEmployee, workload };
    }, [users, projects, financeData.income]);

    const UI = {
        CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
        LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
        VALUE: "text-2xl font-black text-slate-900 tracking-tighter"
    };

    return (
        <div className="flex flex-col h-full bg-[#FBFBFF] overflow-hidden">
            {/* Top Navigation Bar (Common for all Analytics) */}
            <div className="p-4 md:p-8 shrink-0 pb-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Терминал данных</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Analytical Intelligence Terminal v4.2</p>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full xl:w-auto overflow-x-auto hide-scrollbar border border-slate-200">
                        {[
                            { id: 'finance', label: '💰 Финансы (P&L)' },
                            { id: 'finmodel', label: '📊 Фин. модель' },
                            { id: 'payments', label: '💳 Журнал платежей' },
                            { id: 'sales', label: '📈 Продажи' },
                            { id: 'unit', label: '🧬 Юнит-экономика' },
                            { id: 'team', label: '👥 Команда и HR' }
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

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:px-8 pb-20">
                {activeTab === 'finmodel' ? (
                    <div className="h-full rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-white">
                        <FinancialModel transactions={transactions} clients={clients} />
                    </div>
                ) : activeTab === 'payments' ? (
                    <div className="h-full rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-white">
                        {onAddTransaction ? (
                            <TransactionJournal
                                transactions={transactions}
                                clients={clients}
                                projects={projects}
                                users={users}
                                onAddTransaction={onAddTransaction}
                                onCreateClient={onCreateClient}
                                onReconcile={onReconcile}
                            />
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                Функция добавления платежей недоступна
                            </div>
                        )}
                    </div>
                ) : activeTab === 'finance' ? (
                    <FinanceTab transactions={transactions} projects={projects} />
                ) : activeTab === 'sales' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                            <div className={`${UI.CARD} xl:col-span-4`}>
                                <h3 className="font-black text-xs uppercase tracking-widest mb-10 text-slate-900">Воронка продаж</h3>
                                <div className="space-y-10">
                                    {salesData.funnel.map((step, i) => (
                                        <div key={i} className="relative">
                                            <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase mb-3">
                                                <span>{step.name}</span>
                                                <span className="text-slate-900">{step.value}</span>
                                            </div>
                                            <div className="h-6 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                <div 
                                                    className="h-full rounded-full transition-all duration-1000 shadow-inner" 
                                                    style={{ width: `${salesData.funnel[0].value > 0 ? (step.value / salesData.funnel[0].value) * 100 : 0}%`, backgroundColor: step.fill }}
                                                ></div>
                                            </div>
                                            {i < salesData.funnel.length - 1 && step.value > 0 && (
                                                <div className="absolute left-1/2 -bottom-7 -translate-x-1/2 flex items-center gap-1.5 text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-100">
                                                    <span>↓</span> {Math.round((salesData.funnel[i+1].value / step.value) * 100)}% к-сия
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={`${UI.CARD} xl:col-span-8`}>
                                <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900">Эффективность менеджеров продаж</h3>
                                {salesData.managerPerformance.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <tr>
                                                    <th className="pb-5 px-4 text-center">#</th>
                                                    <th className="pb-5">Менеджер</th>
                                                    <th className="pb-5 text-right">Выручка</th>
                                                    <th className="pb-5 text-right">Конверсия</th>
                                                    <th className="pb-5 text-right">Ср. чек</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {salesData.managerPerformance.map((m, i) => (
                                                    <tr key={i} className="group hover:bg-slate-50/50 transition-all">
                                                        <td className="py-5 px-4 text-center">
                                                            <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black ${i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{i+1}</span>
                                                        </td>
                                                        <td className="py-5 font-black text-slate-800 text-sm">{m.name}</td>
                                                        <td className="py-5 text-right font-black text-slate-900">{m.revenue.toLocaleString()} ₸</td>
                                                        <td className="py-5 text-right">
                                                            <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${m.conversion > 20 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                {m.conversion.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td className="py-5 text-right text-slate-500 font-mono text-sm">{Math.round(m.avgCheck).toLocaleString()} ₸</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <p className="text-slate-400 text-sm">Нет данных по менеджерам продаж</p>
                                        <p className="text-slate-300 text-xs mt-2">Добавьте сотрудников с должностью "Sales" или "CEO"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'unit' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">Юнит-экономика</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                                    Анализ рентабельности по проектам • {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigateMonth('prev')}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                >
                                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <div className="text-center min-w-[140px]">
                                    <div className="text-sm font-black text-slate-900">
                                        {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long' })}
                                    </div>
                                    <div className="text-xs text-slate-500 font-bold">
                                        {new Date(selectedMonth + '-01').getFullYear()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigateMonth('next')}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                >
                                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {unitData.hasOverallComparison && (
                            <div className={`${UI.CARD} border-l-4 ${
                                Math.abs(unitData.overallMarginChange) < 2 ? 'border-l-blue-500 bg-blue-50' :
                                unitData.overallMarginChange > 0 ? 'border-l-emerald-500 bg-emerald-50' :
                                'border-l-rose-500 bg-rose-50'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            Math.abs(unitData.overallMarginChange) < 2 ? 'bg-blue-100' :
                                            unitData.overallMarginChange > 0 ? 'bg-emerald-100' :
                                            'bg-rose-100'
                                        }`}>
                                            {Math.abs(unitData.overallMarginChange) < 2 ? '📊' :
                                             unitData.overallMarginChange > 0 ? '📈' : '📉'}
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 text-sm">Сравнение с прошлым месяцем</div>
                                            <div className={`text-xs font-bold ${
                                                Math.abs(unitData.overallMarginChange) < 2 ? 'text-blue-700' :
                                                unitData.overallMarginChange > 0 ? 'text-emerald-700' :
                                                'text-rose-700'
                                            }`}>
                                                {Math.abs(unitData.overallMarginChange) < 2 ? (
                                                    `Маржинальность стабильна (${unitData.overallMarginChange > 0 ? '+' : ''}${unitData.overallMarginChange.toFixed(1)}%)`
                                                ) : unitData.overallMarginChange > 0 ? (
                                                    `Маржинальность выше на ${unitData.overallMarginChange.toFixed(1)}% по сравнению с прошлым месяцем`
                                                ) : (
                                                    `Маржинальность ниже на ${Math.abs(unitData.overallMarginChange).toFixed(1)}% по сравнению с прошлым месяцем`
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-2xl font-black ${
                                            Math.abs(unitData.overallMarginChange) < 2 ? 'text-blue-600' :
                                            unitData.overallMarginChange > 0 ? 'text-emerald-600' :
                                            'text-rose-600'
                                        }`}>
                                            {unitData.overallMarginChange > 0 ? '+' : ''}{unitData.overallMarginChange.toFixed(1)}%
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase">Изменение</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingExpenses ? (
                            <div className={UI.CARD}>
                                <div className="flex items-center justify-center py-12">
                                    <div className="flex items-center gap-3">
                                        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="text-slate-600 font-semibold">Загрузка данных за {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}...</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={UI.CARD}>
                                    <h3 className="font-black text-xs uppercase tracking-widest mb-10 text-slate-900 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-indigo-600 rounded-full"></div> Рентабельность услуг (Маржа по нишам)
                                    </h3>
                                    {unitData.profitabilityByService.some(s => s.revenue > 0) ? (
                                        <div className="h-[380px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={unitData.profitabilityByService}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#3b82f6', fontSize: 10}} unit="%" />
                                                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                                    <Bar yAxisId="left" dataKey="revenue" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={70} name="Выручка" />
                                                    <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#3b82f6" strokeWidth={4} dot={{r: 8, fill: '#3b82f6', strokeWidth: 3, stroke: '#fff'}} name="Маржа %" />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <p className="text-slate-400 text-sm">Нет данных по проектам</p>
                                            <p className="text-slate-300 text-xs mt-2">Добавьте проекты с указанием услуг и бюджета</p>
                                        </div>
                                    )}
                                </div>

                                <div className={UI.CARD}>
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                            <div className="w-1 h-4 bg-emerald-600 rounded-full"></div> Детальная сводка по проектам
                                        </h3>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                <span>Реальные данные</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                                <span>Оценка</span>
                                            </div>
                                        </div>
                                    </div>

                                    {unitData.projectList.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {unitData.projectList.map((proj, index) => {
                                                const catBreakdown = proj.categoryBreakdown || {};
                                                const hasBreakdown = Object.keys(catBreakdown).length > 0;
                                                const isLoaded = projectExpensesData[proj.id] !== undefined;

                                                if (!isLoaded && loadingExpenses) {
                                                    return (
                                                        <div key={proj.id} className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-4 animate-pulse">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="w-7 h-7 rounded-lg bg-slate-200"></div>
                                                                <div className="w-16 h-8 bg-slate-200 rounded"></div>
                                                            </div>
                                                            <div className="w-3/4 h-4 bg-slate-200 rounded mb-2"></div>
                                                            <div className="w-1/2 h-3 bg-slate-100 rounded mb-4"></div>
                                                            <div className="space-y-2">
                                                                <div className="w-full h-6 bg-slate-100 rounded"></div>
                                                                <div className="w-full h-6 bg-slate-100 rounded"></div>
                                                                <div className="w-full h-6 bg-slate-100 rounded"></div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={proj.id} className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all flex flex-col h-full">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                                                                    index === 0 ? 'bg-amber-100 text-amber-600' :
                                                                    index === 1 ? 'bg-slate-200 text-slate-600' :
                                                                    index === 2 ? 'bg-orange-100 text-orange-600' :
                                                                    'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    {index + 1}
                                                                </div>
                                                                {proj.isEstimated && (
                                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded">
                                                                        Оценка
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className={`text-2xl font-black ${proj.margin >= 30 ? 'text-emerald-600' : proj.margin >= 15 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                                {proj.margin.toFixed(1)}%
                                                            </div>
                                                        </div>

                                                        <h4 className="font-black text-slate-900 text-sm mb-1 line-clamp-2">
                                                            {proj.name}
                                                        </h4>
                                                        <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">
                                                            {new Date(proj.month + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                                                        </p>

                                                        {proj.hasComparison && (
                                                            <div className={`text-[9px] font-bold mb-3 flex items-center gap-1 px-2 py-1 rounded ${
                                                                Math.abs(proj.marginChange) < 2 ? 'bg-blue-50 text-blue-600' :
                                                                proj.marginChange > 0 ? 'bg-emerald-50 text-emerald-600' :
                                                                'bg-rose-50 text-rose-600'
                                                            }`}>
                                                                {Math.abs(proj.marginChange) < 2 ? '→' :
                                                                 proj.marginChange > 0 ? '↑' : '↓'}
                                                                {Math.abs(proj.marginChange) < 2 ? (
                                                                    'Стабильно'
                                                                ) : proj.marginChange > 0 ? (
                                                                    `+${proj.marginChange.toFixed(1)}%`
                                                                ) : (
                                                                    `${proj.marginChange.toFixed(1)}%`
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="space-y-2 mb-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Выручка</span>
                                                                <span className="text-sm font-black text-blue-600">{(proj.revenue / 1000).toFixed(0)}k ₸</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Расходы</span>
                                                                <span className="text-sm font-black text-rose-600">{(proj.expenses / 1000).toFixed(0)}k ₸</span>
                                                            </div>
                                                            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Прибыль</span>
                                                                <span className={`text-base font-black ${proj.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                    {(proj.profit / 1000).toFixed(0)}k ₸
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {hasBreakdown && (
                                                            <div className="mt-auto">
                                                                <div className="text-[8px] text-slate-500 font-bold uppercase mb-2">Структура</div>
                                                                <div className="grid grid-cols-2 gap-1.5">
                                                                    {catBreakdown.smm > 0 && (
                                                                        <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                                                                            <div className="text-[7px] text-blue-600 font-bold uppercase">SMM</div>
                                                                            <div className="text-xs font-black text-blue-700">{(catBreakdown.smm / 1000).toFixed(0)}k</div>
                                                                        </div>
                                                                    )}
                                                                    {catBreakdown.video > 0 && (
                                                                        <div className="bg-purple-50 border border-purple-100 rounded px-2 py-1.5">
                                                                            <div className="text-[7px] text-purple-600 font-bold uppercase">Продакшн</div>
                                                                            <div className="text-xs font-black text-purple-700">{(catBreakdown.video / 1000).toFixed(0)}k</div>
                                                                        </div>
                                                                    )}
                                                                    {catBreakdown.target > 0 && (
                                                                        <div className="bg-orange-50 border border-orange-100 rounded px-2 py-1.5">
                                                                            <div className="text-[7px] text-orange-600 font-bold uppercase">Таргет</div>
                                                                            <div className="text-xs font-black text-orange-700">{(catBreakdown.target / 1000).toFixed(0)}k</div>
                                                                        </div>
                                                                    )}
                                                                    {catBreakdown.fot > 0 && (
                                                                        <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5">
                                                                            <div className="text-[7px] text-emerald-600 font-bold uppercase">ФОТ</div>
                                                                            <div className="text-xs font-black text-emerald-700">{(catBreakdown.fot / 1000).toFixed(0)}k</div>
                                                                        </div>
                                                                    )}
                                                                    {catBreakdown.models > 0 && (
                                                                        <div className="bg-pink-50 border border-pink-100 rounded px-2 py-1.5">
                                                                            <div className="text-[7px] text-pink-600 font-bold uppercase">Модели</div>
                                                                            <div className="text-xs font-black text-pink-700">{(catBreakdown.models / 1000).toFixed(0)}k</div>
                                                                        </div>
                                                                    )}
                                                                    {catBreakdown.other > 0 && (
                                                                        <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5">
                                                                            <div className="text-[7px] text-slate-600 font-bold uppercase">Прочие</div>
                                                                            <div className="text-xs font-black text-slate-700">{(catBreakdown.other / 1000).toFixed(0)}k</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="mt-3 pt-2 border-t border-slate-100">
                                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${
                                                                        proj.margin >= 30 ? 'bg-emerald-500' :
                                                                        proj.margin >= 15 ? 'bg-blue-500' :
                                                                        'bg-rose-500'
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, proj.margin)}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <p className="text-slate-400 text-sm">Нет данных по проектам</p>
                                            <p className="text-slate-300 text-xs mt-2">Добавьте проекты для анализа</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className={UI.CARD}>
                            <h3 className="font-black text-xs uppercase tracking-widest mb-10 text-slate-900 flex items-center gap-2">
                                <div className="w-1 h-4 bg-rose-500 rounded-full"></div> Загрузка и Риск выгорания (Burnout Monitor)
                            </h3>
                            {teamData.workload.length > 0 ? (
                                <div className="space-y-8">
                                    {teamData.workload.map((u, i) => (
                                    <div key={i} className="group">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar src={u.avatar} name={u.name} size="md" className="rounded-xl" />
                                                <div>
                                                    <span className="font-black text-slate-800 text-sm">{u.name}</span>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{u.role || 'Сотрудник'}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-lg font-black uppercase text-[9px] ${u.count >= 7 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                {u.count} Проектов {u.count >= 7 ? '🔴 Критично' : '🟢 Оптимально'}
                                            </span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${u.count >= 7 ? 'bg-gradient-to-r from-rose-500 to-orange-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-blue-500'}`}
                                                style={{ width: `${Math.min(100, (u.count / 8) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-400 text-sm">Нет данных по сотрудникам</p>
                                    <p className="text-slate-300 text-xs mt-2">Добавьте сотрудников в систему</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Analytics;
