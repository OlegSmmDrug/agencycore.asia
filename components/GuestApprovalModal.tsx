import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Calendar, MessageCircle, Clock, User, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
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

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING_CLIENT:
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'На проверке' };
      case TaskStatus.APPROVED:
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Одобрено' };
      case TaskStatus.REJECTED:
        return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'На доработке' };
      default:
        return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: String(status) };
    }
  };

  const statusCfg = getStatusConfig(task.status);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-xl border border-slate-200">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between z-10 rounded-t-2xl">
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-bold text-slate-900 mb-2">{task.title}</h2>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                {statusCfg.label}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(task.deadline)}</span>
              </div>
              {task.rejectedCount && task.rejectedCount > 0 && (
                <span className="px-2.5 py-1 bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                  Версия #{task.rejectedCount + 1}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all p-2 rounded-xl ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {task.mediaFiles && task.mediaFiles.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">Медиа-материалы</h3>
              <MediaGallery
                media={task.mediaFiles}
                onMediaClick={(media, index) => {
                  setViewerMedia({ media: task.mediaFiles || [], index });
                }}
                readOnly={true}
              />
            </div>
          ) : task.mediaUrls && task.mediaUrls.length > 0 ? (
            <div className="relative bg-slate-900 rounded-xl overflow-hidden">
              <div className="aspect-square max-h-[500px] flex items-center justify-center">
                {isVideo(task.mediaUrls[currentMediaIndex]) ? (
                  <video
                    key={currentMediaIndex}
                    src={task.mediaUrls[currentMediaIndex]}
                    controls
                    className="max-w-full max-h-full rounded-lg"
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
                    onClick={(e) => { e.stopPropagation(); prevMedia(); }}
                    disabled={currentMediaIndex === 0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 rounded-full p-2.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextMedia(); }}
                    disabled={currentMediaIndex === task.mediaUrls.length - 1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 rounded-full p-2.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {task.mediaUrls.map((_, index) => (
                      <button
                        key={index}
                        onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(index); }}
                        className={`h-1.5 rounded-full transition-all ${
                          index === currentMediaIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {task.postText && (
            <div className="bg-blue-50/60 rounded-xl p-5 border border-blue-100">
              <h3 className="text-[10px] font-bold text-blue-600 mb-3 uppercase tracking-widest flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                Текст поста
              </h3>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">{task.postText}</p>
            </div>
          )}

          {task.description && (
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">Описание</h3>
              <p className="text-slate-600 leading-relaxed text-sm">{task.description}</p>
            </div>
          )}

          <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              История изменений
            </h3>
            <div className="space-y-3">
              {task.createdAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 bg-white rounded-lg p-3.5 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs mb-0.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Создано: {task.creatorName || 'Команда'}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">{formatDateTime(task.createdAt)}</div>
                  </div>
                </div>
              )}

              {task.revisionHistory && task.revisionHistory.length > 0 && (
                task.revisionHistory.map((entry, index) => (
                  <div key={entry.id || index} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      entry.status === TaskStatus.REJECTED ? 'bg-rose-500' :
                      entry.status === TaskStatus.APPROVED ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}></div>
                    <div className="flex-1 bg-white rounded-lg p-3.5 border border-slate-200">
                      <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs mb-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>
                          {entry.status === TaskStatus.REJECTED ? 'Запрошены правки' :
                           entry.status === TaskStatus.APPROVED ? 'Одобрено' : 'Статус изменен'}
                          {entry.changedByType === 'guest' ? ' вами' : ' командой'}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mb-1.5">{formatDateTime(entry.timestamp)}</div>
                      {entry.comment && (
                        <div className="mt-2 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs leading-relaxed">
                          {entry.comment}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {task.approvedAt && task.status === TaskStatus.APPROVED && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 bg-white rounded-lg p-3.5 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs mb-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>Одобрил: {task.approvedByName || 'Клиент'}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">{formatDateTime(task.approvedAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {task.clientComment && (
            <div className="bg-blue-50/50 border-l-[3px] border-blue-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-[10px] font-bold text-blue-600 mb-1.5 uppercase tracking-widest">Ваш предыдущий комментарий</h3>
                  <p className="text-slate-700 leading-relaxed text-sm">{task.clientComment}</p>
                </div>
              </div>
            </div>
          )}

          {mode === 'view' && task.status !== TaskStatus.DONE && (
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-xs font-bold text-slate-800 mb-4 text-center">Ваше решение</h3>
              {canApprove ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('approve')}
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all text-sm font-bold shadow-sm hover:shadow-md"
                  >
                    <ThumbsUp className="w-4.5 h-4.5" />
                    <span>Одобрить</span>
                  </button>
                  <button
                    onClick={() => setMode('reject')}
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all text-sm font-bold shadow-sm hover:shadow-md"
                  >
                    <ThumbsDown className="w-4.5 h-4.5" />
                    <span>Запросить правки</span>
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="bg-amber-100 rounded-xl p-3">
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Требуется регистрация</h4>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                      Чтобы одобрять или запрашивать правки контента, вам необходимо зарегистрироваться. Это позволит нам отправлять вам уведомления о новых материалах и сохранять историю ваших решений.
                    </p>
                    <button
                      onClick={onRegisterRequest}
                      className="mt-1 px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all font-bold text-xs shadow-sm"
                    >
                      Зарегистрироваться
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'approve' && (
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <h3 className="text-sm font-bold text-emerald-700">Одобрение контента</h3>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Добавьте комментарий (необязательно)"
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none text-sm transition-all placeholder:text-slate-300"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
                >
                  {isSubmitting ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Отправка...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Подтвердить одобрение</>
                  )}
                </button>
                <button
                  onClick={() => setMode('view')}
                  disabled={isSubmitting}
                  className="px-5 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50 font-medium text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <h3 className="text-sm font-bold text-rose-700">Запрос на доработку</h3>
              <p className="text-xs text-slate-500">Пожалуйста, опишите что нужно изменить:</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Опишите необходимые изменения..."
                rows={4}
                className="w-full px-4 py-3 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-none text-sm transition-all placeholder:text-slate-300"
                required
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={isSubmitting || !comment.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
                >
                  {isSubmitting ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Отправка...</>
                  ) : (
                    'Отправить на доработку'
                  )}
                </button>
                <button
                  onClick={() => setMode('view')}
                  disabled={isSubmitting}
                  className="px-5 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50 font-medium text-sm"
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
