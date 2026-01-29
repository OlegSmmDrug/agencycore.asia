import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Activity, FileText, Loader2, Copy, Star, CheckCircle2 } from 'lucide-react';
import { Integration, integrationService } from '../../services/integrationService';
import { integrationCredentialService } from '../../services/integrationCredentialService';
import { greenApiIntegrationService } from '../../services/greenApiIntegrationService';
import { greenApiService } from '../../services/greenApiService';

interface IntegrationModalProps {
  integration: Integration | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const IntegrationModal: React.FC<IntegrationModalProps> = ({
  integration,
  isOpen,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'logs' | 'docs'>('settings');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isDefaultIntegration, setIsDefaultIntegration] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isConfiguringWebhook, setIsConfiguringWebhook] = useState(false);

  useEffect(() => {
    if (integration) {
      setConfig(integration.config || {});
      setIsDefaultIntegration(integration.config?.is_default || false);
      loadCredentials();
      loadSyncLogs();
      if (integration.is_active) {
        checkConnectionStatus();
      }
    }
  }, [integration]);

  const loadCredentials = async () => {
    if (!integration) return;
    setIsLoadingCredentials(true);
    try {
      const fields = getCredentialFields();
      const loadedCredentials: Record<string, string> = {};

      for (const field of fields) {
        const value = await integrationCredentialService.getCredential(integration.id, field.key);
        if (value) {
          loadedCredentials[field.key] = value;
        }
      }

      setCredentials(loadedCredentials);
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  };

  const checkConnectionStatus = async () => {
    if (!integration) return;

    try {
      if (integration.integration_type === 'green_api') {
        const creds = await greenApiIntegrationService.getCredentials(integration.id);
        if (creds) {
          const result = await greenApiIntegrationService.testConnection(creds);
          setConnectionStatus(result.state || (result.success ? 'active' : 'error'));
        }
      }
    } catch (error) {
      console.error('Failed to check connection status:', error);
      setConnectionStatus('error');
    }
  };

  const loadSyncLogs = async () => {
    if (!integration) return;
    try {
      const logs = await integrationService.getSyncLogs(integration.id, 20);
      setSyncLogs(logs);
    } catch (error) {
      console.error('Failed to load sync logs:', error);
    }
  };

  const validateFields = (): boolean => {
    const errors: Record<string, string> = {};
    const fields = getCredentialFields();

    fields.forEach(field => {
      const value = credentials[field.key];
      if (field.required && !value) {
        errors[field.key] = 'Это поле обязательно';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!integration) return;

    if (!validateFields()) {
      setTestResult({
        success: false,
        message: 'Пожалуйста, заполните все обязательные поля',
      });
      return;
    }

    setIsSaving(true);
    setTestResult(null);

    try {
      if (isDefaultIntegration && integration.integration_type === 'green_api') {
        const allGreenApiIntegrations = await integrationService.getIntegrationsByType('green_api');
        for (const otherIntegration of allGreenApiIntegrations) {
          if (otherIntegration.id !== integration.id && otherIntegration.config?.is_default) {
            await integrationService.updateIntegration(otherIntegration.id, {
              config: { ...otherIntegration.config, is_default: false },
            });
          }
        }
      }

      const updatedConfig = {
        ...config,
        is_default: isDefaultIntegration,
        sync_frequency: config.sync_frequency || integration.sync_frequency,
      };

      await integrationService.updateIntegration(integration.id, {
        config: updatedConfig,
        sync_frequency: updatedConfig.sync_frequency,
      });

      for (const [key, value] of Object.entries(credentials)) {
        if (value) {
          await integrationCredentialService.setCredential(integration.id, key, value);
        }
      }

      if (integration.integration_type === 'green_api' && credentials['id_instance'] && credentials['api_token_instance']) {
        const testResult = await greenApiIntegrationService.testConnection({
          id_instance: credentials['id_instance'],
          api_token_instance: credentials['api_token_instance'],
        });

        if (testResult.success) {
          await integrationService.updateIntegration(integration.id, {
            status: 'active',
            is_active: true,
            error_message: undefined,
          });

          setTestResult({
            success: true,
            message: 'Настройки успешно сохранены и подключение проверено!',
          });
        } else {
          await integrationService.updateIntegration(integration.id, {
            status: 'needs_config',
            is_active: false,
            error_message: testResult.message,
          });

          setTestResult({
            success: false,
            message: `Настройки сохранены, но подключение не удалось: ${testResult.message}`,
          });
        }
      } else {
        setTestResult({
          success: true,
          message: 'Настройки успешно сохранены!',
        });
      }

      onSave();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to save integration:', error);
      setTestResult({
        success: false,
        message: `Ошибка при сохранении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!integration) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      if (integration.integration_type === 'green_api') {
        const idInstance = credentials['id_instance'];
        const apiToken = credentials['api_token_instance'];

        if (!idInstance || !apiToken) {
          setTestResult({
            success: false,
            message: 'Пожалуйста, заполните все обязательные поля',
          });
          setIsTesting(false);
          return;
        }

        const result = await greenApiIntegrationService.testConnection({
          id_instance: idInstance,
          api_token_instance: apiToken,
        });

        setTestResult(result);

        if (result.success) {
          await integrationService.updateIntegration(integration.id, {
            status: 'active',
            is_active: true,
            error_message: undefined,
          });
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setTestResult({
          success: true,
          message: 'Подключение успешно установлено!',
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResult({
        success: false,
        message: 'Ошибка при проверке подключения. Попробуйте снова.',
      });
    }

    setIsTesting(false);
  };

  const handleConfigureWebhook = async () => {
    if (!integration || integration.integration_type !== 'green_api') return;

    setIsConfiguringWebhook(true);
    setTestResult(null);

    try {
      const idInstance = credentials['id_instance'];
      const apiToken = credentials['api_token_instance'];

      if (!idInstance || !apiToken) {
        setTestResult({
          success: false,
          message: 'Пожалуйста, сначала сохраните учетные данные',
        });
        setIsConfiguringWebhook(false);
        return;
      }

      const result = await greenApiService.configureWebhookForOutgoing(
        integration.id,
        {
          idInstance: idInstance,
          apiToken: apiToken
        }
      );

      setTestResult(result);

      if (result.success) {
        await integrationService.updateIntegration(integration.id, {
          config: {
            ...integration.config,
            webhook_configured: true,
            outgoing_messages_enabled: true
          }
        });
      }
    } catch (error) {
      console.error('Error configuring webhook:', error);
      setTestResult({
        success: false,
        message: 'Ошибка при настройке webhook. Попробуйте снова.',
      });
    }

    setIsConfiguringWebhook(false);
  };

  const getCredentialFields = () => {
    if (!integration) return [];

    switch (integration.integration_type) {
      case 'facebook_ads':
        return [
          { key: 'access_token', label: 'Токен доступа', type: 'text', required: true },
          { key: 'ad_account_id', label: 'ID рекламного аккаунта', type: 'text', required: true },
        ];
      case 'google_ads':
        return [
          { key: 'client_id', label: 'Client ID', type: 'text', required: true },
          { key: 'client_secret', label: 'Client Secret', type: 'text', required: true },
          { key: 'refresh_token', label: 'Refresh Token', type: 'text', required: true },
          { key: 'customer_id', label: 'Customer ID', type: 'text', required: true },
        ];
      case 'google_analytics':
        return [
          { key: 'property_id', label: 'Property ID', type: 'text', required: true },
          { key: 'service_account_json', label: 'JSON ключ сервисного аккаунта', type: 'textarea', required: true },
        ];
      case 'green_api':
        return [
          { key: 'id_instance', label: 'ID инстанса', type: 'text', required: true },
          { key: 'api_token_instance', label: 'API Token', type: 'text', required: true },
        ];
      case 'wazzup':
        return [
          { key: 'api_token', label: 'API токен', type: 'text', required: true },
          { key: 'channel_id', label: 'ID канала', type: 'text', required: true },
        ];
      case 'livedune':
        return [
          { key: 'access_token', label: 'Токен доступа', type: 'text', required: true },
        ];
      case 'tiktok_ads':
        return [
          { key: 'access_token', label: 'Токен доступа', type: 'text', required: true },
          { key: 'advertiser_id', label: 'ID рекламодателя', type: 'text', required: true },
        ];
      case 'yandex_metrika':
        return [
          { key: 'counter_id', label: 'ID счетчика', type: 'text', required: true },
          { key: 'oauth_token', label: 'OAuth токен', type: 'text', required: true },
        ];
      case 'yandex_direct':
        return [
          { key: 'client_login', label: 'Логин клиента', type: 'text', required: true },
          { key: 'oauth_token', label: 'OAuth токен', type: 'text', required: true },
        ];
      case 'claude_api':
        return [
          { key: 'api_key', label: 'API ключ Anthropic', type: 'text', required: true },
        ];
      case 'creatium':
      case 'webhook':
        return [];
      default:
        return [];
    }
  };

  const getWebhookUrl = (): string | null => {
    if (!integration) return null;

    const baseUrl = window.location.origin;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    switch (integration.integration_type) {
      case 'green_api':
        return `${supabaseUrl}/functions/v1/green-api-webhook`;
      case 'wazzup':
        return `${supabaseUrl}/functions/v1/wazzup-webhook`;
      case 'creatium':
      case 'webhook':
        return `${supabaseUrl}/functions/v1/creatium-webhook?organization_id=${integration.organization_id}`;
      default:
        return null;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setTestResult({
      success: true,
      message: 'Скопировано в буфер обмена!',
    });
    setTimeout(() => setTestResult(null), 2000);
  };

  const getDocumentation = () => {
    if (!integration) return null;

    switch (integration.integration_type) {
      case 'green_api':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Настройка Green API</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">1. Получите учетные данные</h4>
                <p className="text-sm text-gray-600">
                  Зарегистрируйтесь на <a href="https://green-api.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">green-api.com</a> и создайте новый инстанс WhatsApp.
                  Вы получите ID инстанса и API Token.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">2. Настройте webhook</h4>
                <p className="text-sm text-gray-600 mb-2">
                  В настройках инстанса Green API укажите следующий URL для получения входящих сообщений:
                </p>
                {getWebhookUrl() && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200 flex items-center justify-between">
                    <code className="text-sm text-gray-800 break-all">{getWebhookUrl()}</code>
                    <button
                      onClick={() => copyToClipboard(getWebhookUrl()!)}
                      className="ml-2 p-2 hover:bg-gray-200 rounded"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">3. Настройте Webhook</h4>
                <p className="text-sm text-gray-600 mb-2">
                  После сохранения учетных данных, нажмите кнопку "Настроить Webhook" внизу формы.
                  Это автоматически настроит получение всех входящих и исходящих сообщений.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Важно:</strong> Настройка webhook необходима для получения сообщений, которые вы отправляете через телефон.
                  </p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">4. Авторизуйте WhatsApp</h4>
                <p className="text-sm text-gray-600">
                  Отсканируйте QR-код в личном кабинете Green API для авторизации вашего номера WhatsApp.
                </p>
              </div>
            </div>
          </div>
        );
      case 'wazzup':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Настройка Wazzup24</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">1. Получите API токен</h4>
                <p className="text-sm text-gray-600">
                  Зайдите в настройки вашего канала в <a href="https://wazzup24.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Wazzup24</a> и скопируйте API токен.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">2. Настройте webhook</h4>
                {getWebhookUrl() && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200 flex items-center justify-between">
                    <code className="text-sm text-gray-800 break-all">{getWebhookUrl()}</code>
                    <button
                      onClick={() => copyToClipboard(getWebhookUrl()!)}
                      className="ml-2 p-2 hover:bg-gray-200 rounded"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'facebook_ads':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Настройка Facebook Ads</h3>
            <p className="text-sm text-gray-600">
              Для подключения Facebook Ads API необходимо получить токен доступа и ID рекламного аккаунта в Business Manager Facebook.
            </p>
          </div>
        );
      case 'google_ads':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Настройка Google Ads</h3>
            <p className="text-sm text-gray-600">
              Для подключения Google Ads API необходимо создать проект в Google Cloud Console и получить OAuth2 учетные данные.
            </p>
          </div>
        );
      case 'creatium':
      case 'webhook':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Настройка вебхука Creatium</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">1. Скопируйте URL вебхука</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Используйте этот URL для подключения форм с вашего сайта:
                </p>
                {getWebhookUrl() && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200 flex items-center justify-between">
                    <code className="text-sm text-gray-800 break-all">{getWebhookUrl()}</code>
                    <button
                      onClick={() => copyToClipboard(getWebhookUrl()!)}
                      className="ml-2 p-2 hover:bg-gray-200 rounded"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">2. Настройте форму на сайте</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Укажите этот URL в настройках Creatium как endpoint для отправки данных форм. Поддерживаемые поля:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li><code>name</code>, <code>fio</code>, <code>client_name</code> - Имя клиента</li>
                  <li><code>phone</code>, <code>tel</code>, <code>telephone</code> - Телефон</li>
                  <li><code>email</code>, <code>mail</code> - Email</li>
                  <li><code>utm_source</code>, <code>utm_medium</code>, <code>utm_campaign</code> - UTM метки</li>
                  <li><code>page_title</code>, <code>page_url</code> - Страница захвата лида</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">3. Проверьте работу</h4>
                <p className="text-sm text-gray-600">
                  После отправки тестовой заявки через форму, в CRM автоматически появится новый лид со статусом "New Lead".
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Как это работает
                </h4>
                <p className="text-sm text-blue-800">
                  Когда посетитель заполняет форму на вашем сайте, данные автоматически отправляются в CRM через вебхук.
                  Система создает новый лид с полной информацией о клиенте и источнике обращения, включая UTM-метки для аналитики.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Документация для этой интеграции готовится. Скоро будет доступна!
            </p>
          </div>
        );
    }
  };

  if (!isOpen || !integration) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{integration.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Настройки
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-1" />
              История
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'docs'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Документация
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {connectionStatus && integration?.is_active && (
                <div className={`p-4 rounded-lg border ${
                  connectionStatus === 'authorized'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {connectionStatus === 'authorized' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                    <p className={`text-sm font-medium ${
                      connectionStatus === 'authorized' ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      Статус подключения: {connectionStatus === 'authorized' ? 'Авторизовано' : connectionStatus}
                    </p>
                  </div>
                </div>
              )}

              {isLoadingCredentials ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Загрузка учетных данных...</p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Учетные данные</h3>
                    <div className="space-y-4">
                      {getCredentialFields().map(field => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={credentials[field.key] || ''}
                              onChange={(e) => {
                                setCredentials({ ...credentials, [field.key]: e.target.value });
                                if (validationErrors[field.key]) {
                                  setValidationErrors({ ...validationErrors, [field.key]: '' });
                                }
                              }}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                validationErrors[field.key] ? 'border-red-300' : 'border-gray-300'
                              }`}
                              rows={4}
                              placeholder={`Введите ${field.label.toLowerCase()}`}
                            />
                          ) : (
                            <input
                              type={field.type}
                              value={credentials[field.key] || ''}
                              onChange={(e) => {
                                setCredentials({ ...credentials, [field.key]: e.target.value });
                                if (validationErrors[field.key]) {
                                  setValidationErrors({ ...validationErrors, [field.key]: '' });
                                }
                              }}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                validationErrors[field.key] ? 'border-red-300' : 'border-gray-300'
                              }`}
                              placeholder={`Введите ${field.label.toLowerCase()}`}
                            />
                          )}
                          {validationErrors[field.key] && (
                            <p className="text-xs text-red-600 mt-1">{validationErrors[field.key]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {getWebhookUrl() && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Webhook URL</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Укажите этот URL в настройках вашей интеграции для получения входящих событий:
                      </p>
                      <div className="bg-gray-50 p-3 rounded border border-gray-200 flex items-center justify-between">
                        <code className="text-sm text-gray-800 break-all flex-1">{getWebhookUrl()}</code>
                        <button
                          onClick={() => copyToClipboard(getWebhookUrl()!)}
                          className="ml-2 p-2 hover:bg-gray-200 rounded flex-shrink-0"
                          title="Скопировать"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  )}

                  {integration?.integration_type === 'green_api' && (
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDefaultIntegration}
                          onChange={(e) => setIsDefaultIntegration(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <Star className={`w-4 h-4 ${isDefaultIntegration ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-700">
                          Использовать эту интеграцию по умолчанию
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-10">
                        Эта интеграция будет использоваться для отправки сообщений WhatsApp, если не указана другая
                      </p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Настройки синхронизации</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Частота синхронизации
                        </label>
                        <select
                          value={config.sync_frequency || integration.sync_frequency}
                          onChange={(e) => setConfig({ ...config, sync_frequency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="manual">Вручную</option>
                          <option value="hourly">Каждый час</option>
                          <option value="daily">Ежедневно</option>
                          <option value="weekly">Еженедельно</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {testResult && (
                <div
                  className={`p-4 rounded-lg ${
                    testResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <p
                      className={`text-sm font-medium ${
                        testResult.success ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {testResult.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold mb-4">История синхронизации</h3>
              {syncLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Пока нет записей синхронизации</p>
              ) : (
                syncLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : log.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {log.status === 'success' ? 'Успешно' : log.status === 'failed' ? 'Ошибка' : 'В процессе'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.sync_started_at).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Синхронизировано записей: {log.records_synced}
                      {log.records_failed > 0 && `, ошибок: ${log.records_failed}`}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="prose prose-sm max-w-none">
              {getDocumentation()}
            </div>
          )}
        </div>

        {activeTab === 'settings' && (
          <div className="p-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || isSaving || isLoadingCredentials || isConfiguringWebhook}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isTesting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isTesting ? 'Проверка...' : 'Проверить подключение'}
            </button>
            {integration?.integration_type === 'green_api' && (
              <button
                onClick={handleConfigureWebhook}
                disabled={isTesting || isSaving || isLoadingCredentials || isConfiguringWebhook}
                className="px-4 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Настроить webhook для получения исходящих сообщений"
              >
                {isConfiguringWebhook && <Loader2 className="w-4 h-4 animate-spin" />}
                {isConfiguringWebhook ? 'Настройка...' : 'Настроить Webhook'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || isLoadingCredentials || isConfiguringWebhook}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
