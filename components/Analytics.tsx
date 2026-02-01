
import React, { useState, useMemo, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend, ComposedChart
} from 'recharts';
import { Client, User, Task, Project, Transaction, ProjectStatus, ClientStatus, SystemRole, ProjectFinancials } from '../types';
import FinancialModel from './FinancialModel';
import TransactionJournal from './TransactionJournal';
import { UnifiedAnalyticsDashboard } from './UnifiedAnalyticsDashboard';

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
    currentUser
}) => {
    // Initialize tab from prop if possible to avoid empty initial render
    const initialTab = useMemo(() => {
        if (externalTab === 'unified_analytics') return 'unified';
        if (externalTab === 'pnl') return 'finance';
        if (externalTab === 'sales_analytics') return 'sales';
        if (externalTab === 'unit_economics') return 'unit';
        if (externalTab === 'team_performance') return 'team';
        if (externalTab === 'financial_model') return 'finmodel';
        if (externalTab === 'payments') return 'payments';
        return 'unified';
    }, [externalTab]);

    const [activeTab, setActiveTab] = useState<'unified' | 'finance' | 'sales' | 'unit' | 'team' | 'finmodel' | 'payments'>(initialTab);

    useEffect(() => {
        if (!externalTab) return;
        if (externalTab === 'unified_analytics') setActiveTab('unified');
        else if (externalTab === 'pnl') setActiveTab('finance');
        else if (externalTab === 'sales_analytics') setActiveTab('sales');
        else if (externalTab === 'unit_economics') setActiveTab('unit');
        else if (externalTab === 'team_performance') setActiveTab('team');
        else if (externalTab === 'financial_model') setActiveTab('finmodel');
        else if (externalTab === 'payments') setActiveTab('payments');
    }, [externalTab]);

    // --- 1. FINANCE CALCULATIONS (P&L) ---
    const financeData = useMemo(() => {
        const safeTrans = Array.isArray(transactions) ? transactions : [];
        const income = safeTrans.filter(t => t.amount > 0).reduce((acc, t) => acc + (t.amount || 0), 0);
        const salaries = Math.abs(safeTrans.filter(t => t.category === 'Salary').reduce((acc, t) => acc + (t.amount || 0), 0));
        const marketing = Math.abs(safeTrans.filter(t => t.category === 'Marketing').reduce((acc, t) => acc + (t.amount || 0), 0));
        const office = Math.abs(safeTrans.filter(t => t.category === 'Office').reduce((acc, t) => acc + (t.amount || 0), 0));
        const other = Math.abs(safeTrans.filter(t => t.category === 'Other').reduce((acc, t) => acc + (t.amount || 0), 0));
        
        const totalExpenses = salaries + marketing + office + other;
        const ebitda = income - totalExpenses;
        const margin = income > 0 ? (ebitda / income) * 100 : 0;
        const netProfit = ebitda * 0.85; 

        const expenseStructure = [
            { name: 'ФОТ (Зарплаты)', value: salaries },
            { name: 'Маркетинг агентства', value: marketing },
            { name: 'Офис и ПО', value: office },
            { name: 'Прочее', value: other },
        ];

        const planFact = [
            { name: 'Выручка', план: income * 1.15, факт: income },
            { name: 'Чистая прибыль', план: income * 0.3, факт: netProfit },
        ];

        return { income, ebitda, margin, netProfit, expenseStructure, planFact };
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

    // --- 3. UNIT ECONOMICS ---
    const unitData = useMemo(() => {
        const serviceTypes = ['SMM', 'Таргет', 'Комплекс', 'Сайты'];
        const profitabilityByService = serviceTypes.map(s => {
            const serviceProjects = projects.filter(p => p.services && p.services.includes(s));
            const rev = serviceProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
            const exp = serviceProjects.reduce((acc, p) => acc + ((p.budget || 0) * 0.6), 0); 
            return {
                name: s,
                revenue: rev,
                margin: rev > 0 ? ((rev - exp) / rev) * 100 : 0
            };
        });

        const projectList = projects.map(p => {
            const rev = p.budget || 0;
            const exp = rev * 0.55; 
            return {
                name: p.name,
                revenue: rev,
                expenses: exp,
                profit: rev - exp,
                margin: rev > 0 ? ((rev - exp) / rev) * 100 : 0
            };
        }).sort((a, b) => b.profit - a.profit);

        return { profitabilityByService, projectList };
    }, [projects]);

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
                            { id: 'unified', label: '📊 Унифицированная' },
                            { id: 'finance', label: '💰 Финансы (P&L)' },
                            { id: 'finmodel', label: '📈 Фин. модель' },
                            { id: 'payments', label: '💳 Журнал платежей' },
                            { id: 'sales', label: '🎯 Продажи' },
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
                {activeTab === 'unified' ? (
                    <UnifiedAnalyticsDashboard />
                ) : activeTab === 'finmodel' ? (
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
                            />
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                Функция добавления платежей недоступна
                            </div>
                        )}
                    </div>
                ) : activeTab === 'finance' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className={UI.CARD}>
                                <p className={UI.LABEL}>Выручка (Начислено)</p>
                                <p className={UI.VALUE}>{financeData.income.toLocaleString()} ₸</p>
                                <div className="mt-2 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span className="text-[10px] text-emerald-600 font-black">↑ 14% к плану</span>
                                </div>
                            </div>
                            <div className={UI.CARD}>
                                <p className={UI.LABEL}>EBITDA</p>
                                <p className="text-2xl font-black text-blue-600 tracking-tighter">{financeData.ebitda.toLocaleString()} ₸</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Опер. прибыль</p>
                            </div>
                            <div className={UI.CARD}>
                                <p className={UI.LABEL}>Рентабельность %</p>
                                <p className={`text-2xl font-black tracking-tighter ${financeData.margin > 20 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {financeData.margin.toFixed(1)}%
                                </p>
                                <div className="w-full bg-slate-100 h-1 rounded-full mt-3">
                                    <div className="h-full bg-blue-500 rounded-full" style={{width: `${Math.min(100, financeData.margin)}%`}}></div>
                                </div>
                            </div>
                            <div className={UI.CARD}>
                                <p className={UI.LABEL}>Чистая прибыль (К выводу)</p>
                                <p className="text-2xl font-black text-emerald-600 tracking-tighter">{Math.round(financeData.netProfit).toLocaleString()} ₸</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">После налогов</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className={UI.CARD}>
                                <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div> Выполнение фин. плана
                                </h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={financeData.planFact} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                            <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase'}} />
                                            <Bar dataKey="план" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={50} />
                                            <Bar dataKey="факт" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={UI.CARD}>
                                <h3 className="font-black text-xs uppercase tracking-widest mb-8 text-slate-900 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-emerald-500 rounded-full"></div> Структура расходов
                                </h3>
                                <div className="h-[350px] w-full flex flex-col md:flex-row items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={financeData.expenseStructure} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                                                {financeData.expenseStructure.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="w-full md:w-80 space-y-5 px-4">
                                        {financeData.expenseStructure.map((item, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                                                        <span className="text-[11px] text-slate-600 font-bold uppercase">{item.name}</span>
                                                    </div>
                                                    <span className="font-black text-slate-900 text-xs">{financeData.income > 0 ? Math.round(item.value / financeData.income * 100) : 0}%</span>
                                                </div>
                                                <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                                                    <div className="h-full transition-all duration-1000" style={{backgroundColor: COLORS[i % COLORS.length], width: `${financeData.income > 0 ? (item.value / financeData.income) * 100 : 0}%`}}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
                                                {u.avatar ? (
                                                    <img src={u.avatar} className="w-8 h-8 rounded-xl object-cover" alt="" onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }} />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
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
