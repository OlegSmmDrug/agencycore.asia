import { supabase } from '../lib/supabase';

export interface ActivityLog {
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  actionType: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  createdAt: string;
}

const mapRowToActivityLog = (row: any): ActivityLog => ({
  id: row.id,
  userId: row.user_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  actionType: row.action_type,
  description: row.description,
  oldValue: row.old_value,
  newValue: row.new_value,
  createdAt: row.created_at
});

export const activityLogService = {
  async create(log: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        user_id: log.userId,
        entity_type: log.entityType,
        entity_id: log.entityId,
        action_type: log.actionType,
        description: log.description,
        old_value: log.oldValue,
        new_value: log.newValue
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }

    return mapRowToActivityLog(data);
  },

  async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }

    return (data || []).map(mapRowToActivityLog);
  },

  async getRecent(limit: number = 50): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent activity logs:', error);
      throw error;
    }

    return (data || []).map(mapRowToActivityLog);
  }
};
