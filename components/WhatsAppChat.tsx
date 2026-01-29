import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WhatsAppMessage, WhatsAppTemplate, Client, User } from '../types';
import { whatsappService } from '../services/whatsappService';
import { wazzupService } from '../services/wazzupService';

interface WhatsAppChatProps {
  client: Client;
  currentUser?: User;
  users: User[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  client,
  currentUser,
  users,
  isExpanded = false,
  onToggleExpand
}) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    if (!client?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const msgs = await whatsappService.getMessages(client.id);
      setMessages(msgs);
      const count = await whatsappService.getUnreadCount(client.id);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Не удалось загрузить сообщения');
    } finally {
      setIsLoading(false);
    }
  }, [client?.id]);

  const loadTemplates = useCallback(async () => {
    const tpls = await wazzupService.getTemplates();
    setTemplates(tpls);
  }, []);

  useEffect(() => {
    if (!client?.id) return;
    loadMessages();
    loadTemplates();
    const unsubscribe = whatsappService.subscribeToMessages(client.id, handleNewMessage);
    return () => unsubscribe();
  }, [client?.id, loadMessages, loadTemplates]);

  useEffect(() => {
    if (isExpanded) {
      loadMessages();
    }
  }, [isExpanded, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isExpanded && messages.length > 0) {
      const unreadIds = messages
        .filter(m => m.direction === 'incoming' && !m.isRead)
        .map(m => m.id);
      if (unreadIds.length > 0) {
        whatsappService.markAsRead(unreadIds);
        setUnreadCount(0);
      }
    }
  }, [isExpanded, messages]);

  const handleNewMessage = (message: WhatsAppMessage) => {
    setMessages(prev => {
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });
    if (message.direction === 'incoming' && !isExpanded) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedFile) || !client?.phone || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      if (selectedFile) {
        await whatsappService.sendMessageWithFile(
          client.id,
          client.phone,
          newMessage.trim() || '',
          selectedFile,
          currentUser?.id
        );
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        await whatsappService.sendMessage(
          client.id,
          client.phone,
          newMessage.trim(),
          currentUser?.id
        );
      }
      setNewMessage('');
      inputRef.current?.focus();
      await loadMessages();
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки сообщения');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateSelect = (template: WhatsAppTemplate) => {
    const variables = {
      name: client?.name || '',
      company: client?.company || '',
      date: new Date().toLocaleDateString('ru-RU')
    };
    const text = wazzupService.parseTemplateVariables(template.content, variables);
    setNewMessage(text);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        setError('Файл слишком большой (макс. 16 МБ)');
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      });
    }
  };

  const groupMessagesByDate = (msgs: WhatsAppMessage[]) => {
    const groups: { date: string; messages: WhatsAppMessage[] }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const dateStr = new Date(msg.timestamp).toDateString();
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ date: msg.timestamp, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const getStatusIcon = (status: WhatsAppMessage['status']) => {
    switch (status) {
      case 'sending':
        return (
          <svg className="w-3.5 h-3.5 text-white/60 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="3" />
          </svg>
        );
      case 'sent':
        return (
          <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'delivered':
        return (
          <div className="flex -space-x-1.5">
            <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'read':
        return (
          <div className="flex -space-x-1.5">
            <svg className="w-4 h-4 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <svg className="w-4 h-4 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return 'Менеджер';
    const user = users.find(u => u.id === userId);
    return user?.name || 'Менеджер';
  };

  const getFileIcon = (mediaType?: string) => {
    if (mediaType === 'image') {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mediaType === 'video') {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mediaType === 'audio') {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const renderMediaContent = (msg: WhatsAppMessage) => {
    if (!msg.mediaUrl) return null;

    if (msg.mediaType === 'image') {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
          <img
            src={msg.mediaUrl}
            alt="Изображение"
            className="max-w-full rounded-lg max-h-48 object-cover hover:opacity-90 transition-opacity"
          />
        </a>
      );
    }

    if (msg.mediaType === 'video') {
      return (
        <video controls className="max-w-full rounded-lg max-h-48 mb-2">
          <source src={msg.mediaUrl} />
          Ваш браузер не поддерживает воспроизведение видео
        </video>
      );
    }

    if (msg.mediaType === 'audio') {
      return (
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-xs opacity-70">Аудиосообщение</span>
          </div>
          <audio controls className="w-full max-w-xs" style={{ height: '32px' }}>
            <source src={msg.mediaUrl} />
            Ваш браузер не поддерживает воспроизведение аудио
          </audio>
        </div>
      );
    }

    const fileName = (msg as any).mediaFilename || 'Файл';
    const fileExt = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : '';

    return (
      <a
        href={msg.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-2 transition-colors ${
          msg.direction === 'outgoing'
            ? 'bg-white/10 hover:bg-white/20'
            : 'bg-slate-100 hover:bg-slate-200'
        }`}
      >
        <div className="flex-shrink-0">
          {getFileIcon(msg.mediaType)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">
            {fileName}
          </span>
          <span className="text-xs opacity-70">
            {fileExt && `${fileExt} • `}Нажмите чтобы открыть
          </span>
        </div>
        <svg className="w-4 h-4 opacity-50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  };

  if (!client?.phone) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 text-sm">WhatsApp</h4>
            <p className="text-xs text-slate-400">Чат недоступен</p>
          </div>
        </div>
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 font-medium">Укажите номер телефона</p>
          <p className="text-xs text-slate-400 mt-1">для активации чата WhatsApp</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all duration-300" style={{ maxHeight: isExpanded ? '520px' : 'auto' }}>
      <div
        className="flex items-center justify-between p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20 relative">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 text-sm">WhatsApp</h4>
            <p className="text-xs text-slate-400">{client.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {messages.length} сообщ.
            </span>
          )}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <>
          <div
            className="flex-1 overflow-y-auto p-4 space-y-1 min-h-[280px] max-h-[340px]"
            style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)' }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full" />
                  <span className="text-xs text-slate-400">Загрузка сообщений...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-20 h-20 rounded-full bg-white/50 flex items-center justify-center mb-3">
                  <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-500">Нет сообщений</p>
                <p className="text-xs text-slate-400 mt-1">Начните переписку с клиентом</p>
              </div>
            ) : (
              groupMessagesByDate(messages).map((group, groupIdx) => (
                <div key={groupIdx}>
                  <div className="flex justify-center my-3">
                    <span className="bg-white/80 backdrop-blur-sm text-slate-500 text-[11px] px-3 py-1 rounded-full shadow-sm font-medium">
                      {formatDate(group.date)}
                    </span>
                  </div>
                  {group.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'} mb-2`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          msg.direction === 'outgoing'
                            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-br-md'
                            : 'bg-white text-slate-700 rounded-bl-md'
                        }`}
                      >
                        {msg.direction === 'incoming' && msg.senderName && (
                          <p className="text-[11px] text-green-600 font-semibold mb-1">
                            {msg.senderName}
                          </p>
                        )}
                        {msg.direction === 'outgoing' && msg.userId && (
                          <p className="text-[11px] text-white/80 font-medium mb-1">
                            {getUserName(msg.userId)}
                          </p>
                        )}
                        {renderMediaContent(msg)}
                        {msg.content && (
                          <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        )}
                        <div className={`flex items-center justify-end gap-1.5 mt-1.5 ${msg.direction === 'outgoing' ? 'text-white/70' : 'text-slate-400'}`}>
                          <span className="text-[10px]">{formatTime(msg.timestamp)}</span>
                          {msg.direction === 'outgoing' && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="px-4 py-2.5 bg-red-50 text-red-600 text-xs flex items-center gap-2 border-t border-red-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {selectedFile && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center gap-3 bg-white rounded-xl p-2 pr-3 border border-slate-200">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                    {getFileIcon(selectedFile.type.split('/')[0])}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} КБ</p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="p-3 border-t border-slate-100 bg-white">
            {showTemplates && (
              <div className="mb-3 max-h-40 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200">
                {templates.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">Нет шаблонов</div>
                ) : (
                  templates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-white text-sm border-b border-slate-100 last:border-0 transition-colors"
                      onClick={() => handleTemplateSelect(tpl)}
                    >
                      <span className="font-semibold text-green-600 text-[13px]">{tpl.name}</span>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{tpl.content}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                title="Прикрепить файл"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className={`p-2.5 rounded-xl transition-colors ${showTemplates ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                title="Шаблоны"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </button>
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите сообщение..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 resize-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '100px' }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={(!newMessage.trim() && !selectedFile) || isSending}
                className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25 disabled:shadow-none"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WhatsAppChat;
