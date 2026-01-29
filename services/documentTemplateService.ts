import { supabase } from '../lib/supabase';

export interface DocumentTemplate {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  description?: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  parsedVariables: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

const mapRowToTemplate = (row: any): DocumentTemplate => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  category: row.category,
  description: row.description,
  filePath: row.file_path,
  fileName: row.file_name,
  fileSize: row.file_size,
  parsedVariables: row.parsed_variables || [],
  usageCount: row.usage_count || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const documentTemplateService = {
  async getAll(): Promise<DocumentTemplate[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToTemplate);
  },

  async getById(id: string): Promise<DocumentTemplate | null> {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToTemplate(data) : null;
  },

  async getByCategory(category: string): Promise<DocumentTemplate[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('category', category)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapRowToTemplate);
  },

  async uploadTemplate(file: File, name: string, category: string, description?: string): Promise<DocumentTemplate> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) throw new Error('No organization ID');

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${organizationId}/${timestamp}_${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('document-templates')
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    const parsedVariables = await this.parseVariablesFromFile(file);

    const { data, error } = await supabase
      .from('document_templates')
      .insert({
        organization_id: organizationId,
        name,
        category,
        description,
        file_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        parsed_variables: parsedVariables
      })
      .select()
      .single();

    if (error) throw error;
    return mapRowToTemplate(data);
  },

  async parseVariablesFromFile(file: File): Promise<string[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();

      const PizZip = (await import('pizzip')).default;
      const zip = new PizZip(arrayBuffer);

      const documentXml = zip.file('word/document.xml')?.asText();
      if (!documentXml) {
        console.warn('Could not find document.xml in .docx file');
        return [];
      }

      const cleanText = documentXml.replace(/<[^>]+>/g, '');

      const variableRegex = /\{\{([^}]+)\}\}/g;
      const matches = cleanText.matchAll(variableRegex);
      const variables = new Set<string>();

      for (const match of matches) {
        const varName = match[1].trim();
        if (varName) {
          variables.add(varName);
        }
      }

      return Array.from(variables).sort();
    } catch (error) {
      console.error('Error parsing variables:', error);
      return [];
    }
  },

  async update(id: string, updates: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.description !== undefined) updateData.description = updates.description;

    const { data, error } = await supabase
      .from('document_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapRowToTemplate(data);
  },

  async delete(id: string): Promise<void> {
    const template = await this.getById(id);
    if (!template) throw new Error('Template not found');

    const { error: storageError } = await supabase.storage
      .from('document-templates')
      .remove([template.filePath]);

    if (storageError) console.error('Error deleting file:', storageError);

    const { error } = await supabase
      .from('document_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async downloadTemplate(template: DocumentTemplate): Promise<Blob> {
    const { data, error } = await supabase.storage
      .from('document-templates')
      .download(template.filePath);

    if (error) throw error;
    if (!data) throw new Error('No file data');

    return data;
  }
};
