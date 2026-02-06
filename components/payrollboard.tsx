
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, Task, Project, PayrollRecord, SalaryScheme } from '../types';
import Modal from './Modal';
import { calculateUserStats } from '../services/payrollService';
import { BonusCalculationDetail } from '../services/bonusCalculationService';
import { useNumberInput } from '../hooks/useNumberInput';
import UserAvatar from './UserAvatar';

interface PayrollBoardProps {
    users: User[];
    tasks: Task[];
    projects: Project[];
    payrollRecords: PayrollRecord[];
    salarySchemes: SalaryScheme[];
    availableJobTitles?: string[];
    onUpdateRecord: (record: PayrollRecord) => void;
    onPay: (record: PayrollRecord) => void;
}

interface RowData {
    user: User;
    record: PayrollRecord;
    total: number;
    details: any[];
    contentDetails: any[];
    bonusDetails: BonusCalculationDetail[];
}

interface PayrollRowProps {
    user: User;
    record: PayrollRecord;
    details: any[];
    contentDetails: any[];
    bonusDetails: BonusCalculationDetail[];
    isFrozen: boolean;
    onUpdateField: (userId: string, field: 'manualBonus' | 'manualPenalty' | 'advance', value: number) => void;
    onFreeze: (userId: string, manualBonus: number, manualPenalty: number, advance: number) => void;
    onPay: (record: PayrollRecord) => void;
    onDrillDown: (user: User, details: any[], contentDetails: any[], bonusDetails: BonusCalculationDetail[]) => void;
}

const PayrollRow: React.FC<PayrollRowProps> = React.memo(({
    user,
    record,
    details,
    contentDetails,
    bonusDetails,
    isFrozen,
    onUpdateField,
    onFreeze,
    onPay,
    onDrillDown
}) => {
    const [localManualBonus, setLocalManualBonus] = useState(record.manualBonus);
    const [localManualPenalty, setLocalManualPenalty] = useState(record.manualPenalty);
    const [localAdvance, setLocalAdvance] = useState(record.advance);

    useEffect(() => {
        setLocalManualBonus(record.manualBonus);
        setLocalManualPenalty(record.manualPenalty);
        setLocalAdvance(record.advance);
    }, [record.manualBonus, record.manualPenalty, record.advance]);

    const total = useMemo(() => {
        return (record.fixSalary || 0) +
               (record.calculatedKpi || 0) +
               (localManualBonus || 0) -
               (localManualPenalty || 0) -
               (localAdvance || 0);
    }, [record.fixSalary, record.calculatedKpi, localManualBonus, localManualPenalty, localAdvance]);

    const manualBonusInput = useNumberInput(
        localManualBonus,
        (value) => {
            setLocalManualBonus(value);
            onUpdateField(user.id, 'manualBonus', value);
        },
        800
    );

    const manualPenaltyInput = useNumberInput(
        localManualPenalty,
        (value) => {
            setLocalManualPenalty(value);
            onUpdateField(user.id, 'manualPenalty', value);
        },
        800
    );

    const advanceInput = useNumberInput(
        localAdvance,
        (value) => {
            setLocalAdvance(value);
            onUpdateField(user.id, 'advance', value);
        },
        800
    );

    return (
        <tr className="hover:bg-slate-50/50">
            <td className="px-3 md:px-6 py-3 md:py-4">
                <div className="flex items-center gap-2 md:gap-3">
                    <UserAvatar src={user.avatar} name={user.name} size="md" className="!rounded-xl md:!w-10 md:!h-10" />
                    <div>
                        <p className="text-xs md:text-sm font-black text-slate-800">{user.name}</p>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">{user.jobTitle}</p>
                    </div>
                </div>
            </td>
            <td className="px-3 md:px-6 py-3 md:py-4 text-right font-bold text-slate-600 text-xs md:text-sm">
                {record.fixSalary.toLocaleString()} ₸
            </td>
            <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                <button
                    onClick={() => onDrillDown(user, details, contentDetails, bonusDetails)}
                    className="text-xs md:text-sm font-black text-blue-600 hover:underline"
                >
                    {record.calculatedKpi.toLocaleString()} ₸
                </button>
            </td>
            <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                <input
                    type="number"
                    disabled={isFrozen}
                    className="w-16 md:w-24 text-xs md:text-sm text-right bg-transparent outline-none text-emerald-600 font-bold border-b border-transparent hover:border-slate-200 disabled:opacity-50"
                    placeholder="0"
                    {...manualBonusInput}
                />
            </td>
            <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                <input
                    type="number"
                    disabled={isFrozen}
                    className="w-16 md:w-24 text-xs md:text-sm text-right bg-transparent outline-none text-rose-500 font-bold border-b border-transparent hover:border-slate-200 disabled:opacity-50"
                    placeholder="0"
                    {...manualPenaltyInput}
                />
            </td>
            <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                <input
                    type="number"
                    disabled={isFrozen}
                    className="w-16 md:w-24 text-xs md:text-sm text-right bg-transparent outline-none text-orange-500 font-bold border-b border-transparent hover:border-slate-200 disabled:opacity-50"
                    placeholder="0"
                    {...advanceInput}
                />
            </td>
            <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                <span className="text-sm md:text-base font-black text-slate-900">{total.toLocaleString()} ₸</span>
            </td>
            <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                {record.status === 'PAID' ? (
                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded uppercase">Выплачено</span>
                ) : isFrozen ? (
                    <button onClick={() => onPay(record)} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow uppercase">Выплатить</button>
                ) : (
                    <button onClick={() => onFreeze(user.id, localManualBonus, localManualPenalty, localAdvance)} className="text-[10px] font-black text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg uppercase">Закрепить</button>
                )}
            </td>
        </tr>
    );
});

const PayrollBoard: React.FC<PayrollBoardProps> = ({
    users = [], tasks = [], projects = [], payrollRecords = [],
    salarySchemes = [], availableJobTitles = [], onUpdateRecord, onPay
}) => {
    const getDefaultMonth = () => {
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        return now.toISOString().slice(0, 7);
    };
    const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
    const [drillDownUser, setDrillDownUser] = useState<User | null>(null);
    const [drillDownData, setDrillDownData] = useState<any[]>([]);
    const [drillDownContentData, setDrillDownContentData] = useState<any[]>([]);
    const [drillDownBonusData, setDrillDownBonusData] = useState<BonusCalculationDetail[]>([]);
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
    const [rows, setRows] = useState<RowData[]>([]);
    const [loading, setLoading] = useState(false);

    const kpiCacheRef = useRef<Map<string, { stats: any; timestamp: number }>>(new Map());
    const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

    const loadPayrollData = useCallback(async (recalculateKpi: boolean = true) => {
        setLoading(true);
        try {
            const filteredUsers = selectedRoleFilter === 'all' ? users : users.filter(u => u.jobTitle === selectedRoleFilter);
            console.log(`[Payroll] Total users: ${users.length}, Filtered: ${filteredUsers.length}, Role filter: ${selectedRoleFilter}, Month: ${selectedMonth}`);
            const rowsData: RowData[] = [];

            for (const user of filteredUsers) {
                const existingRecord = payrollRecords.find(r => r.userId === user.id && r.month === selectedMonth);
                const cacheKey = `${user.id}_${selectedMonth}`;

                let stats;
                if (recalculateKpi || !kpiCacheRef.current.has(cacheKey)) {
                    stats = await calculateUserStats(user, tasks, projects, salarySchemes, selectedMonth);
                    kpiCacheRef.current.set(cacheKey, { stats, timestamp: Date.now() });
                } else {
                    stats = kpiCacheRef.current.get(cacheKey)!.stats;
                }

                const isFrozen = existingRecord?.status === 'FROZEN' || existingRecord?.status === 'PAID';

                const record: PayrollRecord = existingRecord || {
                    id: `pr_${user.id}_${selectedMonth}`,
                    userId: user.id,
                    month: selectedMonth,
                    fixSalary: stats.baseSalary,
                    calculatedKpi: stats.kpiEarned + stats.bonusesEarned,
                    manualBonus: 0,
                    manualPenalty: 0,
                    advance: 0,
                    status: 'DRAFT',
                    balanceAtStart: user.balance || 0
                };

                if (!isFrozen) {
                    record.calculatedKpi = stats.kpiEarned + stats.bonusesEarned;
                    record.fixSalary = stats.baseSalary;
                }

                const total = (record.fixSalary || 0) + (record.calculatedKpi || 0) + (record.manualBonus || 0) - (record.manualPenalty || 0) - (record.advance || 0);

                rowsData.push({
                    user,
                    record,
                    total,
                    details: stats.details,
                    contentDetails: stats.contentDetails || [],
                    bonusDetails: stats.bonusDetails
                });
            }

            setRows(rowsData);
            console.log(`[Payroll] Loaded ${rowsData.length} rows for display`);
            if (rowsData.length > 0) {
                console.log(`[Payroll] First row:`, rowsData[0].user.name, `Total: ${rowsData[0].total}`);
                console.log(`[Payroll] Last row:`, rowsData[rowsData.length - 1].user.name, `Total: ${rowsData[rowsData.length - 1].total}`);
            }
        } catch (error) {
            console.error('Error loading payroll data:', error);
        } finally {
            setLoading(false);
        }
    }, [users, selectedMonth, tasks, projects, selectedRoleFilter, salarySchemes, payrollRecords]);

    useEffect(() => {
        kpiCacheRef.current.clear();
        loadPayrollData(true);
    }, [selectedMonth, selectedRoleFilter]);

    useEffect(() => {
        loadPayrollData(false);
    }, [payrollRecords]);

    const handleUpdateField = useCallback((userId: string, field: 'manualBonus' | 'manualPenalty' | 'advance', value: number) => {
        if (updateTimerRef.current) {
            clearTimeout(updateTimerRef.current);
        }

        setRows(prevRows => {
            const updatedRows = prevRows.map(row => {
                if (row.user.id === userId) {
                    const updatedRecord = { ...row.record, [field]: value };
                    return {
                        ...row,
                        record: updatedRecord,
                        total: (updatedRecord.fixSalary || 0) +
                               (updatedRecord.calculatedKpi || 0) +
                               (updatedRecord.manualBonus || 0) -
                               (updatedRecord.manualPenalty || 0) -
                               (updatedRecord.advance || 0)
                    };
                }
                return row;
            });

            updateTimerRef.current = setTimeout(() => {
                const row = updatedRows.find(r => r.user.id === userId);
                if (row) {
                    onUpdateRecord({ ...row.record, [field]: value });
                }
            }, 1000);

            return updatedRows;
        });
    }, [onUpdateRecord]);

    const handleFreeze = useCallback((userId: string, manualBonus: number, manualPenalty: number, advance: number) => {
        setRows(prevRows => {
            const row = prevRows.find(r => r.user.id === userId);
            if (row) {
                onUpdateRecord({
                    ...row.record,
                    manualBonus,
                    manualPenalty,
                    advance,
                    status: 'FROZEN'
                });
            }
            return prevRows;
        });
    }, [onUpdateRecord]);

    const handleDrillDown = useCallback((user: User, details: any[], contentDetails: any[], bonusDetails: BonusCalculationDetail[]) => {
        setDrillDownUser(user);
        setDrillDownData(details);
        setDrillDownContentData(contentDetails);
        setDrillDownBonusData(bonusDetails);
    }, []);

    return (
        <div className="p-6 space-y-6 animate-fade-in bg-slate-50 min-h-full">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
                <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ведомость выплат</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Финансовый контроль персонала</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-slate-700 outline-none"
                        value={selectedRoleFilter}
                        onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    >
                        <option value="all">Все должности ({users.length})</option>
                        {availableJobTitles && availableJobTitles.map(title => {
                            const count = users.filter(u => u.jobTitle === title).length;
                            return <option key={title} value={title}>{title} ({count})</option>;
                        })}
                    </select>
                    <div className="flex flex-col items-end gap-1">
                        <input
                            type="month"
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-slate-700 outline-none"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                        {rows.length > 0 && (
                            <p className="text-[10px] text-slate-400 px-2">
                                {rows.length} сотрудников
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-3 md:px-6 py-3 md:py-4">Сотрудник</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 text-right">Фикс</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 text-right">KPI</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 text-right text-emerald-600">Премия</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 text-right text-rose-500">Штраф</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 text-right text-orange-500">Аванс</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 text-right font-black text-slate-900">ИТОГО</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 text-center">Действие</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                        <p className="text-sm text-slate-400 font-medium">Загрузка данных...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-slate-400 italic">Нет данных для отображения</p>
                                        <p className="text-xs text-slate-300">
                                            Выбран месяц: {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map(({ user, record, details, contentDetails, bonusDetails }) => {
                                const isFrozen = record.status === 'FROZEN' || record.status === 'PAID';
                                return (
                                    <PayrollRow
                                        key={user.id}
                                        user={user}
                                        record={record}
                                        details={details}
                                        contentDetails={contentDetails}
                                        bonusDetails={bonusDetails}
                                        isFrozen={isFrozen}
                                        onUpdateField={handleUpdateField}
                                        onFreeze={handleFreeze}
                                        onPay={onPay}
                                        onDrillDown={handleDrillDown}
                                    />
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={!!drillDownUser} onClose={() => { setDrillDownUser(null); setDrillDownData([]); setDrillDownContentData([]); setDrillDownBonusData([]); }} title={`Детализация начислений: ${drillDownUser?.name}`}>
                <div className="space-y-6">
                    {(() => {
                        const record = payrollRecords.find(r => r.userId === drillDownUser?.id && r.month === selectedMonth);
                        const taskPayments = record?.taskPayments || [];
                        return taskPayments.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="font-black text-slate-700 text-sm uppercase tracking-wide">Оплата за завершенные задачи</h4>
                                {taskPayments.map((payment: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">{payment.task_title}</p>
                                            <p className="text-[11px] text-slate-500 uppercase tracking-wide">{payment.task_type} • {payment.hours} ч × {payment.rate.toLocaleString()} ₸</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{new Date(payment.completed_at).toLocaleDateString('ru-RU')}</p>
                                        </div>
                                        <div className="font-black text-green-600 text-sm">+{payment.amount.toLocaleString()} ₸</div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {drillDownData.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-black text-slate-700 text-sm uppercase tracking-wide">KPI за задачи</h4>
                            {drillDownData.map((d, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">{d.taskType}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">
                                            {d.count} {d.count === 1 ? 'задача' : d.count < 5 ? 'задачи' : 'задач'} • {d.hours} ч × {d.rate.toLocaleString()} ₸/ч
                                        </p>
                                    </div>
                                    <div className="font-black text-blue-600 text-sm">+{d.total.toLocaleString()} ₸</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {drillDownContentData.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-black text-slate-700 text-sm uppercase tracking-wide">KPI за контент проектов</h4>
                            {drillDownContentData.map((d, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">{d.projectName}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">{d.contentType} • {d.quantity.toFixed(1)} × {d.rate} ₸</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">Доля в команде: {d.sharePercentage.toFixed(1)}%</p>
                                    </div>
                                    <div className="font-black text-purple-600 text-sm">+{d.total.toLocaleString()} ₸</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {drillDownBonusData.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-black text-slate-700 text-sm uppercase tracking-wide">Бонусы по правилам</h4>
                            {drillDownBonusData.map((bonus, i) => (
                                <div key={i} className={`p-3 rounded-xl border ${bonus.conditionMet ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-700 text-sm">{bonus.ruleName}</p>
                                            <p className="text-[10px] text-slate-400 uppercase">{bonus.metricSource}</p>
                                        </div>
                                        <div className={`font-black text-sm ${bonus.conditionMet ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {bonus.conditionMet ? '+' : ''}{bonus.rewardAmount.toLocaleString()} ₸
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="px-2 py-0.5 bg-white rounded text-slate-600 font-bold">
                                            Метрика: {bonus.baseValue.toFixed(2)}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded font-bold ${bonus.conditionMet ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                            {bonus.conditionMet ? 'Выполнено' : 'Не выполнено'}
                                        </span>
                                    </div>
                                    {bonus.description && (
                                        <p className="text-xs text-slate-500 mt-2 italic">{bonus.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {drillDownData.length === 0 && drillDownContentData.length === 0 && drillDownBonusData.length === 0 && (
                        <p className="p-10 text-center text-slate-400 italic">Начислений нет</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default PayrollBoard;
