import { supabase } from '../lib/supabase';
import { ServiceItem } from '../components/ServiceCalculator';
import { getCurrentOrganizationId } from '../utils/organizationContext';

const mapRowToServiceItem = (row: any): ServiceItem => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  type: row.type as 'checkbox' | 'counter' | 'range',
  icon: row.icon,
  category: row.category,
  max: row.max_value
});

export const calculatorService = {
  async getAll(): Promise<ServiceItem[]> {
    const organizationId = getCurrentOrganizationId();
    console.log('📊 Loading calculator services for organization:', organizationId);

    if (!organizationId) {
      console.warn('⚠️ No organization ID found in localStorage');
      const storedUser = localStorage.getItem('currentUser');
      console.log('Current user in localStorage:', storedUser);
      return [];
    }

    const { data, error } = await supabase
      .from('calculator_services')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Error fetching calculator services:', error);
      throw error;
    }

    console.log(`✅ Loaded ${data?.length || 0} calculator services`);
    return (data || []).map(mapRowToServiceItem);
  },

  async create(service: Omit<ServiceItem, 'id'>): Promise<ServiceItem> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const id = `srv_${Date.now()}`;

    const { data, error } = await supabase
      .from('calculator_services')
      .insert({
        id,
        name: service.name,
        price: service.price,
        type: service.type,
        icon: service.icon,
        category: service.category,
        max_value: service.max,
        is_active: true,
        sort_order: 999,
        organization_id: organizationId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating calculator service:', error);
      throw error;
    }

    return mapRowToServiceItem(data);
  },

  async update(id: string, updates: Partial<ServiceItem>): Promise<ServiceItem> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.max !== undefined) updateData.max_value = updates.max;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('calculator_services')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating calculator service:', error);
      throw error;
    }

    return mapRowToServiceItem(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('calculator_services')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting calculator service:', error);
      throw error;
    }
  },

  subscribeToChanges(callback: (services: ServiceItem[]) => void) {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return () => {};
    }

    const channel = supabase
      .channel('calculator_services_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calculator_services',
        filter: `organization_id=eq.${organizationId}`
      }, async () => {
        const services = await calculatorService.getAll();
        callback(services);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
