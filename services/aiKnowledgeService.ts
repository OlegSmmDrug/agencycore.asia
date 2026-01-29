import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { FAQItem, DocumentItem } from '../types';

export const aiKnowledgeService = {
  async getFAQs(agentId: string): Promise<FAQItem[]> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_knowledge_faqs')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', organizationId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching FAQs:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category || 'General',
      priority: row.priority || 0
    }));
  },

  async addFAQ(agentId: string, faq: Omit<FAQItem, 'id'>): Promise<FAQItem> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_knowledge_faqs')
      .insert({
        agent_id: agentId,
        organization_id: organizationId,
        question: faq.question,
        answer: faq.answer,
        category: faq.category || 'General',
        priority: faq.priority || 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding FAQ:', error);
      throw error;
    }

    return {
      id: data.id,
      question: data.question,
      answer: data.answer,
      category: data.category,
      priority: data.priority
    };
  },

  async updateFAQ(id: string, updates: Partial<Omit<FAQItem, 'id'>>): Promise<void> {
    const { error } = await supabase
      .from('ai_knowledge_faqs')
      .update({
        question: updates.question,
        answer: updates.answer,
        category: updates.category,
        priority: updates.priority,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating FAQ:', error);
      throw error;
    }
  },

  async deleteFAQ(id: string): Promise<void> {
    const { error } = await supabase
      .from('ai_knowledge_faqs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting FAQ:', error);
      throw error;
    }
  },

  async getDocuments(agentId: string): Promise<DocumentItem[]> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_documents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      fileUrl: row.file_url,
      fileType: row.file_type,
      uploadedAt: row.created_at
    }));
  },

  async uploadDocument(agentId: string, file: File): Promise<DocumentItem> {
    const organizationId = getCurrentOrganizationId();
    const fileExt = file.name.split('.').pop();
    const fileName = `${agentId}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ai-documents')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('ai-documents')
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('ai_documents')
      .insert({
        agent_id: agentId,
        organization_id: organizationId,
        title: file.name,
        file_url: urlData.publicUrl,
        file_type: fileExt || 'unknown',
        content_text: ''
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving document metadata:', error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      fileUrl: data.file_url,
      fileType: data.file_type,
      uploadedAt: data.created_at
    };
  },

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
      .from('ai_documents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  async searchKnowledge(query: string, agentId: string): Promise<FAQItem[]> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('ai_knowledge_faqs')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', organizationId)
      .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
      .order('priority', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
      priority: row.priority
    }));
  }
};
