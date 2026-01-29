import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Lock, CheckCircle2, Play, Plus, Trash2, Edit2, X, Check, Clock, RotateCcw } from 'lucide-react';
import { Task, User, Level1StageStatus } from '../types';
import { roadmapService, RoadmapStageLevel1, RoadmapStageLevel2 } from '../services/roadmapService';
import { level1StageService } from '../services/level1StageService';
import StageControlPanel from './StageControlPanel';

interface ProjectRoadmapKanbanProps {
  projectId: string;
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  onCreateTask: (stageLevel2Id: string) => void;
}

const ProjectRoadmapKanban: React.FC<ProjectRoadmapKanbanProps> = ({
  projectId,
  tasks,
  users,
  onTaskClick,
  onCreateTask
}) => {
  const [level1Stages, setLevel1Stages] = useState<RoadmapStageLevel1[]>([]);
  const [level2Stages, setLevel2Stages] = useState<RoadmapStageLevel2[]>([]);
  const [level1StageStatuses, setLevel1StageStatuses] = useState<Level1StageStatus[]>([]);
  const [plannedTasksCounts, setPlannedTasksCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [addingToLevel1, setAddingToLevel1] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [savingStage, setSavingStage] = useState<string | null>(null);
  const [completingStage, setCompletingStage] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [deletingRoadmap, setDeletingRoadmap] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRoadmap();
  }, [projectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(null);
      }
    };

    if (showStatusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatusMenu]);

  const loadRoadmap = useCallback(async () => {
    try {
      setLoading(true);
      const [l1Stages, l2Stages, statuses] = await Promise.all([
        roadmapService.getLevel1Stages(),
        roadmapService.getLevel2StagesByProject(projectId),
        level1StageService.getProjectStageStatus(projectId)
      ]);
      setLevel1Stages(l1Stages);
      setLevel2Stages(l2Stages);
      setLevel1StageStatuses(statuses);

      if (statuses.length === 0 && l1Stages.length > 0) {
        await level1StageService.initializeProjectStages(projectId);
        const newStatuses = await level1StageService.getProjectStageStatus(projectId);
        setLevel1StageStatuses(newStatuses);
      }

      const counts: Record<string, number> = {};
      for (const stage of l2Stages) {
        if (stage.status === 'locked' && stage.template_stage_id) {
          try {
            const count = await roadmapService.getTaskCountForTemplate(stage.template_stage_id);
            counts[stage.id] = count;
          } catch (error) {
            console.error('Error loading planned tasks count:', error);
          }
        }
      }
      setPlannedTasksCounts(counts);
    } catch (error) {
      console.error('Error loading roadmap:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleAddLevel2Stage = async (level1StageId: string) => {
    if (!newStageName.trim()) return;

    setSavingStage(level1StageId);
    try {
      const maxOrder = Math.max(
        0,
        ...level2Stages
          .filter(s => s.level1_stage_id === level1StageId)
          .map(s => s.order_index)
      );

      const newStage = await roadmapService.createLevel2Stage({
        project_id: projectId,
        level1_stage_id: level1StageId,
        name: newStageName,
        description: '',
        order_index: maxOrder + 1,
        color: '#64748b'
      });

      setLevel2Stages(prev => [...prev, newStage]);
      setNewStageName('');
      setAddingToLevel1(null);
    } catch (error) {
      console.error('Error adding stage:', error);
    } finally {
      setSavingStage(null);
    }
  };

  const handleUpdateStage = async (stageId: string) => {
    if (!editStageName.trim()) return;

    setSavingStage(stageId);
    try {
      await roadmapService.updateLevel2Stage(stageId, { name: editStageName });
      setLevel2Stages(prev =>
        prev.map(s => s.id === stageId ? { ...s, name: editStageName } : s)
      );
      setEditingStage(null);
      setEditStageName('');
    } catch (error) {
      console.error('Error updating stage:', error);
    } finally {
      setSavingStage(null);
    }
  };

  const handleDeleteStage = async (stageId: string, stageName: string) => {
    const stageTasks = getTasksByStage(stageId);
    const taskCount = stageTasks.length;

    let confirmMessage = `Удалить этап "${stageName}"?`;
    if (taskCount > 0) {
      confirmMessage = `Удалить этап "${stageName}" вместе с ${taskCount} задач${taskCount === 1 ? 'ей' : taskCount > 1 && taskCount < 5 ? 'ами' : 'ами'}?\n\nЭто действие нельзя отменить!`;
    }

    if (!confirm(confirmMessage)) return;

    setSavingStage(stageId);
    try {
      await roadmapService.deleteLevel2Stage(stageId, true);
      setLevel2Stages(prev => prev.filter(s => s.id !== stageId));
    } catch (error) {
      console.error('Error deleting stage:', error);
      alert('Ошибка при удалении этапа');
    } finally {
      setSavingStage(null);
    }
  };

  const handleDeleteEntireRoadmap = async () => {
    const totalStages = level2Stages.length;
    const totalTasks = tasks.filter(t => level2Stages.some(s => s.id === t.stage_level2_id)).length;

    if (totalStages === 0) {
      alert('Дорожная карта пуста');
      return;
    }

    const confirmMessage = `ВНИМАНИЕ! Вы собираетесь удалить всю дорожную карту!\n\nБудет удалено:\n- Этапов: ${totalStages}\n- Задач: ${totalTasks}\n\nЭто действие НЕЛЬЗЯ отменить!\n\nВы уверены?`;

    if (!confirm(confirmMessage)) return;

    const doubleConfirm = confirm('Вы точно уверены? Это последнее предупреждение!');
    if (!doubleConfirm) return;

    setDeletingRoadmap(true);
    try {
      const result = await roadmapService.deleteProjectRoadmap(projectId);
      alert(`Дорожная карта удалена!\nУдалено этапов: ${result.deletedStages}\nУдалено задач: ${result.deletedTasks}`);
      await loadRoadmap();
    } catch (error) {
      console.error('Error deleting roadmap:', error);
      alert('Ошибка при удалении дорожной карты');
    } finally {
      setDeletingRoadmap(false);
    }
  };

  const handleCompleteStage = async (level1StageId: string, stageName: string) => {
    if (!confirm(`Завершить этап "${stageName}"? Следующий этап станет активным.`)) return;

    setCompletingStage(level1StageId);
    try {
      await level1StageService.completeStage(projectId, level1StageId);
      const newStatuses = await level1StageService.getProjectStageStatus(projectId);
      setLevel1StageStatuses(newStatuses);
    } catch (error) {
      console.error('Error completing stage:', error);
    } finally {
      setCompletingStage(null);
    }
  };

  const handleChangeLevel1Status = async (
    level1StageId: string,
    newStatus: 'locked' | 'active' | 'completed'
  ) => {
    const confirmMessages = {
      locked: 'Установить статус "Заблокирован"? Даты запуска и завершения будут сброшены.',
      active: 'Установить статус "Активен"? Будет установлена дата запуска.',
      completed: 'Установить статус "Завершен"? Будут установлены даты запуска и завершения.'
    };

    if (!confirm(confirmMessages[newStatus])) return;

    setChangingStatus(level1StageId);
    try {
      await level1StageService.updateStageStatus(projectId, level1StageId, newStatus);
      const newStatuses = await level1StageService.getProjectStageStatus(projectId);
      setLevel1StageStatuses(newStatuses);
      setShowStatusMenu(null);
    } catch (error) {
      console.error('Error changing stage status:', error);
      alert('Ошибка при изменении статуса этапа');
    } finally {
      setChangingStatus(null);
    }
  };

  const getLevel2StagesByLevel1 = useCallback((level1Id: string) => {
    return level2Stages.filter(s => s.level1_stage_id === level1Id);
  }, [level2Stages]);

  const getTasksByStage = useCallback((stageLevel2Id: string) => {
    return tasks.filter(t => t.stage_level2_id === stageLevel2Id);
  }, [tasks]);

  const getTaskCountForLevel1 = useCallback((level1Id: string) => {
    const substages = getLevel2StagesByLevel1(level1Id);
    return substages.reduce((total, stage) => {
      return total + getTasksByStage(stage.id).length;
    }, 0);
  }, [getLevel2StagesByLevel1, getTasksByStage]);

  const getLevel1StageStatus = useCallback((level1StageId: string): Level1StageStatus | undefined => {
    return level1StageStatuses.find(s => s.level1StageId === level1StageId);
  }, [level1StageStatuses]);

  const getUserById = useMemo(() => {
    const userMap = new Map(users.map(u => [u.id, u]));
    return (id: string) => userMap.get(id);
  }, [users]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mb-4"></div>
        <p className="text-slate-500 text-sm">Загрузка дорожной карты...</p>
      </div>
    );
  }

  if (level1Stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium">Дорожная карта не настроена</p>
        <p className="text-slate-400 text-sm mt-1">Нажмите "Настроить" для начала работы</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {level2Stages.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-red-50 border-2 border-red-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-red-800">Опасная зона</h3>
              <p className="text-sm text-red-600">Удаление всей дорожной карты нельзя отменить</p>
            </div>
          </div>
          <button
            onClick={handleDeleteEntireRoadmap}
            disabled={deletingRoadmap}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {deletingRoadmap ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Удаление...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Удалить всю дорожную карту</span>
              </>
            )}
          </button>
        </div>
      )}

      {level1Stages.map(level1Stage => {
        const substages = getLevel2StagesByLevel1(level1Stage.id);
        const taskCount = getTaskCountForLevel1(level1Stage.id);
        const stageStatus = getLevel1StageStatus(level1Stage.id);
        const isLocked = stageStatus?.status === 'locked';
        const isActive = stageStatus?.status === 'active';
        const isCompleted = stageStatus?.status === 'completed';
        const isCompletingThis = completingStage === level1Stage.id;

        return (
          <div key={level1Stage.id} className={`${isLocked ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
              <div
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-white text-sm sm:text-base relative"
                style={{ backgroundColor: level1Stage.color }}
              >
                {isLocked && (
                  <div className="absolute -top-1 -right-1 bg-slate-600 rounded-full p-0.5 sm:p-1">
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                  </div>
                )}
                {isActive && (
                  <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 sm:p-1 animate-pulse">
                    <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                  </div>
                )}
                {isCompleted && (
                  <div className="absolute -top-1 -right-1 bg-green-600 rounded-full p-0.5 sm:p-1">
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                  </div>
                )}
                <span className="text-lg sm:text-xl">{level1Stage.icon}</span>
                <span className="hidden sm:inline">{level1Stage.name}</span>
                <span className="sm:hidden">{level1Stage.name.slice(0, 12)}{level1Stage.name.length > 12 ? '...' : ''}</span>
                <span className="bg-white/20 px-1.5 sm:px-2 py-0.5 rounded-full text-xs">
                  {taskCount}
                </span>
              </div>

              {!isLocked && !isCompleted && (
                <>
                  <button
                    onClick={() => setAddingToLevel1(level1Stage.id)}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Добавить этап</span>
                    <span className="sm:hidden">Этап</span>
                  </button>

                  {isActive && (
                    <button
                      onClick={() => handleCompleteStage(level1Stage.id, level1Stage.name)}
                      disabled={isCompletingThis}
                      className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {isCompletingThis ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Завершить</span>
                    </button>
                  )}
                </>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(showStatusMenu === level1Stage.id ? null : level1Stage.id)}
                  disabled={changingStatus === level1Stage.id}
                  className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="Изменить статус этапа"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Статус</span>
                </button>

                {showStatusMenu === level1Stage.id && (
                  <div ref={statusMenuRef} className="absolute left-0 top-full mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-xl z-50 min-w-[220px]">
                    <div className="p-2">
                      <div className="text-xs font-medium text-slate-500 px-3 py-2 mb-1">
                        Выберите статус
                      </div>
                      <button
                        onClick={() => handleChangeLevel1Status(level1Stage.id, 'locked')}
                        disabled={changingStatus === level1Stage.id || isLocked}
                        className="w-full text-left px-3 py-2 rounded hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Lock className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-slate-700">Заблокирован</span>
                      </button>
                      <button
                        onClick={() => handleChangeLevel1Status(level1Stage.id, 'active')}
                        disabled={changingStatus === level1Stage.id || isActive}
                        className="w-full text-left px-3 py-2 rounded hover:bg-green-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-700">Активен</span>
                      </button>
                      <button
                        onClick={() => handleChangeLevel1Status(level1Stage.id, 'completed')}
                        disabled={changingStatus === level1Stage.id || isCompleted}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-700">Завершен</span>
                      </button>
                    </div>
                    <div className="border-t border-slate-200 p-2">
                      <button
                        onClick={() => setShowStatusMenu(null)}
                        className="w-full text-center px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {addingToLevel1 === level1Stage.id && (
              <div className="flex flex-col sm:flex-row gap-2 mb-3 p-3 bg-slate-50 rounded-xl">
                <input
                  type="text"
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLevel2Stage(level1Stage.id)}
                  placeholder="Название этапа"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddLevel2Stage(level1Stage.id)}
                    disabled={savingStage === level1Stage.id}
                    className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {savingStage === level1Stage.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Добавить</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setAddingToLevel1(null);
                      setNewStageName('');
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {substages.map(level2Stage => {
                const stageTasks = getTasksByStage(level2Stage.id);
                const isEditing = editingStage === level2Stage.id;
                const isSaving = savingStage === level2Stage.id;

                return (
                  <div
                    key={level2Stage.id}
                    className={`bg-white rounded-xl border-2 border-slate-200 overflow-hidden transition-opacity ${isSaving ? 'opacity-50' : ''}`}
                  >
                    <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editStageName}
                            onChange={e => setEditStageName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleUpdateStage(level2Stage.id)}
                            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm min-w-0"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateStage(level2Stage.id)}
                            disabled={isSaving}
                            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingStage(null);
                              setEditStageName('');
                            }}
                            className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h4 className="font-bold text-slate-800 text-sm sm:text-base truncate">{level2Stage.name}</h4>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="bg-slate-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                                {stageTasks.length}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingStage(level2Stage.id);
                                  setEditStageName(level2Stage.name);
                                }}
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStage(level2Stage.id, level2Stage.name)}
                                className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {level2Stage.status === 'locked' && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                <Lock className="w-3 h-3" />
                                Заблокирован
                              </span>
                            )}
                            {level2Stage.status === 'active' && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                <Play className="w-3 h-3" />
                                Активен
                              </span>
                            )}
                            {level2Stage.status === 'completed' && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Завершен
                              </span>
                            )}
                            {level2Stage.duration_days && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                <Clock className="w-3 h-3" />
                                {level2Stage.duration_days}д
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {!isEditing && level2Stage.status !== 'completed' && (
                      <div className="px-2 sm:px-3 pb-2 border-b border-slate-200">
                        <div className="text-xs space-y-1">
                          {level2Stage.status === 'locked' && (
                            <button
                              onClick={async () => {
                                try {
                                  await roadmapService.startLevel2Stage(level2Stage.id);
                                  await loadRoadmap();
                                } catch (error) {
                                  console.error('Error starting stage:', error);
                                  alert('Ошибка при запуске этапа');
                                }
                              }}
                              className="w-full px-2 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                            >
                              <Play className="w-3 h-3" />
                              Запустить
                            </button>
                          )}
                          {level2Stage.status === 'active' && (
                            <button
                              onClick={async () => {
                                try {
                                  const allCompleted = await roadmapService.checkStageTasksCompleted(level2Stage.id);
                                  if (!allCompleted) {
                                    if (!confirm('Есть незавершенные задачи. Завершить этап принудительно?')) return;
                                  }
                                  await roadmapService.completeLevel2Stage(level2Stage.id);
                                  await loadRoadmap();
                                } catch (error) {
                                  console.error('Error completing stage:', error);
                                  alert('Ошибка при завершении этапа');
                                }
                              }}
                              className="w-full px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Завершить
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-2 sm:p-3 space-y-2 max-h-80 sm:max-h-96 overflow-y-auto">
                      {stageTasks.map(task => {
                        const assignee = task.assigneeId ? getUserById(task.assigneeId) : undefined;
                        const deadline = task.deadline ? new Date(task.deadline) : null;
                        const isOverdue = deadline && deadline < new Date();

                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick(task)}
                            className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                          >
                            <h5 className="font-medium text-sm text-slate-800 mb-2 line-clamp-2">{task.title}</h5>

                            <div className="flex flex-wrap items-center gap-2">
                              {assignee && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[9px] font-bold">
                                    {assignee.name.charAt(0)}
                                  </div>
                                  <span className="text-xs text-slate-600 font-medium truncate max-w-[80px]">{assignee.name}</span>
                                </div>
                              )}

                              {deadline && (
                                <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>{deadline.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {level2Stage.status === 'locked' && plannedTasksCounts[level2Stage.id] > 0 && (
                        <div className="p-2.5 sm:p-3 bg-blue-50 rounded-lg border border-blue-200 border-dashed">
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Lock className="w-4 h-4" />
                            <span className="font-medium">
                              {plannedTasksCounts[level2Stage.id]} {plannedTasksCounts[level2Stage.id] === 1 ? 'задача' : plannedTasksCounts[level2Stage.id] < 5 ? 'задачи' : 'задач'} будет создано при запуске этапа
                            </span>
                          </div>
                          <p className="text-xs text-blue-600 mt-1">
                            Задачи будут созданы автоматически с водопадными дедлайнами
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => onCreateTask(level2Stage.id)}
                        className="w-full p-2.5 sm:p-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-sm flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Задача</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {substages.length === 0 && (
                <div className="col-span-full p-6 sm:p-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center text-slate-400">
                  <p className="text-sm font-medium">Нет этапов</p>
                  <p className="text-xs mt-1">Добавьте этап для начала работы</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectRoadmapKanban;
