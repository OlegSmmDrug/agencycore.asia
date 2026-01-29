
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskType, User, MediaFile } from '../types';
import MediaUploadZone from './MediaUploadZone';
import MediaGallery from './MediaGallery';
import MediaViewer from './MediaViewer';

interface ContentModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Partial<Task>;
    onSave: (task: Partial<Task>) => void;
    users: User[];
    currentUserId: string;
    projectId: string;
}

const ContentModal: React.FC<ContentModalProps> = ({ isOpen, onClose, task, onSave, users, currentUserId, projectId }) => {
    const [localTask, setLocalTask] = useState<Partial<Task>>({});
    const [viewerMedia, setViewerMedia] = useState<{ media: MediaFile[]; index: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLocalTask({
                title: '',
                description: '',
                status: TaskStatus.TODO,
                type: 'Post',
                mediaUrls: [],
                postText: '',
                mediaFiles: [],
                ...task
            });
        }
    }, [isOpen, task]);

    if (!isOpen) return null;

    const handleUpdate = (updates: Partial<Task>) => {
        setLocalTask(prev => ({ ...prev, ...updates }));
    };

    const handleSave = () => {
        if (!localTask.title) return;
        onSave(localTask);
    };

    const formatFullDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Не задано';

    const isoToDatetimeLocal = (iso?: string) => {
        if (!iso) return '';
        try {
            const date = new Date(iso);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
            return '';
        }
    };

    const datetimeLocalToISO = (datetime: string) => {
        if (!datetime) return '';
        try {
            return new Date(datetime).toISOString();
        } catch {
            return datetime;
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-slide-in-right">
                
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                            localTask.type === 'Reels' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                            {localTask.type === 'Reels' ? '🎬' : localTask.type === 'Stories' ? '📱' : '🖼'}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none uppercase">
                                {localTask.type || 'Пост'}: {localTask.title || 'Новая публикация'}
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                                Публикация на {formatFullDate(localTask.deadline)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-xl transition-colors text-slate-300 hover:text-slate-900">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                    
                    {/* Status Row */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Статус производства</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { id: TaskStatus.TODO, l: 'Черновик', c: 'slate' },
                                { id: TaskStatus.IN_PROGRESS, l: 'В работе', c: 'blue' },
                                { id: TaskStatus.REVIEW, l: 'Проверка', c: 'indigo' },
                                { id: TaskStatus.PENDING_CLIENT, l: 'Ждет клиента', c: 'yellow' },
                                { id: TaskStatus.APPROVED, l: 'Утверждено', c: 'green' },
                                { id: TaskStatus.REJECTED, l: 'На доработке', c: 'red' },
                                { id: TaskStatus.READY, l: 'Готово', c: 'blue' },
                                { id: TaskStatus.DONE, l: 'Опубликовано', c: 'emerald' }
                            ].map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleUpdate({ status: s.id })}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                                        localTask.status === s.id ? `bg-${s.c}-600 border-${s.c}-600 text-white shadow-xl` : 'bg-slate-50 border-transparent text-slate-400'
                                    }`}
                                >
                                    {s.l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Meta Fields */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Заголовок / Тема</label>
                            <input
                                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                value={localTask.title || ''}
                                onChange={e => handleUpdate({ title: e.target.value })}
                                placeholder="О чем пост?"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Время публикации</label>
                            <input
                                type="datetime-local"
                                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                value={isoToDatetimeLocal(localTask.deadline)}
                                onChange={e => handleUpdate({ deadline: datetimeLocalToISO(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* Media Block */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Медиа-материалы</h4>

                        <MediaUploadZone
                            projectId={projectId}
                            taskId={localTask.id || 'new'}
                            userId={currentUserId}
                            onFilesUploaded={(newFiles) => {
                                handleUpdate({
                                    mediaFiles: [...(localTask.mediaFiles || []), ...newFiles]
                                });
                            }}
                        />

                        {localTask.mediaFiles && localTask.mediaFiles.length > 0 && (
                            <MediaGallery
                                media={localTask.mediaFiles}
                                onMediaClick={(media, index) => {
                                    setViewerMedia({ media: localTask.mediaFiles || [], index });
                                }}
                                onMediaDelete={(media) => {
                                    handleUpdate({
                                        mediaFiles: (localTask.mediaFiles || []).filter(m => m.id !== media.id)
                                    });
                                }}
                            />
                        )}
                    </div>

                    {/* Post Text */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Текст публикации</h4>
                        <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                             <div className="px-4 py-2 border-b border-slate-200 flex gap-2">
                                 <button className="text-[10px] font-black text-slate-400 hover:text-slate-900">B</button>
                                 <button className="text-[10px] font-black text-slate-400 hover:text-slate-900 italic">I</button>
                                 <button className="text-[10px] font-black text-slate-400 hover:text-slate-900">#tag</button>
                             </div>
                             <textarea
                                className="w-full bg-transparent px-4 py-4 text-sm text-slate-700 leading-relaxed min-h-[180px] outline-none resize-none"
                                value={localTask.postText || ''}
                                onChange={e => handleUpdate({ postText: e.target.value })}
                                placeholder="Напишите текст поста здесь..."
                             />
                        </div>
                    </div>

                    {/* Client Comment Section */}
                    {localTask.clientComment && (
                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200 space-y-3">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Комментарий клиента</h4>
                            <p className="text-sm text-blue-900 leading-relaxed">{localTask.clientComment}</p>
                        </div>
                    )}

                    {/* Internal Comments Section */}
                    {localTask.internalComments && localTask.internalComments.length > 0 && (
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                            <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Внутренние заметки команды</h4>
                            <div className="space-y-2">
                                {localTask.internalComments.map(comment => (
                                    <div key={comment.id} className="bg-white p-3 rounded-lg border border-gray-200">
                                        <p className="text-sm text-gray-800">{comment.text}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(comment.createdAt).toLocaleString('ru-RU')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Revision History */}
                    {localTask.rejectedCount && localTask.rejectedCount > 0 && (
                        <div className="p-6 bg-orange-50 rounded-2xl border border-orange-200 space-y-3">
                            <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
                                История согласования (Ревизий: {localTask.rejectedCount})
                            </h4>
                            {localTask.revisionHistory && localTask.revisionHistory.length > 0 && (
                                <div className="space-y-2">
                                    {localTask.revisionHistory.slice(-3).reverse().map(revision => (
                                        <div key={revision.id} className="bg-white p-3 rounded-lg border border-orange-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-xs font-bold ${
                                                    revision.status === TaskStatus.APPROVED ? 'text-green-700' : 'text-red-700'
                                                }`}>
                                                    {revision.status === TaskStatus.APPROVED ? 'Утверждено' : 'Отклонено'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(revision.timestamp).toLocaleString('ru-RU')}
                                                </span>
                                            </div>
                                            {revision.comment && (
                                                <p className="text-sm text-gray-700 mt-2">{revision.comment}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-slate-100 bg-white flex gap-4 shrink-0">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all">Отмена</button>
                    <button onClick={handleSave} className="flex-[2] py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200">Сохранить активность</button>
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

export default ContentModal;
