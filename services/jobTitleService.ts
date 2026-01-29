import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface JobTitle {
  id: string;
  title: string;
  isActive: boolean;
  createdAt: string;
}

export const jobTitleService = {
  async getAll(): Promise<string[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('job_titles')
      .select('title')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('title');

    if (error) {
      console.error('Error fetching job titles:', error);
      return [];
    }

    return (data || []).map(row => row.title);
  },

  async getAllDetailed(): Promise<JobTitle[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('job_titles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('title');

    if (error) {
      console.error('Error fetching detailed job titles:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      isActive: row.is_active,
      createdAt: row.created_at
    }));
  },

  async create(title: string): Promise<string> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const insertData: any = {
      title,
      organization_id: organizationId
    };

    const { data, error } = await supabase
      .from('job_titles')
      .insert(insertData)
      .select('title')
      .single();

    if (error) {
      if (error.code === '23505') {
        console.error('Job title already exists');
        throw new Error('Должность с таким названием уже существует');
      }
      console.error('Error creating job title:', error);
      throw error;
    }

    return data.title;
  },

  async update(id: string, title: string): Promise<JobTitle> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('job_titles')
      .update({ title })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating job title:', error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      isActive: data.is_active,
      createdAt: data.created_at
    };
  },

  async deactivate(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('job_titles')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deactivating job title:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('job_titles')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting job title:', error);
      throw error;
    }
  }
};
