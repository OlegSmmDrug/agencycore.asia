import React, { useState, useEffect } from 'react';
import { roadmapService, RoadmapTemplateStage, RoadmapTemplateTask, RoadmapStageLevel1 } from '../services/roadmapService';
import { INITIAL_JOB_TITLES } from '../constants';
import { Plus, Trash2, GripVertical, Save, ArrowLeft } from 'lucide-react';

interface TemplateEditorFullModalProps {
  templateId: string;
  onClose: () => void;
  onSave: () => void;
}

interface StageWithTasks extends RoadmapTemplateStage {
  tasks: RoadmapTemplateTask[];
}

const TemplateEditorFullModal: React.FC<TemplateEditorFullModalProps> = ({
  templateId,
  onClose,
  onSave
}) => {
  const [template, setTemplate] = useState<any>(null);
  const [stages, setStages] = useState<StageWithTasks[]>([]);
  const [level1Stages, setLevel1Stages] = useState<RoadmapStageLevel1[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  useEffect(() => {
    loadTemplateData();
  }, [templateId]);

  const loadTemplateData = async () => {
    try {
      setLoading(true);
      const [data, level1] = await Promise.all([
        roadmapService.getTemplateWithDetails(templateId),
        roadmapService.getLevel1Stages()
      ]);
      setTemplate(data.template);
      setStages(data.stages);
      setLevel1Stages(level1);
      if (data.stages.length > 0) {
        setExpandedStage(data.stages[0].id);
      }
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      setSaving(true);
      await roadmapService.updateTemplate(templateId, {
        name: template.name,
        description: template.description,
        service_type: template.service_type
      });
      onSave();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Ошибка при сохранении шаблона');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStage = async () => {
    try {
      const maxOrder = stages.reduce((max, s) => Math.max(max, s.order_index), 0);
      const newStage = await roadmapService.createTemplateStage({
        template_id: templateId,
        name: 'Новый этап',
        description: '',
        order_index: maxOrder + 1,
        color: '#64748b',
        duration_days: 7,
        level1_stage_id: level1Stages[0]?.id
      });
      setStages(prev => [...prev, { ...newStage, tasks: [] }]);
      setExpandedStage(newStage.id);
    } catch (error) {
      console.error('Error adding stage:', error);
    }
  };

  const handleUpdateStage = async (stageId: string, updates: Partial<RoadmapTemplateStage>) => {
    try {
      await roadmapService.updateTemplateStage(stageId, updates);
      setStages(prev => prev.map(s => s.id === stageId ? { ...s, ...updates } : s));
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Удалить этап и все его задачи?')) return;
    try {
      await roadmapService.deleteTemplateStage(stageId);
      setStages(prev => prev.filter(s => s.id !== stageId));
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  const handleAddTask = async (stageId: string) => {
    try {
      const stage = stages.find(s => s.id === stageId);
      if (!stage) return;

      const maxOrder = stage.tasks.reduce((max, t) => Math.max(max, t.order_index), 0);
      const newTask = await roadmapService.createTemplateTask({
        stage_id: stageId,
        title: 'Новая задача',
        description: '',
        tags: [],
        order_index: maxOrder + 1,
        estimated_hours: 4,
        duration_days: 3,
        job_title_required: 'Project Manager'
      });

      setStages(prev => prev.map(s =>
        s.id === stageId ? { ...s, tasks: [...s.tasks, newTask] } : s
      ));
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<RoadmapTemplateTask>) => {
    try {
      await roadmapService.updateTemplateTask(taskId, updates);
      setStages(prev => prev.map(stage => ({
        ...stage,
        tasks: stage.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      })));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (stageId: string, taskId: string) => {
    if (!confirm('Удалить задачу?')) return;
    try {
      await roadmapService.deleteTemplateTask(taskId);
      setStages(prev => prev.map(s =>
        s.id === stageId ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) } : s
      ));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-slate-600 mt-4">Загрузка шаблона...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Назад</span>
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
              <input
                type="text"
                value={template?.name || ''}
                onChange={(e) => setTemplate((prev: any) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Тип услуги</label>
              <input
                type="text"
                value={template?.service_type || ''}
                onChange={(e) => setTemplate((prev: any) => ({ ...prev, service_type: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
              <input
                type="text"
                value={template?.description || ''}
                onChange={(e) => setTemplate((prev: any) => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Этапы и задачи</h3>
            <button
              onClick={handleAddStage}
              className="px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Добавить этап
            </button>
          </div>

          <div className="space-y-4">
            {stages.map((stage, stageIndex) => (
              <div key={stage.id} className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <div
                  className="bg-slate-50 p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <GripVertical className="w-5 h-5" />
                      <span className="font-bold text-slate-600">#{stageIndex + 1}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-5 gap-4">
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => handleUpdateStage(stage.id, { name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        placeholder="Название этапа"
                      />
                      <select
                        value={stage.level1_stage_id || ''}
                        onChange={(e) => handleUpdateStage(stage.id, { level1_stage_id: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {level1Stages.map(l1 => (
                          <option key={l1.id} value={l1.id}>{l1.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={stage.duration_days}
                        onChange={(e) => handleUpdateStage(stage.id, { duration_days: Math.max(1, parseInt(e.target.value) || 7) })}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Дней"
                        min="1"
                      />
                      <input
                        type="color"
                        value={stage.color}
                        onChange={(e) => handleUpdateStage(stage.id, { color: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStage(stage.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {expandedStage === stage.id && (
                  <div className="p-4 bg-white border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-600">
                        Задачи ({stage.tasks.length})
                      </span>
                      <button
                        onClick={() => handleAddTask(stage.id)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить задачу
                      </button>
                    </div>

                    <div className="space-y-2">
                      {stage.tasks.map((task, taskIndex) => (
                        <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <span className="text-xs font-medium text-slate-400">#{taskIndex + 1}</span>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleUpdateTask(task.id, { title: e.target.value })}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Название задачи"
                          />
                          <select
                            value={task.job_title_required || 'Project Manager'}
                            onChange={(e) => handleUpdateTask(task.id, { job_title_required: e.target.value })}
                            className="w-40 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            {INITIAL_JOB_TITLES.map(title => (
                              <option key={title} value={title}>{title}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={task.duration_days}
                            onChange={(e) => handleUpdateTask(task.id, { duration_days: Math.max(1, parseInt(e.target.value) || 3) })}
                            className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Дней"
                            min="1"
                          />
                          <input
                            type="number"
                            value={task.estimated_hours}
                            onChange={(e) => handleUpdateTask(task.id, { estimated_hours: parseInt(e.target.value) || 4 })}
                            className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Часов"
                            min="1"
                          />
                          <button
                            onClick={() => handleDeleteTask(stage.id, task.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {stage.tasks.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">
                          Нет задач. Добавьте первую задачу.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {stages.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-xl">
                <p className="text-slate-600 font-medium">Нет этапов</p>
                <p className="text-slate-400 text-sm mt-1">Добавьте первый этап для начала работы</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorFullModal;
