import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { MediaFile, uploadMedia, addMediaUrlToTask, validateMediaFile, UploadProgress } from '../services/mediaStorageService';

interface MediaUploadZoneProps {
  projectId: string;
  taskId: string;
  userId: string;
  onFilesUploaded: (files: MediaFile[]) => void;
  maxFiles?: number;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: UploadProgress;
}

const MediaUploadZone: React.FC<MediaUploadZoneProps> = ({
  projectId,
  taskId,
  userId,
  onFilesUploaded,
  maxFiles = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');
  const [urlType, setUrlType] = useState<'image' | 'video'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validation = validateMediaFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      alert('Некоторые файлы не были загружены:\n\n' + errors.join('\n'));
    }

    if (validFiles.length === 0) return;

    const uploadingFilesList: UploadingFile[] = validFiles.map((file) => ({
      id: `${Date.now()}_${Math.random()}`,
      file,
      progress: { progress: 0, status: 'uploading' },
    }));

    setUploadingFiles((prev) => [...prev, ...uploadingFilesList]);

    const uploadedFiles: MediaFile[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const uploadingFile = uploadingFilesList[i];

      try {
        const mediaFile = await uploadMedia(
          file,
          projectId,
          taskId,
          userId,
          (progress) => {
            setUploadingFiles((prev) =>
              prev.map((uf) =>
                uf.id === uploadingFile.id ? { ...uf, progress } : uf
              )
            );
          }
        );

        uploadedFiles.push(mediaFile);
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    setTimeout(() => {
      setUploadingFiles((prev) =>
        prev.filter((uf) => uf.progress.status !== 'complete')
      );
    }, 1500);

    if (uploadedFiles.length > 0) {
      onFilesUploaded(uploadedFiles);
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) {
      alert('Пожалуйста, введите URL');
      return;
    }

    try {
      const mediaFile = await addMediaUrlToTask(
        urlInput.trim(),
        urlName.trim() || 'Внешний файл',
        urlType,
        userId
      );

      onFilesUploaded([mediaFile]);
      setUrlInput('');
      setUrlName('');
      setShowUrlInput(false);
    } catch (error) {
      console.error('Error adding URL:', error);
      alert('Не удалось добавить ссылку');
    }
  };

  const getProgressIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/50
          ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 bg-slate-50/50'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
        <p className="text-lg font-semibold text-slate-700 mb-2">
          {isDragging ? 'Отпустите файлы здесь' : 'Перетащите файлы сюда или нажмите для выбора'}
        </p>
        <p className="text-sm text-slate-500">
          Поддерживаются: JPG, PNG, GIF, WEBP (до 10MB) • MP4, MOV, AVI, WEBM (до 100MB)
        </p>
      </div>

      <button
        onClick={() => setShowUrlInput(!showUrlInput)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-slate-700 font-medium"
      >
        <LinkIcon className="w-5 h-5" />
        {showUrlInput ? 'Скрыть добавление ссылки' : 'Добавить ссылку на файл'}
      </button>

      {showUrlInput && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              URL файла
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Название (опционально)
            </label>
            <input
              type="text"
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
              placeholder="Название файла"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Тип
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="image"
                  checked={urlType === 'image'}
                  onChange={(e) => setUrlType(e.target.value as 'image' | 'video')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-slate-700">Изображение</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="video"
                  checked={urlType === 'video'}
                  onChange={(e) => setUrlType(e.target.value as 'image' | 'video')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-slate-700">Видео</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddUrl}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Добавить
            </button>
            <button
              onClick={() => {
                setShowUrlInput(false);
                setUrlInput('');
                setUrlName('');
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile) => (
            <div
              key={uploadingFile.id}
              className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3"
            >
              {getProgressIcon(uploadingFile.progress.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {uploadingFile.file.name}
                </p>
                {uploadingFile.progress.status === 'error' && uploadingFile.progress.error && (
                  <p className="text-xs text-red-500 mt-1">{uploadingFile.progress.error}</p>
                )}
              </div>
              {uploadingFile.progress.status === 'uploading' && (
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadingFile.progress.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaUploadZone;
