import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, FileText, CheckCircle, AlertTriangle, XCircle, Check, X,
  ChevronDown, ChevronUp, Building2, Link2, UserPlus, Search
} from 'lucide-react';
import { Client, PaymentType, Transaction, BankCounterpartyAlias, ReconciliationStatus } from '../types';
import { ParsedTransaction, ImportResult, parseStatementFile, CompanyInfo } from '../services/bankStatementParser';
import { reconciliationService } from '../services/reconciliationService';
import { executorCompanyService } from '../services/executorCompanyService';
import Modal from './Modal';

interface BankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  transactions: Transaction[];
  onImport: (items: Array<{
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
  }>) => void;
  onCreateClient?: (client: { name: string; company: string; bin: string }) => Promise<Client>;
  onReconcile?: (existingId: string, bankData: {
    amount: number;
    clientName: string;
    bin: string;
    docNumber: string;
  }) => Promise<void>;
}

const MATCH_STATUS_CONFIG = {
  matched: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Найден', icon: CheckCircle },
  unmatched: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Новый', icon: AlertTriangle },
  duplicate: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Дубликат', icon: XCircle },
} as const;

const RECONCILIATION_CONFIG = {
  verified: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Сверено', icon: CheckCircle },
  discrepancy: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Расхождение', icon: AlertTriangle },
  new: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Новая запись', icon: Building2 },
} as const;

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  [PaymentType.PREPAYMENT]: 'Предоплата',
  [PaymentType.FULL]: 'Полная оплата',
  [PaymentType.POSTPAYMENT]: 'Постоплата',
  [PaymentType.RETAINER]: 'Ретейнер',
  [PaymentType.REFUND]: 'Возврат',
};

const MATCH_SOURCE_LABELS: Record<string, string> = {
  bin: 'по БИН',
  alias: 'по памяти',
  name: 'по названию',
  none: '',
};

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankName: string;
  bankBin: string;
  clients: Client[];
  onCreateNew: (name: string, company: string) => void;
  onLinkExisting: (clientId: string) => void;
}

function NewClientModal({ isOpen, onClose, bankName, bankBin, clients, onCreateNew, onLinkExisting }: NewClientModalProps) {
  const [mode, setMode] = useState<'choose' | 'link'>('choose');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMode('choose');
    setSearchQuery('');
  }, [bankName]);

  const filteredClients = clients.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.company?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.bin?.includes(q));
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Новый контрагент</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-900">{bankName}</p>
            {bankBin && <p className="text-gray-500 mt-1">БИН/ИИН: {bankBin}</p>}
          </div>

          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => onCreateNew(bankName, bankName)}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                <UserPlus className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Создать нового контрагента</p>
                  <p className="text-xs text-gray-500">{bankName}</p>
                </div>
              </button>
              <button
                onClick={() => setMode('link')}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors text-left"
              >
                <Link2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Привязать к существующему</p>
                  <p className="text-xs text-gray-500">Выбрать из списка клиентов</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'link' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени или БИН..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onLinkExisting(c.id)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.company || c.name}</p>
                      {c.bin && <p className="text-xs text-gray-500">БИН: {c.bin}</p>}
                    </div>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="px-3 py-4 text-sm text-gray-500 text-center">Клиенты не найдены</p>
                )}
              </div>
              <button onClick={() => setMode('choose')} className="text-sm text-gray-500 hover:text-gray-700">Назад</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BankImportModal({ isOpen, onClose, clients, transactions, onImport, onCreateClient, onReconcile }: BankImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [clientOverrides, setClientOverrides] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importSummary, setImportSummary] = useState({ imported: 0, reconciled: 0, skipped: 0, created: 0 });
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [aliases, setAliases] = useState<BankCounterpartyAlias[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | undefined>();
  const [companyInfoLoaded, setCompanyInfoLoaded] = useState(false);
  const [newClientModal, setNewClientModal] = useState<{ rowIndex: number; bankName: string; bankBin: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const companyInfoRef = useRef<CompanyInfo | undefined>();

  useEffect(() => {
    companyInfoRef.current = companyInfo;
  }, [companyInfo]);

  useEffect(() => {
    if (isOpen) {
      setCompanyInfoLoaded(false);
      reconciliationService.getAliases().then(setAliases);
      executorCompanyService.getDefault()
        .then(company => {
          if (company?.bin || company?.iban) {
            const info = { bin: company.bin || '', iban: company.iban || '' };
            setCompanyInfo(info);
            companyInfoRef.current = info;
          }
          setCompanyInfoLoaded(true);
        })
        .catch(async () => {
          try {
            const companies = await executorCompanyService.getAll();
            if (companies.length > 0) {
              const first = companies[0];
              if (first.bin || first.iban) {
                const info = { bin: first.bin || '', iban: first.iban || '' };
                setCompanyInfo(info);
                companyInfoRef.current = info;
              }
            }
          } catch (_) { /* ignore */ }
          setCompanyInfoLoaded(true);
        });
    }
  }, [isOpen]);

  const handleFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const info = companyInfoRef.current;
      const result = await parseStatementFile(file, clients, transactions, aliases, info);
      if (result.transactions.length === 0) {
        alert('Не удалось распознать платежи в файле. Убедитесь, что формат файла поддерживается.');
        setIsProcessing(false);
        return;
      }
      setImportResult(result);
      const initialSelected = new Set<number>();
      result.transactions.forEach((t, i) => {
        if (t.matchStatus !== 'duplicate') {
          initialSelected.add(i);
        }
      });
      setSelectedRows(initialSelected);
      setStep('preview');
    } catch (err) {
      console.error('Error parsing file:', err);
      alert('Ошибка при чтении файла');
    } finally {
      setIsProcessing(false);
    }
  }, [clients, transactions, aliases]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const toggleRow = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (!importResult) return;
    const nonDuplicateIndices = importResult.transactions
      .map((t, i) => t.matchStatus !== 'duplicate' ? i : -1)
      .filter(i => i >= 0);
    if (selectedRows.size >= nonDuplicateIndices.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(nonDuplicateIndices));
    }
  };

  const handleCreateNewClient = async (rowIndex: number, name: string, company: string) => {
    if (!onCreateClient || !importResult) return;
    const t = importResult.transactions[rowIndex];
    try {
      const newClient = await onCreateClient({ name, company, bin: t.clientBin });
      setClientOverrides(prev => ({ ...prev, [rowIndex]: newClient.id }));
      await reconciliationService.saveAlias(t.clientName, t.clientBin, newClient.id);
      setNewClientModal(null);
    } catch (err) {
      console.error('Error creating client:', err);
    }
  };

  const handleLinkExistingClient = async (rowIndex: number, clientId: string) => {
    if (!importResult) return;
    const t = importResult.transactions[rowIndex];
    setClientOverrides(prev => ({ ...prev, [rowIndex]: clientId }));
    await reconciliationService.saveAlias(t.clientName, t.clientBin, clientId);
    if (t.clientBin) {
      await reconciliationService.updateClientBin(clientId, t.clientBin);
    }
    setNewClientModal(null);
  };

  const handleImport = async () => {
    if (!importResult) return;
    setIsProcessing(true);

    const itemsToImport: Array<{
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
    }> = [];

    let skipped = 0;
    let reconciled = 0;
    let created = 0;

    for (let i = 0; i < importResult.transactions.length; i++) {
      const t = importResult.transactions[i];
      if (!selectedRows.has(i)) {
        skipped++;
        continue;
      }

      const clientId = clientOverrides[i] || t.matchedClientId;
      if (!clientId) {
        skipped++;
        continue;
      }

      if (t.reconciliation.type === 'verified' || t.reconciliation.type === 'discrepancy') {
        const existing = t.reconciliation.existingTransaction;
        if (existing && onReconcile) {
          try {
            await onReconcile(existing.id, {
              amount: t.amount,
              clientName: t.clientName,
              bin: t.clientBin,
              docNumber: t.documentNumber,
            });
            reconciled++;
          } catch (err) {
            console.error('Reconciliation error:', err);
          }
        }
        continue;
      }

      const docTag = t.documentNumber ? ` [DOC:${t.documentNumber}]` : '';
      const rateTag = t.exchangeRate && t.currency === 'USD'
        ? ` [${t.amountOriginal} USD x ${t.exchangeRate}]`
        : '';
      const knpTag = t.knpCode ? ` [KNP:${t.knpCode}]` : '';

      const signedAmount = t.isIncome ? t.amount : -t.amount;
      const directionTag = t.isIncome ? '' : ' [Расход]';

      itemsToImport.push({
        clientId,
        amount: signedAmount,
        date: t.date,
        type: t.paymentType,
        description: (t.description + directionTag + rateTag + knpTag + docTag).trim(),
        reconciliationStatus: 'bank_import',
        bankDocumentNumber: t.documentNumber,
        bankAmount: signedAmount,
        bankClientName: t.clientName,
        bankBin: t.clientBin,
      });

      if (t.matchSource !== 'alias' && clientId) {
        await reconciliationService.saveAlias(t.clientName, t.clientBin, clientId);
      }
      if (t.clientBin && clientId) {
        await reconciliationService.updateClientBin(clientId, t.clientBin);
      }

      created++;
    }

    onImport(itemsToImport);
    setImportSummary({ imported: itemsToImport.length, reconciled, skipped, created });
    setIsProcessing(false);
    setStep('result');
  };

  const handleClose = () => {
    setStep('upload');
    setImportResult(null);
    setSelectedRows(new Set());
    setClientOverrides({});
    setExpandedRow(null);
    setNewClientModal(null);
    onClose();
  };

  const getResolvedClientId = (t: ParsedTransaction, index: number) => clientOverrides[index] || t.matchedClientId;

  const stats = importResult ? {
    total: importResult.transactions.length,
    matched: importResult.transactions.filter(t => t.matchStatus === 'matched').length,
    unmatched: importResult.transactions.filter(t => t.matchStatus === 'unmatched').length,
    duplicates: importResult.transactions.filter(t => t.matchStatus === 'duplicate').length,
    verified: importResult.summary.verified,
    discrepancies: importResult.summary.discrepancies,
    income: importResult.transactions.filter(t => t.isIncome).length,
    expense: importResult.transactions.filter(t => !t.isIncome).length,
    totalIncome: importResult.transactions
      .filter((_, i) => selectedRows.has(i))
      .filter(t => t.isIncome)
      .reduce((sum, t) => sum + t.amount, 0),
    totalExpense: importResult.transactions
      .filter((_, i) => selectedRows.has(i))
      .filter(t => !t.isIncome)
      .reduce((sum, t) => sum + t.amount, 0),
  } : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Импорт банковской выписки" size="5xl">
      <div className="min-h-[400px]">
        {step === 'upload' && (
          <div className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.csv,.xls,.xlsx"
                onChange={handleFileSelect}
              />
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4" />
                  <p className="text-gray-600 font-medium">Обработка файла...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">Перетащите файл выписки сюда</p>
                  <p className="text-sm text-gray-500 mb-4">или нажмите для выбора файла</p>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />1С формат (.txt)</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />CSV выписка (.csv)</span>
                  </div>
                </>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Поддерживаемые форматы:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>-- Формат 1С (txt) - АО "Банк ЦентрКредит"</li>
                <li>-- CSV выписка с колонками: Дата, Клиент, Тип платежа, Сумма</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && importResult && stats && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Файл: <span className="font-medium">{importResult.fileName}</span>
                <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs font-medium uppercase">{importResult.format}</span>
              </p>
            </div>

            <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Всего</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-emerald-700">{stats.income}</p>
                <p className="text-xs text-emerald-600">Доходы</p>
              </div>
              <div className="bg-rose-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-rose-700">{stats.expense}</p>
                <p className="text-xs text-rose-600">Расходы</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-green-700">{stats.matched}</p>
                <p className="text-xs text-green-600">Найдены</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-blue-700">{stats.verified}</p>
                <p className="text-xs text-blue-600">Сверены</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-yellow-700">{stats.unmatched}</p>
                <p className="text-xs text-yellow-600">Новые</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-red-700">{stats.duplicates}</p>
                <p className="text-xs text-red-600">Дубликаты</p>
              </div>
            </div>

            {stats.discrepancies > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                {stats.discrepancies} платеж(а/ей) с расхождением суммы -- данные из банка обновят существующие записи
              </div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRows.size > 0 && selectedRows.size >= stats.total - stats.duplicates}
                        onChange={toggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Вид</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Сверка</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Контрагент</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Сумма</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importResult.transactions.map((t, i) => {
                    const config = MATCH_STATUS_CONFIG[t.matchStatus];
                    const StatusIcon = config.icon;
                    const reconcConfig = RECONCILIATION_CONFIG[t.reconciliation.type];
                    const ReconcIcon = reconcConfig.icon;
                    const resolvedClientId = getResolvedClientId(t, i);
                    const resolvedClient = resolvedClientId ? clients.find(c => c.id === resolvedClientId) : null;
                    const isExpanded = expandedRow === i;
                    const overridden = !!clientOverrides[i];

                    return (
                      <React.Fragment key={i}>
                        <tr className={`${config.bg} hover:opacity-90 transition-opacity`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(i)}
                              onChange={() => toggleRow(i)}
                              disabled={t.matchStatus === 'duplicate'}
                              className="rounded border-gray-300 disabled:opacity-30"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              t.isIncome
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {t.isIncome ? 'Доход' : 'Расход'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.text} ${config.bg} border ${config.border}`}>
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </span>
                            {t.matchSource !== 'none' && t.matchStatus === 'matched' && (
                              <span className="ml-1 text-xs text-gray-400">{MATCH_SOURCE_LABELS[t.matchSource]}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${reconcConfig.text} ${reconcConfig.bg}`}>
                              <ReconcIcon className="h-3 w-3" />
                              {reconcConfig.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {new Date(t.date).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-3 py-2">
                            {t.matchStatus === 'unmatched' && !overridden ? (
                              <button
                                onClick={() => setNewClientModal({ rowIndex: i, bankName: t.clientName, bankBin: t.clientBin })}
                                className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800 hover:bg-yellow-200 transition-colors"
                              >
                                <UserPlus className="h-3 w-3" />
                                {t.clientName || 'Выбрать клиента'}
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-gray-800 truncate max-w-[180px]">
                                  {resolvedClient ? (resolvedClient.company || resolvedClient.name) : t.clientName}
                                </span>
                                {overridden && (
                                  <button
                                    onClick={() => {
                                      const next = { ...clientOverrides };
                                      delete next[i];
                                      setClientOverrides(next);
                                    }}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <span className={`font-semibold ${
                              t.reconciliation.amountDiffers ? 'text-amber-600' :
                              t.isIncome ? 'text-emerald-700' : 'text-rose-600'
                            }`}>
                              {t.isIncome ? '+' : '-'}{t.amount.toLocaleString('ru-RU')} T
                            </span>
                            {t.reconciliation.amountDiffers && t.reconciliation.existingTransaction && (
                              <div className="text-xs text-amber-500">
                                было: {t.reconciliation.existingTransaction.amount.toLocaleString('ru-RU')} T
                              </div>
                            )}
                            {t.currency === 'USD' && (
                              <div className="text-xs text-gray-500">
                                {t.amountOriginal.toLocaleString('ru-RU')} USD
                                {t.exchangeRate && ` x ${t.exchangeRate}`}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-medium text-gray-600">{PAYMENT_TYPE_LABELS[t.paymentType]}</span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : i)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className={config.bg}>
                            <td colSpan={9} className="px-6 py-3">
                              <div className="text-xs text-gray-600 space-y-1">
                                {t.clientNameRaw !== t.clientName && (
                                  <p><span className="font-medium">Исходное имя:</span> {t.clientNameRaw}</p>
                                )}
                                <p><span className="font-medium">Назначение:</span> {t.description || '---'}</p>
                                {t.documentNumber && <p><span className="font-medium">Номер документа:</span> {t.documentNumber}</p>}
                                {t.clientBin && <p><span className="font-medium">БИН/ИИН:</span> {t.clientBin}</p>}
                                {t.knpCode && <p><span className="font-medium">КНП:</span> {t.knpCode}</p>}
                                {t.reconciliation.existingTransaction && (
                                  <div className="mt-2 p-2 bg-white/60 rounded border border-gray-200">
                                    <p className="font-medium text-gray-700">Связанная запись менеджера:</p>
                                    <p>Сумма: {t.reconciliation.existingTransaction.amount.toLocaleString('ru-RU')} T</p>
                                    <p>Дата: {new Date(t.reconciliation.existingTransaction.date).toLocaleDateString('ru-RU')}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-gray-600 space-y-0.5">
                <p>
                  Выбрано: <span className="font-semibold">{selectedRows.size}</span> из {stats.total}
                </p>
                <p>
                  {stats.totalIncome > 0 && (
                    <span className="text-emerald-700 font-semibold">+{stats.totalIncome.toLocaleString('ru-RU')} T</span>
                  )}
                  {stats.totalIncome > 0 && stats.totalExpense > 0 && <span className="mx-1.5 text-gray-400">/</span>}
                  {stats.totalExpense > 0 && (
                    <span className="text-rose-600 font-semibold">-{stats.totalExpense.toLocaleString('ru-RU')} T</span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('upload'); setImportResult(null); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Назад
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedRows.size === 0 || isProcessing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Импортировать ({selectedRows.size})
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="text-center py-12 space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Импорт завершен</h3>
              <div className="space-y-2 text-sm">
                {importSummary.created > 0 && (
                  <p className="flex items-center justify-center gap-2 text-blue-700">
                    <Building2 className="h-4 w-4" />
                    {importSummary.created} платежей создано из банковской выписки
                  </p>
                )}
                {importSummary.reconciled > 0 && (
                  <p className="flex items-center justify-center gap-2 text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    {importSummary.reconciled} платежей подтверждено банком
                  </p>
                )}
                {importSummary.skipped > 0 && (
                  <p className="flex items-center justify-center gap-2 text-gray-500">
                    <X className="h-4 w-4" />
                    {importSummary.skipped} пропущено
                  </p>
                )}
              </div>
            </div>
            <button onClick={handleClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Закрыть</button>
          </div>
        )}
      </div>

      {newClientModal && (
        <NewClientModal
          isOpen={true}
          onClose={() => setNewClientModal(null)}
          bankName={newClientModal.bankName}
          bankBin={newClientModal.bankBin}
          clients={clients}
          onCreateNew={(name, company) => handleCreateNewClient(newClientModal.rowIndex, name, company)}
          onLinkExisting={(clientId) => handleLinkExistingClient(newClientModal.rowIndex, clientId)}
        />
      )}
    </Modal>
  );
}
