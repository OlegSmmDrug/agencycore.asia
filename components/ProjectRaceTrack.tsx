import React, { useMemo, useState, useEffect } from 'react';
import { Lock, CheckCircle2, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { Project, Task, TaskStatus, Client, ProjectStatus, Level1StageStatus } from '../types';
import { level1StageService } from '../services/level1StageService';
import { supabase } from '../lib/supabase';

interface ProjectRaceTrackProps {
  projects: Project[];
  tasks: Task[];
  clients: Client[];
}

const COLLAPSED_COUNT = 5;

const ProjectRaceTrack: React.FC<ProjectRaceTrackProps> = ({ projects, tasks, clients }) => {
  const [projectStageStatuses, setProjectStageStatuses] = useState<Record<string, Level1StageStatus[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadAllProjectStatuses = async () => {
    try {
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
      console.error('Error loading project statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      loadAllProjectStatuses();
    }
  }, [projects]);

  useEffect(() => {
    const channel = supabase
      .channel('project-level1-stage-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_level1_stage_status'
        },
        () => {
          loadAllProjectStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projects]);

  // Calculate stage for each project
  const racers = useMemo(() => {
    return projects
        .filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED)
        .map(project => {
            const client = clients.find(c => c.id === project.clientId);
            const statuses = projectStageStatuses[project.id] || [];

            let currentStage = 1;
            let stageProgress = 0;
            let stageStatus: 'locked' | 'active' | 'completed' = 'active';
            let isInNewProjectStage = false;

            if (statuses.length > 0) {
              const activeStatus = statuses.find(s => s.status === 'active');
              const completedCount = statuses.filter(s => s.status === 'completed').length;

              if (activeStatus) {
                if (activeStatus.orderIndex === 0) {
                  isInNewProjectStage = true;
                  return null;
                }
                currentStage = activeStatus.orderIndex;
                stageStatus = 'active';
                stageProgress = 50;
              } else if (completedCount === statuses.length) {
                currentStage = 4;
                stageProgress = 100;
                stageStatus = 'completed';
              } else {
                const lastCompletedOrderIndex = Math.max(...statuses.filter(s => s.status === 'completed').map(s => s.orderIndex), 0);
                if (lastCompletedOrderIndex === 0) {
                  currentStage = 1;
                } else {
                  currentStage = lastCompletedOrderIndex;
                }
                stageProgress = 0;
              }
            }

            return {
                ...project,
                clientName: client?.company || 'Unknown',
                currentStage,
                stageProgress,
                stageStatus,
                color: ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500'][project.id.length % 6]
            };
        })
        .filter((project): project is NonNullable<typeof project> => project !== null)
        .sort((a, b) => b.currentStage - a.currentStage || b.stageProgress - a.stageProgress);
  }, [projects, clients, projectStageStatuses]);

  const stages = [
      { id: 1, label: 'Подготовка', icon: '🎯' },
      { id: 2, label: 'Продакшн', icon: '⚡' },
      { id: 3, label: 'Запуск', icon: '🚀' },
      { id: 4, label: 'Финал', icon: '🏆' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden relative mb-8">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                    <span className="text-2xl mr-2">🏎️</span> Гонка проектов (Live)
                </h3>
                <p className="text-xs text-slate-500 mt-1">Текущий этап реализации по каждому проекту</p>
            </div>
        </div>

        <div className="p-6 overflow-x-auto">
            <div className="grid grid-cols-4 gap-4 mb-4 min-w-[700px]">
                {stages.map(stage => (
                    <div key={stage.id} className="text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Этап {stage.id}</div>
                        <div className="font-bold text-slate-700 bg-slate-50 py-2 rounded-lg border border-slate-200">{stage.label}</div>
                    </div>
                ))}
            </div>

            <div className="relative min-w-[700px]">
                <div className="relative space-y-3" style={!expanded && racers.length > COLLAPSED_COUNT ? { maxHeight: `${COLLAPSED_COUNT * 68}px`, overflow: 'hidden' } : undefined}>
                    <div className="absolute inset-0 grid grid-cols-4 gap-4 pointer-events-none">
                        <div className="border-r border-slate-100 border-dashed"></div>
                        <div className="border-r border-slate-100 border-dashed"></div>
                        <div className="border-r border-slate-100 border-dashed"></div>
                        <div></div>
                    </div>

                    {racers.map((racer) => (
                        <div key={racer.id} className="relative h-14 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center px-2">
                            <div
                                className="absolute top-0 bottom-0 left-0 bg-blue-50/50 rounded-xl transition-all duration-1000"
                                style={{
                                    width: `calc(${((racer.currentStage - 1) * 25)}% + ${racer.stageProgress / 4}%)`
                                }}
                            ></div>

                            <div
                                className="absolute z-10 transition-all duration-1000 ease-out flex items-center"
                                style={{
                                    left: `calc(${((racer.currentStage - 1) * 25)}% + ${(racer.stageProgress * 0.20)}%)`,
                                    transform: 'translateX(10px)'
                                }}
                            >
                                <div className={`w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs ${racer.imageUrl ? 'bg-white' : racer.color} relative group cursor-pointer overflow-hidden`}>
                                    {racer.imageUrl ? (
                                        <img src={racer.imageUrl} alt={racer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        racer.name.charAt(0)
                                    )}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-20 text-center">
                                        <p className="font-bold mb-1 line-clamp-1">{racer.name}</p>
                                        <p className="text-slate-300">Этап {racer.currentStage}: {Math.round(racer.stageProgress)}%</p>
                                    </div>
                                </div>
                                <div className="ml-3">
                                    <p className="text-xs font-bold text-slate-700 w-32 truncate">{racer.clientName}</p>
                                    <p className="text-[10px] text-slate-400 truncate w-32">{racer.name}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {racers.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            Нет активных проектов в работе.
                        </div>
                    )}

                    {!expanded && racers.length > COLLAPSED_COUNT && (
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none rounded-b-xl" />
                    )}
                </div>

                {racers.length > COLLAPSED_COUNT && (
                    <div className="flex justify-center mt-2 pt-1">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all hover:shadow-sm"
                        >
                            {expanded ? (
                                <>
                                    <ChevronUp className="w-4 h-4" />
                                    Свернуть
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-4 h-4" />
                                    Развернуть список ({racers.length - COLLAPSED_COUNT} ещё)
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default ProjectRaceTrack;