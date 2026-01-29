import React, { useState, useEffect, useRef } from 'react';
import { roadmapService, RoadmapStageLevel2 } from '../services/roadmapService';
import { Play, CheckCircle, Lock, AlertCircle, RotateCcw } from 'lucide-react';

interface StageControlPanelProps {
  stage: RoadmapStageLevel2;
  onStageUpdated: () => void;
}

const StageControlPanel: React.FC<StageControlPanelProps> = ({ stage, onStageUpdated }) => {
  const [processing, setProcessing] = useState(false);
  const [showUncompletedTasks, setShowUncompletedTasks] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [plannedTasksCount, setPlannedTasksCount] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    };

    if (showStatusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatusMenu]);

  useEffect(() => {
    const loadPlannedTasksCount = async () => {
      if (stage.status === 'locked' && stage.template_stage_id) {
        try {
          const count = await roadmapService.getTaskCountForTemplate(stage.template_stage_id);
          setPlannedTasksCount(count);
        } catch (error) {
          console.error('Error loading planned tasks count:', error);
        }
      }
    };

    loadPlannedTasksCount();
  }, [stage.status, stage.template_stage_id]);

  const getStatusBadge = () => {
    switch (stage.status) {
      case 'locked':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">
            <Lock className="w-4 h-4" />
            Заблокирован
          </div>
        );
      case 'active':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
            <Play className="w-4 h-4" />
            Активен
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Завершен
          </div>
        );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleStartStage = async () => {
    let confirmMessage = 'Запустить этот этап?';

    if (plannedTasksCount !== null && plannedTasksCount > 0) {
      confirmMessage = `Запустить этот этап? Будет создано ${plannedTasksCount} ${plannedTasksCount === 1 ? 'задача' : plannedTasksCount < 5 ? 'задачи' : 'задач'} из шаблона с автоматическими водопадными дедлайнами и назначением исполнителей.`;
    } else {
      confirmMessage = 'Запустить этот этап? Будут рассчитаны водопадные дедлайны для существующих задач.';
    }

    if (!confirm(confirmMessage)) return;

    try {
      setProcessing(true);
      await roadmapService.startLevel2Stage(stage.id);
      onStageUpdated();
    } catch (error: any) {
      console.error('Error starting stage:', error);

      let errorMessage = 'Ошибка при запуске этапа';

      if (error.message) {
        errorMessage += ':\n\n' + error.message;
      }

      if (error.message?.includes('project_members') || error.message?.includes('team')) {
        errorMessage += '\n\nПроверьте, что в проект добавлены участники команды в разделе "Команда проекта".';
      }

      if (error.message?.includes('template') || error.message?.includes('task')) {
        errorMessage += '\n\nПроверьте корректность шаблона дорожной карты.';
      }

      alert(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteStage = async () => {
    try {
      setProcessing(true);

      const allTasksCompleted = await roadmapService.checkStageTasksCompleted(stage.id);

      if (!allTasksCompleted) {
        setShowUncompletedTasks(true);
        setProcessing(false);
        return;
      }

      if (!confirm('Завершить этот этап и активировать следующий?')) {
        setProcessing(false);
        return;
      }

      await roadmapService.completeLevel2Stage(stage.id);
      onStageUpdated();
    } catch (error) {
      console.error('Error completing stage:', error);
      alert('Ошибка при завершении этапа');
    } finally {
      setProcessing(false);
    }
  };

  const handleForceComplete = async () => {
    if (!confirm('Завершить этап принудительно? Невыполненные задачи останутся незавершенными.')) return;

    try {
      setProcessing(true);
      await roadmapService.completeLevel2Stage(stage.id);
      setShowUncompletedTasks(false);
      onStageUpdated();
    } catch (error) {
      console.error('Error force completing stage:', error);
      alert('Ошибка при завершении этапа');
    } finally {
      setProcessing(false);
    }
  };

  const handleSetStatus = async (newStatus: 'locked' | 'active' | 'completed') => {
    const confirmMessages = {
      locked: 'Установить статус "Заблокирован"? Даты запуска и завершения будут сброшены.',
      active: 'Установить статус "Активен"? Будет установлена дата запуска.',
      completed: 'Установить статус "Завершен"? Будут установлены даты запуска и завершения.'
    };

    if (!confirm(confirmMessages[newStatus])) return;

    try {
      setProcessing(true);
      await roadmapService.updateStageStatus(stage.id, newStatus);
      setShowStatusMenu(false);
      onStageUpdated();
    } catch (error) {
      console.error('Error updating stage status:', error);
      alert('Ошибка при обновлении статуса этапа');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: stage.color }}
          >
            {stage.order_index}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{stage.name}</h3>
            {getStatusBadge()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stage.status === 'locked' && (
            <button
              onClick={handleStartStage}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {processing ? 'Запуск...' : 'Запустить этап'}
            </button>
          )}

          {stage.status === 'active' && (
            <button
              onClick={handleCompleteStage}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {processing ? 'Завершение...' : 'Завершить этап'}
            </button>
          )}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={processing}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Ручное управление статусом"
            >
              <RotateCcw className="w-4 h-4" />
              Изменить статус
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-xl z-50 min-w-[220px]">
                <div className="p-2">
                  <div className="text-xs font-medium text-slate-500 px-3 py-2 mb-1">
                    Выберите статус
                  </div>
                  <button
                    onClick={() => handleSetStatus('locked')}
                    disabled={processing || stage.status === 'locked'}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4 text-slate-600" />
                    <span className="font-medium text-slate-700">Заблокирован</span>
                  </button>
                  <button
                    onClick={() => handleSetStatus('active')}
                    disabled={processing || stage.status === 'active'}
                    className="w-full text-left px-3 py-2 rounded hover:bg-green-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-700">Активен</span>
                  </button>
                  <button
                    onClick={() => handleSetStatus('completed')}
                    disabled={processing || stage.status === 'completed'}
                    className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-700">Завершен</span>
                  </button>
                </div>
                <div className="border-t border-slate-200 p-2">
                  <button
                    onClick={() => setShowStatusMenu(false)}
                    className="w-full text-center px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Запущен:</span>
          <p className="font-medium text-slate-800">{formatDate(stage.started_at)}</p>
        </div>
        <div>
          <span className="text-slate-500">Завершен:</span>
          <p className="font-medium text-slate-800">{formatDate(stage.completed_at)}</p>
        </div>
        <div>
          <span className="text-slate-500">Длительность:</span>
          <p className="font-medium text-slate-800">{stage.duration_days} дней</p>
        </div>
      </div>

      {showUncompletedTasks && (
        <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-yellow-800 mb-2">
                В этапе есть незавершенные задачи
              </p>
              <p className="text-sm text-yellow-700 mb-3">
                Вы не можете завершить этап, пока не выполните все задачи.
                Проверьте список задач и завершите их.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUncompletedTasks(false)}
                  className="px-4 py-2 bg-white border border-yellow-300 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleForceComplete}
                  disabled={processing}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  Завершить принудительно
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StageControlPanel;
