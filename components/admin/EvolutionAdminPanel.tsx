import React, { useState, useEffect } from 'react';
import { Server, Key, Check, Loader, CheckCircle, AlertTriangle, Wifi, WifiOff, RefreshCw, Trash2, X } from 'lucide-react';
import { evolutionApiService, EvolutionInstance } from '../../services/evolutionApiService';
import { supabase } from '../../lib/supabase';

interface EvolutionAdminPanelProps {}

const EvolutionAdminPanel: React.FC<EvolutionAdminPanelProps> = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'unknown' | 'healthy' | 'unhealthy' | 'saving'>('unknown');
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [allInstances, setAllInstances] = useState<(EvolutionInstance & { org_name?: string })[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  useEffect(() => {
    loadSettings();
    loadAllInstances();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await evolutionApiService.getSettings();
      if (settings) {
        setServerUrl(settings.server_url || '');
        setStatus(settings.health_status as any || 'unknown');
        setLastCheck(settings.last_health_check || null);
      }
    } catch {}
  };

  const loadAllInstances = async () => {
    setLoadingInstances(true);
    try {
      const { data } = await supabase
        .from('evolution_instances')
        .select('*, organizations(name)')
        .order('created_at', { ascending: false });

      const mapped = (data || []).map((inst: any) => ({
        ...inst,
        org_name: inst.organizations?.name || '-',
      }));
      setAllInstances(mapped);
    } catch {} finally {
      setLoadingInstances(false);
    }
  };

  const handleSave = async () => {
    if (!serverUrl.trim() || !apiKey.trim()) return;
    setSaving(true);
    setStatus('saving');
    try {
      const connected = await evolutionApiService.saveSettings(serverUrl.trim(), apiKey.trim());
      setStatus(connected ? 'healthy' : 'unhealthy');
      setLastCheck(new Date().toISOString());
      setApiKey('');
      if (connected) await loadAllInstances();
    } catch {
      setStatus('unhealthy');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!confirm(`Удалить инстанс "${instanceName}"? Это действие необратимо.`)) return;
    try {
      await evolutionApiService.deleteInstance(instanceName);
      setAllInstances(prev => prev.filter(i => i.instance_name !== instanceName));
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const handleRefreshStatus = async (instanceName: string) => {
    try {
      await evolutionApiService.getConnectionState(instanceName);
      await loadAllInstances();
    } catch {}
  };

  const statusColor = (s: string) => {
    if (s === 'open') return 'text-green-600 bg-green-50';
    if (s === 'qr' || s === 'connecting') return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const statusText = (s: string) => {
    const map: Record<string, string> = { open: 'Подключен', qr: 'Ожидает QR', connecting: 'Подключение...', disconnected: 'Отключен', close: 'Закрыт' };
    return map[s] || s;
  };

  const displayName = (name: string) => name.replace(/^org_[a-f0-9]+_/, '');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-green-100 rounded-xl">
            <Server className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Evolution API</h3>
            <p className="text-sm text-slate-500">Глобальные настройки сервера WhatsApp</p>
          </div>
          {status === 'healthy' && (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
              <CheckCircle className="w-4 h-4" /> Сервер подключен
            </span>
          )}
          {status === 'unhealthy' && (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-full font-medium">
              <AlertTriangle className="w-4 h-4" /> Ошибка подключения
            </span>
          )}
          {status === 'unknown' && (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full font-medium">
              Не настроен
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">URL сервера Evolution API</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-evolution-api.com"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">API ключ</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={status === 'healthy' ? '********' : 'Введите API ключ'}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {lastCheck && `Последняя проверка: ${new Date(lastCheck).toLocaleString('ru-RU')}`}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !serverUrl.trim() || !apiKey.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {saving ? (
              <><Loader className="w-4 h-4 animate-spin" /> Проверка...</>
            ) : (
              <><Check className="w-4 h-4" /> Сохранить и проверить</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Все инстансы WhatsApp</h4>
          <button
            onClick={loadAllInstances}
            disabled={loadingInstances}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInstances ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>

        {loadingInstances ? (
          <div className="text-center py-8">
            <Loader className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          </div>
        ) : allInstances.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Инстансов пока нет. Организации смогут создавать их через настройки WhatsApp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Инстанс</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Организация</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Телефон</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-600">Статус</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Webhook</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Создан</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {allInstances.map((inst) => (
                  <tr key={inst.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inst.connection_status === 'open' ? (
                          <Wifi className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-slate-800">{displayName(inst.instance_name)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inst.org_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 font-mono">{inst.phone_number ? `+${inst.phone_number}` : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(inst.connection_status)}`}>
                        {statusText(inst.connection_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${inst.webhook_configured ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                        {inst.webhook_configured ? 'OK' : 'Нет'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(inst.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRefreshStatus(inst.instance_name)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                          title="Обновить статус"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteInstance(inst.instance_name)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvolutionAdminPanel;
