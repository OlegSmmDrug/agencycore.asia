import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export interface CalculatorCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

const mapRowToCategory = (row: any): CalculatorCategory => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  sortOrder: row.sort_order,
  isActive: row.is_active
});

export const calculatorCategoryService = {
  async getAll(): Promise<CalculatorCategory[]> {
    const organizationId = getCurrentOrganizationId();
    console.log('📊 Loading calculator categories for organization:', organizationId);

    if (!organizationId) {
      console.warn('⚠️ No organization ID found in localStorage');
      const storedUser = localStorage.getItem('currentUser');
      console.log('Current user in localStorage:', storedUser);
      return [];
    }

    const { data, error } = await supabase
      .from('calculator_categories')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('❌ Error fetching calculator categories:', error);
      throw error;
    }

    console.log(`✅ Loaded ${data?.length || 0} calculator categories`);
    return (data || []).map(mapRowToCategory);
  },

  async create(category: Omit<CalculatorCategory, 'sortOrder' | 'isActive'>): Promise<CalculatorCategory> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const maxSortOrder = await this.getMaxSortOrder();

    const { data, error } = await supabase
      .from('calculator_categories')
      .insert({
        id: category.id,
        organization_id: organizationId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        sort_order: maxSortOrder + 1,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating calculator category:', error);
      throw error;
    }

    return mapRowToCategory(data);
  },

  async update(id: string, updates: Partial<CalculatorCategory>): Promise<CalculatorCategory> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('calculator_categories')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating calculator category:', error);
      throw error;
    }

    return mapRowToCategory(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const servicesCount = await supabase
      .from('calculator_services')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('category', id);

    if (servicesCount.count && servicesCount.count > 0) {
      throw new Error('Невозможно удалить раздел, содержащий услуги. Сначала удалите все услуги из этого раздела.');
    }

    const { error } = await supabase
      .from('calculator_categories')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting calculator category:', error);
      throw error;
    }
  },

  async getMaxSortOrder(): Promise<number> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return 0;
    }

    const { data, error } = await supabase
      .from('calculator_categories')
      .select('sort_order')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error getting max sort order:', error);
      return 0;
    }

    return data?.sort_order || 0;
  },

  subscribeToChanges(callback: (categories: CalculatorCategory[]) => void) {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return () => {};
    }

    const channel = supabase
      .channel('calculator_categories_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calculator_categories',
        filter: `organization_id=eq.${organizationId}`
      }, async () => {
        const categories = await calculatorCategoryService.getAll();
        callback(categories);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
