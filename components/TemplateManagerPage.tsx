import React, { useState, useEffect } from 'react';
import { roadmapService, RoadmapTemplate } from '../services/roadmapService';
import { Plus, Edit2, Trash2, Copy, Search, ChevronRight } from 'lucide-react';

interface TemplateManagerPageProps {
  onClose: () => void;
  onEditTemplate: (templateId: string) => void;
}

const TemplateManagerPage: React.FC<TemplateManagerPageProps> = ({ onClose, onEditTemplate }) => {
  const [templates, setTemplates] = useState<RoadmapTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    service_type: ''
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await roadmapService.getRoadmapTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.service_type.trim()) {
      alert('Заполните название и тип услуги');
      return;
    }

    try {
      const created = await roadmapService.createTemplate({
        name: newTemplate.name.trim(),
        description: newTemplate.description.trim(),
        service_type: newTemplate.service_type.trim(),
        is_active: true
      });

      setTemplates(prev => [...prev, created]);
      setShowCreateModal(false);
      setNewTemplate({ name: '', description: '', service_type: '' });
      onEditTemplate(created.id);
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Ошибка при создании шаблона');
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Удалить шаблон "${name}"? Это действие нельзя отменить.`)) return;

    try {
      await roadmapService.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Ошибка при удалении шаблона');
    }
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const { template, stages } = await roadmapService.getTemplateWithDetails(templateId);

      const newTemplateData = await roadmapService.createTemplate({
        name: `${template.name} (копия)`,
        description: template.description,
        service_type: template.service_type,
        is_active: true
      });

      for (const stage of stages) {
        const newStage = await roadmapService.createTemplateStage({
          template_id: newTemplateData.id,
          name: stage.name,
          description: stage.description,
          order_index: stage.order_index,
          color: stage.color,
          duration_days: stage.duration_days,
          level1_stage_id: stage.level1_stage_id
        });

        for (const task of stage.tasks) {
          await roadmapService.createTemplateTask({
            stage_id: newStage.id,
            title: task.title,
            description: task.description,
            tags: task.tags,
            order_index: task.order_index,
            estimated_hours: task.estimated_hours,
            duration_days: Math.max(1, task.duration_days || 3)
          });
        }
      }

      await loadTemplates();
      alert('Шаблон успешно скопирован');
    } catch (error) {
      console.error('Error duplicating template:', error);
      alert('Ошибка при копировании шаблона');
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.service_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTemplateIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'SMM': return '📱';
      case 'Запуск рекламы': return '🎯';
      case 'Разработка сайта': return '💻';
      case 'Брендинг': return '🎨';
      default: return '📋';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Управление шаблонами</h2>
            <p className="text-sm text-slate-500 mt-1">Создавайте и редактируйте шаблоны дорожных карт</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 border-b border-slate-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Поиск шаблонов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Создать шаблон
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium text-lg">Нет шаблонов</p>
              <p className="text-slate-400 text-sm mt-2">Создайте первый шаблон для начала работы</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="bg-white border-2 border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">
                      {getTemplateIcon(template.service_type)}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEditTemplate(template.id)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicateTemplate(template.id)}
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Дублировать"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id, template.name)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 mb-2 line-clamp-1">{template.name}</h3>
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2 min-h-[40px]">
                    {template.description || 'Без описания'}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                      {template.service_type}
                    </span>
                    <button
                      onClick={() => onEditTemplate(template.id)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      Открыть
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Создать новый шаблон</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Название шаблона
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Например: SMM-проект базовый"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Тип услуги
                </label>
                <input
                  type="text"
                  value={newTemplate.service_type}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, service_type: e.target.value }))}
                  placeholder="Например: SMM, Запуск рекламы"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Краткое описание шаблона"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTemplate({ name: '', description: '', service_type: '' });
                }}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateTemplate}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManagerPage;
