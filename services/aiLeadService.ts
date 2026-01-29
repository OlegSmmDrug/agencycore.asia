import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { Lead } from '../types';
import { clientService } from './clientService';
import { ClientStatus } from '../types';

export const aiLeadService = {
  async getAllLeads(): Promise<Lead[]> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_leads')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      agentId: row.agent_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      budget: row.budget,
      status: row.status,
      score: row.score,
      extractedData: row.extracted_data || {},
      source: row.source,
      lastContact: new Date(row.last_contact_at).getTime(),
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async createLead(lead: Partial<Lead>): Promise<Lead> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_leads')
      .insert({
        organization_id: organizationId,
        agent_id: lead.agentId,
        name: lead.name || 'Новый лид',
        phone: lead.phone,
        email: lead.email,
        budget: lead.budget,
        status: lead.status || 'qualified',
        score: lead.score || 5,
        extracted_data: lead.extractedData || {},
        source: lead.source || 'ai_agent',
        last_contact_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      agentId: data.agent_id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      budget: data.budget,
      status: data.status,
      score: data.score,
      extractedData: data.extracted_data || {},
      source: data.source,
      lastContact: new Date(data.last_contact_at).getTime(),
      createdAt: new Date(data.created_at).getTime()
    };
  },

  async updateLeadStatus(id: string, status: 'qualified' | 'proposal' | 'contract'): Promise<void> {
    const { error } = await supabase
      .from('ai_leads')
      .update({
        status,
        last_contact_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  },

  async convertLeadToClient(leadId: string, managerId: string): Promise<string> {
    const { data: leadData, error: leadError } = await supabase
      .from('ai_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !leadData) {
      throw new Error('Lead not found');
    }

    const extractedData = leadData.extracted_data || {};

    const client = await clientService.create({
      name: leadData.name,
      company: extractedData.company || leadData.name,
      status: ClientStatus.NEW_LEAD,
      email: leadData.email || '',
      phone: leadData.phone || '',
      budget: leadData.budget || 0,
      prepayment: 0,
      source: 'Creatium',
      managerId: managerId,
      description: `Лид создан ИИ-агентом. Score: ${leadData.score}/10`,
      service: extractedData.service || 'SMM',
      filesLink: '',
      services: [],
      inn: '',
      address: '',
      legalName: '',
      director: '',
      isArchived: false,
      statusChangedAt: new Date().toISOString(),
      projectLaunched: false,
      progressLevel: 0,
      contractNumber: '',
      contractStatus: 'draft',
      calculatorData: undefined,
      bankName: '',
      bankBik: '',
      accountNumber: '',
      signatoryBasis: 'Устава',
      contractFileUrl: '',
      contractGeneratedAt: '',
      technicalDescription: '',
      clientBrief: '',
      leadSourcePage: '',
      leadSourceForm: '',
      leadSourceWebsite: '',
      leadSourceUrl: '',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      utmContent: '',
      utmTerm: '',
      ymclidMetrika: '',
      yclidDirect: '',
      gclid: '',
      clientIdGoogle: '',
      clientIdYandex: '',
      logoUrl: ''
    });

    await this.updateLeadStatus(leadId, 'contract');

    return client.id;
  }
};
