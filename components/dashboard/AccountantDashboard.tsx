import React, { useMemo, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Users, Wallet, Plus, Edit2, Trash2, CheckSquare, Clock } from 'lucide-react';
import { Client, Project, Task, Transaction, User } from '../../types';
import { MetricCard } from './DashboardWidgets';

interface AccountantDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  transactions: Transaction[];
  users: User[];
  currentUser: User;
  onAddTransaction: (transaction: Transaction) => void | Promise<void>;
  onUpdateTransaction: (transaction: Transaction) => void | Promise<void>;
  onDeleteTransaction: (id: string) => void | Promise<void>;
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
  onDeleteTransaction
}) => {
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    projectId: '',
    category: 'income'
  });
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

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [transactions]);

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

  const handleSubmitTransaction = async () => {
    if (!formData.description || !formData.amount || !formData.date) {
      alert('Заполните все обязательные поля');
      return;
    }

    const transactionData: any = {
      id: editingTransaction?.id || crypto.randomUUID(),
      description: formData.description,
      amount: formData.category === 'expense' ? -Math.abs(parseFloat(formData.amount)) : Math.abs(parseFloat(formData.amount)),
      date: formData.date,
      clientId: formData.clientId || undefined,
      projectId: formData.projectId || undefined,
      createdAt: editingTransaction?.createdAt || new Date().toISOString(),
      createdBy: currentUser.id
    };

    if (editingTransaction) {
      await onUpdateTransaction(transactionData);
    } else {
      await onAddTransaction(transactionData);
    }

    setShowTransactionForm(false);
    setEditingTransaction(null);
    setFormData({
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      clientId: '',
      projectId: '',
      category: 'income'
    });
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      description: transaction.description || '',
      amount: Math.abs(transaction.amount).toString(),
      date: transaction.date,
      clientId: transaction.clientId || '',
      projectId: transaction.projectId || '',
      category: transaction.amount > 0 ? 'income' : 'expense'
    });
    setShowTransactionForm(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Удалить транзакцию?')) {
      await onDeleteTransaction(id);
    }
  };


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

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Журнал платежей
          </h3>
          <button
            onClick={() => {
              setShowTransactionForm(!showTransactionForm);
              setEditingTransaction(null);
              setFormData({
                description: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                clientId: '',
                projectId: '',
                category: 'income'
              });
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить платеж
          </button>
        </div>

        {showTransactionForm && (
          <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="text-sm font-semibold text-white mb-3">
              {editingTransaction ? 'Редактировать платеж' : 'Новый платеж'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Описание *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Оплата от клиента"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Тип *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="income">Приход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Сумма (₸) *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Дата *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Клиент</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Не выбрано</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.legalName || client.company || client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Проект</label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Не выбрано</option>
                  {projects
                    .filter(p => !formData.clientId || p.clientId === formData.clientId)
                    .map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmitTransaction}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {editingTransaction ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase">Дата</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase">Описание</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase">Клиент</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase">Проект</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase">Сумма</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase w-24">Действия</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => {
                  const client = clients.find(c => c.id === transaction.clientId);
                  const project = projects.find(p => p.id === transaction.projectId);
                  const clientLegalName = client ? (client.legalName || client.company || client.name) : '-';

                  return (
                    <tr key={transaction.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-300">
                          {new Date(transaction.date).toLocaleDateString('ru-RU')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-white">{transaction.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-300">{clientLegalName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-300">{project?.name || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className={`text-sm font-bold ${
                          transaction.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString('ru-RU')} ₸
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditTransaction(transaction)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                            title="Редактировать"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {recentTransactions.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Нет транзакций</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountantDashboard;
