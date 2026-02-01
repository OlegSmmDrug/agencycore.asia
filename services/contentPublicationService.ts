import { supabase } from '../lib/supabase';

export interface ContentPublication {
  id: string;
  projectId: string;
  contentType: string;
  publishedAt: string;
  assignedUserId: string;
  organizationId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublicationData {
  projectId: string;
  contentType: string;
  publishedAt: string;
  assignedUserId: string;
  organizationId: string;
  description?: string;
}

export const contentPublicationService = {
  async create(data: CreatePublicationData): Promise<ContentPublication | null> {
    const { data: publication, error } = await supabase
      .from('content_publications')
      .insert({
        project_id: data.projectId,
        content_type: data.contentType,
        published_at: data.publishedAt,
        assigned_user_id: data.assignedUserId,
        organization_id: data.organizationId,
        description: data.description
      })
      .select()
      .single();

    if (error) {
      console.error('[Content Publication Service] Error creating publication:', error);
      return null;
    }

    return this.mapFromDB(publication);
  },

  async createBulk(publications: CreatePublicationData[]): Promise<boolean> {
    const { error } = await supabase
      .from('content_publications')
      .insert(
        publications.map(p => ({
          project_id: p.projectId,
          content_type: p.contentType,
          published_at: p.publishedAt,
          assigned_user_id: p.assignedUserId,
          organization_id: p.organizationId,
          description: p.description
        }))
      );

    if (error) {
      console.error('[Content Publication Service] Error creating bulk publications:', error);
      return false;
    }

    return true;
  },

  async getByProject(projectId: string): Promise<ContentPublication[]> {
    const { data, error } = await supabase
      .from('content_publications')
      .select('*')
      .eq('project_id', projectId)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('[Content Publication Service] Error fetching publications:', error);
      return [];
    }

    return (data || []).map(this.mapFromDB);
  },

  async getByUser(userId: string, startDate?: string, endDate?: string): Promise<ContentPublication[]> {
    let query = supabase
      .from('content_publications')
      .select('*')
      .eq('assigned_user_id', userId);

    if (startDate) {
      query = query.gte('published_at', startDate);
    }
    if (endDate) {
      query = query.lte('published_at', endDate);
    }

    const { data, error } = await query.order('published_at', { ascending: false });

    if (error) {
      console.error('[Content Publication Service] Error fetching user publications:', error);
      return [];
    }

    return (data || []).map(this.mapFromDB);
  },

  async getByMonth(organizationId: string, month: string): Promise<ContentPublication[]> {
    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

    const { data, error } = await supabase
      .from('content_publications')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('published_at', monthStart.toISOString())
      .lte('published_at', monthEnd.toISOString())
      .order('published_at', { ascending: false });

    if (error) {
      console.error('[Content Publication Service] Error fetching monthly publications:', error);
      return [];
    }

    return (data || []).map(this.mapFromDB);
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('content_publications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Content Publication Service] Error deleting publication:', error);
      return false;
    }

    return true;
  },

  async update(id: string, updates: Partial<CreatePublicationData>): Promise<boolean> {
    const dbUpdates: Record<string, any> = {};

    if (updates.contentType) dbUpdates.content_type = updates.contentType;
    if (updates.publishedAt) dbUpdates.published_at = updates.publishedAt;
    if (updates.assignedUserId) dbUpdates.assigned_user_id = updates.assignedUserId;
    if (updates.description !== undefined) dbUpdates.description = updates.description;

    const { error } = await supabase
      .from('content_publications')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('[Content Publication Service] Error updating publication:', error);
      return false;
    }

    return true;
  },

  mapFromDB(data: any): ContentPublication {
    return {
      id: data.id,
      projectId: data.project_id,
      contentType: data.content_type,
      publishedAt: data.published_at,
      assignedUserId: data.assigned_user_id,
      organizationId: data.organization_id,
      description: data.description,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
};
