import { supabase } from '../lib/supabase';

export interface ProjectLegalDocument {
  id: string;
  projectId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  description: string;
  uploadedBy: string | null;
  uploadedAt: string;
  isContract: boolean;
  createdAt: string;
}

const BUCKET_NAME = 'project-legal-documents';

export const projectLegalDocumentsService = {
  async getDocumentsByProject(projectId: string): Promise<ProjectLegalDocument[]> {
    const { data, error } = await supabase
      .from('project_legal_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching legal documents:', error);
      return [];
    }

    return (data || []).map(doc => ({
      id: doc.id,
      projectId: doc.project_id,
      fileName: doc.file_name,
      filePath: doc.file_path,
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      description: doc.description,
      uploadedBy: doc.uploaded_by,
      uploadedAt: doc.uploaded_at,
      isContract: doc.is_contract,
      createdAt: doc.created_at
    }));
  },

  async uploadDocument(
    projectId: string,
    file: File,
    description: string,
    uploadedBy: string,
    isContract: boolean = false
  ): Promise<ProjectLegalDocument | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${projectId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw new Error('Ошибка загрузки файла');
    }

    const { data, error } = await supabase
      .from('project_legal_documents')
      .insert({
        project_id: projectId,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        description: description,
        uploaded_by: uploadedBy,
        is_contract: isContract
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating document record:', error);
      await supabase.storage.from(BUCKET_NAME).remove([fileName]);
      throw new Error('Ошибка сохранения информации о документе');
    }

    return {
      id: data.id,
      projectId: data.project_id,
      fileName: data.file_name,
      filePath: data.file_path,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      description: data.description,
      uploadedBy: data.uploaded_by,
      uploadedAt: data.uploaded_at,
      isContract: data.is_contract,
      createdAt: data.created_at
    };
  },

  async deleteDocument(documentId: string): Promise<boolean> {
    const { data: doc, error: fetchError } = await supabase
      .from('project_legal_documents')
      .select('file_path')
      .eq('id', documentId)
      .maybeSingle();

    if (fetchError || !doc) {
      console.error('Error fetching document for deletion:', fetchError);
      return false;
    }

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([doc.file_path]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
    }

    const { error: dbError } = await supabase
      .from('project_legal_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      console.error('Error deleting document record:', dbError);
      return false;
    }

    return true;
  },

  async getDocumentUrl(filePath: string): Promise<string | null> {
    const { data } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600);

    return data?.signedUrl || null;
  },

  async downloadDocument(filePath: string, fileName: string): Promise<void> {
    const url = await this.getDocumentUrl(filePath);
    if (!url) {
      throw new Error('Не удалось получить ссылку на документ');
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
