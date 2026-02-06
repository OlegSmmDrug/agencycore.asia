
import React, { useState, useEffect, useRef } from 'react';
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  const [showNesting, setShowNesting] = useState(true);
  const [showCover, setShowCover] = useState(false);

  const [activeColorMenu, setActiveColorMenu] = useState<'text' | 'highlight' | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [localTitle, setLocalTitle] = useState('');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setMobileSidebarOpen(false);
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

  // Click outside listener for color menus
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (activeColorMenu && !(event.target as Element).closest('.color-menu-container')) {
              setActiveColorMenu(null);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeColorMenu]);

  const selectedDoc = documents.find(d => d.id === selectedDocId);
  const author = users.find(u => u.id === selectedDoc?.authorId);

  // --- ACCESS CONTROL ---
  const hasAccess = (doc: Document) => {
      if (currentUser.systemRole === SystemRole.ADMIN) return true;
      if (doc.authorId === currentUser.id) return true;
      if (doc.allowedUserIds?.includes(currentUser.id)) return true;
      return false;
  };

  // --- EDITOR LOGIC ---
  const execCmd = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      if (editorRef.current) {
          editorRef.current.focus();
          handleUpdateContent(editorRef.current.innerHTML);
      }
  };

  const applyColor = (type: 'text' | 'highlight', color: string) => {
      // Prevent losing focus is handled by onMouseDown preventDefault on buttons
      if (type === 'text') {
          execCmd('foreColor', color);
      } else {
          execCmd('hiliteColor', color); // Use 'hiliteColor' for background
      }
      setActiveColorMenu(null);
  };

  const handleInsertLink = () => {
      const url = prompt("Введите URL ссылки:", "https://");
      if (url) execCmd('createLink', url);
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
                flex items-center px-3 py-2.5 md:py-1.5 cursor-pointer text-sm transition-colors rounded-lg mx-2 mb-0.5 group
                ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}
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

  // --- CONSTANTS FOR COLORS ---
  const textColors = [
      { name: 'Default', color: 'inherit' },
      { name: 'Gray', color: '#6B7280' },
      { name: 'Red', color: '#EF4444' },
      { name: 'Orange', color: '#F97316' },
      { name: 'Yellow', color: '#EAB308' },
      { name: 'Green', color: '#22C55E' },
      { name: 'Blue', color: '#3B82F6' },
      { name: 'Purple', color: '#A855F7' },
      { name: 'Pink', color: '#EC4899' },
  ];

  const highlightColors = [
      { name: 'Default', color: 'transparent' },
      { name: 'Gray', color: '#F3F4F6' },
      { name: 'Red', color: '#FEE2E2' },
      { name: 'Orange', color: '#FFEDD5' },
      { name: 'Yellow', color: '#FEF9C3' },
      { name: 'Green', color: '#DCFCE7' },
      { name: 'Blue', color: '#DBEAFE' },
      { name: 'Purple', color: '#F3E8FF' },
      { name: 'Pink', color: '#FCE7F3' },
  ];

  // --- TOOLBAR ---
  const Toolbar = () => (
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-1.5 md:p-2 mb-4 sticky top-0 bg-white z-10 text-slate-600">
          {/* Undo/Redo */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('undo')} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Отменить"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('redo')} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Повторить"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
          <div className="w-px h-5 bg-slate-200 mx-2"></div>
          
          {/* Headings */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('formatBlock', 'H1')} className="p-1.5 hover:bg-slate-100 rounded font-bold text-sm px-2 text-slate-700 hover:text-blue-600">H1</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('formatBlock', 'H2')} className="p-1.5 hover:bg-slate-100 rounded font-bold text-sm px-2 text-slate-700 hover:text-blue-600">H2</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('formatBlock', 'H3')} className="p-1.5 hover:bg-slate-100 rounded font-bold text-sm px-2 text-slate-700 hover:text-blue-600">H3</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('formatBlock', 'P')} className="p-1.5 hover:bg-slate-100 rounded font-bold text-sm px-2 text-slate-700 hover:text-blue-600">P</button>
          <div className="w-px h-5 bg-slate-200 mx-2"></div>

          {/* BIUS */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('bold')} className="p-1.5 hover:bg-slate-100 rounded font-bold text-slate-700 px-2" title="Жирный">B</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('italic')} className="p-1.5 hover:bg-slate-100 rounded italic font-serif px-2" title="Курсив">I</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('underline')} className="p-1.5 hover:bg-slate-100 rounded underline px-2" title="Подчеркнутый">U</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('strikeThrough')} className="p-1.5 hover:bg-slate-100 rounded line-through px-2" title="Зачеркнутый">S</button>
          <div className="w-px h-5 bg-slate-200 mx-2"></div>

          {/* COLORS */}
          <div className="relative color-menu-container">
              <button 
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setActiveColorMenu(activeColorMenu === 'highlight' ? null : 'highlight')}
                  className={`p-1.5 hover:bg-slate-100 rounded flex items-center space-x-0.5 ${activeColorMenu === 'highlight' ? 'bg-slate-100' : ''}`}
                  title="Цвет выделения"
              >
                   <div className="flex flex-col items-center justify-center">
                        <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        <div className="w-4 h-1 bg-yellow-300 rounded-full mt-0.5"></div>
                   </div>
                   <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {activeColorMenu === 'highlight' && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-lg p-2 grid grid-cols-3 gap-2 z-50 w-40">
                      {highlightColors.map(c => (
                          <button 
                            key={c.name}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyColor('highlight', c.color)}
                            className="w-8 h-8 rounded-full border border-slate-200 hover:scale-110 transition-transform flex items-center justify-center"
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          >
                              {c.name === 'Default' && <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>}
                          </button>
                      ))}
                  </div>
              )}
          </div>

          <div className="relative color-menu-container">
              <button 
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setActiveColorMenu(activeColorMenu === 'text' ? null : 'text')}
                  className={`p-1.5 hover:bg-slate-100 rounded flex items-center space-x-0.5 ${activeColorMenu === 'text' ? 'bg-slate-100' : ''}`}
                  title="Цвет текста"
              >
                   <div className="flex flex-col items-center justify-center">
                        <span className="font-serif font-bold text-lg leading-none text-slate-700">A</span>
                        <div className="w-4 h-1 bg-red-500 rounded-full"></div>
                   </div>
                   <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              </button>

              {activeColorMenu === 'text' && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-lg p-2 grid grid-cols-3 gap-2 z-50 w-40">
                      {textColors.map(c => (
                          <button 
                            key={c.name}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyColor('text', c.color)}
                            className="w-8 h-8 rounded-full border border-slate-100 hover:scale-110 transition-transform flex items-center justify-center"
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          >
                              {c.name === 'Default' && <span className="text-black font-bold">A</span>}
                          </button>
                      ))}
                  </div>
              )}
          </div>
          <div className="w-px h-5 bg-slate-200 mx-2"></div>

          {/* Lists */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('insertUnorderedList')} className="p-1.5 hover:bg-slate-100 rounded" title="Маркированный список"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('insertOrderedList')} className="p-1.5 hover:bg-slate-100 rounded" title="Нумерованный список"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={handleInsertChecklist} className="p-1.5 hover:bg-slate-100 rounded" title="Чек-лист"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></button>
          <div className="w-px h-5 bg-slate-200 mx-2"></div>

          {/* Align */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-slate-100 rounded" title="По левому краю"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16" /></svg></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-slate-100 rounded" title="По центру"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M7 12h10M4 18h16" /></svg></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('formatBlock', 'BLOCKQUOTE')} className="p-1.5 hover:bg-slate-100 rounded font-serif font-bold text-lg leading-none" title="Цитата">“</button>
          
          <div className="w-px h-5 bg-slate-200 mx-2"></div>

          {/* Insert */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={handleInsertLink} className="p-1.5 hover:bg-slate-100 rounded" title="Ссылка"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={handleInsertTable} className="p-1.5 hover:bg-slate-100 rounded flex items-center" title="Таблица">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7-4h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z" /></svg>
          </button> 
          
          <div className="w-px h-5 bg-slate-200 mx-2"></div>
          
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('insertHorizontalRule')} className="p-1.5 hover:bg-slate-100 rounded" title="Разделитель"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={handleInsertCode} className="p-1.5 hover:bg-slate-100 rounded" title="Код"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg></button> 
          
          <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleInsertImage}
              disabled={uploadingImage}
              className="p-1.5 hover:bg-slate-100 rounded flex items-center disabled:opacity-50"
              title="Изображение"
          >
              {uploadingImage ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
              ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              )}
          </button>
      </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}
        {/* LEFT SIDEBAR (TREE) */}
        <div className={`
          fixed inset-y-0 left-0 z-40 w-72 md:w-64 md:static md:z-auto
          flex flex-col border-r border-slate-200 bg-slate-50 pt-4 flex-shrink-0
          transition-transform duration-200 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
            <div className="px-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <button 
                        onClick={() => setViewMode('tree')}
                        className={`text-lg font-bold ${viewMode === 'tree' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        База знаний
                    </button>
                    <button 
                        onClick={() => handleAddDocument()}
                        className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-sm font-medium flex items-center transition-colors"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Новый
                    </button>
                </div>
                {viewMode === 'tree' && (
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
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
        <div className="flex-1 flex flex-col bg-white min-w-0 relative">
            {selectedDoc ? (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 md:px-6 py-3 border-b border-slate-100 gap-2">
                        <div className="flex items-center text-sm text-slate-500 overflow-hidden whitespace-nowrap min-w-0">
                            <button
                              onClick={() => setMobileSidebarOpen(true)}
                              className="md:hidden p-1.5 mr-2 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
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
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-12 max-w-4xl mx-auto w-full">
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

                        <Toolbar />

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
                            className="text-2xl md:text-4xl font-bold text-slate-900 border-none focus:ring-0 w-full p-0 mb-4 md:mb-6 placeholder-slate-300 bg-transparent outline-none"
                            value={localTitle}
                            onChange={(e) => handleUpdateTitle(e.target.value)}
                            placeholder="Без названия"
                        />

                        {/* Editable Content */}
                        <div className="relative">
                            <div
                                ref={editorRef}
                                className="prose prose-slate max-w-none focus:outline-none min-h-[400px] pb-20"
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
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 px-4">
                    <button
                      onClick={() => setMobileSidebarOpen(true)}
                      className="md:hidden mb-6 px-4 py-2 bg-slate-100 rounded-lg text-slate-600 text-sm font-medium"
                    >
                      Открыть список документов
                    </button>
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <p className="text-lg font-medium text-slate-600">База знаний</p>
                    <p className="text-sm mt-1">Выберите документ или создайте новый</p>
                    <button 
                        onClick={() => handleAddDocument()}
                        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 font-medium"
                    >
                        Создать первый документ
                    </button>
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
