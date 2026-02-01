import React, { useState } from 'react';
import { syncProjectForMonth, syncOrganizationForMonth } from '../services/liveduneSyncService';

interface LiveduneSyncButtonProps {
  projectId?: string;
  organizationId?: string;
  onSyncComplete?: () => void;
}

export const LiveduneSyncButton: React.FC<LiveduneSyncButtonProps> = ({
  projectId,
  organizationId,
  onSyncComplete
}) => {
  const [syncing, setSyncing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    if (!projectId && !organizationId) {
      alert('Не указан проект или организация для синхронизации');
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);

      const result = projectId
        ? await syncProjectForMonth(projectId, year, month)
        : await syncOrganizationForMonth(organizationId!, year, month);

      if (result.success) {
        const totalItems = result.total_items_synced || 0;
        const projectsCount = result.projects_processed || 1;

        setSyncResult(`Синхронизировано ${totalItems} публикаций из ${projectsCount} проектов`);

        if (result.results && result.results.length > 0) {
          console.log('Детали синхронизации:', result.results);
        }

        setTimeout(() => {
          setShowDialog(false);
          setSyncResult(null);
          if (onSyncComplete) {
            onSyncComplete();
          }
        }, 3000);
      } else {
        setSyncResult(`Ошибка: ${result.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncResult(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setSyncing(false);
    }
  };

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }

    return options;
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
        title="Синхронизировать данные из LiveDune"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Синхронизация</span>
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Синхронизация контента
              </h3>
              <button
                onClick={() => setShowDialog(false)}
                className="text-slate-400 hover:text-slate-600"
                disabled={syncing}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Загрузить данные о публикациях из LiveDune API за выбранный месяц
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Выберите месяц
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={syncing}
              >
                {generateMonthOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {syncResult && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                syncResult.includes('Ошибка')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {syncResult}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDialog(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={syncing}
              >
                Отмена
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {syncing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Синхронизация...</span>
                  </>
                ) : (
                  <span>Синхронизировать</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
