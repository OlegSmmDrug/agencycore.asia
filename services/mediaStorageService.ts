import { supabase } from '../lib/supabase';

export interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  size: number;
  duration?: number;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
}

const CONTENT_MEDIA_BUCKET = 'content-media';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

export interface UploadProgress {
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export const validateMediaFile = (file: File): { valid: boolean; error?: string } => {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: 'Неподдерживаемый формат файла. Разрешены: JPG, PNG, GIF, WEBP, MP4, MOV, AVI, WEBM',
    };
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `Файл слишком большой. Максимальный размер: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
};

export const getMediaType = (file: File): 'image' | 'video' => {
  return ALLOWED_IMAGE_TYPES.includes(file.type) ? 'image' : 'video';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const uploadMedia = async (
  file: File,
  projectId: string,
  taskId: string,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<MediaFile> => {
  const validation = validateMediaFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${projectId}/${taskId}/${timestamp}_${sanitizedFileName}`;

  try {
    onProgress?.({ progress: 0, status: 'uploading' });

    const { error: uploadError } = await supabase.storage
      .from(CONTENT_MEDIA_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Ошибка загрузки: ${uploadError.message}`);
    }

    onProgress?.({ progress: 80, status: 'processing' });

    const { data: urlData } = supabase.storage
      .from(CONTENT_MEDIA_BUCKET)
      .getPublicUrl(filePath);

    const mediaFile: MediaFile = {
      id: `${timestamp}`,
      name: file.name,
      url: urlData.publicUrl,
      type: getMediaType(file),
      size: file.size,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    };

    onProgress?.({ progress: 100, status: 'complete' });

    return mediaFile;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    onProgress?.({ progress: 0, status: 'error', error: errorMessage });
    throw error;
  }
};

export const deleteMedia = async (url: string): Promise<void> => {
  try {
    const urlParts = url.split(`${CONTENT_MEDIA_BUCKET}/`);
    if (urlParts.length < 2) {
      throw new Error('Неверный URL файла');
    }

    const filePath = urlParts[1].split('?')[0];

    const { error } = await supabase.storage
      .from(CONTENT_MEDIA_BUCKET)
      .remove([filePath]);

    if (error) {
      throw new Error(`Ошибка удаления: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
};

export const getMediaUrl = (path: string): string => {
  const { data } = supabase.storage
    .from(CONTENT_MEDIA_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
};

export const downloadMedia = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Error downloading media:', error);
    throw new Error('Не удалось скачать файл');
  }
};

export const addMediaUrlToTask = async (
  url: string,
  name: string,
  type: 'image' | 'video',
  userId: string
): Promise<MediaFile> => {
  const mediaFile: MediaFile = {
    id: `url_${Date.now()}`,
    name: name || 'Внешний файл',
    url,
    type,
    size: 0,
    uploadedBy: userId,
    uploadedAt: new Date().toISOString(),
  };

  return mediaFile;
};

export const getMediaMetadata = async (file: File): Promise<Partial<MediaFile>> => {
  return new Promise((resolve) => {
    const metadata: Partial<MediaFile> = {
      name: file.name,
      type: getMediaType(file),
      size: file.size,
    };

    if (getMediaType(file) === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        metadata.duration = Math.round(video.duration);
        window.URL.revokeObjectURL(video.src);
        resolve(metadata);
      };

      video.onerror = () => {
        resolve(metadata);
      };

      video.src = URL.createObjectURL(file);
    } else {
      resolve(metadata);
    }
  });
};
