import { supabase } from '../lib/supabase';

export interface ModuleAccess {
  module_slug: string;
  module_name: string;
  module_description: string;
  module_icon: string;
  is_available: boolean;
  is_unlocked: boolean;
  requires_unlock: boolean;
}

export const moduleAccessService = {
  async getOrganizationModules(organizationId: string, planName: string): Promise<ModuleAccess[]> {
    try {
      const { data, error } = await supabase.rpc('get_organization_module_access', {
        org_id: organizationId,
        plan: planName
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading modules:', error);
      return [];
    }
  },

  async unlockModule(organizationId: string, moduleSlug: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('organization_modules')
        .upsert({
          organization_id: organizationId,
          module_slug: moduleSlug,
          is_unlocked: true,
          unlocked_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,module_slug'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error unlocking module:', error);
      return false;
    }
  },

  async getAllModules() {
    try {
      const { data, error } = await supabase
        .from('platform_modules')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading all modules:', error);
      return [];
    }
  }
};
