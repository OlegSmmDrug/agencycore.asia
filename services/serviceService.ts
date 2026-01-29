import { supabase } from '../lib/supabase';
import { Service } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

const mapRowToService = (row: any): Service => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  isActive: row.is_active !== false,
  sortOrder: row.sort_order || 0,
  createdAt: row.created_at
});

export const serviceService = {
  async getAll(): Promise<Service[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching services:', error);
      throw error;
    }

    return (data || []).map(mapRowToService);
  },

  async getActive(): Promise<Service[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching active services:', error);
      throw error;
    }

    return (data || []).map(mapRowToService);
  },

  async create(service: Omit<Service, 'id' | 'createdAt'>): Promise<Service> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        name: service.name,
        description: service.description || '',
        is_active: service.isActive !== false,
        sort_order: service.sortOrder || 0,
        organization_id: organizationId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating service:', error);
      throw error;
    }

    return mapRowToService(data);
  },

  async update(id: string, updates: Partial<Service>): Promise<Service> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating service:', error);
      throw error;
    }

    return mapRowToService(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  }
};
