import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, RefreshCw, Trash2, Check, X, Wifi, WifiOff, Loader, Server, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { evolutionApiService, EvolutionInstance } from '../services/evolutionApiService';
import { getCurrentOrganizationId } from '../utils/organizationContext';

interface EvolutionApiSettingsProps {
  onInstanceCreated?: (instance: EvolutionInstance) => void;
  onInstanceDeleted?: () => void;
}

export function EvolutionApiSettings({ onInstanceCreated, onInstanceDeleted }: EvolutionApiSettingsProps) {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInstanceName, setSelectedInstanceName] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [pollingInterval, setPollingIntervalState] = useState<ReturnType<typeof setInterval> | null>(null);

  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings();
    loadInstances();
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await evolutionApiService.getSettings();
      setServerConfigured(settings?.health_status === 'healthy');
    } catch {
      setServerConfigured(false);
    }
  };

  const loadInstances = async () => {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;
    setLoading(true);
    try {
      const data = await evolutionApiService.getInstancesByOrganization(organizationId);
      setInstances(data);
    } catch (error) {
      console.error('Error loading Evolution instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPollingQr = useCallback((instanceName: string) => {
    if (pollingInterval) clearInterval(pollingInterval);

    const interval = setInterval(async () => {
      try {
        const inst = await evolutionApiService.refreshInstanceFromDb(instanceName);
        if (!inst) return;

        if (inst.connection_status === 'open') {
          clearInterval(interval);
          setPollingIntervalState(null);
          setSelectedInstanceName(null);
          setQrCode(null);
          setPairingCode(null);
          await loadInstances();
          return;
        }

        if (inst.qr_code && inst.qr_code !== qrCode) {
          setQrCode(inst.qr_code);
        }
      } catch { /* ignore */ }
    }, 3000);

    setPollingIntervalState(interval);
  }, [pollingInterval, qrCode]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) return;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    setCreating(true);
    try {
      const instance = await evolutionApiService.createInstance(organizationId, newInstanceName);
      await loadInstances();
      setNewInstanceName('');
      setShowCreateForm(false);
      onInstanceCreated?.(instance);

      if (instance.qr_code) {
        setSelectedInstanceName(instance.instance_name);
        setQrCode(instance.qr_code);
        startPollingQr(instance.instance_name);
      } else {
        setSelectedInstanceName(instance.instance_name);
        setLoadingQr(true);
        try {
          const qrResult = await evolutionApiService.connectInstance(instance.instance_name);
          setQrCode(qrResult.qrCode);
          setPairingCode(qrResult.pairingCode);
          startPollingQr(instance.instance_name);
        } finally {
          setLoadingQr(false);
        }
      }
    } catch (error: any) {
      alert(`Ошибка создания: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleGetQrCode = async (instanceName: string) => {
    setLoadingQr(true);
    setSelectedInstanceName(instanceName);
    try {
      const result = await evolutionApiService.connectInstance(instanceName);
      setQrCode(result.qrCode);
      setPairingCode(result.pairingCode);
      startPollingQr(instanceName);
    } catch (error: any) {
      const inst = await evolutionApiService.refreshInstanceFromDb(instanceName);
      if (inst?.qr_code) {
        setQrCode(inst.qr_code);
        startPollingQr(instanceName);
      } else {
        alert(`Ошибка QR: ${error.message}`);
      }
    } finally {
      setLoadingQr(false);
    }
  };

  const handleRefreshStatus = async (instanceName: string) => {
    await evolutionApiService.getConnectionState(instanceName);
    await loadInstances();
  };

  const handleLogout = async (instanceName: string) => {
    if (!confirm('Отключить этот инстанс?')) return;
    try {
      await evolutionApiService.logoutInstance(instanceName);
      await loadInstances();
      if (selectedInstanceName === instanceName) {
        setSelectedInstanceName(null);
        setQrCode(null);
      }
    } catch (error: any) {
      alert(`Ошибка: ${error.message}`);
    }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!confirm('Удалить инстанс? Все данные будут потеряны.')) return;
    try {
      await evolutionApiService.deleteInstance(instanceName);
      setInstances(prev => prev.filter(i => i.instance_name !== instanceName));
      if (selectedInstanceName === instanceName) {
        setSelectedInstanceName(null);
        setQrCode(null);
      }
      onInstanceDeleted?.();
    } catch (error: any) {
      alert(`Ошибка: ${error.message}`);
    }
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

  const displayName = (name: string) => {
    return name.replace(/^org_[a-f0-9]+_/, '');
  };

  return (
    <div className="space-y-5">
      {serverConfigured === null && (
        <div className="text-center py-8">
          <Loader className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </div>
      )}

      {serverConfigured === false && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">WhatsApp сервер не настроен</p>
            <p className="mt-1 text-blue-700">Сервер Evolution API настраивается администратором платформы. Обратитесь к администратору для подключения.</p>
          </div>
        </div>
      )}

      {serverConfigured === true && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-sm text-green-700 font-medium">Сервер Evolution API подключен</span>
        </div>
      )}

      {serverConfigured === true && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Инстансы WhatsApp</h3>
            {!showCreateForm && (
              <button onClick={() => setShowCreateForm(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium">
                + Новый инстанс
              </button>
            )}
          </div>

          {showCreateForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Новый инстанс</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Название (main, sales, support)"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={creating}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateInstance()}
                />
                <button onClick={handleCreateInstance} disabled={creating || !newInstanceName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm">
                  {creating ? <><Loader className="w-4 h-4 animate-spin" />...</> : <><Check className="w-4 h-4" />Создать</>}
                </button>
                <button onClick={() => { setShowCreateForm(false); setNewInstanceName(''); }} disabled={creating} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">После создания появится QR-код для подключения WhatsApp</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <Loader className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <Wifi className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium">Нет инстансов</p>
              <p className="text-sm text-slate-500 mt-1">Создайте первый инстанс для подключения WhatsApp</p>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((inst) => (
                <div key={inst.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-800">{displayName(inst.instance_name)}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(inst.connection_status)}`}>
                          {statusText(inst.connection_status)}
                        </span>
                      </div>
                      {inst.phone_number && <p className="text-sm text-slate-500 mt-1">+{inst.phone_number}</p>}
                      {inst.error_message && <p className="text-xs text-red-600 mt-1">{inst.error_message}</p>}
                    </div>
                    {inst.connection_status === 'open' ? <Wifi className="w-5 h-5 text-green-600" /> : <WifiOff className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {inst.connection_status !== 'open' && (
                      <button onClick={() => handleGetQrCode(inst.instance_name)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2">
                        <QrCode className="w-4 h-4" />QR-код
                      </button>
                    )}
                    <button onClick={() => handleRefreshStatus(inst.instance_name)} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200" title="Обновить">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    {inst.connection_status === 'open' && (
                      <button onClick={() => handleLogout(inst.instance_name)} className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200" title="Отключить">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteInstance(inst.instance_name)} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedInstanceName && (qrCode || loadingQr) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedInstanceName(null); setQrCode(null); setPairingCode(null); if (pollingInterval) clearInterval(pollingInterval); } }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Сканируйте QR-код</h3>
              <button onClick={() => { setSelectedInstanceName(null); setQrCode(null); setPairingCode(null); if (pollingInterval) clearInterval(pollingInterval); }} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 flex items-center justify-center min-h-[280px]">
              {loadingQr ? (
                <div className="text-center">
                  <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Загрузка QR-кода...</p>
                </div>
              ) : qrCode ? (
                <img
                  src={qrCode.startsWith('data:') || qrCode.startsWith('http') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="w-full max-w-[280px]"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <QrCode className="w-16 h-16 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ожидание QR-кода от сервера...</p>
                  <p className="text-xs mt-1">QR появится автоматически</p>
                </div>
              )}
            </div>

            {pairingCode && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-blue-600 mb-1">Код для ручного ввода:</p>
                <p className="text-2xl font-mono font-bold text-blue-800 tracking-wider">{pairingCode}</p>
              </div>
            )}

            <div className="text-sm text-slate-600 space-y-1">
              <p className="font-medium">Инструкция:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-500">
                <li>Откройте WhatsApp на телефоне</li>
                <li>Настройки &rarr; Связанные устройства</li>
                <li>Привязать устройство</li>
                <li>Наведите камеру на QR-код</li>
              </ol>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-blue-600">
                <Loader className="w-3 h-3 animate-spin" />
                <span>Статус обновляется автоматически</span>
              </div>
            </div>

            <button onClick={() => handleGetQrCode(selectedInstanceName)} className="w-full mt-4 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors">
              <RefreshCw className="w-4 h-4" />Обновить QR-код
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
