import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface ServiceMapping {
  id: string;
  organizationId: string;
  serviceId: string;
  taskType: string | null;
  metricLabel: string;
  showInWidget: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentMetric {
  plan: number;
  fact: number;
}

export interface ContentMetrics {
  [key: string]: ContentMetric;
}

const mapRowToServiceMapping = (row: any): ServiceMapping => ({
  id: row.id,
  organizationId: row.organization_id,
  serviceId: row.service_id,
  taskType: row.task_type,
  metricLabel: row.metric_label,
  showInWidget: row.show_in_widget,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const serviceMappingService = {
  async getAll(): Promise<ServiceMapping[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('service_task_mappings')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching service mappings:', error);
      throw error;
    }

    return (data || []).map(mapRowToServiceMapping);
  },

  async getWidgetMappings(): Promise<ServiceMapping[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('service_task_mappings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('show_in_widget', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching widget mappings:', error);
      throw error;
    }

    return (data || []).map(mapRowToServiceMapping);
  },

  async getByServiceId(serviceId: string): Promise<ServiceMapping | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return null;
    }

    const { data, error } = await supabase
      .from('service_task_mappings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('service_id', serviceId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching service mapping:', error);
      throw error;
    }

    return data ? mapRowToServiceMapping(data) : null;
  },

  async create(mapping: Omit<ServiceMapping, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<ServiceMapping> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('service_task_mappings')
      .insert({
        organization_id: organizationId,
        service_id: mapping.serviceId,
        task_type: mapping.taskType,
        metric_label: mapping.metricLabel,
        show_in_widget: mapping.showInWidget,
        sort_order: mapping.sortOrder
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating service mapping:', error);
      throw error;
    }

    return mapRowToServiceMapping(data);
  },

  async update(id: string, updates: Partial<Omit<ServiceMapping, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<ServiceMapping> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.serviceId !== undefined) updateData.service_id = updates.serviceId;
    if (updates.taskType !== undefined) updateData.task_type = updates.taskType;
    if (updates.metricLabel !== undefined) updateData.metric_label = updates.metricLabel;
    if (updates.showInWidget !== undefined) updateData.show_in_widget = updates.showInWidget;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from('service_task_mappings')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating service mapping:', error);
      throw error;
    }

    return mapRowToServiceMapping(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('service_task_mappings')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting service mapping:', error);
      throw error;
    }
  },

  async getMappingKey(serviceId: string): Promise<string | null> {
    const mapping = await this.getByServiceId(serviceId);
    if (!mapping) return null;

    return mapping.metricLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  },

  subscribeToChanges(callback: (mappings: ServiceMapping[]) => void) {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return () => {};
    }

    const channel = supabase
      .channel('service_mappings_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_task_mappings',
        filter: `organization_id=eq.${organizationId}`
      }, async () => {
        const mappings = await serviceMappingService.getAll();
        callback(mappings);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
