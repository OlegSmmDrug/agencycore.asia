import React from 'react';
import { Settings, Zap, AlertCircle, Clock, CheckCircle, Star } from 'lucide-react';
import { Integration } from '../../services/integrationService';

interface IntegrationCardProps {
  integration: Integration;
  onConfigure: (integration: Integration) => void;
  onToggle: (integration: Integration) => void;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  integration,
  onConfigure,
  onToggle,
}) => {
  const getStatusBadge = () => {
    switch (integration.status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Активна
          </span>
        );
      case 'needs_config':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Settings className="w-3 h-3 mr-1" />
            Требует настройки
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Ошибка
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Неактивна
          </span>
        );
    }
  };

  const getIntegrationIcon = () => {
    switch (integration.integration_type) {
      case 'facebook_ads':
        return '📘';
      case 'google_ads':
        return '🎯';
      case 'google_analytics':
        return '📊';
      case 'green_api':
        return '💬';
      case 'wazzup':
        return '💬';
      case 'whatsapp':
        return '💬';
      case 'email':
        return '📧';
      case 'telegram':
        return '✈️';
      case 'tiktok_ads':
        return '🎵';
      case 'yandex_metrika':
        return '📈';
      case 'yandex_direct':
        return '🎯';
      case 'livedune':
        return '📸';
      case 'webhook':
        return '🔗';
      default:
        return '🔌';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-3xl">{getIntegrationIcon()}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{integration.name}</h3>
              {integration.config?.is_default && (
                <span title="Интеграция по умолчанию">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{integration.description}</p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {integration.last_sync_at && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <Clock className="w-3 h-3" />
          Последняя синхронизация: {new Date(integration.last_sync_at).toLocaleString('ru-RU')}
        </div>
      )}

      {integration.error_message && (
        <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
          <p className="text-xs text-red-700">{integration.error_message}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onConfigure(integration)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Настроить
        </button>
        <button
          onClick={() => onToggle(integration)}
          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${
            integration.is_active
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Zap className="w-4 h-4" />
          {integration.is_active ? 'Отключить' : 'Активировать'}
        </button>
      </div>
    </div>
  );
};
