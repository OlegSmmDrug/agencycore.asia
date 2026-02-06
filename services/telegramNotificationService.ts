import { supabase } from '../lib/supabase';

export interface TelegramLink {
  id: string;
  userId: string;
  telegramChatId: number;
  telegramUsername: string;
  telegramFirstName: string;
  isActive: boolean;
  linkedAt: string;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  telegramEnabled: boolean;
  notifyNewTask: boolean;
  notifyTaskStatus: boolean;
  notifyTaskOverdue: boolean;
  notifyNewClient: boolean;
  notifyDeadline: boolean;
}

export const telegramNotificationService = {
  async getLinkedAccounts(userId: string): Promise<TelegramLink[]> {
    const { data, error } = await supabase
      .from('user_telegram_links')
      .select('*')
      .eq('user_id', userId)
      .order('linked_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      telegramChatId: row.telegram_chat_id,
      telegramUsername: row.telegram_username || '',
      telegramFirstName: row.telegram_first_name || '',
      isActive: row.is_active,
      linkedAt: row.linked_at,
    }));
  },

  async toggleLinkActive(linkId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('user_telegram_links')
      .update({ is_active: isActive })
      .eq('id', linkId);

    if (error) throw error;
  },

  async removeLink(linkId: string): Promise<void> {
    const { error } = await supabase
      .from('user_telegram_links')
      .delete()
      .eq('id', linkId);

    if (error) throw error;
  },

  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      telegramEnabled: data.telegram_enabled,
      notifyNewTask: data.notify_new_task,
      notifyTaskStatus: data.notify_task_status,
      notifyTaskOverdue: data.notify_task_overdue,
      notifyNewClient: data.notify_new_client,
      notifyDeadline: data.notify_deadline,
    };
  },

  async savePreferences(
    userId: string,
    organizationId: string,
    prefs: Partial<Omit<NotificationPreferences, 'id' | 'userId'>>
  ): Promise<void> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (prefs.telegramEnabled !== undefined) updateData.telegram_enabled = prefs.telegramEnabled;
    if (prefs.notifyNewTask !== undefined) updateData.notify_new_task = prefs.notifyNewTask;
    if (prefs.notifyTaskStatus !== undefined) updateData.notify_task_status = prefs.notifyTaskStatus;
    if (prefs.notifyTaskOverdue !== undefined) updateData.notify_task_overdue = prefs.notifyTaskOverdue;
    if (prefs.notifyNewClient !== undefined) updateData.notify_new_client = prefs.notifyNewClient;
    if (prefs.notifyDeadline !== undefined) updateData.notify_deadline = prefs.notifyDeadline;

    const { data: existing } = await supabase
      .from('user_notification_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_notification_preferences')
        .update(updateData)
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_notification_preferences')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          ...updateData,
        });
      if (error) throw error;
    }
  },

  async generateLinkCode(userId: string, organizationId: string): Promise<string> {
    await supabase
      .from('telegram_link_codes')
      .delete()
      .eq('user_id', userId);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 6; i++) {
      code += chars[arr[i] % chars.length];
    }

    const { error } = await supabase
      .from('telegram_link_codes')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        code,
      });

    if (error) throw error;
    return code;
  },

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type?: string
  ): Promise<{ sent: boolean; reason?: string }> {
    try {
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/telegram-bot/send-notification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, title, message, type }),
        }
      );
      return await resp.json();
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
      return { sent: false, reason: 'fetch_error' };
    }
  },
};
