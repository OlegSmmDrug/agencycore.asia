import React, { useState, useEffect, useMemo } from 'react';
import { User, Task, Project, PayrollRecord, SalaryScheme } from '../types';
import PayrollBoard from './payrollboard';
import UserModal from './UserModal';
import SalarySchemes from './salaryschemes';
import UserAvatar from './UserAvatar';
import ConfirmDialog from './ConfirmDialog';
import Modal from './Modal';
import { useOrganization } from './OrganizationProvider';
import { planLimitsService } from '../services/planLimitsService';

interface TeamManagementProps {
    users: User[];
    tasks: Task[];
    projects?: Project[];
    currentUser: User;
    activeTab?: string;
    onUpdateUser: (updatedUser: User) => void;
    onDeleteUser?: (userId: string) => void;
    availableJobTitles?: string[];
    onAddJobTitle?: (title: string) => void;
    payrollRecords?: PayrollRecord[];
    onUpdatePayrollRecord?: (record: PayrollRecord) => void;
    onPayPayroll?: (record: PayrollRecord) => void;
    salarySchemes?: SalaryScheme[];
    onUpdateSalaryScheme?: (scheme: SalaryScheme) => void;
}

type SortField = 'name' | 'month' | 'total' | 'paidAt';
type SortDir = 'asc' | 'desc';

const TeamManagement: React.FC<TeamManagementProps> = ({
    users = [], tasks = [], projects = [], currentUser, activeTab, onUpdateUser, onDeleteUser,
    availableJobTitles = [], onAddJobTitle, payrollRecords = [], onUpdatePayrollRecord, onPayPayroll,
    salarySchemes = [], onUpdateSalaryScheme
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'members' | 'calc' | 'history' | 'schemes'>('members');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const { organization } = useOrganization();

    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [planLimitWarning, setPlanLimitWarning] = useState('');

    const [historyMonthFilter, setHistoryMonthFilter] = useState<string>('all');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'FROZEN' | 'PAID'>('all');
    const [historySortField, setHistorySortField] = useState<SortField>('paidAt');
    const [historySortDir, setHistorySortDir] = useState<SortDir>('desc');
    const [historyDrillDown, setHistoryDrillDown] = useState<PayrollRecord | null>(null);

    const handleOpenNewUser = async () => {
        const planName = organization?.plan_name || 'Free';
        const check = await planLimitsService.checkUsersLimit(planName);
        if (!check.allowed) {
            setPlanLimitWarning(`Лимит пользователей исчерпан (${check.current}/${check.limit}). Перейдите на более высокий тариф для добавления сотрудников.`);
            return;
        }
        setEditingUser(null);
        setIsUserModalOpen(true);
    };

    const isCeo = currentUser.jobTitle === 'CEO';

    const getDaysUntilBirthday = (birthday?: string): { text: string; isToday: boolean; days: number } | null => {
        if (!birthday) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const birth = new Date(birthday + 'T00:00:00');
        let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        next.setHours(0, 0, 0, 0);

        const diffMs = next.getTime() - today.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return { text: 'Сегодня!', isToday: true, days: 0 };
        if (diffDays < 0) {
            const nextYear = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
            nextYear.setHours(0, 0, 0, 0);
            const d = Math.round((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return { text: `${d} дн.`, isToday: false, days: d };
        }
        return { text: `${diffDays} дн.`, isToday: false, days: diffDays };
    };

    const formatBirthdayShort = (birthday?: string): string | null => {
        if (!birthday) return null;
        const d = new Date(birthday + 'T00:00:00');
        const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    useEffect(() => {
        if (activeTab === 'payroll') setActiveSubTab('calc');
        else if (activeTab === 'team') setActiveSubTab('members');
    }, [activeTab]);

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const calcTotal = (r: PayrollRecord) =>
        (r.fixSalary || 0) + (r.calculatedKpi || 0) + (r.manualBonus || 0) - (r.manualPenalty || 0) - (r.advance || 0);

    const historyRecords = useMemo(() => {
        let records = (payrollRecords || []).filter(r => r.status === 'FROZEN' || r.status === 'PAID');

        if (historyStatusFilter !== 'all') {
            records = records.filter(r => r.status === historyStatusFilter);
        }

        if (historyMonthFilter !== 'all') {
            records = records.filter(r => r.month === historyMonthFilter);
        }

        if (searchQuery && activeSubTab === 'history') {
            const q = searchQuery.toLowerCase();
            records = records.filter(r => {
                const u = users.find(x => x.id === r.userId);
                return u?.name.toLowerCase().includes(q) || u?.jobTitle.toLowerCase().includes(q);
            });
        }

        records.sort((a, b) => {
            let cmp = 0;
            switch (historySortField) {
                case 'name': {
                    const nameA = users.find(u => u.id === a.userId)?.name || '';
                    const nameB = users.find(u => u.id === b.userId)?.name || '';
                    cmp = nameA.localeCompare(nameB);
                    break;
                }
                case 'month':
                    cmp = a.month.localeCompare(b.month);
                    break;
                case 'total':
                    cmp = calcTotal(a) - calcTotal(b);
                    break;
                case 'paidAt':
                    cmp = (a.paidAt || a.month || '').localeCompare(b.paidAt || b.month || '');
                    break;
            }
            return historySortDir === 'asc' ? cmp : -cmp;
        });

        return records;
    }, [payrollRecords, historyStatusFilter, historyMonthFilter, historySortField, historySortDir, searchQuery, activeSubTab, users]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        (payrollRecords || [])
            .filter(r => r.status === 'FROZEN' || r.status === 'PAID')
            .forEach(r => months.add(r.month));
        return Array.from(months).sort().reverse();
    }, [payrollRecords]);

    const toggleSort = (field: SortField) => {
        if (historySortField === field) {
            setHistorySortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setHistorySortField(field);
            setHistorySortDir('desc');
        }
    };

    const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
        if (historySortField !== field) return <span className="text-slate-300 ml-1">&#8645;</span>;
        return <span className="text-blue-500 ml-1">{historySortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
    };

    const handleUnfreeze = (record: PayrollRecord) => {
        onUpdatePayrollRecord?.({ ...record, status: 'DRAFT' });
    };

    const subTabs = [
        { id: 'members', label: 'Участники', icon: '\uD83D\uDC65' },
        { id: 'calc', label: 'Расчет зарплат', icon: '\uD83E\uDDEE' },
        { id: 'history', label: 'Архив ведомостей', icon: '\uD83D\uDCDC' },
        { id: 'schemes', label: 'Схемы ЗП', icon: '\u2699\uFE0F' },
    ];

    const drillDownUser = historyDrillDown ? users.find(u => u.id === historyDrillDown.userId) : null;

    const renderSubContent = () => {
        switch(activeSubTab) {
            case 'calc':
                return (
                    <PayrollBoard
                        users={users}
                        tasks={tasks}
                        projects={projects}
                        salarySchemes={salarySchemes}
                        payrollRecords={payrollRecords || []}
                        availableJobTitles={availableJobTitles}
                        onUpdateRecord={onUpdatePayrollRecord || (() => {})}
                        onPay={onPayPayroll || (() => {})}
                    />
                );
            case 'history':
                return (
                    <div className="p-6 md:p-8 space-y-6 animate-fade-in bg-slate-50 min-h-full">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Архив ведомостей</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Зафиксированные и выплаченные записи</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={historyStatusFilter}
                                    onChange={e => setHistoryStatusFilter(e.target.value as any)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none"
                                >
                                    <option value="all">Все статусы</option>
                                    <option value="FROZEN">Зафиксировано</option>
                                    <option value="PAID">Выплачено</option>
                                </select>
                                <select
                                    value={historyMonthFilter}
                                    onChange={e => setHistoryMonthFilter(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none"
                                >
                                    <option value="all">Все периоды</option>
                                    {availableMonths.map(m => (
                                        <option key={m} value={m}>
                                            {new Date(m + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                                        </option>
                                    ))}
                                </select>
                                {historyRecords.length > 0 && (
                                    <span className="text-[10px] text-slate-400 font-bold">
                                        {historyRecords.length} записей
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[900px]">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-4 md:px-6 py-3 md:py-4 cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('name')}>
                                                Сотрудник <SortIcon field="name" />
                                            </th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('month')}>
                                                Период <SortIcon field="month" />
                                            </th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-right">Фикс</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-right">KPI</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-right text-emerald-600">Премия</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-right text-rose-500">Штраф</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-right text-orange-500">Аванс</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-right cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('total')}>
                                                Итого <SortIcon field="total" />
                                            </th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-center">Статус</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-center cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('paidAt')}>
                                                Дата <SortIcon field="paidAt" />
                                            </th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-center">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {historyRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan={11} className="px-6 py-16 text-center">
                                                    <p className="text-slate-400 italic font-medium">Нет записей для отображения</p>
                                                    <p className="text-xs text-slate-300 mt-1">Зафиксируйте ведомость во вкладке "Расчет зарплат"</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            historyRecords.map(r => {
                                                const u = users.find(x => x.id === r.userId);
                                                const total = calcTotal(r);
                                                return (
                                                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 md:px-6 py-3 md:py-4">
                                                            <div className="flex items-center gap-3">
                                                                <UserAvatar src={u?.avatar} name={u?.name || '?'} size="sm" />
                                                                <div>
                                                                    <p className="text-xs md:text-sm font-black text-slate-800">{u?.name || '---'}</p>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{u?.jobTitle}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4">
                                                            <span className="text-xs font-bold text-slate-600">
                                                                {new Date(r.month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs font-bold text-slate-600">
                                                            {r.fixSalary.toLocaleString()} ₸
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                                                            <button
                                                                onClick={() => setHistoryDrillDown(r)}
                                                                className="text-xs font-black text-blue-600 hover:underline"
                                                            >
                                                                {r.calculatedKpi.toLocaleString()} ₸
                                                            </button>
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs font-bold text-emerald-600">
                                                            {r.manualBonus > 0 ? `+${r.manualBonus.toLocaleString()}` : '0'} ₸
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs font-bold text-rose-500">
                                                            {r.manualPenalty > 0 ? `-${r.manualPenalty.toLocaleString()}` : '0'} ₸
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs font-bold text-orange-500">
                                                            {r.advance > 0 ? `-${r.advance.toLocaleString()}` : '0'} ₸
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                                                            <span className="text-sm font-black text-slate-900">{total.toLocaleString()} ₸</span>
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                            {r.status === 'PAID' ? (
                                                                <span className="inline-flex px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                    Выплачено
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                                                                    Зафиксировано
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-center text-xs text-slate-400">
                                                            {r.paidAt ? new Date(r.paidAt).toLocaleDateString('ru-RU') : '---'}
                                                        </td>
                                                        <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {r.status === 'FROZEN' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => onPayPayroll?.(r)}
                                                                            className="px-2.5 py-1 text-[9px] font-black bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all uppercase"
                                                                        >
                                                                            Выплатить
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleUnfreeze(r)}
                                                                            className="px-2.5 py-1 text-[9px] font-black text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all uppercase"
                                                                        >
                                                                            Разморозить
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {r.status === 'PAID' && (
                                                                    <button
                                                                        onClick={() => setHistoryDrillDown(r)}
                                                                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                                        title="Детализация"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {historyRecords.length > 0 && (
                            <div className="flex flex-wrap gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Итого</p>
                                    <p className="text-xl font-black text-slate-900">
                                        {historyRecords.reduce((sum, r) => sum + calcTotal(r), 0).toLocaleString()} ₸
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Выплачено</p>
                                    <p className="text-xl font-black text-emerald-600">
                                        {historyRecords.filter(r => r.status === 'PAID').reduce((sum, r) => sum + calcTotal(r), 0).toLocaleString()} ₸
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Ожидает выплаты</p>
                                    <p className="text-xl font-black text-blue-600">
                                        {historyRecords.filter(r => r.status === 'FROZEN').reduce((sum, r) => sum + calcTotal(r), 0).toLocaleString()} ₸
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'schemes':
                return <SalarySchemes users={users} schemes={salarySchemes} onUpdateScheme={onUpdateSalaryScheme || (() => {})} availableJobTitles={availableJobTitles} />;
            default:
                return (
                    <div className="p-6 md:p-10">
                        <div className="max-w-[1600px] mx-auto">
                            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[700px]">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <th className="px-4 md:px-8 py-4 md:py-5">Сотрудник</th>
                                                <th className="px-4 md:px-8 py-4 md:py-5">Должность</th>
                                                <th className="px-4 md:px-8 py-4 md:py-5">ИИН</th>
                                                <th className="px-4 md:px-8 py-4 md:py-5 text-center">День рождения</th>
                                                <th className="px-4 md:px-8 py-4 md:py-5 text-center">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredUsers.map(user => (
                                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-4 md:px-8 py-4 md:py-5">
                                                        <div className="flex items-center space-x-3 md:space-x-4">
                                                            <UserAvatar src={user.avatar} name={user.name} size="lg" className="!rounded-2xl md:!w-12 md:!h-12" borderClassName="border-2 border-white shadow-sm" />
                                                            <div><p className="text-xs md:text-sm font-black text-slate-800 leading-tight">{user.name}</p><p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-0.5">{user.email}</p></div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 md:px-8 py-4 md:py-5">
                                                        <span className="inline-flex px-2 md:px-3 py-1 bg-blue-50 text-blue-700 text-[9px] md:text-[10px] font-black rounded-lg border border-blue-100 uppercase tracking-wider">{user.jobTitle}</span>
                                                    </td>
                                                    <td className="px-4 md:px-8 py-4 md:py-5"><p className="text-xs font-mono text-slate-500 font-bold">{user.iin || '---'}</p></td>
                                                    <td className="px-4 md:px-8 py-4 md:py-5 text-center">
                                                        {(() => {
                                                            const bd = formatBirthdayShort(user.birthday);
                                                            const info = getDaysUntilBirthday(user.birthday);
                                                            if (!bd || !info) return <span className="text-xs text-slate-300">---</span>;
                                                            return (
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <span className="text-xs text-slate-600 font-medium">{bd}</span>
                                                                    {info.isToday ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-200 animate-pulse">
                                                                            &#127881; Сегодня!
                                                                        </span>
                                                                    ) : (
                                                                        <span className={`text-[10px] font-bold ${info.days <= 7 ? 'text-amber-500' : info.days <= 30 ? 'text-blue-500' : 'text-slate-400'}`}>
                                                                            через {info.text}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-4 md:px-8 py-4 md:py-5 text-center">
                                                        {isCeo && (
                                                            <div className="flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100">
                                                                <button
                                                                    onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }}
                                                                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-transparent hover:border-blue-200 transition-all"
                                                                    title="Редактировать"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteTarget(user)}
                                                                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition-all"
                                                                    title="Удалить"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#FBFBFF] animate-fade-in">
            <div className="p-6 md:p-8 shrink-0 bg-white border-b border-slate-100 shadow-sm z-10">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Команда</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Human Resources & Access Control</p>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {(activeSubTab === 'members' || activeSubTab === 'history') && (
                            <div className="relative flex-1 md:w-80">
                                <input type="text" placeholder="Поиск по сотрудникам..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                            </div>
                        )}
                        {isCeo && activeSubTab === 'members' && (
                            <button onClick={handleOpenNewUser} className="bg-slate-900 text-white px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all whitespace-nowrap">+ <span className="hidden sm:inline">Новый </span>Сотрудник</button>
                        )}
                    </div>
                </div>

                <div className="max-w-[1600px] mx-auto mt-4 md:mt-8 flex gap-1 overflow-x-auto no-scrollbar pb-1">
                    {subTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveSubTab(tab.id as any); setSearchQuery(''); }}
                            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeSubTab === tab.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span className="mr-2">{tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {renderSubContent()}
            </div>

            {isCeo && (
                <UserModal
                    isOpen={isUserModalOpen}
                    onClose={() => setIsUserModalOpen(false)}
                    user={editingUser}
                    onSave={u => {
                        onUpdateUser(u as User);
                        setIsUserModalOpen(false);
                    }}
                    isCeo={isCeo}
                    availableJobTitles={availableJobTitles}
                    onAddJobTitle={onAddJobTitle}
                />
            )}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (deleteTarget) {
                        onDeleteUser?.(deleteTarget.id);
                        setDeleteTarget(null);
                    }
                }}
                title="Удалить сотрудника?"
                message={`Вы уверены, что хотите удалить ${deleteTarget?.name || ''}?\n\nВсе связанные данные (задачи, уведомления, история активности) будут удалены или отвязаны. Это действие необратимо.`}
                confirmText="Удалить"
                variant="danger"
            />

            <ConfirmDialog
                isOpen={!!planLimitWarning}
                onClose={() => setPlanLimitWarning('')}
                onConfirm={() => setPlanLimitWarning('')}
                title="Лимит тарифа"
                message={planLimitWarning}
                confirmText="Понятно"
                variant="warning"
            />

            <Modal
                isOpen={!!historyDrillDown}
                onClose={() => setHistoryDrillDown(null)}
                title={`Детализация: ${drillDownUser?.name || ''} (${historyDrillDown?.month || ''})`}
            >
                {historyDrillDown && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-slate-50 rounded-xl">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Фикс</p>
                                <p className="text-sm font-black text-slate-800">{historyDrillDown.fixSalary.toLocaleString()} ₸</p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <p className="text-[9px] font-black text-blue-400 uppercase mb-1">KPI</p>
                                <p className="text-sm font-black text-blue-700">{historyDrillDown.calculatedKpi.toLocaleString()} ₸</p>
                            </div>
                            <div className="p-3 bg-emerald-50 rounded-xl">
                                <p className="text-[9px] font-black text-emerald-400 uppercase mb-1">Премия</p>
                                <p className="text-sm font-black text-emerald-700">+{historyDrillDown.manualBonus.toLocaleString()} ₸</p>
                            </div>
                            <div className="p-3 bg-rose-50 rounded-xl">
                                <p className="text-[9px] font-black text-rose-400 uppercase mb-1">Штраф / Аванс</p>
                                <p className="text-sm font-black text-rose-700">-{(historyDrillDown.manualPenalty + historyDrillDown.advance).toLocaleString()} ₸</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-900 rounded-xl flex justify-between items-center">
                            <span className="text-xs font-black text-slate-400 uppercase">Итого к выдаче</span>
                            <span className="text-lg font-black text-white">{calcTotal(historyDrillDown).toLocaleString()} ₸</span>
                        </div>

                        {(historyDrillDown.taskPayments || []).length > 0 && (
                            <div className="space-y-3">
                                <h4 className="font-black text-slate-700 text-sm uppercase tracking-wide">Оплата за задачи</h4>
                                {historyDrillDown.taskPayments!.map((payment, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">{payment.task_title}</p>
                                            <p className="text-[11px] text-slate-500 uppercase tracking-wide">{payment.task_type} | {payment.hours} ч x {payment.rate.toLocaleString()} ₸</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{new Date(payment.completed_at).toLocaleDateString('ru-RU')}</p>
                                        </div>
                                        <div className="font-black text-green-600 text-sm">+{payment.amount.toLocaleString()} ₸</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(historyDrillDown.taskPayments || []).length === 0 && (
                            <p className="p-8 text-center text-slate-400 italic text-sm">Детализация по задачам отсутствует</p>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default TeamManagement;
