import { supabase } from '../lib/supabase';
import { WhatsAppMessage } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

const ID_INSTANCE = import.meta.env.VITE_GREEN_API_ID_INSTANCE;
const API_TOKEN = import.meta.env.VITE_GREEN_API_TOKEN;
const API_URL = import.meta.env.VITE_GREEN_API_URL || 'https://api.green-api.com';
const MEDIA_URL = import.meta.env.VITE_GREEN_API_MEDIA_URL;

interface GreenApiResponse {
  idMessage?: string;
  statusMessage?: string;
}

interface StateResponse {
  stateInstance: 'authorized' | 'notAuthorized' | 'blocked' | 'sleepMode' | 'starting';
}

export interface GreenApiConfig {
  idInstance: string;
  apiToken: string;
  apiUrl?: string;
}

const formatPhoneForWhatsApp = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('7') && cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }
  return cleaned + '@c.us';
};

export const greenApiService = {
  async getStateInstance(config?: GreenApiConfig): Promise<StateResponse> {
    try {
      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/getStateInstance/${apiToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get state: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting Green API state:', error);
      throw error;
    }
  },

  async sendMessage(
    clientId: string,
    phone: string,
    text: string,
    userId?: string,
    config?: GreenApiConfig,
    integrationId?: string
  ): Promise<WhatsAppMessage | null> {
    try {
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const chatId = formatPhoneForWhatsApp(phone);

      const { data: existingMessage } = await supabase
        .from('whatsapp_messages')
        .insert({
          client_id: clientId,
          direction: 'outgoing',
          content: text,
          user_id: userId,
          status: 'sending',
          timestamp: new Date().toISOString(),
          channel_id: integrationId || idInstance,
          chat_id: chatId,
          chat_type: 'whatsapp',
          is_read: true,
          organization_id: organizationId
        })
        .select()
        .single();

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/sendMessage/${apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chatId: chatId,
            message: text
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Green API error:', errorData);

        if (existingMessage) {
          await supabase
            .from('whatsapp_messages')
            .update({ status: 'failed' })
            .eq('id', existingMessage.id);
        }
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const result: GreenApiResponse = await response.json();

      if (existingMessage && result.idMessage) {
        await supabase
          .from('whatsapp_messages')
          .update({
            message_id: result.idMessage,
            status: 'sent'
          })
          .eq('id', existingMessage.id);
      }

      return existingMessage ? {
        id: existingMessage.id,
        clientId: existingMessage.client_id,
        messageId: result.idMessage,
        direction: 'outgoing',
        content: text,
        userId: userId,
        status: 'sent',
        timestamp: existingMessage.timestamp,
        channelId: integrationId || idInstance,
        chatId: chatId,
        isRead: true
      } : null;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  },

  async sendFileByUpload(
    clientId: string,
    phone: string,
    text: string,
    file: File,
    userId?: string,
    config?: GreenApiConfig,
    integrationId?: string
  ): Promise<WhatsAppMessage | null> {
    try {
      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const chatId = formatPhoneForWhatsApp(phone);

      const mediaType = file.type.startsWith('image/') ? 'image' :
                        file.type.startsWith('video/') ? 'video' :
                        file.type.startsWith('audio/') ? 'audio' : 'document';

      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const storagePath = `${clientId}/${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file to storage:', uploadError);
        throw new Error('Не удалось загрузить файл');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(storagePath);

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Content = await base64Promise;

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: existingMessage } = await supabase
        .from('whatsapp_messages')
        .insert({
          client_id: clientId,
          direction: 'outgoing',
          content: text || `[${file.name}]`,
          user_id: userId,
          status: 'sending',
          timestamp: new Date().toISOString(),
          channel_id: integrationId || idInstance,
          chat_id: chatId,
          chat_type: 'whatsapp',
          media_type: mediaType,
          media_filename: file.name,
          media_url: publicUrl,
          is_read: true,
          organization_id: organizationId
        })
        .select()
        .single();

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/sendFileByUpload/${apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chatId: chatId,
            file: base64Content,
            fileName: file.name,
            caption: text || undefined
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Green API error:', errorData);

        if (existingMessage) {
          await supabase
            .from('whatsapp_messages')
            .update({ status: 'failed' })
            .eq('id', existingMessage.id);
        }
        throw new Error(`Failed to send file: ${response.status}`);
      }

      const result: GreenApiResponse = await response.json();

      if (existingMessage && result.idMessage) {
        await supabase
          .from('whatsapp_messages')
          .update({
            message_id: result.idMessage,
            status: 'sent'
          })
          .eq('id', existingMessage.id);
      }

      return existingMessage ? {
        id: existingMessage.id,
        clientId: existingMessage.client_id,
        messageId: result.idMessage,
        direction: 'outgoing',
        content: text || `[${file.name}]`,
        userId: userId,
        status: 'sent',
        timestamp: existingMessage.timestamp,
        channelId: integrationId || idInstance,
        chatId: chatId,
        mediaType: mediaType,
        mediaUrl: publicUrl,
        mediaFilename: file.name,
        isRead: true
      } : null;
    } catch (error) {
      console.error('Error sending WhatsApp file:', error);
      throw error;
    }
  },

  async getMessages(clientId: string): Promise<WhatsAppMessage[]> {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('client_id', clientId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
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
      chatType: msg.chat_type,
      isRead: msg.is_read
    }));
  },

  async markAsRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    await supabase
      .from('whatsapp_messages')
      .update({ is_read: true })
      .in('id', messageIds);
  },

  async getUnreadCount(clientId: string): Promise<number> {
    const { count } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('direction', 'incoming')
      .eq('is_read', false);

    return count || 0;
  },

  subscribeToMessages(clientId: string, callback: (message: WhatsAppMessage) => void) {
    const subscription = supabase
      .channel(`whatsapp-messages-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          const msg = payload.new as any;
          callback({
            id: msg.id,
            clientId: msg.client_id,
            messageId: msg.message_id,
            direction: msg.direction,
            content: msg.content,
            senderName: msg.sender_name,
            userId: msg.user_id,
            status: msg.status,
            timestamp: msg.timestamp,
            mediaUrl: msg.media_url,
            mediaType: msg.media_type,
            mediaFilename: msg.media_filename,
            channelId: msg.channel_id,
            chatId: msg.chat_id,
            chatType: msg.chat_type,
            isRead: msg.is_read
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  async getQRCode(config?: GreenApiConfig): Promise<string> {
    try {
      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/qr/${apiToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get QR code: ${response.status}`);
      }

      const data = await response.json();
      return data.message || '';
    } catch (error) {
      console.error('Error getting QR code:', error);
      throw error;
    }
  },

  async sendAudio(
    clientId: string,
    phone: string,
    audioBlob: Blob,
    userId?: string,
    config?: GreenApiConfig,
    integrationId?: string
  ): Promise<WhatsAppMessage | null> {
    try {
      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const chatId = formatPhoneForWhatsApp(phone);

      const timestamp = Date.now();
      const storagePath = `${clientId}/${timestamp}_voice.ogg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(storagePath, audioBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'audio/ogg'
        });

      if (uploadError) {
        console.error('Error uploading audio to storage:', uploadError);
        throw new Error('Не удалось загрузить аудио');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(storagePath);

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      const base64Content = await base64Promise;

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: existingMessage } = await supabase
        .from('whatsapp_messages')
        .insert({
          client_id: clientId,
          direction: 'outgoing',
          content: '[Голосовое сообщение]',
          user_id: userId,
          status: 'sending',
          timestamp: new Date().toISOString(),
          channel_id: integrationId || idInstance,
          chat_id: chatId,
          chat_type: 'whatsapp',
          media_type: 'audio',
          media_filename: 'voice.ogg',
          media_url: publicUrl,
          is_read: true,
          organization_id: organizationId
        })
        .select()
        .single();

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/sendFileByUpload/${apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chatId: chatId,
            file: base64Content,
            fileName: 'voice.ogg'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Green API error:', errorData);

        if (existingMessage) {
          await supabase
            .from('whatsapp_messages')
            .update({ status: 'failed' })
            .eq('id', existingMessage.id);
        }
        throw new Error(`Failed to send audio: ${response.status}`);
      }

      const result: GreenApiResponse = await response.json();

      if (existingMessage && result.idMessage) {
        await supabase
          .from('whatsapp_messages')
          .update({
            message_id: result.idMessage,
            status: 'sent'
          })
          .eq('id', existingMessage.id);
      }

      return existingMessage ? {
        id: existingMessage.id,
        clientId: existingMessage.client_id,
        messageId: result.idMessage,
        direction: 'outgoing',
        content: '[Голосовое сообщение]',
        userId: userId,
        status: 'sent',
        timestamp: existingMessage.timestamp,
        channelId: integrationId || idInstance,
        chatId: chatId,
        mediaType: 'audio',
        mediaUrl: publicUrl,
        isRead: true
      } : null;
    } catch (error) {
      console.error('Error sending WhatsApp audio:', error);
      throw error;
    }
  },

  async getChats(config?: GreenApiConfig): Promise<any[]> {
    try {
      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/getChats/${apiToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get chats: ${response.status}`);
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error getting chats:', error);
      return [];
    }
  },

  async getSettings(config?: GreenApiConfig): Promise<any> {
    try {
      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/getSettings/${apiToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get settings: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  },

  async setSettings(settings: {
    webhookUrl?: string;
    webhookUrlToken?: string;
    outgoingWebhook?: 'yes' | 'no';
    incomingWebhook?: 'yes' | 'no';
    stateWebhook?: 'yes' | 'no';
    deviceWebhook?: 'yes' | 'no';
  }, config?: GreenApiConfig): Promise<boolean> {
    try {
      const idInstance = config?.idInstance || ID_INSTANCE;
      const apiToken = config?.apiToken || API_TOKEN;
      const apiUrl = config?.apiUrl || API_URL;

      const response = await fetch(
        `${apiUrl}/waInstance${idInstance}/setSettings/${apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to set settings:', errorData);
        throw new Error(`Failed to set settings: ${response.status}`);
      }

      const result = await response.json();
      return result.saveSettings === true;
    } catch (error) {
      console.error('Error setting webhook settings:', error);
      throw error;
    }
  },

  async configureWebhookForOutgoing(integrationId?: string, config?: GreenApiConfig): Promise<{success: boolean; message: string}> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not configured');
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/green-api-webhook`;

      const currentSettings = await this.getSettings(config);

      const needsUpdate =
        currentSettings.webhookUrl !== webhookUrl ||
        currentSettings.outgoingWebhook !== 'yes' ||
        currentSettings.incomingWebhook !== 'yes';

      if (!needsUpdate) {
        return {
          success: true,
          message: 'Настройки webhook уже корректно установлены'
        };
      }

      const success = await this.setSettings({
        webhookUrl: webhookUrl,
        outgoingWebhook: 'yes',
        incomingWebhook: 'yes',
        stateWebhook: 'yes',
        deviceWebhook: 'no'
      }, config);

      if (success) {
        return {
          success: true,
          message: 'Webhook успешно настроен для получения всех типов сообщений'
        };
      } else {
        return {
          success: false,
          message: 'Не удалось сохранить настройки webhook'
        };
      }
    } catch (error) {
      console.error('Error configuring webhook:', error);
      return {
        success: false,
        message: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};
