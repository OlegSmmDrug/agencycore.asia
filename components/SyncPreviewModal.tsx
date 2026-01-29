import React, { useState } from 'react';
import { X, AlertTriangle, Plus, RefreshCw, Trash2, Lock, CheckCircle } from 'lucide-react';

interface SyncChange {
  field: string;
  label: string;
  currentValue: number;
  newValue: number;
  changeType: 'add' | 'update' | 'delete';
  isManuallyEdited?: boolean;
}

interface SyncPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  changes: SyncChange[];
  onConfirm: (mode: 'all' | 'new-only' | 'selective', selectedFields?: string[]) => void;
  syncType: 'legacy' | 'dynamic';
}

export const SyncPreviewModal: React.FC<SyncPreviewModalProps> = ({
  isOpen,
  onClose,
  changes,
  onConfirm,
  syncType
}) => {
  const [syncMode, setSyncMode] = useState<'all' | 'new-only' | 'selective'>('new-only');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const manuallyEditedChanges = changes.filter(c => c.isManuallyEdited);
  const newFields = changes.filter(c => c.changeType === 'add');
  const updatedFields = changes.filter(c => c.changeType === 'update');
  const deletedFields = changes.filter(c => c.changeType === 'delete');

  const toggleField = (field: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(field)) {
      newSelected.delete(field);
    } else {
      newSelected.add(field);
    }
    setSelectedFields(newSelected);
  };

  const handleConfirm = () => {
    if (syncMode === 'selective') {
      onConfirm(syncMode, Array.from(selectedFields));
    } else {
      onConfirm(syncMode);
    }
  };

  const getChangeIcon = (type: 'add' | 'update' | 'delete') => {
    switch (type) {
      case 'add': return <Plus className="w-4 h-4 text-green-600" />;
      case 'update': return <RefreshCw className="w-4 h-4 text-blue-600" />;
      case 'delete': return <Trash2 className="w-4 h-4 text-red-600" />;
    }
  };

  const getChangeColor = (type: 'add' | 'update' | 'delete') => {
    switch (type) {
      case 'add': return 'bg-green-50 border-green-200';
      case 'update': return 'bg-blue-50 border-blue-200';
      case 'delete': return 'bg-red-50 border-red-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Предпросмотр синхронизации</h2>
            <p className="text-sm text-slate-500 mt-1">
              {syncType === 'legacy' ? 'Legacy синхронизация' : 'Динамическая синхронизация'} • {changes.length} изменений
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {manuallyEditedChanges.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Внимание: Ручные изменения</h3>
                <p className="text-sm text-amber-800">
                  {manuallyEditedChanges.length} полей были изменены вручную и могут быть перезаписаны.
                  Рекомендуем выбрать режим "Только новые поля" или "Выборочно".
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-3">Режим синхронизации</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSyncMode('new-only')}
              className={`p-4 rounded-xl border-2 transition-all ${
                syncMode === 'new-only'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-slate-800">Только новые</span>
              </div>
              <p className="text-xs text-slate-600">
                Добавить новые поля, не трогать существующие
              </p>
              <div className="mt-2 text-sm font-bold text-green-600">
                {newFields.length} полей
              </div>
            </button>

            <button
              onClick={() => setSyncMode('all')}
              className={`p-4 rounded-xl border-2 transition-all ${
                syncMode === 'all'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-slate-800">Обновить все</span>
              </div>
              <p className="text-xs text-slate-600">
                Перезаписать все поля новыми значениями
              </p>
              <div className="mt-2 text-sm font-bold text-blue-600">
                {changes.length} полей
              </div>
            </button>

            <button
              onClick={() => setSyncMode('selective')}
              className={`p-4 rounded-xl border-2 transition-all ${
                syncMode === 'selective'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-slate-800">Выборочно</span>
              </div>
              <p className="text-xs text-slate-600">
                Выбрать конкретные поля для синхронизации
              </p>
              <div className="mt-2 text-sm font-bold text-purple-600">
                {selectedFields.size} выбрано
              </div>
            </button>
          </div>
        </div>

        <div className="mb-6 max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
          <div className="divide-y divide-slate-200">
            {changes.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p>Нет изменений для синхронизации</p>
              </div>
            ) : (
              changes.map((change) => {
                const shouldShow =
                  syncMode === 'all' ||
                  (syncMode === 'new-only' && change.changeType === 'add') ||
                  syncMode === 'selective';

                if (!shouldShow) return null;

                return (
                  <div
                    key={change.field}
                    className={`p-4 transition-colors ${
                      syncMode === 'selective' && selectedFields.has(change.field)
                        ? 'bg-blue-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {syncMode === 'selective' && (
                        <input
                          type="checkbox"
                          checked={selectedFields.has(change.field)}
                          onChange={() => toggleField(change.field)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      <div className={`p-2 rounded-lg border ${getChangeColor(change.changeType)}`}>
                        {getChangeIcon(change.changeType)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800">{change.label}</span>
                          {change.isManuallyEdited && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                              <Lock className="w-3 h-3" />
                              Вручную
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-500">
                            {change.currentValue.toLocaleString('ru-RU')}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="font-semibold text-slate-900">
                            {change.newValue.toLocaleString('ru-RU')}
                          </span>
                          <span className={`text-xs font-medium ${
                            change.newValue > change.currentValue ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {change.newValue > change.currentValue ? '+' : ''}
                            {((change.newValue - change.currentValue) / Math.max(change.currentValue, 1) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            {syncMode === 'selective' && (
              <span>Выбрано полей: <strong>{selectedFields.size}</strong> из {changes.length}</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border-2 border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={syncMode === 'selective' && selectedFields.size === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Синхронизировать
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
