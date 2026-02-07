import React, { useState, useEffect, useRef } from 'react';
import { Client, User, WhatsAppMessage, ClientStatus } from '../types';
import { whatsappService } from '../services/whatsappService';
import { clientService } from '../services/clientService';
import { greenApiIntegrationService } from '../services/greenApiIntegrationService';
import { evolutionApiService, EvolutionInstance } from '../services/evolutionApiService';
import { Integration } from '../services/integrationService';
import { MessageCircle, Search, Phone, Clock, CheckCheck, X, Settings, Paperclip, Mic, Smile, Send, Image, File, Video, ExternalLink, Wifi } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import ClientModal from './ClientModal';
import { EvolutionApiSettings } from './EvolutionApiSettings';

interface WhatsAppManagerProps {
  currentUser: User;
  users: User[];
}

interface ChatPreview extends Client {
  lastMessage?: WhatsAppMessage;
  unreadCount: number;
  chatId?: string;
  chatName?: string;
  chatType?: 'individual' | 'group';
}

const WhatsAppManager: React.FC<WhatsAppManagerProps> = ({ currentUser, users }) => {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [selectedClient, setSelectedClient] = useState<ChatPreview | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<'wazzup' | 'greenapi' | 'evolution'>(whatsappService.getProvider());
  const [providerStatus, setProviderStatus] = useState<string>('checking');
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForModal, setClientForModal] = useState<Client | null>(null);
  const [greenApiIntegrations, setGreenApiIntegrations] = useState<Integration[]>([]);
  const [activeIntegrationId, setActiveIntegrationId] = useState<string | null>(null);
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [activeEvolutionInstance, setActiveEvolutionInstance] = useState<string | null>(null);
  const [showEvolutionSettings, setShowEvolutionSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats();
    checkProviderStatus();
    loadGreenApiIntegrations();
    loadEvolutionInstances();
  }, []);

  const loadGreenApiIntegrations = async () => {
    try {
      const integrations = await greenApiIntegrationService.getAllIntegrations();
      setGreenApiIntegrations(integrations);

      const savedIntegrationId = whatsappService.getActiveIntegrationId();
      if (savedIntegrationId && integrations.some(i => i.id === savedIntegrationId)) {
        setActiveIntegrationId(savedIntegrationId);
      } else if (integrations.length > 0) {
        const activeIntegration = integrations.find(i => i.is_active && i.status === 'active');
        if (activeIntegration) {
          setActiveIntegrationId(activeIntegration.id);
          whatsappService.setActiveIntegrationId(activeIntegration.id);
        }
      }
    } catch (error) {
      console.error('Failed to load Green API integrations:', error);
    }
  };

  const loadEvolutionInstances = async () => {
    try {
      const instances = await whatsappService.getAllEvolutionInstances();
      setEvolutionInstances(instances);
      const saved = whatsappService.getActiveEvolutionInstanceName();
      if (saved && instances.some(i => i.instance_name === saved)) {
        setActiveEvolutionInstance(saved);
      } else {
        const connected = instances.find(i => i.connection_status === 'open');
        if (connected) {
          setActiveEvolutionInstance(connected.instance_name);
          whatsappService.setActiveEvolutionInstanceName(connected.instance_name);
        }
      }
    } catch (error) {
      console.error('Failed to load Evolution instances:', error);
    }
  };

  const checkProviderStatus = async () => {
    try {
      const status = await whatsappService.getStatus();
      setProviderStatus(status.status);
    } catch (error) {
      console.error('Failed to check provider status:', error);
      setProviderStatus('error');
    }
  };

  useEffect(() => {
    if (selectedClient) {
      console.log('Selected client changed, loading messages for:', selectedClient.id, 'chatId:', selectedClient.chatId);
      loadMessages(selectedClient.id, selectedClient.chatId);
      const unsubscribe = whatsappService.subscribeToMessages(selectedClient.id, handleNewMessage);
      return () => unsubscribe();
    } else {
      console.log('No client selected, clearing messages');
      setMessages([]);
    }
  }, [selectedClient]);

  useEffect(() => {
    console.log('Messages state updated. Count:', messages.length, 'Messages:', messages);
  }, [messages]);

  const loadChats = async () => {
    setIsLoading(true);
    try {
      const allChats = await whatsappService.getAllChats();
      const clients = await clientService.getAll();

      const clientsMap = new Map(clients.map(c => [c.id, c]));
      const chatClientIds = new Set(allChats.map(c => c.clientId).filter(Boolean));

      const chatsWithClientInfo = allChats.map(chat => {
        if (chat.clientId) {
          const client = clientsMap.get(chat.clientId);
          if (client) {
            return {
              ...client,
              lastMessage: chat.lastMessage,
              unreadCount: chat.unreadCount,
              chatId: chat.chatId,
              chatName: chat.chatName,
              chatType: chat.chatType
            };
          }
        }

        return {
          id: chat.clientId || chat.chatId,
          name: chat.chatName,
          company: '',
          email: '',
          phone: chat.phone || '',
          status: ClientStatus.IN_WORK,
          stage: 'In Work',
          budget: 0,
          prepayment: 0,
          source: 'Other',
          managerId: '',
          filesLink: '',
          service: '',
          createdAt: chat.createdAt,
          lastMessage: chat.lastMessage,
          unreadCount: chat.unreadCount,
          chatId: chat.chatId,
          chatName: chat.chatName,
          chatType: chat.chatType
        } as ChatPreview;
      });

      const clientsWithPhone = clients
        .filter(c => c.phone && !chatClientIds.has(c.id))
        .map(client => ({
          ...client,
          lastMessage: undefined,
          unreadCount: 0,
          chatId: undefined,
          chatName: undefined,
          chatType: 'individual' as const
        }));

      const allChatsData = [...chatsWithClientInfo, ...clientsWithPhone].sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || a.createdAt || '0';
        const timeB = b.lastMessage?.timestamp || b.createdAt || '0';
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setChats(allChatsData);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (clientId: string, chatId?: string) => {
    try {
      console.log('Loading messages for client:', clientId, 'chatId:', chatId);
      const msgs = chatId
        ? await whatsappService.getMessagesByChatId(chatId)
        : await whatsappService.getMessages(clientId);
      console.log('Loaded messages:', msgs);
      setMessages(msgs);

      const unreadIds = msgs
        .filter(m => m.direction === 'incoming' && !m.isRead)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await whatsappService.markAsRead(unreadIds);
        if (chatId) {
          await whatsappService.updateChatUnreadCount(chatId, 0);
        }
        updateChatUnreadCount(clientId, 0);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleNewMessage = (message: WhatsAppMessage) => {
    setMessages(prev => {
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });

    if (selectedClient?.id === message.clientId) {
      if (message.direction === 'incoming') {
        whatsappService.markAsRead([message.id]);
      }
    } else {
      updateChatUnreadCount(message.clientId, 1);
    }

    loadChats();
  };

  const updateChatUnreadCount = (clientId: string, increment: number) => {
    setChats(prev => prev.map(c =>
      c.id === clientId
        ? { ...c, unreadCount: increment === 0 ? 0 : c.unreadCount + increment }
        : c
    ));
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedClient || isSending) return;

    setIsSending(true);
    try {
      if (selectedFile) {
        await whatsappService.sendMessageWithFile(
          selectedClient.id,
          selectedClient.phone,
          newMessage.trim() || '',
          selectedFile,
          currentUser.id
        );
        clearSelectedFile();
      } else {
        await whatsappService.sendMessage(
          selectedClient.id,
          selectedClient.phone,
          newMessage.trim(),
          currentUser.id
        );
      }
      setNewMessage('');
      await loadMessages(selectedClient.id);
      await loadChats();
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleAudioRecordingComplete = async (audioBlob: Blob) => {
    if (!selectedClient || isSending) return;

    setIsSending(true);
    setShowAudioRecorder(false);
    try {
      await whatsappService.sendAudio(
        selectedClient.id,
        selectedClient.phone,
        audioBlob,
        currentUser.id
      );
      await loadMessages(selectedClient.id);
      await loadChats();
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send audio:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        alert('Файл слишком большой (макс. 16 МБ)');
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
      setShowAttachMenu(false);
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

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleProviderChange = (newProvider: 'wazzup' | 'greenapi' | 'evolution') => {
    whatsappService.setProvider(newProvider);
    setProvider(newProvider);
    checkProviderStatus();
    loadChats();
  };

  const handleEvolutionInstanceChange = (instanceName: string) => {
    setActiveEvolutionInstance(instanceName);
    whatsappService.setActiveEvolutionInstanceName(instanceName);
    checkProviderStatus();
  };

  const handleIntegrationChange = (integrationId: string) => {
    setActiveIntegrationId(integrationId);
    whatsappService.setActiveIntegrationId(integrationId);
    checkProviderStatus();
  };

  const handleSelectClient = (client: ChatPreview) => {
    setSelectedClient(client);
    setMessages([]);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phone.includes(searchQuery)
  );

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getMediaIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (file.type.startsWith('video/')) return <Video className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const renderMediaContent = (msg: WhatsAppMessage) => {
    if (!msg.mediaUrl) return null;

    if (msg.mediaType === 'image') {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
          <img
            src={msg.mediaUrl}
            alt="Изображение"
            className="max-w-sm rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          />
        </a>
      );
    }

    if (msg.mediaType === 'video') {
      return (
        <video controls className="max-w-sm rounded-lg mb-2">
          <source src={msg.mediaUrl} />
          Ваш браузер не поддерживает воспроизведение видео
        </video>
      );
    }

    if (msg.mediaType === 'audio') {
      return (
        <div className="mb-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Mic className="w-5 h-5" />
          </div>
          <audio controls className="flex-1" style={{ height: '40px', maxWidth: '300px' }}>
            <source src={msg.mediaUrl} />
            Ваш браузер не поддерживает воспроизведение аудио
          </audio>
        </div>
      );
    }

    const fileName = (msg as any).mediaFilename || 'Файл';
    return (
      <a
        href={msg.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2 bg-white/10 hover:bg-white/20 transition-colors"
      >
        <File className="w-5 h-5" />
        <span className="text-sm font-medium">{fileName}</span>
      </a>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-slate-800">WhatsApp Чаты</h2>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Настройки"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {showSettings && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase mb-2">Провайдер WhatsApp</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="greenapi"
                    checked={provider === 'greenapi'}
                    onChange={() => handleProviderChange('greenapi')}
                    className="text-green-600"
                  />
                  <span className="text-sm text-slate-700">Green API</span>
                  {provider === 'greenapi' && (
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      providerStatus === 'authorized' ? 'bg-green-100 text-green-700' :
                      providerStatus === 'notAuthorized' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {providerStatus === 'authorized' ? 'Подключен' :
                       providerStatus === 'notAuthorized' ? 'Требуется QR' :
                       providerStatus}
                    </span>
                  )}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="evolution"
                    checked={provider === 'evolution'}
                    onChange={() => handleProviderChange('evolution')}
                    className="text-green-600"
                  />
                  <span className="text-sm text-slate-700">Evolution API</span>
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">FREE</span>
                  {provider === 'evolution' && (
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      providerStatus === 'open' ? 'bg-green-100 text-green-700' :
                      providerStatus === 'no_instance' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {providerStatus === 'open' ? 'Подключен' :
                       providerStatus === 'no_instance' ? 'Нет инстанса' :
                       providerStatus}
                    </span>
                  )}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="wazzup"
                    checked={provider === 'wazzup'}
                    onChange={() => handleProviderChange('wazzup')}
                    className="text-green-600"
                  />
                  <span className="text-sm text-slate-700">Wazzup24</span>
                  {provider === 'wazzup' && (
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      providerStatus === 'active' ? 'bg-green-100 text-green-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {providerStatus === 'active' ? 'Подключен' : providerStatus}
                    </span>
                  )}
                </label>
              </div>

              {provider === 'greenapi' && greenApiIntegrations.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-600 uppercase mb-2">Инстанс WhatsApp</p>
                  <select
                    value={activeIntegrationId || ''}
                    onChange={(e) => handleIntegrationChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {greenApiIntegrations.map(integration => (
                      <option key={integration.id} value={integration.id}>
                        {integration.name} - {integration.status === 'active' ? 'Активен' : integration.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {provider === 'evolution' && (
                <div className="mt-4">
                  {evolutionInstances.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-slate-600 uppercase mb-2">Инстанс Evolution</p>
                      <select
                        value={activeEvolutionInstance || ''}
                        onChange={(e) => handleEvolutionInstanceChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-2"
                      >
                        {evolutionInstances.map(inst => (
                          <option key={inst.id} value={inst.instance_name}>
                            {inst.instance_name} - {inst.connection_status === 'open' ? 'Подключен' : inst.connection_status}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <button
                    onClick={() => setShowEvolutionSettings(true)}
                    className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Wifi className="w-4 h-4" />
                    Управление инстансами
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск чатов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <MessageCircle className="w-12 h-12 mb-2" />
              <p className="text-sm">Нет активных чатов</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectClient(chat)}
                className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                  selectedClient?.id === chat.id ? 'bg-green-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(chat.chatName || chat.name).charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 truncate">{chat.chatName || chat.name}</h3>
                        {chat.chatType === 'group' && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            Группа
                          </span>
                        )}
                      </div>
                      {chat.lastMessage && (
                        <span className="text-xs text-slate-400 ml-2 flex-shrink-0">
                          {formatTime(chat.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500 truncate">
                        {chat.lastMessage?.content || (chat.chatType === 'group' ? 'Групповой чат' : chat.phone || 'Нет сообщений')}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full flex-shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedClient ? (
          <>
            <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <div
                className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-slate-50 -m-4 p-4 rounded-lg transition-colors group"
                onClick={() => {
                  if (selectedClient.chatType !== 'group') {
                    setClientForModal(selectedClient);
                    setShowClientModal(true);
                  }
                }}
                title={selectedClient.chatType === 'group' ? 'Групповой чат' : 'Открыть карточку клиента'}
              >
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                  {(selectedClient.chatName || selectedClient.name).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    {selectedClient.chatName || selectedClient.name}
                    {selectedClient.chatType === 'group' ? (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        Группа
                      </span>
                    ) : (
                      <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </h3>
                  {selectedClient.chatType === 'group' ? (
                    <span className="text-sm text-slate-500">Групповой чат</span>
                  ) : selectedClient.phone ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Phone className="w-3 h-3" />
                      <span>{selectedClient.phone}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-2"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23f0f2f5\'/%3E%3Cpath d=\'M25 25h50v50H25z\' fill=\'%23e5e7eb\' opacity=\'.1\'/%3E%3C/svg%3E")',
                backgroundColor: '#efeae2'
              }}
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MessageCircle className="w-20 h-20 mb-4 opacity-30" />
                  <p className="text-lg font-semibold">Начните диалог</p>
                  <p className="text-sm">Отправьте первое сообщение клиенту</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOutgoing = msg.direction === 'outgoing';
                  const sender = isOutgoing && msg.userId ? users.find(u => u.id === msg.userId) : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-2`}
                    >
                      <div className={`max-w-lg ${isOutgoing ? 'order-2' : 'order-1'}`}>
                        <div
                          className={`px-3 py-2 rounded-lg shadow-sm ${
                            isOutgoing
                              ? 'bg-[#d9fdd3] text-slate-800 rounded-br-none'
                              : 'bg-white text-slate-800 rounded-bl-none'
                          }`}
                        >
                          {!isOutgoing && msg.senderName && (
                            <p className="text-xs font-bold mb-1 text-green-600">
                              {msg.senderName}
                            </p>
                          )}

                          {isOutgoing && sender && (
                            <p className="text-[11px] font-semibold mb-1 text-slate-500">
                              {sender.name}
                            </p>
                          )}

                          {renderMediaContent(msg)}

                          {msg.content && (
                            <p className="text-[14px] whitespace-pre-wrap break-words leading-relaxed">
                              {msg.content}
                            </p>
                          )}

                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[11px] text-slate-500">
                              {formatTime(msg.timestamp)}
                            </span>
                            {isOutgoing && (
                              <CheckCheck className={`w-4 h-4 ${
                                msg.status === 'read' ? 'text-blue-500' : 'text-slate-400'
                              }`} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {selectedFile && (
              <div className="bg-slate-50 border-t border-slate-200 p-3">
                <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-200">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                      {getMediaIcon(selectedFile)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} КБ</p>
                  </div>
                  <button
                    onClick={clearSelectedFile}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border-t border-slate-200 p-3">
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                />

                <div className="relative">
                  <button
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="p-3 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <Paperclip className="w-5 h-5 text-slate-500" />
                  </button>

                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 py-2 min-w-[200px]">
                      <button
                        onClick={() => {
                          fileInputRef.current?.setAttribute('accept', 'image/*');
                          fileInputRef.current?.click();
                        }}
                        className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <Image className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">Фото</span>
                      </button>
                      <button
                        onClick={() => {
                          fileInputRef.current?.setAttribute('accept', 'video/*');
                          fileInputRef.current?.click();
                        }}
                        className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                          <Video className="w-5 h-5 text-pink-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">Видео</span>
                      </button>
                      <button
                        onClick={() => {
                          fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx');
                          fileInputRef.current?.click();
                        }}
                        className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <File className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">Документ</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  className="p-3 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Smile className="w-5 h-5 text-slate-500" />
                </button>

                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Сообщение"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 text-[15px]"
                  rows={1}
                  style={{ maxHeight: '120px' }}
                />

                {newMessage.trim() || selectedFile ? (
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending}
                    className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAudioRecorder(true)}
                    className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {showAudioRecorder && (
              <AudioRecorder
                onRecordingComplete={handleAudioRecordingComplete}
                onCancel={() => setShowAudioRecorder(false)}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center text-slate-400">
              <MessageCircle className="w-24 h-24 mx-auto mb-4" />
              <p className="text-lg font-semibold">Выберите чат для начала общения</p>
              <p className="text-sm mt-2">Все ваши WhatsApp чаты с клиентами здесь</p>
            </div>
          </div>
        )}
      </div>

      {showEvolutionSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Evolution API</h2>
              <button
                onClick={() => setShowEvolutionSettings(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <EvolutionApiSettings
              onInstanceCreated={() => loadEvolutionInstances()}
              onInstanceDeleted={() => loadEvolutionInstances()}
            />
          </div>
        </div>
      )}

      {showClientModal && clientForModal && (
        <ClientModal
          isOpen={showClientModal}
          onClose={() => {
            setShowClientModal(false);
            setClientForModal(null);
            loadChats();
          }}
          client={clientForModal}
          onSave={async (updatedClient) => {
            if (updatedClient.id) {
              await clientService.update(updatedClient.id, updatedClient);
            }
            setShowClientModal(false);
            setClientForModal(null);
            await loadChats();
          }}
          users={users}
          tasks={[]}
          transactions={[]}
          services={[]}
          currentUserId={currentUser.id}
          onAddTransaction={() => {}}
          onTaskStatusToggle={() => {}}
          onCreateTask={() => {}}
          onLaunchProject={() => {}}
          onServiceCreate={async () => {}}
          onArchiveClient={() => {}}
        />
      )}
    </div>
  );
};

export default WhatsAppManager;
