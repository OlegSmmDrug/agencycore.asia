import React, { useState, useEffect } from 'react';
import { FileText, Upload, Building2, Download, Trash2, Eye, Edit2, CheckCircle, Send, FileCheck, BookOpen } from 'lucide-react';
import { GeneratedDocument, generatedDocumentService } from '../services/generatedDocumentService';
import { DocumentTemplate, documentTemplateService } from '../services/documentTemplateService';
import { ExecutorCompany, executorCompanyService } from '../services/executorCompanyService';
import { PaymentTypeOption, paymentTypeService } from '../services/paymentTypeService';
import DocumentGeneratorModal from './DocumentGeneratorModal';
import ExecutorCompanyModal from './ExecutorCompanyModal';

interface DocumentsPageProps {
  onClose?: () => void;
}

type TabType = 'documents' | 'templates' | 'settings';
type DocumentStatus = 'all' | 'draft' | 'generated' | 'sent' | 'signed';

const DocumentsPage: React.FC<DocumentsPageProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [executorCompanies, setExecutorCompanies] = useState<ExecutorCompany[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);

  const [statusFilter, setStatusFilter] = useState<DocumentStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [showExecutorModal, setShowExecutorModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedExecutor, setSelectedExecutor] = useState<ExecutorCompany | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [docsData, templatesData, executorsData, paymentTypesData] = await Promise.all([
        generatedDocumentService.getAll(),
        documentTemplateService.getAll(),
        executorCompanyService.getAll(),
        paymentTypeService.getAll()
      ]);
      setDocuments(docsData);
      setTemplates(templatesData);
      setExecutorCompanies(executorsData);
      setPaymentTypes(paymentTypesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingTemplate(true);
    try {
      const name = file.name.replace(/\.docx$/, '');
      await documentTemplateService.uploadTemplate(file, name, 'contract');
      await loadData();
    } catch (error) {
      console.error('Error uploading template:', error);
      alert('Ошибка при загрузке шаблона');
    } finally {
      setUploadingTemplate(false);
      event.target.value = '';
    }
  };

  const handleDownloadInstructions = () => {
    const instructions = `ИНСТРУКЦИЯ ПО ПЕРЕМЕННЫМ ДЛЯ ШАБЛОНОВ ДОКУМЕНТОВ
============================================

Данный документ содержит полный список доступных переменных для создания шаблонов договоров.
Переменные используются в формате {{название_переменной}} в документах .docx

═══════════════════════════════════════════════════════════════════════════

КЛИЕНТ / ЗАКАЗЧИК
─────────────────

Поддерживаются два варианта префиксов: client_ и customer_ (работают идентично)

{{client_name}} или {{customer_name}}
  Описание: Имя клиента (контактное лицо)
  Автозаполнение: Да (из CRM)
  Пример: Иванов Иван Иванович

{{client_company}} или {{customer_company}}
  Описание: Название компании клиента
  Автозаполнение: Да (из CRM)
  Пример: ТОО "Пример Компания"

{{client_legal_name}} или {{customer_legal_name}}
  Описание: Полное юридическое название компании
  Автозаполнение: Да (из CRM)
  Пример: Товарищество с ограниченной ответственностью "Пример Компания"

{{client_bin}} или {{customer_bin}}
  Описание: БИН/ИНН компании клиента
  Автозаполнение: Да (из CRM)
  Пример: 123456789012

{{client_email}} или {{customer_email}}
  Описание: Email клиента
  Автозаполнение: Да (из CRM)
  Пример: client@example.com

{{client_phone}} или {{customer_phone}}
  Описание: Телефон клиента
  Автозаполнение: Да (из CRM)
  Пример: +7 777 123 45 67

{{client_address}} или {{customer_address}}
  Описание: Юридический адрес клиента
  Автозаполнение: Да (из CRM)
  Пример: г. Алматы, ул. Абая, д. 10, оф. 5

{{client_director}} или {{customer_director}}
  Описание: ФИО директора компании клиента
  Автозаполнение: Да (из CRM)
  Пример: Петров Петр Петрович

{{client_position}} или {{customer_position}}
  Описание: Должность руководителя компании клиента
  Автозаполнение: Нет (по умолчанию: Директор)
  Пример: Директор

{{client_authority_basis}} или {{customer_authority_basis}} или {{client_basis}} или {{customer_basis}}
  Описание: Основание полномочий руководителя
  Автозаполнение: Да (из CRM, по умолчанию: Устава)
  Пример: Устава

{{client_bank}} или {{customer_bank}}
  Описание: Название банка клиента
  Автозаполнение: Да (из CRM)
  Пример: АО "Kaspi Bank"

{{client_iban}} или {{customer_iban}}
  Описание: ИИК (счет) клиента
  Автозаполнение: Да (из CRM)
  Пример: KZ123456789012345678

{{client_bik}} или {{customer_bik}}
  Описание: БИК банка клиента
  Автозаполнение: Да (из CRM)
  Пример: CASPKZKA

═══════════════════════════════════════════════════════════════════════════

ИСПОЛНИТЕЛЬ / ПОДРЯДЧИК
────────────────────────

{{executor_name}}
  Описание: Краткое название исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: ТОО "Наша Компания"

{{executor_legal_name}}
  Описание: Полное юридическое название исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: Товарищество с ограниченной ответственностью "Наша Компания"

{{executor_bin}}
  Описание: БИН исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: 987654321098

{{executor_phone}}
  Описание: Телефон исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: +7 727 123 45 67

{{executor_email}}
  Описание: Email исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: info@ourcompany.kz

{{executor_address}}
  Описание: Юридический адрес исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: г. Алматы, пр. Достык, д. 20, оф. 301

{{executor_director}}
  Описание: ФИО директора исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: Сидоров Сидор Сидорович

{{executor_director_position}} или {{executor_position}}
  Описание: Должность директора исполнителя
  Автозаполнение: Да (из настроек организации - поле "Должность директора")
  Редактирование: Заблокировано
  Пример: Генеральный директор

{{executor_authority_basis}} или {{executor_basis}}
  Описание: Основание полномочий директора исполнителя
  Автозаполнение: Да (из настроек организации - поле "Основание полномочий")
  Редактирование: Заблокировано
  Пример: Устава

{{executor_bank}}
  Описание: Название банка исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: АО "Halyk Bank"

{{executor_iban}}
  Описание: ИИК (счет) исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: KZ987654321098765432

{{executor_bik}}
  Описание: БИК банка исполнителя
  Автозаполнение: Да (из настроек организации)
  Редактирование: Заблокировано
  Пример: HSBKKZKX

═══════════════════════════════════════════════════════════════════════════

ДОГОВОР
───────

{{contract_number}}
  Описание: Номер договора
  Автозаполнение: Да (из CRM)
  Пример: 001/2024

{{contract_date}}
  Описание: Дата заключения договора
  Автозаполнение: Нет
  Пример: 15.01.2024

{{contract_start_date}}
  Описание: Дата начала действия договора
  Автозаполнение: Да (текущая дата)
  Пример: 15.01.2024

{{contract_end_date}}
  Описание: Дата окончания действия договора
  Автозаполнение: Да (рассчитывается автоматически)
  Пример: 15.02.2024

{{contract_amount}}
  Описание: Сумма договора в цифрах (₸)
  Автозаполнение: Да (из бюджета проекта)
  Пример: 500000

{{contract_amount_words}}
  Описание: Сумма договора прописью
  Автозаполнение: Да (генерируется автоматически из contract_amount)
  Редактирование: Заблокировано
  Пример: Пятьсот тысяч тенге 00 тиын

{{duration}}
  Описание: Срок действия договора в месяцах
  Автозаполнение: Да (по умолчанию 1 месяц)
  Варианты: 1, 3, 6, 12 месяцев
  Пример: 3

═══════════════════════════════════════════════════════════════════════════

УСЛУГИ
──────

{{service_description}} или {{services_description}}
  Описание: Описание предоставляемых услуг в текстовом виде
  Автозаполнение: Да (формируется из калькулятора услуг)
  Формат: Список выбранных услуг с количеством
  Пример:
    • Разработка сайта: 1
    • SEO оптимизация: 1
    • Контент-менеджмент: 12

{{service_cost}}
  Описание: Стоимость услуги
  Автозаполнение: Да (из калькулятора услуг)
  Пример: 500000

{{payment_type}}
  Описание: Условия оплаты (юридический текст)
  Автозаполнение: Нет (выбирается из списка)
  Пример: Оплата производится в течение 5 (пяти) банковских дней...

═══════════════════════════════════════════════════════════════════════════

ОБЩИЕ ПЕРЕМЕННЫЕ
────────────────

{{current_date}}
  Описание: Текущая дата (автоматически)
  Автозаполнение: Да
  Редактирование: Заблокировано
  Пример: 15.01.2024

{{current_year}}
  Описание: Текущий год (автоматически)
  Автозаполнение: Да
  Редактирование: Заблокировано
  Пример: 2024

{{index}}
  Описание: Номер приложения или пункта (для нумерации)
  Автозаполнение: Нет (заполняется вручную)
  Пример: 1, 2, 3 или А, Б, В

═══════════════════════════════════════════════════════════════════════════

ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ В ШАБЛОНЕ
───────────────────────────────

Пример 1: Оформление шапки договора
────────────────────────────────────
ДОГОВОР № {{contract_number}}
на оказание услуг

г. Алматы                                      {{contract_date}}

{{executor_legal_name}}, в лице {{executor_position}} {{executor_director}},
действующего на основании {{executor_basis}}, именуемое в дальнейшем
"Исполнитель", с одной стороны, и {{customer_legal_name}}, в лице {{customer_director}},
действующего на основании {{customer_basis}}, именуемое в дальнейшем "Заказчик",
с другой стороны, заключили настоящий договор о нижеследующем:

ПРИМЕЧАНИЕ: Здесь используются краткие формы executor_position и executor_basis


Пример 2: Предмет договора
───────────────────────────
1. ПРЕДМЕТ ДОГОВОРА

1.1. Исполнитель обязуется оказать Заказчику следующие услуги:
{{services_description}}

1.2. Стоимость услуг составляет {{contract_amount}} ({{contract_amount_words}}).

ПРИМЕЧАНИЕ: services_description автоматически формируется из калькулятора услуг в виде:
• Разработка сайта: 1
• SEO оптимизация: 1
• Контент-менеджмент: 12


Пример 3: Реквизиты сторон
───────────────────────────
РЕКВИЗИТЫ СТОРОН

Исполнитель:                          Заказчик:
{{executor_legal_name}}               {{customer_legal_name}}
БИН: {{executor_bin}}                 БИН: {{customer_bin}}
Адрес: {{executor_address}}           Адрес: {{customer_address}}
Тел: {{executor_phone}}               Тел: {{customer_phone}}
Email: {{executor_email}}             Email: {{customer_email}}

Банковские реквизиты:                 Банковские реквизиты:
{{executor_bank}}                     {{customer_bank}}
ИИК: {{executor_iban}}                ИИК: {{customer_iban}}
БИК: {{executor_bik}}                 БИК: {{customer_bik}}

═══════════════════════════════════════════════════════════════════════════

ВАЖНЫЕ ЗАМЕЧАНИЯ
────────────────

✓ Все переменные должны быть заключены в двойные фигурные скобки: {{переменная}}
✓ Названия переменных чувствительны к регистру
✓ Пробелы внутри скобок не допускаются
✓ Переменные с автозаполнением можно не заполнять вручную
✓ Заблокированные переменные нельзя редактировать при генерации документа
✓ Используйте client_ или customer_ префиксы взаимозаменяемо
✓ Для исполнителя доступны краткие синонимы:
  - executor_position = executor_director_position
  - executor_basis = executor_authority_basis
✓ Для услуг: services_description = service_description

═══════════════════════════════════════════════════════════════════════════

Дата создания инструкции: ${new Date().toLocaleDateString('ru-RU')}
Версия: 1.1 - Добавлены синонимы для переменных исполнителя и услуг`;

    const blob = new Blob([instructions], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Инструкция_по_переменным_для_шаблонов.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocument = async (doc: GeneratedDocument) => {
    try {
      await generatedDocumentService.downloadDocument(doc);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Удалить документ?')) return;
    try {
      await generatedDocumentService.delete(id);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return;
    try {
      await documentTemplateService.delete(id);
      setTemplates(temps => temps.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const updated = await generatedDocumentService.updateStatus(id, status);
      setDocuments(docs => docs.map(d => d.id === id ? updated : d));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleGenerateDocument = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setShowGeneratorModal(true);
  };

  const handleDocumentGenerated = () => {
    setShowGeneratorModal(false);
    setSelectedTemplate(null);
    loadData();
  };

  const handleExecutorEdit = (executor: ExecutorCompany | null) => {
    setSelectedExecutor(executor);
    setShowExecutorModal(true);
  };

  const handleExecutorSaved = () => {
    setShowExecutorModal(false);
    setSelectedExecutor(null);
    loadData();
  };

  const filteredDocuments = statusFilter === 'all'
    ? documents
    : documents.filter(d => d.status === statusFilter);

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      generated: 'bg-blue-100 text-blue-700',
      sent: 'bg-yellow-100 text-yellow-700',
      signed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    const labels = {
      draft: 'Черновик',
      generated: 'Сгенерирован',
      sent: 'Отправлен',
      signed: 'Подписан',
      cancelled: 'Отменен'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Документы</h1>
        </div>

        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              activeTab === 'documents'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Список документов
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Upload className="w-4 h-4 inline-block mr-2" />
            Шаблоны
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4 inline-block mr-2" />
            Реквизиты исполнителя
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'documents' && (
          <div>
            <div className="flex gap-2 mb-4">
              {(['all', 'draft', 'generated', 'sent', 'signed'] as DocumentStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {status === 'all' ? 'Все' : status === 'draft' ? 'Черновик' : status === 'generated' ? 'Сгенерирован' : status === 'sent' ? 'Отправлен' : 'Подписан'}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="text-center py-12">Загрузка...</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Нет документов
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Номер</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDocuments.map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{doc.documentNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{doc.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(doc.createdAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {doc.amount ? `${doc.amount.toLocaleString()} ${doc.currency}` : '—'}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(doc.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDownloadDocument(doc)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Скачать"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {doc.status === 'generated' && (
                              <button
                                onClick={() => handleUpdateStatus(doc.id, 'sent')}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Отправлен"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            {doc.status === 'sent' && (
                              <button
                                onClick={() => handleUpdateStatus(doc.id, 'signed')}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Подписан"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div>
            <div className="mb-4 space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadInstructions}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all shadow-md hover:shadow-lg"
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="font-medium">Скачать инструкцию по переменным</span>
                </button>
                <div className="flex-1 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-lg p-3">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-teal-700">💡 Подсказка:</span> Скачайте инструкцию, чтобы узнать все доступные переменные для шаблонов договоров
                  </p>
                </div>
              </div>

              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    {uploadingTemplate ? 'Загрузка...' : 'Перетащите файл .docx сюда или нажмите для выбора'}
                  </p>
                </div>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleTemplateUpload}
                  className="hidden"
                  disabled={uploadingTemplate}
                />
              </label>
            </div>

            {isLoading ? (
              <div className="text-center py-12">Загрузка...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Нет шаблонов. Загрузите первый шаблон выше.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <div key={template.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                        <p className="text-xs text-gray-500">{template.category}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {template.description && (
                      <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    )}

                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Переменные ({template.parsedVariables.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {template.parsedVariables.slice(0, 5).map(variable => (
                          <span key={variable} className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {`{{${variable}}}`}
                          </span>
                        ))}
                        {template.parsedVariables.length > 5 && (
                          <span className="text-xs px-2 py-1 text-gray-500">
                            +{template.parsedVariables.length - 5}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span>Использован: {template.usageCount} раз</span>
                      <span>{(template.fileSize! / 1024).toFixed(0)} KB</span>
                    </div>

                    <button
                      onClick={() => handleGenerateDocument(template)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Создать документ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <div className="mb-4">
              <button
                onClick={() => handleExecutorEdit(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Добавить организацию
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">Загрузка...</div>
            ) : executorCompanies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Нет организаций
              </div>
            ) : (
              <div className="space-y-4">
                {executorCompanies.map(executor => (
                  <div key={executor.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{executor.shortName}</h3>
                        <p className="text-sm text-gray-500">{executor.legalName}</p>
                        {executor.isDefault && (
                          <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                            По умолчанию
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleExecutorEdit(executor)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">БИН</p>
                        <p className="text-gray-900">{executor.bin}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Телефон</p>
                        <p className="text-gray-900">{executor.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Email</p>
                        <p className="text-gray-900">{executor.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Директор</p>
                        <p className="text-gray-900">{executor.directorName}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-500">ИИК</p>
                        <p className="text-gray-900">{executor.iban || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showGeneratorModal && selectedTemplate && (
        <DocumentGeneratorModal
          template={selectedTemplate}
          paymentTypes={paymentTypes}
          onClose={() => {
            setShowGeneratorModal(false);
            setSelectedTemplate(null);
          }}
          onGenerated={handleDocumentGenerated}
        />
      )}

      {showExecutorModal && (
        <ExecutorCompanyModal
          executor={selectedExecutor}
          onClose={() => {
            setShowExecutorModal(false);
            setSelectedExecutor(null);
          }}
          onSaved={handleExecutorSaved}
        />
      )}
    </div>
  );
};

export default DocumentsPage;
