
import React, { useState, useEffect, useRef } from 'react';
import { Project, Client, Task, User, TaskStatus, ProjectStatus, RoadmapTemplate, ProjectKpi, ProjectQuickLink, ProjectRisk, ProjectFocus, ProjectHealthStatus, Note } from '../types';
import SmmAnalytics from './SmmAnalytics';
import RoadmapTemplateModal from './RoadmapTemplateModal';
import ContentCalendar from './contentcalendar';
import ContentModal from './contentmodal';
import AdsAnalytics from './AdsAnalytics';
import GoogleAdsAnalytics from './GoogleAdsAnalytics';
import TikTokAdsAnalytics from './TikTokAdsAnalytics';
import { ShareProjectModal } from './ShareProjectModal';
import SmartDashboard from './smartdashboard';
import QuickLinks from './quicklinks';
import ProjectExpenses from './ProjectExpenses';
import KpiSuggestionModal from './KpiSuggestionModal';
import { projectService, extractContentPlanFromCalculator, extractWorkScopeFromCalculator } from '../services/projectService';
import { validateAccessToken } from '../services/facebookAdsService';
import { validateGoogleAdsToken } from '../services/googleAdsDirectService';
import { validateTikTokToken } from '../services/tiktokAdsService';
import { validateLiveduneToken } from '../services/liveduneService';
import { supabase } from '../lib/supabase';
import { projectExpensesService } from '../services/projectExpensesService';
import RoadmapSetupModal from './RoadmapSetupModal';
import ProjectRoadmapKanban from './ProjectRoadmapKanban';
import { roadmapService } from '../services/roadmapService';
import { syncAllProjectKpis, shouldSyncKpis } from '../services/kpiSyncService';
import { autoCalculateContentForProject, shouldCalculateContent } from '../services/contentCalculationService';
import { projectLegalDocumentsService, ProjectLegalDocument } from '../services/projectLegalDocumentsService';
import { generatedDocumentService, GeneratedDocument } from '../services/generatedDocumentService';
import ProjectDatesModal from './ProjectDatesModal';

interface ProjectDetailsProps {
  project: Project;
  client?: Client;
  tasks: Task[];
  team: User[];
  notes: Note[];
  currentUser: User;
  onBack: () => void;
  onAddTask: (initialData?: Partial<Task>) => void;
  onTaskClick?: (task: Task) => void;
  onToggleTaskStatus: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onUpdateProject: (updatedProject: Project) => void;
  onProjectChangedLocal?: (updatedProject: Project) => void;
  onUpdateClient?: (clientId: string, updates: Partial<Client>) => Promise<void>;
  onBatchCreateTasks?: (newTasks: Task[]) => void;
  onCreateTask?: (task: Omit<Task, 'id'>) => Promise<Task>;
  onAddNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Note>;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

type TabType = 'overview' | 'roadmap' | 'calendar' | 'facebook' | 'google' | 'tiktok' | 'livedune' | 'team' | 'legal' | 'notes' | 'expenses';

const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  project,
  client,
  tasks,
  team,
  notes,
  currentUser,
  onBack,
  onAddTask,
  onTaskClick,
  onToggleTaskStatus,
  onUpdateTask,
  onUpdateProject,
  onProjectChangedLocal,
  onUpdateClient,
  onBatchCreateTasks,
  onCreateTask,
  onAddNote,
  onUpdateNote,
  onDeleteNote
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [selectedContentTask, setSelectedContentTask] = useState<Partial<Task> | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempBasicInfo, setTempBasicInfo] = useState({
    name: project.name,
    description: project.description || '',
    status: project.status
  });
  const [tempBudgetInfo, setTempBudgetInfo] = useState({
    budget: project.budget,
    mediaBudget: project.mediaBudget || 0
  });
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isEditingFacebookSettings, setIsEditingFacebookSettings] = useState(false);
  const [fbAccessToken, setFbAccessToken] = useState(project.facebookAccessToken || '');
  const [fbAdAccountId, setFbAdAccountId] = useState(project.adAccountId || '');
  const [fbTokenValid, setFbTokenValid] = useState<boolean | null>(null);
  const [fbSaving, setFbSaving] = useState(false);
  const [isEditingGoogleSettings, setIsEditingGoogleSettings] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState(project.googleAdsAccessToken || '');
  const [googleCustomerId, setGoogleCustomerId] = useState(project.googleAdsCustomerId || '');
  const [googleTokenValid, setGoogleTokenValid] = useState<boolean | null>(null);
  const [googleSaving, setGoogleSaving] = useState(false);
  const [isEditingTikTokSettings, setIsEditingTikTokSettings] = useState(false);
  const [tiktokAccessToken, setTikTokAccessToken] = useState(project.tiktokAdsAccessToken || '');
  const [tiktokAdvertiserId, setTikTokAdvertiserId] = useState(project.tiktokAdsAdvertiserId || '');
  const [tiktokTokenValid, setTikTokTokenValid] = useState<boolean | null>(null);
  const [tiktokSaving, setTikTokSaving] = useState(false);
  const [isEditingLiveduneSettings, setIsEditingLiveduneSettings] = useState(false);
  const [ldAccessToken, setLdAccessToken] = useState(project.liveduneAccessToken || '');
  const [ldAccountId, setLdAccountId] = useState(project.liveduneAccountId?.toString() || '');
  const [ldTokenValid, setLdTokenValid] = useState<boolean | null>(null);
  const [ldSaving, setLdSaving] = useState(false);
  const [ldAccounts, setLdAccounts] = useState<any[]>([]);
  const [ldLoadingAccounts, setLdLoadingAccounts] = useState(false);
  const [selectedLdAccount, setSelectedLdAccount] = useState<any>(null);
  const [tempContent, setTempContent] = useState({
    postsPlan: project.postsPlan || 0,
    postsFact: project.postsFact || 0,
    reelsPlan: project.reelsPlan || 0,
    reelsFact: project.reelsFact || 0,
    storiesPlan: project.storiesPlan || 0,
    storiesFact: project.storiesFact || 0
  });
  const [tempStartDate, setTempStartDate] = useState(project.startDate);
  const [tempDuration, setTempDuration] = useState(project.duration || 30);
  const [newKpi, setNewKpi] = useState({ name: '', plan: 0, fact: 0 });
  const [tempFocus, setTempFocus] = useState(project.focusWeek || '');
  const [tempWorkScope, setTempWorkScope] = useState(project.workScope || '');
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [isEditingWorkScope, setIsEditingWorkScope] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newRisk, setNewRisk] = useState('');
  const [newFocus, setNewFocus] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteFormData, setNoteFormData] = useState({ title: '', content: '' });
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [stageName, setStageName] = useState('');
  const [isRoadmapSetupModalOpen, setIsRoadmapSetupModalOpen] = useState(false);
  const [hasRoadmapStages, setHasRoadmapStages] = useState(false);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [isKpiSuggestionModalOpen, setIsKpiSuggestionModalOpen] = useState(false);
  const [isSyncingKpis, setIsSyncingKpis] = useState(false);
  const [isCalculatingContent, setIsCalculatingContent] = useState(false);
  const [hasSyncedFromCalculator, setHasSyncedFromCalculator] = useState(false);
  const [legalDocuments, setLegalDocuments] = useState<ProjectLegalDocument[]>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [newDocDescription, setNewDocDescription] = useState('');
  const [currentMonthExpense, setCurrentMonthExpense] = useState<any | null>(null);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [isEditingClientLegal, setIsEditingClientLegal] = useState(false);
  const [tempClientLegal, setTempClientLegal] = useState({
    company: client?.company || '',
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    inn: client?.inn || '',
    address: client?.address || '',
    bankName: client?.bankName || '',
    accountNumber: client?.accountNumber || '',
    bankBik: client?.bankBik || ''
  });

  const tasksRef = useRef(tasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    setHasSyncedFromCalculator(false);
  }, [project.id]);

  useEffect(() => {
    if (activeTab === 'legal') {
      loadLegalDocuments();
    }
  }, [activeTab, project.id]);

  useEffect(() => {
    if (client) {
      setTempClientLegal({
        company: client.company || '',
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        inn: client.inn || '',
        address: client.address || '',
        bankName: client.bankName || '',
        accountNumber: client.accountNumber || '',
        bankBik: client.bankBik || ''
      });
    }
  }, [client]);

  const loadLegalDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const docs = await projectLegalDocumentsService.getDocumentsByProject(project.id);
      setLegalDocuments(docs);

      // Загружаем также сгенерированные документы для клиента
      if (client?.id) {
        const generated = await generatedDocumentService.getByClient(client.id);
        setGeneratedDocuments(generated);
      }
    } catch (error) {
      console.error('Error loading legal documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!newDocDescription.trim()) {
      alert('Пожалуйста, укажите описание документа');
      return;
    }

    setUploadingDocument(true);
    try {
      await projectLegalDocumentsService.uploadDocument(
        project.id,
        file,
        newDocDescription,
        currentUser.id,
        false
      );
      setNewDocDescription('');
      setShowNewDocForm(false);
      await loadLegalDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Ошибка загрузки документа');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) {
      return;
    }

    try {
      await projectLegalDocumentsService.deleteDocument(documentId);
      await loadLegalDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Ошибка удаления документа');
    }
  };

  const handleDownloadDocument = async (filePath: string, fileName: string) => {
    try {
      await projectLegalDocumentsService.downloadDocument(filePath, fileName);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Ошибка скачивания документа');
    }
  };

  const handleDownloadGeneratedDocument = async (document: GeneratedDocument) => {
    try {
      await generatedDocumentService.downloadDocument(document);
    } catch (error) {
      console.error('Error downloading generated document:', error);
      alert('Ошибка скачивания документа');
    }
  };

  useEffect(() => {
    setTempContent({
      postsPlan: project.postsPlan || 0,
      postsFact: project.postsFact || 0,
      reelsPlan: project.reelsPlan || 0,
      reelsFact: project.reelsFact || 0,
      storiesPlan: project.storiesPlan || 0,
      storiesFact: project.storiesFact || 0
    });
  }, [project.id, project.mediaBudget, project.postsPlan, project.postsFact, project.reelsPlan, project.reelsFact, project.storiesPlan, project.storiesFact]);

  useEffect(() => {
    const loadCurrentMonthExpense = async () => {
      setLoadingExpenses(true);
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const expense = await projectExpensesService.getExpenseByProjectAndMonth(project.id, currentMonth);
        setCurrentMonthExpense(expense);
      } catch (error) {
        console.error('Error loading current month expense:', error);
      } finally {
        setLoadingExpenses(false);
      }
    };

    loadCurrentMonthExpense();
  }, [project.id]);

  useEffect(() => {
    const syncFromCalculator = async () => {
      if (!client?.calculatorData?.items || hasSyncedFromCalculator) return;

      const updates: any = {};

      const hasLegacyContent = project.postsPlan || project.reelsPlan || project.storiesPlan;
      const hasNewContent = project.contentMetrics && Object.keys(project.contentMetrics).length > 0;

      if (!hasLegacyContent && !hasNewContent) {
        const contentMetrics = await extractContentPlanFromCalculator(client);
        if (Object.keys(contentMetrics).length > 0) {
          updates.contentMetrics = contentMetrics;
        }
      }

      if (!project.workScope) {
        updates.workScope = extractWorkScopeFromCalculator(client);
      }

      if (Object.keys(updates).length > 0) {
        try {
          const updatedProject = await projectService.update(project.id, updates);
          if (onProjectChangedLocal) {
            onProjectChangedLocal(updatedProject);
          }
          setHasSyncedFromCalculator(true);
        } catch (error) {
          console.error('Error syncing from calculator:', error);
        }
      }
    };

    syncFromCalculator();
  }, [project.id, client?.calculatorData, hasSyncedFromCalculator]);

  useEffect(() => {
    loadProjectMembers();
  }, [project.id]);

  const loadProjectMembers = async () => {
    try {
      setLoadingMembers(true);
      const members = await roadmapService.getProjectMembers(project.id);

      if (members.length === 0) {
        setProjectMembers([]);
        setLoadingMembers(false);
        return;
      }

      const { data: usersData, error } = await supabase
        .from('users')
        .select('*')
        .in('id', members.map(m => m.user_id));

      if (error) throw error;

      const mappedUsers = (usersData || []).map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        avatar: row.avatar || '',
        password: row.password || '',
        systemRole: row.system_role,
        jobTitle: row.job_title,
        allowedModules: row.allowed_modules || [],
        teamLeadId: row.team_lead_id || undefined,
        salary: Number(row.salary) || 0,
        iin: row.iin || '',
        balance: Number(row.balance) || 0,
        role: members.find(m => m.user_id === row.id)?.role || 'member'
      }));

      setProjectMembers(mappedUsers);
    } catch (error) {
      console.error('Error loading project members:', error);
      setProjectMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    const checkRoadmap = async () => {
      try {
        const stages = await roadmapService.getLevel2StagesByProject(project.id);
        setHasRoadmapStages(stages.length > 0);
      } catch (error) {
        console.error('Error checking roadmap:', error);
      }
    };

    checkRoadmap();
  }, [project.id]);

  useEffect(() => {
    const autoSync = async () => {
      if (activeTab !== 'overview') return;

      if (shouldSyncKpis(project) && !isSyncingKpis) {
        setIsSyncingKpis(true);
        try {
          const result = await syncAllProjectKpis(project, '30d');
          if (result) {
            const updatedProject = await projectService.update(project.id, {
              kpis: result.kpis,
              kpiLastSyncedAt: result.lastSyncedAt
            });
            if (onProjectChangedLocal) {
              onProjectChangedLocal(updatedProject);
            }
          }
        } catch (error) {
          console.error('Error syncing KPIs:', error);
        } finally {
          setIsSyncingKpis(false);
        }
      }

      if (shouldCalculateContent(project) && !isCalculatingContent) {
        setIsCalculatingContent(true);
        try {
          const updatedProject = await autoCalculateContentForProject(project, tasksRef.current);
          if (updatedProject && onProjectChangedLocal) {
            onProjectChangedLocal(updatedProject);
          }
        } catch (error) {
          console.error('Error calculating content:', error);
        } finally {
          setIsCalculatingContent(false);
        }
      }
    };

    autoSync();
  }, [project.id, activeTab]);

  const handleSyncKpis = async () => {
    setIsSyncingKpis(true);
    try {
      const result = await syncAllProjectKpis(project, '30d');
      if (result) {
        await projectService.update(project.id, {
          kpis: result.kpis,
          kpiLastSyncedAt: result.lastSyncedAt
        });
      }
    } catch (error) {
      console.error('Error syncing KPIs:', error);
    } finally {
      setIsSyncingKpis(false);
    }
  };

  const handleApplyKpiSuggestions = async (kpis: ProjectKpi[]) => {
    try {
      await projectService.update(project.id, { kpis });
      onUpdateProject({ ...project, kpis });
    } catch (error) {
      console.error('Error applying KPI suggestions:', error);
    }
  };

  const stageNames = ['Этап 1: Подготовка', 'Этап 2: Продакшн', 'Этап 3: Запуск', 'Этап 4: Финал'];

  const statusConfig: Record<ProjectStatus, { label: string, color: string, bg: string }> = {
    [ProjectStatus.KP]: { label: 'Стратегия/КП', color: 'text-sky-700', bg: 'bg-sky-100' },
    [ProjectStatus.PRODUCTION]: { label: 'Продакшн', color: 'text-orange-700', bg: 'bg-orange-100' },
    [ProjectStatus.ADS_START]: { label: 'Запуск рекламы', color: 'text-blue-700', bg: 'bg-blue-100' },
    [ProjectStatus.IN_WORK]: { label: 'В работе', color: 'text-green-700', bg: 'bg-green-100' },
    [ProjectStatus.APPROVAL]: { label: 'Согласование', color: 'text-yellow-700', bg: 'bg-yellow-100' },
    [ProjectStatus.COMPLETED]: { label: 'Завершен', color: 'text-teal-700', bg: 'bg-teal-100' },
    [ProjectStatus.ARCHIVED]: { label: 'Архив', color: 'text-gray-500', bg: 'bg-gray-50' }
  };

  const getStatusConfig = (status: ProjectStatus) => {
    return statusConfig[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
  };

  const handleApplyRoadmap = (template: RoadmapTemplate) => {
    setIsRoadmapModalOpen(false);
    const newTasks: Task[] = [];
    const now = Date.now();
    let dayOffset = 0;

    template.stages.forEach((stage, sIdx) => {
      stage.tasks.forEach((taskTitle, tIdx) => {
        const deadline = new Date(now + (dayOffset + 1) * 24 * 60 * 60 * 1000).toISOString();
        newTasks.push({
          id: `rm_${now}_${sIdx}_${tIdx}`,
          projectId: project.id,
          title: taskTitle,
          description: `Этап: ${stage.name}. Создано из шаблона "${template.name}"`,
          status: TaskStatus.TODO,
          priority: 'Medium',
          type: 'Task',
          deadline: deadline,
          assigneeId: project.teamIds[0],
          acceptanceStatus: 'Pending',
          createdAt: new Date().toISOString(),
          tags: [`Stage-${sIdx + 1}`, stage.name]
        });
        dayOffset += 1;
      });
    });

    if (onBatchCreateTasks) {
      onBatchCreateTasks(newTasks);
    }
  };

  const handleAddTaskToStage = (stageIndex: number) => {
    onAddTask({
      tags: [`Stage-${stageIndex}`, stageNames[stageIndex - 1]]
    });
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Обзор', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'roadmap' as TabType, label: 'Дорожная карта', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'notes' as TabType, label: 'Заметки', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: 'expenses' as TabType, label: 'Расходы', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'calendar' as TabType, label: 'Календарь', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'facebook' as TabType, label: 'Реклама Facebook', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'google' as TabType, label: 'Реклама Google', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'tiktok' as TabType, label: 'Реклама TikTok', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
    { id: 'livedune' as TabType, label: 'Livedune', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'team' as TabType, label: 'Команда', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'legal' as TabType, label: 'Юр.данные', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
  ];

  const handleArchiveProject = async () => {
    if (!confirm(project.isArchived ? 'Восстановить проект из архива?' : 'Архивировать проект?')) {
      return;
    }

    try {
      await projectService.update(project.id, {
        isArchived: !project.isArchived,
        status: project.isArchived ? ProjectStatus.IN_WORK : ProjectStatus.ARCHIVED
      });

      onUpdateProject({
        ...project,
        isArchived: !project.isArchived,
        status: project.isArchived ? ProjectStatus.IN_WORK : ProjectStatus.ARCHIVED
      });
    } catch (error) {
      console.error('Error archiving/restoring project:', error);
      alert('Ошибка при изменении статуса проекта');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Пожалуйста, выберите изображение (PNG, JPG, GIF или WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5 МБ');
      return;
    }

    setIsUploadingImage(true);
    try {
      const { supabase } = await import('../lib/supabase');
      const bucket = 'project-images';

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}-${sanitizedFileName}`;
      const filePath = `${project.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(uploadError.message || 'Ошибка при загрузке файла');
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Не удалось получить URL изображения');
      }

      await onUpdateProject({ ...project, imageUrl: urlData.publicUrl });
      alert('Фото успешно загружено!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Ошибка при загрузке фото: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const renderProjectInfoBlock = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 pb-0">
        <button
          onClick={onBack}
          className="mb-4 p-2 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-2 text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Назад</span>
        </button>
      </div>

      <div className="p-6 pt-0">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            {isEditMode ? (
              <div className="space-y-4 bg-blue-50 p-4 rounded-xl border border-blue-200">
                <div>
                  <label className="text-xs text-slate-600 uppercase font-semibold block mb-2">Название проекта</label>
                  <input
                    type="text"
                    value={tempBasicInfo.name}
                    onChange={(e) => setTempBasicInfo({ ...tempBasicInfo, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 uppercase font-semibold block mb-2">Описание</label>
                  <textarea
                    value={tempBasicInfo.description}
                    onChange={(e) => setTempBasicInfo({ ...tempBasicInfo, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                    placeholder="Описание проекта..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleSaveBasicInfo();
                      setIsEditMode(false);
                    }}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setTempBasicInfo({
                        name: project.name,
                        description: project.description || '',
                        status: project.status
                      });
                      setIsEditMode(false);
                    }}
                    className="px-4 py-2 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="relative group flex-shrink-0">
                  {project.imageUrl ? (
                    <>
                      <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100">
                        <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
                      </div>
                      <label className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={isUploadingImage}
                        />
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </label>
                    </>
                  ) : (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploadingImage}
                      />
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </label>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusConfig(project.status).bg} ${getStatusConfig(project.status).color}`}>
                      {getStatusConfig(project.status).label}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-slate-500 text-sm mb-3">{project.description}</p>
                  )}

                  {project.services && project.services.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.services.map((service, idx) => (
                        <span key={idx} className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                          {service}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Редактировать</span>
                    </button>
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                      title="Поделиться с клиентом"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <span>Поделиться</span>
                    </button>
                    <button
                      onClick={handleArchiveProject}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                      title={project.isArchived ? 'Восстановить из архива' : 'Архивировать проект'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span>{project.isArchived ? 'Восстановить' : 'Архивировать'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {client && (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 min-w-[280px]">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg flex-shrink-0 overflow-hidden">
                {client.logoUrl ? (
                  <img
                    src={client.logoUrl}
                    alt={client.company}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'w-full h-full flex items-center justify-center text-blue-600 font-bold text-lg';
                        fallback.textContent = client.company.charAt(0);
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  client.company.charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-800 truncate">{client.company}</h4>
                <p className="text-sm text-slate-500 truncate">{client.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="text-xs text-blue-600 hover:underline">{client.phone}</a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">$</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Финансы и Сроки</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Финансовая секция */}
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Стоимость проекта</p>
                <p className="text-3xl font-bold text-slate-800">{project.budget.toLocaleString()} ₸</p>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Медиа бюджет</p>
                <p className="text-3xl font-bold text-slate-800">{(project.mediaBudget || 0).toLocaleString()} ₸</p>
              </div>

              {/* Прогресс-бар медиа бюджета */}
              <div className="pt-2">
                <p className="text-sm text-slate-600 mb-2">Медиа бюджет (расход):</p>
                <div className="relative w-full h-6 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                    style={{ width: '0%' }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1 text-xs">
                  <span className="text-emerald-600 font-semibold">Маржа: 100%</span>
                  <span className="text-slate-500">Расход: 0%</span>
                </div>
              </div>

              <button
                onClick={handleRenewProject}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mt-4"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Продлить работу (+30 дней)</span>
              </button>
            </div>

            {/* Секция сроков проекта */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-slate-800">Сроки проекта</h4>
                <button
                  onClick={() => setIsEditingDates(!isEditingDates)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Редактировать
                </button>
              </div>

              <div className="space-y-4">
                {/* Начало */}
                <div>
                  <label className="block text-xs text-slate-500 uppercase font-semibold mb-1.5">Начало</label>
                  {isEditingDates ? (
                    <input
                      type="date"
                      value={tempStartDate || ''}
                      onChange={(e) => setTempStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-lg text-base font-semibold bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                  ) : (
                    <div className="px-3 py-2.5 bg-white border-2 border-slate-200 rounded-lg">
                      <p className="text-base font-bold text-slate-800">
                        {project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU') : '-'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Срок в днях */}
                <div>
                  <label className="block text-xs text-slate-500 uppercase font-semibold mb-1.5">Срок (дней)</label>
                  {isEditingDates ? (
                    <input
                      type="number"
                      value={tempDuration || ''}
                      onChange={(e) => setTempDuration(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-lg text-base font-semibold bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                  ) : (
                    <div className="px-3 py-2.5 bg-white border-2 border-slate-200 rounded-lg">
                      <p className="text-base font-bold text-slate-800">{project.duration || 30}</p>
                    </div>
                  )}
                </div>

                {/* Окончание */}
                <div>
                  <label className="block text-xs text-slate-500 uppercase font-semibold mb-1.5">Окончание</label>
                  <div className="px-3 py-2.5 bg-white border-2 border-slate-200 rounded-lg">
                    <p className={`text-base font-bold ${new Date(project.endDate) < new Date() ? 'text-red-600' : 'text-slate-800'}`}>
                      {project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : '-'}
                    </p>
                  </div>
                </div>

                {/* Быстрые кнопки выбора срока */}
                {isEditingDates && (
                  <>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setTempDuration(7)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          tempDuration === 7
                            ? 'bg-slate-800 text-white'
                            : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        7 дней
                      </button>
                      <button
                        onClick={() => setTempDuration(14)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          tempDuration === 14
                            ? 'bg-slate-800 text-white'
                            : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        14 дней
                      </button>
                      <button
                        onClick={() => setTempDuration(30)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          tempDuration === 30
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        30 дней
                      </button>
                    </div>

                    {/* Кнопка сохранения */}
                    <button
                      onClick={() => {
                        handleSaveDates(tempStartDate, tempDuration);
                      }}
                      className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Сохранить изменения
                    </button>
                  </>
                )}

                {/* Кнопка продления текущего */}
                <button
                  onClick={handleRenewProject}
                  className="w-full px-4 py-3 bg-white hover:bg-teal-50 text-teal-600 border-2 border-teal-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Продлить текущий (+30 дней)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleRenewProject = async () => {
    try {
      const updatedProject = await projectService.renewProject(project.id, project, currentUser.id);
      onUpdateProject(updatedProject);
    } catch (error) {
      console.error('Error renewing project:', error);
    }
  };

  const handleAddKpi = () => {
    if (!newKpi.name) return;
    const kpi: ProjectKpi = {
      id: `kpi_${Date.now()}`,
      name: newKpi.name,
      plan: newKpi.plan,
      fact: newKpi.fact
    };
    const updatedKpis = [...(project.kpis || []), kpi];
    onUpdateProject({ ...project, kpis: updatedKpis });
    setNewKpi({ name: '', plan: 0, fact: 0 });
  };

  const handleUpdateKpi = (kpiId: string, updates: Partial<ProjectKpi>) => {
    const updatedKpis = (project.kpis || []).map(k => k.id === kpiId ? { ...k, ...updates } : k);
    onUpdateProject({ ...project, kpis: updatedKpis });
  };

  const handleDeleteKpi = (kpiId: string) => {
    const updatedKpis = (project.kpis || []).filter(k => k.id !== kpiId);
    onUpdateProject({ ...project, kpis: updatedKpis });
  };

  const handleSaveBasicInfo = () => {
    onUpdateProject({
      ...project,
      name: tempBasicInfo.name,
      description: tempBasicInfo.description,
      status: tempBasicInfo.status
    });
      };

  const handleSaveBudgetInfo = () => {
    onUpdateProject({
      ...project,
      budget: tempBudgetInfo.budget,
      mediaBudget: tempBudgetInfo.mediaBudget
    });
  };

  const handleSaveFocus = () => {
    onUpdateProject({ ...project, focusWeek: tempFocus });
      };

  const handleSaveWorkScope = () => {
    onUpdateProject({ ...project, workScope: tempWorkScope });
      };

  const handleSaveMediaBudget = () => {
    onUpdateProject({ ...project, mediaBudget: tempBudgetInfo.mediaBudget });
  };

  const handleSaveClientLegal = async () => {
    if (!client || !onUpdateClient) return;
    await onUpdateClient(client.id, tempClientLegal);
    setIsEditingClientLegal(false);
  };

  const handleCancelClientLegal = () => {
    if (client) {
      setTempClientLegal({
        company: client.company || '',
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        inn: client.inn || '',
        address: client.address || '',
        bankName: client.bankName || '',
        accountNumber: client.accountNumber || '',
        bankBik: client.bankBik || ''
      });
    }
    setIsEditingClientLegal(false);
  };

  const handleSaveContent = () => {
    onUpdateProject({
      ...project,
      postsPlan: tempContent.postsPlan,
      postsFact: tempContent.postsFact,
      reelsPlan: tempContent.reelsPlan,
      reelsFact: tempContent.reelsFact,
      storiesPlan: tempContent.storiesPlan,
      storiesFact: tempContent.storiesFact
    });
    setIsEditingContent(false);
  };

  const handleAddRisk = () => {
    if (!newRisk.trim()) return;
    const risk: ProjectRisk = {
      id: `risk_${Date.now()}`,
      text: newRisk,
      severity: 'medium',
      createdAt: new Date().toISOString()
    };
    const updatedRisks = [...(project.risks || []), risk];
    onUpdateProject({ ...project, risks: updatedRisks });
    setNewRisk('');
  };

  const handleDeleteRisk = (riskId: string) => {
    const updatedRisks = (project.risks || []).filter(r => r.id !== riskId);
    onUpdateProject({ ...project, risks: updatedRisks });
  };

  const handleAddFocus = () => {
    if (!newFocus.trim()) return;
    const focus: ProjectFocus = {
      id: `focus_${Date.now()}`,
      text: newFocus,
      createdAt: new Date().toISOString()
    };
    const updatedFocuses = [...(project.focuses || []), focus];
    onUpdateProject({ ...project, focuses: updatedFocuses });
    setNewFocus('');
  };

  const handleDeleteFocus = (focusId: string) => {
    const updatedFocuses = (project.focuses || []).filter(f => f.id !== focusId);
    onUpdateProject({ ...project, focuses: updatedFocuses });
  };

  const handleSaveDates = (newStartDate: string, newDuration: number) => {
    const startDate = new Date(newStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + newDuration);
    onUpdateProject({
      ...project,
      startDate: newStartDate,
      duration: newDuration,
      endDate: endDate.toISOString().split('T')[0]
    });
    setIsEditingDates(false);
  };

  const calculateEndDate = () => {
    if (!tempStartDate) return '-';
    const startDate = new Date(tempStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + tempDuration);
    return endDate.toLocaleDateString('ru-RU');
  };

  const getHealthConfig = (status: ProjectHealthStatus) => {
    const configs = {
      excellent: { label: 'Все отлично', color: 'text-green-600', bg: 'bg-green-50', icon: 'check' },
      good: { label: 'Хорошо', color: 'text-blue-600', bg: 'bg-blue-50', icon: 'check' },
      warning: { label: 'Требует внимания', color: 'text-amber-600', bg: 'bg-amber-50', icon: 'alert' },
      critical: { label: 'Критично', color: 'text-red-600', bg: 'bg-red-50', icon: 'alert' }
    };
    return configs[status] || configs.good;
  };

  const renderOverview = () => {
    const kpis = project.kpis || [];
    const kpiTotal = kpis.reduce((acc, k) => ({ plan: acc.plan + k.plan, fact: acc.fact + k.fact }), { plan: 0, fact: 0 });
    const kpiProgress = kpiTotal.plan > 0 ? Math.round((kpiTotal.fact / kpiTotal.plan) * 100) : 0;
    const healthConfig = getHealthConfig(project.healthStatus || 'good');
    const margin = project.budget - (project.mediaBudget || 0);
    const marginPercent = project.budget > 0 ? Math.round((margin / project.budget) * 100) : 0;
    const mediaPercent = project.budget > 0 ? Math.round(((project.mediaBudget || 0) / project.budget) * 100) : 0;

    const revenue = project.budget || 0;
    const expenses = currentMonthExpense?.totalExpenses || 0;
    const profit = revenue - expenses;
    const profitMarginPercent = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
    const expensePercent = revenue > 0 ? Math.min((expenses / revenue) * 100, 100) : 0;

    return (
      <div className="space-y-4">
        <SmartDashboard
          project={project}
          tasks={tasks}
          onSuggestKpi={() => setIsKpiSuggestionModalOpen(true)}
          onEditKpi={() => setIsEditMode(true)}
          onEditContent={() => setIsEditingContent(true)}
          onSyncKpis={handleSyncKpis}
          isSyncingKpis={isSyncingKpis}
        />

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl border border-blue-700 shadow-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-white text-lg">Финансы проекта</h3>
              </div>
              {loadingExpenses && (
                <span className="text-xs text-blue-200 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Обновление...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Выручка</span>
                </div>
                <p className="text-2xl font-bold text-white">{revenue.toLocaleString()} ₸</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Расходы</span>
                </div>
                <p className="text-2xl font-bold text-white">{expenses.toLocaleString()} ₸</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${profit >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                  <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Прибыль</span>
                </div>
                <p className={`text-2xl font-bold ${profit >= 0 ? 'text-white' : 'text-rose-300'}`}>
                  {profit.toLocaleString()} ₸
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-100">Использование бюджета</span>
                <span className="text-sm font-bold text-white">{expensePercent.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-blue-900/50 rounded-full overflow-hidden border border-blue-700/50">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    expensePercent > 90 ? 'bg-gradient-to-r from-rose-500 to-rose-600' :
                    expensePercent > 70 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                    'bg-gradient-to-r from-emerald-500 to-emerald-600'
                  }`}
                  style={{ width: `${expensePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-blue-200">Маржинальность:</span>
                <span className={`text-sm font-bold ${
                  Number(profitMarginPercent) >= 50 ? 'text-emerald-300' :
                  Number(profitMarginPercent) >= 20 ? 'text-amber-300' :
                  'text-rose-300'
                }`}>
                  {profitMarginPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {isEditMode && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800">Редактирование KPI</h3>
              <button onClick={() => setIsEditMode(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-2">
              {kpis.map(kpi => (
                <div key={kpi.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className="text-xs text-slate-700 flex-1 truncate">{kpi.name}</span>
                  <input type="number" value={kpi.fact || ''} onChange={(e) => handleUpdateKpi(kpi.id, { fact: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-14 px-2 py-1 text-xs border border-slate-200 rounded" placeholder="Факт" />
                  <span className="text-slate-400 text-xs">/</span>
                  <input type="number" value={kpi.plan || ''} onChange={(e) => handleUpdateKpi(kpi.id, { plan: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-14 px-2 py-1 text-xs border border-slate-200 rounded" placeholder="План" />
                  <button onClick={() => handleDeleteKpi(kpi.id)} className="text-red-400 hover:text-red-600 p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5 pt-1">
                <input type="text" value={newKpi.name} onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })}
                  placeholder="Название KPI" className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg" />
                <input type="number" value={newKpi.plan || ''} onChange={(e) => setNewKpi({ ...newKpi, plan: Number(e.target.value) })}
                  onFocus={(e) => e.target.select()}
                  placeholder="План" className="w-16 px-2 py-1.5 text-xs border border-slate-200 rounded-lg" />
                <button onClick={handleAddKpi} className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">+</button>
              </div>
            </div>
          </div>
        )}

        {isEditingContent && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-800">Редактирование контента</h3>
                {client?.calculatorData?.items && (
                  <button
                    onClick={async () => {
                      const contentMetrics = await extractContentPlanFromCalculator(client);

                      if (Object.keys(contentMetrics).length > 0) {
                        const firstMetric = Object.entries(contentMetrics)[0];
                        const secondMetric = Object.entries(contentMetrics)[1];
                        const thirdMetric = Object.entries(contentMetrics)[2];

                        setTempContent(prev => ({
                          ...prev,
                          postsPlan: firstMetric?.[1]?.plan || prev.postsPlan,
                          reelsPlan: secondMetric?.[1]?.plan || prev.reelsPlan,
                          storiesPlan: thirdMetric?.[1]?.plan || prev.storiesPlan
                        }));
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Загрузить из калькулятора
                  </button>
                )}
              </div>
              <button onClick={() => setIsEditingContent(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Посты (факт)</label>
                  <input type="number" value={tempContent.postsFact || ''} onChange={(e) => setTempContent({ ...tempContent, postsFact: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Посты (план)</label>
                  <input type="number" value={tempContent.postsPlan || ''} onChange={(e) => setTempContent({ ...tempContent, postsPlan: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Reels (факт)</label>
                  <input type="number" value={tempContent.reelsFact || ''} onChange={(e) => setTempContent({ ...tempContent, reelsFact: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Reels (план)</label>
                  <input type="number" value={tempContent.reelsPlan || ''} onChange={(e) => setTempContent({ ...tempContent, reelsPlan: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Stories (факт)</label>
                  <input type="number" value={tempContent.storiesFact || ''} onChange={(e) => setTempContent({ ...tempContent, storiesFact: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Stories (план)</label>
                  <input type="number" value={tempContent.storiesPlan || ''} onChange={(e) => setTempContent({ ...tempContent, storiesPlan: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { handleSaveContent(); setIsEditingContent(false); }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Сохранить</button>
                <button onClick={() => setIsEditingContent(false)} className="px-4 py-2 text-slate-600 rounded-lg text-sm hover:bg-slate-100">Отмена</button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <h3 className="font-bold text-slate-800">Объем работ</h3>
              </div>
              <button onClick={() => { setTempWorkScope(project.workScope || ''); setIsEditingWorkScope(!isEditingWorkScope); }} className="text-sm text-blue-600 hover:text-blue-700">
                {isEditingWorkScope ? 'Отмена' : 'Изменить'}
              </button>
            </div>
            {isEditingWorkScope ? (
              <div className="space-y-3">
                {client?.calculatorData?.items && (
                  <button
                    onClick={() => setTempWorkScope(extractWorkScopeFromCalculator(client))}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Загрузить из калькулятора
                  </button>
                )}
                <textarea value={tempWorkScope} onChange={(e) => setTempWorkScope(e.target.value)}
                  placeholder="12 постов, 4 Reels..." rows={5}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => { handleSaveWorkScope(); setIsEditingWorkScope(false); }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Сохранить</button>
                </div>
              </div>
            ) : (
              <p className="text-slate-600 whitespace-pre-line text-sm">{project.workScope || 'Не указан'}</p>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <QuickLinks
            links={project.quickLinksData}
            onSave={(links) => onUpdateProject({ ...project, quickLinksData: links })}
          />

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="font-bold text-slate-800">Фокус</h3>
              </div>
            </div>
            <div className="space-y-2">
              {(project.focuses || []).map(focus => (
                <div key={focus.id} className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 group">
                  <span className="text-sm text-slate-700 flex-1">{focus.text}</span>
                  <button onClick={() => handleDeleteFocus(focus.id)} className="text-amber-600 hover:text-amber-700 opacity-0 group-hover:opacity-100">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFocus}
                  onChange={(e) => setNewFocus(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFocus();
                    }
                  }}
                  placeholder="Добавить фокус..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <button
                  onClick={handleAddFocus}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors font-medium"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="font-bold text-slate-800">Риски</h3>
              </div>
            </div>
            <div className="space-y-2">
              {(project.risks || []).map(risk => (
                <div key={risk.id} className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200 group">
                  <span className="text-sm text-slate-700 flex-1">{risk.text}</span>
                  <button onClick={() => handleDeleteRisk(risk.id)} className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input type="text" value={newRisk} onChange={(e) => setNewRisk(e.target.value)}
                  placeholder="Добавить риск..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                <button onClick={handleAddRisk} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleCreateTaskInStage = (stageLevel2Id: string) => {
    onAddTask({
      projectId: project.id,
      stage_level2_id: stageLevel2Id
    });
  };

  const handleRoadmapSetupComplete = async () => {
    try {
      const stages = await roadmapService.getLevel2StagesByProject(project.id);
      setHasRoadmapStages(stages.length > 0);
      await loadProjectMembers();
    } catch (error) {
      console.error('Error refreshing roadmap:', error);
    }
  };

  const renderRoadmap = () => {
    if (!hasRoadmapStages) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Дорожная карта не настроена</h3>
          <p className="text-slate-500 mb-8 text-center max-w-md">
            Сначала выберите участников команды, затем настройте шаблоны дорожной карты для отслеживания прогресса проекта.
          </p>
          <button
            onClick={() => setIsRoadmapSetupModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Настроить дорожную карту
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Дорожная карта проекта</h3>
          <button
            onClick={() => setIsRoadmapSetupModalOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настроить
          </button>
        </div>

        <ProjectRoadmapKanban
          projectId={project.id}
          tasks={tasks}
          users={team}
          onTaskClick={(task) => onTaskClick && onTaskClick(task)}
          onCreateTask={handleCreateTaskInStage}
        />
      </div>
    );
  };

  const contentTypes = ['Post', 'Reels', 'Stories'];
  const contentTasks = tasks.filter(t => contentTypes.includes(t.type));

  const handleContentTaskClick = (task: Task) => {
    setSelectedContentTask(task);
    setIsContentModalOpen(true);
  };

  const handleContentTaskMove = (taskId: string, newDate: string) => {
    onUpdateTask(taskId, { deadline: newDate });
  };

  const handleContentSave = async (taskData: Partial<Task>) => {
    if (selectedContentTask?.id) {
      onUpdateTask(selectedContentTask.id, taskData);
    } else if (onCreateTask) {
      await onCreateTask({
        ...taskData,
        projectId: project.id,
        status: taskData.status || TaskStatus.TODO,
        priority: taskData.priority || 'Medium',
        type: taskData.type || 'Post',
        title: taskData.title || 'Новая публикация'
      } as Omit<Task, 'id'>);
    }
    setIsContentModalOpen(false);
    setSelectedContentTask(null);
  };

  const handleAddContent = (type: 'Post' | 'Reels' | 'Stories') => {
    setSelectedContentTask({
      projectId: project.id,
      type,
      status: TaskStatus.TODO,
      priority: 'Medium'
    });
    setIsContentModalOpen(true);
  };

  const renderCalendar = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Контент-календарь</h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleAddContent('Post')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <span>+ Пост</span>
            </button>
            <button
              onClick={() => handleAddContent('Reels')}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 flex items-center gap-2"
            >
              <span>+ Reels</span>
            </button>
            <button
              onClick={() => handleAddContent('Stories')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2"
            >
              <span>+ Stories</span>
            </button>
          </div>
        </div>
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <ContentCalendar
            tasks={contentTasks}
            onTaskClick={handleContentTaskClick}
            onTaskMove={handleContentTaskMove}
          />
        </div>
      </div>
    );
  };

  const handleSaveFacebookSettings = async () => {
    setFbSaving(true);
    try {
      const isValid = await validateAccessToken(fbAccessToken);
      setFbTokenValid(isValid);

      if (isValid) {
        await onUpdateProject({
          ...project,
          facebookAccessToken: fbAccessToken,
          adAccountId: fbAdAccountId
        });
        setIsEditingFacebookSettings(false);
      }
    } catch (error) {
      console.error('Error saving Facebook settings:', error);
    } finally {
      setFbSaving(false);
    }
  };

  const handleAdAccountChange = (accountId: string) => {
    setFbAdAccountId(accountId);
    onUpdateProject({
      ...project,
      adAccountId: accountId
    });
  };

  const renderFacebook = () => {
    const hasValidConfig = project.facebookAccessToken && project.adAccountId;

    if (!hasValidConfig || isEditingFacebookSettings) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="max-w-xl mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-[#1877F2] rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  f
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Настройка Facebook Ads</h3>
                  <p className="text-slate-500 text-sm">Подключите рекламный кабинет для отслеживания метрик</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={fbAccessToken}
                    onChange={(e) => {
                      setFbAccessToken(e.target.value);
                      setFbTokenValid(null);
                    }}
                    placeholder="Вставьте Access Token из Facebook Business..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  />
                  {fbTokenValid === false && (
                    <p className="text-red-500 text-xs mt-1">Токен недействителен или истек</p>
                  )}
                  {fbTokenValid === true && (
                    <p className="text-green-500 text-xs mt-1">Токен успешно проверен</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ID рекламного аккаунта
                  </label>
                  <input
                    type="text"
                    value={fbAdAccountId}
                    onChange={(e) => setFbAdAccountId(e.target.value)}
                    placeholder="act_123456789 или просто 123456789"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Найдите ID в Facebook Business Manager - Настройки - Рекламные аккаунты
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-blue-800 mb-2">Как получить Access Token:</h4>
                  <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Перейдите в Facebook Business Settings</li>
                    <li>Выберите System Users или создайте нового</li>
                    <li>Назначьте доступ к рекламному аккаунту</li>
                    <li>Сгенерируйте токен с правами ads_read</li>
                  </ol>
                </div>

                <div className="flex gap-3 pt-2">
                  {hasValidConfig && (
                    <button
                      onClick={() => setIsEditingFacebookSettings(false)}
                      className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Отмена
                    </button>
                  )}
                  <button
                    onClick={handleSaveFacebookSettings}
                    disabled={!fbAccessToken || !fbAdAccountId || fbSaving}
                    className="flex-1 py-3 px-4 bg-[#1877F2] text-white font-medium rounded-xl hover:bg-[#1565D8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {fbSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Проверка...
                      </>
                    ) : (
                      'Подключить аккаунт'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Facebook Ads Analytics</h3>
          <button
            onClick={() => setIsEditingFacebookSettings(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настройки
          </button>
        </div>
        <AdsAnalytics
          projectId={project.id}
          accessToken={project.facebookAccessToken!}
          adAccountId={project.adAccountId}
          onAdAccountChange={handleAdAccountChange}
        />
      </div>
    );
  };

  const handleSaveGoogleSettings = async () => {
    setGoogleSaving(true);
    try {
      const isValid = await validateGoogleAdsToken(googleAccessToken);
      setGoogleTokenValid(isValid);

      if (isValid) {
        await onUpdateProject({
          ...project,
          googleAdsAccessToken: googleAccessToken,
          googleAdsCustomerId: googleCustomerId
        });
        setIsEditingGoogleSettings(false);
      }
    } catch (error) {
      console.error('Error saving Google settings:', error);
    } finally {
      setGoogleSaving(false);
    }
  };

  const handleGoogleCustomerIdChange = (customerId: string) => {
    setGoogleCustomerId(customerId);
    onUpdateProject({
      ...project,
      googleAdsCustomerId: customerId
    });
  };

  const renderGoogle = () => {
    const hasValidConfig = project.googleAdsAccessToken && project.googleAdsCustomerId;

    if (!hasValidConfig || isEditingGoogleSettings) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="max-w-xl mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-[#4285F4] rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  G
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Настройка Google Ads</h3>
                  <p className="text-slate-500 text-sm">Подключите рекламный кабинет для отслеживания метрик</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={googleAccessToken}
                    onChange={(e) => {
                      setGoogleAccessToken(e.target.value);
                      setGoogleTokenValid(null);
                    }}
                    placeholder="Вставьте OAuth Access Token из Google Ads..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  />
                  {googleTokenValid === false && (
                    <p className="text-red-500 text-xs mt-1">Токен недействителен или истек</p>
                  )}
                  {googleTokenValid === true && (
                    <p className="text-green-500 text-xs mt-1">Токен успешно проверен</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Customer ID
                  </label>
                  <input
                    type="text"
                    value={googleCustomerId}
                    onChange={(e) => setGoogleCustomerId(e.target.value)}
                    placeholder="123-456-7890"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Найдите Customer ID в правом верхнем углу Google Ads (формат: 123-456-7890)
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-blue-800 mb-2">Как получить Access Token:</h4>
                  <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Перейдите в Google Cloud Console</li>
                    <li>Создайте OAuth 2.0 Client ID</li>
                    <li>Добавьте Google Ads API в проект</li>
                    <li>Получите токен с правами adwords</li>
                  </ol>
                </div>

                <div className="flex gap-3 pt-2">
                  {hasValidConfig && (
                    <button
                      onClick={() => setIsEditingGoogleSettings(false)}
                      className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Отмена
                    </button>
                  )}
                  <button
                    onClick={handleSaveGoogleSettings}
                    disabled={!googleAccessToken || !googleCustomerId || googleSaving}
                    className="flex-1 py-3 px-4 bg-[#4285F4] text-white font-medium rounded-xl hover:bg-[#3367D6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {googleSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Проверка...
                      </>
                    ) : (
                      'Подключить аккаунт'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Google Ads Analytics</h3>
          <button
            onClick={() => setIsEditingGoogleSettings(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настройки
          </button>
        </div>
        <GoogleAdsAnalytics
          projectId={project.id}
          accessToken={project.googleAdsAccessToken!}
          customerId={project.googleAdsCustomerId}
          onCustomerIdChange={handleGoogleCustomerIdChange}
        />
      </div>
    );
  };

  const handleSaveTikTokSettings = async () => {
    setTikTokSaving(true);
    try {
      const isValid = await validateTikTokToken(tiktokAccessToken);
      setTikTokTokenValid(isValid);

      if (isValid) {
        await onUpdateProject({
          ...project,
          tiktokAdsAccessToken: tiktokAccessToken,
          tiktokAdsAdvertiserId: tiktokAdvertiserId
        });
        setIsEditingTikTokSettings(false);
      }
    } catch (error) {
      console.error('Error saving TikTok settings:', error);
    } finally {
      setTikTokSaving(false);
    }
  };

  const handleTikTokAdvertiserIdChange = (advertiserId: string) => {
    setTikTokAdvertiserId(advertiserId);
    onUpdateProject({
      ...project,
      tiktokAdsAdvertiserId: advertiserId
    });
  };

  const renderTikTok = () => {
    const hasValidConfig = project.tiktokAdsAccessToken && project.tiktokAdsAdvertiserId;

    if (!hasValidConfig || isEditingTikTokSettings) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="max-w-xl mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  TT
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Настройка TikTok Ads</h3>
                  <p className="text-slate-500 text-sm">Подключите рекламный кабинет для отслеживания метрик</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={tiktokAccessToken}
                    onChange={(e) => {
                      setTikTokAccessToken(e.target.value);
                      setTikTokTokenValid(null);
                    }}
                    placeholder="Вставьте Access Token из TikTok Ads Manager..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-sm"
                  />
                  {tiktokTokenValid === false && (
                    <p className="text-red-500 text-xs mt-1">Токен недействителен или истек</p>
                  )}
                  {tiktokTokenValid === true && (
                    <p className="text-green-500 text-xs mt-1">Токен успешно проверен</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Advertiser ID
                  </label>
                  <input
                    type="text"
                    value={tiktokAdvertiserId}
                    onChange={(e) => setTikTokAdvertiserId(e.target.value)}
                    placeholder="1234567890123456"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-sm"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Найдите Advertiser ID в TikTok Ads Manager - Настройки аккаунта
                  </p>
                </div>

                <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-pink-800 mb-2">Как получить Access Token:</h4>
                  <ol className="text-xs text-pink-700 space-y-1 list-decimal list-inside">
                    <li>Перейдите в TikTok For Business Developer Portal</li>
                    <li>Создайте приложение для Marketing API</li>
                    <li>Настройте OAuth и получите разрешения</li>
                    <li>Сгенерируйте токен с правами Reporting</li>
                  </ol>
                </div>

                <div className="flex gap-3 pt-2">
                  {hasValidConfig && (
                    <button
                      onClick={() => setIsEditingTikTokSettings(false)}
                      className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Отмена
                    </button>
                  )}
                  <button
                    onClick={handleSaveTikTokSettings}
                    disabled={!tiktokAccessToken || !tiktokAdvertiserId || tiktokSaving}
                    className="flex-1 py-3 px-4 bg-black text-white font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {tiktokSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Проверка...
                      </>
                    ) : (
                      'Подключить аккаунт'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">TikTok Ads Analytics</h3>
          <button
            onClick={() => setIsEditingTikTokSettings(true)}
            className="text-sm text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настройки
          </button>
        </div>
        <TikTokAdsAnalytics
          projectId={project.id}
          accessToken={project.tiktokAdsAccessToken!}
          advertiserId={project.tiktokAdsAdvertiserId}
          onAdvertiserIdChange={handleTikTokAdvertiserIdChange}
        />
      </div>
    );
  };

  const handleLoadLiveduneAccounts = async () => {
    if (!ldAccessToken) return;

    setLdLoadingAccounts(true);
    try {
      const isValid = await validateLiveduneToken(ldAccessToken);
      setLdTokenValid(isValid);

      if (isValid) {
        const { getLiveduneAccounts } = await import('../services/liveduneService');
        const accounts = await getLiveduneAccounts(ldAccessToken);
        const instagramAccounts = accounts.filter(acc => acc.type === 'instagram_new');
        setLdAccounts(instagramAccounts);
      }
    } catch (error) {
      console.error('Error loading Livedune accounts:', error);
      setLdTokenValid(false);
    } finally {
      setLdLoadingAccounts(false);
    }
  };

  const handleSaveLiveduneSettings = async () => {
    setLdSaving(true);
    try {
      if (!selectedLdAccount && !ldAccountId) {
        throw new Error('Выберите аккаунт');
      }

      const accountId = selectedLdAccount ? selectedLdAccount.id : parseInt(ldAccountId);

      await onUpdateProject({
        ...project,
        liveduneAccessToken: ldAccessToken,
        liveduneAccountId: accountId
      });
      setIsEditingLiveduneSettings(false);
      setLdAccounts([]);
      setSelectedLdAccount(null);
    } catch (error) {
      console.error('Error saving Livedune settings:', error);
    } finally {
      setLdSaving(false);
    }
  };

  const handleLiveduneAccountChange = (accountId: number) => {
    setLdAccountId(accountId.toString());
    onUpdateProject({
      ...project,
      liveduneAccountId: accountId
    });
  };

  const renderLivedune = () => {
    const hasValidConfig = project.liveduneAccessToken && project.liveduneAccountId;

    if (!hasValidConfig || isEditingLiveduneSettings) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="max-w-xl mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-tr from-yellow-400 via-red-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Настройка Livedune</h3>
                  <p className="text-slate-500 text-sm">Подключите аккаунт для SMM аналитики</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    API Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={ldAccessToken}
                      onChange={(e) => {
                        setLdAccessToken(e.target.value);
                        setLdTokenValid(null);
                        setLdAccounts([]);
                      }}
                      placeholder="Вставьте API Token из Livedune..."
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-sm"
                    />
                    {ldAccessToken && ldTokenValid !== true && (
                      <button
                        onClick={handleLoadLiveduneAccounts}
                        disabled={ldLoadingAccounts}
                        className="px-6 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {ldLoadingAccounts ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          'Проверить'
                        )}
                      </button>
                    )}
                  </div>
                  {ldTokenValid === false && (
                    <p className="text-red-500 text-xs mt-1">Токен недействителен</p>
                  )}
                  {ldTokenValid === true && ldAccounts.length === 0 && (
                    <p className="text-yellow-600 text-xs mt-1">✓ Токен проверен. Загружаем аккаунты...</p>
                  )}
                  {ldTokenValid === true && ldAccounts.length > 0 && (
                    <p className="text-green-500 text-xs mt-1">✓ Найдено {ldAccounts.length} Instagram аккаунтов</p>
                  )}
                </div>

                {ldAccounts.length > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      Выберите Instagram аккаунт
                    </label>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {ldAccounts.map((account) => (
                        <div
                          key={account.id}
                          onClick={() => setSelectedLdAccount(account)}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedLdAccount?.id === account.id
                              ? 'border-pink-500 bg-pink-50'
                              : 'border-slate-200 hover:border-pink-300 hover:bg-slate-50'
                          }`}
                        >
                          {account.img && (
                            <img src={account.img} alt={account.name} className="w-12 h-12 rounded-full object-cover" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 truncate">{account.name}</p>
                            <p className="text-sm text-slate-500">@{account.short_name}</p>
                            {account.project && (
                              <p className="text-xs text-slate-400">Проект: {account.project}</p>
                            )}
                          </div>
                          {selectedLdAccount?.id === account.id && (
                            <svg className="w-6 h-6 text-pink-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-pink-800 mb-2">Как подключить:</h4>
                  <ol className="text-xs text-pink-700 space-y-1 list-decimal list-inside">
                    <li>Войдите в ваш аккаунт на <a href="https://pro.livedune.com/settings/api" target="_blank" rel="noopener noreferrer" className="underline hover:text-pink-900">pro.livedune.com/settings/api</a></li>
                    <li>Скопируйте API Token</li>
                    <li>Вставьте токен в поле выше и нажмите "Проверить"</li>
                    <li>Выберите нужный Instagram аккаунт из списка</li>
                    <li>Нажмите "Подключить аккаунт"</li>
                  </ol>
                </div>

                <div className="flex gap-3 pt-2">
                  {hasValidConfig && (
                    <button
                      onClick={() => {
                        setIsEditingLiveduneSettings(false);
                        setLdAccounts([]);
                        setSelectedLdAccount(null);
                      }}
                      className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Отмена
                    </button>
                  )}
                  <button
                    onClick={handleSaveLiveduneSettings}
                    disabled={!ldAccessToken || (!selectedLdAccount && !ldAccountId) || ldSaving}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {ldSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Сохранение...
                      </>
                    ) : (
                      'Подключить аккаунт'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Livedune SMM Analytics</h3>
          <button
            onClick={() => setIsEditingLiveduneSettings(true)}
            className="text-sm text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настройки
          </button>
        </div>
        <SmmAnalytics
          accessToken={project.liveduneAccessToken!}
          projectAccountId={project.liveduneAccountId}
          onAccountChange={handleLiveduneAccountChange}
        />
      </div>
    );
  };

  const renderTeam = () => {
    if (loadingMembers) {
      return (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (projectMembers.length === 0) {
      return (
        <div className="text-center p-12 bg-slate-50 rounded-xl border border-slate-200">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Команда не сформирована</h3>
          <p className="text-slate-500 mb-6">
            Перейдите в настройку дорожной карты и выберите участников проекта
          </p>
          <button
            onClick={() => setIsRoadmapSetupModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
          >
            Настроить команду
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projectMembers.map(member => (
          <div key={member.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <img src={member.avatar} alt={member.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-100" />
            <div>
              <h3 className="font-bold text-slate-800">{member.name}</h3>
              <p className="text-sm text-slate-600 font-medium">{member.jobTitle}</p>
              <a href={`mailto:${member.email}`} className="text-xs text-slate-400 hover:text-blue-500 mt-1 block">{member.email}</a>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLegal = () => {
    if (!client) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-slate-400">Клиент не привязан к проекту</p>
        </div>
      );
    }

    const canManageDocuments = currentUser.systemRole === 'Admin' ||
      currentUser.jobTitle.toLowerCase().includes('pm') ||
      currentUser.jobTitle.toLowerCase().includes('project manager');

    const hasContract = !!client.contractFileUrl;
    const otherDocs = legalDocuments;

    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleDownloadContract = async () => {
      if (!client.contractFileUrl) return;

      try {
        const filePath = client.contractFileUrl.split('/').slice(-2).join('/');
        const { data, error } = await supabase.storage
          .from('client-contracts')
          .download(filePath);

        if (error) throw error;

        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contract_${client.company || 'client'}.${filePath.split('.').pop()}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading contract:', error);
        alert('Ошибка скачивания договора');
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Юридические данные клиента</h3>
            {onUpdateClient && !isEditingClientLegal && (
              <button
                onClick={() => setIsEditingClientLegal(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Редактировать
              </button>
            )}
            {isEditingClientLegal && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelClientLegal}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveClientLegal}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Сохранить
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Компания</p>
                {isEditingClientLegal ? (
                  <input
                    type="text"
                    value={tempClientLegal.company}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, company: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Название компании"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{client.company}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Контактное лицо</p>
                {isEditingClientLegal ? (
                  <input
                    type="text"
                    value={tempClientLegal.name}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Имя контактного лица"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{client.name}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Email</p>
                {isEditingClientLegal ? (
                  <input
                    type="email"
                    value={tempClientLegal.email}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, email: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Email адрес"
                  />
                ) : (
                  <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">{client.email}</a>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Телефон</p>
                {isEditingClientLegal ? (
                  <input
                    type="tel"
                    value={tempClientLegal.phone}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, phone: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Номер телефона"
                  />
                ) : (
                  <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">{client.phone}</a>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">БИН/ИИН</p>
                {isEditingClientLegal ? (
                  <input
                    type="text"
                    value={tempClientLegal.inn}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, inn: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Введите БИН/ИИН"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{client.inn || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Юридический адрес</p>
                {isEditingClientLegal ? (
                  <textarea
                    value={tempClientLegal.address}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, address: e.target.value })}
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Введите адрес"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{client.address || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Банк</p>
                {isEditingClientLegal ? (
                  <input
                    type="text"
                    value={tempClientLegal.bankName}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, bankName: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Название банка"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{client.bankName || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">БИК банка</p>
                {isEditingClientLegal ? (
                  <input
                    type="text"
                    value={tempClientLegal.bankBik}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, bankBik: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                    placeholder="БИК банка"
                  />
                ) : (
                  <p className="text-slate-800 font-medium font-mono">{client.bankBik || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">ИИК (Расчетный счет)</p>
                {isEditingClientLegal ? (
                  <input
                    type="text"
                    value={tempClientLegal.accountNumber}
                    onChange={e => setTempClientLegal({ ...tempClientLegal, accountNumber: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                    placeholder="Номер счета"
                  />
                ) : (
                  <p className="text-slate-800 font-medium font-mono">{client.accountNumber || '-'}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Документы проекта</h3>
            {canManageDocuments && !showNewDocForm && (
              <button
                onClick={() => setShowNewDocForm(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Добавить документ
              </button>
            )}
          </div>

          {loadingDocuments ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-slate-500">Загрузка документов...</p>
            </div>
          ) : (
            <>
              {generatedDocuments.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 uppercase mb-3">Сгенерированные документы</h4>
                  <div className="space-y-2">
                    {generatedDocuments.map((doc) => (
                      <div key={doc.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">
                                {doc.name}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {doc.fileName} • {new Date(doc.createdAt).toLocaleDateString('ru-RU')}
                                {doc.amount && ` • ${doc.amount.toLocaleString('ru-RU')} ${doc.currency}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleDownloadGeneratedDocument(doc)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Скачать
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasContract && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 uppercase mb-3">Готовый договор (старая система)</h4>
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            Договор {client.contractNumber || ''} {client.company}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {client.contractGeneratedAt ? new Date(client.contractGeneratedAt).toLocaleDateString('ru-RU') : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={handleDownloadContract}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Скачать
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showNewDocForm && canManageDocuments && (
                <div className="mb-6 border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Новый документ</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Описание документа *
                      </label>
                      <input
                        type="text"
                        value={newDocDescription}
                        onChange={(e) => setNewDocDescription(e.target.value)}
                        placeholder="Например: Акт выполненных работ"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Файл
                      </label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDocument(file);
                        }}
                        disabled={uploadingDocument || !newDocDescription.trim()}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowNewDocForm(false);
                          setNewDocDescription('');
                        }}
                        disabled={uploadingDocument}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-all disabled:opacity-50"
                      >
                        Отмена
                      </button>
                      {uploadingDocument && (
                        <span className="text-sm text-slate-600">Загрузка...</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {otherDocs.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 uppercase mb-3">Другие документы</h4>
                  <div className="space-y-2">
                    {otherDocs.map((doc) => (
                      <div key={doc.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{doc.description}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {doc.fileName} • {formatFileSize(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleDateString('ru-RU')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleDownloadDocument(doc.filePath, doc.fileName)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Скачать
                            </button>
                            {canManageDocuments && (
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasContract && generatedDocuments.length === 0 && otherDocs.length === 0 && !showNewDocForm && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 mb-2">Документов пока нет</p>
                  {canManageDocuments && (
                    <p className="text-sm text-slate-400">Нажмите "Добавить документ", чтобы загрузить первый документ</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderNotes = () => {
    const projectNotes = notes.filter(n => n.projectId === project.id);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Заметки проекта</h3>
          <button
            onClick={async () => {
              await onAddNote({
                title: 'Новая заметка',
                content: '',
                authorId: currentUser.id,
                projectId: project.id,
                tags: [],
                isPinned: false
              });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Добавить заметку
          </button>
        </div>

        {projectNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Заметок пока нет</h3>
            <p className="text-slate-500 mb-8 text-center max-w-md">
              Создайте первую заметку для этого проекта, чтобы отслеживать важные детали и идеи.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectNotes.map(note => {
              const author = team.find(u => u.id === note.authorId);
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    setSelectedNote(note);
                    setNoteFormData({ title: note.title, content: note.content });
                  }}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-all group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-slate-800 text-sm flex-1 line-clamp-1">
                      {note.title || 'Без названия'}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-3 mb-3" dangerouslySetInnerHTML={{ __html: note.content || 'Нет содержимого' }} />
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                    <span>{author?.name || 'Неизвестный автор'}</span>
                    <span>{new Date(note.updatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderExpenses = () => {
    return (
      <ProjectExpenses
        projectId={project.id}
        projectBudget={project.budget}
        currentUser={currentUser}
        project={project}
        onUpdateProject={onUpdateProject}
      />
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'roadmap': return renderRoadmap();
      case 'notes': return renderNotes();
      case 'expenses': return renderExpenses();
      case 'calendar': return renderCalendar();
      case 'facebook': return renderFacebook();
      case 'google': return renderGoogle();
      case 'tiktok': return renderTikTok();
      case 'livedune': return renderLivedune();
      case 'team': return renderTeam();
      case 'legal': return renderLegal();
      default: return renderOverview();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {renderProjectInfoBlock()}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 overflow-x-auto">
          <nav className="flex min-w-max">
            {tabs.filter(tab => {
              const isAdmin = currentUser.systemRole === 'Admin';
              const isPM = currentUser.jobTitle.toLowerCase().includes('pm') ||
                           currentUser.jobTitle.toLowerCase().includes('project manager');
              const isAccountant = currentUser.jobTitle.toLowerCase().includes('бухгалтер') ||
                                   currentUser.jobTitle.toLowerCase().includes('accountant');

              if (tab.id === 'expenses' || tab.id === 'legal') {
                return isAdmin || isPM || isAccountant;
              }
              return true;
            }).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {renderContent()}
        </div>
      </div>

      <RoadmapTemplateModal
        isOpen={isRoadmapModalOpen}
        onClose={() => setIsRoadmapModalOpen(false)}
        onSelect={handleApplyRoadmap}
        projectName={project.name}
      />

      <RoadmapSetupModal
        isOpen={isRoadmapSetupModalOpen}
        projectId={project.id}
        project={project}
        projectName={project.name}
        onClose={() => setIsRoadmapSetupModalOpen(false)}
        onComplete={handleRoadmapSetupComplete}
      />

      <ProjectDatesModal
        isOpen={isEditingDates}
        onClose={() => setIsEditingDates(false)}
        startDate={project.startDate || ''}
        duration={project.duration || 30}
        onSave={handleSaveDates}
        onRenew={handleRenewProject}
      />

      <ContentModal
        isOpen={isContentModalOpen}
        onClose={() => { setIsContentModalOpen(false); setSelectedContentTask(null); }}
        task={selectedContentTask || {}}
        onSave={handleContentSave}
        users={team}
        currentUserId={currentUser.id}
        projectId={project.id}
      />

      {isShareModalOpen && (
        <ShareProjectModal
          project={project}
          onClose={() => setIsShareModalOpen(false)}
          currentUserId={currentUser.id}
        />
      )}

      {selectedNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Редактировать заметку</h3>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Заголовок</label>
                <input
                  type="text"
                  value={noteFormData.title}
                  onChange={(e) => setNoteFormData({ ...noteFormData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите заголовок заметки"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Содержание</label>
                <textarea
                  value={noteFormData.content}
                  onChange={(e) => setNoteFormData({ ...noteFormData, content: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Введите содержание заметки"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedNote(null)}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (selectedNote) {
                    onUpdateNote({ ...selectedNote, title: noteFormData.title, content: noteFormData.content, updatedAt: new Date().toISOString() });
                    setSelectedNote(null);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {isKpiSuggestionModalOpen && (
        <KpiSuggestionModal
          project={project}
          onClose={() => setIsKpiSuggestionModalOpen(false)}
          onApply={handleApplyKpiSuggestions}
        />
      )}
    </div>
  );
};

export default ProjectDetails;
