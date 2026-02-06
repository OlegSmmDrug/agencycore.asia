import { supabase } from '../lib/supabase';
import { SystemNotification } from '../types';
import { telegramNotificationService } from './telegramNotificationService';

export const notificationService = {
  async getByUserId(userId: string): Promise<SystemNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      entityType: row.entity_type || undefined,
      entityId: row.entity_id || undefined,
      isRead: row.is_read,
      createdAt: row.created_at
    }));
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  },

  async create(notification: Omit<SystemNotification, 'id' | 'createdAt' | 'isRead'>): Promise<SystemNotification> {
    // Get the organization_id for the user receiving the notification
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', notification.userId)
      .single();

    if (userError || !userData?.organization_id) {
      console.error('Error fetching user organization:', userError);
      throw new Error('Cannot create notification: user organization not found');
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.userId,
        organization_id: userData.organization_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        entity_type: notification.entityType || null,
        entity_id: notification.entityId || null,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      throw error;
    }

    telegramNotificationService
      .sendNotification(notification.userId, notification.title, notification.message, notification.type)
      .catch(err => console.error('Telegram notification failed:', err));

    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entity_type || undefined,
      entityId: data.entity_id || undefined,
      isRead: data.is_read,
      createdAt: data.created_at
    };
  },

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  async delete(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  async createTaskAssignedNotification(
    assigneeId: string,
    taskId: string,
    taskTitle: string,
    assignerName: string
  ): Promise<void> {
    await this.create({
      userId: assigneeId,
      type: 'task_assigned',
      title: 'Новая задача',
      message: `${assignerName} назначил(а) вам задачу: "${taskTitle}"`,
      entityType: 'task',
      entityId: taskId
    });
  },

  async createTaskReassignedNotification(
    newAssigneeId: string,
    previousAssigneeId: string | undefined,
    taskId: string,
    taskTitle: string,
    reassignerName: string,
    reason?: string
  ): Promise<void> {
    await this.create({
      userId: newAssigneeId,
      type: 'task_reassigned',
      title: 'Задача переназначена',
      message: `${reassignerName} переназначил(а) вам задачу: "${taskTitle}"${reason ? `. Причина: ${reason}` : ''}`,
      entityType: 'task',
      entityId: taskId
    });

    if (previousAssigneeId) {
      await this.create({
        userId: previousAssigneeId,
        type: 'task_reassigned',
        title: 'Задача переназначена',
        message: `Задача "${taskTitle}" была переназначена другому исполнителю${reason ? `. Причина: ${reason}` : ''}`,
        entityType: 'task',
        entityId: taskId
      });
    }
  },

  async createDeadlineNotification(
    assigneeId: string,
    taskId: string,
    taskTitle: string,
    hoursLeft: number
  ): Promise<void> {
    const timeText = hoursLeft <= 1 ? 'менее часа' : `${hoursLeft} ч.`;
    await this.create({
      userId: assigneeId,
      type: 'deadline_approaching',
      title: 'Приближается дедлайн',
      message: `До дедлайна задачи "${taskTitle}" осталось ${timeText}`,
      entityType: 'task',
      entityId: taskId
    });
  },

  async createTaskOverdueNotification(
    assigneeId: string,
    taskId: string,
    taskTitle: string
  ): Promise<void> {
    await this.create({
      userId: assigneeId,
      type: 'task_overdue',
      title: 'Задача просрочена',
      message: `Дедлайн задачи "${taskTitle}" истек`,
      entityType: 'task',
      entityId: taskId
    });
  }
};
