
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, User, SystemRole } from '../types';
import { noteImageService } from '../services/noteImageService';
import UserAvatar from './UserAvatar';

interface KnowledgeBaseProps {
  documents: Document[];
  users: User[];
  currentUser: User;
  onUpdateDocument: (doc: Document) => void | Promise<void>;
  onAddDocument: (doc: Document) => void | Promise<void>;
  onDeleteDocument: (docId: string) => void | Promise<void>;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  documents, users, currentUser, onUpdateDocument, onAddDocument, onDeleteDocument
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'archive'>('tree');
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const [showNesting, setShowNesting] = useState(true);
  const [showCover, setShowCover] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const [localTitle, setLocalTitle] = useState('');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [floatingToolbar, setFloatingToolbar] = useState<{ show: boolean; top: number; left: number }>({ show: false, top: 0, left: 0 });
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [blockMenuPos, setBlockMenuPos] = useState({ top: 0, left: 0 });
  const floatingToolbarRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setMobileView('editor');
  };

  // Initialize with first doc if available
  useEffect(() => {
    if (!selectedDocId && documents.length > 0) {
        const accessibleDocs = documents.filter(d => !d.isArchived && hasAccess(d));
        const firstDoc = accessibleDocs.find(d => !d.parentId) || accessibleDocs[0];
        if (firstDoc) {
            setSelectedDocId(firstDoc.id);
            setExpandedFolders(prev => [...new Set([...prev, ...documents.filter(d => d.isFolder).map(d => d.id)])]);
        }
    }
  }, [documents]); 

  // Sync content and title with editor when changing docs
  useEffect(() => {
      if (selectedDoc) {
          setLocalTitle(selectedDoc.title);
          if (editorRef.current && editorRef.current.innerHTML !== selectedDoc.content) {
              editorRef.current.innerHTML = selectedDoc.content;
          }
      }
  }, [selectedDocId]);

  // Cleanup save timer on unmount
  useEffect(() => {
      return () => {
          if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
          }
      };
  }, []);

  const selectedDoc = documents.find(d => d.id === selectedDocId);
  const author = users.find(u => u.id === selectedDoc?.authorId);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRef.current);
    }
  }, []);

  const updateFloatingToolbar = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !editorRef.current || !editorWrapperRef.current) {
      setFloatingToolbar(prev => ({ ...prev, show: false }));
      return;
    }

    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setFloatingToolbar(prev => ({ ...prev, show: false }));
      return;
    }

    const rect = range.getBoundingClientRect();
    const wrapperRect = editorWrapperRef.current.getBoundingClientRect();

    const toolbarWidth = 320;
    let left = rect.left + rect.width / 2 - wrapperRect.left - toolbarWidth / 2;
    left = Math.max(0, Math.min(left, wrapperRect.width - toolbarWidth));
    const top = rect.top - wrapperRect.top - 48;

    saveSelection();
    setFloatingToolbar({ show: true, top, left });
  }, [saveSelection]);

  useEffect(() => {
    const onSelectionChange = () => {
      updateFloatingToolbar();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [updateFloatingToolbar]);

  // --- ACCESS CONTROL ---
  const hasAccess = (doc: Document) => {
      if (currentUser.systemRole === SystemRole.ADMIN) return true;
      if (doc.authorId === currentUser.id) return true;
      if (doc.allowedUserIds?.includes(currentUser.id)) return true;
      return false;
  };

  // --- EDITOR LOGIC ---
  const execCmd = (command: string, value: string | undefined = undefined) => {
      restoreSelection();
      document.execCommand(command, false, value);
      if (editorRef.current) {
          handleUpdateContent(editorRef.current.innerHTML);
      }
      setTimeout(updateFloatingToolbar, 10);
  };

  const handleInsertLink = () => {
      saveSelection();
      const url = prompt("Введите URL ссылки:", "https://");
      if (url) {
        restoreSelection();
        document.execCommand('createLink', false, url);
        if (editorRef.current) handleUpdateContent(editorRef.current.innerHTML);
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

      if (editorRef.current) {
          handleUpdateContent(editorRef.current.innerHTML);
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

  const handleInsertImage = () => {
      fileInputRef.current?.click();
  };

  const handleInsertTable = () => {
      const tableHTML = `
        <table style="width:100%; border-collapse: collapse; margin: 10px 0;">
            <tbody>
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">Ячейка 1</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">Ячейка 2</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">Ячейка 3</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">Ячейка 4</td>
                </tr>
            </tbody>
        </table>
      `;
      execCmd('insertHTML', tableHTML);
  };

  const handleInsertChecklist = () => {
      execCmd('insertHTML', '<ul style="list-style-type: none; padding-left: 0;"><li><input type="checkbox"> Задача 1</li><li><input type="checkbox"> Задача 2</li></ul>');
  };

  const handleInsertCode = () => {
      const codeHTML = `<pre style="background-color: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px;">// Ваш код здесь</pre><p><br/></p>`;
      execCmd('insertHTML', codeHTML);
  };

  // --- ACTIONS ---

  const handleToggleFolder = (docId: string) => {
    if (expandedFolders.includes(docId)) {
      setExpandedFolders(expandedFolders.filter(id => id !== docId));
    } else {
      setExpandedFolders([...expandedFolders, docId]);
    }
  };

  const handleAddDocument = async (parentId: string | null = null, isFolder: boolean = false) => {
    const dbUser = users.find(u => u.email === currentUser.email) || currentUser;
    const newDoc: Document = {
      id: `temp_${Date.now()}`,
      parentId,
      title: isFolder ? 'Новая папка' : 'Новый документ',
      icon: isFolder ? '📂' : '📄',
      content: isFolder ? '' : '<p>Начните писать здесь...</p>',
      authorId: dbUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allowedUserIds: [dbUser.id],
      isPublic: false,
      isFolder
    };
    await onAddDocument(newDoc);
    if (parentId && !expandedFolders.includes(parentId)) {
      setExpandedFolders([...expandedFolders, parentId]);
    }
    setViewMode('tree');
    setMobileView('editor');
  };

  const handleUpdateContent = (content: string) => {
    if (!selectedDoc) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      onUpdateDocument({ ...selectedDoc, content, updatedAt: new Date().toISOString() });
    }, 500);
  };

  const handleUpdateTitle = (title: string) => {
    if (!selectedDoc) return;

    setLocalTitle(title);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      onUpdateDocument({ ...selectedDoc, title, updatedAt: new Date().toISOString() });
    }, 500);
  };

  const handleDuplicate = async () => {
    if (!selectedDoc) return;
    const dbUser = users.find(u => u.email === currentUser.email) || currentUser;
    const dup: Document = {
      ...selectedDoc,
      id: `temp_${Date.now()}`,
      title: `${selectedDoc.title} (Копия)`,
      authorId: dbUser.id,
      allowedUserIds: [dbUser.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await onAddDocument(dup);
    setIsMenuOpen(false);
  };

  const handleArchive = () => {
      if (!selectedDoc) return;
      onUpdateDocument({ ...selectedDoc, isArchived: true });
      setIsMenuOpen(false);
      setSelectedDocId(null);
  };

  const handleRestore = () => {
      if (!selectedDoc) return;
      onUpdateDocument({ ...selectedDoc, isArchived: false });
      setViewMode('tree');
  };

  const togglePermission = (userId: string) => {
      if (!selectedDoc) return;
      const current = selectedDoc.allowedUserIds || [];
      const updated = current.includes(userId) 
        ? current.filter(id => id !== userId) 
        : [...current, userId];
      onUpdateDocument({ ...selectedDoc, allowedUserIds: updated });
  };

  const togglePublic = () => {
      if (!selectedDoc) return;
      onUpdateDocument({ ...selectedDoc, isPublic: !selectedDoc.isPublic });
  };

  const handleExportPDF = () => {
      window.print();
      setIsMenuOpen(false);
  };

  const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} - ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // --- RENDER HELPERS ---

  const renderTree = (parentId: string | null = null, depth = 0) => {
    const nodes = documents
      .filter(d => d.parentId === parentId && !d.isArchived && hasAccess(d))
      .filter(d => !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (nodes.length === 0 && depth === 0 && searchQuery) {
        return <div className="p-4 text-xs text-slate-400">Ничего не найдено</div>;
    }

    return nodes.map(doc => {
        const isSelected = doc.id === selectedDocId;
        const hasChildren = documents.some(d => d.parentId === doc.id && !d.isArchived && hasAccess(d));
        const isExpanded = expandedFolders.includes(doc.id) || searchQuery.length > 0;

        return (
          <div key={doc.id} className="select-none">
            <div 
              className={`
                flex items-center px-4 py-3 md:px-3 md:py-1.5 cursor-pointer text-sm transition-all rounded-2xl md:rounded-lg mx-2 mb-1 md:mb-0.5 group
                ${isSelected ? 'bg-slate-900 md:bg-blue-50 text-white md:text-blue-700 font-medium shadow-xl md:shadow-none' : 'text-slate-600 hover:bg-slate-50 md:hover:bg-slate-100'}
              `}
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
              onClick={() => {
                  handleSelectDoc(doc.id);
                  if (doc.isFolder && !isExpanded && !searchQuery) handleToggleFolder(doc.id);
              }}
            >
              <div 
                className={`w-4 h-4 flex items-center justify-center mr-1 text-slate-400 hover:text-slate-600 cursor-pointer ${!hasChildren ? 'invisible' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleToggleFolder(doc.id); }}
              >
                 <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
              <span className="mr-2">{doc.icon || (doc.isFolder ? '📂' : '📄')}</span>
              <span className="truncate flex-1">{doc.title}</span>
              
              {doc.isFolder && (
                  <button 
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 ml-2 p-1 rounded hover:bg-blue-100"
                    onClick={(e) => { e.stopPropagation(); handleAddDocument(doc.id); }}
                    title="Создать внутри"
                  >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  </button>
              )}
            </div>
            {isExpanded && renderTree(doc.id, depth + 1)}
          </div>
        );
      });
  };

  const renderArchive = () => {
      const archivedDocs = documents.filter(d => d.isArchived && hasAccess(d));
      return (
          <div className="p-4 space-y-2">
              <h3 className="font-bold text-slate-500 text-xs uppercase mb-4">Архив документов</h3>
              {archivedDocs.length === 0 && <p className="text-sm text-slate-400">Архив пуст</p>}
              {archivedDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer" onClick={() => handleSelectDoc(doc.id)}>
                      <div className="flex items-center space-x-2 overflow-hidden">
                          <span>{doc.icon}</span>
                          <span className="truncate text-sm text-slate-600">{doc.title}</span>
                      </div>
                      <span className="text-[10px] text-red-400 border border-red-200 px-1 rounded">Archived</span>
                  </div>
              ))}
          </div>
      );
  };

  const blockMenuItems = [
    { label: 'Заголовок 1', icon: 'H1', action: () => execCmd('formatBlock', 'H1') },
    { label: 'Заголовок 2', icon: 'H2', action: () => execCmd('formatBlock', 'H2') },
    { label: 'Заголовок 3', icon: 'H3', action: () => execCmd('formatBlock', 'H3') },
    { label: 'Обычный текст', icon: 'P', action: () => execCmd('formatBlock', 'P') },
    { label: 'Маркированный список', icon: 'list', action: () => execCmd('insertUnorderedList') },
    { label: 'Нумерованный список', icon: 'olist', action: () => execCmd('insertOrderedList') },
    { label: 'Чек-лист', icon: 'check', action: () => handleInsertChecklist() },
    { label: 'Цитата', icon: 'quote', action: () => execCmd('formatBlock', 'BLOCKQUOTE') },
    { label: 'Разделитель', icon: 'hr', action: () => execCmd('insertHorizontalRule') },
    { label: 'Код', icon: 'code', action: () => handleInsertCode() },
    { label: 'Таблица', icon: 'table', action: () => handleInsertTable() },
    { label: 'Изображение', icon: 'img', action: () => handleInsertImage() },
    { label: 'Ссылка', icon: 'link', action: () => handleInsertLink() },
  ];

  const openBlockMenu = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorWrapperRef.current) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
      setBlockMenuPos({
        top: rect.bottom - wrapperRect.top + 8,
        left: rect.left - wrapperRect.left,
      });
    }
    setBlockMenuOpen(true);
  };

  const renderBlockIcon = (icon: string) => {
    switch (icon) {
      case 'H1': return <span className="font-bold text-sm">H1</span>;
      case 'H2': return <span className="font-bold text-sm">H2</span>;
      case 'H3': return <span className="font-bold text-sm">H3</span>;
      case 'P': return <span className="font-medium text-sm">T</span>;
      case 'list': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>;
      case 'olist': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>;
      case 'check': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
      case 'quote': return <span className="font-serif font-bold text-base">"</span>;
      case 'hr': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>;
      case 'code': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
      case 'table': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7-4h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z" /></svg>;
      case 'img': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
      case 'link': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
      default: return null;
    }
  };

  return (
    <div className="flex h-full bg-white md:bg-slate-50 overflow-hidden font-sans relative">
        <style>{`
            .kb-editor blockquote { border-left: 4px solid #e2e8f0; padding-left: 1rem; font-style: italic; color: #64748b; }
            .kb-editor ul { list-style-type: disc; padding-left: 1.5rem; }
            .kb-editor ol { list-style-type: decimal; padding-left: 1.5rem; }
            .kb-editor h1 { font-size: 2rem; font-weight: 800; margin: 1.5rem 0 0.75rem; }
            .kb-editor h2 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
            .kb-editor h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
            @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fade-in { animation: fade-in 0.15s ease-out; }
        `}</style>
        {/* LEFT SIDEBAR (TREE) */}
        <div className={`w-full md:w-72 lg:w-80 flex-shrink-0 bg-white md:bg-slate-50 border-r border-slate-200 flex flex-col pt-4 ${mobileView === 'editor' ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-6 py-6 md:px-4 md:py-0 md:mb-4 shrink-0">
                <div className="flex items-center justify-between mb-4 md:mb-3">
                    <h1 className="text-2xl md:text-lg font-black md:font-bold text-slate-900 md:text-slate-800 uppercase md:normal-case tracking-tight md:tracking-normal">
                        База знаний
                    </h1>
                    <button
                        onClick={() => handleAddDocument()}
                        className="w-10 h-10 md:w-auto md:h-auto bg-slate-900 md:bg-transparent hover:bg-slate-800 md:hover:bg-blue-50 text-white md:text-blue-600 rounded-xl md:rounded shadow-lg md:shadow-none flex items-center justify-center md:px-2 md:py-1 transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5 md:w-4 md:h-4 md:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M12 4v16m8-8H4" /></svg>
                        <span className="hidden md:inline text-sm font-medium">Новый</span>
                    </button>
                </div>
                {viewMode === 'tree' && (
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Поиск в документах..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-100 md:bg-white border-none md:border md:border-slate-200 rounded-2xl md:rounded-lg pl-10 md:pl-8 pr-4 md:pr-3 py-3 md:py-1.5 text-sm focus:outline-none focus:ring-2 md:focus:ring-1 focus:ring-blue-500/20 md:focus:ring-blue-500 transition-all"
                        />
                        <svg className="w-5 h-5 md:w-4 md:h-4 text-slate-400 absolute left-3 md:left-2.5 top-3.5 md:top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 md:px-0 pb-24 md:pb-4">
                {viewMode === 'tree' ? renderTree(null) : renderArchive()}
            </div>

            {currentUser?.systemRole === SystemRole.ADMIN && (
              <div
                  className={`px-4 py-3 border-t border-slate-200 text-sm font-medium cursor-pointer flex items-center transition-colors ${viewMode === 'archive' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setViewMode(viewMode === 'tree' ? 'archive' : 'tree')}
              >
                  {viewMode === 'tree' ? (
                      <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                          Архив
                      </>
                  ) : (
                      <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                          Назад к документам
                      </>
                  )}
              </div>
            )}
        </div>

        {/* MAIN CONTENT */}
        <div className={`flex-1 flex flex-col bg-white min-w-0 relative ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
            {selectedDoc ? (
                <>
                    {/* Header */}
                    <div className="px-4 md:px-6 py-3 md:py-3 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20 gap-2">
                        <div className="flex items-center text-sm text-slate-500 overflow-hidden whitespace-nowrap min-w-0">
                            <button
                              onClick={() => setMobileView('list')}
                              className="md:hidden text-slate-500 font-black flex items-center text-xs uppercase tracking-widest mr-3 flex-shrink-0"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg> Назад
                            </button>
                            <span className="hidden md:flex items-center bg-slate-100 rounded px-2 py-0.5 mr-2 flex-shrink-0">
                                <span className="mr-1">S</span> AgencyCore
                            </span>
                            <span className="hidden md:inline truncate">База знаний</span>
                            <span className="hidden md:inline mx-2 text-slate-300">•</span>
                            <span className="truncate font-medium text-slate-700">{selectedDoc.title}</span>
                            {selectedDoc.isArchived && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs font-bold flex-shrink-0">Архив</span>}
                        </div>

                        <div className="flex items-center space-x-1 md:space-x-3 flex-shrink-0">
                            {selectedDoc.isArchived ? (
                                <button onClick={handleRestore} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-bold transition-colors">
                                    Восстановить
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setIsShareModalOpen(true)} className="flex items-center px-2 md:px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                                        <svg className="w-4 h-4 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                        <span className="hidden md:inline">Поделиться</span>
                                    </button>
                                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 relative">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Context Menu */}
                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                            <div className="absolute top-12 right-2 md:right-6 w-60 md:w-64 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-fade-in text-sm font-medium text-slate-700">
                                <div className="p-1 space-y-0.5">
                                    <button 
                                        onClick={() => { setShowCover(!showCover); setIsMenuOpen(false); }}
                                        className="flex items-center w-full px-3 py-2 hover:bg-slate-50 rounded-lg text-left"
                                    >
                                        <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        {showCover ? 'Удалить обложку' : 'Добавить обложку'}
                                    </button>
                                    <div className="border-t border-slate-100 my-1"></div>
                                    <button onClick={handleDuplicate} className="flex items-center w-full px-3 py-2 hover:bg-slate-50 rounded-lg text-left">
                                        <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        Дублировать
                                    </button>
                                    <button onClick={handleExportPDF} className="flex items-center w-full px-3 py-2 hover:bg-slate-50 rounded-lg text-left">
                                        <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Экспорт в PDF
                                    </button>
                                    <div className="border-t border-slate-100 my-1"></div>
                                    <button onClick={handleArchive} className="flex items-center w-full px-3 py-2 hover:bg-slate-50 rounded-lg text-left text-red-600 hover:bg-red-50">
                                        <svg className="w-4 h-4 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                        Архивировать
                                    </button>
                                    <div className="border-t border-slate-100 my-1"></div>
                                    <div className="flex items-center justify-between px-3 py-2">
                                        <span className="text-slate-600 text-xs">Показать вложенность</span>
                                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input 
                                                type="checkbox" 
                                                name="toggle" 
                                                id="toggle" 
                                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer" 
                                                checked={showNesting}
                                                onChange={() => setShowNesting(!showNesting)}
                                                style={{ right: showNesting ? '0' : 'auto', left: showNesting ? 'auto' : '0' }}
                                            />
                                            <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${showNesting ? 'bg-blue-500' : 'bg-slate-300'}`}></label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Editor Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 lg:px-24 pt-6 md:pt-12 pb-32 max-w-5xl mx-auto w-full">
                        {showCover && (
                            <div className="w-full h-28 md:h-48 bg-gradient-to-r from-blue-400 to-teal-500 rounded-xl mb-4 md:mb-8 shadow-sm flex items-center justify-center text-white/50 text-sm group relative">
                                Обложка документа
                                <button 
                                    className="absolute top-2 right-2 p-1 bg-black/20 rounded hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setShowCover(false)}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}

                        <div className="mb-4 md:mb-6 flex flex-wrap items-center gap-2 md:gap-3">
                            {author && (
                                <div className="flex items-center space-x-2">
                                    <UserAvatar src={author.avatar} name={author.name} size="sm" borderClassName="border border-slate-200" />
                                    <span className="text-sm text-slate-700 font-medium">{author.name}</span>
                                </div>
                            )}
                            <span className="text-slate-300 hidden md:inline">|</span>
                            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 md:gap-3">
                                <span>Создан {formatDate(selectedDoc.createdAt)}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span>Обновлен {formatDate(selectedDoc.updatedAt)}</span>
                            </div>
                        </div>

                        {/* Nested Pages List */}
                        {showNesting && documents.some(d => d.parentId === selectedDoc.id && !d.isArchived) && (
                            <div className="mb-4 space-y-1">
                                {documents.filter(d => d.parentId === selectedDoc.id && !d.isArchived).map(child => (
                                    <div
                                        key={child.id}
                                        onClick={() => handleSelectDoc(child.id)}
                                        className="flex items-center p-2.5 md:p-2 rounded hover:bg-slate-100 cursor-pointer group text-slate-700"
                                    >
                                        <span className="text-lg mr-2 text-slate-400 group-hover:text-slate-600">📂</span>
                                        <span className="border-b border-slate-200 group-hover:border-slate-400 transition-colors">{child.title}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            className="w-full text-3xl md:text-4xl font-black md:font-bold text-slate-900 border-none focus:ring-0 p-0 mb-6 placeholder-slate-200 md:placeholder-slate-300 bg-transparent outline-none tracking-tight"
                            value={localTitle}
                            onChange={(e) => handleUpdateTitle(e.target.value)}
                            placeholder="Без названия"
                        />

                        {/* Editor area with floating toolbar */}
                        <div className="relative" ref={editorWrapperRef}>
                            {/* Floating Selection Toolbar (Notion-style) */}
                            {floatingToolbar.show && (
                                <div
                                    ref={floatingToolbarRef}
                                    className="absolute z-50 animate-fade-in"
                                    style={{ top: `${floatingToolbar.top}px`, left: `${floatingToolbar.left}px` }}
                                >
                                    <div className="bg-slate-900 text-white rounded-xl px-1.5 py-1 flex items-center shadow-2xl border border-white/10 backdrop-blur-xl">
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => execCmd('bold')} className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg font-bold text-sm transition-colors">B</button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => execCmd('italic')} className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg italic font-serif text-sm transition-colors">I</button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => execCmd('underline')} className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg underline text-sm transition-colors">U</button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => execCmd('strikeThrough')} className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg line-through text-sm transition-colors">S</button>
                                        <div className="w-px h-5 bg-white/15 mx-0.5"></div>
                                        <button onMouseDown={e => e.preventDefault()} onClick={handleInsertLink} className="px-2 py-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        </button>
                                        <div className="w-px h-5 bg-white/15 mx-0.5"></div>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => execCmd('formatBlock', 'H2')} className="px-2 py-1.5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">H2</button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => execCmd('formatBlock', 'H3')} className="px-2 py-1.5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">H3</button>
                                        <div className="w-px h-5 bg-white/15 mx-0.5"></div>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => { restoreSelection(); document.execCommand('hiliteColor', false, '#FEF9C3'); if (editorRef.current) handleUpdateContent(editorRef.current.innerHTML); }} className="px-2 py-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center" title="Выделить">
                                            <div className="w-4 h-4 rounded bg-yellow-200 border border-yellow-300"></div>
                                        </button>
                                        <button onMouseDown={e => e.preventDefault()} onClick={() => { restoreSelection(); document.execCommand('hiliteColor', false, '#DBEAFE'); if (editorRef.current) handleUpdateContent(editorRef.current.innerHTML); }} className="px-2 py-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center" title="Выделить">
                                            <div className="w-4 h-4 rounded bg-blue-200 border border-blue-300"></div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Block Menu ("+" button) */}
                            {blockMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setBlockMenuOpen(false)} />
                                    <div
                                        className="absolute z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-56 max-h-80 overflow-y-auto animate-fade-in"
                                        style={{ top: `${blockMenuPos.top}px`, left: `${blockMenuPos.left}px` }}
                                    >
                                        <div className="p-1">
                                            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Блоки</p>
                                            {blockMenuItems.map((item) => (
                                                <button
                                                    key={item.label}
                                                    onClick={() => { item.action(); setBlockMenuOpen(false); }}
                                                    className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left"
                                                >
                                                    <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mr-3 text-slate-500 flex-shrink-0">
                                                        {renderBlockIcon(item.icon)}
                                                    </span>
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div
                                ref={editorRef}
                                className="kb-editor prose prose-slate prose-lg max-w-none focus:outline-none min-h-[50vh] pb-20 text-slate-700 leading-relaxed"
                                contentEditable
                                suppressContentEditableWarning
                                onInput={(e) => handleUpdateContent(e.currentTarget.innerHTML)}
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

                    {/* Floating "+" Block Menu Button */}
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-3">
                        <button
                            onClick={openBlockMenu}
                            className="w-10 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 border border-white/10"
                            title="Добавить блок"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
                    <div className="p-8 bg-slate-50 rounded-full mb-6">
                        <svg className="w-16 h-16 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Выберите документ</p>
                </div>
            )}

            {/* Share Modal */}
            {isShareModalOpen && selectedDoc && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)}>
                    <div className="bg-white rounded-t-xl md:rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Доступ к документу</h3>
                            <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Public Link Toggle */}
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div>
                                    <p className="text-sm font-bold text-blue-800">Публичная ссылка</p>
                                    <p className="text-xs text-blue-600">Доступно всем, у кого есть ссылка</p>
                                </div>
                                <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                                    <input 
                                        type="checkbox" 
                                        name="public" 
                                        id="public" 
                                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer" 
                                        checked={selectedDoc.isPublic}
                                        onChange={togglePublic}
                                        style={{ right: selectedDoc.isPublic ? '0' : 'auto', left: selectedDoc.isPublic ? 'auto' : '0' }}
                                    />
                                    <label htmlFor="public" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${selectedDoc.isPublic ? 'bg-blue-500' : 'bg-slate-300'}`}></label>
                                </div>
                            </div>
                            {selectedDoc.isPublic && (
                                <div className="flex items-center space-x-2">
                                    <input
                                        readOnly
                                        value={`${window.location.origin}/knowledge/${selectedDoc.id}`}
                                        className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 bg-slate-50 text-slate-600"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/knowledge/${selectedDoc.id}`);
                                            alert('Ссылка скопирована!');
                                        }}
                                        className="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap"
                                    >
                                        Копировать
                                    </button>
                                </div>
                            )}

                            <div className="border-t border-slate-100 my-2"></div>
                            
                            <p className="text-xs font-bold text-slate-500 uppercase">Сотрудники</p>
                            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                {users.map(user => {
                                    const hasAccess = selectedDoc.allowedUserIds?.includes(user.id);
                                    const isOwner = selectedDoc.authorId === user.id;
                                    const isAdmin = user.systemRole === SystemRole.ADMIN;
                                    
                                    return (
                                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                            <div className="flex items-center space-x-3">
                                                <UserAvatar src={user.avatar} name={user.name} size="md" />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">{user.name}</p>
                                                    <p className="text-[10px] text-slate-400">{user.jobTitle}</p>
                                                </div>
                                            </div>
                                            {isOwner ? (
                                                <span className="text-xs text-slate-400 italic">Владелец</span>
                                            ) : isAdmin ? (
                                                <span className="text-xs text-slate-400 italic">Админ</span>
                                            ) : (
                                                <button 
                                                    onClick={() => togglePermission(user.id)}
                                                    className={`text-xs font-bold px-3 py-1 rounded transition-colors border ${
                                                        hasAccess 
                                                        ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' 
                                                        : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100'
                                                    }`}
                                                >
                                                    {hasAccess ? 'Убрать' : 'Добавить'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default KnowledgeBase;
