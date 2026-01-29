import { supabase } from '../lib/supabase';
import { TaskType } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface DynamicTaskType {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'smm' | 'target' | 'sites' | 'video';
  serviceId: string;
  isDeprecated: boolean;
  svgPath?: string;
}

export interface StaticTaskType {
  id: TaskType;
  label: string;
  icon: string;
  color: string;
  svgPath: string;
}

const STATIC_TASK_TYPES: StaticTaskType[] = [
  {
    id: 'Task',
    label: 'ЗАДАЧА',
    icon: '📋',
    color: 'blue',
    svgPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
  },
  {
    id: 'Shooting',
    label: 'СЪЕМКА',
    icon: '🎥',
    color: 'rose',
    svgPath: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
  },
  {
    id: 'Meeting',
    label: 'ВСТРЕЧА',
    icon: '👥',
    color: 'amber',
    svgPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
  },
  {
    id: 'Call',
    label: 'ЗВОНОК',
    icon: '📞',
    color: 'emerald',
    svgPath: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z'
  }
];

const SERVICE_TYPE_COLORS: Record<string, string> = {
  'smm': 'blue',
  'target': 'purple',
  'sites': 'green',
  'video': 'rose'
};

export const taskTypeService = {
  getStaticTaskTypes(): StaticTaskType[] {
    return STATIC_TASK_TYPES;
  },

  async getDynamicTaskTypes(): Promise<DynamicTaskType[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('calculator_services')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching dynamic task types:', error);
      return [];
    }

    return (data || []).map(service => ({
      id: service.name,
      name: service.name,
      icon: service.icon,
      color: SERVICE_TYPE_COLORS[service.category] || 'blue',
      category: service.category,
      serviceId: service.id,
      isDeprecated: service.is_deprecated || false
    }));
  },

  async getAllTaskTypes(): Promise<{ static: StaticTaskType[], dynamic: DynamicTaskType[] }> {
    const dynamicTypes = await this.getDynamicTaskTypes();
    return {
      static: STATIC_TASK_TYPES,
      dynamic: dynamicTypes
    };
  },

  async getTaskTypeByName(name: string): Promise<StaticTaskType | DynamicTaskType | null> {
    const staticType = STATIC_TASK_TYPES.find(t => t.id === name);
    if (staticType) return staticType;

    const dynamicTypes = await this.getDynamicTaskTypes();
    return dynamicTypes.find(t => t.id === name) || null;
  },

  async getTaskTypeByServiceId(serviceId: string): Promise<DynamicTaskType | null> {
    const dynamicTypes = await this.getDynamicTaskTypes();
    return dynamicTypes.find(t => t.serviceId === serviceId) || null;
  },

  isStaticTaskType(typeName: string): boolean {
    return STATIC_TASK_TYPES.some(t => t.id === typeName);
  },

  getDefaultIconForType(typeName: string): string {
    const staticType = STATIC_TASK_TYPES.find(t => t.id === typeName);
    if (staticType) return staticType.icon;

    return '⚡';
  },

  getColorForCategory(category: 'smm' | 'target' | 'sites' | 'video'): string {
    return SERVICE_TYPE_COLORS[category] || 'blue';
  },

  async checkIfTaskTypeDeprecated(serviceId: string): Promise<boolean> {
    if (!serviceId) return false;

    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return false;

    const { data, error } = await supabase
      .from('calculator_services')
      .select('is_deprecated')
      .eq('id', serviceId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error || !data) return false;
    return data.is_deprecated || false;
  },

  subscribeToTaskTypeChanges(callback: () => void) {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return () => {};
    }

    const channel = supabase
      .channel('task_types_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calculator_services',
        filter: `organization_id=eq.${organizationId}`
      }, () => {
        callback();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
