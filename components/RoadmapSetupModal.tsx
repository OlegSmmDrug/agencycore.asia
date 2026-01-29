import React, { useState, useEffect } from 'react';
import { User, Project } from '../types';
import ProjectTeamSelector from './ProjectTeamSelector';
import RoadmapTemplateSelector from './RoadmapTemplateSelector';
import RoadmapTemplateEditorModal from './RoadmapTemplateEditorModal';
import TemplateManagerPage from './TemplateManagerPage';
import { roadmapService } from '../services/roadmapService';
import { userService } from '../services/userService';

interface RoadmapSetupModalProps {
  isOpen: boolean;
  projectId: string;
  project: Project;
  projectName: string;
  onClose: () => void;
  onComplete: () => void;
}

const RoadmapSetupModal: React.FC<RoadmapSetupModalProps> = ({
  isOpen,
  projectId,
  project,
  projectName,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState<'team' | 'templates'>('team');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAllUsers();
      setStep('team');
    }
  }, [isOpen]);

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const users = await userService.getAll();
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  if (!isOpen) return null;

  const handleApplyTemplate = async (templateId: string) => {
    await roadmapService.applyTemplateToProject(projectId, templateId);
  };

  const handleEditTemplate = (templateId: string) => {
    setEditingTemplateId(templateId);
  };

  const handleEditorClose = () => {
    setEditingTemplateId(null);
  };

  const handleEditorComplete = async () => {
    setEditingTemplateId(null);
    const projectTemplateIds = await roadmapService.getProjectTemplates(projectId);
    setSelectedTemplates(projectTemplateIds);
    onComplete();
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-teal-600">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">Настройка дорожной карты</h2>
            <p className="text-xs sm:text-sm text-blue-100 truncate">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 ml-2"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setStep('team')}
            className={`flex-1 px-2 sm:px-6 py-2.5 sm:py-3 font-medium transition-colors relative ${
              step === 'team'
                ? 'text-blue-600 bg-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'team' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'
              }`}>
                1
              </span>
              <span className="text-xs sm:text-base">Команда</span>
            </div>
            {step === 'team' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <button
            onClick={() => setStep('templates')}
            className={`flex-1 px-2 sm:px-6 py-2.5 sm:py-3 font-medium transition-colors relative ${
              step === 'templates'
                ? 'text-blue-600 bg-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'templates' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'
              }`}>
                2
              </span>
              <span className="text-xs sm:text-base">Шаблоны</span>
            </div>
            {step === 'templates' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {step === 'team' && (
            loadingUsers ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3"></div>
                <p className="text-slate-500 text-sm">Загрузка сотрудников...</p>
              </div>
            ) : (
              <ProjectTeamSelector
                projectId={projectId}
                users={allUsers}
              />
            )
          )}

          {step === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Выберите готовые шаблоны или создайте новые
                </p>
                <button
                  onClick={() => setShowTemplateManager(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Управление шаблонами
                </button>
              </div>
              <RoadmapTemplateSelector
                projectId={projectId}
                onTemplatesSelected={setSelectedTemplates}
                onApplyTemplate={handleApplyTemplate}
                onEditTemplate={handleEditTemplate}
              />
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors rounded-lg hover:bg-slate-200"
            >
              Закрыть
            </button>
            <div className="flex gap-2 sm:gap-3">
              {step === 'templates' && (
                <button
                  onClick={() => setStep('team')}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium transition-colors"
                >
                  Назад к команде
                </button>
              )}
              {step === 'team' && (
                <button
                  onClick={() => setStep('templates')}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Далее: Шаблоны
                </button>
              )}
              {step === 'templates' && (
                <button
                  onClick={handleComplete}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Готово
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <RoadmapTemplateEditorModal
        isOpen={!!editingTemplateId}
        projectId={projectId}
        project={project}
        templateId={editingTemplateId || ''}
        users={allUsers}
        onClose={handleEditorClose}
        onComplete={handleEditorComplete}
      />

      {showTemplateManager && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <TemplateManagerPage
              onClose={() => setShowTemplateManager(false)}
              onEditTemplate={(templateId) => {
                setShowTemplateManager(false);
                setEditingTemplateId(templateId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RoadmapSetupModal;
