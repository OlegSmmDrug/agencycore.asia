import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Play, Pause, Zap, ArrowRight } from 'lucide-react';
import { AutomationRule, automationRuleService } from '../services/automationRuleService';

const TRIGGER_TYPES = [
  { value: 'client_created', label: 'Создан новый клиент', description: 'Когда клиент добавлен в CRM' },
  { value: 'client_status_changed', label: 'Изменен статус клиента', description: 'Когда обновлен статус клиента' },
  { value: 'task_created', label: 'Создана задача', description: 'Когда создана новая задача' },
  { value: 'task_completed', label: 'Задача выполнена', description: 'Когда задача отмечена как выполненная' },
  { value: 'payment_received', label: 'Получен платеж', description: 'Когда зафиксирован платеж' },
  { value: 'deadline_approaching', label: 'Приближается дедлайн', description: 'Когда близок срок задачи' },
  { value: 'project_created', label: 'Создан проект', description: 'Когда начат новый проект' },
  { value: 'project_status_changed', label: 'Изменен статус проекта', description: 'Когда обновлен статус проекта' },
];

const ACTION_TYPES = [
  { value: 'create_task', label: 'Создать задачу', icon: '📋' },
  { value: 'send_whatsapp', label: 'Отправить WhatsApp', icon: '💬' },
  { value: 'send_email', label: 'Отправить Email', icon: '📧' },
  { value: 'change_status', label: 'Изменить статус', icon: '🔄' },
  { value: 'assign_manager', label: 'Назначить менеджера', icon: '👤' },
  { value: 'webhook', label: 'Вызвать вебхук', icon: '🔗' },
  { value: 'create_notification', label: 'Создать уведомление', icon: '🔔' },
];

export const AutomationBuilder: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<AutomationRule> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setIsLoading(true);
      const data = await automationRuleService.getAllRules();
      setRules(data);
    } catch (error) {
      console.error('Failed to load automation rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingRule({
      name: '',
      description: '',
      trigger_type: 'client_created',
      trigger_config: {},
      condition_config: {},
      action_type: 'create_task',
      action_config: {},
      is_active: true,
    });
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editingRule || !editingRule.name) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingRule.id) {
        await automationRuleService.updateRule(editingRule.id, editingRule as any);
      } else {
        await automationRuleService.createRule(editingRule);
      }
      setIsCreating(false);
      setEditingRule(null);
      await loadRules();
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save automation rule');
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      await automationRuleService.toggleRule(rule.id, !rule.is_active);
      await loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) {
      return;
    }

    try {
      await automationRuleService.deleteRule(id);
      await loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const renderActionConfig = () => {
    if (!editingRule) return null;

    switch (editingRule.action_type) {
      case 'create_task':
        return (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Название задачи (используйте {{client_name}} для переменных)"
              value={editingRule.action_config?.title || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, title: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <textarea
              placeholder="Описание задачи"
              value={editingRule.action_config?.description || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, description: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
            />
          </div>
        );

      case 'send_whatsapp':
        return (
          <div className="space-y-3">
            <textarea
              placeholder="Текст сообщения (используйте {{client_name}}, {{client_phone}} и т.д.)"
              value={editingRule.action_config?.message || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, message: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={4}
            />
            <p className="text-xs text-gray-500">
              Доступные переменные: client_name, client_phone, client_email, manager_name
            </p>
          </div>
        );

      case 'send_email':
        return (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Email subject"
              value={editingRule.action_config?.subject || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, subject: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <textarea
              placeholder="Email body"
              value={editingRule.action_config?.body || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, body: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={4}
            />
          </div>
        );

      case 'change_status':
        return (
          <div>
            <select
              value={editingRule.action_config?.new_status || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, new_status: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select new status</option>
              <option value="lead">Lead</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        );

      case 'webhook':
        return (
          <div className="space-y-3">
            <input
              type="url"
              placeholder="Webhook URL"
              value={editingRule.action_config?.webhook_url || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, webhook_url: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <textarea
              placeholder="Custom payload (JSON)"
              value={editingRule.action_config?.payload ? JSON.stringify(editingRule.action_config.payload, null, 2) : '{}'}
              onChange={(e) => {
                try {
                  const payload = JSON.parse(e.target.value);
                  setEditingRule({
                    ...editingRule,
                    action_config: { ...editingRule.action_config, payload }
                  });
                } catch (err) {
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              rows={4}
            />
          </div>
        );

      case 'create_notification':
        return (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Notification title"
              value={editingRule.action_config?.title || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, title: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <textarea
              placeholder="Notification message"
              value={editingRule.action_config?.message || ''}
              onChange={(e) => setEditingRule({
                ...editingRule,
                action_config: { ...editingRule.action_config, message: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (isCreating || editingRule) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            {editingRule?.id ? 'Редактировать автоматизацию' : 'Создать новую автоматизацию'}
          </h3>
          <button
            onClick={() => {
              setIsCreating(false);
              setEditingRule(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            Отмена
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Название правила</label>
            <input
              type="text"
              value={editingRule?.name || ''}
              onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
              placeholder="Например: Отправить приветственное сообщение новым клиентам"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
            <input
              type="text"
              value={editingRule?.description || ''}
              onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
              placeholder="Опциональное описание"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                1
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Когда это происходит (Триггер)
                </label>
                <select
                  value={editingRule?.trigger_type || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, trigger_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  {TRIGGER_TYPES.map(trigger => (
                    <option key={trigger.value} value={trigger.value}>
                      {trigger.label} - {trigger.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                2
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выполнить это (Действие)
                </label>
                <select
                  value={editingRule?.action_type || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, action_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  {ACTION_TYPES.map(action => (
                    <option key={action.value} value={action.value}>
                      {action.icon} {action.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {renderActionConfig()}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Сохранить автоматизацию
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Правила автоматизации</h2>
          <p className="text-sm text-gray-500 mt-1">
            Автоматизируйте повторяющиеся задачи с помощью кастомных сценариев
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Создать правило
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Загрузка правил автоматизации...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Пока нет правил автоматизации</h3>
          <p className="text-gray-500 mb-6">
            Создайте первое правило, чтобы экономить время на повторяющихся задачах
          </p>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать первое правило
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map(rule => {
            const trigger = TRIGGER_TYPES.find(t => t.value === rule.trigger_type);
            const action = ACTION_TYPES.find(a => a.value === rule.action_type);

            return (
              <div
                key={rule.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{rule.name}</h3>
                    {rule.description && (
                      <p className="text-sm text-gray-500">{rule.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleRule(rule)}
                    className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${
                      rule.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {rule.is_active ? 'Активно' : 'Неактивно'}
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Когда:</span>
                    <span className="font-medium text-gray-900">{trigger?.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Тогда:</span>
                    <span className="font-medium text-gray-900">
                      {action?.icon} {action?.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>Выполнено: {rule.execution_count} раз</span>
                  {rule.last_executed_at && (
                    <span>Последнее: {new Date(rule.last_executed_at).toLocaleDateString('ru-RU')}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingRule(rule);
                      setIsCreating(true);
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
