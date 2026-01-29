
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Note, Project, User, Task, TaskStatus } from '../types';
import { noteImageService } from '../services/noteImageService';

interface DailyJournalProps {
    notes: Note[];
    projects: Project[];
    currentUser: User;
    onUpdateNote: (note: Note) => void;
    onAddNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Note>;
    onDeleteNote: (id: string) => void;
    onBatchCreateTasks: (tasks: Task[]) => void;
}

const DailyJournal: React.FC<DailyJournalProps> = ({
    notes = [],
    projects = [],
    currentUser,
    onUpdateNote,
    onAddNote,
    onDeleteNote,
    onBatchCreateTasks
}) => {
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [aiProcessing, setAiProcessing] = useState<string | null>(null);
    const [localTitle, setLocalTitle] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const lastNoteIdRef = useRef<string | null>(null);
    const titleUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const safeNotes = notes || [];
    
    // Privacy Logic: Show only personal notes OR project notes where user is a team member
    // Fix: useMemo was missing from imports
    const visibleNotes = useMemo(() => {
        return safeNotes.filter(n => {
            if (n.authorId === currentUser.id) return true; // My personal note
            if (n.projectId) {
                const project = projects.find(p => p.id === n.projectId);
                return project?.teamIds.includes(currentUser.id); // Team note
            }
            return false;
        });
    }, [safeNotes, currentUser, projects]);

    const filteredNotes = visibleNotes
        .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content?.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const selectedNote = visibleNotes.find(n => n.id === selectedNoteId);

    useEffect(() => {
        if (selectedNote) {
            setLocalTitle(selectedNote.title);
            if (editorRef.current && selectedNote.id !== lastNoteIdRef.current) {
                editorRef.current.innerHTML = selectedNote.content || '';
                lastNoteIdRef.current = selectedNote.id;
            }
        }
    }, [selectedNoteId, selectedNote]);

    useEffect(() => {
        if (titleUpdateTimeoutRef.current) {
            clearTimeout(titleUpdateTimeoutRef.current);
        }

        if (selectedNote && localTitle !== selectedNote.title) {
            titleUpdateTimeoutRef.current = setTimeout(() => {
                onUpdateNote({
                    ...selectedNote,
                    title: localTitle,
                    updatedAt: new Date().toISOString()
                });
            }, 500);
        }

        return () => {
            if (titleUpdateTimeoutRef.current) {
                clearTimeout(titleUpdateTimeoutRef.current);
            }
        };
    }, [localTitle]);

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current && selectedNote) {
            editorRef.current.focus();
            onUpdateNote({ ...selectedNote, content: editorRef.current.innerHTML, updatedAt: new Date().toISOString() });
        }
    };

    const insertImageAtCursor = (imageUrl: string) => {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.margin = '1rem 0';
        img.style.borderRadius = '0.5rem';

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.collapse(false);
        } else if (editorRef.current) {
            editorRef.current.appendChild(img);
        }

        if (editorRef.current && selectedNote) {
            onUpdateNote({ ...selectedNote, content: editorRef.current.innerHTML, updatedAt: new Date().toISOString() });
        }
    };

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите файл изображения');
            return;
        }

        if (file.size > 5242880) {
            alert('Размер файла не должен превышать 5 МБ');
            return;
        }

        setUploadingImage(true);
        try {
            const imageUrl = await noteImageService.uploadImage(file);
            insertImageAtCursor(imageUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Ошибка загрузки изображения');
        } finally {
            setUploadingImage(false);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) {
                    await handleImageUpload(file);
                }
                break;
            }
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (file.type.startsWith('image/')) {
            await handleImageUpload(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleAddNote = async () => {
        const newNoteData = {
            title: '',
            content: '',
            authorId: currentUser.id,
            tags: [],
            isPinned: false
        };
        const createdNote = await onAddNote(newNoteData);
        setSelectedNoteId(createdNote.id);
        setMobileView('editor');
    };

    return (
        <div className="flex h-full bg-white lg:bg-slate-50 overflow-hidden font-sans relative">
            <style>{`
                .note-editor-container blockquote { border-left: 4px solid #e2e8f0; padding-left: 1rem; font-style: italic; color: #64748b; }
                .note-editor-container ul { list-style-type: disc; padding-left: 1.5rem; }
                .note-editor-container ol { list-style-type: decimal; padding-left: 1.5rem; }
            `}</style>

            {/* List Pane */}
            <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col ${mobileView === 'editor' ? 'hidden md:flex' : 'flex'}`}>
                <div className="px-6 py-8 shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Заметки</h1>
                        <button onClick={handleAddNote} className="w-10 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>
                    <div className="relative">
                        <input type="text" className="w-full bg-slate-100 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" placeholder="Поиск в записях..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2 custom-scrollbar">
                    {filteredNotes.map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => { setSelectedNoteId(note.id); setMobileView('editor'); }} 
                            className={`p-4 cursor-pointer transition-all rounded-2xl group border ${selectedNoteId === note.id ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-white border-transparent hover:bg-slate-50'}`}
                        >
                            <h4 className={`font-bold text-sm truncate mb-1 ${selectedNoteId === note.id ? 'text-white' : 'text-slate-800'}`}>{note.title || 'Новая заметка'}</h4>
                            <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${selectedNoteId === note.id ? 'text-slate-400' : 'text-slate-400'}`}>
                                <span className="shrink-0">{new Date(note.updatedAt).toLocaleDateString([], {day:'2-digit', month:'short'})}</span>
                                <span className="truncate flex-1 font-medium opacity-60 italic">{note.content?.replace(/<[^>]*>?/gm, ' ') || 'Без текста'}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                {note.projectId ? (
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter ${selectedNoteId === note.id ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                        🚀 {projects.find(p => p.id === note.projectId)?.name}
                                    </span>
                                ) : (
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter ${selectedNoteId === note.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                        🔒 Личная
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor Pane */}
            <div className={`flex-1 flex flex-col bg-white ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
                {selectedNote ? (
                    <>
                        {/* Editor Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
                            <button onClick={() => setMobileView('list')} className="md:hidden text-slate-500 font-black flex items-center text-xs uppercase tracking-widest">
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg> Назад
                            </button>
                            
                            <div className="flex-1 flex flex-col items-center">
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 scale-90 sm:scale-100">
                                    <button onClick={() => onUpdateNote({...selectedNote, projectId: undefined})} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${!selectedNote.projectId ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Личная</button>
                                    <button onClick={() => !selectedNote.projectId && onUpdateNote({...selectedNote, projectId: projects[0]?.id})} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${selectedNote.projectId ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>В Проект</button>
                                </div>
                            </div>

                            <div className="flex items-center space-x-1">
                                <button onClick={() => onDeleteNote(selectedNote.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                        </div>

                        {/* Editor Body */}
                        <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-24 pt-12 pb-32 max-w-5xl mx-auto w-full custom-scrollbar note-editor-container">
                            {selectedNote.projectId && (
                                <select 
                                    className="mb-4 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-blue-100 focus:ring-0 outline-none cursor-pointer"
                                    value={selectedNote.projectId}
                                    onChange={e => onUpdateNote({...selectedNote, projectId: e.target.value})}
                                >
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            )}
                            <input
                                type="text"
                                className="w-full text-4xl md:text-5xl font-black text-slate-900 bg-transparent border-none focus:ring-0 p-0 mb-8 outline-none placeholder-slate-200 tracking-tighter"
                                placeholder="Заголовок..."
                                value={localTitle}
                                onChange={e => setLocalTitle(e.target.value)}
                            />
                            <div className="relative">
                                <div
                                    ref={editorRef}
                                    className="prose prose-slate prose-lg max-w-none focus:outline-none min-h-[50vh] text-slate-700 leading-relaxed"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={e => onUpdateNote({ ...selectedNote, content: e.currentTarget.innerHTML, updatedAt: new Date().toISOString() })}
                                    onPaste={handlePaste}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                />
                                {isDragging && (
                                    <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-4 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none z-10">
                                        <div className="text-center">
                                            <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-lg font-bold text-blue-700">Отпустите для загрузки изображения</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Floating Toolbar */}
                        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-[2rem] px-8 py-4 flex items-center space-x-8 shadow-2xl z-40 animate-fade-in-up border border-white/10 backdrop-blur-xl">
                            <button onClick={() => execCmd('bold')} className="font-black text-lg hover:text-blue-400 transition-colors">B</button>
                            <button onClick={() => execCmd('italic')} className="italic serif text-lg hover:text-blue-400 transition-colors">I</button>
                            <button onClick={() => execCmd('insertUnorderedList')} className="hover:text-blue-400 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <button onClick={() => execCmd('formatBlock', 'BLOCKQUOTE')} className="text-sm font-black text-slate-400 hover:text-white">"Цитата"</button>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="hover:text-blue-400 transition-colors relative"
                                disabled={uploadingImage}
                                title="Вставить изображение"
                            >
                                {uploadingImage ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        handleImageUpload(file);
                                        e.target.value = '';
                                    }
                                }}
                                className="hidden"
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
                        <div className="p-8 bg-slate-50 rounded-full mb-6"><svg className="w-16 h-16 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Выберите заметку</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyJournal;
