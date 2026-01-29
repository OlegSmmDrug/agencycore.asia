import React, { useState, useEffect } from 'react';
import { User, Project, TaskStatus } from '../types';
import { roadmapService, RoadmapTemplate } from '../services/roadmapService';
import RoadmapEditor, { L1_METADATA } from './roadmapeditor';
import { taskService } from '../services/taskService';
import { X, FileText, Users, ArrowRight } from 'lucide-react';

interface RoadmapTemplateEditorModalProps {
  isOpen: boolean;
  projectId: string;
  project: Project;
  templateId: string;
  users: User[];
  onClose: () => void;
  onComplete: () => void;
}

const RoadmapTemplateEditorModal: React.FC<RoadmapTemplateEditorModalProps> = ({
  isOpen,
  projectId,
  project,
  templateId,
  users,
  onClose,
  onComplete
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<RoadmapTemplate | null>(null);
  const [initialStages, setInitialStages] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const AUTOSAVE_KEY = `roadmap_template_draft_${templateId}`;

  useEffect(() => {
    if (isOpen && templateId) {
      loadTemplate();
    }
  }, [isOpen, templateId]);

  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false);
    }
  }, [isOpen]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const templates = await roadmapService.getRoadmapTemplates();
      const foundTemplate = templates.find(t => t.id === templateId);
      setTemplate(foundTemplate || null);

      if (foundTemplate) {
        const savedDraft = localStorage.getItem(AUTOSAVE_KEY);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            const draftAge = Date.now() - parsed.timestamp;
            const ONE_HOUR = 60 * 60 * 1000;

            if (draftAge < ONE_HOUR) {
              const shouldRestore = confirm(
                `Найдена несохраненная версия шаблона (${Math.round(draftAge / 60000)} мин. назад).\n\nВосстановить черновик?`
              );
              if (shouldRestore) {
                setInitialStages(parsed.stages);
                setHasUnsavedChanges(true);
                setLoading(false);
                return;
              }
            }
            localStorage.removeItem(AUTOSAVE_KEY);
          } catch (e) {
            console.error('Error parsing draft:', e);
            localStorage.removeItem(AUTOSAVE_KEY);
          }
        }
        await loadTemplateData(foundTemplate.id);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      alert('Ошибка загрузки шаблона. Попробуйте обновить страницу.');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateData = async (templateId: string) => {
    try {
      const templateStages = await roadmapService.getTemplateStages(templateId);

      const stagesWithTasks = await Promise.all(
        templateStages.map(async (stage) => {
          const tasks = await roadmapService.getTemplateTasks(stage.id);
          return { ...stage, tasks };
        })
      );

      const totalStages = stagesWithTasks.length;
      const stagesPerLevel1 = Math.ceil(totalStages / 4);

      const groupedByLevel1: { [key: number]: any[] } = {
        1: [],
        2: [],
        3: [],
        4: []
      };

      stagesWithTasks.forEach((stage, index) => {
        const level1Index = Math.min(Math.floor(index / stagesPerLevel1) + 1, 4);
        groupedByLevel1[level1Index].push(stage);
      });

      const today = new Date().toISOString().split('T')[0];

      const formattedStages = L1_METADATA.map((meta, index) => {
        const level1Index = index + 1;
        const level2Stages = groupedByLevel1[level1Index] || [];

        return {
          ...meta,
          durationDays: meta.defaultDays,
          subStages: level2Stages.length > 0
            ? level2Stages.map(l2Stage => ({
                id: `l2_new_${Date.now()}_${Math.random()}`,
                title: l2Stage.name,
                durationDays: 3,
                tasks: l2Stage.tasks.map((task: any) => ({
                  id: `t_new_${Date.now()}_${Math.random()}`,
                  title: task.title,
                  role: task.job_title_required || (task.tags && task.tags.length > 0 ? task.tags[0] : 'Project Manager'),
                  duration: task.duration_days && task.duration_days > 0 ? task.duration_days : (task.estimated_hours || 4),
                  durationUnit: task.duration_days && task.duration_days > 0 ? 'days' : 'hours'
                }))
              }))
            : [
                {
                  id: `l2_${Date.now()}_${meta.id}`,
                  title: 'Рабочий спринт',
                  durationDays: Math.ceil(meta.defaultDays / 2),
                  tasks: [
                    {
                      id: `t_${Date.now()}_1`,
                      title: 'Стартовая задача',
                      role: 'Project Manager',
                      duration: 4,
                      durationUnit: 'hours'
                    }
                  ]
                }
              ]
        };
      });

      setInitialStages(formattedStages);
    } catch (error) {
      console.error('Error loading template data:', error);
    }
  };

  const saveTemplateChanges = async (l1Stages: any[]) => {
    await roadmapService.deleteAllTemplateStages(templateId);

    const level1Stages = await roadmapService.getLevel1Stages();
    let orderIndex = 0;

    const allStages: any[] = [];
    for (const l1Stage of l1Stages) {
      const level1StageId = level1Stages.find(l => l.name === l1Stage.label)?.id || level1Stages[0].id;

      for (const l2Stage of l1Stage.subStages || []) {
        allStages.push({
          template_id: templateId,
          name: l2Stage.title,
          description: l2Stage.title,
          order_index: orderIndex++,
          color: l1Stage.color?.replace('border-', '#') || '#3B82F6',
          duration_days: l2Stage.durationDays || 3,
          level1_stage_id: level1StageId,
          tempTasks: l2Stage.tasks || []
        });
      }
    }

    const createdStages = await roadmapService.createTemplateStagesBatch(
      allStages.map(({ tempTasks, ...stage }) => stage)
    );

    const allTasks: any[] = [];
    createdStages.forEach((stage, idx) => {
      const tempTasks = allStages[idx].tempTasks;
      if (tempTasks && tempTasks.length > 0) {
        tempTasks.forEach((task: any, taskIdx: number) => {
          const durationDays = task.durationUnit === 'days'
            ? Math.max(1, task.duration || 1)
            : Math.max(1, Math.ceil((task.duration || 4) / 8));

          allTasks.push({
            stage_id: stage.id,
            title: task.title || 'Без названия',
            description: task.title || '',
            tags: [task.role],
            order_index: taskIdx,
            estimated_hours: task.durationUnit === 'hours' ? (task.duration || 4) : 0,
            duration_days: durationDays,
            job_title_required: task.role
          });
        });
      }
    });

    if (allTasks.length > 0) {
      await roadmapService.createTemplateTasksBatch(allTasks);
    }
  };

  const saveToLocalStorage = (stages: any[]) => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        stages,
        timestamp: Date.now()
      }));
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  const handleSave = async (l1Stages: any[]) => {
    try {
      setSaving(true);
      await saveTemplateChanges(l1Stages);
      clearLocalStorage();
      onComplete();
      onClose();
    } catch (error: any) {
      console.error('Error saving template:', error);

      let errorMessage = 'Ошибка сохранения шаблона';

      if (error.message) {
        errorMessage += ': ' + error.message;
      }

      if (error.code === 'PGRST116') {
        errorMessage = 'Ошибка доступа к базе данных. Проверьте подключение к интернету.';
      } else if (error.message?.includes('JWT')) {
        errorMessage = 'Сессия истекла. Перезагрузите страницу и войдите снова.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      }

      errorMessage += '\n\nВаши изменения сохранены локально. При следующем открытии редактора вы сможете их восстановить.';

      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndApply = async (l1Stages: any[]) => {
    try {
      setSaving(true);

      await saveTemplateChanges(l1Stages);

      const projectLevel1Status = await roadmapService.getProjectLevel1Status(projectId);
      if (projectLevel1Status.length === 0) {
        await roadmapService.initializeProjectStagesStatus(projectId);
      }

      await roadmapService.applyTemplateToProject(projectId, templateId);

      clearLocalStorage();
      onComplete();
      onClose();
    } catch (error: any) {
      console.error('Error applying template:', error);

      let errorMessage = 'Ошибка применения шаблона';

      if (error.message) {
        errorMessage += ': ' + error.message;
      }

      if (error.code === 'PGRST116') {
        errorMessage = 'Ошибка доступа к базе данных. Проверьте подключение к интернету.';
      } else if (error.message?.includes('JWT')) {
        errorMessage = 'Сессия истекла. Перезагрузите страницу и войдите снова.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      }

      errorMessage += '\n\nВаши изменения сохранены локально. При следующем открытии редактора вы сможете их восстановить.';

      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-teal-600 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-white/80" />
                <span className="text-sm text-blue-100">Применение шаблона</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white truncate flex items-center gap-2">
                {template?.name || 'Загрузка...'}
                {hasUnsavedChanges && (
                  <span className="text-xs bg-yellow-500 text-yellow-900 px-2 py-0.5 rounded-full font-medium">
                    Черновик сохранен
                  </span>
                )}
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                Проект: {project.name}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ml-4"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-blue-800 font-medium">Отредактируйте задачи</span>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-400 hidden sm:block" />
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-blue-600">Сохраните или примените</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-slate-500">Загрузка шаблона...</p>
            </div>
          ) : (
            <RoadmapEditor
              project={project}
              users={users}
              onSave={handleSave}
              onSaveAndApply={handleSaveAndApply}
              initialStages={initialStages}
              onStagesChange={saveToLocalStorage}
            />
          )}
        </div>

        {saving && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-slate-700 font-semibold text-lg">Сохраняю изменения...</p>
            <p className="text-slate-500 text-sm mt-1">Обновляю шаблон дорожной карты</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapTemplateEditorModal;
