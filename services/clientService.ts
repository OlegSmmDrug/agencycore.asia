import { supabase } from '../lib/supabase';
import { Client, ClientStatus } from '../types';

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

const mapRowToClient = (row: any): Client => ({
  id: row.id,
  name: row.name,
  company: row.company,
  status: row.status as ClientStatus,
  email: row.email || '',
  phone: row.phone || '',
  budget: Number(row.budget) || 0,
  prepayment: Number(row.prepayment) || 0,
  source: row.source as any,
  managerId: row.manager_id,
  description: row.description || '',
  technicalDescription: row.technical_description || '',
  clientBrief: row.client_brief || '',
  filesLink: row.files_link || '',
  service: row.service || '',
  services: row.services || [],
  inn: row.inn || '',
  bin: row.inn || '',
  address: row.address || '',
  legalName: row.legal_name || '',
  director: row.director || '',
  isArchived: row.is_archived || false,
  createdAt: row.created_at,
  statusChangedAt: row.status_changed_at || row.created_at,
  projectLaunched: row.project_launched || false,
  progressLevel: row.progress_level || 0,
  contractNumber: row.contract_number || '',
  contractStatus: row.contract_status || 'draft',
  calculatorData: row.calculator_data || null,
  bankName: row.bank_name || '',
  bank: row.bank_name || '',
  bankBik: row.bank_bik || '',
  bik: row.bank_bik || '',
  accountNumber: row.account_number || '',
  iban: row.account_number || '',
  signatoryBasis: row.signatory_basis || 'Устава',
  contractFileUrl: row.contract_file_url || '',
  contractGeneratedAt: row.contract_generated_at || '',
  leadSourcePage: row.lead_source_page || '',
  leadSourceForm: row.lead_source_form || '',
  leadSourceWebsite: row.lead_source_website || '',
  leadSourceUrl: row.lead_source_url || '',
  utmSource: row.utm_source || '',
  utmMedium: row.utm_medium || '',
  utmCampaign: row.utm_campaign || '',
  utmContent: row.utm_content || '',
  utmTerm: row.utm_term || '',
  ymclidMetrika: row.ymclid_metrika || '',
  yclidDirect: row.yclid_direct || '',
  gclid: row.gclid || '',
  clientIdGoogle: row.client_id_google || '',
  clientIdYandex: row.client_id_yandex || '',
  logoUrl: row.logo_url || '',
  parentClientId: row.parent_client_id || undefined
});

export const clientService = {
  async getAll(): Promise<Client[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }

    return (data || []).map(mapRowToClient);
  },

  async create(client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        organization_id: organizationId,
        name: client.name,
        company: client.company,
        status: client.status,
        email: client.email || '',
        phone: client.phone || '',
        budget: client.budget || 0,
        prepayment: client.prepayment || 0,
        source: client.source,
        manager_id: client.managerId || null,
        description: client.description || '',
        technical_description: client.technicalDescription || '',
        client_brief: client.clientBrief || '',
        files_link: client.filesLink || '',
        service: client.service || '',
        services: client.services || [],
        inn: client.inn || '',
        address: client.address || '',
        legal_name: client.legalName || '',
        director: client.director || '',
        is_archived: client.isArchived || false,
        progress_level: client.progressLevel || 0,
        contract_number: client.contractNumber || '',
        contract_status: client.contractStatus || 'draft',
        calculator_data: client.calculatorData || null,
        bank_name: client.bankName || '',
        bank_bik: client.bankBik || '',
        account_number: client.accountNumber || '',
        signatory_basis: client.signatoryBasis || 'Устава',
        contract_file_url: client.contractFileUrl || '',
        contract_generated_at: client.contractGeneratedAt ? client.contractGeneratedAt : null,
        lead_source_page: client.leadSourcePage || '',
        lead_source_form: client.leadSourceForm || '',
        lead_source_website: client.leadSourceWebsite || '',
        lead_source_url: client.leadSourceUrl || '',
        utm_source: client.utmSource || '',
        utm_medium: client.utmMedium || '',
        utm_campaign: client.utmCampaign || '',
        utm_content: client.utmContent || '',
        utm_term: client.utmTerm || '',
        ymclid_metrika: client.ymclidMetrika || '',
        yclid_direct: client.yclidDirect || '',
        gclid: client.gclid || '',
        client_id_google: client.clientIdGoogle || '',
        client_id_yandex: client.clientIdYandex || '',
        parent_client_id: (client as any).parentClientId || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      throw error;
    }

    return mapRowToClient(data);
  },

  async update(id: string, updates: Partial<Client>): Promise<Client> {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.company !== undefined) updateData.company = updates.company;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.budget !== undefined) updateData.budget = updates.budget;
    if (updates.prepayment !== undefined) updateData.prepayment = updates.prepayment;
    if (updates.source !== undefined) updateData.source = updates.source;
    if (updates.managerId !== undefined) updateData.manager_id = updates.managerId;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.technicalDescription !== undefined) updateData.technical_description = updates.technicalDescription;
    if (updates.clientBrief !== undefined) updateData.client_brief = updates.clientBrief;
    if (updates.filesLink !== undefined) updateData.files_link = updates.filesLink;
    if (updates.service !== undefined) updateData.service = updates.service;
    if (updates.services !== undefined) updateData.services = updates.services;
    if (updates.inn !== undefined) updateData.inn = updates.inn;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.legalName !== undefined) updateData.legal_name = updates.legalName;
    if (updates.director !== undefined) updateData.director = updates.director;
    if (updates.isArchived !== undefined) updateData.is_archived = updates.isArchived;
    if (updates.progressLevel !== undefined) updateData.progress_level = updates.progressLevel;
    if (updates.contractNumber !== undefined) updateData.contract_number = updates.contractNumber;
    if (updates.contractStatus !== undefined) updateData.contract_status = updates.contractStatus;
    if (updates.calculatorData !== undefined) updateData.calculator_data = updates.calculatorData;
    if (updates.bankName !== undefined) updateData.bank_name = updates.bankName;
    if (updates.bankBik !== undefined) updateData.bank_bik = updates.bankBik;
    if (updates.accountNumber !== undefined) updateData.account_number = updates.accountNumber;
    if (updates.signatoryBasis !== undefined) updateData.signatory_basis = updates.signatoryBasis;
    if (updates.contractFileUrl !== undefined) updateData.contract_file_url = updates.contractFileUrl;
    if (updates.contractGeneratedAt !== undefined) updateData.contract_generated_at = updates.contractGeneratedAt || null;
    if (updates.statusChangedAt !== undefined) updateData.status_changed_at = updates.statusChangedAt || null;
    if (updates.projectLaunched !== undefined) updateData.project_launched = updates.projectLaunched;
    if (updates.leadSourcePage !== undefined) updateData.lead_source_page = updates.leadSourcePage;
    if (updates.leadSourceForm !== undefined) updateData.lead_source_form = updates.leadSourceForm;
    if (updates.leadSourceWebsite !== undefined) updateData.lead_source_website = updates.leadSourceWebsite;
    if (updates.leadSourceUrl !== undefined) updateData.lead_source_url = updates.leadSourceUrl;
    if (updates.utmSource !== undefined) updateData.utm_source = updates.utmSource;
    if (updates.utmMedium !== undefined) updateData.utm_medium = updates.utmMedium;
    if (updates.utmCampaign !== undefined) updateData.utm_campaign = updates.utmCampaign;
    if (updates.utmContent !== undefined) updateData.utm_content = updates.utmContent;
    if (updates.utmTerm !== undefined) updateData.utm_term = updates.utmTerm;
    if (updates.ymclidMetrika !== undefined) updateData.ymclid_metrika = updates.ymclidMetrika;
    if (updates.yclidDirect !== undefined) updateData.yclid_direct = updates.yclidDirect;
    if (updates.gclid !== undefined) updateData.gclid = updates.gclid;
    if (updates.clientIdGoogle !== undefined) updateData.client_id_google = updates.clientIdGoogle;
    if (updates.clientIdYandex !== undefined) updateData.client_id_yandex = updates.clientIdYandex;
    if (updates.parentClientId !== undefined) updateData.parent_client_id = updates.parentClientId;

    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating client:', error);
      throw error;
    }

    return mapRowToClient(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  }
};

export const getClients = clientService.getAll;
