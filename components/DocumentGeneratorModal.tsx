import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Client } from '../types';
import { DocumentTemplate } from '../services/documentTemplateService';
import { PaymentTypeOption } from '../services/paymentTypeService';
import { ExecutorCompany, executorCompanyService } from '../services/executorCompanyService';
import { clientService } from '../services/clientService';
import { generatedDocumentService } from '../services/generatedDocumentService';
import { projectService } from '../services/projectService';

interface DocumentGeneratorModalProps {
  template: DocumentTemplate;
  paymentTypes: PaymentTypeOption[];
  clientId?: string;
  projectId?: string;
  onClose: () => void;
  onGenerated: () => void;
}

const DocumentGeneratorModal: React.FC<DocumentGeneratorModalProps> = ({
  template,
  paymentTypes,
  clientId,
  projectId,
  onClose,
  onGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [documentName, setDocumentName] = useState(template.name);
  const [amount, setAmount] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(clientId || '');
  const [clients, setClients] = useState<Client[]>([]);
  const [executorCompany, setExecutorCompany] = useState<ExecutorCompany | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientsData, executorData] = await Promise.all([
        clientService.getAll(),
        executorCompanyService.getDefault()
      ]);
      setClients(clientsData);
      setExecutorCompany(executorData);

      const initialVars: Record<string, string> = {};
      console.log('📋 Переменные шаблона:', template.parsedVariables);

      // Сначала инициализируем переменные из шаблона
      template.parsedVariables.forEach(variable => {
        initialVars[variable] = '';
      });

      // Системные переменные
      initialVars['current_date'] = new Date().toLocaleDateString('ru-RU');
      initialVars['current_year'] = new Date().getFullYear().toString();

      // Загружаем данные проекта, если указан projectId
      // ВАЖНО: duration НЕ загружается - это для приложений, пользователь вводит вручную
      if (projectId) {
        try {
          const project = await projectService.getById(projectId);
          if (project) {
            console.log('📊 Данные проекта для основного договора:', {
              startDate: project.startDate,
              endDate: project.endDate
            });

            // Период оказания услуг для основного договора (от/до)
            if (project.startDate) {
              initialVars['contract_start_date'] = new Date(project.startDate).toLocaleDateString('ru-RU');
            }
            if (project.endDate) {
              initialVars['contract_end_date'] = new Date(project.endDate).toLocaleDateString('ru-RU');
            }
          }
        } catch (error) {
          console.error('Ошибка загрузки проекта:', error);
        }
      }

      // Данные исполнителя - заполняем ВСЕ возможные варианты переменных
      if (executorData) {
        console.log('🏢 Данные исполнителя:', {
          shortName: executorData.shortName,
          directorName: executorData.directorName,
          directorPosition: executorData.directorPosition,
          authorityBasis: executorData.authorityBasis
        });

        // Основные переменные
        initialVars['executor_name'] = executorData.shortName;
        initialVars['executor_legal_name'] = executorData.legalName;
        initialVars['executor_bin'] = executorData.bin;
        initialVars['executor_phone'] = executorData.phone || '';
        initialVars['executor_email'] = executorData.email || '';
        initialVars['executor_address'] = executorData.legalAddress || '';
        initialVars['executor_director'] = executorData.directorName;

        // Должность директора - все варианты
        initialVars['executor_director_position'] = executorData.directorPosition;
        initialVars['executor_position'] = executorData.directorPosition;

        // Основание полномочий - все варианты
        initialVars['executor_authority_basis'] = executorData.authorityBasis || '';
        initialVars['executor_basis'] = executorData.authorityBasis || '';

        // Банковские реквизиты
        initialVars['executor_bank'] = executorData.bankName || '';
        initialVars['executor_iban'] = executorData.iban || '';
        initialVars['executor_bik'] = executorData.bik || '';

        console.log('✅ Все переменные исполнителя:', initialVars);
      } else {
        console.error('❌ ExecutorData не загружен!');
      }

      setVariables(initialVars);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const updatedVars: Record<string, string> = {
        ...variables
      };

      // Основные данные клиента - заполняем client_* И customer_* (синонимы)
      updatedVars.client_name = client.name;
      updatedVars.customer_name = client.name;

      // Компания клиента = Полное юридическое наименование из юр. реквизитов
      updatedVars.client_company = client.legalName || '';
      updatedVars.customer_company = client.legalName || '';
      console.log('🏢 Компания клиента из юр. реквизитов:', client.legalName);

      updatedVars.client_email = client.email || '';
      updatedVars.customer_email = client.email || '';

      updatedVars.client_phone = client.phone || '';
      updatedVars.customer_phone = client.phone || '';

      updatedVars.client_bin = client.bin || '';
      updatedVars.customer_bin = client.bin || '';

      updatedVars.client_address = client.address || '';
      updatedVars.customer_address = client.address || '';

      // Юридическое название
      if (client.legalName) {
        updatedVars.client_legal_name = client.legalName;
        updatedVars.customer_legal_name = client.legalName;
      }

      // Директор
      if (client.director) {
        updatedVars.client_director = client.director;
        updatedVars.customer_director = client.director;
      }

      // Должность (по умолчанию "Директор")
      updatedVars.client_position = 'Директор';
      updatedVars.customer_position = 'Директор';

      // Основание полномочий (все варианты)
      const signatoryBasis = client.signatoryBasis || 'Устава';
      updatedVars.client_authority_basis = signatoryBasis;
      updatedVars.client_basis = signatoryBasis;
      updatedVars.customer_authority_basis = signatoryBasis;
      updatedVars.customer_basis = signatoryBasis;

      // Банковские реквизиты
      if (client.bankName) {
        updatedVars.client_bank = client.bankName;
        updatedVars.customer_bank = client.bankName;
      }
      if (client.accountNumber) {
        updatedVars.client_iban = client.accountNumber;
        updatedVars.customer_iban = client.accountNumber;
      }
      if (client.bankBik) {
        updatedVars.client_bik = client.bankBik;
        updatedVars.customer_bik = client.bankBik;
      }

      // Услуги из калькулятора
      if (client.calculatorData) {
        const calcData = client.calculatorData as any;
        if (calcData.description) {
          updatedVars.service_description = calcData.description;
          updatedVars.services_description = calcData.description;
          console.log('📋 Описание услуг из калькулятора:', calcData.description);
        }
        if (calcData.total) {
          updatedVars.service_cost = calcData.total.toString();
        }
      }

      // Бюджет
      if (client.budget) {
        setAmount(client.budget.toString());
      }

      console.log('✅ Все переменные клиента заполнены:', {
        client_name: updatedVars.client_name,
        customer_name: updatedVars.customer_name,
        client_basis: updatedVars.client_basis,
        customer_basis: updatedVars.customer_basis,
        executor_position: updatedVars.executor_position,
        executor_basis: updatedVars.executor_basis
      });

      setVariables(updatedVars);
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }));
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

  const handleGenerate = async () => {
    if (!documentName.trim()) {
      alert('Введите название документа');
      return;
    }

    console.log('🚀 Генерация документа:', {
      templateId: template.id,
      documentName,
      clientId: selectedClientId,
      projectId,
      amount,
      variables: {
        executor_position: variables['executor_position'],
        executor_basis: variables['executor_basis'],
        executor_director: variables['executor_director'],
        executor_name: variables['executor_name'],
        allVariables: variables
      }
    });

    setIsGenerating(true);
    try {
      await generatedDocumentService.generateDocument(
        template.id,
        documentName,
        variables,
        selectedClientId || undefined,
        projectId,
        amount ? Number(amount) : undefined
      );
      onGenerated();
    } catch (error) {
      console.error('Error generating document:', error);
      alert('Ошибка при генерации документа');
    } finally {
      setIsGenerating(false);
    }
  };

  const getVariableLabel = (varName: string): string => {
    /*
     * ВАЖНО: Две концепции длительности!
     *
     * 1. contract_start_date / contract_end_date - период оказания услуг по основному договору
     *    Используется: "с 01.01.2024 по 01.03.2024 включительно"
     *    Загружается: автоматически из проекта
     *
     * 2. duration / duration_days - срок выполнения работ по приложению
     *    Используется: "30 календарных дней с момента получения предоплаты"
     *    Загружается: вручную пользователем (НЕ из проекта!)
     */
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
      client_authority_basis: 'Основание полномочий клиента',
      client_basis: 'Основание полномочий клиента',
      client_bank: 'Банк клиента',
      client_iban: 'ИИК клиента',
      client_bik: 'БИК клиента',

      // Клиент (customer_* - синонимы)
      customer_name: 'Имя клиента',
      customer_company: 'Компания клиента',
      customer_legal_name: 'Юр. название клиента',
      customer_bin: 'БИН клиента',
      customer_email: 'Email клиента',
      customer_phone: 'Телефон клиента',
      customer_address: 'Адрес клиента',
      customer_director: 'Директор клиента',
      customer_position: 'Должность руководителя',
      customer_authority_basis: 'Основание полномочий клиента',
      customer_basis: 'Основание полномочий клиента',
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
      executor_director: 'ФИО директора',
      executor_director_position: 'Должность директора',
      executor_position: 'Должность директора',
      executor_authority_basis: 'Основание полномочий',
      executor_basis: 'Основание полномочий',
      executor_bank: 'Банк исполнителя',
      executor_iban: 'ИИК исполнителя',
      executor_bik: 'БИК исполнителя',

      // Договор
      contract_number: 'Номер договора',
      contract_date: 'Дата договора',
      contract_start_date: 'Период услуг: Дата начала (договор)',
      contract_end_date: 'Период услуг: Дата окончания (договор)',
      contract_amount: 'Сумма договора',
      contract_amount_words: 'Сумма прописью',
      duration: 'Длительность работ (дней) - для приложения',
      duration_days: 'Длительность работ (дней) - для приложения',

      // Услуги
      service_description: 'Описание услуги',
      services_description: 'Описание услуги',
      service_cost: 'Стоимость услуги',
      payment_type: 'Условия оплаты',

      // Общие
      current_date: 'Текущая дата',
      current_year: 'Текущий год',
      index: 'Номер приложения'
    };
    return labels[varName] || varName;
  };

  const isVariableReadonly = (varName: string): boolean => {
    // Все переменные исполнителя и системные переменные - только для чтения
    if (varName.startsWith('executor_') || varName === 'current_date' || varName === 'current_year') {
      return true;
    }
    // Переменные клиента - только для чтения если клиент выбран
    if (selectedClientId && (varName.startsWith('client_') || varName.startsWith('customer_')) && variables[varName]) {
      return true;
    }
    // Описание услуг и стоимость - только для чтения если клиент выбран и есть данные калькулятора
    if (selectedClientId && (varName === 'service_description' || varName === 'services_description' || varName === 'service_cost') && variables[varName]) {
      return true;
    }
    return false;
  };

  const getVariableCategory = (varName: string): string => {
    if (varName.startsWith('executor_')) return 'executor';
    if (varName.startsWith('client_') || varName.startsWith('customer_')) return 'client';
    if (varName === 'service_description' || varName === 'services_description' || varName === 'service_cost') return 'services';
    if (varName === 'contract_start_date' || varName === 'contract_end_date') return 'contract_period';
    if (varName === 'duration' || varName === 'duration_days') return 'appendix_duration';
    if (varName === 'contract_number' || varName === 'contract_date' || varName === 'contract_amount' || varName === 'contract_amount_words') return 'contract';
    if (varName === 'payment_type') return 'payment';
    if (varName === 'current_date' || varName === 'current_year' || varName === 'index') return 'system';
    return 'other';
  };

  const getCategoryTitle = (category: string): string => {
    const titles: Record<string, string> = {
      executor: '🏢 Исполнитель',
      client: '👤 Клиент',
      contract: '📄 Основные данные договора',
      contract_period: '📅 Период действия договора (основной договор)',
      appendix_duration: '⏱️ Длительность работ (для приложений)',
      services: '🛠️ Услуги',
      payment: '💳 Условия оплаты',
      system: '🔧 Системные переменные',
      other: '📝 Прочие переменные'
    };
    return titles[category] || category;
  };

  const getGroupedVariables = () => {
    const categoryOrder = [
      'contract',
      'contract_period',
      'appendix_duration',
      'executor',
      'client',
      'services',
      'payment',
      'system',
      'other'
    ];

    const grouped: Record<string, string[]> = {};

    template.parsedVariables.forEach(variable => {
      const category = getVariableCategory(variable);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(variable);
    });

    // Возвращаем в правильном порядке
    return categoryOrder
      .filter(cat => grouped[cat] && grouped[cat].length > 0)
      .map(cat => ({
        category: cat,
        title: getCategoryTitle(cat),
        variables: grouped[cat]
      }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Заполнение договора: {template.name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название документа *
              </label>
              <input
                type="text"
                value={documentName}
                onChange={e => setDocumentName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Клиент
              </label>
              <select
                value={selectedClientId}
                onChange={e => handleClientChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Выберите клиента</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сумма договора (KZT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Переменные документа</h3>

            {getGroupedVariables().map(group => (
              <div key={group.category} className="mb-6">
                <h4 className="text-sm font-semibold text-gray-800 mb-2 pb-2 border-b border-gray-200">
                  {group.title}
                </h4>

                {group.category === 'contract_period' && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                    <strong>Для основного договора:</strong> период действия договора с какой даты по какую.
                    Заполняется автоматически из дат проекта.
                  </div>
                )}

                {group.category === 'appendix_duration' && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <strong>Для приложений:</strong> количество дней на выполнение работ.
                    Например: "30 календарных дней с момента получения предоплаты".
                    <strong>Заполняется вручную!</strong>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.variables.map(variable => {
                    if (variable === 'payment_type') {
                      return (
                        <div key={variable} className="col-span-full">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {getVariableLabel(variable)}
                          </label>
                          <select
                            onChange={e => handlePaymentTypeChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Выберите тип оплаты</option>
                            {paymentTypes.map(pt => (
                              <option key={pt.id} value={pt.id}>
                                {pt.name}
                              </option>
                            ))}
                          </select>
                          {variables[variable] && (
                            <p className="mt-1 text-xs text-gray-500">{variables[variable]}</p>
                          )}
                        </div>
                      );
                    }

                    const readonly = isVariableReadonly(variable);
                    return (
                      <div key={variable}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {getVariableLabel(variable)}
                          {readonly && <span className="ml-1 text-gray-400">(авто)</span>}
                        </label>
                        <input
                          type="text"
                          value={variables[variable] || ''}
                          onChange={e => handleVariableChange(variable, e.target.value)}
                          readOnly={readonly}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            readonly ? 'bg-gray-50 text-gray-500' : ''
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !documentName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'Генерация...' : 'Сформировать'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentGeneratorModal;
