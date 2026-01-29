import { supabase } from '../lib/supabase';
import { Note } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

const mapNoteFromDb = (row: any): Note => ({
  id: row.id,
  title: row.title || '',
  content: row.content || '',
  authorId: row.author_id,
  projectId: row.project_id || undefined,
  clientId: row.client_id || undefined,
  tags: row.tags || [],
  isPinned: row.is_pinned || false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapNoteToDb = (note: Partial<Note>) => ({
  title: note.title,
  content: note.content,
  author_id: note.authorId,
  project_id: note.projectId || null,
  client_id: note.clientId || null,
  tags: note.tags || [],
  is_pinned: note.isPinned || false,
  updated_at: new Date().toISOString(),
});

export const noteService = {
  async getAll(): Promise<Note[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      throw error;
    }

    return (data || []).map(mapNoteFromDb);
  },

  async getById(id: string): Promise<Note | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return null;
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching note:', error);
      throw error;
    }

    return data ? mapNoteFromDb(data) : null;
  },

  async getByProject(projectId: string): Promise<Note[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return [];
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching project notes:', error);
      throw error;
    }

    return (data || []).map(mapNoteFromDb);
  },

  async getByClient(clientId: string): Promise<Note[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return [];
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching client notes:', error);
      throw error;
    }

    return (data || []).map(mapNoteFromDb);
  },

  async getPersonal(userId: string): Promise<Note[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return [];
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('author_id', userId)
      .eq('organization_id', organizationId)
      .is('project_id', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching personal notes:', error);
      throw error;
    }

    return (data || []).map(mapNoteFromDb);
  },

  async create(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        ...mapNoteToDb(note),
        organization_id: organizationId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      throw error;
    }

    return mapNoteFromDb(data);
  },

  async update(id: string, updates: Partial<Note>): Promise<Note> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('notes')
      .update(mapNoteToDb(updates))
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating note:', error);
      throw error;
    }

    return mapNoteFromDb(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  },

  async togglePin(id: string, isPinned: boolean): Promise<Note> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data, error } = await supabase
      .from('notes')
      .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling pin:', error);
      throw error;
    }

    return mapNoteFromDb(data);
  },
};
