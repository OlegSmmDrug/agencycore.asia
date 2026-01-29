import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

async function verifyIntegrationOwnership(integrationId: string): Promise<boolean> {
  const organizationId = getCurrentOrganizationId();
  if (!organizationId) return false;

  const { data } = await supabase
    .from('integrations')
    .select('id')
    .eq('id', integrationId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  return !!data;
}

export const integrationCredentialService = {
  async setCredential(
    integrationId: string,
    key: string,
    value: string,
    expiresAt?: string
  ): Promise<void> {
    if (!(await verifyIntegrationOwnership(integrationId))) {
      throw new Error('Integration not found or access denied');
    }

    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID not found');
    }

    const { error } = await supabase.rpc('set_integration_credential', {
      p_integration_id: integrationId,
      p_organization_id: organizationId,
      p_credential_key: key,
      p_credential_value: value,
      p_encrypted: false,
    });

    if (error) throw error;
  },

  async getCredential(integrationId: string, key: string): Promise<string | null> {
    if (!(await verifyIntegrationOwnership(integrationId))) {
      throw new Error('Integration not found or access denied');
    }

    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID not found');
    }

    const { data, error } = await supabase.rpc('get_integration_credential', {
      p_integration_id: integrationId,
      p_organization_id: organizationId,
      p_credential_key: key,
    });

    if (error) throw error;
    return data;
  },

  async deleteCredential(integrationId: string, key: string): Promise<void> {
    if (!(await verifyIntegrationOwnership(integrationId))) {
      throw new Error('Integration not found or access denied');
    }

    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID not found');
    }

    const { error } = await supabase
      .from('integration_credentials')
      .delete()
      .eq('integration_id', integrationId)
      .eq('organization_id', organizationId)
      .eq('credential_key', key);

    if (error) throw error;
  },

  async getAllCredentialKeys(integrationId: string): Promise<string[]> {
    if (!(await verifyIntegrationOwnership(integrationId))) {
      throw new Error('Integration not found or access denied');
    }

    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID not found');
    }

    const { data, error } = await supabase
      .from('integration_credentials')
      .select('credential_key')
      .eq('integration_id', integrationId)
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(d => d.credential_key);
  },

  async hasCredentials(integrationId: string, requiredKeys: string[]): Promise<boolean> {
    const existingKeys = await this.getAllCredentialKeys(integrationId);
    return requiredKeys.every(key => existingKeys.includes(key));
  },
};
