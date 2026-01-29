import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Maximize2, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { MediaFile, downloadMedia, formatFileSize } from '../services/mediaStorageService';

interface MediaViewerProps {
  media: MediaFile[];
  initialIndex: number;
  onClose: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ media, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentMedia = media[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, media.length]);

  useEffect(() => {
    setZoom(1);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleDownload = async () => {
    try {
      await downloadMedia(currentMedia.url, currentMedia.name);
    } catch (error) {
      console.error('Download error:', error);
      alert('Не удалось скачать файл');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-10 group"
      >
        <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      </button>

      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg z-10">
        <p className="text-white text-sm font-medium">
          {currentIndex + 1} / {media.length}
        </p>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-6 py-3 rounded-lg z-10">
        <div className="flex items-center gap-3">
          {currentMedia.type === 'image' ? (
            <ImageIcon className="w-5 h-5 text-white" />
          ) : (
            <VideoIcon className="w-5 h-5 text-white" />
          )}
          <div>
            <p className="text-white font-medium">{currentMedia.name}</p>
            <p className="text-white/70 text-xs">
              {formatFileSize(currentMedia.size)}
              {currentMedia.duration && ` • ${Math.floor(currentMedia.duration / 60)}:${String(currentMedia.duration % 60).padStart(2, '0')}`}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm p-2 rounded-lg z-10">
        {currentMedia.type === 'image' && (
          <>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-2 hover:bg-white/20 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ZoomOut className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-2 hover:bg-white/20 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ZoomIn className="w-5 h-5 text-white" />
            </button>
            <div className="w-px bg-white/20 mx-1" />
          </>
        )}
        <button
          onClick={handleDownload}
          className="p-2 hover:bg-white/20 rounded transition-all"
        >
          <Download className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 hover:bg-white/20 rounded transition-all"
        >
          <Maximize2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {media.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all group"
          >
            <ChevronLeft className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all group"
          >
            <ChevronRight className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
          </button>
        </>
      )}

      <div className="max-w-7xl max-h-[80vh] w-full flex items-center justify-center px-20">
        {currentMedia.type === 'image' ? (
          <img
            src={currentMedia.url}
            alt={currentMedia.name}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        ) : (
          <video
            ref={videoRef}
            src={currentMedia.url}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          >
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        )}
      </div>

      {media.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 max-w-xl overflow-x-auto px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg">
          {media.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setCurrentIndex(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIndex
                  ? 'border-white scale-110'
                  : 'border-white/30 hover:border-white/60'
              }`}
            >
              {m.type === 'image' ? (
                <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <VideoIcon className="w-6 h-6 text-white/70" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaViewer;
