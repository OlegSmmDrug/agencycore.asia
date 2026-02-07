import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, CheckCircle, XCircle, Clock, User, Mail, Phone, FileText, Map,
  BarChart2, TrendingUp, Loader2, ExternalLink, CreditCard, Target,
  CheckCircle2, ListChecks, AlertTriangle, Send, ChevronRight
} from 'lucide-react';
import { useGuestAuth } from './GuestAuthProvider';
import { GuestApprovalModal } from './GuestApprovalModal';
import { taskService } from '../services/taskService';
import { noteService } from '../services/noteService';
import { roadmapService, RoadmapStageLevel1, RoadmapStageLevel2 } from '../services/roadmapService';
import { GuestTaskView, TaskStatus, ProjectStatus, Note, Task, MediaFile } from '../types';
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
    if (project) loadData();
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
    } catch (error) {
      console.error('Error registering:', error);
    }
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
      <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-12 max-w-md">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Ссылка недействительна</h1>
          <p className="text-sm text-slate-500">Эта ссылка на проект была отключена или не существует.</p>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const daysUntilEnd = project.endDate
    ? Math.ceil((new Date(project.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const renderOverview = () => {
    const isTechnicalDescription = project.description?.includes('Страница:') ||
                                   project.description?.includes('--- Все поля ---') ||
                                   project.description?.includes('form_type:');

    const scopeOfWork = project.scopeOfWork && project.scopeOfWork.length > 0
      ? project.scopeOfWork
      : null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {project.imageUrl ? (
              <div className="relative h-56 md:h-64 rounded-xl overflow-hidden border border-slate-200">
                <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent flex items-end">
                  <div className="p-6 md:p-8">
                    <span className="bg-blue-600 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                      {project.status === ProjectStatus.COMPLETED ? 'Завершен' : 'Проект активен'}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mt-2 mb-1">{project.name}</h2>
                    {project.description && !isTechnicalDescription && (
                      <p className="text-slate-200 max-w-2xl text-sm leading-relaxed font-medium opacity-90 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <span className="bg-blue-600 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                  {project.status === ProjectStatus.COMPLETED ? 'Завершен' : 'Проект активен'}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-2">{project.name}</h2>
                {project.description && !isTechnicalDescription && (
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed">{project.description}</p>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 grid grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Общий бюджет', value: `${project.budget.toLocaleString()} ₸`, icon: CreditCard, color: 'text-blue-600' },
                { label: 'Медиа бюджет', value: `${(project.mediaBudget || 0).toLocaleString()} ₸`, icon: Target, color: 'text-teal-600' },
                { label: 'Дата старта', value: project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU') : '-', icon: Calendar, color: 'text-slate-600' },
                { label: 'Дедлайн', value: project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : '-', icon: CheckCircle2, color: 'text-emerald-600' },
              ].map((stat, i) => (
                <div key={i} className="p-4 md:p-5 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <stat.icon className={`w-3.5 h-3.5 ${stat.color} opacity-80`} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                  </div>
                  <p className="text-base md:text-lg font-extrabold text-slate-900 leading-none">{stat.value}</p>
                </div>
              ))}
            </div>

            {scopeOfWork && (
              <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-blue-600" />
                  Объем работ по проекту
                </h3>
                <div className="grid grid-cols-1 gap-1">
                  {scopeOfWork.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between py-3 px-4 rounded-lg transition-colors ${idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}
                    >
                      <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                      <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md min-w-[50px] text-center">
                        {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {project.kpis && project.kpis.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                  <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                  Показатели эффективности (KPI)
                </h3>
                <div className="grid grid-cols-1 gap-5">
                  {project.kpis.map((kpi) => {
                    const progress = kpi.plan > 0 ? (kpi.fact / kpi.plan) * 100 : 0;
                    return (
                      <div key={kpi.id}>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-bold text-slate-700">{kpi.name}</p>
                          <p className="text-[10px] font-bold text-blue-600">{progress.toFixed(0)}%</p>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1.5">
                          Текущий результат: {kpi.fact} / {kpi.plan} {kpi.unit}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-5">
            {guestAccess?.managerName && (
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Менеджер проекта</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {getInitials(guestAccess.managerName)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{guestAccess.managerName}</p>
                    <p className="text-xs text-slate-500">Аккаунт-менеджер</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {(guestAccess?.managerEmail || COMPANY_INFO.email) && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a href={`mailto:${guestAccess?.managerEmail || COMPANY_INFO.email}`} className="text-xs text-slate-600 hover:text-blue-600 transition-colors truncate">
                        {guestAccess?.managerEmail || COMPANY_INFO.email}
                      </a>
                    </div>
                  )}
                  {(guestAccess?.managerPhone || COMPANY_INFO.phone) && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a href={`tel:${guestAccess?.managerPhone || COMPANY_INFO.phone}`} className="text-xs text-slate-600 hover:text-blue-600 transition-colors">
                        {guestAccess?.managerPhone || COMPANY_INFO.phone}
                      </a>
                    </div>
                  )}
                </div>
                {(guestAccess?.managerPhone || COMPANY_INFO.phone) && (
                  <a
                    href={`https://t.me/${(guestAccess?.managerPhone || COMPANY_INFO.phone).replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Написать в Telegram
                  </a>
                )}
              </div>
            )}

            {project.services && project.services.length > 0 && (
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  Список услуг
                </h3>
                <div className="flex flex-wrap gap-2">
                  {project.services.map((service, i) => (
                    <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 uppercase tracking-tight">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {project.quickLinksData && project.quickLinksData.length > 0 && (
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-teal-500 rounded-full" />
                  Полезные ссылки
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {project.quickLinksData.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-white transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${link.color || 'bg-slate-400'}`} />
                        <span className="text-xs font-bold text-slate-700">{link.name}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRoadmap = () => {
    const groupedByLevel1 = level1Stages.reduce((acc, level1) => {
      const level2ForThis = roadmapStages.filter(s => s.level1_stage_id === level1.id);
      if (level2ForThis.length > 0) acc.push({ level1, level2Stages: level2ForThis });
      return acc;
    }, [] as Array<{ level1: RoadmapStageLevel1; level2Stages: RoadmapStageLevel2[] }>);

    if (groupedByLevel1.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Map className="w-14 h-14 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">Дорожная карта не настроена</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Дорожная карта проекта</h2>
          <p className="text-sm text-slate-500">Отслеживайте прогресс выполнения ключевых этапов</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groupedByLevel1.map(({ level1, level2Stages }) => (
            level2Stages.map(stage => {
              const stageTasks = allTasks.filter(t => t.stage_level2_id === stage.id);
              const completedTasks = stageTasks.filter(t => t.status === TaskStatus.DONE).length;
              const progress = stageTasks.length > 0 ? (completedTasks / stageTasks.length) * 100 : 0;
              const isCompleted = progress === 100;

              return (
                <div key={stage.id} className={`rounded-xl border flex flex-col min-h-[320px] max-h-[480px] transition-all ${
                  isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
                }`}>
                  <div className={`p-4 border-b flex-shrink-0 ${isCompleted ? 'border-green-200' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                        {level1.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCompleted ? 'bg-green-200 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {completedTasks}/{stageTasks.length}
                      </span>
                    </div>
                    <h4 className={`font-bold text-sm mb-3 ${isCompleted ? 'text-green-900' : 'text-slate-900'}`}>
                      {stage.name}
                    </h4>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[9px] text-right mt-1.5 font-bold text-slate-400">{progress.toFixed(0)}%</p>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
                    {stageTasks.length === 0 ? (
                      <div className="text-center py-6 text-slate-300 text-xs">Задачи не назначены</div>
                    ) : (
                      stageTasks.map(task => (
                        <div key={task.id} className="bg-white p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              task.status === TaskStatus.DONE ? 'bg-green-600 border-green-600' : 'border-slate-300 bg-white'
                            }`}>
                              {task.status === TaskStatus.DONE && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {task.title}
                              </p>
                              {task.deadline && (
                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5" />
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
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Заметки по проекту</h2>
        <p className="text-sm text-slate-500">Важная информация и обновления</p>
      </div>
      {notes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FileText className="w-14 h-14 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">Заметок пока нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">{note.title}</h3>
                <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 bg-slate-50 rounded-full flex-shrink-0 ml-4">
                  {new Date(note.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-slate-500 text-sm whitespace-pre-wrap leading-relaxed line-clamp-3">{note.content}</p>
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
        id: task.id, title: task.title, description: task.description,
        status: task.status, deadline: task.deadline, type: task.type,
        mediaUrls: task.mediaUrls, mediaFiles: task.mediaFiles,
        postText: task.postText, proofLink: task.proofLink,
        clientComment: task.clientComment, rejectedCount: task.rejectedCount,
        creatorId: task.assigneeId, createdAt: task.createdAt
      };
      setSelectedTask(convertedTask);
    }
  };

  const renderCalendar = () => {
    if (isLoading) {
      return (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-10 h-10 text-blue-600 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-slate-400">Загрузка контента...</p>
        </div>
      );
    }
    if (contentTasks.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Calendar className="w-14 h-14 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">Контента для отображения нет</p>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Контент-календарь</h2>
          <p className="text-sm text-slate-500">Проверьте и одобрите контент перед публикацией</p>
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

  const renderAnalyticsTab = () => {
    switch (activeTab) {
      case 'facebook':
        return project.facebookAccessToken && project.adAccountId ? (
          <AdsAnalytics projectId={project.id} accessToken={project.facebookAccessToken} adAccountId={project.adAccountId} readOnly={true} />
        ) : <AnalyticsEmpty label="Facebook Ads" />;
      case 'google':
        return project.googleAdsAccessToken && project.googleAdsCustomerId ? (
          <GoogleAdsAnalytics projectId={project.id} accessToken={project.googleAdsAccessToken} customerId={project.googleAdsCustomerId} readOnly={true} />
        ) : <AnalyticsEmpty label="Google Ads" />;
      case 'tiktok':
        return project.tiktokAdsAccessToken && project.tiktokAdsAdvertiserId ? (
          <TikTokAdsAnalytics projectId={project.id} accessToken={project.tiktokAdsAccessToken} advertiserId={project.tiktokAdsAdvertiserId} readOnly={true} />
        ) : <AnalyticsEmpty label="TikTok Ads" />;
      case 'livedune':
        return project.liveduneAccessToken && project.liveduneAccountId ? (
          <SmmAnalytics accessToken={project.liveduneAccessToken} projectAccountId={project.liveduneAccountId} />
        ) : <AnalyticsEmpty label="Instagram" />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'roadmap': return renderRoadmap();
      case 'notes': return renderNotes();
      case 'calendar': return renderCalendar();
      default: return renderAnalyticsTab();
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900">{COMPANY_INFO.short_name}</h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{project.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <button
                  onClick={() => { setActiveTab('calendar'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                  На проверке: {pendingCount}
                </button>
              )}
              {guestUser ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                    {getInitials(guestUser.name)}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 hidden sm:block">{guestUser.name}</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-semibold"
                >
                  Гостевой доступ
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {showRegisterForm && !guestUser && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Регистрация для уведомлений</h2>
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Имя</label>
                  <input
                    type="text" value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Email</label>
                  <input
                    type="email" value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Телефон</label>
                  <input
                    type="tel" value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-xs">
                  Зарегистрироваться
                </button>
                <button type="button" onClick={() => setShowRegisterForm(false)} className="px-5 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-xs">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {!guestUser && pendingCount > 0 && !showRegisterForm && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900 mb-0.5">Требуется одобрение контента</p>
              <p className="text-xs text-amber-700 mb-2">
                {pendingCount} материал(ов) ожидают проверки. Зарегистрируйтесь для одобрения контента.
              </p>
              <button onClick={() => setShowRegisterForm(true)} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold text-xs">
                Зарегистрироваться
              </button>
            </div>
          </div>
        )}

        {daysUntilEnd !== null && daysUntilEnd <= 7 && daysUntilEnd > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-900">Приближается дата завершения этапа</p>
              <p className="text-xs text-yellow-700">
                До завершения текущего периода осталось {daysUntilEnd} дн. Пожалуйста, проверьте и утвердите задачи.
              </p>
            </div>
          </div>
        )}

        <nav className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100">
            <div className="flex overflow-x-auto">
              {tabs.filter(tab => tab.show).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5">
            {isLoading && activeTab !== 'calendar' ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : (
              renderContent()
            )}
          </div>
        </nav>
      </div>

      {selectedTask && (
        <GuestApprovalModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          guestId={guestUser?.id || 'anonymous'}
          canApprove={canApprove}
          onRegisterRequest={() => { setSelectedTask(null); setShowRegisterForm(true); }}
        />
      )}

      {selectedNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-200 flex justify-between items-start sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedNote.title}</h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                  {new Date(selectedNote.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setSelectedNote(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{selectedNote.content}</p>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedNote(null)}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-semibold text-sm"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerMedia && (
        <MediaViewer media={viewerMedia.media} initialIndex={viewerMedia.index} onClose={() => setViewerMedia(null)} />
      )}
    </div>
  );
};

const AnalyticsEmpty: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
    <BarChart2 className="w-14 h-14 text-slate-200 mx-auto mb-3" />
    <p className="text-sm text-slate-400 font-medium">{label} не настроен</p>
  </div>
);
