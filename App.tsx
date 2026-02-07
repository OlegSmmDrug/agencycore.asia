
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProjectBoard from './components/ProjectBoard';
import ClientBoard from './components/ClientBoard';
import TasksView from './components/TasksView';
import TeamManagement from './components/teammanagement';
import Analytics from './components/Analytics';
import Integrations from './components/Integrations';
import KnowledgeBase from './components/KnowledgeBase';
import DocumentsPage from './components/DocumentsPage';
import DailyJournal from './components/dailyjournal';
import WhatsAppManager from './components/WhatsAppManager';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import AIAgentsModule from './components/AIAgentsModule';
import BriefArchitectModule from './components/brief_architect/app';
import ProfileSettingsPage from './components/ProfileSettingsPage';
import Modal from './components/Modal';
import NewTaskModal from './components/taskmodal';
import ToastContainer from './components/Toast';
import ProjectDetails from './components/ProjectDetails';
import ServiceCalculator from './components/ServiceCalculator';
import ClientModal from './components/ClientModal';
import TemplateManagerPage from './components/TemplateManagerPage';
import TemplateEditorFullModal from './components/TemplateEditorFullModal';
import { GuestAuthProvider } from './components/GuestAuthProvider';
import { GuestProjectView } from './components/GuestProjectView';
import PublicDocumentView from './components/PublicDocumentView';
import LegalPageView from './components/LegalPageView';
import { CLIENT_STATUS_LABELS } from './constants';
import { useOrganization } from './components/OrganizationProvider';
import { User, Client, Project, Task, Role, Notification, ProjectStatus, ClientStatus, TaskStatus, Document, Transaction, PaymentType, Note, Service, PayrollRecord, SalaryScheme } from './types';
import { suggestProjectTasks } from './services/geminiService';
import { clientService } from './services/clientService';
import { userService } from './services/userService';
import { transactionService } from './services/transactionService';
import { projectService } from './services/projectService';
import { taskService } from './services/taskService';
import { documentService } from './services/documentService';
import { noteService } from './services/noteService';
import { serviceService } from './services/serviceService';
import { payrollRecordService } from './services/payrollRecordService';
import { salarySchemeService } from './services/salarySchemeService';
import { jobTitleService } from './services/jobTitleService';
import { activityLogService, ActivityLog } from './services/activityLogService';
import { authService, type AuthUser } from './services/authService';
import { moduleAccessService, ModuleAccess } from './services/moduleAccessService';
import { planLimitsService } from './services/planLimitsService';
import ModuleGate from './components/ModuleGate';
import { sessionMonitorService } from './services/sessionMonitorService';
import { supabase } from './lib/supabase';

// Helper for safe local storage loading with migrations
const loadState = <T,>(key: string, fallback: T, migrationFn?: (data: any) => T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return migrationFn ? migrationFn(parsed) : parsed;
  } catch (e) {
    console.error(`Error loading ${key}:`, e);
    return fallback;
  }
};

const App: React.FC = () => {
  // Auth State
  const [currentAuthUser, setCurrentAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // App State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [salarySchemes, setSalarySchemes] = useState<SalaryScheme[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess[]>([]);

  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization?.id) return;
    const loadModuleAccess = async () => {
      const data = await moduleAccessService.getOrganizationModules(
        organization.id,
        organization.plan_name || 'Free'
      );
      setModuleAccess(data);
    };
    loadModuleAccess();
  }, [organization?.id, organization?.plan_name]);

  const isModuleAvailable = (tabId: string): boolean => {
    if (moduleAccess.length === 0) return true;
    const mod = moduleAccess.find(m => m.module_slug === tabId);
    if (!mod) return true;
    return mod.is_available;
  };

  const getModuleName = (tabId: string): string => {
    const mod = moduleAccess.find(m => m.module_slug === tabId);
    return mod?.module_name || tabId;
  };

  // Check auth session on mount
  useEffect(() => {
    console.log('🔄 Auth effect triggered');

    const checkSession = async () => {
      console.log('🔍 Checking session...');
      setIsCheckingAuth(true);
      const user = await authService.getCurrentUser();
      console.log('👤 Current user:', user?.email || 'none');
      setCurrentAuthUser(user);
      setIsCheckingAuth(false);
    };

    checkSession();

    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      console.log('🔔 Auth state changed:', user?.email || 'none');
      setCurrentAuthUser(user);
    });

    return () => {
      console.log('🧹 Cleaning up auth subscription');
      subscription?.unsubscribe();
    };
  }, []);

  // Load Data from Supabase when user is authenticated
  useEffect(() => {
    console.log('📊 Data loading effect triggered, user:', currentAuthUser?.email || 'none');

    if (!currentAuthUser) {
      console.log('⏭️ No user, skipping data load');
      setIsLoadingData(false);
      return;
    }

    let mounted = true;

    const loadData = async () => {
      try {
        console.log('🔄 Loading data from Supabase...');
        setIsLoadingData(true);
        const [usersData, clientsData, transactionsData, projectsData, tasksData, documentsData, notesData, servicesData, payrollRecordsData, salarySchemesData, jobTitlesData] = await Promise.all([
          userService.getAll(),
          clientService.getAll(),
          transactionService.getAll(),
          projectService.getAll(),
          taskService.getAll(),
          documentService.getAll(),
          noteService.getAll(),
          serviceService.getAll(),
          payrollRecordService.getAll(),
          salarySchemeService.getAll(),
          jobTitleService.getAll()
        ]);

        if (!mounted) {
          console.log('⚠️ Component unmounted, skipping state updates');
          return;
        }

        console.log('✅ Data loaded successfully');

        setUsers(usersData);
        setClients(clientsData);
        setTransactions(transactionsData);
        setProjects(projectsData);
        setTasks(tasksData);
        setDocuments(documentsData);
        setNotes(notesData);
        setServices(servicesData);
        setPayrollRecords(payrollRecordsData);
        setSalarySchemes(salarySchemesData);
        setJobTitles(jobTitlesData);
      } catch (error) {
        console.error('❌ Error loading data:', error);
      } finally {
        if (mounted) {
          setIsLoadingData(false);
        }
      }
    };

    loadData();

    return () => {
      console.log('🧹 Cleaning up data loading effect');
      mounted = false;
    };
  }, [currentAuthUser?.id]);

  useEffect(() => {
    if (!currentAuthUser?.id || currentAuthUser.isSuperAdmin) return;

    sessionMonitorService.start(currentAuthUser.id, (result) => {
      addNotification(
        `Обнаружены одновременные входы с ${result.concurrent_ips} разных IP-адресов. Возможно, аккаунт используется несколькими людьми.`,
        'warning'
      );
    });

    return () => {
      sessionMonitorService.stop();
    };
  }, [currentAuthUser?.id]);

  // Real-time subscription for new clients from Creatium webhook
  useEffect(() => {
    const clientsChannel = supabase
      .channel('clients-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clients'
        },
        (payload: any) => {
          const mapRowToClient = (row: any): Client => ({
            id: row.id,
            name: row.name,
            company: row.company,
            status: row.status as ClientStatus,
            email: row.email || '',
            phone: row.phone || '',
            budget: Number(row.budget) || 0,
            prepayment: Number(row.prepayment) || 0,
            source: row.source as any,
            managerId: row.manager_id,
            description: row.description || '',
            technicalDescription: row.technical_description || '',
            clientBrief: row.client_brief || '',
            filesLink: row.files_link || '',
            service: row.service || '',
            services: row.services || [],
            inn: row.inn || '',
            address: row.address || '',
            legalName: row.legal_name || '',
            director: row.director || '',
            isArchived: row.is_archived || false,
            createdAt: row.created_at,
            statusChangedAt: row.status_changed_at || row.created_at,
            projectLaunched: row.project_launched || false,
            progressLevel: row.progress_level || 0,
            contractNumber: row.contract_number || '',
            contractStatus: row.contract_status || 'draft',
            calculatorData: row.calculator_data || null,
            bankName: row.bank_name || '',
            bankBik: row.bank_bik || '',
            accountNumber: row.account_number || '',
            signatoryBasis: row.signatory_basis || 'Устава',
            contractFileUrl: row.contract_file_url || '',
            contractGeneratedAt: row.contract_generated_at || '',
            leadSourcePage: row.lead_source_page || '',
            leadSourceForm: row.lead_source_form || '',
            leadSourceWebsite: row.lead_source_website || '',
            leadSourceUrl: row.lead_source_url || '',
            utmSource: row.utm_source || '',
            utmMedium: row.utm_medium || '',
            utmCampaign: row.utm_campaign || '',
            utmContent: row.utm_content || '',
            utmTerm: row.utm_term || '',
            ymclidMetrika: row.ymclid_metrika || '',
            yclidDirect: row.yclid_direct || '',
            gclid: row.gclid || '',
            clientIdGoogle: row.client_id_google || '',
            clientIdYandex: row.client_id_yandex || ''
          });

          const newClient = mapRowToClient(payload.new);

          setClients(prev => {
            const exists = prev.find(c => c.id === newClient.id);
            if (exists) return prev;
            return [newClient, ...prev];
          });

          addNotification(`Новый лид: ${newClient.company}`, 'success');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
    };
  }, []);

  // Realtime subscription for tasks
  useEffect(() => {
    if (!currentAuthUser) return;

    const storedUser = localStorage.getItem('currentUser');
    const organizationId = storedUser ? JSON.parse(storedUser).organizationId : null;
    if (!organizationId) return;

    const tasksChannel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload: any) => {
          const mapRowToTask = (row: any): Task => ({
            id: row.id,
            projectId: row.project_id || undefined,
            clientId: row.client_id || undefined,
            assigneeId: row.assignee_id || undefined,
            title: row.title,
            description: row.description || '',
            status: row.status as TaskStatus,
            priority: row.priority || 'Medium',
            deadline: row.deadline || undefined,
            type: (row.type || 'Task') as any,
            tags: row.tags || [],
            estimatedHours: row.estimated_hours ? Number(row.estimated_hours) : undefined,
            durationDays: row.duration_days || undefined,
            createdAt: row.created_at,
            stage_level2_id: row.stage_level2_id || undefined,
            mediaFiles: row.media_files || [],
            startedAt: row.started_at || undefined,
            endTime: row.end_time || undefined
          });

          const newTask = mapRowToTask(payload.new);

          setTasks(prev => {
            const exists = prev.find(t => t.id === newTask.id);
            if (exists) return prev;
            return [newTask, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload: any) => {
          const mapRowToTask = (row: any): Task => ({
            id: row.id,
            projectId: row.project_id || undefined,
            clientId: row.client_id || undefined,
            assigneeId: row.assignee_id || undefined,
            title: row.title,
            description: row.description || '',
            status: row.status as TaskStatus,
            priority: row.priority || 'Medium',
            deadline: row.deadline || undefined,
            type: (row.type || 'Task') as any,
            tags: row.tags || [],
            estimatedHours: row.estimated_hours ? Number(row.estimated_hours) : undefined,
            durationDays: row.duration_days || undefined,
            createdAt: row.created_at,
            stage_level2_id: row.stage_level2_id || undefined,
            mediaFiles: row.media_files || [],
            startedAt: row.started_at || undefined,
            endTime: row.end_time || undefined
          });

          const updatedTask = mapRowToTask(payload.new);

          setTasks(prev =>
            prev.map(t => (t.id === updatedTask.id ? updatedTask : t))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasks',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload: any) => {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, [currentAuthUser]);

  // Selection State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<string>('overview');
  const [projectBoardViewType, setProjectBoardViewType] = useState<'board' | 'list' | 'services'>('board');
  const [projectBoardViewScope, setProjectBoardViewScope] = useState<'all' | 'my' | 'archive'>('my');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'client' | 'project' | 'task' | null>(null);
  const [formData, setFormData] = useState<any>({});
  
  // Specific internal modal states
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
      type: PaymentType.PREPAYMENT,
      date: new Date().toISOString(),
      amount: 0
  });
  const [showCalculator, setShowCalculator] = useState(false);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);

  // ClientModal State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [selectedClientForModal, setSelectedClientForModal] = useState<Client | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Temp State for Navigation
  const [tempClientData, setTempClientData] = useState<Client | null>(null);
  const [isGeneratingTasksFor, setIsGeneratingTasksFor] = useState<string | null>(null);

  // --- Notification Helpers ---
  const addNotification = (message: string, type: 'success' | 'info' | 'warning') => {
    const newNotif: Notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [...prev, newNotif]);
  };
  
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // --- Handlers ---
  const handleLogout = async () => {
      await authService.signOut();
      setCurrentAuthUser(null);
      setActiveTab('dashboard');
      setSelectedProjectId(null);
  };

  const handleResetData = () => {
      if (window.confirm('Вы уверены? Это сбросит все данные к "чистой" версии (без платежей). Ваши изменения будут потеряны.')) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const getDbUserId = () => {
    if (!currentUser) return null;
    const dbUser = users.find(u => u.email === currentUser.email);
    return dbUser?.id || null;
  };

  const handleClientStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    try {
      const client = clients.find(c => c.id === clientId);
      const oldStatus = client?.status;
      const now = new Date().toISOString();

      await clientService.update(clientId, { status: newStatus, statusChangedAt: now });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus, statusChangedAt: now } : c));
      addNotification('Статус клиента обновлен', 'success');

      activityLogService.create({
        userId: getDbUserId(),
        entityType: 'client',
        entityId: clientId,
        actionType: 'status_change',
        description: `Изменен статус: ${CLIENT_STATUS_LABELS[oldStatus || ClientStatus.NEW_LEAD]} → ${CLIENT_STATUS_LABELS[newStatus]}`
      }).catch(err => console.error('Activity log error:', err));
    } catch (error) {
      console.error('Error updating client status:', error);
      addNotification('Ошибка обновления статуса клиента', 'warning');
    }
  };

  const handleArchiveClient = async (clientId: string, archive: boolean) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      await clientService.update(clientId, { isArchived: archive });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, isArchived: archive } : c));
      addNotification(archive ? 'Сделка отправлена в архив' : 'Сделка восстановлена из архива', 'success');

      activityLogService.create({
        userId: getDbUserId(),
        entityType: 'client',
        entityId: clientId,
        actionType: archive ? 'archived' : 'unarchived',
        description: archive ? `Сделка "${client.company}" отправлена в архив` : `Сделка "${client.company}" восстановлена из архива`
      }).catch(err => console.error('Activity log error:', err));
    } catch (error) {
      console.error('Error archiving client:', error);
      addNotification('Ошибка изменения статуса архивации', 'warning');
    }
  };

  const handleProjectStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    try {
      await projectService.update(projectId, { status: newStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
      addNotification('Статус проекта обновлен', 'success');
    } catch (error) {
      console.error('Error updating project status:', error);
      addNotification('Ошибка обновления статуса проекта', 'warning');
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const now = new Date().toISOString();
    const updates: Partial<Task> = {
      status: newStatus,
      completedAt: newStatus === TaskStatus.DONE ? now : undefined
    };
    try {
      await taskService.update(taskId, updates);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      if (newStatus === TaskStatus.DONE) {
        addNotification('Задача выполнена!', 'success');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      addNotification('Ошибка обновления статуса задачи', 'warning');
    }
  };

  const handleTaskStatusToggle = (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
          const newStatus = task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE;
          handleTaskStatusChange(taskId, newStatus);
      }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      if (updates.status === TaskStatus.DONE && !updates.completedAt) {
        updates.completedAt = new Date().toISOString();
      }
      if (updates.status && updates.status !== TaskStatus.DONE) {
        updates.completedAt = undefined;
      }
      await taskService.update(taskId, updates);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      addNotification('Задача обновлена', 'success');
    } catch (error) {
      console.error('Error updating task:', error);
      addNotification('Ошибка обновления задачи', 'warning');
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    try {
      await taskService.update(taskId, { acceptanceStatus: 'Accepted' });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, acceptanceStatus: 'Accepted' } : t));
      addNotification('Задача принята в работу', 'success');
    } catch (error) {
      console.error('Error accepting task:', error);
      addNotification('Ошибка принятия задачи', 'warning');
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      await taskService.update(taskId, { acceptanceStatus: 'Rejected', assigneeId: undefined });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, acceptanceStatus: 'Rejected', assigneeId: undefined } : t));
      addNotification('Вы отказались от задачи. Она возвращена в нераспределенные.', 'warning');
    } catch (error) {
      console.error('Error rejecting task:', error);
      addNotification('Ошибка отклонения задачи', 'warning');
    }
  };

  const handleBatchCreateTasks = async (newTasks: Task[]) => {
    try {
      const createdTasks: Task[] = [];
      for (const task of newTasks) {
        const { id, ...taskData } = task;
        const created = await taskService.create(taskData);
        createdTasks.push(created);
      }
      setTasks(prev => [...createdTasks, ...prev]);
      addNotification(`Создано ${createdTasks.length} задач из шаблона`, 'success');
    } catch (error) {
      console.error('Error batch creating tasks:', error);
      addNotification('Ошибка создания задач', 'warning');
    }
  };

  const handleAddNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> => {
    try {
      const created = await noteService.create(noteData);
      setNotes(prev => [created, ...prev]);
      addNotification('Заметка создана', 'success');
      return created;
    } catch (error) {
      console.error('Error creating note:', error);
      addNotification('Ошибка создания заметки', 'warning');
      throw error;
    }
  };

  const handleUpdateNote = async (note: Note) => {
    try {
      await noteService.update(note.id, note);
      setNotes(prev => prev.map(n => n.id === note.id ? note : n));
    } catch (error) {
      console.error('Error updating note:', error);
      addNotification('Ошибка обновления заметки', 'warning');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await noteService.delete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      addNotification('Заметка удалена', 'success');
    } catch (error) {
      console.error('Error deleting note:', error);
      addNotification('Ошибка удаления заметки', 'warning');
    }
  };

  const handleAddDocument = async (doc: Document) => {
    try {
      const created = await documentService.create(doc);
      setDocuments(prev => [created, ...prev]);
      addNotification('Документ создан', 'success');
    } catch (error) {
      console.error('Error creating document:', error);
      addNotification('Ошибка создания документа', 'warning');
    }
  };

  const handleUpdateDocument = async (doc: Document) => {
    try {
      await documentService.update(doc.id, doc);
      setDocuments(prev => prev.map(d => d.id === doc.id ? doc : d));
    } catch (error) {
      console.error('Error updating document:', error);
      addNotification('Ошибка обновления документа', 'warning');
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await documentService.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      addNotification('Документ удален', 'success');
    } catch (error) {
      console.error('Error deleting document:', error);
      addNotification('Ошибка удаления документа', 'warning');
    }
  };

  const handleGenerateTasks = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingTasksFor(project.id);
    addNotification(`AI: Анализирую проект "${project.name}"...`, 'info');

    try {
      const suggestedTasks = await suggestProjectTasks(project.name, project.description);
      const createdTasks: Task[] = [];

      for (let i = 0; i < suggestedTasks.length; i++) {
        const taskData = {
          projectId: project.id,
          assigneeId: project.teamIds[0] || (users.length > 0 ? users[0].id : undefined),
          title: suggestedTasks[i],
          status: TaskStatus.TODO,
          priority: 'Medium' as const,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          kpiValue: 0,
          type: 'Task' as const,
          acceptanceStatus: 'Pending' as const
        };
        const created = await taskService.create(taskData);
        createdTasks.push(created);
      }

      setTasks(prev => [...createdTasks, ...prev]);
      addNotification(`AI: Создано ${createdTasks.length} задач`, 'success');
    } catch (error) {
      addNotification('Ошибка при генерации задач', 'warning');
    } finally {
      setIsGeneratingTasksFor(null);
    }
  };


  const handleOpenClientModal = async (client: Client | null) => {
    setSelectedClientForModal(client);
    setIsClientModalOpen(true);

    if (client?.id) {
      try {
        const logs = await activityLogService.getByEntity('client', client.id);
        setActivityLogs(logs);
      } catch (error) {
        console.error('Error loading activity logs:', error);
        setActivityLogs([]);
      }
    } else {
      setActivityLogs([]);
    }
  };

  const handleCloseClientModal = () => {
    setIsClientModalOpen(false);
    setSelectedClientForModal(null);
  };

  const handleClientModalSave = async (clientData: Partial<Client>) => {
    try {
      if (!clientData.id) {
        const { id, createdAt, ...createData } = clientData as any;
        const newClient = await clientService.create(createData as Omit<Client, 'id' | 'createdAt'>);
        setClients(prev => [newClient, ...prev]);
        addNotification('Клиент создан', 'success');

        activityLogService.create({
          userId: getDbUserId(),
          entityType: 'client',
          entityId: newClient.id,
          actionType: 'create',
          description: `Создан новый клиент: ${newClient.name} (${newClient.company})`
        }).catch(err => console.error('Activity log error:', err));

        setSelectedClientForModal(newClient);
      } else {
        const updatedClient = await clientService.update(clientData.id, clientData);
        setClients(prev => prev.map(c => c.id === clientData.id ? updatedClient : c));
        addNotification('Клиент обновлен', 'success');

        activityLogService.create({
          userId: getDbUserId(),
          entityType: 'client',
          entityId: clientData.id,
          actionType: 'update',
          description: `Обновлена информация о клиенте`
        }).catch(err => console.error('Activity log error:', err));

        setSelectedClientForModal(updatedClient);

        if (clientData.services) {
          try {
            const clientProjects = projects.filter(p => p.clientId === clientData.id);
            for (const project of clientProjects) {
              const updatedProject = await projectService.update(project.id, {
                services: clientData.services
              });
              setProjects(prev => prev.map(p => p.id === project.id ? updatedProject : p));
            }
          } catch (error) {
            console.error('Error syncing services to projects:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error saving client:', error);
      addNotification('Ошибка сохранения клиента', 'warning');
    }
  };

  const handleAddManualTransaction = async (transactionData: Omit<Transaction, 'id' | 'createdAt' | 'isVerified'>) => {
    if (!transactionData.amount || !transactionData.clientId) return;

    try {
      const fullTransactionData = {
        ...transactionData,
        isVerified: true
      };

      const createdTransaction = await transactionService.create(fullTransactionData);
      setTransactions(prev => [...prev, createdTransaction]);

      const clientTrans = [...transactions, createdTransaction].filter(t => t.clientId === transactionData.clientId);
      const totalPaid = clientTrans.reduce((sum, t) => sum + t.amount, 0);

      await clientService.update(transactionData.clientId, { prepayment: totalPaid });
      setClients(prev => prev.map(c => c.id === transactionData.clientId ? { ...c, prepayment: totalPaid } : c));

      addNotification('Платеж добавлен', 'success');

      activityLogService.create({
        userId: getDbUserId(),
        entityType: 'client',
        entityId: transactionData.clientId,
        actionType: 'payment',
        description: `Добавлен платеж: ${Number(transactionData.amount).toLocaleString('ru-RU')} ₸`
      }).catch(err => console.error('Activity log error:', err));
    } catch (error) {
      console.error('Error adding transaction:', error);
      addNotification('Ошибка добавления платежа', 'warning');
    }
  };

  const handleClientModalAddTransaction = async (transactionData: Partial<Transaction>) => {
    if (!transactionData.amount || !transactionData.clientId) return;

    try {
      const fullTransactionData = {
        clientId: transactionData.clientId,
        projectId: transactionData.projectId || undefined,
        amount: Number(transactionData.amount),
        date: transactionData.date || new Date().toISOString(),
        type: transactionData.type || PaymentType.PREPAYMENT,
        description: transactionData.description || 'Платеж',
        isVerified: true
      };

      const createdTransaction = await transactionService.create(fullTransactionData);
      setTransactions(prev => [...prev, createdTransaction]);

      const clientTrans = [...transactions, createdTransaction].filter(t => t.clientId === transactionData.clientId);
      const totalPaid = clientTrans.reduce((sum, t) => sum + t.amount, 0);

      await clientService.update(transactionData.clientId, { prepayment: totalPaid });
      setClients(prev => prev.map(c => c.id === transactionData.clientId ? { ...c, prepayment: totalPaid } : c));

      addNotification('Платеж добавлен', 'success');

      activityLogService.create({
        userId: getDbUserId(),
        entityType: 'client',
        entityId: transactionData.clientId,
        actionType: 'payment',
        description: `Добавлен платеж: ${Number(transactionData.amount).toLocaleString('ru-RU')} ₸`
      }).catch(err => console.error('Activity log error:', err));
    } catch (error) {
      console.error('Error adding transaction:', error);
      addNotification('Ошибка добавления платежа', 'warning');
    }
  };

  const handleClientModalCreateTask = (clientId: string) => {
    const dbUser = users.find(u => u.email === currentUser?.email);
    handleCloseClientModal();
    setModalType('task');
    setFormData({ clientId, type: 'Task', assigneeId: dbUser?.id });
    setIsModalOpen(true);
  };

  const handleClientModalLaunchProject = async (client: Client) => {
    if (client.projectLaunched) {
      addNotification('Проект уже был создан для этого клиента', 'warning');
      return;
    }

    try {
      const projectData = {
        clientId: client.id,
        name: client.company,
        status: ProjectStatus.KP,
        startDate: new Date().toISOString(),
        endDate: addDays(new Date().toISOString(), 30),
        duration: 30,
        budget: client.budget || 0,
        totalLTV: client.budget || 0,
        mediaBudget: 0,
        description: client.description || '',
        teamIds: users.length > 0 ? [users[0].id] : [],
        services: client.services && client.services.length > 0 ? client.services : (client.service ? [client.service] : [])
      };

      const newProject = await projectService.create(projectData);
      setProjects(prev => [newProject, ...prev]);

      const now = new Date().toISOString();
      await clientService.update(client.id, {
        status: ClientStatus.IN_WORK,
        contractStatus: 'signed',
        projectLaunched: true,
        statusChangedAt: now
      });
      setClients(prev => prev.map(c => c.id === client.id ? {
        ...c,
        status: ClientStatus.IN_WORK,
        contractStatus: 'signed' as const,
        projectLaunched: true,
        statusChangedAt: now
      } : c));

      addNotification(`Проект "${newProject.name}" создан и добавлен в Планирование`, 'success');

      activityLogService.create({
        userId: getDbUserId(),
        entityType: 'client',
        entityId: client.id,
        actionType: 'project_launch',
        description: `Запущен проект: ${newProject.name}`
      }).catch(err => console.error('Activity log error:', err));

      handleCloseClientModal();
    } catch (error) {
      console.error('Error launching project:', error);
      addNotification('Ошибка создания проекта', 'warning');
    }
  };

  const handleCreateService = async (serviceName: string) => {
    try {
      const newService = await serviceService.create({
        name: serviceName,
        isActive: true,
        sortOrder: services.length
      });
      setServices(prev => [...prev, newService]);
      addNotification('Услуга создана', 'success');
    } catch (error) {
      console.error('Error creating service:', error);
      addNotification('Ошибка создания услуги', 'warning');
    }
  };

  const handleAddTransaction = async () => {
      if (!newTransaction.amount) {
          alert('Введите сумму');
          return;
      }

      try {
          const transactionData = {
              clientId: formData.id,
              projectId: formData.projectId,
              amount: Number(newTransaction.amount),
              date: newTransaction.date || new Date().toISOString(),
              type: newTransaction.type || PaymentType.PREPAYMENT,
              description: newTransaction.description || 'Платеж',
              isVerified: true
          };

          const createdTransaction = await transactionService.create(transactionData);
          setTransactions(prev => [...prev, createdTransaction]);

          // Update Client Prepayment Sum
          if (formData.id) {
              const clientTrans = [...transactions, createdTransaction].filter(t => t.clientId === formData.id);
              const totalPaid = clientTrans.reduce((sum, t) => sum + t.amount, 0);

              await clientService.update(formData.id, { prepayment: totalPaid });
              setClients(prev => prev.map(c => c.id === formData.id ? { ...c, prepayment: totalPaid } : c));
              setFormData((prev: any) => ({ ...prev, prepayment: totalPaid }));
          }

          setNewTransaction({
              type: PaymentType.PREPAYMENT,
              amount: 0,
              date: new Date().toISOString()
          });
          addNotification('Платеж успешно добавлен', 'success');
      } catch (error) {
          console.error('Error adding transaction:', error);
          addNotification('Ошибка добавления платежа', 'warning');
      }
  };

  const handleAddTransactionDirect = async (transaction: Transaction) => {
    try {
      const created = await transactionService.create(transaction);
      setTransactions(prev => [...prev, created]);
      addNotification('Платеж добавлен', 'success');
    } catch (error) {
      console.error('Error adding transaction:', error);
      addNotification('Ошибка добавления платежа', 'warning');
    }
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
    try {
      await transactionService.update(transaction.id, transaction);
      setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
      addNotification('Платеж обновлен', 'success');
    } catch (error) {
      console.error('Error updating transaction:', error);
      addNotification('Ошибка обновления платежа', 'warning');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await transactionService.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      addNotification('Платеж удален', 'success');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      addNotification('Ошибка удаления платежа', 'warning');
    }
  };

  const handleModalSave = async (e: React.FormEvent) => {
      e.preventDefault();

      if (modalType === 'client') {
          try {
              const isNew = !clients.find(c => c.id === formData.id);
              if (isNew) {
                  const newClient = await clientService.create(formData);
                  setClients(prev => [newClient, ...prev]);
                  addNotification('Клиент создан', 'success');
              } else {
                  const updatedClient = await clientService.update(formData.id, formData);
                  setClients(prev => prev.map(c => c.id === formData.id ? updatedClient : c));
                  addNotification('Клиент обновлен', 'success');
              }
          } catch (error) {
              console.error('Error saving client:', error);
              addNotification('Ошибка сохранения клиента', 'warning');
              return;
          }
      } else if (modalType === 'project') {
          try {
              const isNew = !projects.find(p => p.id === formData.id);

              if (isNew) {
                  const projectData = {
                      ...formData,
                      teamIds: users.length > 0 ? [users[0].id] : [],
                      mediaBudget: formData.mediaBudget || 0,
                      totalLTV: formData.budget || 0,
                      duration: formData.duration || 30
                  };
                  delete projectData.id;

                  const newProject = await projectService.create(projectData);
                  setProjects(prev => [newProject, ...prev]);
                  addNotification('Проект создан', 'success');

                  if (newProject.clientId) {
                      try {
                          await clientService.update(newProject.clientId, {
                              status: ClientStatus.IN_WORK,
                              services: formData.services || []
                          });
                          setClients(prev => prev.map(c => c.id === newProject.clientId ? {
                              ...c,
                              status: ClientStatus.IN_WORK,
                              services: formData.services || []
                          } : c));
                      } catch (error) {
                          console.error('Error updating client status:', error);
                      }
                  }
              } else {
                  const updatedProject = await projectService.update(formData.id, {
                      ...formData,
                      mediaBudget: formData.mediaBudget || 0
                  });
                  setProjects(prev => prev.map(p => p.id === formData.id ? updatedProject : p));
                  addNotification('Проект обновлен', 'success');

                  if (formData.clientId && formData.services) {
                      try {
                          await clientService.update(formData.clientId, {
                              services: formData.services
                          });
                          setClients(prev => prev.map(c => c.id === formData.clientId ? {
                              ...c,
                              services: formData.services
                          } : c));
                      } catch (error) {
                          console.error('Error syncing services to client:', error);
                      }
                  }
              }
          } catch (error) {
              console.error('Error saving project:', error);
              addNotification('Ошибка сохранения проекта', 'warning');
              return;
          }
      } 
      
      if (modalType !== 'task') {
          setIsModalOpen(false);
          setFormData({});
          setModalType(null);
      }
  };

  const handleTaskSave = async (taskData: Partial<Task>) => {
    const isNew = !taskData.id;
    const finalTaskData = {
      ...taskData,
      assigneeId: taskData.assigneeId === '' ? undefined : taskData.assigneeId,
    };

    if (!finalTaskData.acceptanceStatus) {
      const dbUser = users.find(u => u.email === currentUser?.email);
      if (finalTaskData.assigneeId === dbUser?.id) finalTaskData.acceptanceStatus = 'Accepted';
      else finalTaskData.acceptanceStatus = 'Pending';
    }

    try {
      if (isNew) {
        const dbUser = users.find(u => u.email === currentUser?.email);
        const taskToCreate = {
          ...finalTaskData,
          status: TaskStatus.TODO,
          type: finalTaskData.type || 'Task',
          creatorId: dbUser?.id
        };
        delete (taskToCreate as any).id;

        const newTask = await taskService.create(taskToCreate as Omit<Task, 'id'>);
        setTasks(prev => [newTask, ...prev]);
        addNotification('Задача создана', 'success');
      } else {
        const updatedTask = await taskService.update(taskData.id!, finalTaskData);
        setTasks(prev => prev.map(t => t.id === taskData.id ? updatedTask : t));
        addNotification('Задача обновлена', 'success');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      addNotification('Ошибка сохранения задачи', 'warning');
    }

    if (tempClientData) {
      setModalType('client');
      setFormData(tempClientData);
      setTempClientData(null);
    } else {
      setIsModalOpen(false);
      setFormData({});
      setModalType(null);
    }
  };

  // Helper to add days
  const addDays = (dateStr: string, days: number) => {
      if (!dateStr) return '';
      const result = new Date(dateStr);
      result.setDate(result.getDate() + days);
      return result.toISOString().split('T')[0];
  }

  // --- Legal Pages Route Handling ---
  const legalPageMatch = window.location.pathname.match(/^\/legal\/([a-zA-Z0-9_-]+)/);
  if (legalPageMatch) {
    return <LegalPageView slug={legalPageMatch[1]} />;
  }

  // --- Public Knowledge Base Document Route Handling ---
  const publicDocMatch = window.location.pathname.match(/^\/knowledge\/([a-zA-Z0-9_-]+)/);
  if (publicDocMatch) {
    const documentId = publicDocMatch[1];
    return <PublicDocumentView documentId={documentId} />;
  }

  // --- Guest Route Handling ---
  const guestTokenMatch = window.location.pathname.match(/^\/guest\/project\/([a-zA-Z0-9%]+)/);
  if (guestTokenMatch) {
    const token = decodeURIComponent(guestTokenMatch[1]);
    return (
      <GuestAuthProvider token={token}>
        <GuestProjectView />
      </GuestAuthProvider>
    );
  }

  // --- Rendering ---
  if (isCheckingAuth || (currentAuthUser && isLoadingData)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-slate-600 font-medium">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!currentAuthUser) {
    if (authMode === 'register') {
      return (
        <RegisterPage
          onRegister={(user) => {
            setCurrentAuthUser(user);
            setAuthMode('login');
          }}
          onSwitchToLogin={() => setAuthMode('login')}
        />
      );
    }
    return (
      <LoginPage
        onLogin={(user) => setCurrentAuthUser(user)}
        onSwitchToRegister={() => setAuthMode('register')}
      />
    );
  }

  // Super Admin Dashboard
  if (currentAuthUser.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  const currentUser = users.find(u => u.id === currentAuthUser.id);
  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 font-medium">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const alwaysAvailableTabs = ['dashboard', 'settings'];
    if (!alwaysAvailableTabs.includes(activeTab) && !isModuleAvailable(activeTab)) {
      return (
        <ModuleGate
          moduleSlug={activeTab}
          moduleName={getModuleName(activeTab)}
          isAvailable={false}
          currentPlan={organization?.plan_name || 'Free'}
          onNavigateToBilling={() => setActiveTab('settings')}
        >
          <div />
        </ModuleGate>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
            <Dashboard
                clients={clients}
                projects={projects}
                tasks={tasks}
                transactions={transactions}
                users={users}
                currentUser={currentUser}
                onTaskClick={(t) => {
                    setModalType('task');
                    setFormData(t);
                    setIsModalOpen(true);
                }}
                onAddTransaction={handleAddTransactionDirect}
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
            />
        );
      case 'analytics':
        return (
          <Analytics
            clients={clients}
            users={users}
            tasks={tasks}
            projects={projects}
            transactions={transactions}
            currentUser={currentUser}
            onAddTransaction={handleAddManualTransaction}
          />
        );
      case 'calculator':
        return <ServiceCalculator />;
      case 'notes':
        return (
          <DailyJournal
            notes={notes}
            projects={projects}
            currentUser={currentUser}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onBatchCreateTasks={handleBatchCreateTasks}
          />
        );
      case 'crm':
        return (
          <ClientBoard
            clients={clients}
            users={users}
            currentUser={users.find(u => u.email === currentUser.email)}
            transactions={transactions}
            onClientStatusChange={handleClientStatusChange}
            onClientClick={(client) => handleOpenClientModal(client)}
            onAddClient={() => handleOpenClientModal(null)}
            onAddTransaction={() => {
                setNewTransaction({
                    type: PaymentType.PREPAYMENT,
                    date: new Date().toISOString().split('T')[0],
                    amount: 0,
                    clientId: '',
                    description: ''
                });
                setIsAddPaymentModalOpen(true);
            }}
            onArchiveClient={handleArchiveClient}
            onUpdateTransaction={async (transactionId, amount) => {
                try {
                    await transactionService.update(transactionId, { amount });
                    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, amount } : t));
                    addNotification('Сумма платежа обновлена', 'success');
                } catch (error) {
                    console.error('Error updating transaction:', error);
                    addNotification('Ошибка обновления платежа', 'warning');
                }
            }}
            onDeleteTransaction={async (transactionId) => {
                try {
                    await transactionService.delete(transactionId);
                    setTransactions(prev => prev.filter(t => t.id !== transactionId));
                    addNotification('Платеж удален', 'success');
                } catch (error) {
                    console.error('Error deleting transaction:', error);
                    addNotification('Ошибка удаления платежа', 'warning');
                }
            }}
          />
        );
      case 'projects':
        if (selectedProjectId) {
            const project = projects.find(p => p.id === selectedProjectId);
            if (!project) return <div>Проект не найден</div>;
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const client = clients.find(c => c.id === project.clientId);
            const team = users.filter(u => project.teamIds.includes(u.id));
            return (
                <ProjectDetails
                    project={project}
                    client={client}
                    tasks={projectTasks}
                    team={team}
                    notes={notes}
                    currentUser={currentUser}
                    initialTab={projectDetailTab}
                    onTabChange={setProjectDetailTab}
                    onBack={() => setSelectedProjectId(null)}
                    onAddTask={(initialData) => {
                        setModalType('task');
                        setFormData({
                            projectId: project.id,
                            type: 'Task',
                            ...initialData
                        });
                        setIsModalOpen(true);
                    }}
                    onTaskClick={(task) => {
                        setModalType('task');
                        setFormData(task);
                        setIsModalOpen(true);
                    }}
                    onToggleTaskStatus={handleTaskStatusToggle}
                    onUpdateTask={handleUpdateTask}
                    onUpdateProject={async (updated) => {
                        try {
                            const savedProject = await projectService.update(updated.id, updated);
                            const updatedList = projects.map(p => p.id === savedProject.id ? savedProject : p);
                            setProjects(updatedList);
                        } catch (error) {
                            console.error('Error updating project:', error);
                            const updatedList = projects.map(p => p.id === updated.id ? updated : p);
                            setProjects(updatedList);
                        }
                    }}
                    onProjectChangedLocal={(updatedProject) => {
                        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
                    }}
                    onUpdateClient={async (clientId, updates) => {
                        try {
                            const updatedClient = await clientService.update(clientId, updates);
                            setClients(prev => prev.map(c => c.id === clientId ? updatedClient : c));
                            addNotification('Данные клиента обновлены', 'success');
                        } catch (error) {
                            console.error('Error updating client:', error);
                            addNotification('Ошибка обновления данных клиента', 'warning');
                        }
                    }}
                    onBatchCreateTasks={handleBatchCreateTasks}
                    onCreateTask={async (taskData) => {
                        const created = await taskService.create(taskData);
                        setTasks(prev => [created, ...prev]);
                        return created;
                    }}
                    onAddNote={handleAddNote}
                    onUpdateNote={handleUpdateNote}
                    onDeleteNote={handleDeleteNote}
                />
            );
        }
        return (
          <ProjectBoard
            projects={projects}
            clients={clients}
            tasks={tasks}
            users={users}
            currentUserId={users.find(u => u.email === currentUser.email)?.id}
            currentUser={users.find(u => u.email === currentUser.email)}
            initialViewType={projectBoardViewType}
            onViewTypeChange={setProjectBoardViewType}
            initialViewScope={projectBoardViewScope}
            onViewScopeChange={setProjectBoardViewScope}
            onProjectStatusChange={handleProjectStatusChange}
            onGenerateTasks={handleGenerateTasks}
            onProjectClick={(p) => {
                if (p.id !== selectedProjectId) {
                  setProjectDetailTab('overview');
                }
                setSelectedProjectId(p.id);
            }}
            onEditProject={(p, e) => {
                e.stopPropagation();
                setModalType('project');
                setFormData({ ...p, duration: p.duration || 30 });
                setIsModalOpen(true);
            }}
            onAddProject={async () => {
                const planName = organization?.plan_name || 'Free';
                const check = await planLimitsService.checkProjectsLimit(planName);
                if (!check.allowed) {
                    addNotification(
                      `Лимит проектов исчерпан (${check.current}/${check.limit}). Перейдите на более высокий тариф.`,
                      'warning'
                    );
                    return;
                }
                const dbUser = users.find(u => u.email === currentUser.email);
                setModalType('project');
                setFormData({
                    status: ProjectStatus.KP,
                    budget: 0,
                    duration: 30,
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: addDays(new Date().toISOString().split('T')[0], 30),
                    teamIds: dbUser ? [dbUser.id] : [],
                    services: []
                });
                setIsModalOpen(true);
            }}
            onArchiveProject={async (projectId, e) => {
                e.stopPropagation();
                try {
                    await projectService.update(projectId, { isArchived: true, status: ProjectStatus.ARCHIVED });
                    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, isArchived: true, status: ProjectStatus.ARCHIVED } : p));
                    addNotification('Проект архивирован', 'success');
                } catch (error) {
                    console.error('Error archiving project:', error);
                    addNotification('Ошибка архивирования проекта', 'warning');
                }
            }}
            onRestoreProject={async (projectId, e) => {
                e.stopPropagation();
                try {
                    await projectService.update(projectId, { isArchived: false, status: ProjectStatus.IN_WORK });
                    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, isArchived: false, status: ProjectStatus.IN_WORK } : p));
                    addNotification('Проект восстановлен', 'success');
                } catch (error) {
                    console.error('Error restoring project:', error);
                    addNotification('Ошибка восстановления проекта', 'warning');
                }
            }}
            isGeneratingTasksFor={isGeneratingTasksFor}
          />
        );
      case 'tasks':
        const nonContentTasks = tasks.filter(t => !['Post', 'Reels', 'Stories'].includes(t.type));
        return (
            <TasksView
                tasks={nonContentTasks}
                projects={projects}
                users={users}
                clients={clients}
                currentUser={currentUser}
                onTaskStatusChange={handleTaskStatusChange}
                onTaskClick={(t) => {
                    setModalType('task');
                    setFormData(t);
                    setIsModalOpen(true);
                }}
                onAddTask={(initialData) => {
                    const dbUser = users.find(u => u.email === currentUser.email);
                    setModalType('task');
                    setFormData({ type: 'Task', assigneeId: dbUser?.id, ...initialData });
                    setIsModalOpen(true);
                }}
                onAcceptTask={handleAcceptTask}
                onRejectTask={handleRejectTask}
            />
        );
      case 'team':
        return (
            <TeamManagement
                users={users}
                tasks={tasks}
                projects={projects}
                currentUser={currentUser}
                availableJobTitles={jobTitles}
                payrollRecords={payrollRecords}
                salarySchemes={salarySchemes}
                onUpdateUser={async (updated: User) => {
                    try {
                        if (updated.id && !updated.id.startsWith('temp_')) {
                            const savedUser = await userService.update(updated);
                            setUsers(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));
                            addNotification('Сотрудник обновлен', 'success');
                        } else {
                            const newUser = await userService.create(updated);
                            setUsers(prev => [...prev, newUser]);
                            addNotification('Сотрудник добавлен', 'success');
                        }
                    } catch (error) {
                        console.error('Error saving user:', error);
                        addNotification('Ошибка сохранения сотрудника', 'warning');
                    }
                }}
                onDeleteUser={async (userId: string) => {
                    try {
                        await userService.delete(userId);
                        setUsers(prev => prev.filter(u => u.id !== userId));

                        const updatedTasks = await taskService.getAll();
                        setTasks(updatedTasks);

                        const updatedClients = await clientService.getAll();
                        setClients(updatedClients);

                        addNotification('Сотрудник и все связанные данные удалены', 'success');
                    } catch (error: any) {
                        console.error('Error deleting user:', error);
                        addNotification('Ошибка удаления сотрудника', 'warning');
                    }
                }}
                onAddJobTitle={async (title: string) => {
                    try {
                        const newTitle = await jobTitleService.create(title);
                        setJobTitles(prev => [...prev, newTitle].sort());
                        addNotification('Должность добавлена', 'success');
                    } catch (error) {
                        console.error('Error adding job title:', error);
                        addNotification('Ошибка добавления должности', 'warning');
                    }
                }}
                onUpdatePayrollRecord={async (record: PayrollRecord) => {
                    try {
                        let savedRecord: PayrollRecord;

                        if (record.id.startsWith('pr_')) {
                            const existingRecord = await payrollRecordService.findByUserAndMonth(record.userId, record.month);

                            if (existingRecord) {
                                savedRecord = await payrollRecordService.update(existingRecord.id, record);
                            } else {
                                const { id, ...recordWithoutId } = record;
                                savedRecord = await payrollRecordService.create(recordWithoutId);
                            }
                        } else {
                            savedRecord = await payrollRecordService.upsert(record);
                        }

                        setPayrollRecords(prev => {
                            const exists = prev.find(r =>
                                (r.id === savedRecord.id) ||
                                (r.userId === savedRecord.userId && r.month === savedRecord.month)
                            );
                            if (exists) {
                                return prev.map(r =>
                                    (r.id === savedRecord.id || (r.userId === savedRecord.userId && r.month === savedRecord.month))
                                    ? savedRecord
                                    : r
                                );
                            } else {
                                return [...prev, savedRecord];
                            }
                        });
                        addNotification('Ведомость обновлена', 'success');
                    } catch (error) {
                        console.error('Error updating payroll record:', error);
                        addNotification('Ошибка обновления ведомости', 'warning');
                    }
                }}
                onPayPayroll={async (record: PayrollRecord) => {
                    try {
                        let recordToPay = record;

                        if (record.id.startsWith('pr_')) {
                            const existingRecord = await payrollRecordService.findByUserAndMonth(record.userId, record.month);
                            if (!existingRecord) {
                                addNotification('Сначала закрепите ведомость', 'warning');
                                return;
                            }
                            recordToPay = existingRecord;
                        }

                        const paidRecord = await payrollRecordService.update(recordToPay.id, {
                            status: 'PAID',
                            paidAt: new Date().toISOString()
                        });

                        const user = users.find(u => u.id === record.userId);
                        if (user) {
                            const totalPaid = (record.fixSalary || 0) + (record.calculatedKpi || 0) + (record.manualBonus || 0) - (record.manualPenalty || 0) - (record.advance || 0);
                            const newBalance = (user.balance || 0) + totalPaid;
                            await userService.update({ ...user, balance: newBalance });
                            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, balance: newBalance } : u));
                        }

                        setPayrollRecords(prev => prev.map(r =>
                            (r.id === paidRecord.id || (r.userId === paidRecord.userId && r.month === paidRecord.month))
                            ? paidRecord
                            : r
                        ));
                        addNotification('Зарплата выплачена', 'success');
                    } catch (error) {
                        console.error('Error paying payroll:', error);
                        addNotification('Ошибка выплаты зарплаты', 'warning');
                    }
                }}
                onUpdateSalaryScheme={async (scheme: SalaryScheme) => {
                    try {
                        const savedScheme = await salarySchemeService.upsert(scheme);
                        setSalarySchemes(prev => {
                            const exists = prev.find(s => s.id === savedScheme.id);
                            if (exists) {
                                return prev.map(s => s.id === savedScheme.id ? savedScheme : s);
                            } else {
                                return [...prev, savedScheme];
                            }
                        });
                        addNotification('Схема зарплаты сохранена', 'success');
                    } catch (error) {
                        console.error('Error updating salary scheme:', error);
                        addNotification('Ошибка сохранения схемы', 'warning');
                    }
                }}
            />
        );
      case 'knowledge':
        return (
          <KnowledgeBase
            documents={documents}
            users={users}
            currentUser={currentUser}
            onUpdateDocument={handleUpdateDocument}
            onAddDocument={handleAddDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        );
      case 'documents':
        return <DocumentsPage />;
      case 'integrations':
        return <Integrations />;
      case 'whatsapp':
        return <WhatsAppManager currentUser={currentUser!} users={users} />;
      case 'ai-agents':
        return <AIAgentsModule onNavigateToIntegrations={() => setActiveTab('integrations')} />;
      case 'brief-architect':
        return <BriefArchitectModule clients={clients} currentUserId={users.find(u => u.email === currentUser.email)?.id} />;
      case 'settings':
        return (
          <ProfileSettingsPage
            user={users.find(u => u.email === currentUser.email)!}
            onUpdate={(updatedUser) => {
              setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
            }}
          />
        );
      default:
        return (
          <Dashboard
            clients={clients}
            projects={projects}
            tasks={tasks}
            transactions={transactions}
            users={users}
            currentUser={currentUser}
            onAddTransaction={handleAddTransactionDirect}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
        <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
                setActiveTab(tab);
            }}
            currentUser={currentUser}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onLogout={handleLogout}
            onReset={handleResetData}
            onUpdateUser={(updatedUser) => {
                setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
            }}
        />
        
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative">
             <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-lg active:bg-slate-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                        <span className="text-white text-xs font-bold">A</span>
                    </div>
                    <span className="font-bold text-slate-800">AgencyCore</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden">
                    <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
                </div>
             </div>

             <div className="flex-1 overflow-auto relative">
                {renderContent()}
             </div>
        </div>

        <ToastContainer notifications={notifications} removeNotification={removeNotification} />

        <NewTaskModal
            isOpen={isModalOpen && modalType === 'task'}
            onClose={() => {
                if (tempClientData) {
                    setModalType('client');
                    setFormData(tempClientData);
                    setTempClientData(null);
                } else {
                    setIsModalOpen(false);
                    setFormData({});
                    setModalType(null);
                }
            }}
            onSave={handleTaskSave}
            initialTask={formData}
            projects={projects}
            users={users}
            clients={clients}
            currentUser={currentUser}
            allTasks={tasks}
        />

        {modalType !== 'task' && modalType !== 'client' && (
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setFormData({});
                    setModalType(null);
                }}
                title={modalType === 'project' ? (formData.id ? 'Редактировать проект' : 'Новый проект') : ''}
                size="md"
            >
                <form onSubmit={handleModalSave} className="space-y-6 relative">
                    {/* Embedded Calculator Overlay */}
                    {showCalculator && (
                        <div className="absolute inset-0 z-20 bg-white rounded-lg animate-fade-in flex flex-col border border-slate-200 shadow-lg">
                            <ServiceCalculator 
                                onSelect={(result) => {
                                    setFormData({...formData, budget: result.total, description: (formData.description || '') + '\n' + result.description });
                                    setShowCalculator(false);
                                }} 
                                onClose={() => setShowCalculator(false)} 
                            />
                        </div>
                    )}

                    {modalType === 'project' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Название проекта</label>
                                <input required type="text" className="w-full border rounded p-2 text-sm" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Клиент</label>
                                <select
                                    required
                                    className="w-full border rounded p-2 text-sm"
                                    value={formData.clientId || ''}
                                    onChange={e => {
                                        const selectedClient = clients.find(c => c.id === e.target.value);
                                        setFormData({
                                            ...formData,
                                            clientId: e.target.value,
                                            services: selectedClient?.services || []
                                        });
                                    }}
                                >
                                    <option value="">Выберите клиента...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Услуги</label>
                                {formData.clientId ? (
                                    <>
                                        <div className="flex gap-2 mb-2">
                                            <select
                                                className="flex-1 border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white"
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
                                        </div>
                                        {formData.services && formData.services.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {formData.services.map((service: string, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 border-2 border-blue-300 rounded-lg px-3 py-1.5 text-xs font-medium"
                                                    >
                                                        <span>{service}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newServices = formData.services?.filter((_: string, i: number) => i !== idx);
                                                                setFormData({ ...formData, services: newServices });
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic">
                                                Выберите услуги из списка выше
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-sm text-slate-500">
                                        Выберите клиента, чтобы добавить услуги
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Описание</label>
                                <textarea className="w-full border rounded p-2 text-sm" rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">URL картинки проекта</label>
                                <input
                                    type="url"
                                    placeholder="https://images.pexels.com/..."
                                    className="w-full border rounded p-2 text-sm"
                                    value={formData.imageUrl || ''}
                                    onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                                />
                                {formData.imageUrl && (
                                    <img src={formData.imageUrl} alt="Preview" className="mt-2 w-full h-32 object-cover rounded" />
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Общий Бюджет (Cycle)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm font-bold" value={formData.budget || 0} onChange={e => setFormData({...formData, budget: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Медиабюджет (Реклама)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={formData.mediaBudget || 0} onChange={e => setFormData({...formData, mediaBudget: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Дата начала</label>
                                    <input 
                                        type="date" 
                                        className="w-full border rounded p-2 text-sm" 
                                        value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''} 
                                        onChange={e => {
                                            const newStart = e.target.value;
                                            const duration = formData.duration || 30;
                                            setFormData({
                                                ...formData, 
                                                startDate: newStart,
                                                endDate: addDays(newStart, duration) 
                                            });
                                        }} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Срок договора (дней)</label>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded p-2 text-sm" 
                                        value={formData.duration || 30} 
                                        onChange={e => {
                                            const dur = Number(e.target.value);
                                            setFormData({
                                                ...formData, 
                                                duration: dur,
                                                endDate: formData.startDate ? addDays(formData.startDate, dur) : ''
                                            });
                                        }} 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Статус</label>
                                <select className="w-full border rounded p-2 text-sm" value={formData.status || ProjectStatus.KP} onChange={e => setFormData({...formData, status: e.target.value})}>
                                    {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
                        <button type="button" onClick={() => { setIsModalOpen(false); setFormData({}); setModalType(null); }} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">Отмена</button>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-md shadow-blue-200">Сохранить</button>
                    </div>
                </form>
            </Modal>
        )}

        <ClientModal
          isOpen={isClientModalOpen}
          client={selectedClientForModal}
          users={users}
          tasks={tasks}
          transactions={transactions}
          services={services}
          currentUserId={getDbUserId() || undefined}
          activityLog={activityLogs}
          onClose={handleCloseClientModal}
          onSave={handleClientModalSave}
          onAddTransaction={handleClientModalAddTransaction}
          onTaskStatusToggle={handleTaskStatusToggle}
          onCreateTask={handleClientModalCreateTask}
          onLaunchProject={handleClientModalLaunchProject}
          onServiceCreate={handleCreateService}
          onArchiveClient={handleArchiveClient}
        />

        {isAddPaymentModalOpen && (
          <Modal isOpen={isAddPaymentModalOpen} onClose={() => setIsAddPaymentModalOpen(false)} title="Добавить платеж">
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newTransaction.clientId || !newTransaction.amount) {
                addNotification('Заполните обязательные поля', 'warning');
                return;
              }
              await handleAddManualTransaction({
                clientId: newTransaction.clientId!,
                amount: Number(newTransaction.amount),
                date: newTransaction.date || new Date().toISOString(),
                type: newTransaction.type || PaymentType.PREPAYMENT,
                description: newTransaction.description || '',
                category: 'Income'
              });
              setIsAddPaymentModalOpen(false);
              addNotification('Платеж добавлен', 'success');
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Клиент *</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                    value={newTransaction.clientId || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, clientId: e.target.value })}
                    required
                  >
                    <option value="">Выберите клиента</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.company} - {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Сумма *</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                    value={newTransaction.amount || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Дата</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                    value={newTransaction.date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Тип платежа</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                    value={newTransaction.type || PaymentType.PREPAYMENT}
                    onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value as PaymentType })}
                  >
                    <option value={PaymentType.PREPAYMENT}>Предоплата</option>
                    <option value={PaymentType.FULL}>Полная оплата</option>
                    <option value={PaymentType.POSTPAYMENT}>Постоплата</option>
                    <option value={PaymentType.RETAINER}>Ретейнер (Абонплата)</option>
                    <option value={PaymentType.REFUND}>Возврат</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Описание</label>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                    rows={2}
                    value={newTransaction.description || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    placeholder="Комментарий к платежу..."
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-100 gap-3 mt-4">
                <button type="button" onClick={() => setIsAddPaymentModalOpen(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">Отмена</button>
                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-md shadow-emerald-200">Добавить</button>
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
};

export default App;
