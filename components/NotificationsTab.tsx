import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Send,
  Link2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  ClipboardList,
  Clock,
  AlertTriangle,
  UserPlus,
  Activity,
  Copy,
  Key,
  ShieldCheck,
} from 'lucide-react';
import {
  telegramNotificationService,
  TelegramLink,
  NotificationPreferences,
} from '../services/telegramNotificationService';

interface NotificationsTabProps {
  userId: string;
  userEmail: string;
  organizationId: string;
}

const BOT_USERNAME = 'agencycore_bot';

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  userId,
  userEmail,
  organizationId,
}) => {
  const [links, setLinks] = useState<TelegramLink[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [linkedAccounts, preferences] = await Promise.all([
        telegramNotificationService.getLinkedAccounts(userId),
        telegramNotificationService.getPreferences(userId),
      ]);
      setLinks(linkedAccounts);
      setPrefs(preferences);
    } catch (error) {
      console.error('Error loading notification data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateCode = async () => {
    try {
      setGeneratingCode(true);
      const code = await telegramNotificationService.generateLinkCode(userId, organizationId);
      setLinkCode(code);
      setCodeCopied(false);
    } catch (error) {
      console.error('Error generating link code:', error);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCommand = async () => {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(`/link ${linkCode}`);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 3000);
    } catch {
      const el = document.createElement('textarea');
      el.value = `/link ${linkCode}`;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 3000);
    }
  };

  const handleTogglePref = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      setSavingPrefs(true);
      await telegramNotificationService.savePreferences(userId, organizationId, {
        [key]: value,
      });
      setPrefs(prev =>
        prev ? { ...prev, [key]: value } : null
      );
    } catch (error) {
      console.error('Error saving preference:', error);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleToggleLink = async (linkId: string, isActive: boolean) => {
    try {
      await telegramNotificationService.toggleLinkActive(linkId, isActive);
      setLinks(prev =>
        prev.map(l => (l.id === linkId ? { ...l, isActive } : l))
      );
    } catch (error) {
      console.error('Error toggling link:', error);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!confirm('Отвязать этот Telegram-аккаунт? Уведомления перестанут приходить.')) return;
    try {
      await telegramNotificationService.removeLink(linkId);
      setLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (error) {
      console.error('Error removing link:', error);
    }
  };

  const handleTestNotification = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const result = await telegramNotificationService.sendNotification(
        userId,
        'Тестовое уведомление',
        'Если вы видите это сообщение, уведомления в Telegram работают корректно.',
        'test'
      );
      if (result.sent) {
        setTestResult({ success: true, message: 'Уведомление отправлено в Telegram!' });
      } else {
        const reasons: Record<string, string> = {
          no_linked_accounts: 'Нет привязанных Telegram-аккаунтов',
          telegram_disabled: 'Telegram-уведомления отключены',
          notification_type_disabled: 'Этот тип уведомлений отключен',
          fetch_error: 'Ошибка сети при отправке',
          edge_function_error: 'Ошибка сервера',
          telegram_api_error: 'Ошибка Telegram API',
        };
        const errorDetail = (result as any).error ? `: ${(result as any).error}` : '';
        setTestResult({
          success: false,
          message: (reasons[result.reason || ''] || 'Не удалось отправить уведомление') + errorDetail,
        });
      }
    } catch (e) {
      setTestResult({ success: false, message: `Ошибка при отправке: ${e instanceof Error ? e.message : 'Неизвестная ошибка'}` });
    } finally {
      setTestSending(false);
      setTimeout(() => setTestResult(null), 8000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-slate-500">Загрузка настроек...</span>
      </div>
    );
  }

  const hasLinkedAccounts = links.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Send className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Telegram-уведомления</h2>
            <p className="text-sm text-slate-500">
              Получайте уведомления о задачах и событиях прямо в Telegram
            </p>
          </div>
        </div>

        {!hasLinkedAccounts ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-medium text-slate-700 mb-2">
              Telegram не подключен
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Привяжите свой Telegram-аккаунт, чтобы получать мгновенные уведомления о новых задачах, дедлайнах и важных событиях.
            </p>

            <div className="bg-slate-50 rounded-lg p-5 text-left max-w-lg mx-auto mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <h4 className="text-sm font-semibold text-slate-700">Безопасная привязка по коду</h4>
              </div>
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Нажмите <b>«Получить код привязки»</b> ниже</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</span>
                  <span>
                    Откройте бота{' '}
                    <a
                      href={`https://t.me/${BOT_USERNAME}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      @{BOT_USERNAME}
                    </a>{' '}
                    в Telegram и нажмите <b>Start</b>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">3</span>
                  <span>Отправьте боту команду <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">/link ВАШ_КОД</code></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">4</span>
                  <span>Вернитесь сюда и нажмите <b>«Обновить»</b></span>
                </li>
              </ol>
            </div>

            {linkCode ? (
              <div className="max-w-lg mx-auto mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-600 mb-2 font-medium">Ваш код привязки (действителен 10 минут):</p>
                  <div className="flex items-center justify-center gap-3">
                    <code className="text-2xl font-bold tracking-[0.3em] text-blue-800 bg-white px-4 py-2 rounded-lg border border-blue-200">
                      {linkCode}
                    </code>
                  </div>
                  <p className="text-xs text-blue-500 mt-3 mb-2">Отправьте боту команду:</p>
                  <div className="flex items-center gap-2 justify-center">
                    <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-blue-200 text-blue-800">
                      /link {linkCode}
                    </code>
                    <button
                      onClick={handleCopyCommand}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Скопировать команду"
                    >
                      {codeCopied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {codeCopied && (
                    <p className="text-xs text-green-600 mt-1 text-center">Скопировано!</p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
              >
                {generatingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                {linkCode ? 'Получить новый код' : 'Получить код привязки'}
              </button>
              <a
                href={`https://t.me/${BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Открыть @{BOT_USERNAME}
              </a>
              <button
                onClick={loadData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Обновить
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Подключенные аккаунты</h3>
              <button
                onClick={loadData}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Обновить
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {links.map((link, index) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <Send className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {link.telegramFirstName || `Аккаунт ${index + 1}`}
                        </span>
                        {link.telegramUsername && (
                          <span className="text-xs text-slate-400">
                            @{link.telegramUsername}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        Привязан {new Date(link.linkedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleLink(link.id, !link.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        link.isActive ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          link.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleRemoveLink(link.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Отвязать аккаунт"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {generatingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Добавить ещё один Telegram-аккаунт
              </button>
              {linkCode && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-600 mb-1">Отправьте боту @{BOT_USERNAME}:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                      /link {linkCode}
                    </code>
                    <button
                      onClick={handleCopyCommand}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    >
                      {codeCopied ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {hasLinkedAccounts && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Bell className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Типы уведомлений</h2>
                <p className="text-sm text-slate-500">
                  Выберите, о чем вы хотите получать уведомления в Telegram
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <NotificationToggle
                icon={<Bell className="w-4 h-4" />}
                label="Уведомления в Telegram"
                description="Главный переключатель. Отключите, чтобы остановить все Telegram-уведомления"
                checked={prefs?.telegramEnabled ?? true}
                onChange={(v) => handleTogglePref('telegramEnabled', v)}
                disabled={savingPrefs}
                isMaster
              />

              {(prefs?.telegramEnabled ?? true) && (
                <div className="ml-4 border-l-2 border-slate-100 pl-4 space-y-1 mt-2">
                  <NotificationToggle
                    icon={<ClipboardList className="w-4 h-4" />}
                    label="Новые задачи"
                    description="Когда вам назначена новая задача или задача переназначена"
                    checked={prefs?.notifyNewTask ?? true}
                    onChange={(v) => handleTogglePref('notifyNewTask', v)}
                    disabled={savingPrefs}
                  />
                  <NotificationToggle
                    icon={<Activity className="w-4 h-4" />}
                    label="Изменение статуса задач"
                    description="Когда задача переходит в другой статус"
                    checked={prefs?.notifyTaskStatus ?? true}
                    onChange={(v) => handleTogglePref('notifyTaskStatus', v)}
                    disabled={savingPrefs}
                  />
                  <NotificationToggle
                    icon={<Clock className="w-4 h-4" />}
                    label="Приближение дедлайна"
                    description="Напоминание, когда до дедлайна остается мало времени"
                    checked={prefs?.notifyDeadline ?? true}
                    onChange={(v) => handleTogglePref('notifyDeadline', v)}
                    disabled={savingPrefs}
                  />
                  <NotificationToggle
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label="Просроченные задачи"
                    description="Когда задача просрочена"
                    checked={prefs?.notifyTaskOverdue ?? true}
                    onChange={(v) => handleTogglePref('notifyTaskOverdue', v)}
                    disabled={savingPrefs}
                  />
                  <NotificationToggle
                    icon={<UserPlus className="w-4 h-4" />}
                    label="Новые клиенты"
                    description="Когда в системе появляется новый клиент"
                    checked={prefs?.notifyNewClient ?? true}
                    onChange={(v) => handleTogglePref('notifyNewClient', v)}
                    disabled={savingPrefs}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Проверка уведомлений</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Отправить тестовое уведомление в Telegram для проверки
                </p>
              </div>
              <button
                onClick={handleTestNotification}
                disabled={testSending}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {testSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {testSending ? 'Отправка...' : 'Отправить тест'}
              </button>
            </div>
            {testResult && (
              <div
                className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
                  testResult.success
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {testResult.message}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface NotificationToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  isMaster?: boolean;
}

const NotificationToggle: React.FC<NotificationToggleProps> = ({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
  isMaster,
}) => (
  <div
    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
      isMaster ? 'bg-slate-50' : 'hover:bg-slate-50'
    }`}
  >
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          checked ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {icon}
      </div>
      <div>
        <span className={`text-sm font-medium ${isMaster ? 'text-slate-800' : 'text-slate-700'}`}>
          {label}
        </span>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export default NotificationsTab;
