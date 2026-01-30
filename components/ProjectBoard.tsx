
import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, Play } from 'lucide-react';
import { Project, ProjectStatus, Client, Task, User, TaskStatus, Level1StageStatus, SystemRole } from '../types';
import { DEFAULT_SERVICES } from '../constants';
import { level1StageService } from '../services/level1StageService';
import { roadmapService, RoadmapStageLevel1 } from '../services/roadmapService';

interface ProjectBoardProps {
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  users: User[];
  currentUserId?: string;
  currentUser?: User;
  onProjectStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
  onGenerateTasks: (project: Project, e: React.MouseEvent) => void;
  onProjectClick: (project: Project) => void;
  onEditProject: (project: Project, e: React.MouseEvent) => void;
  onAddProject: () => void;
  onArchiveProject?: (projectId: string, e: React.MouseEvent) => void;
  onRestoreProject?: (projectId: string, e: React.MouseEvent) => void;
  isGeneratingTasksFor: string | null;
}

const ProjectBoard: React.FC<ProjectBoardProps> = ({
  projects,
  clients,
  tasks,
  users,
  currentUserId,
  currentUser,
  onProjectStatusChange,
  onGenerateTasks,
  onProjectClick,
  onEditProject,
  onAddProject,
  onArchiveProject,
  onRestoreProject,
  isGeneratingTasksFor
}) => {
  const [viewType, setViewType] = useState<'board' | 'list' | 'services'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | 'all'>('all');
  const [viewScope, setViewScope] = useState<'all' | 'my' | 'archive'>('all');
  const [projectStageStatuses, setProjectStageStatuses] = useState<Record<string, Level1StageStatus[]>>({});
  const [level1Stages, setLevel1Stages] = useState<RoadmapStageLevel1[]>([]);

  useEffect(() => {
    const loadStagesAndStatuses = async () => {
      try {
        const stages = await roadmapService.getLevel1Stages();
        setLevel1Stages(stages);

        const statusesMap: Record<string, Level1StageStatus[]> = {};
        await Promise.all(
          projects.map(async (project) => {
            try {
              const statuses = await level1StageService.getProjectStageStatus(project.id);
              statusesMap[project.id] = statuses;
            } catch (error) {
              console.error(`Error loading statuses for project ${project.id}:`, error);
              statusesMap[project.id] = [];
            }
          })
        );
        setProjectStageStatuses(statusesMap);
      } catch (error) {
        console.error('Error loading stages:', error);
      }
    };

    if (projects.length > 0) {
      loadStagesAndStatuses();
    }
  }, [projects]);

  const filteredProjects = projects.filter(project => {
      if (viewScope === 'archive') {
        // В режиме архива показываем только архивные проекты
        if (!project.isArchived) return false;
      } else {
        // В остальных режимах показываем только неархивные проекты
        if (project.isArchived) return false;
      }

      if (viewScope === 'my' && !(currentUserId && project.teamIds && Array.isArray(project.teamIds) && project.teamIds.includes(currentUserId))) return false;

      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient = selectedClientId === 'all' || project.clientId === selectedClientId;
      const matchesStatus = selectedStatus === 'all' || project.status === selectedStatus;
      const matchesService = selectedService === 'all' || (project.services && project.services.includes(selectedService));

      return matchesSearch && matchesClient && matchesStatus && matchesService;
  });

  const statusConfig: Record<ProjectStatus, { label: string, color: string, bg: string, border: string }> = {
    [ProjectStatus.KP]: { label: 'Стратегия/КП', color: 'text-sky-700', bg: 'bg-sky-100', border: 'border-sky-200' },
    [ProjectStatus.PRODUCTION]: { label: 'Продакшн', color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' },
    [ProjectStatus.ADS_START]: { label: 'Запуск рекламы', color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200' },
    [ProjectStatus.IN_WORK]: { label: 'В работе', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200' },
    [ProjectStatus.APPROVAL]: { label: 'Согласование', color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200' },
    [ProjectStatus.COMPLETED]: { label: 'Завершен', color: 'text-teal-700', bg: 'bg-teal-100', border: 'border-teal-200' },
    [ProjectStatus.ARCHIVED]: { label: 'Архив', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100' }
  };

  const getStatusConfig = (status: ProjectStatus) => {
    return statusConfig[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' };
  };

  const boardColumns = level1Stages.map((stage) => ({
    id: stage.id,
    title: stage.name,
    icon: stage.icon,
    color: `border-t-4`,
    stageColor: stage.color,
    statuses: [] as ProjectStatus[]
  }));

  const handleDragStart = (e: React.DragEvent, projectId: string) => e.dataTransfer.setData('projectId', projectId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, targetStatusGroup: ProjectStatus[]) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    if (projectId && targetStatusGroup.length > 0) {
        onProjectStatusChange(projectId, targetStatusGroup[0]);
    }
  };

  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'}) : '-';

  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return { completed: 0, total: 0, percent: 0 };
    const completed = projectTasks.filter(t => t.status === TaskStatus.DONE).length;
    return { completed, total: projectTasks.length, percent: Math.round((completed / projectTasks.length) * 100) };
  };

  const getProjectLevel1Stage = (projectId: string) => {
    const statuses = projectStageStatuses[projectId] || [];
    if (statuses.length === 0) return null;

    const activeStatus = statuses.find(s => s.status === 'active');
    const completedCount = statuses.filter(s => s.status === 'completed').length;

    if (activeStatus) {
      const stage = level1Stages.find(s => s.id === activeStatus.level1StageId);
      return {
        stage,
        status: 'active' as const,
        statusIcon: Play,
        statusColor: 'text-green-500'
      };
    } else if (completedCount === statuses.length) {
      const lastStage = level1Stages[level1Stages.length - 1];
      return {
        stage: lastStage,
        status: 'completed' as const,
        statusIcon: CheckCircle2,
        statusColor: 'text-green-600'
      };
    }

    return null;
  };

  const getProjectRoadmapStage = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return null;

    const stageTasks: Record<number, { total: number; completed: number }> = {};

    projectTasks.forEach(task => {
      const stageTag = task.tags?.find(tag => tag.startsWith('Stage-'));
      if (stageTag) {
        const stageNum = parseInt(stageTag.replace('Stage-', ''));
        if (!stageTasks[stageNum]) {
          stageTasks[stageNum] = { total: 0, completed: 0 };
        }
        stageTasks[stageNum].total++;
        if (task.status === TaskStatus.DONE) {
          stageTasks[stageNum].completed++;
        }
      }
    });

    const stageNumbers = Object.keys(stageTasks).map(Number).sort((a, b) => a - b);
    if (stageNumbers.length === 0) return null;

    for (const stageNum of stageNumbers) {
      const stage = stageTasks[stageNum];
      if (stage.completed < stage.total) {
        return { stage: stageNum, total: stageNumbers.length, completed: stage.completed, stageTotal: stage.total };
      }
    }

    const lastStage = stageNumbers[stageNumbers.length - 1];
    return { stage: lastStage, total: stageNumbers.length, completed: stageTasks[lastStage].completed, stageTotal: stageTasks[lastStage].total };
  };

  const getProjectTeam = (teamIds: string[]) => {
    return users.filter(u => teamIds.includes(u.id));
  };

  const getOverdueInfo = (endDate: string, status: ProjectStatus) => {
    if (status === ProjectStatus.COMPLETED || status === ProjectStatus.ARCHIVED) return null;
    const end = new Date(endDate);
    const now = new Date();
    if (end >= now) return null;
    const diffTime = Math.abs(now.getTime() - end.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderBoardView = () => {
    const getColumnProjects = (colId: string) => {
      const firstStageId = level1Stages[0]?.id;

      return filteredProjects.filter(p => {
        const statuses = projectStageStatuses[p.id] || [];

        if (statuses.length === 0) {
          return colId === firstStageId;
        }

        const activeStatus = statuses.find(s => s.status === 'active');
        if (activeStatus) {
          return activeStatus.level1StageId === colId;
        }

        const completedCount = statuses.filter(s => s.status === 'completed').length;
        if (completedCount === statuses.length && statuses.length > 0) {
          const lastStageId = level1Stages[level1Stages.length - 1]?.id;
          return colId === lastStageId;
        }

        return false;
      });
    };

    return (
    <div className="flex flex-nowrap gap-6 flex-1 pb-6 overflow-x-auto overflow-y-hidden snap-x snap-mandatory h-full">
        {boardColumns.map((col) => {
            const columnProjects = getColumnProjects(col.id);
            return (
                <div
                    key={col.id}
                    className="flex-shrink-0 w-[85vw] md:w-[350px] lg:w-[380px] flex flex-col h-full rounded-2xl bg-slate-50/50 border border-slate-200/60 overflow-hidden snap-center"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.statuses || [])}
                >
                    <div
                      className={`p-4 bg-white border-b border-slate-100 sticky top-0 z-10 ${col.color} shadow-sm`}
                      style={{ borderTopColor: col.stageColor }}
                    >
                        <h3 className="font-bold text-slate-800 flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2">
                              {col.icon && <span>{col.icon}</span>}
                              {col.title}
                            </span>
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold border border-slate-200">
                                {columnProjects.length}
                            </span>
                        </h3>
                    </div>
                    <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                        {columnProjects.map(project => {
                            const client = clients.find(c => c.id === project.clientId);
                            const config = getStatusConfig(project.status);
                            const progress = getProjectProgress(project.id);
                            const roadmapStage = getProjectRoadmapStage(project.id);
                            const level1Stage = getProjectLevel1Stage(project.id);
                            const team = getProjectTeam(project.teamIds);
                            const overdueDays = getOverdueInfo(project.endDate, project.status);

                            return (
                                <div
                                    key={project.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, project.id)}
                                    onClick={() => onProjectClick(project)}
                                    className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group relative cursor-pointer overflow-hidden ${
                                        overdueDays ? 'border-2 border-red-300' : 'border border-slate-200'
                                    }`}
                                >
                                    <div className="p-4">
                                      <div className="flex items-start gap-3 mb-3">
                                        {project.imageUrl && (
                                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                            <img
                                              src={project.imageUrl}
                                              alt={project.name}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-bold text-slate-800 text-sm mb-1 leading-snug group-hover:text-blue-600 transition-colors truncate">
                                            {project.name}
                                          </h4>
                                          {client && (
                                            <p className="text-xs text-slate-500 truncate" title={client.name}>
                                              {client.name}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                          <button
                                            onClick={(e) => onEditProject(project, e)}
                                            className="text-slate-300 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                                          >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                          </button>
                                        </div>
                                      </div>

                                      {progress.total > 0 && (
                                        <div className="mb-3">
                                          <div className="flex items-center justify-between text-[10px] mb-1">
                                            <span className="text-slate-400">Прогресс</span>
                                            <span className="font-bold text-slate-600">{progress.completed}/{progress.total}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all duration-300 ${
                                                progress.percent === 100 ? 'bg-green-500' :
                                                progress.percent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                              }`}
                                              style={{ width: `${progress.percent}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {level1Stage && level1Stage.stage && (
                                        <div className="mb-3">
                                          <div
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-white font-bold text-sm"
                                            style={{ backgroundColor: level1Stage.stage.color }}
                                          >
                                            <span className="text-base">{level1Stage.stage.icon}</span>
                                            <span>{level1Stage.stage.name}</span>
                                            <level1Stage.statusIcon className={`w-4 h-4 ml-auto ${level1Stage.status === 'active' ? 'animate-pulse' : ''}`} />
                                          </div>
                                        </div>
                                      )}

                                      {!level1Stage && (
                                        <div className="mb-3">
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color} ${config.border} border inline-block`}>
                                            {config.label}
                                          </span>
                                        </div>
                                      )}

                                      <div className="flex items-center space-x-1 text-[10px] text-slate-500 mb-3 pb-2 border-b border-slate-100">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>{formatDate(project.startDate)}</span>
                                        <span>-</span>
                                        <span className={overdueDays ? 'text-red-500 font-bold' : ''}>{formatDate(project.endDate)}</span>
                                        {overdueDays && (
                                          <span className="text-red-500 font-bold ml-1">(-{overdueDays}д)</span>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap gap-1 mb-3">
                                        {project.services?.slice(0, 2).map(s => (
                                          <span key={s} className="text-[9px] text-slate-500 border border-slate-100 px-1.5 py-0.5 rounded-md bg-slate-50">{s}</span>
                                        ))}
                                        {project.services && project.services.length > 2 && (
                                          <span className="text-[9px] text-slate-400 px-1 py-0.5">+{project.services.length - 2}</span>
                                        )}
                                      </div>

                                      {team.length > 0 && (
                                        <div className="flex items-center justify-between">
                                          <div className="flex -space-x-2">
                                            {team.slice(0, 4).map(member => (
                                              <img
                                                key={member.id}
                                                src={member.avatar}
                                                alt={member.name}
                                                title={member.name}
                                                className="w-6 h-6 rounded-full border-2 border-white object-cover"
                                              />
                                            ))}
                                            {team.length > 4 && (
                                              <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                                                <span className="text-[9px] font-bold text-slate-500">+{team.length - 4}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {project.status !== ProjectStatus.COMPLETED && !project.isArchived && (
                                        <button
                                          onClick={(e) => onGenerateTasks(project, e)}
                                          disabled={isGeneratingTasksFor === project.id}
                                          className="mt-3 w-full py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                          {isGeneratingTasksFor === project.id ? 'Генерация...' : 'AI: Создать задачи'}
                                        </button>
                                      )}
                                    </div>
                                </div>
                            );
                        })}
                        {columnProjects.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                <span className="text-2xl mb-2 opacity-20">+</span>
                                <span className="text-xs">Нет проектов</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
    </div>
  );
  };

  const renderServicesBoardView = () => {
    const allServices = Array.from(new Set(projects.flatMap(p => p.services || []))).filter(Boolean);
    const servicesToShow = allServices.length > 0 ? allServices : DEFAULT_SERVICES;

    const serviceColors = [
      'border-t-4 border-blue-400',
      'border-t-4 border-green-400',
      'border-t-4 border-orange-400',
      'border-t-4 border-teal-400',
      'border-t-4 border-rose-400',
      'border-t-4 border-amber-400',
    ];

    return (
      <div className="flex flex-nowrap gap-6 flex-1 pb-6 overflow-x-auto overflow-y-hidden snap-x snap-mandatory h-full">
        {servicesToShow.map((service, idx) => {
          const serviceProjects = filteredProjects.filter(p => p.services?.includes(service));
          return (
            <div
              key={service}
              className="flex-shrink-0 w-[85vw] md:w-[350px] lg:w-[380px] flex flex-col h-full rounded-2xl bg-slate-50/50 border border-slate-200/60 overflow-hidden snap-center"
            >
              <div className={`p-4 bg-white border-b border-slate-100 sticky top-0 z-10 ${serviceColors[idx % serviceColors.length]} shadow-sm`}>
                <h3 className="font-bold text-slate-800 flex justify-between items-center text-sm">
                  {service}
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold border border-slate-200">
                    {serviceProjects.length}
                  </span>
                </h3>
              </div>
              <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                {serviceProjects.map(project => {
                  const client = clients.find(c => c.id === project.clientId);
                  const config = getStatusConfig(project.status);
                  const progress = getProjectProgress(project.id);
                  const roadmapStage = getProjectRoadmapStage(project.id);
                  const level1Stage = getProjectLevel1Stage(project.id);
                  const team = getProjectTeam(project.teamIds);
                  const overdueDays = getOverdueInfo(project.endDate, project.status);

                  return (
                    <div
                      key={project.id}
                      onClick={() => onProjectClick(project)}
                      className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group relative cursor-pointer overflow-hidden ${
                        overdueDays ? 'border-2 border-red-300' : 'border border-slate-200'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          {project.imageUrl && (
                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                              <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm mb-1 leading-snug group-hover:text-blue-600 transition-colors truncate">{project.name}</h4>
                            {client && (
                              <p className="text-xs text-slate-500 truncate" title={client.name}>
                                {client.name}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => onEditProject(project, e)}
                            className="text-slate-300 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors flex-shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        </div>

                        {progress.total > 0 && (
                          <div className="mb-2">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {progress.completed}/{progress.total}
                            </span>
                          </div>
                        )}

                        {level1Stage && level1Stage.stage && (
                          <div className="mb-2">
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white font-bold text-xs"
                              style={{ backgroundColor: level1Stage.stage.color }}
                            >
                              <span className="text-sm">{level1Stage.stage.icon}</span>
                              <span>{level1Stage.stage.name}</span>
                              <level1Stage.statusIcon className={`w-3 h-3 ml-auto ${level1Stage.status === 'active' ? 'animate-pulse' : ''}`} />
                            </div>
                          </div>
                        )}

                        {!level1Stage && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color} ${config.border} border inline-block mb-2`}>
                            {config.label}
                          </span>
                        )}

                        {team.length > 0 && (
                          <div className="flex -space-x-2 mt-2">
                            {team.slice(0, 3).map(member => (
                              <img key={member.id} src={member.avatar} alt={member.name} title={member.name} className="w-6 h-6 rounded-full border-2 border-white object-cover" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {serviceProjects.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <span className="text-2xl mb-2 opacity-20">+</span>
                    <span className="text-xs">Нет проектов</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderArchiveView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="overflow-auto custom-scrollbar flex-1">
        <div className="p-6 space-y-4">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <p className="text-sm font-medium">Архив пуст</p>
            </div>
          ) : (
            filteredProjects.map(project => {
              const client = clients.find(c => c.id === project.clientId);
              const progress = getProjectProgress(project.id);
              const level1Stage = getProjectLevel1Stage(project.id);
              const team = getProjectTeam(project.teamIds);

              return (
                <div
                  key={project.id}
                  onClick={() => onProjectClick(project)}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      {project.imageUrl && (
                        <img src={project.imageUrl} alt={project.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{project.name}</h4>
                          {client && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
                              {client.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-slate-500">{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
                          {progress.total > 0 && <span className="text-slate-500">{progress.completed}/{progress.total}</span>}
                          {level1Stage && level1Stage.stage && (
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-white font-bold text-[10px]"
                              style={{ backgroundColor: level1Stage.stage.color }}
                            >
                              <span>{level1Stage.stage.icon}</span>
                              <span>{level1Stage.stage.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {team.length > 0 && (
                        <div className="flex -space-x-2">
                          {team.slice(0, 3).map(member => (
                            <img key={member.id} src={member.avatar} alt={member.name} title={member.name} className="w-6 h-6 rounded-full border-2 border-white object-cover" />
                          ))}
                        </div>
                      )}
                      {onRestoreProject && (
                        <button
                          onClick={(e) => onRestoreProject(project.id, e)}
                          className="px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center space-x-1"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Восстановить</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const renderListView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
        <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Проект</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Клиент</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Прогресс</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Статус</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Бюджет</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Команда</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Сроки</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredProjects.map(project => {
                        const client = clients.find(c => c.id === project.clientId);
                        const config = getStatusConfig(project.status);
                        const progress = getProjectProgress(project.id);
                        const level1Stage = getProjectLevel1Stage(project.id);
                        const team = getProjectTeam(project.teamIds);
                        const overdueDays = getOverdueInfo(project.endDate, project.status);
                        const agencyRevenue = project.budget - (project.mediaBudget || 0);

                        return (
                            <tr
                                key={project.id}
                                onClick={() => onProjectClick(project)}
                                className={`hover:bg-slate-50 transition-colors cursor-pointer group ${overdueDays ? 'bg-red-50/50' : ''}`}
                            >
                                <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                        {project.adAccountId && (
                                            <span className="w-4 h-4 flex items-center justify-center rounded bg-blue-50" title="Facebook Ads">
                                                <svg className="w-2.5 h-2.5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                            </span>
                                        )}
                                        {project.liveduneAccountId && (
                                            <span className="w-4 h-4 flex items-center justify-center rounded bg-pink-50" title="Livedune">
                                                <svg className="w-2.5 h-2.5 text-pink-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                            </span>
                                        )}
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{project.name}</p>
                                            <p className="text-xs text-slate-400 truncate max-w-[200px]">{project.description}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <p className="text-sm text-slate-700 font-medium">{client?.company || '-'}</p>
                                    <p className="text-xs text-slate-400">{client?.name}</p>
                                </td>
                                <td className="p-4">
                                    {progress.total > 0 ? (
                                        <div className="w-24">
                                            <div className="flex items-center justify-between text-[10px] mb-1">
                                                <span className="font-bold text-slate-600">{progress.completed}/{progress.total}</span>
                                                <span className="text-slate-400">{progress.percent}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        progress.percent === 100 ? 'bg-green-500' :
                                                        progress.percent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                                    }`}
                                                    style={{ width: `${progress.percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400">-</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    {level1Stage && level1Stage.stage ? (
                                      <div
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white font-bold text-xs inline-flex"
                                        style={{ backgroundColor: level1Stage.stage.color }}
                                      >
                                        <span className="text-sm">{level1Stage.stage.icon}</span>
                                        <span>{level1Stage.stage.name}</span>
                                        <level1Stage.statusIcon className={`w-3 h-3 ${level1Stage.status === 'active' ? 'animate-pulse' : ''}`} />
                                      </div>
                                    ) : (
                                      <span className={`text-xs font-bold py-1.5 px-3 rounded-full ${config.bg} ${config.color} ${config.border} border inline-block`}>
                                        {config.label}
                                      </span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <p className="text-sm font-bold text-slate-700 whitespace-nowrap">{project.budget.toLocaleString()} ₸</p>
                                    {agencyRevenue !== project.budget && (
                                        <p className="text-[10px] text-green-600 font-medium">Доход: {agencyRevenue.toLocaleString()} ₸</p>
                                    )}
                                </td>
                                <td className="p-4">
                                    {team.length > 0 ? (
                                        <div className="flex -space-x-2">
                                            {team.slice(0, 3).map(member => (
                                                <img
                                                    key={member.id}
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    title={member.name}
                                                    className="w-6 h-6 rounded-full border-2 border-white object-cover"
                                                />
                                            ))}
                                            {team.length > 3 && (
                                                <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                                                    <span className="text-[9px] font-bold text-slate-500">+{team.length - 3}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400">-</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="text-xs">
                                        <p className="text-slate-500">{formatDate(project.startDate)} - {formatDate(project.endDate)}</p>
                                        {overdueDays && (
                                            <p className="text-[10px] text-red-500 font-medium">Просрочен на {overdueDays} дн.</p>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => onEditProject(project, e)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {filteredProjects.length === 0 && (
                <div className="p-8 text-center text-slate-400">Проекты не найдены</div>
            )}
        </div>
    </div>
  );

  const renderContent = () => {
    if (viewScope === 'archive') {
      return renderArchiveView();
    }

    switch (viewType) {
      case 'board':
        return renderBoardView();
      case 'services':
        return renderServicesBoardView();
      case 'list':
        return renderListView();
      default:
        return renderBoardView();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <div className="flex flex-col gap-4 mb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-900">Проекты</h1>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
              {filteredProjects.length} из {projects.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {viewScope !== 'archive' && (
              <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 gap-1">
                <button onClick={() => setViewType('board')} className={`p-2.5 rounded-lg transition-all ${viewType === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Канбан по статусам">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </button>
                <button onClick={() => setViewType('services')} className={`p-2.5 rounded-lg transition-all ${viewType === 'services' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Канбан по услугам">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                </button>
                <button onClick={() => setViewType('list')} className={`p-2.5 rounded-lg transition-all ${viewType === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Список">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </button>
              </div>
            )}
            <button onClick={onAddProject} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Новый проект</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentUserId && (
            <button
              onClick={() => setViewScope('my')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewScope === 'my'
                  ? 'bg-green-600 text-white shadow-lg shadow-green-100'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-green-300'
              }`}
            >
              Мои проекты
            </button>
          )}
          <button
            onClick={() => setViewScope('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewScope === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
            }`}
          >
            Все проекты
          </button>
          {currentUser?.systemRole === SystemRole.ADMIN && (
            <button
              onClick={() => setViewScope('archive')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewScope === 'archive'
                  ? 'bg-slate-600 text-white shadow-lg shadow-slate-100'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              Архив
            </button>
          )}
          <div className="w-px h-6 bg-slate-200 mx-2"></div>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">Все клиенты</option>
            {clients.filter(c => projects.some(p => p.clientId === c.id)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">Все услуги</option>
            {DEFAULT_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as ProjectStatus | 'all')}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">Все статусы</option>
            {Array.from(new Set(projects.map(p => p.status))).filter(s => statusConfig[s]).map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default ProjectBoard;
