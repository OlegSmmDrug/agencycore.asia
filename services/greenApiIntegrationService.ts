import { integrationService, Integration } from './integrationService';
import { integrationCredentialService } from './integrationCredentialService';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface GreenApiCredentials {
  id_instance: string;
  api_token_instance: string;
}

export interface GreenApiInstance {
  integration: Integration;
  credentials: GreenApiCredentials;
}

interface StateResponse {
  stateInstance: 'authorized' | 'notAuthorized' | 'blocked' | 'sleepMode' | 'starting';
}

const API_URL = import.meta.env.VITE_GREEN_API_URL || 'https://api.green-api.com';

export const greenApiIntegrationService = {
  async getActiveIntegration(): Promise<Integration | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return null;

    const integrations = await integrationService.getIntegrationsByType('green_api');
    const activeIntegrations = integrations.filter(i => i.is_active && i.status === 'active');

    return activeIntegrations.length > 0 ? activeIntegrations[0] : null;
  },

  async getAllActiveIntegrations(): Promise<Integration[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const integrations = await integrationService.getIntegrationsByType('green_api');
    return integrations.filter(i => i.is_active && i.status === 'active');
  },

  async getAllIntegrations(): Promise<Integration[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    return await integrationService.getIntegrationsByType('green_api');
  },

  async getCredentials(integrationId: string): Promise<GreenApiCredentials | null> {
    try {
      const idInstance = await integrationCredentialService.getCredential(integrationId, 'id_instance');
      const apiToken = await integrationCredentialService.getCredential(integrationId, 'api_token_instance');

      if (!idInstance || !apiToken) {
        return null;
      }

      return {
        id_instance: idInstance,
        api_token_instance: apiToken,
      };
    } catch (error) {
      console.error('Error getting Green API credentials:', error);
      return null;
    }
  },

  async testConnection(credentials: GreenApiCredentials): Promise<{ success: boolean; message: string; state?: string }> {
    const startTime = Date.now();

    try {
      const response = await fetch(
        `${API_URL}/waInstance${credentials.id_instance}/getStateInstance/${credentials.api_token_instance}`,
        { method: 'GET' }
      );

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        console.error(`Green API connection test failed: ${response.status}, response time: ${responseTime}ms`);

        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            message: 'Неверный токен доступа или ID инстанса',
          };
        }
        return {
          success: false,
          message: `Ошибка подключения: ${response.status}`,
        };
      }

      const data: StateResponse = await response.json();

      console.log(`Green API connection test completed: state=${data.stateInstance}, response time: ${responseTime}ms`);

      switch (data.stateInstance) {
        case 'authorized':
          return {
            success: true,
            message: 'Подключение успешно! WhatsApp авторизован.',
            state: 'authorized',
          };
        case 'notAuthorized':
          return {
            success: false,
            message: 'WhatsApp не авторизован. Отсканируйте QR-код.',
            state: 'notAuthorized',
          };
        case 'blocked':
          return {
            success: false,
            message: 'Инстанс заблокирован. Обратитесь в поддержку Green API.',
            state: 'blocked',
          };
        case 'sleepMode':
          return {
            success: false,
            message: 'Инстанс в спящем режиме. Активируйте его.',
            state: 'sleepMode',
          };
        case 'starting':
          return {
            success: false,
            message: 'Инстанс запускается. Подождите несколько секунд.',
            state: 'starting',
          };
        default:
          return {
            success: false,
            message: `Неизвестное состояние: ${data.stateInstance}`,
          };
      }
    } catch (error) {
      console.error('Error testing Green API connection:', error);
      return {
        success: false,
        message: 'Ошибка при проверке подключения. Проверьте сетевое соединение.',
      };
    }
  },

  async testConnectionById(integrationId: string): Promise<{ success: boolean; message: string; state?: string }> {
    const credentials = await this.getCredentials(integrationId);
    if (!credentials) {
      return {
        success: false,
        message: 'Credentials не найдены для этой интеграции',
      };
    }

    return await this.testConnection(credentials);
  },

  async createApiInstance(integrationId: string): Promise<GreenApiInstance | null> {
    const integration = await integrationService.getIntegrationById(integrationId);
    if (!integration) return null;

    const credentials = await this.getCredentials(integrationId);
    if (!credentials) return null;

    return {
      integration,
      credentials,
    };
  },

  async getIntegrationByIdInstance(idInstance: string): Promise<Integration | null> {
    const integrations = await this.getAllIntegrations();

    for (const integration of integrations) {
      const credentials = await this.getCredentials(integration.id);
      if (credentials && credentials.id_instance === idInstance) {
        return integration;
      }
    }

    return null;
  },

  async saveCredentials(
    integrationId: string,
    credentials: GreenApiCredentials
  ): Promise<void> {
    await integrationCredentialService.setCredential(
      integrationId,
      'id_instance',
      credentials.id_instance
    );
    await integrationCredentialService.setCredential(
      integrationId,
      'api_token_instance',
      credentials.api_token_instance
    );
  },

  async updateIntegrationStatus(
    integrationId: string,
    status: 'active' | 'inactive' | 'error' | 'needs_config',
    errorMessage?: string
  ): Promise<void> {
    console.log(`Updating integration ${integrationId} status to: ${status}`, errorMessage ? `Error: ${errorMessage}` : '');

    await integrationService.updateIntegration(integrationId, {
      status,
      error_message: errorMessage,
      is_active: status === 'active',
    });

    if (status === 'error' && errorMessage) {
      await integrationService.recordError(integrationId, errorMessage);
    }
  },
};
