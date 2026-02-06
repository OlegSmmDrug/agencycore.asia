
import React, { useState, useEffect } from 'react';
import { User, Task, Project, PayrollRecord, SalaryScheme } from '../types';
import PayrollBoard from './payrollboard';
import UserModal from './UserModal';
import SalarySchemes from './salaryschemes';
import UserAvatar from './UserAvatar';

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

const TeamManagement: React.FC<TeamManagementProps> = ({
    users = [], tasks = [], projects = [], currentUser, activeTab, onUpdateUser, onDeleteUser,
    availableJobTitles = [], onAddJobTitle, payrollRecords = [], onUpdatePayrollRecord, onPayPayroll,
    salarySchemes = [], onUpdateSalaryScheme
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'members' | 'calc' | 'history' | 'fixations' | 'schemes'>('members');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    const isCeo = currentUser.jobTitle === 'CEO';

    useEffect(() => {
        if (activeTab === 'payroll') setActiveSubTab('calc');
        else if (activeTab === 'team') setActiveSubTab('members');
    }, [activeTab]);

    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const subTabs = [
        { id: 'members', label: 'Участники', icon: '👥' },
        { id: 'calc', label: 'Расчет зарплат', icon: '🧮' },
        { id: 'history', label: 'История выплат', icon: '📜' },
        { id: 'fixations', label: 'История фиксаций', icon: '🔒' },
        { id: 'schemes', label: 'Схемы ЗП', icon: '⚙️' },
    ];

    const renderSubContent = () => {
        switch(activeSubTab) {
            case 'calc':
                return (
                    <PayrollBoard
                        users={users}
                        tasks={tasks}
                        projects={projects}
                        salarySchemes={salarySchemes}
                        payrollRecords={payrollRecords?.filter(r => r.status === 'DRAFT') || []}
                        availableJobTitles={availableJobTitles}
                        onUpdateRecord={onUpdatePayrollRecord || (() => {})}
                        onPay={onPayPayroll || (() => {})}
                    />
                );
            case 'history':
                const paid = payrollRecords?.filter(r => r.status === 'PAID') || [];
                return (
                    <div className="p-8 space-y-6">
                        <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Архив выплат</h3>
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr><th className="p-4">Сотрудник</th><th className="p-4">Период</th><th className="p-4 text-right">Сумма</th><th className="p-4 text-center">Дата выплаты</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paid.map(r => {
                                        const u = users.find(x => x.id === r.userId);
                                        return (
                                            <tr key={r.id}>
                                                <td className="p-4 font-bold text-slate-700">{u?.name}</td>
                                                <td className="p-4 text-slate-500 font-mono text-xs">{r.month}</td>
                                                <td className="p-4 text-right font-black text-emerald-600">{(r.fixSalary + r.calculatedKpi + r.manualBonus - r.manualPenalty - r.advance).toLocaleString()} ₸</td>
                                                <td className="p-4 text-center text-xs text-slate-400">{r.paidAt ? new Date(r.paidAt).toLocaleDateString() : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                    {paid.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-slate-400 italic font-medium">История выплат пока пуста</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'fixations':
                const frozen = payrollRecords?.filter(r => r.status === 'FROZEN') || [];
                return (
                    <div className="p-8 space-y-6">
                        <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Зафиксированные ведомости</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {frozen.map(r => {
                                const u = users.find(x => x.id === r.userId);
                                return (
                                    <div key={r.id} className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-3"><span className="text-2xl">🔒</span></div>
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{r.month}</p>
                                        <h4 className="font-bold text-slate-800">{u?.name}</h4>
                                        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-end">
                                            <div className="text-xs text-slate-400">Итого к выдаче:</div>
                                            <div className="text-lg font-black text-slate-900">{(r.fixSalary + r.calculatedKpi + r.manualBonus - r.manualPenalty - r.advance).toLocaleString()} ₸</div>
                                        </div>
                                    </div>
                                );
                            })}
                            {frozen.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">Нет зафиксированных данных для отображения</div>}
                        </div>
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
                                                <th className="px-4 md:px-8 py-4 md:py-5 text-right">Оклад (Фикс)</th>
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
                                                    <td className="px-4 md:px-8 py-4 md:py-5"><p className="text-xs font-mono text-slate-500 font-bold">{user.iin || '—'}</p></td>
                                                    <td className="px-4 md:px-8 py-4 md:py-5 text-right"><p className="text-xs md:text-sm font-black text-slate-900">{(user.salary || 0).toLocaleString()} ₸</p></td>
                                                    <td className="px-4 md:px-8 py-4 md:py-5 text-center">
                                                        {isCeo && (
                                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                                <button
                                                                    onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }}
                                                                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-transparent hover:border-blue-200 transition-all"
                                                                    title="Редактировать"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (window.confirm(`Вы уверены, что хотите удалить пользователя ${user.name}?\n\nВнимание: Все связанные данные (задачи, уведомления, история активности) будут удалены или отвязаны от пользователя. Это действие необратимо.`)) {
                                                                            onDeleteUser?.(user.id);
                                                                        }
                                                                    }}
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
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Команда</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Human Resources & Access Control</p>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <input type="text" placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        {isCeo && (
                            <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">+ Новый сотрудник</button>
                        )}
                    </div>
                </div>
                
                <div className="max-w-[1600px] mx-auto mt-8 flex gap-1 overflow-x-auto no-scrollbar">
                    {subTabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as any)}
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
        </div>
    );
};

export default TeamManagement;
