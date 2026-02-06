import React, { useState, useEffect } from 'react';
import { AIAgent, CommunicationStyle, TriggerType } from '../../types';
import { MODELS, STYLE_GUIDELINES, TRIGGER_OPTIONS } from '../../constants/aiAgents';

interface SettingsPanelProps {
  agent: AIAgent;
  onUpdate: (agent: AIAgent) => void;
  onDelete?: (agentId: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ agent, onUpdate, onDelete }) => {
  const [localAgent, setLocalAgent] = useState<AIAgent>(agent);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setLocalAgent(agent);
    setHasChanges(false);
  }, [agent.id]);

  const handleUpdate = (updates: Partial<AIAgent>) => {
    setLocalAgent(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSettingsUpdate = (settings: Partial<typeof agent.settings>) => {
    setLocalAgent(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings }
    }));
    setHasChanges(true);
  };

  const handlePermissionsUpdate = (permissions: Partial<typeof agent.permissions>) => {
    setLocalAgent(prev => ({
      ...prev,
      permissions: { ...prev.permissions, ...permissions }
    }));
    setHasChanges(true);
  };

  const handleTriggerToggle = (triggerId: TriggerType) => {
    const currentTriggers = localAgent.triggers || [];
    const newTriggers = currentTriggers.includes(triggerId)
      ? currentTriggers.filter(t => t !== triggerId)
      : [...currentTriggers, triggerId];

    setLocalAgent(prev => ({ ...prev, triggers: newTriggers }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdate(localAgent);
    setHasChanges(false);
  };

  return (
    <div className="space-y-8">
      <section className="bg-white p-8 rounded-3xl border shadow-sm">
        <h3 className="text-lg font-black mb-6 uppercase tracking-wider">Модель и идентификация</h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Имя агента</label>
            <input
              type="text"
              value={localAgent.name}
              onChange={e => handleUpdate({ name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Например: ИИ Продавец Pro"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">AI Модель</label>
            <select
              value={localAgent.model}
              onChange={e => handleUpdate({ model: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {MODELS.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} - ${model.costPer1k}/1k tokens
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">{MODELS.find(m => m.id === localAgent.model)?.description}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Статус</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleUpdate({ status: localAgent.status === 'active' ? 'inactive' : 'active' })}
                className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                  localAgent.status === 'active'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {localAgent.status === 'active' ? 'Активен' : 'Неактивен'}
              </button>
              <span className="text-xs text-gray-500">
                {localAgent.status === 'active' ? 'Агент работает и обрабатывает запросы' : 'Агент приостановлен'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white p-8 rounded-3xl border shadow-sm">
        <h3 className="text-lg font-black mb-6 uppercase tracking-wider">Системный промпт</h3>
        <textarea
          value={localAgent.settings.systemPrompt}
          onChange={e => handleSettingsUpdate({ systemPrompt: e.target.value })}
          className="w-full h-64 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Введите инструкции для агента..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Это базовые инструкции, которые агент будет использовать в каждом диалоге
        </p>
      </section>

      <section className="bg-white p-8 rounded-3xl border shadow-sm">
        <h3 className="text-lg font-black mb-6 uppercase tracking-wider">Стиль общения</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(STYLE_GUIDELINES).map(([key, description]) => (
            <div
              key={key}
              onClick={() => handleSettingsUpdate({ communicationStyle: key as CommunicationStyle })}
              className={`p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                localAgent.settings.communicationStyle === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h4 className="font-bold text-sm mb-1 capitalize">{key === 'business' ? 'Деловой' : key === 'scientific' ? 'Научный' : key === 'conversational' ? 'Разговорный' : 'Кастомный'}</h4>
              <p className="text-xs text-gray-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-8 rounded-3xl border shadow-sm">
        <h3 className="text-lg font-black mb-6 uppercase tracking-wider">Триггеры активации</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TRIGGER_OPTIONS.map(trigger => (
            <div
              key={trigger.id}
              onClick={() => handleTriggerToggle(trigger.id)}
              className={`p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                localAgent.triggers?.includes(trigger.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{trigger.icon}</span>
                <h4 className="font-bold text-sm">{trigger.label}</h4>
              </div>
              <p className="text-xs text-gray-600">{trigger.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-8 rounded-3xl border shadow-sm">
        <h3 className="text-lg font-black mb-6 uppercase tracking-wider">Разрешения агента</h3>
        <div className="space-y-4">
          {Object.entries({
            createTasks: 'Создавать задачи в CRM',
            updateClient: 'Обновлять данные клиентов',
            sendWhatsApp: 'Отправлять сообщения в WhatsApp',
            readDocs: 'Читать документы и базу знаний',
            createProposal: 'Создавать коммерческие предложения'
          }).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={localAgent.permissions[key as keyof typeof localAgent.permissions]}
                onChange={e => handlePermissionsUpdate({ [key]: e.target.checked } as any)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white p-8 rounded-3xl border shadow-sm">
        <h3 className="text-lg font-black mb-6 uppercase tracking-wider">Параметры генерации</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Temperature: {localAgent.settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localAgent.settings.temperature}
              onChange={e => handleSettingsUpdate({ temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">
              {localAgent.settings.temperature < 0.3 ? 'Консервативный (предсказуемый)' :
               localAgent.settings.temperature < 0.7 ? 'Сбалансированный' : 'Креативный (вариативный)'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Max Tokens: {localAgent.settings.maxTokens}
            </label>
            <input
              type="range"
              min="500"
              max="4000"
              step="100"
              value={localAgent.settings.maxTokens}
              onChange={e => handleSettingsUpdate({ maxTokens: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">Максимальная длина ответа агента</p>
          </div>
        </div>
      </section>

      <section className="bg-white p-8 rounded-3xl border shadow-sm">
        <h3 className="text-lg font-black mb-6 uppercase tracking-wider">Лимиты и безопасность</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Дневной лимит расходов ($)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={localAgent.settings.dailyCostLimit}
              onChange={e => handleSettingsUpdate({ dailyCostLimit: parseFloat(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-xs text-gray-500 mt-1">Агент остановится при превышении лимита</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <h4 className="text-sm font-bold text-gray-700">Автоматический режим (Auto Mode)</h4>
              <p className="text-xs text-gray-500 mt-1">
                Агент выполняет действия без одобрения менеджера
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localAgent.settings.autoMode}
                onChange={e => handleSettingsUpdate({ autoMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <h4 className="text-sm font-bold text-gray-700">Использовать базу знаний</h4>
              <p className="text-xs text-gray-500 mt-1">
                Агент будет искать ответы в FAQ и документах
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localAgent.settings.useKnowledgeBase}
                onChange={e => handleSettingsUpdate({ useKnowledgeBase: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </section>

      {onDelete && (
        <section className="bg-white p-8 rounded-3xl border border-red-100 shadow-sm">
          <h3 className="text-lg font-black mb-4 uppercase tracking-wider text-red-600">Удаление агента</h3>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Агент будет удален без возможности восстановления</p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all border border-red-200"
              >
                Удалить агента
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium text-red-600">Вы уверены?</p>
              <button
                onClick={() => onDelete(agent.id)}
                className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all"
              >
                Да, удалить
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
              >
                Отмена
              </button>
            </div>
          )}
        </section>
      )}

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-center">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 animate-in slide-in-from-bottom-4"
          >
            Сохранить изменения
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
