import { supabase } from '../lib/supabase';
import { Document } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export const documentService = {
  async getAll(): Promise<Document[]> {
    const organizationId = getCurrentOrganizationId();

    if (!organizationId) {
      console.warn('⚠️ No organization ID found for documents');
      return [];
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      parentId: row.parent_id || null,
      title: row.title,
      icon: row.icon || undefined,
      content: row.content || '',
      authorId: row.author_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
      allowedUserIds: row.allowed_user_ids || [],
      isPublic: row.is_public || false,
      publicLink: row.public_link || undefined,
      isArchived: row.is_archived || false,
      isFolder: row.is_folder || false
    }));
  },

  async getById(id: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching document by ID:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      parentId: data.parent_id || null,
      title: data.title,
      icon: data.icon || undefined,
      content: data.content || '',
      authorId: data.author_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
      allowedUserIds: data.allowed_user_ids || [],
      isPublic: data.is_public || false,
      publicLink: data.public_link || undefined,
      isArchived: data.is_archived || false,
      isFolder: data.is_folder || false
    };
  },

  async create(doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const organizationId = getCurrentOrganizationId();

    if (!organizationId) {
      throw new Error('Organization ID is required to create document');
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        organization_id: organizationId,
        parent_id: doc.parentId || null,
        title: doc.title,
        icon: doc.icon || null,
        content: doc.content || '',
        author_id: doc.authorId,
        allowed_user_ids: doc.allowedUserIds || [],
        is_public: doc.isPublic || false,
        public_link: doc.publicLink || null,
        is_archived: doc.isArchived || false,
        is_folder: doc.isFolder || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      throw error;
    }

    return {
      id: data.id,
      parentId: data.parent_id || null,
      title: data.title,
      icon: data.icon || undefined,
      content: data.content || '',
      authorId: data.author_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
      allowedUserIds: data.allowed_user_ids || [],
      isPublic: data.is_public || false,
      publicLink: data.public_link || undefined,
      isArchived: data.is_archived || false,
      isFolder: data.is_folder || false
    };
  },

  async update(id: string, updates: Partial<Document>): Promise<Document> {
    const organizationId = getCurrentOrganizationId();

    if (!organizationId) {
      throw new Error('Organization ID is required to update document');
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.parentId !== undefined) updateData.parent_id = updates.parentId;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.authorId !== undefined) updateData.author_id = updates.authorId;
    if (updates.allowedUserIds !== undefined) updateData.allowed_user_ids = updates.allowedUserIds;
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
    if (updates.publicLink !== undefined) updateData.public_link = updates.publicLink;
    if (updates.isArchived !== undefined) updateData.is_archived = updates.isArchived;
    if (updates.isFolder !== undefined) updateData.is_folder = updates.isFolder;

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating document:', error);
      throw error;
    }

    return {
      id: data.id,
      parentId: data.parent_id || null,
      title: data.title,
      icon: data.icon || undefined,
      content: data.content || '',
      authorId: data.author_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
      allowedUserIds: data.allowed_user_ids || [],
      isPublic: data.is_public || false,
      publicLink: data.public_link || undefined,
      isArchived: data.is_archived || false,
      isFolder: data.is_folder || false
    };
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();

    if (!organizationId) {
      throw new Error('Organization ID is required to delete document');
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
};
