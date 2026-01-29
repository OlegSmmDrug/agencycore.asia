
import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientStatus, User, Task, Transaction, PaymentType, TaskStatus, Service, Note } from '../types';
import { CLIENT_STATUS_LABELS } from '../constants';
import ServiceCalculator, { CalculatorResult } from './ServiceCalculator';
import WhatsAppChat from './WhatsAppChat';
import ContractGeneratorModal from './ContractGeneratorModal';
import { supabase } from '../lib/supabase';
import { canAssignLead, getAvailableManagers, isCEO, shouldAutoAssignManager } from '../services/leadDistributionService';
import { noteService } from '../services/noteService';
import { crmPipelineStagesService, CrmPipelineStage } from '../services/crmPipelineStagesService';
import { useOrganization } from './OrganizationProvider';

interface ClientModalProps {
  isOpen: boolean;
  client: Partial<Client> | null;
  users: User[];
  tasks: Task[];
  transactions: Transaction[];
  services: Service[];
  currentUserId?: string;
  activityLog?: Array<{
    id: string;
    userId: string | null;
    actionType: string;
    description: string;
    createdAt: string;
  }>;
  onClose: () => void;
  onSave: (client: Partial<Client>) => void;
  onAddTransaction: (transaction: Partial<Transaction>) => void;
  onTaskStatusToggle: (taskId: string) => void;
  onCreateTask: (clientId: string) => void;
  onLaunchProject: (client: Client) => void;
  onServiceCreate: (serviceName: string) => Promise<void>;
  onArchiveClient: (clientId: string, archive: boolean) => void;
}


const generateContractNumber = () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CN-${year}-${random}`;
};

const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  client,
  users,
  tasks,
  transactions,
  services,
  currentUserId,
  activityLog = [],
  onClose,
  onSave,
  onAddTransaction,
  onTaskStatusToggle,
  onCreateTask,
  onLaunchProject,
  onServiceCreate,
  onArchiveClient
}) => {
  const { organization: currentOrganization } = useOrganization();
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [showCalculator, setShowCalculator] = useState(false);
  const [whatsappExpanded, setWhatsappExpanded] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: PaymentType.PREPAYMENT,
    date: new Date().toISOString(),
    amount: 0
  });
  const [isAddingNewService, setIsAddingNewService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [clientNotes, setClientNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<CrmPipelineStage[]>([]);
  const [showContractGenerator, setShowContractGenerator] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadPipelineStages();
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (client) {
      setFormData({
        ...client,
        contractNumber: client.contractNumber || generateContractNumber()
      });

      if (client.id) {
        noteService.getByClient(client.id).then(setClientNotes).catch(console.error);
      }
    } else {
      setFormData({
        status: ClientStatus.NEW_LEAD,
        progressLevel: 0,
        contractStatus: 'draft',
        contractNumber: generateContractNumber(),
        signatoryBasis: 'Устава'
      });
      setClientNotes([]);
    }
  }, [client, isOpen]);

  const loadPipelineStages = async () => {
    if (!currentOrganization?.id) return;
    const stages = await crmPipelineStagesService.getActiveStages(currentOrganization.id);
    setPipelineStages(stages);
  };

  const clientTasks = useMemo(() =>
    tasks.filter(t => t.clientId === formData.id),
    [tasks, formData.id]
  );

  const clientTransactions = useMemo(() =>
    transactions.filter(t => t.clientId === formData.id).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    [transactions, formData.id]
  );

  const totalPaid = useMemo(() =>
    clientTransactions.reduce((sum, t) => sum + t.amount, 0),
    [clientTransactions]
  );

  const paymentProgress = formData.budget ? Math.min((totalPaid / formData.budget) * 100, 100) : 0;

  const currentStage = pipelineStages.find(s => s.statusKey === formData.status) || pipelineStages[0];

  const isContractReady = useMemo(() => {
    return !!(
      formData.legalName &&
      formData.inn &&
      formData.address &&
      formData.director &&
      formData.budget && formData.budget > 0
    );
  }, [formData]);

  const isProjectLaunched = formData.projectLaunched === true;

  const canLaunchProject = useMemo(() => {
    return isContractReady && totalPaid > 0 && !isProjectLaunched;
  }, [isContractReady, totalPaid, isProjectLaunched]);

  const handleCalculatorResult = (result: CalculatorResult) => {
    setFormData(prev => ({
      ...prev,
      budget: result.total,
      calculatorData: result,
      description: (prev.description || '') + (prev.description ? '\n' : '') + result.description
    }));
    setShowCalculator(false);
  };

  const handleAddPayment = () => {
    if (!formData.id || !newTransaction.amount) return;
    onAddTransaction({
      ...newTransaction,
      clientId: formData.id
    });
    setNewTransaction({
      type: PaymentType.PREPAYMENT,
      date: new Date().toISOString(),
      amount: 0
    });
  };

  const handleAddNote = async () => {
    if (!formData.id || !newNoteContent.trim() || !currentUserId) return;
    setIsAddingNote(true);
    try {
      const note = await noteService.create({
        title: '',
        content: newNoteContent,
        authorId: currentUserId,
        clientId: formData.id,
        tags: [],
        isPinned: false
      });
      setClientNotes(prev => [note, ...prev]);
      setNewNoteContent('');
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await noteService.delete(noteId);
      setClientNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleStatusChange = (newStatus: ClientStatus) => {
    const stage = pipelineStages.find(s => s.statusKey === newStatus);
    setFormData(prev => ({
      ...prev,
      status: newStatus,
      progressLevel: stage?.level || 0,
      contractStatus: newStatus === ClientStatus.IN_WORK ? 'signed' : prev.contractStatus
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData };

    const currentUser = users.find(u => u.id === currentUserId);
    if (!currentUser) {
      alert('Ошибка: текущий пользователь не найден');
      return;
    }

    if (!canAssignLead(currentUser, dataToSave)) {
      alert('У вас нет прав для изменения этой сделки. Эта сделка закреплена за другим менеджером.');
      return;
    }

    if (shouldAutoAssignManager(dataToSave, currentUser)) {
      dataToSave.managerId = currentUserId;
    }

    onSave(dataToSave);
  };

  const handleDownloadContract = async () => {
    if (!formData.id || !isContractReady) {
      alert('Заполните все обязательные реквизиты для создания договора');
      return;
    }

    try {
      await onSave(formData);
      setShowContractGenerator(true);
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
      alert('Не удалось сохранить данные. Проверьте заполнение всех полей.');
    }
  };

  const handleContractGenerated = async (fileUrl: string) => {
    const updatedData = {
      ...formData,
      contractFileUrl: fileUrl,
      contractGeneratedAt: new Date().toISOString()
    };
    setFormData(updatedData);
    await onSave(updatedData);
    setShowContractGenerator(false);
    alert('Договор успешно сформирован! Теперь вы можете его скачать.');
  };

  const handleContractFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !formData.id) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert('Разрешены только файлы PDF и DOCX');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Размер файла не должен превышать 10 МБ');
      return;
    }

    setIsUploadingContract(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${formData.id}_${Date.now()}.${fileExt}`;
      const filePath = `contracts/${fileName}`;

      if (formData.contractFileUrl) {
        const oldPath = formData.contractFileUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('client-contracts').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('client-contracts')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-contracts')
        .getPublicUrl(filePath);

      const updatedData = { ...formData, contractFileUrl: publicUrl };
      setFormData(updatedData);
      await onSave(updatedData);

      alert('Договор успешно загружен');
    } catch (error) {
      console.error('Ошибка загрузки договора:', error);
      alert('Не удалось загрузить договор');
    } finally {
      setIsUploadingContract(false);
    }
  };

  const handleDeleteContractFile = async () => {
    if (!formData.contractFileUrl || !formData.id) return;

    if (!confirm('Вы уверены, что хотите удалить загруженный договор?')) return;

    try {
      const filePath = formData.contractFileUrl.split('/').slice(-2).join('/');
      await supabase.storage.from('client-contracts').remove([filePath]);

      const updatedData = { ...formData, contractFileUrl: '' };
      setFormData(updatedData);
      await onSave(updatedData);

      alert('Договор успешно удален');
    } catch (error) {
      console.error('Ошибка удаления договора:', error);
      alert('Не удалось удалить договор');
    }
  };

  const handleDownloadContractFile = async () => {
    if (!formData.contractFileUrl) return;

    try {
      console.log('Скачивание договора, URL:', formData.contractFileUrl);

      let downloadUrl = formData.contractFileUrl;

      if (!downloadUrl.startsWith('http')) {
        const filePath = downloadUrl.split('/').slice(-2).join('/');
        console.log('Относительный путь, получаем publicUrl:', filePath);

        let bucket = 'client-contracts';
        if (filePath.includes('generated-documents') || downloadUrl.includes('generated')) {
          bucket = 'generated-documents';
        }

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        downloadUrl = urlData.publicUrl;
      }

      console.log('Итоговый URL для скачивания:', downloadUrl);

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${formData.company || 'client'}.${downloadUrl.split('.').pop()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('Договор успешно скачан');
    } catch (error: any) {
      console.error('Ошибка скачивания договора:', error);
      alert(`Не удалось скачать договор: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  if (showCalculator) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] overflow-hidden shadow-2xl">
          <ServiceCalculator
            onSelect={handleCalculatorResult}
            onClose={() => setShowCalculator(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="bg-white w-full shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-4">
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Карточка сделки</h1>
                <p className="text-xs text-slate-400">{CLIENT_STATUS_LABELS[formData.status as ClientStatus] || 'Новый лид'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <div className={`w-6 h-6 rounded-full ${formData.managerId ? 'bg-teal-500' : 'bg-slate-300'} flex items-center justify-center text-white text-xs font-bold`}>
                  {formData.managerId ? (users.find(u => u.id === formData.managerId)?.name?.[0] || 'M') : '?'}
                </div>
                <div className="text-xs">
                  <div className="text-slate-400">Ответственный</div>
                  <select
                    className="font-medium text-slate-700 bg-transparent border-0 p-0 text-xs focus:ring-0 cursor-pointer -ml-1"
                    value={formData.managerId || ''}
                    onChange={e => setFormData({ ...formData, managerId: e.target.value || undefined })}
                  >
                    <option value="">Не назначен</option>
                    {getAvailableManagers(users).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.jobTitle})</option>
                    ))}
                  </select>
                </div>
              </div>
              {formData.id && (
                <button
                  onClick={() => {
                    if (confirm(formData.isArchived ? 'Восстановить сделку из архива?' : 'Отправить сделку в архив?')) {
                      onArchiveClient(formData.id!, !formData.isArchived);
                      onClose();
                    }
                  }}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                    formData.isArchived
                      ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                      : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                  }`}
                >
                  {formData.isArchived ? 'Восстановить' : 'В архив'}
                </button>
              )}
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Закрыть
              </button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium">
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 max-w-5xl">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                  <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wide">Контактные данные</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Компания / Проект</label>
                    <input
                      required
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={formData.company || ''}
                      onChange={e => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Название компании"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Контактное лицо</label>
                    <input
                      required
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Имя клиента"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Телефон / WhatsApp</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={formData.phone || ''}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+7 (700) 000-00-00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Источник лида</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={formData.source || 'Manual'}
                      onChange={e => setFormData({ ...formData, source: e.target.value as any })}
                    >
                      <option value="Manual">Ручной ввод</option>
                      <option value="Website">Сайт компании</option>
                      <option value="Referral">Рекомендация</option>
                      <option value="Cold Call">Холодный звонок</option>
                      <option value="Socials">Соцсети</option>
                      <option value="Creatium">Creatium</option>
                      <option value="Other">Другое</option>
                    </select>
                  </div>
                </div>
              </div>

              {(formData.source === 'Creatium' || formData.utmSource || formData.leadSourceWebsite) && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wide">Расширенная информация об источнике</h3>
                  </div>

                  <div className="space-y-4">
                    {formData.leadSourceWebsite && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Сайт / Источник</label>
                          <input
                            type="text"
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 cursor-default"
                            value={formData.leadSourceWebsite || ''}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Страница</label>
                          <input
                            type="text"
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 cursor-default"
                            value={formData.leadSourcePage || ''}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Форма</label>
                          <input
                            type="text"
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 cursor-default"
                            value={formData.leadSourceForm || ''}
                            readOnly
                          />
                        </div>
                      </div>
                    )}

                    {(formData.utmSource || formData.utmMedium || formData.utmCampaign) && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-2">UTM метки</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Source</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default"
                              value={formData.utmSource || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Medium</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default"
                              value={formData.utmMedium || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Campaign</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default"
                              value={formData.utmCampaign || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Content</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default"
                              value={formData.utmContent || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Term</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default"
                              value={formData.utmTerm || '-'}
                              readOnly
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {(formData.clientIdGoogle || formData.clientIdYandex || formData.ymclidMetrika) && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-2">ID метрики и аналитики</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Client ID (Google)</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default font-mono"
                              value={formData.clientIdGoogle || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Client ID (Yandex)</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default font-mono"
                              value={formData.clientIdYandex || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">YMCLID (Metrika)</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default font-mono"
                              value={formData.ymclidMetrika || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">YCLID (Direct)</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default font-mono"
                              value={formData.yclidDirect || '-'}
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">GCLID</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 cursor-default font-mono"
                              value={formData.gclid || '-'}
                              readOnly
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.leadSourceUrl && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Полный URL источника</label>
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 cursor-default font-mono text-slate-600"
                          value={formData.leadSourceUrl || ''}
                          readOnly
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.status !== ClientStatus.NEW_LEAD && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">2</span>
                      <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wide">Детали сделки и бюджет</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCalculator(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg text-sm font-medium hover:from-teal-600 hover:to-teal-700 transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Калькулятор сметы
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Услуги проекта</label>

                      {!isAddingNewService ? (
                        <div className="flex gap-2">
                          <select
                            className="flex-1 border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            value=""
                            onChange={e => {
                              if (e.target.value) {
                                const currentServices = formData.services || [];
                                if (!currentServices.includes(e.target.value)) {
                                  setFormData({ ...formData, services: [...currentServices, e.target.value] });
                                }
                              }
                            }}
                          >
                            <option value="">+ Добавить услугу</option>
                            {services.filter(s => s.isActive).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => setIsAddingNewService(true)}
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200 whitespace-nowrap"
                          >
                            Создать услугу
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="flex-1 border border-slate-200 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            value={newServiceName}
                            onChange={e => setNewServiceName(e.target.value)}
                            placeholder="Название новой услуги"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (newServiceName.trim()) {
                                await onServiceCreate(newServiceName.trim());
                                const currentServices = formData.services || [];
                                if (!currentServices.includes(newServiceName.trim())) {
                                  setFormData({ ...formData, services: [...currentServices, newServiceName.trim()] });
                                }
                                setIsAddingNewService(false);
                                setNewServiceName('');
                              }
                            }}
                            disabled={!newServiceName.trim()}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Создать
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewService(false);
                              setNewServiceName('');
                            }}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      )}

                      {formData.services && formData.services.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.services.map((service, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 text-sm text-teal-700"
                            >
                              <span>{service}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newServices = formData.services?.filter((_, i) => i !== idx);
                                  setFormData({ ...formData, services: newServices });
                                }}
                                className="text-teal-600 hover:text-teal-800"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Общая сумма сделки</label>
                        <div className="relative">
                          <input
                            type="number"
                            className="w-full border border-slate-200 rounded-lg p-3 pr-10 text-lg font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            value={formData.budget || ''}
                            onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
                            onFocus={e => e.target.select()}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-600 font-medium">₸</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Примечания к расчету</label>
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-800 min-h-[52px]">
                          {formData.calculatorData ? (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-orange-600">Детализация из калькулятора:</p>
                              {(formData.calculatorData as CalculatorResult).items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                  <span>{item.name}</span>
                                  <span className="font-medium text-teal-600">{item.price.toLocaleString()} ₸</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-orange-400 text-xs">Используйте калькулятор для детализации</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Техническое описание (из калькулятора)</label>
                        <textarea
                          className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                          rows={3}
                          value={formData.technicalDescription || ''}
                          onChange={e => setFormData({ ...formData, technicalDescription: e.target.value })}
                          placeholder="Постов 12 шт&#10;Сторис 60 шт&#10;Reels 4 шт"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Бриф клиента (заполняется вручную)</label>
                        <textarea
                          className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                          rows={3}
                          value={formData.clientBrief || ''}
                          onChange={e => setFormData({ ...formData, clientBrief: e.target.value })}
                          placeholder="Пожелания клиента, важные детали бизнеса, особенности работы..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(currentStage.level >= 2) && (
                <div className={`rounded-xl border p-5 transition-all ${isContractReady ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isContractReady ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>3</span>
                    <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wide">Юридические реквизиты</h3>
                  </div>
                </div>

                {isContractReady && (
                  <div className="flex items-center justify-between bg-white rounded-lg p-4 mb-4 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">Договор полностью готов</p>
                        <p className="text-xs text-slate-500">№ {formData.contractNumber} от {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadContract}
                        disabled={!isContractReady}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Создать договор
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.id && canLaunchProject && !isProjectLaunched) {
                            handleStatusChange(ClientStatus.IN_WORK);
                            onLaunchProject(formData as Client);
                          }
                        }}
                        disabled={!canLaunchProject || isProjectLaunched}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isProjectLaunched
                            ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200'
                            : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        {isProjectLaunched ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Проект создан
                          </>
                        ) : (
                          <>
                            Запустить в работу
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Полное юридическое наименование</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={formData.legalName || ''}
                      onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                      placeholder="ТОО «Название компании»"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Юридический адрес</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={formData.address || ''}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Город, улица, дом, офис"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">БИН / ИИН (12 цифр)</label>
                    <input
                      type="text"
                      maxLength={12}
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all font-mono"
                      value={formData.inn || ''}
                      onChange={e => setFormData({ ...formData, inn: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                      placeholder="000 000 000 000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Обслуживающий банк</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={(formData as any).bankName || ''}
                      onChange={e => setFormData({ ...formData, bankName: e.target.value } as any)}
                      placeholder="Наименование банка"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Номер счета (ИИК)</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all font-mono"
                      value={(formData as any).accountNumber || ''}
                      onChange={e => setFormData({ ...formData, accountNumber: e.target.value } as any)}
                      placeholder="KZ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">БИК банка</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all font-mono"
                      value={(formData as any).bankBik || ''}
                      onChange={e => setFormData({ ...formData, bankBik: e.target.value } as any)}
                      placeholder="HSBK..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Подписант (ФИО)</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={formData.director || ''}
                      onChange={e => setFormData({ ...formData, director: e.target.value })}
                      placeholder="ФИО директора"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Основание полномочий</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      value={(formData as any).signatoryBasis || 'Устава'}
                      onChange={e => setFormData({ ...formData, signatoryBasis: e.target.value } as any)}
                      placeholder="Устава"
                    />
                  </div>
                </div>
              </div>
              )}

              {(currentStage.level >= 2) && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">4</span>
                      <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wide">Готовый договор</h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-4">Загрузите подписанный договор с клиентом. Он будет отображаться в карточке проекта.</p>

                  {formData.contractFileUrl ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">Договор загружен</p>
                            <p className="text-xs text-slate-500">
                              {formData.contractFileUrl.split('/').pop()?.split('_').slice(1).join('_') || 'contract.pdf'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadContractFile}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Скачать договор"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteContractFile}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить договор"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                      <div className="mb-3">
                        <svg className="w-12 h-12 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-700 mb-1">Загрузите договор</p>
                      <p className="text-xs text-slate-500 mb-4">PDF или DOCX, до 10 МБ</p>
                      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                        isUploadingContract
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}>
                        {isUploadingContract ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Загрузка...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Выбрать файл
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          onChange={handleContractFileUpload}
                          disabled={isUploadingContract || !formData.id}
                          className="hidden"
                        />
                      </label>
                      {!formData.id && (
                        <p className="text-xs text-orange-500 mt-2">Сначала сохраните клиента</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-full lg:w-[480px] xl:w-[520px] bg-slate-800 p-6 space-y-6 overflow-y-auto">
              <div className="bg-slate-700/50 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Текущий этап воронки</p>
                <select
                  className="w-full bg-teal-600 text-white rounded-lg p-3 text-sm font-medium border-0 focus:ring-2 focus:ring-teal-400"
                  value={formData.status || ClientStatus.NEW_LEAD}
                  onChange={e => handleStatusChange(e.target.value as ClientStatus)}
                >
                  {pipelineStages.filter(s => s.statusKey !== ClientStatus.LOST).map(stage => (
                    <option key={stage.statusKey} value={stage.statusKey}>{stage.label}</option>
                  ))}
                </select>
                {currentStage?.hint && (
                  <div className="mt-3 p-3 bg-slate-600/50 rounded-lg">
                    <p className="text-xs text-slate-300">{currentStage.hint}</p>
                  </div>
                )}
                {currentStage && (
                  <div className="flex gap-1 mt-3">
                    {[0, 1, 2, 3].map(level => (
                      <div
                        key={level}
                        className={`flex-1 h-1.5 rounded-full transition-colors ${
                          (currentStage.level >= level) ? 'bg-teal-400' : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <WhatsAppChat
                client={formData as Client}
                currentUser={users.find(u => u.id === formData.managerId)}
                users={users}
                isExpanded={whatsappExpanded}
                onToggleExpand={() => setWhatsappExpanded(!whatsappExpanded)}
              />

              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-white text-sm">Финансы (факт)</h4>
                  </div>
                  <span className="text-xs text-slate-400">KZT ₸</span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Оплачено клиентом</span>
                    <span className="font-bold text-teal-400">{totalPaid.toLocaleString()} ₸</span>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-500">Прогресс оплаты</span>
                    <span className="text-slate-400">План: {(formData.budget || 0).toLocaleString()} ₸</span>
                  </div>
                  <div className="w-full bg-slate-600 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-teal-400 h-full transition-all duration-500"
                      style={{ width: `${paymentProgress}%` }}
                    />
                  </div>
                </div>

                {formData.id ? (
                  <div className="bg-slate-600/50 rounded-lg p-3 space-y-3">
                    <p className="text-xs font-medium text-slate-300 uppercase">Внести новый платеж</p>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Сумма пополнения"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 pr-8 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={newTransaction.amount || ''}
                        onChange={e => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 text-sm">₸</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={newTransaction.date ? new Date(newTransaction.date).toISOString().split('T')[0] : ''}
                        onChange={e => setNewTransaction({ ...newTransaction, date: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() })}
                      />
                      <select
                        className="bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={newTransaction.type}
                        onChange={e => setNewTransaction({ ...newTransaction, type: e.target.value as PaymentType })}
                      >
                        {Object.values(PaymentType).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPayment}
                      disabled={!newTransaction.amount}
                      className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Зафиксировать платеж
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500 border border-dashed border-slate-600 rounded-lg">
                    Сохраните клиента для внесения платежей
                  </div>
                )}

                {clientTransactions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-400 uppercase mb-2">История транзакций</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {clientTransactions.map(t => (
                        <div key={t.id} className="flex justify-between items-center bg-slate-600/30 rounded-lg p-2.5 text-xs">
                          <div>
                            <span className="font-medium text-white">{t.amount.toLocaleString()} ₸</span>
                            <span className="text-slate-500 ml-2">{new Date(t.date).toLocaleDateString()}</span>
                          </div>
                          <span className="bg-slate-700 px-2 py-1 rounded text-slate-400">{t.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-700/50 rounded-xl p-4 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-white text-sm">Задачи и события</h4>
                  </div>
                  {formData.id && (
                    <button
                      type="button"
                      onClick={() => formData.id && onCreateTask(formData.id)}
                      className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center hover:bg-teal-700 transition-colors"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {!formData.id ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-xs">Сохраните для задач</p>
                    </div>
                  ) : clientTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-xs">Нет активных задач</p>
                    </div>
                  ) : (
                    clientTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between bg-slate-600/30 rounded-lg p-3 group hover:bg-slate-600/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === TaskStatus.DONE ? 'bg-green-500' : 'bg-blue-500'}`} />
                          <span className={`text-sm truncate ${task.status === TaskStatus.DONE ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.deadline && (
                            <span className="text-[10px] text-slate-500">{new Date(task.deadline).toLocaleDateString()}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onTaskStatusToggle(task.id)}
                            className="text-slate-500 hover:text-green-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-white text-sm">Заметки</h4>
                  </div>
                  <span className="text-xs text-slate-400">{clientNotes.length}</span>
                </div>

                {formData.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <textarea
                        placeholder="Добавьте заметку о клиенте..."
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                        rows={2}
                        value={newNoteContent}
                        onChange={e => setNewNoteContent(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddNote}
                        disabled={!newNoteContent.trim() || isAddingNote}
                        className="w-full py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAddingNote ? 'Добавление...' : 'Добавить заметку'}
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                      {clientNotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                          <svg className="w-10 h-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <p className="text-xs">Нет заметок</p>
                        </div>
                      ) : (
                        clientNotes.map(note => {
                          const author = users.find(u => u.id === note.authorId);
                          return (
                            <div
                              key={note.id}
                              className="bg-slate-600/30 rounded-lg p-3 border-l-2 border-orange-500 group"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-xs text-white flex-1">{note.content}</p>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                {author && (
                                  <p className="text-[10px] text-slate-500">
                                    {author.name}
                                  </p>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  {new Date(note.createdAt).toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500 border border-dashed border-slate-600 rounded-lg">
                    Сохраните клиента для добавления заметок
                  </div>
                )}
              </div>

              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white text-sm">История действий</h4>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {!formData.id ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs">Сохраните для истории</p>
                    </div>
                  ) : activityLog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-xs">Нет записей</p>
                    </div>
                  ) : (
                    activityLog.map(log => {
                      const user = users.find(u => u.id === log.userId);
                      const timeAgo = getTimeAgo(log.createdAt);

                      return (
                        <div
                          key={log.id}
                          className="bg-slate-600/30 rounded-lg p-3 border-l-2 border-purple-500"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs text-white font-medium">{log.description}</p>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo}</span>
                          </div>
                          {user && (
                            <p className="text-[10px] text-slate-500">
                              {user.name}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
        </form>

        {showContractGenerator && formData.id && (
          <ContractGeneratorModal
            client={formData as Client}
            onClose={() => setShowContractGenerator(false)}
            onGenerated={handleContractGenerated}
          />
        )}
    </div>
  );
};

const getTimeAgo = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} д назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default ClientModal;
