import { supabase } from '../lib/supabase';
import type { User } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  systemRole: string;
  organizationId: string | null;
  avatar?: string;
  jobTitle?: string;
  isSuperAdmin?: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  organizationName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export const authService = {
  async signUp(data: SignUpData): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      let organizationId: string | null = null;

      if (data.organizationName) {
        const slug = data.organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: data.organizationName,
            slug,
            owner_id: 'temp',
            industry: 'other',
            company_size: 'unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          })
          .select()
          .single();

        if (orgError) throw orgError;
        organizationId = orgData.id;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            system_role: organizationId ? 'Admin' : 'Member',
            organization_id: organizationId,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      if (organizationId) {
        await supabase
          .from('organizations')
          .update({ owner_id: authData.user.id })
          .eq('id', organizationId);
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single();

      if (!userData) throw new Error('User profile not found');

      return {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          systemRole: userData.system_role,
          organizationId: userData.organization_id,
          avatar: userData.avatar,
          jobTitle: userData.job_title,
          isSuperAdmin: userData.is_super_admin || false,
        },
        error: null,
      };
    } catch (error) {
      return {
        user: null,
        error: error as Error,
      };
    }
  },

  async signIn(data: SignInData): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      console.log('🔐 Attempting sign in for:', data.email);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', data.email)
        .maybeSingle();

      if (userError) {
        console.error('❌ Database error:', userError);
        throw new Error('Database error');
      }

      if (!userData) {
        console.log('❌ User not found');
        throw new Error('Неверная почта или пароль');
      }

      if (userData.password !== data.password) {
        console.log('❌ Password mismatch');
        throw new Error('Неверная почта или пароль');
      }

      console.log('✅ Login successful:', userData.email);
      console.log('📦 User data from DB:', {
        id: userData.id,
        email: userData.email,
        organization_id: userData.organization_id,
        system_role: userData.system_role
      });

      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        systemRole: userData.system_role,
        organizationId: userData.organization_id,
        avatar: userData.avatar,
        jobTitle: userData.job_title,
        isSuperAdmin: userData.is_super_admin || false,
      };

      console.log('💾 Saving to localStorage:', authUser);
      localStorage.setItem('currentUser', JSON.stringify(authUser));

      const saved = localStorage.getItem('currentUser');
      console.log('✅ Verified saved data:', saved);

      return {
        user: authUser,
        error: null,
      };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      return {
        user: null,
        error: error as Error,
      };
    }
  },

  async signOut(): Promise<{ error: Error | null }> {
    try {
      localStorage.removeItem('currentUser');
      await supabase.auth.signOut();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        return JSON.parse(storedUser);
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .maybeSingle();

      if (!userData) return null;

      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        systemRole: userData.system_role,
        organizationId: userData.organization_id,
        avatar: userData.avatar,
        jobTitle: userData.job_title,
        isSuperAdmin: userData.is_super_admin || false,
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    const checkUser = async () => {
      const user = await this.getCurrentUser();
      callback(user);
    };

    checkUser();

    return supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session?.user) {
          const user = await this.getCurrentUser();
          callback(user);
        } else {
          const storedUser = localStorage.getItem('currentUser');
          if (storedUser) {
            callback(JSON.parse(storedUser));
          } else {
            callback(null);
          }
        }
      })();
    });
  },

  async updateProfile(updates: Partial<User>): Promise<{ error: Error | null }> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('users')
        .update({
          name: updates.name,
          job_title: updates.jobTitle,
          avatar: updates.avatar,
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (updates.name) user.name = updates.name;
        if (updates.jobTitle) user.jobTitle = updates.jobTitle;
        if (updates.avatar) user.avatar = updates.avatar;
        localStorage.setItem('currentUser', JSON.stringify(user));
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser && updates.name) {
        await supabase.auth.updateUser({
          data: { full_name: updates.name },
        });
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async registerOrganization(data: {
    companyName: string;
    ownerName: string;
    email: string;
    password: string;
    industry?: string;
    companySize?: string;
  }): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      const { organizationService } = await import('./organizationService');

      const existingUser = await supabase
        .from('users')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();

      if (existingUser.data) {
        throw new Error('Пользователь с таким email уже существует');
      }

      const slug = data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '');

      const tempUserId = crypto.randomUUID();

      const organization = await organizationService.createOrganization({
        name: data.companyName,
        slug: slug,
        ownerId: tempUserId,
        industry: data.industry,
        companySize: data.companySize,
      });

      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          id: tempUserId,
          email: data.email,
          name: data.ownerName,
          password: data.password,
          system_role: 'Admin',
          organization_id: organization.id,
          job_title: 'CEO',
        })
        .select()
        .single();

      if (userError) throw userError;

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.system_role,
        organizationId: user.organization_id,
        avatar: user.avatar,
        jobTitle: user.job_title,
      };

      localStorage.setItem('currentUser', JSON.stringify(authUser));

      return { user: authUser, error: null };
    } catch (error) {
      console.error('Registration error:', error);
      return { user: null, error: error as Error };
    }
  },
};
