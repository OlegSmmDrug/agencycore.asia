
import React, { useMemo, useState } from 'react';
import { Transaction, Client } from '../types';

interface FinancialModelProps {
    transactions: Transaction[];
    clients: Client[];
    viewMode?: 'opiu' | 'dds'; // Optional prop to force view from parent
}

// Helper to format currency safely
const formatVal = (v: any) => {
    const num = Number(v);
    if (isNaN(num)) return '₸ 0';
    return `₸ ${Math.round(num).toLocaleString()}`;
};

// Extracted Row component for better performance and readability
const TableRow = ({ label, values, isHeader = false, subLabel, isBold = false, isTotal = false, percentages }: any) => (
    <tr className={`${isHeader ? 'bg-[#F9FAFB] border-y border-slate-100' : ''} hover:bg-slate-50/80 transition-colors group`}>
        <td className={`py-2.5 px-4 sticky left-0 bg-white z-20 border-r border-slate-100 w-[240px] min-w-[240px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] ${isHeader ? 'bg-[#F9FAFB]' : ''} ${isTotal ? 'bg-slate-50' : ''}`}>
            <div className={`${isHeader ? 'text-xs font-black uppercase tracking-wide text-slate-900' : 'text-xs font-bold text-slate-700'}`}>
                {label}
            </div>
            {subLabel && (
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{subLabel}</div>
            )}
        </td>
        {values.map((v: number, i: number) => (
            <td key={i} className={`py-2.5 px-4 text-right font-medium w-[140px] min-w-[140px] whitespace-nowrap ${isBold ? 'font-black text-slate-900' : 'text-slate-600'} ${isTotal ? 'bg-slate-50/50' : ''}`}>
                <div className="text-xs">{formatVal(v)}</div>
                {percentages && (
                    <div className="text-[9px] text-slate-400 font-black mt-0.5">{percentages[i]} %</div>
                )}
            </td>
        ))}
    </tr>
);

const FinancialModel: React.FC<FinancialModelProps> = ({ transactions = [], clients = [], viewMode }) => {
    const [viewType, setViewType] = useState<'opiu' | 'dds'>(viewMode || 'opiu');
    const [grouping, setGrouping] = useState<'monthly' | 'quarterly'>('monthly');
    const [startDate, setStartDate] = useState(new Date(2025, 11, 1));
    const [endDate, setEndDate] = useState(new Date(2026, 11, 1));
    const [isEditingDates, setIsEditingDates] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Генерируем месяцы между startDate и endDate
    const months = useMemo(() => {
        const list = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            list.push({
                label: current.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }).replace('.', ''),
                key: `${current.getFullYear()}-${current.getMonth()}`
            });
            current.setMonth(current.getMonth() + 1);
        }
        return list;
    }, [startDate, endDate]);

    // Расчет данных для ОПиУ и ДДС (бизнес-логика)
    const monthlyData = useMemo(() => {
        const safeTransactions = Array.isArray(transactions) ? transactions : [];
        const currentRevenue = safeTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + (t.amount || 0), 0) || 8446000;
        const currentPayroll = Math.abs(safeTransactions.filter(t => t.category === 'Salary').reduce((acc, t) => acc + (t.amount || 0), 0)) || 4690000;

        let cumulativeBalance = 0;

        return months.map((m, i) => {
            const growthFactor = i < 6 ? Math.pow(1.04, i) : Math.pow(1.04, 6) * (i === 6 ? 1.75 : 2.5);

            // --- PnL (ОПиУ) ---
            const revenue = Math.round(currentRevenue * growthFactor);
            const costOfSales = Math.round(revenue * 0.03);
            const grossProfit = revenue - costOfSales;
            const grossMargin = 97;
            const marketing = Math.round(revenue * 0.06);
            const payroll = Math.round(currentPayroll * (i < 6 ? 1.05 : 1.2));
            const office = 100000;
            const totalFixed = payroll + office;
            const ebitda = grossProfit - marketing - totalFixed;
            const taxes = Math.round(ebitda * 0.1);
            const netProfit = ebitda - taxes;

            // --- Cash Flow (ДДС) ---
            const startBalance = cumulativeBalance;
            const operatingFlow = netProfit;
            const investingFlow = 0;
            const financingFlow = 0;
            const totalFlow = operatingFlow + investingFlow + financingFlow;
            cumulativeBalance += totalFlow;
            const endBalance = cumulativeBalance;

            return {
                revenue, costOfSales, grossProfit, grossMargin,
                marketing, payroll, office, totalFixed,
                ebitda, taxes, netProfit,
                startBalance, operatingFlow, investingFlow, financingFlow, totalFlow, endBalance
            };
        });
    }, [months, transactions]);

    // Группировка по кварталам
    const { periods, data } = useMemo(() => {
        if (grouping === 'monthly') {
            return { periods: months, data: monthlyData };
        }

        // Квартальная группировка
        const quarters: any[] = [];
        const quarterData: any[] = [];

        for (let i = 0; i < months.length; i += 3) {
            const quarterMonths = monthlyData.slice(i, i + 3);
            if (quarterMonths.length === 0) break;

            const qNum = Math.floor(i / 3) + 1;
            const year = months[i]?.label.split(' ')[1] || '2025';
            quarters.push({
                label: `Q${qNum} ${year}`,
                key: `Q${qNum}-${year}`
            });

            const sumField = (field: keyof typeof quarterMonths[0]) => quarterMonths.reduce((sum, m) => sum + (m[field] || 0), 0);
            const avgField = (field: keyof typeof quarterMonths[0]) => quarterMonths.reduce((sum, m) => sum + (m[field] || 0), 0) / quarterMonths.length;

            quarterData.push({
                revenue: sumField('revenue'),
                costOfSales: sumField('costOfSales'),
                grossProfit: sumField('grossProfit'),
                grossMargin: Math.round(avgField('grossMargin')),
                marketing: sumField('marketing'),
                payroll: sumField('payroll'),
                office: sumField('office'),
                totalFixed: sumField('totalFixed'),
                ebitda: sumField('ebitda'),
                taxes: sumField('taxes'),
                netProfit: sumField('netProfit'),
                startBalance: quarterMonths[0].startBalance,
                operatingFlow: sumField('operatingFlow'),
                investingFlow: sumField('investingFlow'),
                financingFlow: sumField('financingFlow'),
                totalFlow: sumField('totalFlow'),
                endBalance: quarterMonths[quarterMonths.length - 1].endBalance
            });
        }

        return { periods: quarters, data: quarterData };
    }, [grouping, months, monthlyData]);

    return (
        <div className="flex flex-col h-full max-h-screen bg-white animate-fade-in">
            {/* Header Controls */}
            <div className="px-4 lg:px-8 py-4 lg:py-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4 border-b border-slate-100 shrink-0 bg-white">
                <div className="flex items-center gap-3 lg:gap-6">
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Финансовая модель</h2>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setViewType('opiu')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewType === 'opiu' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            ОПиУ
                        </button>
                        <button
                            onClick={() => setViewType('dds')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewType === 'dds' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            ДДС
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative group">
                        <select
                            value={grouping}
                            onChange={(e) => setGrouping(e.target.value as 'monthly' | 'quarterly')}
                            className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                        >
                            <option value="monthly">Ежемесячно</option>
                            <option value="quarterly">Квартально</option>
                        </select>
                        <svg className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </div>

                    <button
                        onClick={() => setIsEditingDates(!isEditingDates)}
                        className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-100 transition-all cursor-pointer text-xs"
                    >
                        <span className="font-black text-slate-400 uppercase tracking-wider">Период:</span>
                        <span className="font-black text-slate-800">
                            {startDate.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace('.', '')} - {endDate.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace('.', '')}
                        </span>
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>

                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="bg-white text-slate-700 px-4 py-2 rounded-lg text-xs font-black border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                        Пригласить
                    </button>
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                            isEditMode
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-slate-900 text-white hover:bg-black'
                        }`}
                    >
                        {isEditMode ? 'Сохранить' : 'Редактирование'}
                    </button>
                </div>
            </div>

            {/* Scrollable Table Viewport with custom scrollbar */}
            <div className="flex-1 overflow-auto bg-[#FBFBFF] financial-model-scroll">
                <table className="w-full border-collapse min-w-max">
                    <thead className="sticky top-0 z-30 bg-white">
                        <tr>
                            <th className="py-3 px-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b-2 border-slate-200 bg-white w-[240px] min-w-[240px] sticky left-0 z-40 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">Имя</th>
                            {periods.map(m => (
                                <th key={m.key} className="py-3 px-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 bg-white w-[140px] min-w-[140px] whitespace-nowrap">
                                    {m.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                        {viewType === 'opiu' ? (
                            <>
                                <TableRow label="Доход" values={periods.map(() => 0)} isHeader />
                                <TableRow label="Всего выручки" values={data.map(d => d.revenue)} isBold />
                                <TableRow label="Себестоимость" values={data.map(d => d.costOfSales)} />
                                <TableRow label="Валовая прибыль" values={data.map(d => d.grossProfit)} isBold subLabel="Валовая маржинальность" percentages={data.map(d => d.grossMargin)} />

                                <TableRow label="Операционные расходы" values={periods.map(() => 0)} isHeader />
                                <TableRow label="Продажи и маркетинг" values={data.map(d => d.marketing)} subLabel="% от Выручки" percentages={data.map(() => 6)} />

                                <TableRow label="Общие и административные расходы" values={periods.map(() => 0)} isHeader />
                                <TableRow label="ФОТ (Фонд оплаты труда)" values={data.map(d => d.payroll)} />
                                <TableRow label="Расходы на офис" values={data.map(d => d.office)} />
                                <TableRow label="Прочие профессиональные расходы" values={data.map(() => 0)} />
                                <TableRow label="Итого фиксированных расходов" values={data.map(d => d.totalFixed)} isBold isTotal subLabel="% от Выручки" percentages={data.map(d => Math.round(d.totalFixed / (d.revenue || 1) * 100))} />

                                <TableRow label="Прибыль" values={periods.map(() => 0)} isHeader />
                                <TableRow label="EBITDA" values={data.map(d => d.ebitda)} isBold />
                                <TableRow label="Налоги" values={data.map(d => d.taxes)} />
                                <TableRow label="Чистая прибыль" values={data.map(d => d.netProfit)} isBold isTotal />
                            </>
                        ) : (
                            <>
                                <TableRow label="Денежный поток от операционной деятельности" values={periods.map(() => 0)} isHeader />
                                <TableRow label="Чистая прибыль" values={data.map(d => d.netProfit)} />
                                <TableRow label="ДДС от операционной деятельности" values={data.map(d => d.operatingFlow)} isBold />

                                <TableRow label="Денежный поток от инвестиционной деятельности" values={periods.map(() => 0)} isHeader />
                                <TableRow label="Капитальные затраты" values={data.map(() => 0)} />
                                <TableRow label="ДДС от инвестиционной деятельности" values={data.map(() => 0)} isBold />

                                <TableRow label="Денежный поток от финансовой деятельности" values={periods.map(() => 0)} isHeader />
                                <TableRow label="Долговые обязательства" values={data.map(() => 0)} />
                                <TableRow label="Выпущенный (выкупленный) капитал" values={data.map(() => 0)} />
                                <TableRow label="Выплаченные дивиденды" values={data.map(() => 0)} />
                                <TableRow label="ДДС от финансовой деятельности" values={data.map(() => 0)} isBold />

                                <TableRow label="Общий денежный поток" values={periods.map(() => 0)} isHeader />
                                <TableRow label="Итого ДДС" values={data.map(d => d.totalFlow)} isBold />

                                <TableRow label="Итог по денежным средствам" values={periods.map(() => 0)} isHeader />
                                <TableRow label="Баланс на начало периода" values={data.map(d => d.startBalance)} />
                                <TableRow label="Увеличение (уменьшение)" values={data.map(d => d.totalFlow)} />
                                <TableRow label="Баланс на конец периода" values={data.map(d => d.endBalance)} isBold isTotal />
                            </>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Legend / Status Footer */}
            <div className="bg-white border-t border-slate-100 px-4 lg:px-8 py-2.5 lg:py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Данные ERP</span>
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Прогноз AI</span>
                </div>
                <span className="text-[8px]">v2.5 Analytical Kernel</span>
            </div>

            {/* Date Edit Modal */}
            {isEditingDates && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsEditingDates(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-2xl font-black text-slate-900 mb-6">Изменить период</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Дата начала</label>
                                <input
                                    type="month"
                                    value={`${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`}
                                    onChange={(e) => {
                                        const [year, month] = e.target.value.split('-');
                                        setStartDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                                    }}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Дата окончания</label>
                                <input
                                    type="month"
                                    value={`${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`}
                                    onChange={(e) => {
                                        const [year, month] = e.target.value.split('-');
                                        setEndDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                                    }}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsEditingDates(false)}
                                className="flex-1 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all"
                            >
                                Применить
                            </button>
                            <button
                                onClick={() => setIsEditingDates(false)}
                                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-50 transition-all"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-2xl font-black text-slate-900 mb-6">Пригласить к просмотру</h3>

                        <p className="text-sm text-slate-600 mb-4">
                            Пригласите коллег для просмотра финансовой модели. Они смогут видеть данные, но не редактировать их.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    placeholder="email@example.com"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Уровень доступа</label>
                                <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none">
                                    <option>Только просмотр</option>
                                    <option>Просмотр и комментарии</option>
                                    <option>Полный доступ</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowInviteModal(false);
                                    alert('Приглашение отправлено!');
                                }}
                                className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all"
                            >
                                Отправить приглашение
                            </button>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-50 transition-all"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Mode Notification */}
            {isEditMode && (
                <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 z-40 animate-fade-in">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Режим редактирования активен
                </div>
            )}
        </div>
    );
};

export default FinancialModel;
