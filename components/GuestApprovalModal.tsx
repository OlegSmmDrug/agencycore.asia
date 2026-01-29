import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Calendar, MessageCircle, Clock, User } from 'lucide-react';
import { GuestTaskView, TaskStatus, MediaFile } from '../types';
import MediaGallery from './MediaGallery';
import MediaViewer from './MediaViewer';

interface GuestApprovalModalProps {
  task: GuestTaskView;
  onClose: () => void;
  onApprove: (taskId: string, comment?: string) => Promise<void>;
  onReject: (taskId: string, comment: string) => Promise<void>;
  guestId: string;
  canApprove: boolean;
  onRegisterRequest: () => void;
}

export const GuestApprovalModal: React.FC<GuestApprovalModalProps> = ({
  task,
  onClose,
  onApprove,
  onReject,
  guestId,
  canApprove,
  onRegisterRequest
}) => {
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<'view' | 'approve' | 'reject'>('view');
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<{ media: MediaFile[]; index: number } | null>(null);

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      await onApprove(task.id, comment || undefined);
      onClose();
    } catch (error) {
      console.error('Error approving task:', error);
      alert('Ошибка при одобрении. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('Пожалуйста, укажите причину отклонения');
      return;
    }

    try {
      setIsSubmitting(true);
      await onReject(task.id, comment);
      onClose();
    } catch (error) {
      console.error('Error rejecting task:', error);
      alert('Ошибка при отклонении. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextMedia = () => {
    if (task.mediaUrls && currentMediaIndex < task.mediaUrls.length - 1) {
      setCurrentMediaIndex(prev => prev + 1);
    }
  };

  const prevMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(prev => prev - 1);
    }
  };

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Без срока';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING_CLIENT:
        return 'bg-amber-500 text-white';
      case TaskStatus.APPROVED:
        return 'bg-green-600 text-white';
      case TaskStatus.REJECTED:
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING_CLIENT:
        return 'На проверке';
      case TaskStatus.APPROVED:
        return 'Одобрено';
      case TaskStatus.REJECTED:
        return 'На доработке';
      default:
        return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-8 flex items-center justify-between z-10 rounded-t-3xl">
          <div className="flex-1 pr-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{task.title}</h2>
            <div className="flex items-center gap-4 flex-wrap">
              <span className={`px-4 py-2 text-sm font-bold rounded-xl shadow-lg ${getStatusColor(task.status)}`}>
                {getStatusLabel(task.status)}
              </span>
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-xl font-semibold">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(task.deadline)}</span>
              </div>
              {task.rejectedCount && task.rejectedCount > 0 && (
                <span className="px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl">
                  Версия #{task.rejectedCount + 1}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all p-3 rounded-xl ml-4"
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {task.mediaFiles && task.mediaFiles.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Медиа-материалы</h3>
              <MediaGallery
                media={task.mediaFiles}
                onMediaClick={(media, index) => {
                  setViewerMedia({ media: task.mediaFiles || [], index });
                }}
                readOnly={true}
              />
            </div>
          ) : task.mediaUrls && task.mediaUrls.length > 0 ? (
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="aspect-square max-h-[600px] flex items-center justify-center">
                {isVideo(task.mediaUrls[currentMediaIndex]) ? (
                  <video
                    key={currentMediaIndex}
                    src={task.mediaUrls[currentMediaIndex]}
                    controls
                    className="max-w-full max-h-full rounded-xl"
                  />
                ) : (
                  <img
                    src={task.mediaUrls[currentMediaIndex]}
                    alt={`Медиа ${currentMediaIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>

              {task.mediaUrls.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      prevMedia();
                    }}
                    disabled={currentMediaIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-900 rounded-full p-4 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl hover:scale-110"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextMedia();
                    }}
                    disabled={currentMediaIndex === task.mediaUrls.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-900 rounded-full p-4 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl hover:scale-110"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </button>
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white px-6 py-3 rounded-full text-base font-bold shadow-2xl">
                    {currentMediaIndex + 1} / {task.mediaUrls.length}
                  </div>
                  <div className="absolute bottom-6 left-6 right-6 flex justify-center gap-2">
                    {task.mediaUrls.map((_, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentMediaIndex(index);
                        }}
                        className={`h-2 rounded-full transition-all ${
                          index === currentMediaIndex
                            ? 'w-8 bg-white'
                            : 'w-2 bg-white/50 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {task.postText && (
            <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200">
              <h3 className="text-sm font-bold text-blue-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Текст поста
              </h3>
              <p className="text-gray-900 whitespace-pre-wrap leading-relaxed text-lg">{task.postText}</p>
            </div>
          )}

          {task.description && (
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-lg">
              <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Описание</h3>
              <p className="text-gray-700 leading-relaxed text-base">{task.description}</p>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-6 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-5 h-5" />
              История изменений
            </h3>
            <div className="space-y-4">
              {task.createdAt && (
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0 shadow-lg"></div>
                  <div className="flex-1 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
                      <User className="w-4 h-4" />
                      <span>Создано: {task.creatorName || 'Команда'}</span>
                    </div>
                    <div className="text-slate-500 text-sm">{formatDateTime(task.createdAt)}</div>
                  </div>
                </div>
              )}

              {task.revisionHistory && task.revisionHistory.length > 0 && (
                task.revisionHistory.map((entry, index) => (
                  <div key={entry.id || index} className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 shadow-lg ${
                      entry.status === TaskStatus.REJECTED ? 'bg-rose-500' :
                      entry.status === TaskStatus.APPROVED ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}></div>
                    <div className="flex-1 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
                        <User className="w-4 h-4" />
                        <span>
                          {entry.status === TaskStatus.REJECTED ? 'Запрошены правки' :
                           entry.status === TaskStatus.APPROVED ? 'Одобрено' : 'Статус изменен'}
                          {entry.changedByType === 'guest' ? ' вами' : ' командой'}
                        </span>
                      </div>
                      <div className="text-slate-500 text-sm mb-2">{formatDateTime(entry.timestamp)}</div>
                      {entry.comment && (
                        <div className="mt-3 text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm leading-relaxed">
                          {entry.comment}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {task.approvedAt && task.status === TaskStatus.APPROVED && (
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full mt-2 flex-shrink-0 shadow-lg"></div>
                  <div className="flex-1 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
                      <User className="w-4 h-4" />
                      <span>Одобрил: {task.approvedByName || 'Клиент'}</span>
                    </div>
                    <div className="text-slate-500 text-sm">{formatDateTime(task.approvedAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {task.clientComment && (
            <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-8">
              <div className="flex items-start gap-4">
                <MessageCircle className="w-6 h-6 text-blue-700 mt-1" />
                <div>
                  <h3 className="text-sm font-bold text-blue-900 mb-3 uppercase tracking-wider">Ваш предыдущий комментарий</h3>
                  <p className="text-blue-900 leading-relaxed text-base">{task.clientComment}</p>
                </div>
              </div>
            </div>
          )}

          {mode === 'view' && task.status !== TaskStatus.DONE && (
            <div className="border-t-2 border-gray-200 pt-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Ваше решение</h3>
              {canApprove ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => setMode('approve')}
                    className="flex items-center justify-center gap-4 px-8 py-6 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all text-xl font-bold shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    <ThumbsUp className="w-8 h-8" />
                    <span>Одобрить</span>
                  </button>
                  <button
                    onClick={() => setMode('reject')}
                    className="flex items-center justify-center gap-4 px-8 py-6 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all text-xl font-bold shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    <ThumbsDown className="w-8 h-8" />
                    <span>Запросить правки</span>
                  </button>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-8">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="bg-amber-500 rounded-full p-4">
                      <Clock className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="text-2xl font-bold text-amber-900">Требуется регистрация</h4>
                    <p className="text-amber-800 text-lg leading-relaxed max-w-2xl">
                      Чтобы одобрять или запрашивать правки контента, вам необходимо зарегистрироваться. Это позволит нам отправлять вам уведомления о новых материалах и сохранять историю ваших решений.
                    </p>
                    <button
                      onClick={onRegisterRequest}
                      className="mt-4 px-10 py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      Зарегистрироваться сейчас
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'approve' && (
            <div className="border-t-2 border-gray-200 pt-8 space-y-6">
              <h3 className="text-2xl font-bold text-emerald-900">Одобрение контента</h3>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Добавьте комментарий (необязательно)"
                rows={4}
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 resize-none text-base transition-all"
              />
              <div className="flex gap-4">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex-1 px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                >
                  {isSubmitting ? 'Отправка...' : 'Подтвердить одобрение'}
                </button>
                <button
                  onClick={() => setMode('view')}
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-gray-200 text-gray-700 rounded-2xl hover:bg-gray-300 transition-all disabled:opacity-50 font-bold text-lg"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="border-t-2 border-gray-200 pt-8 space-y-6">
              <h3 className="text-2xl font-bold text-rose-900">Запрос на доработку</h3>
              <p className="text-base text-gray-600">Пожалуйста, опишите что нужно изменить:</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Опишите необходимые изменения..."
                rows={5}
                className="w-full px-6 py-4 border-2 border-rose-300 rounded-2xl focus:ring-4 focus:ring-rose-200 focus:border-rose-500 resize-none text-base transition-all"
                required
              />
              <div className="flex gap-4">
                <button
                  onClick={handleReject}
                  disabled={isSubmitting || !comment.trim()}
                  className="flex-1 px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                >
                  {isSubmitting ? 'Отправка...' : 'Отправить на доработку'}
                </button>
                <button
                  onClick={() => setMode('view')}
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-gray-200 text-gray-700 rounded-2xl hover:bg-gray-300 transition-all disabled:opacity-50 font-bold text-lg"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewerMedia && (
        <MediaViewer
          media={viewerMedia.media}
          initialIndex={viewerMedia.index}
          onClose={() => setViewerMedia(null)}
        />
      )}
    </div>
  );
};
