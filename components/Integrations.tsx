import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, Activity, Zap, TrendingUp, MessageSquare } from 'lucide-react';
import { Integration, integrationService } from '../services/integrationService';
import { IntegrationCard } from './integrations/IntegrationCard';
import { IntegrationModal } from './integrations/IntegrationModal';
import { integrationCredentialService } from '../services/integrationCredentialService';
import { greenApiIntegrationService } from '../services/greenApiIntegrationService';

const INTEGRATION_TEMPLATES = [
  {
    integration_type: 'facebook_ads',
    name: 'Facebook Ads',
    description: 'Отслеживание рекламных кампаний и ROI',
    category: 'analytics',
  },
  {
    integration_type: 'google_ads',
    name: 'Google Ads',
    description: 'Мониторинг эффективности рекламы Google',
    category: 'analytics',
  },
  {
    integration_type: 'google_analytics',
    name: 'Google Analytics 4',
    description: 'Аналитика трафика и поведения пользователей',
    category: 'analytics',
  },
  {
    integration_type: 'tiktok_ads',
    name: 'TikTok Ads',
    description: 'Аналитика рекламных кампаний TikTok',
    category: 'analytics',
  },
  {
    integration_type: 'yandex_metrika',
    name: 'Яндекс.Метрика',
    description: 'Веб-аналитика от Яндекс',
    category: 'analytics',
  },
  {
    integration_type: 'yandex_direct',
    name: 'Яндекс.Директ',
    description: 'Рекламная платформа Яндекс',
    category: 'analytics',
  },
  {
    integration_type: 'green_api',
    name: 'Green API (WhatsApp)',
    description: 'Общение с клиентами через WhatsApp',
    category: 'communication',
  },
  {
    integration_type: 'wazzup',
    name: 'Wazzup24',
    description: 'Мультиканальная платформа для бизнеса',
    category: 'communication',
  },
  {
    integration_type: 'email',
    name: 'Email рассылки',
    description: 'Автоматические email-рассылки клиентам',
    category: 'communication',
  },
  {
    integration_type: 'telegram',
    name: 'Telegram Bot',
    description: 'Уведомления и команды через Telegram',
    category: 'communication',
  },
  {
    integration_type: 'creatium',
    name: 'Creatium Webhook',
    description: 'Получение лидов с сайтов через Creatium',
    category: 'crm_automation',
  },
  {
    integration_type: 'webhook',
    name: 'Вебхуки (Пользовательские)',
    description: 'Получение лидов с любых платформ',
    category: 'crm_automation',
  },
  {
    integration_type: 'livedune',
    name: 'Livedune',
    description: 'Аналитика Instagram аккаунтов',
    category: 'marketplace',
  },
  {
    integration_type: 'claude_api',
    name: 'Claude API (Anthropic)',
    description: 'ИИ-ассистент для автоматизации работы с клиентами',
    category: 'crm_automation',
  },
];

const CATEGORIES = [
  { id: 'all', name: 'Все интеграции', icon: Zap },
  { id: 'analytics', name: 'Аналитика', icon: TrendingUp },
  { id: 'communication', name: 'Коммуникации', icon: MessageSquare },
  { id: 'crm_automation', name: 'Автоматизация CRM', icon: Activity },
  { id: 'marketplace', name: 'Маркетплейсы', icon: Filter },
];

const Integrations: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadIntegrations();

    healthCheckInterval.current = setInterval(() => {
      checkActiveIntegrationsHealth();
    }, 5 * 60 * 1000);

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
      }
    };
  }, []);

  const checkActiveIntegrationsHealth = async () => {
    try {
      const activeIntegrations = integrations.filter(i => i.is_active);

      for (const integration of activeIntegrations) {
        if (integration.integration_type === 'green_api') {
          const credentials = await greenApiIntegrationService.getCredentials(integration.id);
          if (credentials) {
            const result = await greenApiIntegrationService.testConnection(credentials);

            if (!result.success && integration.status === 'active') {
              await integrationService.updateIntegration(integration.id, {
                status: 'error',
                error_message: result.message,
              });
              await loadIntegrations();
            } else if (result.success && integration.status === 'error') {
              await integrationService.updateIntegration(integration.id, {
                status: 'active',
                error_message: undefined,
              });
              await loadIntegrations();
            }
          }
        }
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const loadIntegrations = async () => {
    try {
      setIsLoading(true);
      const data = await integrationService.getAllIntegrations();
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddIntegration = async (template: typeof INTEGRATION_TEMPLATES[0]) => {
    try {
      const existing = integrations.find(i => i.integration_type === template.integration_type);
      if (existing) {
        setSelectedIntegration(existing);
        setIsModalOpen(true);
        return;
      }

      const newIntegration = await integrationService.createIntegration({
        integration_type: template.integration_type,
        name: template.name,
        description: template.description,
        category: template.category as any,
        status: 'needs_config',
        is_active: false,
        config: {},
      });

      setIntegrations([newIntegration, ...integrations]);
      setSelectedIntegration(newIntegration);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Failed to add integration:', error);
      alert('Failed to add integration');
    }
  };

  const handleDeleteIntegration = async (integration: Integration) => {
    const confirmDelete = window.confirm(
      `Вы уверены, что хотите удалить интеграцию "${integration.name}"?\n\nВсе учетные данные и история синхронизации будут удалены. Это действие необратимо.`
    );
    if (!confirmDelete) return;

    try {
      await integrationService.deleteIntegration(integration.id);
      setIntegrations(integrations.filter(i => i.id !== integration.id));
    } catch (error) {
      console.error('Failed to delete integration:', error);
      alert('Не удалось удалить интеграцию');
    }
  };

  const handleToggleIntegration = async (integration: Integration) => {
    try {
      if (integration.is_active) {
        const confirmDeactivate = window.confirm(
          `Вы уверены, что хотите отключить интеграцию "${integration.name}"?`
        );
        if (!confirmDeactivate) return;

        await integrationService.deactivateIntegration(integration.id);
        await loadIntegrations();
      } else {
        const requiredFields = getRequiredFieldsForIntegration(integration.integration_type);
        const hasCredentials = await integrationCredentialService.hasCredentials(
          integration.id,
          requiredFields
        );

        if (!hasCredentials) {
          alert(
            'Сначала необходимо настроить учетные данные для этой интеграции. Нажмите "Настроить" для ввода данных.'
          );
          setSelectedIntegration(integration);
          setIsModalOpen(true);
          return;
        }

        if (integration.integration_type === 'green_api') {
          const credentials = await greenApiIntegrationService.getCredentials(integration.id);
          if (!credentials) {
            alert('Не удалось загрузить учетные данные. Пожалуйста, настройте интеграцию заново.');
            return;
          }

          const testResult = await greenApiIntegrationService.testConnection(credentials);

          if (!testResult.success) {
            const proceedAnyway = window.confirm(
              `Проверка подключения не удалась: ${testResult.message}\n\nВсе равно активировать интеграцию?`
            );
            if (!proceedAnyway) return;
          }

          await integrationService.updateIntegration(integration.id, {
            status: testResult.success ? 'active' : 'needs_config',
            is_active: true,
            error_message: testResult.success ? undefined : testResult.message,
          });
        } else {
          await integrationService.activateIntegration(integration.id);
        }

        await loadIntegrations();
      }
    } catch (error) {
      console.error('Failed to toggle integration:', error);
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Не удалось изменить статус интеграции'}`);
    }
  };

  const getRequiredFieldsForIntegration = (type: string): string[] => {
    switch (type) {
      case 'green_api':
        return ['id_instance', 'api_token_instance'];
      case 'wazzup':
        return ['api_token', 'channel_id'];
      case 'facebook_ads':
        return ['access_token', 'ad_account_id'];
      case 'google_ads':
        return ['client_id', 'client_secret', 'refresh_token', 'customer_id'];
      case 'google_analytics':
        return ['property_id', 'service_account_json'];
      case 'livedune':
        return ['access_token'];
      case 'tiktok_ads':
        return ['access_token', 'advertiser_id'];
      case 'yandex_metrika':
        return ['counter_id', 'oauth_token'];
      case 'yandex_direct':
        return ['client_login', 'oauth_token'];
      case 'claude_api':
        return ['api_key'];
      case 'telegram':
        return ['bot_token'];
      case 'email':
        return ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'from_email'];
      case 'creatium':
      case 'webhook':
        return [];
      default:
        return [];
    }
  };

  const getAvailableTemplates = () => {
    const existingTypes = new Set(integrations.map(i => i.integration_type));
    return INTEGRATION_TEMPLATES.filter(t => {
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return !existingTypes.has(t.integration_type);
    });
  };

  const getFilteredIntegrations = () => {
    return integrations.filter(integration => {
      if (selectedCategory !== 'all' && integration.category !== selectedCategory) {
        return false;
      }

      if (statusFilter !== 'all' && integration.status !== statusFilter) {
        return false;
      }

      if (searchQuery && !integration.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      return true;
    });
  };

  const stats = {
    total: integrations.length,
    active: integrations.filter(i => i.is_active).length,
    errors: integrations.filter(i => i.status === 'error').length,
    needsConfig: integrations.filter(i => i.status === 'needs_config').length,
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Центр интеграций</h2>
          <p className="text-sm text-gray-500 mt-1">
            Подключайте внешние сервисы и платформы аналитики к вашей CRM
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
            <span className="text-gray-500">Всего:</span>
            <span className="ml-2 font-semibold text-gray-900">{stats.total}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
            <span className="text-gray-500">Активных:</span>
            <span className="ml-2 font-semibold text-green-600">{stats.active}</span>
          </div>
          {stats.errors > 0 && (
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
              <span className="text-gray-500">Ошибок:</span>
              <span className="ml-2 font-semibold text-red-600">{stats.errors}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Поиск интеграций..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
          <option value="error">Ошибки</option>
          <option value="needs_config">Требует настройки</option>
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map(category => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {category.name}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Загрузка интеграций...</p>
        </div>
      ) : (
        <>
          {getFilteredIntegrations().length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Подключенные интеграции</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredIntegrations().map(integration => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onConfigure={(int) => {
                      setSelectedIntegration(int);
                      setIsModalOpen(true);
                    }}
                    onToggle={handleToggleIntegration}
                    onDelete={handleDeleteIntegration}
                  />
                ))}
              </div>
            </div>
          )}

          {getAvailableTemplates().length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Доступные интеграции</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getAvailableTemplates().map(template => (
                  <button
                    key={template.integration_type}
                    onClick={() => handleAddIntegration(template)}
                    className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{template.name}</h4>
                        <p className="text-xs text-gray-500">{template.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {getFilteredIntegrations().length === 0 && getAvailableTemplates().length === 0 && (
            <div className="text-center py-12">
              <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Интеграции не найдены</h3>
              <p className="text-gray-500">
                Попробуйте изменить фильтры или добавьте новую интеграцию
              </p>
            </div>
          )}
        </>
      )}

      <IntegrationModal
        integration={selectedIntegration}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedIntegration(null);
        }}
        onSave={() => {
          loadIntegrations();
        }}
      />
    </div>
  );
};

export default Integrations;
