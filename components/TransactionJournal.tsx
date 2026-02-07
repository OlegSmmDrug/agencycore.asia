import React, { useState, useMemo } from 'react';
import { Plus, Download, Upload, Search, Calendar, DollarSign, User as UserIcon, X, Clock, CheckCircle, AlertTriangle, Building2 } from 'lucide-react';
import { Transaction, Client, PaymentType, Project, User, ReconciliationStatus } from '../types';
import Modal from './Modal';
import BankImportModal from './BankImportModal';

interface Props {
  transactions: Transaction[];
  clients: Client[];
  projects: Project[];
  users: User[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'isVerified'>) => void;
  onCreateClient?: (client: { name: string; company: string; bin: string }) => Promise<Client>;
  onReconcile?: (existingId: string, bankData: {
    amount: number;
    clientName: string;
    bin: string;
    docNumber: string;
  }) => Promise<void>;
}

const PAYMENT_TYPES = [
  { value: PaymentType.PREPAYMENT, label: 'Предоплата' },
  { value: PaymentType.FULL, label: 'Полная оплата' },
  { value: PaymentType.POSTPAYMENT, label: 'Постоплата' },
  { value: PaymentType.RETAINER, label: 'Ретейнер (Абонплата)' },
  { value: PaymentType.REFUND, label: 'Возврат' },
];

const RECONCILIATION_STATUS_CONFIG: Record<string, { icon: typeof Clock; text: string; bg: string; label: string }> = {
  manual: { icon: Clock, text: 'text-gray-500', bg: 'bg-gray-100', label: 'Ручной ввод' },
  verified: { icon: CheckCircle, text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Сверено' },
  discrepancy: { icon: AlertTriangle, text: 'text-amber-700', bg: 'bg-amber-50', label: 'Расхождение' },
  bank_import: { icon: Building2, text: 'text-blue-700', bg: 'bg-blue-50', label: 'Банковский импорт' },
};

export default function TransactionJournal({ transactions, clients, projects, users, onAddTransaction, onCreateClient, onReconcile }: Props) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PaymentType | 'all'>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterManager, setFilterManager] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterReconciliation, setFilterReconciliation] = useState<ReconciliationStatus | 'all'>('all');

  const [newTransaction, setNewTransaction] = useState<{
    clientId: string;
    projectId?: string;
    amount: number;
    date: string;
    type: PaymentType;
    description: string;
  }>({
    clientId: '',
    projectId: undefined,
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    type: PaymentType.PREPAYMENT,
    description: '',
  });

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const client = clients.find(c => c.id === t.clientId);
        return (
          client?.company.toLowerCase().includes(query) ||
          client?.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.bankClientName?.toLowerCase().includes(query)
        );
      });
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    if (filterClient !== 'all') {
      filtered = filtered.filter(t => t.clientId === filterClient);
    }

    if (filterManager !== 'all') {
      filtered = filtered.filter(t => t.createdBy === filterManager);
    }

    if (filterProject !== 'all') {
      filtered = filtered.filter(t => t.projectId === filterProject);
    }

    if (filterDateFrom) {
      filtered = filtered.filter(t => new Date(t.date) >= new Date(filterDateFrom));
    }

    if (filterDateTo) {
      filtered = filtered.filter(t => new Date(t.date) <= new Date(filterDateTo));
    }

    if (filterReconciliation !== 'all') {
      filtered = filtered.filter(t => t.reconciliationStatus === filterReconciliation);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, clients, searchQuery, filterType, filterClient, filterManager, filterProject, filterDateFrom, filterDateTo, filterReconciliation]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTransaction.clientId || !newTransaction.amount) {
      alert('Заполните обязательные поля: клиент и сумма');
      return;
    }

    onAddTransaction({
      ...newTransaction,
      date: newTransaction.date || new Date().toISOString(),
      reconciliationStatus: 'manual',
    });

    setNewTransaction({
      clientId: '',
      projectId: undefined,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      type: PaymentType.PREPAYMENT,
      description: '',
    });

    setIsAddModalOpen(false);
  };

  const resetForm = () => {
    setNewTransaction({
      clientId: '',
      projectId: undefined,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      type: PaymentType.PREPAYMENT,
      description: '',
    });
    setIsAddModalOpen(false);
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.company || client?.name || 'Неизвестный клиент';
  };

  const getPaymentTypeLabel = (type: PaymentType) => {
    return PAYMENT_TYPES.find(pt => pt.value === type)?.label || type;
  };

  const handleBankImport = (items: Array<{
    clientId: string;
    amount: number;
    date: string;
    type: PaymentType;
    description: string;
    reconciliationStatus: ReconciliationStatus;
    bankDocumentNumber: string;
    bankAmount: number;
    bankClientName: string;
    bankBin: string;
  }>) => {
    items.forEach(item => {
      onAddTransaction(item);
    });
  };

  const exportToCSV = () => {
    const headers = ['Дата', 'Клиент', 'Тип платежа', 'Сумма', 'Статус сверки', 'Описание'];
    const rows = filteredTransactions.map(t => [
      new Date(t.date).toLocaleDateString('ru-RU'),
      getClientName(t.clientId),
      getPaymentTypeLabel(t.type),
      t.amount.toString(),
      RECONCILIATION_STATUS_CONFIG[t.reconciliationStatus || 'manual']?.label || '',
      t.description || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getReconciliationBadge = (status: ReconciliationStatus | undefined) => {
    const config = RECONCILIATION_STATUS_CONFIG[status || 'manual'];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${config.text} ${config.bg}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Журнал платежей</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Всего транзакций: {filteredTransactions.length} на сумму {totalAmount.toLocaleString('ru-RU')} T
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex-1 sm:flex-initial"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Экспорт</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 flex-1 sm:flex-initial"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Импорт выписки</span>
            <span className="sm:hidden">Импорт</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-1 sm:flex-initial"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Добавить</span>
            <span className="sm:hidden">Добавить</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по клиенту или описанию..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as PaymentType | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все типы платежей</option>
              {PAYMENT_TYPES.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>

            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все клиенты</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.company || client.name}</option>
              ))}
            </select>

            <select
              value={filterManager}
              onChange={(e) => setFilterManager(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все менеджеры</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>

            <select
              value={filterReconciliation}
              onChange={(e) => setFilterReconciliation(e.target.value as ReconciliationStatus | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все статусы сверки</option>
              <option value="manual">Ручной ввод</option>
              <option value="verified">Сверено</option>
              <option value="discrepancy">Расхождение</option>
              <option value="bank_import">Банковский импорт</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все проекты</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>

            <div>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                placeholder="Дата с"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                placeholder="Дата по"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {(searchQuery || filterType !== 'all' || filterClient !== 'all' || filterManager !== 'all' || filterProject !== 'all' || filterDateFrom || filterDateTo || filterReconciliation !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setFilterClient('all');
                setFilterManager('all');
                setFilterProject('all');
                setFilterDateFrom('');
                setFilterDateTo('');
                setFilterReconciliation('all');
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg w-full md:w-auto"
            >
              <X className="h-4 w-4" />
              Сбросить все фильтры
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет транзакций</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filterType !== 'all' || filterClient !== 'all'
                ? 'Попробуйте изменить фильтры'
                : 'Добавьте первый платеж'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Добавить платеж
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип платежа</th>
                  <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Сумма</th>
                  <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Сверка</th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Описание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map(transaction => (
                  <tr
                    key={transaction.id}
                    className={`hover:bg-gray-50 ${transaction.amountDiscrepancy ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(transaction.date).toLocaleDateString('ru-RU')}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {getClientName(transaction.clientId)}
                          </span>
                          {transaction.bankBin && (
                            <span className="ml-1 text-xs text-gray-400">({transaction.bankBin})</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {getPaymentTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-semibold ${transaction.amountDiscrepancy ? 'text-amber-600' : transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {transaction.amount < 0 ? '' : '+'}{transaction.amount.toLocaleString('ru-RU')} T
                      </span>
                      {transaction.amountDiscrepancy && transaction.bankAmount && transaction.bankAmount !== transaction.amount && (
                        <div className="text-xs text-amber-500">
                          банк: {transaction.bankAmount.toLocaleString('ru-RU')} T
                        </div>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-center">
                      {getReconciliationBadge(transaction.reconciliationStatus)}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className="text-sm text-gray-600 line-clamp-1">{transaction.description || '--'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BankImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        clients={clients}
        transactions={transactions}
        onImport={handleBankImport}
        onCreateClient={onCreateClient}
        onReconcile={onReconcile}
      />

      <Modal isOpen={isAddModalOpen} onClose={resetForm} title="Добавить платеж">
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клиент / Юр. лицо *</label>
            <select
              value={newTransaction.clientId}
              onChange={(e) => setNewTransaction({ ...newTransaction, clientId: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Выберите клиента</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company || client.name} {client.inn ? `(ИНН: ${client.inn})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сумма *</label>
              <input
                type="number"
                value={newTransaction.amount || ''}
                onChange={(e) => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
                onFocus={(e) => e.target.select()}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата *</label>
              <input
                type="date"
                value={newTransaction.date}
                onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип платежа *</label>
            <select
              value={newTransaction.type}
              onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value as PaymentType })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_TYPES.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={newTransaction.description}
              onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Описание платежа (необязательно)"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Добавить платеж
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
