import React, { useState, useEffect } from 'react';
import { X, FileText, Check, AlertTriangle } from 'lucide-react';
import { Client } from '../types';
import { DocumentTemplate, documentTemplateService } from '../services/documentTemplateService';
import { PaymentTypeOption, paymentTypeService } from '../services/paymentTypeService';
import { ExecutorCompany, executorCompanyService } from '../services/executorCompanyService';
import { generatedDocumentService } from '../services/generatedDocumentService';
import { numberToWords } from '../utils/numberToWords';

interface ContractGeneratorModalProps {
  client: Client;
  onClose: () => void;
  onGenerated: (fileUrl: string) => void;
}

const ContractGeneratorModal: React.FC<ContractGeneratorModalProps> = ({
  client,
  onClose,
  onGenerated
}) => {
  const [step, setStep] = useState<'select-template' | 'fill-data'>('select-template');
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [executorCompany, setExecutorCompany] = useState<ExecutorCompany | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [documentName, setDocumentName] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [contractDuration, setContractDuration] = useState<1 | 3 | 6 | 12>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [templatesData, paymentTypesData, executorData] = await Promise.all([
        documentTemplateService.getByCategory('contract'),
        paymentTypeService.getAll(),
        executorCompanyService.getDefault(),
        // 🚀 Предзагружаем популярные шаблоны в фоне
        generatedDocumentService.preloadMostUsedTemplates().catch(() => {})
      ]);
      setTemplates(templatesData);
      setPaymentTypes(paymentTypesData);
      setExecutorCompany(executorData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setDocumentName(`Договор с ${client.company || client.name}`);

    const initialVars: Record<string, string> = {};
    template.parsedVariables.forEach(variable => {
      initialVars[variable] = '';
    });

    initialVars['current_date'] = new Date().toLocaleDateString('ru-RU');
    initialVars['current_year'] = new Date().getFullYear().toString();
    initialVars['contract_number'] = client.contractNumber || '';

    const today = new Date();
    initialVars['contract_start_date'] = today.toLocaleDateString('ru-RU');

    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + contractDuration);
    initialVars['contract_end_date'] = endDate.toLocaleDateString('ru-RU');
    initialVars['duration'] = contractDuration.toString();

    if (client.budget) {
      initialVars['contract_amount'] = client.budget.toString();
      initialVars['contract_amount_words'] = numberToWords(client.budget);
    }

    if (executorCompany) {
      initialVars['executor_name'] = executorCompany.shortName;
      initialVars['executor_legal_name'] = executorCompany.legalName;
      initialVars['executor_bin'] = executorCompany.bin;
      initialVars['executor_phone'] = executorCompany.phone || '';
      initialVars['executor_email'] = executorCompany.email || '';
      initialVars['executor_address'] = executorCompany.legalAddress || '';
      initialVars['executor_director'] = executorCompany.directorName;
      initialVars['executor_director_position'] = executorCompany.directorPosition;
      initialVars['executor_authority_basis'] = executorCompany.authorityBasis || '';
      initialVars['executor_bank'] = executorCompany.bankName || '';
      initialVars['executor_iban'] = executorCompany.iban || '';
      initialVars['executor_bik'] = executorCompany.bik || '';
    }

    // Автозаполнение данных клиента (поддержка client_* и customer_*)
    const clientFields = {
      name: client.name,
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      bin: client.bin || client.inn || '',
      address: client.address || '',
      legal_name: client.legalName || client.company || '',
      director: client.director || '',
      position: 'Директор', // Должность по умолчанию
      authority_basis: client.signatoryBasis || 'Устава',
      bank: client.bank || '',
      iban: client.iban || '',
      bik: client.bik || ''
    };

    // Заполняем оба варианта префикса (client_ и customer_)
    Object.entries(clientFields).forEach(([key, value]) => {
      initialVars[`client_${key}`] = value;
      initialVars[`customer_${key}`] = value;
    });

    // Дополнительные поля
    initialVars['customer_basis'] = client.signatoryBasis || 'Устава';
    initialVars['client_basis'] = client.signatoryBasis || 'Устава';

    if (client.calculatorData) {
      const calcData = client.calculatorData as any;
      if (calcData.description) {
        initialVars['service_description'] = calcData.description;
      }
      if (calcData.total) {
        initialVars['service_cost'] = calcData.total.toString();
      }
    }

    if (client.budget) {
      setAmount(client.budget.toString());
    }

    setVariables(initialVars);
    setStep('fill-data');
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || !documentName.trim()) {
      setError('Введите название документа');
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      console.log('=== НАЧАЛО ГЕНЕРАЦИИ ДОКУМЕНТА ===');
      console.log('Шаблон:', selectedTemplate?.name);
      console.log('Переменные в шаблоне:', selectedTemplate?.parsedVariables);
      console.log('\nПередаваемые значения:');
      Object.entries(variables).forEach(([key, value]) => {
        console.log(`  ${key}: "${value}"`);
      });

      const emptyVars = Object.entries(variables).filter(([k, v]) => !v).map(([k]) => k);
      if (emptyVars.length > 0) {
        console.warn(`\nПУСТЫЕ ПЕРЕМЕННЫЕ (${emptyVars.length}):`, emptyVars);
      }

      const templateVars = selectedTemplate?.parsedVariables || [];
      const providedVars = Object.keys(variables);
      const missingVars = templateVars.filter(v => !providedVars.includes(v));
      if (missingVars.length > 0) {
        console.error(`\nОТСУТСТВУЮЩИЕ ПЕРЕМЕННЫЕ (${missingVars.length}):`, missingVars);
      }

      const doc = await generatedDocumentService.generateDocument(
        selectedTemplate.id,
        documentName,
        variables,
        client.id,
        undefined,
        amount ? Number(amount) : undefined
      );

      console.log('✓ Документ успешно сгенерирован:', doc);

      if (doc.fileUrl) {
        onGenerated(doc.fileUrl);
      }
    } catch (error: any) {
      console.error('=== ОШИБКА ГЕНЕРАЦИИ ===');
      console.error('Полная ошибка:', error);

      const errorMessage = error?.message || 'Неизвестная ошибка при генерации документа';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePaymentTypeChange = (paymentTypeId: string) => {
    const paymentType = paymentTypes.find(pt => pt.id === paymentTypeId);
    if (paymentType) {
      setVariables(prev => ({
        ...prev,
        payment_type: paymentType.legalText
      }));
    }
  };

  const getVariableLabel = (varName: string): string => {
    const labels: Record<string, string> = {
      // Клиент (client_*)
      client_name: 'Имя клиента',
      client_company: 'Компания клиента',
      client_legal_name: 'Юр. название клиента',
      client_bin: 'БИН клиента',
      client_email: 'Email клиента',
      client_phone: 'Телефон клиента',
      client_address: 'Адрес клиента',
      client_director: 'Директор клиента',
      client_position: 'Должность руководителя',
      client_authority_basis: 'Основание полномочий',
      client_basis: 'Основание полномочий',
      client_bank: 'Банк клиента',
      client_iban: 'ИИК клиента',
      client_bik: 'БИК клиента',

      // Клиент (customer_* — аналогично client_*)
      customer_name: 'Имя клиента',
      customer_company: 'Компания клиента',
      customer_legal_name: 'Юр. название клиента',
      customer_bin: 'БИН клиента',
      customer_email: 'Email клиента',
      customer_phone: 'Телефон клиента',
      customer_address: 'Адрес клиента',
      customer_director: 'Директор клиента',
      customer_position: 'Должность руководителя',
      customer_authority_basis: 'Основание полномочий',
      customer_basis: 'Основание полномочий',
      customer_bank: 'Банк клиента',
      customer_iban: 'ИИК клиента',
      customer_bik: 'БИК клиента',

      // Исполнитель
      executor_name: 'Название исполнителя',
      executor_legal_name: 'Юридическое название',
      executor_bin: 'БИН исполнителя',
      executor_phone: 'Телефон исполнителя',
      executor_email: 'Email исполнителя',
      executor_address: 'Адрес исполнителя',
      executor_director: 'Директор',
      executor_director_position: 'Должность директора',
      executor_bank: 'Банк',
      executor_iban: 'ИИК',
      executor_bik: 'БИК',
      executor_authority_basis: 'Основание полномочий',

      // Договор
      contract_number: 'Номер договора',
      contract_date: 'Дата договора',
      contract_start_date: 'Дата начала договора',
      contract_end_date: 'Дата окончания договора',
      contract_amount: 'Сумма договора (₸)',
      contract_amount_words: 'Сумма договора прописью',
      duration: 'Срок действия (мес.)',

      // Услуги
      service_description: 'Описание услуги',
      service_cost: 'Стоимость услуги',
      payment_type: 'Условия оплаты',

      // Общее
      current_date: 'Текущая дата',
      current_year: 'Текущий год'
    };
    return labels[varName] || varName;
  };

  const isVariableReadonly = (varName: string): boolean => {
    if (varName.startsWith('executor_') || varName === 'current_date' || varName === 'current_year') {
      return true;
    }
    if (varName === 'contract_amount_words') {
      return true;
    }
    return false;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-blue-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {step === 'select-template' ? 'Выберите шаблон договора' : 'Заполнение договора'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {step === 'select-template'
                ? 'Выберите подходящий шаблон для генерации'
                : selectedTemplate?.name
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {step === 'select-template' ? (
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">Шаблоны договоров не найдены</p>
                <p className="text-sm text-slate-400">
                  Добавьте шаблон в разделе "Документы"
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="text-left p-5 border-2 border-slate-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-800 mb-1">
                          {template.name}
                        </h3>
                        {template.description && (
                          <p className="text-sm text-slate-500 mb-2">
                            {template.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          Использован {template.usageCount} раз
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-red-800 mb-2">
                        Ошибка генерации документа
                      </p>
                      <div className="text-sm text-red-700 whitespace-pre-line bg-white p-3 rounded border border-red-200">
                        {error}
                      </div>
                      <button
                        onClick={() => setError(null)}
                        className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Закрыть
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 mb-1">
                      Данные из CRM автоматически заполнены
                    </p>
                    <p className="text-sm text-slate-600">
                      Проверьте правильность данных и при необходимости отредактируйте незаблокированные поля
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Название документа *
                </label>
                <input
                  type="text"
                  value={documentName}
                  onChange={e => setDocumentName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  placeholder="Договор с клиентом"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Сумма договора (₸)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  placeholder="0"
                />
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">
                  Переменные документа
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTemplate?.parsedVariables.map(variable => {
                    if (variable === 'payment_type') {
                      return (
                        <div key={variable} className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            {getVariableLabel(variable)}
                          </label>
                          <select
                            onChange={e => handlePaymentTypeChange(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                          >
                            <option value="">Выберите тип оплаты</option>
                            {paymentTypes.map(pt => (
                              <option key={pt.id} value={pt.id}>
                                {pt.name}
                              </option>
                            ))}
                          </select>
                          {variables[variable] && (
                            <p className="mt-2 text-xs text-slate-500 p-3 bg-slate-50 rounded-lg">
                              {variables[variable]}
                            </p>
                          )}
                        </div>
                      );
                    }

                    if (variable === 'contract_amount') {
                      return (
                        <div key={variable}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            {getVariableLabel(variable)}
                          </label>
                          <input
                            type="number"
                            value={variables[variable] || ''}
                            onChange={e => {
                              const value = e.target.value;
                              const numValue = parseFloat(value);
                              setVariables(prev => ({
                                ...prev,
                                contract_amount: value,
                                contract_amount_words: !isNaN(numValue) && numValue > 0 ? numberToWords(numValue) : ''
                              }));
                            }}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                            placeholder="0"
                          />
                        </div>
                      );
                    }

                    if (variable === 'duration') {
                      return (
                        <div key={variable}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            {getVariableLabel(variable)}
                          </label>
                          <select
                            value={contractDuration}
                            onChange={e => {
                              const months = parseInt(e.target.value) as 1 | 3 | 6 | 12;
                              setContractDuration(months);

                              // Пересчитываем дату окончания
                              const today = new Date();
                              const endDate = new Date(today);
                              endDate.setMonth(endDate.getMonth() + months);

                              setVariables(prev => ({
                                ...prev,
                                duration: months.toString(),
                                contract_end_date: endDate.toLocaleDateString('ru-RU')
                              }));
                            }}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                          >
                            <option value="1">1 месяц</option>
                            <option value="3">3 месяца</option>
                            <option value="6">6 месяцев</option>
                            <option value="12">12 месяцев</option>
                          </select>
                        </div>
                      );
                    }

                    if (variable === 'contract_amount_words') {
                      return (
                        <div key={variable} className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            {getVariableLabel(variable)}
                            <span className="ml-2 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                              авто
                            </span>
                          </label>
                          <textarea
                            value={variables[variable] || ''}
                            readOnly
                            rows={2}
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed resize-none"
                          />
                        </div>
                      );
                    }

                    if (variable === 'contract_start_date' || variable === 'contract_end_date') {
                      if (variable === 'contract_start_date') {
                        return (
                          <div key="contract_duration" className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Срок договора
                            </label>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Дата начала</label>
                                <input
                                  type="date"
                                  value={variables.contract_start_date ? new Date(variables.contract_start_date.split('.').reverse().join('-')).toISOString().split('T')[0] : ''}
                                  onChange={e => {
                                    const startDate = new Date(e.target.value);
                                    const endDate = new Date(startDate);
                                    endDate.setMonth(endDate.getMonth() + contractDuration);
                                    setVariables(prev => ({
                                      ...prev,
                                      contract_start_date: startDate.toLocaleDateString('ru-RU'),
                                      contract_end_date: endDate.toLocaleDateString('ru-RU')
                                    }));
                                  }}
                                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Длительность</label>
                                <select
                                  value={contractDuration}
                                  onChange={e => {
                                    const months = Number(e.target.value) as 1 | 3 | 6 | 12;
                                    setContractDuration(months);
                                    if (variables.contract_start_date) {
                                      const startDate = new Date(variables.contract_start_date.split('.').reverse().join('-'));
                                      const endDate = new Date(startDate);
                                      endDate.setMonth(endDate.getMonth() + months);
                                      setVariables(prev => ({
                                        ...prev,
                                        contract_end_date: endDate.toLocaleDateString('ru-RU')
                                      }));
                                    }
                                  }}
                                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                >
                                  <option value={1}>1 месяц</option>
                                  <option value={3}>3 месяца</option>
                                  <option value={6}>6 месяцев</option>
                                  <option value={12}>12 месяцев</option>
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Дата окончания</label>
                                <input
                                  type="text"
                                  value={variables.contract_end_date || ''}
                                  readOnly
                                  className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }

                    const readonly = isVariableReadonly(variable);
                    const isClientField = variable.startsWith('client_') || variable.startsWith('customer_');
                    const isAutofilled = isClientField && variables[variable];

                    return (
                      <div key={variable}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          {getVariableLabel(variable)}
                          {readonly && (
                            <span className="ml-2 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                              авто
                            </span>
                          )}
                          {isAutofilled && !readonly && (
                            <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              ✓ из CRM
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={variables[variable] || ''}
                          onChange={e => setVariables(prev => ({ ...prev, [variable]: e.target.value }))}
                          readOnly={readonly}
                          className={`w-full px-4 py-3 border rounded-lg transition-all ${
                            readonly
                              ? 'bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed'
                              : isAutofilled
                              ? 'border-emerald-300 bg-emerald-50/30 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                              : 'border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
                          }`}
                          placeholder={!readonly && !isAutofilled ? 'Введите значение' : ''}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200 flex justify-between bg-slate-50">
          {step === 'fill-data' && (
            <button
              onClick={() => setStep('select-template')}
              className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Назад
            </button>
          )}
          <div className="flex-1" />
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Отмена
            </button>
            {step === 'fill-data' && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !documentName.trim()}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isGenerating ? 'Генерация...' : 'Сформировать договор'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractGeneratorModal;
