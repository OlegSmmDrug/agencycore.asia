import React, { useState } from 'react';
import { Image, Video, Download, Trash2, ExternalLink, PlayCircle } from 'lucide-react';
import { MediaFile, deleteMedia, downloadMedia, formatFileSize } from '../services/mediaStorageService';

interface MediaGalleryProps {
  media: MediaFile[];
  onMediaClick: (media: MediaFile, index: number) => void;
  onMediaDelete?: (media: MediaFile) => void;
  readOnly?: boolean;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  media,
  onMediaClick,
  onMediaDelete,
  readOnly = false,
}) => {
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredMedia = media.filter((m) => {
    if (filter === 'all') return true;
    return m.type === filter;
  });

  const handleDelete = async (e: React.MouseEvent, mediaFile: MediaFile) => {
    e.stopPropagation();

    if (!confirm(`Удалить ${mediaFile.name}?`)) return;

    setDeletingId(mediaFile.id);
    try {
      await deleteMedia(mediaFile.url);
      onMediaDelete?.(mediaFile);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Не удалось удалить файл');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, mediaFile: MediaFile) => {
    e.stopPropagation();
    try {
      await downloadMedia(mediaFile.url, mediaFile.name);
    } catch (error) {
      console.error('Download error:', error);
      alert('Не удалось скачать файл');
    }
  };

  if (media.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <Image className="w-16 h-16 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Файлы не добавлены</p>
        <p className="text-sm text-slate-400 mt-1">Загрузите фото или видео выше</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Все ({media.length})
          </button>
          <button
            onClick={() => setFilter('image')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'image'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Фото ({media.filter((m) => m.type === 'image').length})
          </button>
          <button
            onClick={() => setFilter('video')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'video'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Видео ({media.filter((m) => m.type === 'video').length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredMedia.map((mediaFile, index) => (
          <div
            key={mediaFile.id}
            onClick={() => onMediaClick(mediaFile, index)}
            className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-slate-100 hover:shadow-xl transition-all border-2 border-slate-200 hover:border-blue-400"
          >
            {mediaFile.type === 'image' ? (
              <img
                src={mediaFile.url}
                alt={mediaFile.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            ) : (
              <div className="relative w-full h-full">
                <video
                  src={mediaFile.url}
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <PlayCircle className="w-16 h-16 text-white opacity-80 group-hover:scale-110 transition-transform" />
                </div>
                {mediaFile.duration && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-bold rounded">
                    {Math.floor(mediaFile.duration / 60)}:{String(mediaFile.duration % 60).padStart(2, '0')}
                  </div>
                )}
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-sm font-medium truncate mb-2">
                  {mediaFile.name}
                </p>
                <div className="flex items-center gap-2">
                  {mediaFile.type === 'image' ? (
                    <Image className="w-3 h-3 text-white/70" />
                  ) : (
                    <Video className="w-3 h-3 text-white/70" />
                  )}
                  <span className="text-white/70 text-xs">
                    {formatFileSize(mediaFile.size)}
                  </span>
                </div>
              </div>
            </div>

            {!readOnly && (
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleDownload(e, mediaFile)}
                  className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-lg transition-all hover:scale-110"
                  title="Скачать"
                >
                  <Download className="w-4 h-4 text-slate-700" />
                </button>
                {onMediaDelete && (
                  <button
                    onClick={(e) => handleDelete(e, mediaFile)}
                    disabled={deletingId === mediaFile.id}
                    className="p-2 bg-red-500/90 hover:bg-red-600 rounded-lg shadow-lg transition-all hover:scale-110 disabled:opacity-50"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            )}

            {readOnly && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleDownload(e, mediaFile)}
                  className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-lg transition-all hover:scale-110"
                  title="Скачать"
                >
                  <Download className="w-4 h-4 text-slate-700" />
                </button>
              </div>
            )}

            {mediaFile.url.startsWith('http') && !mediaFile.url.includes('supabase') && (
              <div className="absolute top-2 left-2">
                <div className="px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Внешний
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaGallery;
