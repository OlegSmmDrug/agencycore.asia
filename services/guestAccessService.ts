import { supabase } from '../lib/supabase';
import { GuestAccess, GuestPermission } from '../types';

export const guestAccessService = {
  generatePermanentToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 32;
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  },

  async createGuestAccess(
    projectId: string,
    createdBy: string,
    permissions: GuestPermission[] = [
      'viewTasks',
      'approveContent',
      'addComments',
      'viewOverview',
      'viewRoadmap',
      'viewNotes',
      'viewCalendar',
      'viewFacebook',
      'viewLivedune'
    ]
  ): Promise<GuestAccess> {
    const token = this.generatePermanentToken();

    const { data, error } = await supabase
      .from('guest_access')
      .insert({
        project_id: projectId,
        token,
        permissions,
        is_active: true,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      projectId: data.project_id,
      token: data.token,
      permissions: data.permissions,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
      managerName: data.manager_name,
      managerPhone: data.manager_phone,
      managerEmail: data.manager_email,
    };
  },

  async validateGuestToken(token: string): Promise<GuestAccess | null> {
    const { data, error } = await supabase
      .from('guest_access')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;

    await this.trackTokenUsage(token);

    return {
      id: data.id,
      projectId: data.project_id,
      token: data.token,
      permissions: data.permissions,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
      managerName: data.manager_name,
      managerPhone: data.manager_phone,
      managerEmail: data.manager_email,
    };
  },

  async trackTokenUsage(token: string): Promise<void> {
    await supabase
      .from('guest_access')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token);
  },

  async deactivateGuestAccess(accessId: string): Promise<void> {
    const { error } = await supabase
      .from('guest_access')
      .update({ is_active: false })
      .eq('id', accessId);

    if (error) throw error;
  },

  async reactivateGuestAccess(accessId: string): Promise<void> {
    const { error } = await supabase
      .from('guest_access')
      .update({ is_active: true })
      .eq('id', accessId);

    if (error) throw error;
  },

  async getProjectByToken(token: string) {
    const access = await this.validateGuestToken(token);
    if (!access) return null;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', access.projectId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      clientId: data.client_id,
      name: data.name,
      status: data.status,
      startDate: data.start_date || '',
      endDate: data.end_date || '',
      duration: data.duration || 30,
      budget: Number(data.budget) || 0,
      totalLTV: Number(data.total_ltv) || 0,
      mediaBudget: Number(data.media_budget) || 0,
      description: data.description || '',
      teamIds: data.team_ids || [],
      services: data.services || [],
      adAccountId: data.ad_account_id || undefined,
      facebookAccessToken: data.facebook_access_token || undefined,
      liveduneAccountId: data.livedune_account_id || undefined,
      liveduneAccessToken: data.livedune_access_token || undefined,
      isArchived: data.is_archived || false,
      imageUrl: data.image_url || undefined,
      kpis: data.kpis || [],
      quickLinks: data.quick_links || [],
      quickLinksData: data.quick_links_data || undefined,
      focusWeek: data.focus_week || '',
      risks: data.risks || [],
      workScope: data.work_scope || '',
      healthStatus: data.health_status || 'good',
      contractNumber: data.contract_number || '',
      contractDate: data.contract_date || undefined,
      contractScanUrl: data.contract_scan_url || '',
      postsPlan: data.posts_plan || 0,
      postsFact: data.posts_fact || 0,
      reelsPlan: data.reels_plan || 0,
      reelsFact: data.reels_fact || 0,
      storiesPlan: data.stories_plan || 0,
      storiesFact: data.stories_fact || 0
    };
  },

  async getGuestAccessByProject(projectId: string): Promise<GuestAccess[]> {
    const { data, error } = await supabase
      .from('guest_access')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return [];

    return data.map(item => ({
      id: item.id,
      projectId: item.project_id,
      token: item.token,
      permissions: item.permissions,
      isActive: item.is_active,
      createdBy: item.created_by,
      createdAt: item.created_at,
      lastUsedAt: item.last_used_at,
      managerName: item.manager_name,
      managerPhone: item.manager_phone,
      managerEmail: item.manager_email,
    }));
  },

  async updatePermissions(accessId: string, permissions: GuestPermission[]): Promise<void> {
    const { error } = await supabase
      .from('guest_access')
      .update({ permissions })
      .eq('id', accessId);

    if (error) throw error;
  },

  async updateManagerContacts(
    accessId: string,
    managerName?: string,
    managerPhone?: string,
    managerEmail?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('guest_access')
      .update({
        manager_name: managerName,
        manager_phone: managerPhone,
        manager_email: managerEmail
      })
      .eq('id', accessId);

    if (error) throw error;
  },

  async getAccessStats(accessId: string) {
    const { data: access, error: accessError } = await supabase
      .from('guest_access')
      .select('*, guest_project_access(count)')
      .eq('id', accessId)
      .maybeSingle();

    if (accessError || !access) return null;

    return {
      totalGuests: access.guest_project_access?.[0]?.count || 0,
      lastUsed: access.last_used_at,
      createdAt: access.created_at,
      isActive: access.is_active,
    };
  },

  hasPermission(access: GuestAccess | null, permission: GuestPermission): boolean {
    if (!access || !access.isActive) return false;
    return access.permissions.includes(permission);
  },
};
