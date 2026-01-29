import { supabase } from '../lib/supabase';
import { GuestUser } from '../types';

export const guestUserService = {
  async quickRegisterGuest(
    name: string,
    email: string,
    phone?: string,
    emailNotifications: boolean = true
  ): Promise<GuestUser> {
    const { data: existing, error: checkError } = await supabase
      .from('guest_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        preferences: existing.preferences,
        createdAt: existing.created_at,
        lastAccessAt: existing.last_access_at,
      };
    }

    const { data, error } = await supabase
      .from('guest_users')
      .insert({
        name,
        email,
        phone,
        preferences: {
          emailNotifications,
          smsNotifications: false,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      preferences: data.preferences,
      createdAt: data.created_at,
      lastAccessAt: data.last_access_at,
    };
  },

  async linkGuestToProject(
    guestId: string,
    projectId: string,
    accessTokenId: string
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('guest_project_access')
      .select('*')
      .eq('guest_id', guestId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (existing) return;

    const { error } = await supabase
      .from('guest_project_access')
      .insert({
        guest_id: guestId,
        project_id: projectId,
        access_token_id: accessTokenId,
      });

    if (error) throw error;
  },

  async updateGuestProfile(
    guestId: string,
    updates: {
      name?: string;
      phone?: string;
      preferences?: {
        emailNotifications?: boolean;
        smsNotifications?: boolean;
      };
    }
  ): Promise<void> {
    const updateData: any = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.preferences) updateData.preferences = updates.preferences;

    const { error } = await supabase
      .from('guest_users')
      .update(updateData)
      .eq('id', guestId);

    if (error) throw error;
  },

  async getGuestById(guestId: string): Promise<GuestUser | null> {
    const { data, error } = await supabase
      .from('guest_users')
      .select('*')
      .eq('id', guestId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      preferences: data.preferences,
      createdAt: data.created_at,
      lastAccessAt: data.last_access_at,
    };
  },

  async getGuestByEmail(email: string): Promise<GuestUser | null> {
    const { data, error } = await supabase
      .from('guest_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      preferences: data.preferences,
      createdAt: data.created_at,
      lastAccessAt: data.last_access_at,
    };
  },

  async getGuestsByProject(projectId: string): Promise<GuestUser[]> {
    const { data, error } = await supabase
      .from('guest_project_access')
      .select('guest_users(*)')
      .eq('project_id', projectId);

    if (error || !data) return [];

    return data
      .filter(item => item.guest_users)
      .map((item: any) => ({
        id: item.guest_users.id,
        name: item.guest_users.name,
        email: item.guest_users.email,
        phone: item.guest_users.phone,
        preferences: item.guest_users.preferences,
        createdAt: item.guest_users.created_at,
        lastAccessAt: item.guest_users.last_access_at,
      }));
  },

  async trackGuestActivity(guestId: string): Promise<void> {
    await supabase
      .from('guest_users')
      .update({ last_access_at: new Date().toISOString() })
      .eq('id', guestId);
  },

  async getGuestActivity(guestId: string) {
    const { data: projects } = await supabase
      .from('guest_project_access')
      .select('project_id, registered_at')
      .eq('guest_id', guestId);

    const { data: guest } = await supabase
      .from('guest_users')
      .select('created_at, last_access_at')
      .eq('id', guestId)
      .maybeSingle();

    return {
      projectsCount: projects?.length || 0,
      registeredAt: guest?.created_at,
      lastAccess: guest?.last_access_at,
    };
  },
};
