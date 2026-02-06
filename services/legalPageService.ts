import { supabase } from '../lib/supabase';

export interface LegalPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  updated_at: string;
  created_at: string;
}

export const legalPageService = {
  async getPublishedPage(slug: string): Promise<LegalPage | null> {
    const { data, error } = await supabase
      .from('legal_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) {
      console.error('Error loading legal page:', error);
      return null;
    }
    return data;
  },

  async getAllPages(): Promise<LegalPage[]> {
    const { data, error } = await supabase
      .from('legal_pages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading legal pages:', error);
      return [];
    }
    return data || [];
  },

  async updatePage(id: string, updates: { title?: string; content?: string; is_published?: boolean }): Promise<boolean> {
    const { error } = await supabase
      .from('legal_pages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating legal page:', error);
      return false;
    }
    return true;
  }
};
