import React, { useState, useEffect } from 'react';
import { roadmapService, RoadmapTemplate } from '../services/roadmapService';

interface RoadmapTemplateSelectorProps {
  projectId: string;
  onTemplatesSelected: (templateIds: string[]) => void;
  onApplyTemplate: (templateId: string) => Promise<void>;
  onEditTemplate?: (templateId: string) => void;
}

const RoadmapTemplateSelector: React.FC<RoadmapTemplateSelectorProps> = ({
  projectId,
  onTemplatesSelected,
  onApplyTemplate,
  onEditTemplate
}) => {
  const [templates, setTemplates] = useState<RoadmapTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      const [allTemplates, projectTemplateIds] = await Promise.all([
        roadmapService.getRoadmapTemplates(),
        roadmapService.getProjectTemplates(projectId)
      ]);
      setTemplates(allTemplates);
      setSelectedTemplates(projectTemplateIds);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTemplate = async (templateId: string) => {
    if (applying) return;

    const isCurrentlySelected = selectedTemplates.includes(templateId);

    if (!isCurrentlySelected) {
      if (onEditTemplate) {
        onEditTemplate(templateId);
      } else {
        setApplying(templateId);
        try {
          await onApplyTemplate(templateId);
          setSelectedTemplates(prev => [...prev, templateId]);
          onTemplatesSelected([...selectedTemplates, templateId]);
        } catch (error) {
          console.error('Error applying template:', error);
        } finally {
          setApplying(null);
        }
      }
    } else {
      setApplying(templateId);
      try {
        await roadmapService.removeTemplateFromProject(projectId, templateId);
        const updatedTemplates = selectedTemplates.filter(id => id !== templateId);
        setSelectedTemplates(updatedTemplates);
        onTemplatesSelected(updatedTemplates);
      } catch (error) {
        console.error('Error removing template:', error);
      } finally {
        setApplying(null);
      }
    }
  };

  const getTemplateIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'SMM': return '📱';
      case 'Запуск рекламы': return '🎯';
      case 'Разработка сайта': return '💻';
      case 'Брендинг': return '🎨';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3"></div>
        <p className="text-slate-500 text-sm">Загрузка шаблонов...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Шаблоны дорожной карты</h3>
          <p className="text-sm text-slate-500">
            Применено: <span className="font-semibold text-green-600">{selectedTemplates.length}</span> шаблонов
          </p>
        </div>
      </div>

      {selectedTemplates.length > 0 && (
        <div className="p-3 bg-green-50 rounded-xl border border-green-200">
          <p className="text-xs font-semibold text-green-700 mb-2">Применённые шаблоны:</p>
          <div className="flex flex-wrap gap-2">
            {selectedTemplates.map(templateId => {
              const template = templates.find(t => t.id === templateId);
              if (!template) return null;
              return (
                <div
                  key={templateId}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-green-200 group cursor-pointer hover:border-red-300 transition-colors"
                  onClick={() => handleToggleTemplate(templateId)}
                >
                  <span>{getTemplateIcon(template.service_type)}</span>
                  <span className="text-sm font-medium text-slate-700">{template.name}</span>
                  {applying === templateId ? (
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map(template => {
          const isSelected = selectedTemplates.includes(template.id);
          const isApplying = applying === template.id;

          return (
            <div
              key={template.id}
              onClick={() => !isApplying && handleToggleTemplate(template.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                isApplying
                  ? 'border-blue-300 bg-blue-50 cursor-wait'
                  : isSelected
                  ? 'border-green-500 bg-green-50 cursor-pointer hover:bg-green-100'
                  : 'border-slate-200 bg-white hover:border-blue-300 cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ${
                    isSelected ? 'bg-green-100' : 'bg-slate-100'
                  }`}
                >
                  {isApplying ? (
                    <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-2 border-blue-600 border-t-transparent"></div>
                  ) : (
                    getTemplateIcon(template.service_type)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-sm sm:text-base mb-1 truncate">{template.name}</div>
                  <div className="text-xs text-slate-500 line-clamp-2 mb-2">
                    {template.description || 'Без описания'}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                      isSelected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {template.service_type}
                  </span>
                </div>
                {isSelected && !isApplying && (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-600 font-medium">Нет доступных шаблонов</p>
          <p className="text-slate-400 text-sm mt-1">Обратитесь к администратору для создания шаблонов</p>
        </div>
      )}
    </div>
  );
};

export default RoadmapTemplateSelector;
