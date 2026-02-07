import { supabase } from '../lib/supabase';
import { User, SystemRole } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

function parseBirthdayFromIIN(iin?: string | null): string | undefined {
  if (!iin) return undefined;
  const digits = iin.replace(/\D/g, '');
  if (digits.length < 7) return undefined;
  const yy = parseInt(digits.substring(0, 2), 10);
  const mm = parseInt(digits.substring(2, 4), 10);
  const dd = parseInt(digits.substring(4, 6), 10);
  const century = parseInt(digits.substring(6, 7), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  let year: number;
  if (century >= 1 && century <= 2) year = 1800 + yy;
  else if (century >= 3 && century <= 4) year = 1900 + yy;
  else if (century >= 5 && century <= 6) year = 2000 + yy;
  else year = yy >= 50 ? 1900 + yy : 2000 + yy;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export const userService = {
  async getAll(): Promise<User[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar || '',
      password: row.password || '',
      systemRole: row.system_role as SystemRole,
      jobTitle: row.job_title,
      allowedModules: row.allowed_modules || [],
      teamLeadId: row.team_lead_id || undefined,
      salary: Number(row.salary) || 0,
      iin: row.iin || '',
      phone: row.phone || '',
      birthday: row.birthday || parseBirthdayFromIIN(row.iin),
      balance: Number(row.balance) || 0
    }));
  },

  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar || '',
      password: data.password || '',
      systemRole: data.system_role as SystemRole,
      jobTitle: data.job_title,
      allowedModules: data.allowed_modules || [],
      teamLeadId: data.team_lead_id || undefined,
      salary: Number(data.salary) || 0,
      iin: data.iin || '',
      phone: data.phone || '',
      birthday: data.birthday || undefined,
      balance: Number(data.balance) || 0
    };
  },

  async update(user: User): Promise<User> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        password: user.password,
        system_role: user.systemRole,
        job_title: user.jobTitle,
        allowed_modules: user.allowedModules,
        team_lead_id: user.teamLeadId || null,
        salary: user.salary,
        iin: user.iin || null,
        phone: user.phone || null,
        birthday: user.birthday || parseBirthdayFromIIN(user.iin) || null,
        balance: user.balance || 0
      })
      .eq('id', user.id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar || '',
      password: data.password || '',
      systemRole: data.system_role as SystemRole,
      jobTitle: data.job_title,
      allowedModules: data.allowed_modules || [],
      teamLeadId: data.team_lead_id || undefined,
      salary: Number(data.salary) || 0,
      iin: data.iin || '',
      phone: data.phone || '',
      birthday: data.birthday || undefined,
      balance: Number(data.balance) || 0
    };
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        password: user.password || '123456',
        system_role: user.systemRole,
        job_title: user.jobTitle,
        allowed_modules: user.allowedModules,
        team_lead_id: user.teamLeadId || null,
        salary: user.salary,
        iin: user.iin || null,
        phone: user.phone || null,
        birthday: user.birthday || parseBirthdayFromIIN(user.iin) || null,
        balance: user.balance || 0,
        organization_id: organizationId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar || '',
      password: data.password || '',
      systemRole: data.system_role as SystemRole,
      jobTitle: data.job_title,
      allowedModules: data.allowed_modules || [],
      teamLeadId: data.team_lead_id || undefined,
      salary: Number(data.salary) || 0,
      iin: data.iin || '',
      phone: data.phone || '',
      birthday: data.birthday || undefined,
      balance: Number(data.balance) || 0
    };
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    try {
      await supabase.from('activity_log').delete().eq('user_id', id).eq('organization_id', organizationId);
      await supabase.from('crm_activity_log').delete().eq('user_id', id);
      await supabase.from('crm_activity_logs').delete().eq('user_id', id);
      await supabase.from('notifications').delete().eq('user_id', id);
      await supabase.from('whatsapp_messages').delete().eq('user_id', id).eq('organization_id', organizationId);
      await supabase.from('whatsapp_templates').delete().eq('created_by', id);

      await supabase.from('tasks').update({ assignee_id: null }).eq('assignee_id', id).eq('organization_id', organizationId);
      await supabase.from('tasks').update({ creator_id: null }).eq('creator_id', id).eq('organization_id', organizationId);

      await supabase.from('clients').update({ manager_id: null }).eq('manager_id', id).eq('organization_id', organizationId);

      await supabase.from('contract_instances').update({ created_by: null }).eq('created_by', id).eq('organization_id', organizationId);
      await supabase.from('contract_templates').update({ author_id: null }).eq('author_id', id).eq('organization_id', organizationId);
      await supabase.from('documents').update({ author_id: null }).eq('author_id', id);
      await supabase.from('notes').update({ author_id: null }).eq('author_id', id).eq('organization_id', organizationId);
      await supabase.from('guest_access').update({ created_by: null }).eq('created_by', id).eq('organization_id', organizationId);
      await supabase.from('project_expenses').update({ created_by: null }).eq('created_by', id).eq('organization_id', organizationId);
      await supabase.from('project_expenses').update({ updated_by: null }).eq('updated_by', id).eq('organization_id', organizationId);
      await supabase.from('project_expenses_history').update({ changed_by: null }).eq('changed_by', id).eq('organization_id', organizationId);
      await supabase.from('project_legal_documents').update({ uploaded_by: null }).eq('uploaded_by', id).eq('organization_id', organizationId);
      await supabase.from('transactions').update({ created_by: null }).eq('created_by', id).eq('organization_id', organizationId);

      await supabase.from('project_members').delete().eq('user_id', id);

      await supabase.from('payroll_records').delete().eq('user_id', id).eq('organization_id', organizationId);

      await supabase.from('users').update({ team_lead_id: null }).eq('team_lead_id', id).eq('organization_id', organizationId);

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Error deleting user:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in cascading delete:', error);
      throw error;
    }
  },

  async updateProfile(userId: string, updates: {
    name?: string;
    jobTitle?: string;
    iin?: string;
    phone?: string;
    avatar?: string;
  }): Promise<User> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.jobTitle !== undefined) updateData.job_title = updates.jobTitle;
    if (updates.iin !== undefined) {
      updateData.iin = updates.iin || null;
      const bd = parseBirthdayFromIIN(updates.iin);
      if (bd) updateData.birthday = bd;
    }
    if (updates.phone !== undefined) updateData.phone = updates.phone || null;
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar || '',
      password: data.password || '',
      systemRole: data.system_role as SystemRole,
      jobTitle: data.job_title,
      allowedModules: data.allowed_modules || [],
      teamLeadId: data.team_lead_id || undefined,
      salary: Number(data.salary) || 0,
      iin: data.iin || '',
      phone: data.phone || '',
      birthday: data.birthday || undefined,
      balance: Number(data.balance) || 0
    };
  },

  async updateEmail(userId: string, newEmail: string): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({ email: newEmail })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user email:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar || '',
      password: data.password || '',
      systemRole: data.system_role as SystemRole,
      jobTitle: data.job_title,
      allowedModules: data.allowed_modules || [],
      teamLeadId: data.team_lead_id || undefined,
      salary: Number(data.salary) || 0,
      iin: data.iin || '',
      phone: data.phone || '',
      birthday: data.birthday || undefined,
      balance: Number(data.balance) || 0
    };
  },

  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const { data: userData, error: checkError } = await supabase
      .from('users')
      .select('password')
      .eq('id', userId)
      .single();

    if (checkError) {
      console.error('Error fetching user password:', checkError);
      throw checkError;
    }

    if (userData.password !== currentPassword) {
      throw new Error('Current password is incorrect');
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }
  }
};
