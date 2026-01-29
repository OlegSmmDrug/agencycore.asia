import { supabase } from '../lib/supabase';
import { WhatsAppMessage, WazzupChannel, WhatsAppTemplate } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

const WAZZUP_API_URL = 'https://api.wazzup24.com/v3';
const API_KEY = import.meta.env.VITE_WAZZUP_API_KEY;

interface WazzupSendMessageParams {
  channelId: string;
  chatId: string;
  chatType?: string;
  text: string;
}

interface WazzupMessageResponse {
  messageId: string;
  status: string;
}

interface WazzupChannelResponse {
  channelId: string;
  transport: string;
  state: string;
  phone?: string;
  name?: string;
}

const formatPhoneForWhatsApp = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('7') && cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }
  return cleaned;
};

export const wazzupService = {
  async getChannels(): Promise<WazzupChannel[]> {
    try {
      const response = await fetch(`${WAZZUP_API_URL}/channels`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch channels: ${response.status}`);
      }

      const data = await response.json();
      const channels: WazzupChannel[] = (data || []).map((ch: WazzupChannelResponse) => ({
        id: ch.channelId,
        channelId: ch.channelId,
        channelName: ch.name || 'WhatsApp',
        phoneNumber: ch.phone || '',
        status: ch.state === 'active' ? 'active' : ch.state === 'connecting' ? 'pending' : 'disconnected',
        transport: ch.transport,
        lastSync: new Date().toISOString()
      }));

      for (const channel of channels) {
        await supabase
          .from('wazzup_channels')
          .upsert({
            channel_id: channel.channelId,
            channel_name: channel.channelName,
            phone_number: channel.phoneNumber,
            status: channel.status,
            transport: channel.transport,
            last_sync: channel.lastSync
          }, { onConflict: 'channel_id' });
      }

      return channels;
    } catch (error) {
      console.error('Error fetching Wazzup channels:', error);
      const { data } = await supabase
        .from('wazzup_channels')
        .select('*');

      return (data || []).map(ch => ({
        id: ch.id,
        channelId: ch.channel_id,
        channelName: ch.channel_name,
        phoneNumber: ch.phone_number,
        status: ch.status,
        transport: ch.transport,
        lastSync: ch.last_sync
      }));
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
    try {
      let activeChannelId = channelId;

      if (!activeChannelId) {
        const channels = await this.getChannels();
        const activeChannel = channels.find(ch => ch.status === 'active');
        if (!activeChannel) {
          throw new Error('No active WhatsApp channel found');
        }
        activeChannelId = activeChannel.channelId;
      }

      const chatId = formatPhoneForWhatsApp(phone);

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

      let contentType = 'document';
      if (file.type.startsWith('image/')) contentType = 'image';
      else if (file.type.startsWith('video/')) contentType = 'video';
      else if (file.type.startsWith('audio/')) contentType = 'audio';

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
          channel_id: activeChannelId,
          chat_id: chatId,
          chat_type: 'whatsapp',
          media_type: contentType,
          media_filename: file.name,
          is_read: true,
          organization_id: organizationId
        })
        .select()
        .single();

      const response = await fetch(`${WAZZUP_API_URL}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelId: activeChannelId,
          chatId: chatId,
          chatType: 'whatsapp',
          text: text || undefined,
          contentType: contentType,
          content: base64Content,
          filename: file.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Wazzup API error:', errorData);

        if (existingMessage) {
          await supabase
            .from('whatsapp_messages')
            .update({ status: 'failed' })
            .eq('id', existingMessage.id);
        }
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const result = await response.json();

      if (existingMessage) {
        await supabase
          .from('whatsapp_messages')
          .update({
            message_id: result.messageId,
            status: 'sent'
          })
          .eq('id', existingMessage.id);
      }

      return existingMessage ? {
        id: existingMessage.id,
        clientId: existingMessage.client_id,
        messageId: result.messageId,
        direction: 'outgoing',
        content: text || `[${file.name}]`,
        userId: userId,
        status: 'sent',
        timestamp: existingMessage.timestamp,
        channelId: activeChannelId,
        chatId: chatId,
        mediaType: contentType as any,
        isRead: true
      } : null;
    } catch (error) {
      console.error('Error sending WhatsApp message with file:', error);
      throw error;
    }
  },

  async sendMessage(
    clientId: string,
    phone: string,
    text: string,
    userId?: string,
    channelId?: string
  ): Promise<WhatsAppMessage | null> {
    try {
      let activeChannelId = channelId;

      if (!activeChannelId) {
        const channels = await this.getChannels();
        const activeChannel = channels.find(ch => ch.status === 'active');
        if (!activeChannel) {
          throw new Error('No active WhatsApp channel found');
        }
        activeChannelId = activeChannel.channelId;
      }

      const chatId = formatPhoneForWhatsApp(phone);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: existingMessage } = await supabase
        .from('whatsapp_messages')
        .insert({
          client_id: clientId,
          direction: 'outgoing',
          content: text,
          user_id: userId,
          status: 'sending',
          timestamp: new Date().toISOString(),
          channel_id: activeChannelId,
          chat_id: chatId,
          chat_type: 'whatsapp',
          is_read: true,
          organization_id: organizationId
        })
        .select()
        .single();

      const response = await fetch(`${WAZZUP_API_URL}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelId: activeChannelId,
          chatId: chatId,
          chatType: 'whatsapp',
          text: text
        } as WazzupSendMessageParams)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Wazzup API error:', errorData);

        if (existingMessage) {
          await supabase
            .from('whatsapp_messages')
            .update({ status: 'failed' })
            .eq('id', existingMessage.id);
        }
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const result: WazzupMessageResponse = await response.json();

      if (existingMessage) {
        await supabase
          .from('whatsapp_messages')
          .update({
            message_id: result.messageId,
            status: 'sent'
          })
          .eq('id', existingMessage.id);
      }

      return existingMessage ? {
        id: existingMessage.id,
        clientId: existingMessage.client_id,
        messageId: result.messageId,
        direction: 'outgoing',
        content: text,
        userId: userId,
        status: 'sent',
        timestamp: existingMessage.timestamp,
        channelId: activeChannelId,
        chatId: chatId,
        isRead: true
      } : null;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  },

  async getMessages(clientId: string): Promise<WhatsAppMessage[]> {
    console.log('[wazzupService] Fetching messages for client:', clientId);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('client_id', clientId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('[wazzupService] Error fetching messages:', error);
      return [];
    }

    console.log('[wazzupService] Raw data from DB:', data);
    const messages = (data || []).map(msg => ({
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
    console.log('[wazzupService] Mapped messages:', messages);
    return messages;
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

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      content: t.content,
      category: t.category,
      createdBy: t.created_by
    }));
  },

  async saveTemplate(template: Omit<WhatsAppTemplate, 'id'>): Promise<WhatsAppTemplate | null> {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert({
        name: template.name,
        content: template.content,
        category: template.category,
        created_by: template.createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving template:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      content: data.content,
      category: data.category,
      createdBy: data.created_by
    };
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

  parseTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }
};
