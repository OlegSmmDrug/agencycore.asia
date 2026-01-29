import { supabase } from '../lib/supabase';

export const noteImageService = {
  async uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName;

    const { data, error } = await supabase.storage
      .from('notes-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('notes-images')
      .getPublicUrl(data.path);

    return publicUrl;
  },

  async deleteImage(imageUrl: string): Promise<void> {
    const path = imageUrl.split('/notes-images/').pop();
    if (!path) return;

    const { error } = await supabase.storage
      .from('notes-images')
      .remove([path]);

    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
};
