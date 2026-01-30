import { supabase } from '../lib/supabase';
import { Project, ProjectStatus, ProjectKpi, ProjectQuickLink, ProjectRisk, ProjectHealthStatus, Client } from '../types';
import { serviceMappingService, ContentMetrics } from './serviceMappingService';

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

export const extractContentPlanFromCalculator = async (client?: Client): Promise<ContentMetrics> => {
  if (!client?.calculatorData?.items) {
    return {};
  }

  try {
    const allMappings = await serviceMappingService.getAll();
    const result: ContentMetrics = {};

    for (const calcItem of client.calculatorData.items) {
      if (!calcItem.serviceId) continue;

      const mapping = allMappings.find(m => m.serviceId === calcItem.serviceId);
      if (!mapping || !mapping.showInWidget) continue;

      const key = mapping.metricLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
      result[key] = {
        plan: calcItem.quantity || 0,
        fact: 0
      };
    }

    return result;
  } catch (error) {
    console.error('Error extracting content plan from calculator:', error);
    return {};
  }
};

export const extractContentPlanFromCalculatorLegacy = (client?: Client) => {
  if (!client?.calculatorData?.items) {
    return { postsPlan: 0, reelsPlan: 0, storiesPlan: 0 };
  }

  let postsPlan = 0;
  let reelsPlan = 0;
  let storiesPlan = 0;

  client.calculatorData.items.forEach(item => {
    const name = item.name.toLowerCase();
    if (name.includes('посты в ленту') || name.includes('пост')) {
      postsPlan = item.quantity || 0;
    } else if (name.includes('stories') || name.includes('стори')) {
      storiesPlan = item.quantity || 0;
    } else if (name.includes('reels') || name.includes('рилс')) {
      reelsPlan = item.quantity || 0;
    }
  });

  return { postsPlan, reelsPlan, storiesPlan };
};

export const extractWorkScopeFromCalculator = (client?: Client): string => {
  if (!client?.calculatorData?.items) {
    return '';
  }

  const items = client.calculatorData.items
    .filter(item => item.quantity && item.quantity > 0)
    .map(item => {
      const quantity = item.quantity || 0;
      return `• ${item.name}: ${quantity} шт.`;
    });

  return items.join('\n');
};

const mapRowToProject = (row: any): Project => ({
  id: row.id,
  clientId: row.client_id,
  name: row.name,
  status: row.status as ProjectStatus,
  startDate: row.start_date || '',
  endDate: row.end_date || '',
  duration: row.duration || 30,
  budget: Number(row.budget) || 0,
  totalLTV: Number(row.total_ltv) || 0,
  mediaBudget: Number(row.media_budget) || 0,
  description: row.description || '',
  teamIds: row.team_ids || [],
  services: row.services || [],
  adAccountId: row.ad_account_id || undefined,
  facebookAccessToken: row.facebook_access_token || undefined,
  liveduneAccountId: row.livedune_account_id || undefined,
  liveduneAccessToken: row.livedune_access_token || undefined,
  isArchived: row.is_archived || false,
  imageUrl: row.image_url || undefined,
  kpis: row.kpis || [],
  quickLinks: row.quick_links || [],
  quickLinksData: row.quick_links_data || [],
  focusWeek: row.focus_week || '',
  focuses: row.focuses || [],
  risks: row.risks || [],
  workScope: row.work_scope || '',
  healthStatus: (row.health_status as ProjectHealthStatus) || 'good',
  contractNumber: row.contract_number || '',
  contractDate: row.contract_date || undefined,
  contractScanUrl: row.contract_scan_url || '',
  postsPlan: row.posts_plan || 0,
  postsFact: row.posts_fact || 0,
  reelsPlan: row.reels_plan || 0,
  reelsFact: row.reels_fact || 0,
  storiesPlan: row.stories_plan || 0,
  storiesFact: row.stories_fact || 0,
  kpiLastSyncedAt: row.kpi_last_synced_at || undefined,
  contentAutoCalculate: row.content_auto_calculate !== false,
  contentLastCalculatedAt: row.content_last_calculated_at || undefined,
  contentMetrics: row.content_metrics || {},
  contentMetricsVisible: row.content_metrics_visible || undefined,
  lastContentSyncAt: row.last_content_sync_at || undefined
});

export const projectService = {
  async getAll(): Promise<Project[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }

    return (data || []).map(mapRowToProject);
  },

  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching project:', error);
      throw error;
    }

    return data ? mapRowToProject(data) : null;
  },

  async create(project: Omit<Project, 'id'>): Promise<Project> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        organization_id: organizationId,
        client_id: project.clientId,
        name: project.name,
        status: project.status,
        start_date: project.startDate || null,
        end_date: project.endDate || null,
        duration: project.duration || 30,
        budget: project.budget || 0,
        total_ltv: project.totalLTV || 0,
        media_budget: project.mediaBudget || 0,
        description: project.description || '',
        team_ids: project.teamIds || [],
        services: project.services || [],
        ad_account_id: project.adAccountId || null,
        facebook_access_token: project.facebookAccessToken || null,
        livedune_account_id: project.liveduneAccountId || null,
        livedune_access_token: project.liveduneAccessToken || null,
        is_archived: project.isArchived || false,
        image_url: project.imageUrl || null,
        kpis: project.kpis || [],
        quick_links: project.quickLinks || [],
        quick_links_data: project.quickLinksData || [],
        focus_week: project.focusWeek || '',
        focuses: project.focuses || [],
        risks: project.risks || [],
        work_scope: project.workScope || '',
        health_status: project.healthStatus || 'good',
        contract_number: project.contractNumber || '',
        contract_date: project.contractDate || null,
        contract_scan_url: project.contractScanUrl || '',
        posts_plan: project.postsPlan || 0,
        posts_fact: project.postsFact || 0,
        reels_plan: project.reelsPlan || 0,
        reels_fact: project.reelsFact || 0,
        stories_plan: project.storiesPlan || 0,
        stories_fact: project.storiesFact || 0,
        kpi_last_synced_at: project.kpiLastSyncedAt || null,
        content_auto_calculate: project.contentAutoCalculate !== false,
        content_last_calculated_at: project.contentLastCalculatedAt || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      throw error;
    }

    return mapRowToProject(data);
  },

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const updateData: any = {};

    if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate || null;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate || null;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.budget !== undefined) updateData.budget = updates.budget;
    if (updates.totalLTV !== undefined) updateData.total_ltv = updates.totalLTV;
    if (updates.mediaBudget !== undefined) updateData.media_budget = updates.mediaBudget;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.teamIds !== undefined) updateData.team_ids = updates.teamIds;
    if (updates.services !== undefined) updateData.services = updates.services;
    if (updates.adAccountId !== undefined) updateData.ad_account_id = updates.adAccountId;
    if (updates.facebookAccessToken !== undefined) updateData.facebook_access_token = updates.facebookAccessToken;
    if (updates.liveduneAccountId !== undefined) updateData.livedune_account_id = updates.liveduneAccountId;
    if (updates.liveduneAccessToken !== undefined) updateData.livedune_access_token = updates.liveduneAccessToken;
    if (updates.isArchived !== undefined) updateData.is_archived = updates.isArchived;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
    if (updates.kpis !== undefined) updateData.kpis = updates.kpis;
    if (updates.quickLinks !== undefined) updateData.quick_links = updates.quickLinks;
    if (updates.quickLinksData !== undefined) updateData.quick_links_data = updates.quickLinksData;
    if (updates.focusWeek !== undefined) updateData.focus_week = updates.focusWeek;
    if (updates.focuses !== undefined) updateData.focuses = updates.focuses;
    if (updates.risks !== undefined) updateData.risks = updates.risks;
    if (updates.workScope !== undefined) updateData.work_scope = updates.workScope;
    if (updates.healthStatus !== undefined) updateData.health_status = updates.healthStatus;
    if (updates.contractNumber !== undefined) updateData.contract_number = updates.contractNumber;
    if (updates.contractDate !== undefined) updateData.contract_date = updates.contractDate || null;
    if (updates.contractScanUrl !== undefined) updateData.contract_scan_url = updates.contractScanUrl;
    if (updates.postsPlan !== undefined) updateData.posts_plan = updates.postsPlan;
    if (updates.postsFact !== undefined) updateData.posts_fact = updates.postsFact;
    if (updates.reelsPlan !== undefined) updateData.reels_plan = updates.reelsPlan;
    if (updates.reelsFact !== undefined) updateData.reels_fact = updates.reelsFact;
    if (updates.storiesPlan !== undefined) updateData.stories_plan = updates.storiesPlan;
    if (updates.storiesFact !== undefined) updateData.stories_fact = updates.storiesFact;
    if (updates.kpiLastSyncedAt !== undefined) updateData.kpi_last_synced_at = updates.kpiLastSyncedAt;
    if (updates.contentAutoCalculate !== undefined) updateData.content_auto_calculate = updates.contentAutoCalculate;
    if (updates.contentLastCalculatedAt !== undefined) updateData.content_last_calculated_at = updates.contentLastCalculatedAt;
    if (updates.contentMetrics !== undefined) updateData.content_metrics = updates.contentMetrics;
    if (updates.contentMetricsVisible !== undefined) updateData.content_metrics_visible = updates.contentMetricsVisible;

    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating project:', error);
      throw error;
    }

    return mapRowToProject(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  },

  async renewProject(id: string, project: Project, renewedBy?: string): Promise<Project> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const previousEndDate = project.endDate;
    const newStartDate = project.endDate;
    const currentEnd = new Date(project.endDate);
    currentEnd.setDate(currentEnd.getDate() + (project.duration || 30));
    const newEndDate = currentEnd.toISOString().split('T')[0];
    const newLTV = (project.totalLTV || 0) + project.budget;

    const { error: renewalError } = await supabase
      .from('project_renewals')
      .insert({
        project_id: id,
        client_id: project.clientId,
        previous_end_date: previousEndDate,
        new_end_date: newEndDate,
        renewal_date: new Date().toISOString(),
        renewed_amount: project.budget,
        renewed_by: renewedBy || null,
        organization_id: organizationId
      });

    if (renewalError) {
      console.error('Error logging project renewal:', renewalError);
    }

    return this.update(id, {
      startDate: newStartDate,
      endDate: newEndDate,
      totalLTV: newLTV,
      status: ProjectStatus.IN_WORK
    });
  },

  async syncContentPlanFromClient(projectId: string, client?: Client): Promise<Project> {
    const contentMetrics = await extractContentPlanFromCalculator(client);
    return this.update(projectId, { contentMetrics });
  }
};
