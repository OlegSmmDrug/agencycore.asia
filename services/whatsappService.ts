import { WhatsAppMessage, WhatsAppChat } from '../types';
import { wazzupService } from './wazzupService';
import { greenApiService, GreenApiConfig } from './greenApiService';
import { greenApiIntegrationService } from './greenApiIntegrationService';
import { evolutionApiService } from './evolutionApiService';
import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';

type WhatsAppProvider = 'wazzup' | 'greenapi' | 'evolution';

const PROVIDER_KEY = 'whatsapp_provider';
const ACTIVE_INTEGRATION_KEY = 'active_greenapi_integration';
const ACTIVE_EVOLUTION_INSTANCE_KEY = 'active_evolution_instance';

export const whatsappService = {
  getProvider(): WhatsAppProvider {
    return (localStorage.getItem(PROVIDER_KEY) as WhatsAppProvider) || 'greenapi';
  },

  setProvider(provider: WhatsAppProvider) {
    localStorage.setItem(PROVIDER_KEY, provider);
  },

  getActiveIntegrationId(): string | null {
    return localStorage.getItem(ACTIVE_INTEGRATION_KEY);
  },

  setActiveIntegrationId(integrationId: string) {
    localStorage.setItem(ACTIVE_INTEGRATION_KEY, integrationId);
  },

  async getActiveIntegrationConfig(): Promise<{ config: GreenApiConfig; integrationId: string } | null> {
    const storedIntegrationId = this.getActiveIntegrationId();

    if (storedIntegrationId) {
      const credentials = await greenApiIntegrationService.getCredentials(storedIntegrationId);
      if (credentials) {
        return {
          config: {
            idInstance: credentials.id_instance,
            apiToken: credentials.api_token_instance,
          },
          integrationId: storedIntegrationId,
        };
      }
    }

    const allIntegrations = await greenApiIntegrationService.getAllActiveIntegrations();
    const defaultIntegration = allIntegrations.find(i => i.config?.is_default);

    if (defaultIntegration) {
      const credentials = await greenApiIntegrationService.getCredentials(defaultIntegration.id);
      if (credentials) {
        this.setActiveIntegrationId(defaultIntegration.id);
        return {
          config: {
            idInstance: credentials.id_instance,
            apiToken: credentials.api_token_instance,
          },
          integrationId: defaultIntegration.id,
        };
      }
    }

    if (allIntegrations.length > 0) {
      const firstIntegration = allIntegrations[0];
      const credentials = await greenApiIntegrationService.getCredentials(firstIntegration.id);
      if (credentials) {
        this.setActiveIntegrationId(firstIntegration.id);
        return {
          config: {
            idInstance: credentials.id_instance,
            apiToken: credentials.api_token_instance,
          },
          integrationId: firstIntegration.id,
        };
      }
    }

    return null;
  },

  async getAllAvailableIntegrations(): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
    const allIntegrations = await greenApiIntegrationService.getAllActiveIntegrations();
    return allIntegrations.map(i => ({
      id: i.id,
      name: i.name,
      isDefault: i.config?.is_default || false,
    }));
  },

  getActiveEvolutionInstanceName(): string | null {
    return localStorage.getItem(ACTIVE_EVOLUTION_INSTANCE_KEY);
  },

  setActiveEvolutionInstanceName(instanceName: string) {
    localStorage.setItem(ACTIVE_EVOLUTION_INSTANCE_KEY, instanceName);
  },

  async getActiveEvolutionInstance(): Promise<string | null> {
    const stored = this.getActiveEvolutionInstanceName();
    if (stored) {
      const inst = await evolutionApiService.getInstanceByName(stored);
      if (inst && inst.connection_status === 'open') return stored;
    }

    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return null;

    const active = await evolutionApiService.getActiveInstance(organizationId);
    if (active) {
      this.setActiveEvolutionInstanceName(active.instance_name);
      return active.instance_name;
    }

    return null;
  },

  async getAllEvolutionInstances() {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];
    return evolutionApiService.getInstancesByOrganization(organizationId);
  },

  async getAllChats(): Promise<WhatsAppChat[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    try {
      let { data: chatsData, error: chatsError } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('organization_id', organizationId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (chatsError) {
        console.error('Error fetching chats:', chatsError);
        return [];
      }

      if (!chatsData || chatsData.length === 0) {
        const { data: fallbackChatsData, error: fallbackChatsError } = await supabase
          .from('whatsapp_chats')
          .select('*')
          .is('organization_id', null)
          .order('last_message_at', { ascending: false, nullsFirst: false });

        if (!fallbackChatsError && fallbackChatsData) {
          chatsData = fallbackChatsData;
        } else {
          return [];
        }
      }

      const chatIds = chatsData.map(chat => chat.chat_id);

      const { data: messagesData, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('chat_id', chatIds)
        .order('timestamp', { ascending: false });

      if (messagesError) {
        console.error('Error fetching messages for chats:', messagesError);
      }

      const lastMessagesByChat = new Map<string, WhatsAppMessage>();
      if (messagesData) {
        for (const msg of messagesData) {
          if (!lastMessagesByChat.has(msg.chat_id)) {
            lastMessagesByChat.set(msg.chat_id, {
              id: msg.id,
              clientId: msg.client_id,
              messageId: msg.message_id,
              direction: msg.direction as 'incoming' | 'outgoing',
              content: msg.content,
              senderName: msg.sender_name,
              userId: msg.user_id,
              status: msg.status as WhatsAppMessage['status'],
              timestamp: msg.timestamp,
              mediaUrl: msg.media_url,
              mediaType: msg.media_type as WhatsAppMessage['mediaType'],
              mediaFilename: msg.media_filename,
              channelId: msg.channel_id,
              chatId: msg.chat_id,
              chatName: msg.chat_name,
              chatType: msg.chat_type,
              isRead: msg.is_read
            });
          }
        }
      }

      const chats = chatsData.map(chat => ({
        id: chat.id,
        chatId: chat.chat_id,
        chatName: chat.chat_name,
        chatType: chat.chat_type,
        clientId: chat.client_id,
        phone: chat.phone,
        lastMessageAt: chat.last_message_at,
        unreadCount: chat.unread_count || 0,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
        lastMessage: lastMessagesByChat.get(chat.chat_id)
      }));

      return chats;
    } catch (error) {
      console.error('Error in getAllChats:', error);
      return [];
    }
  },

  async getMessagesByChatId(chatId: string): Promise<WhatsAppMessage[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return [];
    }

    let { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .eq('organization_id', organizationId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching messages by chatId:', error);
      return [];
    }

    if (!data || data.length === 0) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('chat_id', chatId)
        .is('organization_id', null)
        .order('timestamp', { ascending: true });

      if (!fallbackError && fallbackData) {
        data = fallbackData;
      }
    }

    return (data || []).map(msg => ({
      id: msg.id,
      clientId: msg.client_id,
      messageId: msg.message_id,
      direction: msg.direction as 'incoming' | 'outgoing',
      content: msg.content,
      senderName: msg.sender_name,
      userId: msg.user_id,
      status: msg.status as WhatsAppMessage['status'],
      timestamp: msg.timestamp,
      mediaUrl: msg.media_url,
      mediaType: msg.media_type as WhatsAppMessage['mediaType'],
      mediaFilename: msg.media_filename,
      channelId: msg.channel_id,
      chatId: msg.chat_id,
      chatName: msg.chat_name,
      chatType: msg.chat_type,
      isRead: msg.is_read
    }));
  },

  async upsertChat(chatData: {
    chatId: string;
    chatName: string;
    chatType: 'individual' | 'group';
    clientId?: string;
    phone?: string;
  }): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return;
    }

    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .upsert({
          chat_id: chatData.chatId,
          chat_name: chatData.chatName,
          chat_type: chatData.chatType,
          client_id: chatData.clientId,
          phone: chatData.phone,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          organization_id: organizationId
        }, {
          onConflict: 'chat_id'
        });

      if (error) {
        console.error('Error upserting chat:', error);
      }
    } catch (error) {
      console.error('Error in upsertChat:', error);
    }
  },

  async updateChatUnreadCount(chatId: string, increment: number = 1): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      return;
    }

    try {
      const { data: chat } = await supabase
        .from('whatsapp_chats')
        .select('unread_count')
        .eq('chat_id', chatId)
        .eq('organization_id', organizationId)
        .single();

      const newCount = increment === 0 ? 0 : (chat?.unread_count || 0) + increment;

      await supabase
        .from('whatsapp_chats')
        .update({ unread_count: newCount })
        .eq('chat_id', chatId)
        .eq('organization_id', organizationId);
    } catch (error) {
      console.error('Error updating chat unread count:', error);
    }
  },

  async sendMessage(
    clientId: string,
    phone: string,
    text: string,
    userId?: string,
    channelId?: string
  ): Promise<WhatsAppMessage | null> {
    const provider = this.getProvider();

    if (provider === 'evolution') {
      const instanceName = await this.getActiveEvolutionInstance();
      if (!instanceName) throw new Error('Нет активного Evolution API инстанса');
      const cleanPhone = phone.replace(/\D/g, '');
      await evolutionApiService.sendText(instanceName, cleanPhone, text);
      const organizationId = getCurrentOrganizationId();
      const chatId = `${cleanPhone}@s.whatsapp.net`;
      const ts = new Date().toISOString();

      await supabase.from('whatsapp_chats').upsert({
        chat_id: chatId,
        chat_name: phone,
        chat_type: 'individual',
        client_id: clientId,
        phone: cleanPhone,
        last_message_at: ts,
        organization_id: organizationId,
        provider_type: 'evolution',
        updated_at: ts,
      }, { onConflict: 'chat_id' });

      const msgRecord = {
        organization_id: organizationId,
        client_id: clientId,
        message_id: `out_${Date.now()}`,
        direction: 'outgoing' as const,
        content: text,
        sender_name: 'Менеджер',
        user_id: userId,
        status: 'sent' as const,
        timestamp: ts,
        chat_id: chatId,
        chat_type: 'whatsapp',
        is_read: true,
        provider_type: 'evolution',
      };

      const { data } = await supabase
        .from('whatsapp_messages')
        .insert(msgRecord)
        .select()
        .single();

      if (!data) return null;
      return {
        id: data.id,
        clientId: data.client_id,
        messageId: data.message_id,
        direction: 'outgoing',
        content: text,
        senderName: data.sender_name,
        userId: data.user_id,
        status: 'sent',
        timestamp: data.timestamp,
        chatId: data.chat_id,
        chatType: data.chat_type,
        isRead: true,
      };
    } else if (provider === 'greenapi') {
      const integration = await this.getActiveIntegrationConfig();
      if (integration) {
        return greenApiService.sendMessage(
          clientId,
          phone,
          text,
          userId,
          integration.config,
          integration.integrationId
        );
      }
      return greenApiService.sendMessage(clientId, phone, text, userId);
    } else {
      return wazzupService.sendMessage(clientId, phone, text, userId, channelId);
    }
  },

  async sendMessageWithFile(
    clientId: string,
    phone: string,
    text: string,
    file: File,
    userId?: string,
    channelId?: string
  ): Promise<WhatsAppMessage | null> {
    const provider = this.getProvider();

    if (provider === 'evolution') {
      const instanceName = await this.getActiveEvolutionInstance();
      if (!instanceName) throw new Error('Нет активного Evolution API инстанса');
      const cleanPhone = phone.replace(/\D/g, '');

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      let mediatype: 'image' | 'video' | 'audio' | 'document' = 'document';
      if (file.type.startsWith('image/')) mediatype = 'image';
      else if (file.type.startsWith('video/')) mediatype = 'video';
      else if (file.type.startsWith('audio/')) mediatype = 'audio';

      await evolutionApiService.sendMedia(instanceName, cleanPhone, mediatype, base64, text, file.name);

      const organizationId = getCurrentOrganizationId();
      const chatId = `${cleanPhone}@s.whatsapp.net`;
      const ts = new Date().toISOString();

      const { data } = await supabase
        .from('whatsapp_messages')
        .insert({
          organization_id: organizationId,
          client_id: clientId,
          message_id: `out_${Date.now()}`,
          direction: 'outgoing',
          content: text || `[${mediatype}]`,
          sender_name: 'Менеджер',
          user_id: userId,
          status: 'sent',
          timestamp: ts,
          media_type: mediatype,
          media_filename: file.name,
          chat_id: chatId,
          chat_type: 'whatsapp',
          is_read: true,
          provider_type: 'evolution',
        })
        .select()
        .single();

      if (!data) return null;
      return {
        id: data.id,
        clientId: data.client_id,
        messageId: data.message_id,
        direction: 'outgoing',
        content: data.content,
        senderName: data.sender_name,
        userId: data.user_id,
        status: 'sent',
        timestamp: data.timestamp,
        mediaType: mediatype,
        mediaFilename: file.name,
        chatId: data.chat_id,
        chatType: data.chat_type,
        isRead: true,
      };
    } else if (provider === 'greenapi') {
      const integration = await this.getActiveIntegrationConfig();
      if (integration) {
        return greenApiService.sendFileByUpload(
          clientId,
          phone,
          text,
          file,
          userId,
          integration.config,
          integration.integrationId
        );
      }
      return greenApiService.sendFileByUpload(clientId, phone, text, file, userId);
    } else {
      return wazzupService.sendMessageWithFile(clientId, phone, text, file, userId, channelId);
    }
  },

  async getMessages(clientId: string): Promise<WhatsAppMessage[]> {
    const provider = this.getProvider();

    if (provider === 'greenapi') {
      return greenApiService.getMessages(clientId);
    } else {
      return wazzupService.getMessages(clientId);
    }
  },

  async markAsRead(messageIds: string[]): Promise<void> {
    const provider = this.getProvider();

    if (provider === 'greenapi') {
      return greenApiService.markAsRead(messageIds);
    } else {
      return wazzupService.markAsRead(messageIds);
    }
  },

  async getUnreadCount(clientId: string): Promise<number> {
    const provider = this.getProvider();

    if (provider === 'greenapi') {
      return greenApiService.getUnreadCount(clientId);
    } else {
      return wazzupService.getUnreadCount(clientId);
    }
  },

  subscribeToMessages(clientId: string, callback: (message: WhatsAppMessage) => void) {
    const provider = this.getProvider();

    if (provider === 'greenapi') {
      return greenApiService.subscribeToMessages(clientId, callback);
    } else {
      return wazzupService.subscribeToMessages(clientId, callback);
    }
  },

  async getStatus(): Promise<{ provider: WhatsAppProvider; status: string; info?: any }> {
    const provider = this.getProvider();

    try {
      if (provider === 'evolution') {
        const instanceName = await this.getActiveEvolutionInstance();
        if (!instanceName) {
          return { provider: 'evolution', status: 'no_instance' };
        }
        const state = await evolutionApiService.getConnectionState(instanceName);
        return { provider: 'evolution', status: state, info: { instanceName } };
      } else if (provider === 'greenapi') {
        const integration = await this.getActiveIntegrationConfig();
        if (integration) {
          const state = await greenApiService.getStateInstance(integration.config);
          return {
            provider: 'greenapi',
            status: state.stateInstance,
            info: state
          };
        }
        const state = await greenApiService.getStateInstance();
        return {
          provider: 'greenapi',
          status: state.stateInstance,
          info: state
        };
      } else {
        const channels = await wazzupService.getChannels();
        const activeChannel = channels.find(ch => ch.status === 'active');
        return {
          provider: 'wazzup',
          status: activeChannel ? 'active' : 'disconnected',
          info: channels
        };
      }
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      return {
        provider,
        status: 'error',
        info: error
      };
    }
  },

  async getQRCode(): Promise<string | null> {
    const provider = this.getProvider();

    if (provider === 'greenapi') {
      try {
        const integration = await this.getActiveIntegrationConfig();
        if (integration) {
          return await greenApiService.getQRCode(integration.config);
        }
        return await greenApiService.getQRCode();
      } catch (error) {
        console.error('Error getting QR code:', error);
        return null;
      }
    }

    return null;
  },

  async sendAudio(
    clientId: string,
    phone: string,
    audioBlob: Blob,
    userId?: string
  ): Promise<WhatsAppMessage | null> {
    const provider = this.getProvider();

    if (provider === 'evolution') {
      const instanceName = await this.getActiveEvolutionInstance();
      if (!instanceName) throw new Error('Нет активного Evolution API инстанса');
      const cleanPhone = phone.replace(/\D/g, '');

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      await evolutionApiService.sendAudio(instanceName, cleanPhone, base64);

      const organizationId = getCurrentOrganizationId();
      const chatId = `${cleanPhone}@s.whatsapp.net`;
      const ts = new Date().toISOString();

      const { data } = await supabase
        .from('whatsapp_messages')
        .insert({
          organization_id: organizationId,
          client_id: clientId,
          message_id: `out_${Date.now()}`,
          direction: 'outgoing',
          content: '[Audio]',
          sender_name: 'Менеджер',
          user_id: userId,
          status: 'sent',
          timestamp: ts,
          media_type: 'audio',
          chat_id: chatId,
          chat_type: 'whatsapp',
          is_read: true,
          provider_type: 'evolution',
        })
        .select()
        .single();

      if (!data) return null;
      return {
        id: data.id,
        clientId: data.client_id,
        messageId: data.message_id,
        direction: 'outgoing',
        content: '[Audio]',
        senderName: data.sender_name,
        userId: data.user_id,
        status: 'sent',
        timestamp: data.timestamp,
        mediaType: 'audio',
        chatId: data.chat_id,
        chatType: data.chat_type,
        isRead: true,
      };
    } else if (provider === 'greenapi') {
      const integration = await this.getActiveIntegrationConfig();
      if (integration) {
        return greenApiService.sendAudio(
          clientId,
          phone,
          audioBlob,
          userId,
          integration.config,
          integration.integrationId
        );
      }
      return greenApiService.sendAudio(clientId, phone, audioBlob, userId);
    } else {
      return null;
    }
  }
};
