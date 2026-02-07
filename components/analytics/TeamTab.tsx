import React, { useState, useEffect, useMemo } from 'react';
import { User, Task, Project, Transaction, ProjectStatus, TaskStatus } from '../../types';
import { financialEngineService, PayrollUserBreakdown } from '../../services/financialEngineService';
import UserAvatar from '../UserAvatar';

interface TeamTabProps {
  users: User[];
  tasks: Task[];
  projects: Project[];
  transactions: Transaction[];
}

const UI = {
  CARD: "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md h-full",
  LABEL: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5",
  VALUE: "text-2xl font-black text-slate-900 tracking-tighter"
};

const fmt = (v: number) => `${Math.round(v).toLocaleString()} ₸`;

const TeamTab: React.FC<TeamTabProps> = ({ users, tasks, projects, transactions }) => {
  const [payrollCosts, setPayrollCosts] = useState<Record<string, number>>({});
  const [payrollPerUser, setPayrollPerUser] = useState<PayrollUserBreakdown[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const navigateMonth = (direction: 'prev' | 'next') => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + (direction === 'prev' ? -1 : 1));
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  useEffect(() => {
    Promise.all([
      financialEngineService.loadPayrollCostPerUser(selectedMonth),
      financialEngineService.loadPayrollBreakdownPerUser(selectedMonth),
    ]).then(([costs, breakdown]) => {
      setPayrollCosts(costs);
      setPayrollPerUser(breakdown);
    });
  }, [selectedMonth]);

  const totalRevenue = useMemo(
    () => (Array.isArray(transactions) ? transactions : []).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  const teamData = useMemo(() => {
    const revPerEmployee = totalRevenue / (users.length || 1);
    const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE);
    const totalTasks = tasks.length;

    const activeProjects = projects.filter(p =>
      p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED
    );

    const maxProjectsForRole: Record<string, number> = {
      'SMM manager': 10,
      'Мобилограф': 6,
      'Фотограф': 5,
      'Видеограф': 4,
      'Таргетолог': 8,
      'Project manager': 12,
      'Sales manager': 15,
      'CEO': 20,
    };

    const workload = users.map(u => {
      const userProjects = activeProjects.filter(p => p.teamIds && p.teamIds.includes(u.id));
      const userTasks = tasks.filter(t => t.assigneeId === u.id);
      const userCompletedTasks = userTasks.filter(t => t.status === TaskStatus.DONE);
      const projectRevenue = userProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
      const cost = payrollCosts[u.id] || 0;
      const userPayroll = payrollPerUser.find(p => p.userId === u.id);
      const roleMax = maxProjectsForRole[u.jobTitle || ''] || 8;
      const utilization = roleMax > 0 ? (userProjects.length / roleMax) * 100 : 0;
      const roi = cost > 0 ? ((projectRevenue / cost) - 1) * 100 : 0;

      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        role: u.jobTitle || 'Сотрудник',
        projectCount: userProjects.length,
        taskCount: userTasks.length,
        completedTasks: userCompletedTasks.length,
        taskCompletion: userTasks.length > 0 ? (userCompletedTasks.length / userTasks.length) * 100 : 0,
        projectRevenue,
        cost,
        fixSalary: userPayroll?.fixSalary || 0,
        kpiEarned: userPayroll?.kpiEarned || 0,
        bonuses: userPayroll?.bonuses || 0,
        penalties: userPayroll?.penalties || 0,
        payrollStatus: userPayroll?.status || '',
        profit: projectRevenue - cost,
        roi,
        utilization: Math.min(100, utilization),
        roleMax,
      };
    }).sort((a, b) => b.projectRevenue - a.projectRevenue);

    const roleBreakdown = users.reduce((acc, u) => {
      const role = u.jobTitle || 'Без должности';
      if (!acc[role]) acc[role] = { count: 0, projects: 0, totalCost: 0 };
      acc[role].count++;
      acc[role].projects += activeProjects.filter(p => p.teamIds && p.teamIds.includes(u.id)).length;
      acc[role].totalCost += payrollCosts[u.id] || 0;
      return acc;
    }, {} as Record<string, { count: number; projects: number; totalCost: number }>);

    const totalWorkloadRevenue = workload.reduce((s, w) => s + w.projectRevenue, 0);

    const totalPayrollCost = Object.values(payrollCosts).reduce((s, v) => s + v, 0);
    const avgUtilization = workload.length > 0
      ? workload.reduce((s, w) => s + w.utilization, 0) / workload.length : 0;

    const capacityLeft = workload.reduce((s, w) => {
      const freeSlots = Math.max(0, w.roleMax - w.projectCount);
      return s + freeSlots;
    }, 0);

    return {
      revPerEmployee,
      totalRevenue,
      totalEmployees: users.length,
      totalTasks,
      completedTasksCount: completedTasks.length,
      taskCompletionRate: totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0,
      workload,
      roleBreakdown,
      totalPayrollCost,
      avgUtilization,
      capacityLeft,
      costPerRevenue: totalRevenue > 0 ? (totalPayrollCost / totalRevenue) * 100 : 0,
      totalWorkloadRevenue,
      teamRoi: totalPayrollCost > 0 ? ((totalWorkloadRevenue / totalPayrollCost) - 1) * 100 : 0,
    };
  }, [users, projects, tasks, totalRevenue, payrollCosts, payrollPerUser]);

  const monthLabel = useMemo(() =>
    new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    [selectedMonth]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-2xl font-black text-slate-900">Команда и HR</h3>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1">Эффективность за {monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center min-w-[140px]">
            <div className="text-sm font-black text-slate-900">
              {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long' })}
            </div>
            <div className="text-xs text-slate-500 font-bold">{new Date(selectedMonth + '-01').getFullYear()}</div>
          </div>
          <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Сотрудников</p>
          <p className={UI.VALUE}>{teamData.totalEmployees}</p>
        </div>
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Выручка / сотрудник</p>
          <p className="text-2xl font-black text-blue-600 tracking-tighter">{fmt(teamData.revPerEmployee)}</p>
        </div>
        <div className={UI.CARD}>
          <p className={UI.LABEL}>Задач выполнено</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tighter">
            {teamData.completedTasksCount} / {teamData.totalTasks}
          </p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{teamData.taskCompletionRate.toFixed(0)}% выполнение</p>
        </div>
        <div className={UI.CARD}>
          <div className="group relative">
            <p className={UI.LABEL}>
              Утилизация команды
              <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
            </p>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-60 shadow-xl">
              Средняя загрузка команды. Показывает какой процент от максимальной проектной мощности используется. 70-85% -- идеально.
            </div>
          </div>
          <p className={`text-2xl font-black tracking-tighter ${
            teamData.avgUtilization > 85 ? 'text-rose-600' :
            teamData.avgUtilization > 60 ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {teamData.avgUtilization.toFixed(0)}%
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2">
            <div
              className={`h-full rounded-full transition-all ${
                teamData.avgUtilization > 85 ? 'bg-rose-500' :
                teamData.avgUtilization > 60 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${teamData.avgUtilization}%` }}
            />
          </div>
        </div>
        <div className={UI.CARD}>
          <div className="group relative">
            <p className={UI.LABEL}>
              Свободная мощность
              <span className="inline-block w-3 h-3 text-center leading-3 rounded-full bg-slate-200 text-[7px] font-black text-slate-500 cursor-help ml-1">?</span>
            </p>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-slate-800 text-white text-[10px] p-3 rounded-lg z-10 w-60 shadow-xl">
              Количество дополнительных проектных слотов, которые команда может взять без перегрузки.
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 tracking-tighter">{teamData.capacityLeft}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">проектных слотов</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className={`${UI.CARD} xl:col-span-4`}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full" /> Состав и стоимость команды
          </h3>
          <div className="space-y-3">
            {Object.entries(teamData.roleBreakdown).sort((a, b) => b[1].count - a[1].count).map(([role, data]) => (
              <div key={role} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-bold text-slate-800">{role}</p>
                  <p className="text-[9px] text-slate-400 font-bold">{data.projects} проектов</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-black text-slate-700">{data.count}</span>
                  {data.totalCost > 0 && (
                    <p className="text-[9px] text-slate-400 font-bold mt-1">{fmt(data.totalCost)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {teamData.totalPayrollCost > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase">Итого ФОТ</span>
                <span className="text-sm font-black text-slate-900">{fmt(teamData.totalPayrollCost)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-black text-slate-500 uppercase">ФОТ / Выручка</span>
                <span className={`text-sm font-black ${
                  teamData.costPerRevenue < 35 ? 'text-emerald-600' : teamData.costPerRevenue < 50 ? 'text-amber-600' : 'text-rose-600'
                }`}>{teamData.costPerRevenue.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-black text-slate-500 uppercase">ROI команды</span>
                <span className={`text-sm font-black ${
                  teamData.teamRoi > 100 ? 'text-emerald-600' : teamData.teamRoi > 0 ? 'text-blue-600' : 'text-rose-600'
                }`}>{teamData.teamRoi > 0 ? '+' : ''}{teamData.teamRoi.toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>

        <div className={`${UI.CARD} xl:col-span-8`}>
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" /> Эффективность и загрузка сотрудников
          </h3>
          {teamData.workload.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="pb-4">Сотрудник</th>
                    <th className="pb-4 text-right">Проекты</th>
                    <th className="pb-4 text-right">Задачи</th>
                    <th className="pb-4 text-right">Выполнено</th>
                    <th className="pb-4 text-right">Утилизация</th>
                    {teamData.totalPayrollCost > 0 && (
                      <>
                        <th className="pb-4 text-right">Фикс</th>
                        <th className="pb-4 text-right">KPI</th>
                        <th className="pb-4 text-right">Итого ФОТ</th>
                        <th className="pb-4 text-right">ROI</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teamData.workload.map((u) => {
                    const isOverloaded = u.utilization >= 90;
                    const isWarning = u.utilization >= 70;
                    return (
                      <tr key={u.id} className="group hover:bg-slate-50/50 transition-all">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar src={u.avatar} name={u.name} size="sm" className="rounded-lg" />
                            <div>
                              <span className="font-black text-slate-800 text-sm">{u.name}</span>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">{u.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right font-black text-slate-900 text-sm">
                          {u.projectCount}
                          <span className="text-[9px] text-slate-400 font-bold ml-1">/ {u.roleMax}</span>
                        </td>
                        <td className="py-4 text-right text-slate-600 text-sm">{u.taskCount}</td>
                        <td className="py-4 text-right">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            u.taskCompletion > 70 ? 'bg-emerald-50 text-emerald-600' :
                            u.taskCompletion > 40 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {u.taskCompletion.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-4 text-right w-36">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isOverloaded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${u.utilization}%` }}
                              />
                            </div>
                            <span className={`text-[9px] font-black ${
                              isOverloaded ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-500'
                            }`}>
                              {u.utilization.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        {teamData.totalPayrollCost > 0 && (
                          <>
                            <td className="py-4 text-right text-[10px] font-bold text-slate-400">
                              {u.fixSalary > 0 ? fmt(u.fixSalary) : '--'}
                            </td>
                            <td className="py-4 text-right text-[10px] font-bold text-blue-500">
                              {u.kpiEarned > 0 ? fmt(u.kpiEarned) : '--'}
                              {u.bonuses > 0 && <div className="text-emerald-500">+{fmt(u.bonuses)}</div>}
                            </td>
                            <td className="py-4 text-right text-xs font-bold text-slate-700">
                              {u.cost > 0 ? fmt(u.cost) : '--'}
                            </td>
                            <td className="py-4 text-right">
                              {u.cost > 0 ? (
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                  u.roi > 100 ? 'bg-emerald-50 text-emerald-600' :
                                  u.roi > 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {u.roi > 0 ? '+' : ''}{u.roi.toFixed(0)}%
                                </span>
                              ) : <span className="text-xs text-slate-300">--</span>}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">Нет данных по сотрудникам</p>
            </div>
          )}
        </div>
      </div>

      {teamData.avgUtilization > 85 && (
        <div className={`${UI.CARD} border-l-4 border-l-rose-400 bg-rose-50/30`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Команда перегружена (утилизация {teamData.avgUtilization.toFixed(0)}%)</p>
              <p className="text-xs text-slate-600 mt-1">
                Осталось {teamData.capacityLeft} свободных проектных слотов. При текущей загрузке качество работы может снизиться.
                Рассмотрите найм дополнительных сотрудников или перераспределение нагрузки.
              </p>
            </div>
          </div>
        </div>
      )}

      {teamData.avgUtilization < 50 && teamData.totalEmployees > 3 && (
        <div className={`${UI.CARD} border-l-4 border-l-amber-400 bg-amber-50/30`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Низкая утилизация команды ({teamData.avgUtilization.toFixed(0)}%)</p>
              <p className="text-xs text-slate-600 mt-1">
                Команда из {teamData.totalEmployees} человек загружена менее чем наполовину.
                {teamData.totalPayrollCost > 0 ? ` ФОТ составляет ${fmt(teamData.totalPayrollCost)} при текущей загрузке.` : ''}
                Рекомендация: увеличьте количество проектов или оптимизируйте штат.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamTab;
