import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Users, Wallet, CheckSquare, Clock } from 'lucide-react';
import { Client, Project, Task, Transaction, User } from '../../types';
import { MetricCard } from './DashboardWidgets';
import TransactionJournal from '../TransactionJournal';

interface AccountantDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  transactions: Transaction[];
  users: User[];
  currentUser: User;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'isVerified'>) => void;
  onUpdateTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onCreateClient?: (client: { name: string; company: string; bin: string }) => Promise<Client>;
  onReconcile?: (existingId: string, bankData: { amount: number; clientName: string; bin: string; docNumber: string }) => Promise<void>;
}

const AccountantDashboard: React.FC<AccountantDashboardProps> = ({
  clients,
  projects,
  tasks,
  transactions,
  users,
  currentUser,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onCreateClient,
  onReconcile
}) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const financialMetrics = useMemo(() => {
    const activeProjectIds = new Set(
      projects.filter(p => p.status !== 'Archived').map(p => p.id)
    );

    const thisMonthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      const isThisMonth = date >= startOfMonth && date <= endOfMonth;
      const isActiveProject = !t.projectId || activeProjectIds.has(t.projectId);
      return isThisMonth && isActiveProject;
    });

    const income = thisMonthTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = Math.abs(
      thisMonthTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    const profit = income - expenses;

    const upcomingPayments = transactions.filter(t => {
      const date = new Date(t.date);
      const isUpcoming = date > today && date <= nextWeek;
      const isActiveProject = !t.projectId || activeProjectIds.has(t.projectId);
      return isUpcoming && isActiveProject;
    });

    const upcomingIncome = upcomingPayments
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const upcomingExpenses = Math.abs(
      upcomingPayments
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    return {
      income,
      expenses,
      profit,
      profitMargin: income > 0 ? ((profit / income) * 100).toFixed(1) : '0',
      upcomingIncome,
      upcomingExpenses,
      cashGap: upcomingIncome - upcomingExpenses
    };
  }, [transactions, projects, startOfMonth, endOfMonth, today, nextWeek]);

  const receivables = useMemo(() => {
    return projects
      .filter(p => p.status !== 'Archived' && p.status !== 'Completed')
      .map(project => {
        const client = clients.find(c => c.id === project.clientId);
        const projectTransactions = transactions.filter(t => t.projectId === project.id);
        const totalPaid = projectTransactions
          .filter(t => t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0);
        const debt = project.budget - totalPaid;

        const lastPayment = projectTransactions
          .filter(t => t.amount > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const daysOverdue = lastPayment
          ? Math.floor((today.getTime() - new Date(lastPayment.date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        const clientLegalName = client?.legalName || client?.company || client?.name || 'Неизвестный клиент';

        return {
          projectName: project.name,
          clientName: clientLegalName,
          debt,
          totalBudget: project.budget,
          paid: totalPaid,
          paymentPercent: project.budget > 0 ? ((totalPaid / project.budget) * 100).toFixed(0) : '0',
          daysOverdue,
          isOverdue: daysOverdue > 30 && debt > 0
        };
      })
      .filter(r => r.debt > 0)
      .sort((a, b) => b.debt - a.debt);
  }, [projects, clients, transactions, today]);

  const totalReceivables = receivables.reduce((sum, r) => sum + r.debt, 0);
  const overdueReceivables = receivables.filter(r => r.isOverdue).reduce((sum, r) => sum + r.debt, 0);

  const myTasks = useMemo(() => {
    return tasks
      .filter(t => t.assigneeId === currentUser.id && t.status !== 'Done')
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      })
      .slice(0, 5);
  }, [tasks, currentUser.id]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Доход за месяц"
          value={`${financialMetrics.income.toLocaleString('ru-RU')} ₸`}
          icon={TrendingUp}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <MetricCard
          title="Расходы за месяц"
          value={`${financialMetrics.expenses.toLocaleString('ru-RU')} ₸`}
          icon={TrendingDown}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />

        <MetricCard
          title="Прибыль за месяц"
          value={`${financialMetrics.profit.toLocaleString('ru-RU')} ₸`}
          subtitle={`Маржа: ${financialMetrics.profitMargin}%`}
          icon={DollarSign}
          iconBgColor={financialMetrics.profit > 0 ? 'bg-emerald-50' : 'bg-rose-50'}
          iconColor={financialMetrics.profit > 0 ? 'text-emerald-600' : 'text-rose-600'}
          alert={financialMetrics.profit > 0 ? 'success' : financialMetrics.profit < 0 ? 'danger' : undefined}
        />

        <MetricCard
          title="Дебиторская задолженность"
          value={`${totalReceivables.toLocaleString('ru-RU')} ₸`}
          subtitle={overdueReceivables > 0 ? `Просрочено: ${overdueReceivables.toLocaleString('ru-RU')} ₸` : 'Нет просрочек'}
          icon={Wallet}
          iconBgColor={overdueReceivables > 0 ? 'bg-amber-50' : 'bg-blue-50'}
          iconColor={overdueReceivables > 0 ? 'text-amber-600' : 'text-blue-600'}
          alert={overdueReceivables > 0 ? 'warning' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-400" />
              Мои задачи
            </h3>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
              {myTasks.length} активных
            </div>
          </div>

          {myTasks.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {myTasks.map((task) => {
                const project = projects.find(p => p.id === task.projectId);
                const isOverdue = task.deadline && new Date(task.deadline) < new Date();

                return (
                  <div key={task.id} className="p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{task.title}</div>
                        {project && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {project.name}
                          </div>
                        )}
                      </div>
                      <div className={`px-2 py-0.5 rounded text-xs font-medium ml-2 ${
                        task.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' :
                        task.status === 'To Do' ? 'bg-slate-500/20 text-slate-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {task.status}
                      </div>
                    </div>
                    {task.deadline && (
                      <div className={`flex items-center gap-1 mt-2 text-xs ${
                        isOverdue ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {new Date(task.deadline).toLocaleDateString('ru-RU')}
                        {isOverdue && ' (Просрочено)'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Нет активных задач</p>
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Дебиторская задолженность
          </h3>

          {receivables.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {receivables.slice(0, 10).map((item, index) => (
                <div key={index} className="p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{item.clientName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.projectName}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Оплачено: {item.paid.toLocaleString('ru-RU')} ₸ из {item.totalBudget.toLocaleString('ru-RU')} ₸
                        ({item.paymentPercent}%)
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-sm font-bold ${item.isOverdue ? 'text-rose-400' : 'text-amber-400'}`}>
                        {item.debt.toLocaleString('ru-RU')} ₸
                      </div>
                      {item.isOverdue && (
                        <div className="text-xs text-rose-400 mt-0.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Просрочка {item.daysOverdue} дн.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`}
                      style={{ width: `${item.paymentPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Нет задолженностей</p>
            </div>
          )}
        </div>
      </div>

      <TransactionJournal
        transactions={transactions}
        clients={clients}
        projects={projects}
        users={users}
        onAddTransaction={onAddTransaction}
        onUpdateTransaction={onUpdateTransaction}
        onDeleteTransaction={onDeleteTransaction}
        onCreateClient={onCreateClient}
        onReconcile={onReconcile}
      />
    </div>
  );
};

export default AccountantDashboard;
