import { supabase } from '../lib/supabase';

export interface EvolutionInstance {
  id: string;
  organization_id: string;
  instance_name: string;
  phone_number?: string;
  connection_status: 'disconnected' | 'connecting' | 'open' | 'close' | 'qr';
  qr_code?: string;
  qr_code_updated_at?: string;
  webhook_configured: boolean;
  last_connected_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface EvolutionSettings {
  server_url: string;
  is_active: boolean;
  health_status: string;
  last_health_check?: string;
}

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-proxy`;

async function callProxy(action: string, payload: Record<string, any> = {}) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const json = await res.json();

  if (!res.ok && !json.ok) {
    const msg = json.error || json.data?.message || `Proxy error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json.data ?? json;
}

export const evolutionApiService = {
  async saveSettings(serverUrl: string, apiKey: string): Promise<boolean> {
    const result = await callProxy('save_settings', { serverUrl, apiKey });
    return result?.connected === true;
  },

  async getSettings(): Promise<EvolutionSettings | null> {
    const result = await callProxy('get_settings');
    return result || null;
  },

  async testConnection(): Promise<boolean> {
    try {
      await callProxy('test_connection');
      return true;
    } catch {
      return false;
    }
  },

  async createInstance(organizationId: string, userGivenName: string): Promise<EvolutionInstance> {
    const instanceName = `org_${organizationId.substring(0, 8)}_${userGivenName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const result = await callProxy('create_instance', { instanceName, organizationId });

    const { data } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (!data) throw new Error('Instance creation failed');

    return {
      ...data,
      qr_code: result?.qrCode || data.qr_code,
    } as EvolutionInstance;
  },

  async connectInstance(instanceName: string): Promise<{ qrCode: string | null; qrCodeRaw: string | null; pairingCode: string | null; state: string }> {
    const result = await callProxy('connect_instance', { instanceName });
    return {
      qrCode: result?.qrCode || null,
      qrCodeRaw: result?.qrCodeRaw || null,
      pairingCode: result?.pairingCode || null,
      state: result?.state || 'qr',
    };
  },

  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const result = await callProxy('connection_state', { instanceName });
      return result?.state || 'disconnected';
    } catch {
      return 'disconnected';
    }
  },

  async restartInstance(instanceName: string): Promise<void> {
    await callProxy('restart_instance', { instanceName });
  },

  async logoutInstance(instanceName: string): Promise<void> {
    await callProxy('logout_instance', { instanceName });
  },

  async deleteInstance(instanceName: string): Promise<void> {
    await callProxy('delete_instance', { instanceName });
  },

  async setWebhook(instanceName: string): Promise<void> {
    await callProxy('set_webhook', { instanceName });
  },

  async sendText(instanceName: string, number: string, text: string): Promise<any> {
    return await callProxy('send_text', { instanceName, number, text });
  },

  async sendMedia(
    instanceName: string,
    number: string,
    mediatype: 'image' | 'video' | 'audio' | 'document',
    media: string,
    caption?: string,
    fileName?: string
  ): Promise<any> {
    return await callProxy('send_media', { instanceName, number, mediatype, media, caption, fileName });
  },

  async sendAudio(instanceName: string, number: string, audio: string): Promise<any> {
    return await callProxy('send_audio', { instanceName, number, audio });
  },

  async getInstancesByOrganization(organizationId: string): Promise<EvolutionInstance[]> {
    const { data, error } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as EvolutionInstance[];
  },

  async getInstanceByName(instanceName: string): Promise<EvolutionInstance | null> {
    const { data } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .maybeSingle();

    return data as EvolutionInstance | null;
  },

  async getActiveInstance(organizationId: string): Promise<EvolutionInstance | null> {
    const { data } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('connection_status', 'open')
      .order('last_connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data as EvolutionInstance | null;
  },

  async refreshInstanceFromDb(instanceName: string): Promise<EvolutionInstance | null> {
    const { data } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .maybeSingle();

    return data as EvolutionInstance | null;
  },
};
