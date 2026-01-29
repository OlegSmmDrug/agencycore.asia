import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, User, Mail, Phone, FileText, Map, BarChart2, TrendingUp, Loader2, Image as ImageIcon } from 'lucide-react';
import { useGuestAuth } from './GuestAuthProvider';
import { GuestApprovalModal } from './GuestApprovalModal';
import { taskService } from '../services/taskService';
import { noteService } from '../services/noteService';
import { roadmapService, RoadmapStageLevel1, RoadmapStageLevel2 } from '../services/roadmapService';
import { GuestTaskView, TaskStatus, Note, Task, MediaFile } from '../types';
import { COMPANY_INFO } from '../config/companyInfo';
import SmmAnalytics from './SmmAnalytics';
import AdsAnalytics from './AdsAnalytics';
import MediaViewer from './MediaViewer';
import MediaGallery from './MediaGallery';
import ContentCalendar from './contentcalendar';
import GoogleAdsAnalytics from './GoogleAdsAnalytics';
import TikTokAdsAnalytics from './TikTokAdsAnalytics';

type TabType = 'overview' | 'roadmap' | 'notes' | 'calendar' | 'facebook' | 'google' | 'tiktok' | 'livedune';

export const GuestProjectView: React.FC = () => {
  const { project, guestUser, guestAccess, canApprove, registerGuest } = useGuestAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tasks, setTasks] = useState<GuestTaskView[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [roadmapStages, setRoadmapStages] = useState<RoadmapStageLevel2[]>([]);
  const [level1Stages, setLevel1Stages] = useState<RoadmapStageLevel1[]>([]);
  const [selectedTask, setSelectedTask] = useState<GuestTaskView | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '' });
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [viewerMedia, setViewerMedia] = useState<{ media: MediaFile[]; index: number } | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month'>('month');

  useEffect(() => {
    if (project) {
      loadData();
    }
  }, [project]);

  const loadData = async () => {
    if (!project) return;

    try {
      setIsLoading(true);
      const [projectTasks, projectNotes, allProjectTasks, stages, level1] = await Promise.all([
        taskService.getTasksByProjectForGuest(project.id),
        noteService.getByProject(project.id),
        taskService.getTasksByProject(project.id),
        roadmapService.getLevel2StagesByProject(project.id),
        roadmapService.getLevel1Stages()
      ]);
      setTasks(projectTasks);
      setNotes(projectNotes);
      setAllTasks(allProjectTasks);
      setRoadmapStages(stages);
      setLevel1Stages(level1);

      console.log('Guest data loaded:', {
        contentTasks: projectTasks.length,
        allTasks: allProjectTasks.length,
        notes: projectNotes.length,
        roadmapStages: stages.length,
        taskStatuses: projectTasks.map(t => t.status)
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (taskId: string, comment?: string) => {
    const guestId = guestUser?.id || 'anonymous';
    await taskService.updateApprovalStatus(taskId, TaskStatus.APPROVED, guestId, true, comment);
    await loadData();
  };

  const handleReject = async (taskId: string, comment: string) => {
    const guestId = guestUser?.id || 'anonymous';
    await taskService.updateApprovalStatus(taskId, TaskStatus.REJECTED, guestId, true, comment);
    await loadData();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerGuest(registerForm.name, registerForm.email, registerForm.phone);
      setShowRegisterForm(false);
      alert('✅ Регистрация успешна! Теперь вы можете одобрять контент и получать уведомления.');
    } catch (error) {
      console.error('Error registering:', error);
      alert('❌ Ошибка регистрации. Попробуйте снова.');
    }
  };

  const getFilteredTasks = () => {
    switch (filter) {
      case 'pending':
        return tasks.filter(t => t.status === TaskStatus.PENDING_CLIENT);
      case 'approved':
        return tasks.filter(t => t.status === TaskStatus.APPROVED);
      case 'rejected':
        return tasks.filter(t => t.status === TaskStatus.REJECTED);
      default:
        return tasks;
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.APPROVED:
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case TaskStatus.REJECTED:
        return <XCircle className="w-5 h-5 text-rose-600" />;
      case TaskStatus.PENDING_CLIENT:
        return <Clock className="w-5 h-5 text-amber-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING_CLIENT:
        return 'bg-amber-50 border-amber-300';
      case TaskStatus.APPROVED:
        return 'bg-green-50 border-green-300';
      case TaskStatus.REJECTED:
        return 'bg-red-50 border-red-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  const pendingCount = tasks.filter(t => t.status === TaskStatus.PENDING_CLIENT).length;

  const hasPermission = (permission: string) => {
    return guestAccess?.permissions.includes(permission as any) ?? true;
  };

  const tabs = useMemo(() => [
    { id: 'overview' as TabType, label: 'Обзор', icon: FileText, show: hasPermission('viewOverview') },
    { id: 'roadmap' as TabType, label: 'Дорожная карта', icon: Map, show: hasPermission('viewRoadmap') },
    { id: 'notes' as TabType, label: 'Заметки', icon: FileText, show: hasPermission('viewNotes') },
    { id: 'calendar' as TabType, label: 'Контент-календарь', icon: Calendar, show: hasPermission('viewCalendar') },
    { id: 'facebook' as TabType, label: 'Facebook Ads', icon: BarChart2, show: hasPermission('viewFacebook') && !!(project?.facebookAccessToken && project?.adAccountId) },
    { id: 'google' as TabType, label: 'Google Ads', icon: BarChart2, show: hasPermission('viewGoogle') && !!(project?.googleAdsAccessToken && project?.googleAdsCustomerId) },
    { id: 'tiktok' as TabType, label: 'TikTok Ads', icon: BarChart2, show: hasPermission('viewTikTok') && !!(project?.tiktokAdsAccessToken && project?.tiktokAdsAdvertiserId) },
    { id: 'livedune' as TabType, label: 'Instagram', icon: TrendingUp, show: hasPermission('viewLivedune') && !!(project?.liveduneAccessToken && project?.liveduneAccountId) }
  ], [guestAccess, project]);

  useEffect(() => {
    const visibleTabs = tabs.filter(t => t.show);
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [tabs, activeTab]);

  if (!project) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Неверная ссылка</h1>
          <p className="text-gray-600">Ссылка на проект недействительна или была отключена.</p>
        </div>
      </div>
    );
  }

  const renderOverview = () => {
    const isTechnicalDescription = project.description?.includes('Страница:') ||
                                   project.description?.includes('--- Все поля ---') ||
                                   project.description?.includes('form_type:');

    return (
    <div className="space-y-4">
      {project.imageUrl ? (
        <div className="relative h-48 rounded-xl overflow-hidden shadow-lg">
          <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">{project.name}</h2>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-4 shadow border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
        </div>
      )}

      {project.description && !isTechnicalDescription && (
        <div className="bg-white rounded-lg p-4 shadow border border-gray-100">
          <p className="text-gray-700 text-sm leading-relaxed">{project.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <p className="text-xs uppercase font-bold mb-1 text-slate-500">Бюджет</p>
          <p className="text-xl font-bold text-slate-800">{project.budget.toLocaleString()} ₸</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <p className="text-xs uppercase font-bold mb-1 text-slate-500">Медиа-бюджет</p>
          <p className="text-xl font-bold text-slate-800">{(project.mediaBudget || 0).toLocaleString()} ₸</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <p className="text-xs uppercase font-bold mb-1 text-slate-500">Начало</p>
          <p className="text-lg font-bold text-slate-800">
            {project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '-'}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <p className="text-xs uppercase font-bold mb-1 text-slate-500">Окончание</p>
          <p className="text-lg font-bold text-slate-800">
            {project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '-'}
          </p>
        </div>
      </div>

      {project.services && project.services.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Услуги</h3>
          <div className="flex flex-wrap gap-2">
            {project.services.map((service, idx) => (
              <span key={idx} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-full font-semibold">
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {project.kpis && project.kpis.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">KPI показатели</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.kpis.map((kpi) => {
              const progress = Math.min((kpi.fact / kpi.plan) * 100, 100);
              const isComplete = progress >= 100;
              return (
                <div key={kpi.id} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">{kpi.name}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900">{kpi.fact}</span>
                    <span className="text-sm text-gray-500">/ {kpi.plan} {kpi.unit || ''}</span>
                  </div>
                  <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isComplete ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right font-semibold">{progress.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {project.quickLinksData && project.quickLinksData.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Быстрые ссылки</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {project.quickLinksData.map((link) => {
              const getInitials = (name: string) => {
                const words = name.trim().split(/\s+/);
                if (words.length >= 2) {
                  return (words[0][0] + words[1][0]).toUpperCase();
                }
                return name.substring(0, 2).toUpperCase();
              };

              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100 rounded-lg transition-all duration-300 border border-gray-200 hover:border-blue-300 hover:shadow-md group"
                >
                  <div className={`w-8 h-8 ${link.color || 'bg-slate-500'} rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                    {getInitials(link.name)}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{link.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
    );
  };

  const renderRoadmap = () => {
    const groupedByLevel1 = level1Stages.reduce((acc, level1) => {
      const level2ForThis = roadmapStages.filter(s => s.level1_stage_id === level1.id);
      if (level2ForThis.length > 0) {
        acc.push({ level1, level2Stages: level2ForThis });
      }
      return acc;
    }, [] as Array<{ level1: RoadmapStageLevel1; level2Stages: RoadmapStageLevel2[] }>);

    if (groupedByLevel1.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-100">
          <Map className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Дорожная карта не настроена</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Дорожная карта проекта</h2>
          <p className="text-gray-600 text-lg">Отслеживайте прогресс выполнения ключевых этапов</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {groupedByLevel1.map(({ level1, level2Stages }) => (
            level2Stages.map(stage => {
              const stageTasks = allTasks.filter(t => t.stage_level2_id === stage.id);
              const completedTasks = stageTasks.filter(t => t.status === TaskStatus.DONE).length;
              const progress = stageTasks.length > 0 ? (completedTasks / stageTasks.length) * 100 : 0;
              const isCompleted = progress === 100;

              return (
                <div key={stage.id} className={`rounded-lg border-2 flex flex-col min-h-[350px] max-h-[500px] transition-all ${
                  isCompleted ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
                }`}>
                  <div className={`p-4 md:p-6 border-b-2 rounded-t-2xl flex-shrink-0 ${isCompleted ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-emerald-700' : 'text-gray-500'}`}>
                        {level1.name}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        isCompleted ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {completedTasks}/{stageTasks.length}
                      </span>
                    </div>
                    <h4 className={`font-bold text-lg mb-4 ${isCompleted ? 'text-emerald-900' : 'text-gray-900'}`}>
                      {stage.name}
                    </h4>
                    <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isCompleted ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-right mt-2 font-semibold text-gray-600">{progress.toFixed(0)}%</p>
                  </div>

                  <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-2 md:space-y-3 min-h-0">
                    {stageTasks.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        Задачи не назначены
                      </div>
                    ) : (
                      stageTasks.map(task => (
                        <div key={task.id} className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                task.status === TaskStatus.DONE
                                  ? 'bg-green-600 border-green-600'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {task.status === TaskStatus.DONE && (
                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${
                                task.status === TaskStatus.DONE ? 'line-through text-gray-400' : 'text-gray-900'
                              }`}>
                                {task.title}
                              </p>
                              {task.deadline && (
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </div>
    );
  };

  const renderNotes = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Заметки по проекту</h2>
        <p className="text-gray-600 text-lg">Важная информация и обновления</p>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-100">
          <FileText className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Заметок пока нет</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-xl text-gray-900">{note.title}</h3>
                <span className="text-xs text-gray-500 font-semibold px-3 py-1 bg-gray-100 rounded-full">
                  {new Date(note.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-gray-700 text-base whitespace-pre-wrap leading-relaxed line-clamp-3">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const contentTypes = ['Post', 'Reels', 'Stories'];
  const contentTasks = allTasks.filter(t => contentTypes.includes(t.type));

  const handleContentTaskClick = (task: Task) => {
    const guestTask = tasks.find(gt => gt.id === task.id);
    if (guestTask) {
      setSelectedTask(guestTask);
    } else {
      const convertedTask: GuestTaskView = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        deadline: task.deadline,
        type: task.type,
        mediaUrls: task.mediaUrls,
        mediaFiles: task.mediaFiles,
        postText: task.postText,
        proofLink: task.proofLink,
        clientComment: task.clientComment,
        rejectedCount: task.rejectedCount,
        creatorId: task.assigneeId,
        createdAt: task.createdAt
      };
      setSelectedTask(convertedTask);
    }
  };

  const renderCalendar = () => {
    if (isLoading) {
      return (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
          <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500 text-lg">Загрузка контента...</p>
        </div>
      );
    }

    if (contentTasks.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-100">
          <Calendar className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Контента для отображения нет</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Контент-календарь</h2>
          <p className="text-gray-600 text-lg">Проверьте и одобрите контент перед публикацией</p>
        </div>
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <ContentCalendar
            tasks={contentTasks}
            onTaskClick={handleContentTaskClick}
            onTaskMove={() => {}}
            viewMode={calendarViewMode}
            onViewModeChange={setCalendarViewMode}
          />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'roadmap':
        return renderRoadmap();
      case 'notes':
        return renderNotes();
      case 'calendar':
        return renderCalendar();
      case 'facebook':
        return project.facebookAccessToken && project.adAccountId ? (
          <AdsAnalytics
            projectId={project.id}
            accessToken={project.facebookAccessToken}
            adAccountId={project.adAccountId}
            readOnly={true}
          />
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <BarChart2 className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Facebook Ads не настроен</p>
          </div>
        );
      case 'google':
        return project.googleAdsAccessToken && project.googleAdsCustomerId ? (
          <GoogleAdsAnalytics
            projectId={project.id}
            accessToken={project.googleAdsAccessToken}
            customerId={project.googleAdsCustomerId}
            readOnly={true}
          />
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <BarChart2 className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Google Ads не настроен</p>
          </div>
        );
      case 'tiktok':
        return project.tiktokAdsAccessToken && project.tiktokAdsAdvertiserId ? (
          <TikTokAdsAnalytics
            projectId={project.id}
            accessToken={project.tiktokAdsAccessToken}
            advertiserId={project.tiktokAdsAdvertiserId}
            readOnly={true}
          />
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <BarChart2 className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">TikTok Ads не настроен</p>
          </div>
        );
      case 'livedune':
        return project.liveduneAccessToken && project.liveduneAccountId ? (
          <SmmAnalytics
            accessToken={project.liveduneAccessToken}
            projectAccountId={project.liveduneAccountId}
          />
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <TrendingUp className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Instagram аналитика не настроена</p>
          </div>
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {COMPANY_INFO.short_name}
              </h1>
              <p className="text-xs text-gray-600 mt-0.5 font-medium">{project.name}</p>
            </div>
            {!guestUser && !showRegisterForm && (
              <button
                onClick={() => setShowRegisterForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-bold"
              >
                Получать уведомления
              </button>
            )}
            {guestUser && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <User className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">{guestUser.name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {showRegisterForm && !guestUser && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="bg-white rounded-lg p-4 shadow border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Регистрация для уведомлений</h2>
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Имя</label>
                <input
                  type="text"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-sm"
                  placeholder="Введите ваше имя"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-sm"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Телефон (необязательно)</label>
                <input
                  type="tel"
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-sm"
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm"
                >
                  Зарегистрироваться
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-bold text-sm"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {!guestUser && tasks.filter(t => t.status === TaskStatus.PENDING_CLIENT).length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-amber-500 rounded-full p-2 flex-shrink-0">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900 mb-1">Требуется одобрение контента</h3>
                <p className="text-xs text-amber-800 mb-2">
                  У вас есть {tasks.filter(t => t.status === TaskStatus.PENDING_CLIENT).length} контентных материалов, ожидающих вашего одобрения.
                  Зарегистрируйтесь для получения уведомлений и возможности одобрять контент.
                </p>
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all font-bold text-xs"
                >
                  Зарегистрироваться сейчас
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg shadow border border-gray-200 mb-4 overflow-hidden">
          <div className="border-b border-gray-200 bg-slate-50">
            <nav className="flex overflow-x-auto">
              {tabs.filter(tab => tab.show).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all duration-300 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 overflow-x-hidden">
            {renderContent()}
          </div>
        </div>

        <footer className="bg-white rounded-lg shadow border border-gray-200 p-4 mt-4">
          <h3 className="font-bold text-base text-gray-900 mb-3">Связаться с менеджером</h3>
          {guestAccess?.managerName && (
            <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-gray-900">{guestAccess.managerName}</span>
              </div>
            </div>
          )}
          <div className="space-y-2 text-sm text-gray-700">
            {(guestAccess?.managerEmail || COMPANY_INFO.email) && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Mail className="w-4 h-4 text-blue-600" />
                <a
                  href={`mailto:${guestAccess?.managerEmail || COMPANY_INFO.email}`}
                  className="hover:text-blue-700 font-semibold transition-colors"
                >
                  {guestAccess?.managerEmail || COMPANY_INFO.email}
                </a>
              </div>
            )}
            {(guestAccess?.managerPhone || COMPANY_INFO.phone) && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <Phone className="w-4 h-4 text-green-600" />
                <a
                  href={`tel:${guestAccess?.managerPhone || COMPANY_INFO.phone}`}
                  className="hover:text-green-700 font-semibold transition-colors"
                >
                  {guestAccess?.managerPhone || COMPANY_INFO.phone}
                </a>
              </div>
            )}
          </div>
        </footer>
      </div>

      {selectedTask && (
        <GuestApprovalModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          guestId={guestUser?.id || 'anonymous'}
          canApprove={canApprove}
          onRegisterRequest={() => {
            setSelectedTask(null);
            setShowRegisterForm(true);
          }}
        />
      )}

      {selectedNote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8 border-b-2 border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h3 className="text-3xl font-bold text-gray-900">{selectedNote.title}</h3>
                <p className="text-sm text-gray-500 mt-2 font-semibold">
                  {new Date(selectedNote.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all p-3 rounded-xl"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8">
              <p className="text-gray-800 text-lg whitespace-pre-wrap leading-relaxed">{selectedNote.content}</p>
            </div>
            <div className="p-8 border-t-2 border-gray-200 bg-gray-50 flex justify-end rounded-b-3xl">
              <button
                onClick={() => setSelectedNote(null)}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg hover:shadow-xl hover:scale-105"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerMedia && (
        <MediaViewer
          media={viewerMedia.media}
          initialIndex={viewerMedia.index}
          onClose={() => setViewerMedia(null)}
        />
      )}
    </div>
  );
};
