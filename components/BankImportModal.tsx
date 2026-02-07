import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Client, PaymentType, Transaction } from '../types';
import { ParsedTransaction, ImportResult, parseStatementFile } from '../services/bankStatementParser';
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
  }>) => void;
}

const STATUS_CONFIG = {
  matched: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Клиент найден', icon: CheckCircle },
  unmatched: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Клиент не найден', icon: AlertTriangle },
  duplicate: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Дубликат', icon: XCircle },
} as const;

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  [PaymentType.PREPAYMENT]: 'Предоплата',
  [PaymentType.FULL]: 'Полная оплата',
  [PaymentType.POSTPAYMENT]: 'Постоплата',
  [PaymentType.RETAINER]: 'Ретейнер',
  [PaymentType.REFUND]: 'Возврат',
};

export default function BankImportModal({ isOpen, onClose, clients, transactions, onImport }: BankImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [clientOverrides, setClientOverrides] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importSummary, setImportSummary] = useState({ imported: 0, skipped: 0 });
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingDocNumbers = transactions
    .map(t => t.description?.match(/\[DOC:([^\]]+)\]/)?.[1])
    .filter(Boolean) as string[];

  const handleFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const result = await parseStatementFile(file, clients, existingDocNumbers);
      if (result.transactions.length === 0) {
        alert('Не удалось распознать платежи в файле. Убедитесь, что формат файла поддерживается (1C .txt или CSV).');
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
  }, [clients, existingDocNumbers]);

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
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
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

  const handleImport = () => {
    if (!importResult) return;

    const itemsToImport: Array<{
      clientId: string;
      amount: number;
      date: string;
      type: PaymentType;
      description: string;
    }> = [];

    let skipped = 0;

    importResult.transactions.forEach((t, i) => {
      if (!selectedRows.has(i)) {
        skipped++;
        return;
      }

      const clientId = clientOverrides[i] || t.matchedClientId;
      if (!clientId) {
        skipped++;
        return;
      }

      const docTag = t.documentNumber ? ` [DOC:${t.documentNumber}]` : '';
      const rateTag = t.exchangeRate && t.currency === 'USD'
        ? ` [${t.amountOriginal} USD x ${t.exchangeRate}]`
        : '';
      const knpTag = t.knpCode ? ` [KNP:${t.knpCode}]` : '';

      itemsToImport.push({
        clientId,
        amount: t.amount,
        date: t.date,
        type: t.paymentType,
        description: (t.description + rateTag + knpTag + docTag).trim(),
      });
    });

    onImport(itemsToImport);
    setImportSummary({ imported: itemsToImport.length, skipped });
    setStep('result');
  };

  const handleClose = () => {
    setStep('upload');
    setImportResult(null);
    setSelectedRows(new Set());
    setClientOverrides({});
    setExpandedRow(null);
    onClose();
  };

  const getResolvedClientId = (t: ParsedTransaction, index: number) => {
    return clientOverrides[index] || t.matchedClientId;
  };

  const stats = importResult ? {
    total: importResult.transactions.length,
    matched: importResult.transactions.filter(t => t.matchStatus === 'matched').length,
    unmatched: importResult.transactions.filter(t => t.matchStatus === 'unmatched').length,
    duplicates: importResult.transactions.filter(t => t.matchStatus === 'duplicate').length,
    totalAmount: importResult.transactions
      .filter((_, i) => selectedRows.has(i))
      .reduce((sum, t) => sum + t.amount, 0),
  } : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Импорт банковской выписки">
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
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                  <p className="text-gray-600 font-medium">Обработка файла...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Перетащите файл выписки сюда
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    или нажмите для выбора файла
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      1С формат (.txt)
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      CSV выписка (.csv)
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Поддерживаемые форматы:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>-- Формат 1С (txt) - АО "Банк ЦентрКредит"</li>
                <li>-- CSV/XLS выписка с разделителями</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && importResult && stats && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Файл: <span className="font-medium">{importResult.fileName}</span>
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs font-medium uppercase">
                    {importResult.format}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Всего</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{stats.matched}</p>
                <p className="text-xs text-green-600">Найдены</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{stats.unmatched}</p>
                <p className="text-xs text-yellow-600">Новые</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{stats.duplicates}</p>
                <p className="text-xs text-red-600">Дубликаты</p>
              </div>
            </div>

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
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Сумма</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importResult.transactions.map((t, i) => {
                    const config = STATUS_CONFIG[t.matchStatus];
                    const StatusIcon = config.icon;
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
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.text} ${config.bg} border ${config.border}`}>
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {new Date(t.date).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-3 py-2">
                            {t.matchStatus === 'unmatched' && !overridden ? (
                              <select
                                value={clientOverrides[i] || ''}
                                onChange={(e) => setClientOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                                className="w-full px-2 py-1 border border-yellow-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">{t.clientName || 'Выберите клиента'}</option>
                                {clients.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.company || c.name} {c.bin ? `(${c.bin})` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-gray-800 truncate max-w-[200px]">
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
                            <span className="font-semibold text-gray-900">
                              {t.amount.toLocaleString('ru-RU')} ₸
                            </span>
                            {t.currency === 'USD' && (
                              <div className="text-xs text-gray-500">
                                {t.amountOriginal.toLocaleString('ru-RU')} USD
                                {t.exchangeRate && ` x ${t.exchangeRate}`}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-medium text-gray-600">
                              {PAYMENT_TYPE_LABELS[t.paymentType]}
                            </span>
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
                            <td colSpan={7} className="px-6 py-3">
                              <div className="text-xs text-gray-600 space-y-1">
                                <p><span className="font-medium">Назначение:</span> {t.description || '---'}</p>
                                {t.documentNumber && <p><span className="font-medium">Номер документа:</span> {t.documentNumber}</p>}
                                {t.clientBin && <p><span className="font-medium">БИН/ИИН:</span> {t.clientBin}</p>}
                                {t.knpCode && <p><span className="font-medium">КНП:</span> {t.knpCode}</p>}
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
              <p className="text-sm text-gray-600">
                Выбрано: <span className="font-semibold">{selectedRows.size}</span> из {stats.total}
                {stats.totalAmount > 0 && (
                  <span className="ml-2">
                    на сумму <span className="font-semibold text-green-700">{stats.totalAmount.toLocaleString('ru-RU')} ₸</span>
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('upload'); setImportResult(null); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Назад
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedRows.size === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">Импорт завершен</h3>
              <p className="text-gray-600">
                Успешно импортировано <span className="font-semibold text-green-700">{importSummary.imported}</span> платежей
                {importSummary.skipped > 0 && (
                  <>, пропущено <span className="font-semibold text-gray-500">{importSummary.skipped}</span></>
                )}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
