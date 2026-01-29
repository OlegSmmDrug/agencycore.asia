import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface WebhookEndpoint {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  endpoint_url: string;
  secret_token: string;
  source_type: string;
  field_mapping: Record<string, string>;
  retry_config: {
    max_retries: number;
    backoff_multiplier: number;
  };
  is_active: boolean;
  last_received_at?: string;
  total_received: number;
  created_at: string;
  updated_at: string;
}

export const webhookService = {
  async getAllWebhooks(): Promise<WebhookEndpoint[]> {
    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getWebhookById(id: string): Promise<WebhookEndpoint | null> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getWebhookByToken(token: string): Promise<WebhookEndpoint | null> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('secret_token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createWebhook(webhook: Partial<WebhookEndpoint>): Promise<WebhookEndpoint> {
    const organizationId = getCurrentOrganizationId();

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const endpointId = crypto.randomUUID();
    const endpointUrl = `${baseUrl}/functions/v1/webhook-receiver/${endpointId}`;

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        ...webhook,
        organization_id: organizationId,
        endpoint_url: endpointUrl,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateWebhook(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteWebhook(id: string): Promise<void> {
    const { error } = await supabase
      .from('webhook_endpoints')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleWebhook(id: string, isActive: boolean): Promise<void> {
    await this.updateWebhook(id, { is_active: isActive });
  },

  async recordWebhookReceived(id: string): Promise<void> {
    const webhook = await this.getWebhookById(id);
    if (!webhook) return;

    await this.updateWebhook(id, {
      last_received_at: new Date().toISOString(),
      total_received: webhook.total_received + 1,
    });
  },

  mapWebhookData(payload: Record<string, any>, mapping: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [crmField, webhookPath] of Object.entries(mapping)) {
      const value = this.getNestedValue(payload, webhookPath);
      if (value !== undefined) {
        result[crmField] = value;
      }
    }

    return result;
  },

  getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  },

  async processWebhookPayload(
    webhookId: string,
    payload: Record<string, any>
  ): Promise<void> {
    const webhook = await this.getWebhookById(webhookId);
    if (!webhook || !webhook.is_active) {
      throw new Error('Webhook not found or inactive');
    }

    const mappedData = this.mapWebhookData(payload, webhook.field_mapping);

    await this.recordWebhookReceived(webhookId);

    const { clientService } = await import('./clientService');
    await clientService.create(mappedData as any);
  },

  generateWebhookUrl(): string {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const endpointId = crypto.randomUUID();
    return `${baseUrl}/functions/v1/webhook-receiver/${endpointId}`;
  },

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    return true;
  },
};
