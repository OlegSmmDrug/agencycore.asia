import { supabase } from '../lib/supabase';
import { Task, TaskStatus, TaskType, AssignmentHistoryEntry, InternalComment, RevisionHistoryEntry, GuestTaskView } from '../types';

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

const mapRowToTask = (row: any): Task => ({
  id: row.id,
  projectId: row.project_id || undefined,
  clientId: row.client_id || undefined,
  assigneeId: row.assignee_id || undefined,
  creatorId: row.creator_id || undefined,
  title: row.title,
  description: row.description || '',
  status: row.status as TaskStatus,
  priority: row.priority as 'Low' | 'Medium' | 'High',
  deadline: row.deadline || undefined,
  kpiValue: row.kpi_value ? Number(row.kpi_value) : undefined,
  type: (row.type || 'Task') as TaskType,
  startTime: row.start_time || undefined,
  startedAt: row.started_at || undefined,
  duration: row.duration || undefined,
  estimatedHours: row.estimated_hours ? Number(row.estimated_hours) : undefined,
  acceptanceStatus: row.acceptance_status as 'Pending' | 'Accepted' | 'Rejected' | undefined,
  assignmentHistory: row.assignment_history || [],
  address: row.address || undefined,
  addressLink: row.address_link || undefined,
  participants: row.participants || [],
  externalParticipants: row.external_participants || undefined,
  equipment: row.equipment || undefined,
  scenario: row.scenario || undefined,
  callLink: row.call_link || undefined,
  meetingWith: row.meeting_with || undefined,
  tags: row.tags || [],
  subtasks: row.subtasks || [],
  comments: row.comments || [],
  files: row.files || [],
  customFields: row.custom_fields || {},
  createdAt: row.created_at,
  completedAt: row.completed_at || undefined,
  mediaUrls: row.media_urls || [],
  mediaFiles: row.media_files || [],
  postText: row.post_text || '',
  proofLink: row.proof_link || '',
  clientComment: row.client_comment || undefined,
  internalComments: row.internal_comments || [],
  revisionHistory: row.revision_history || [],
  approvedBy: row.approved_by || undefined,
  approvedAt: row.approved_at || undefined,
  rejectedCount: row.rejected_count || 0,
  stage_level2_id: row.stage_level2_id || undefined
});

export const taskService = {
  async getAll(): Promise<Task[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    return (data || []).map(mapRowToTask);
  },

  async create(task: Omit<Task, 'id'>): Promise<Task> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        organization_id: organizationId,
        project_id: task.projectId || null,
        client_id: task.clientId || null,
        assignee_id: task.assigneeId || null,
        creator_id: task.creatorId || null,
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority || 'Medium',
        deadline: task.deadline || null,
        kpi_value: task.kpiValue || null,
        type: task.type || 'Task',
        start_time: task.startTime || null,
        started_at: task.startedAt || null,
        duration: task.duration || null,
        estimated_hours: task.estimatedHours || 1,
        duration_days: task.durationDays || null,
        acceptance_status: task.acceptanceStatus || null,
        assignment_history: task.assignmentHistory || [],
        address: task.address || null,
        address_link: task.addressLink || null,
        participants: task.participants || [],
        external_participants: task.externalParticipants || null,
        equipment: task.equipment || null,
        scenario: task.scenario || null,
        call_link: task.callLink || null,
        meeting_with: task.meetingWith || null,
        tags: task.tags || [],
        subtasks: task.subtasks || [],
        comments: task.comments || [],
        files: task.files || [],
        custom_fields: task.customFields || {},
        completed_at: task.completedAt || null,
        media_urls: task.mediaUrls || [],
        media_files: task.mediaFiles || [],
        post_text: task.postText || '',
        proof_link: task.proofLink || '',
        client_comment: task.clientComment || null,
        internal_comments: task.internalComments || [],
        revision_history: task.revisionHistory || [],
        approved_by: task.approvedBy || null,
        approved_at: task.approvedAt || null,
        rejected_count: task.rejectedCount || 0,
        stage_level2_id: task.stage_level2_id || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    return mapRowToTask(data);
  },

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const updateData: any = {};

    if (updates.projectId !== undefined) updateData.project_id = updates.projectId || null;
    if (updates.clientId !== undefined) updateData.client_id = updates.clientId || null;
    if (updates.assigneeId !== undefined) updateData.assignee_id = updates.assigneeId || null;
    if (updates.creatorId !== undefined) updateData.creator_id = updates.creatorId || null;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.deadline !== undefined) updateData.deadline = updates.deadline || null;
    if (updates.kpiValue !== undefined) updateData.kpi_value = updates.kpiValue;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime || null;
    if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt || null;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.estimatedHours !== undefined) updateData.estimated_hours = updates.estimatedHours;
    if (updates.acceptanceStatus !== undefined) updateData.acceptance_status = updates.acceptanceStatus;
    if (updates.assignmentHistory !== undefined) updateData.assignment_history = updates.assignmentHistory;
    if (updates.address !== undefined) updateData.address = updates.address || null;
    if (updates.addressLink !== undefined) updateData.address_link = updates.addressLink || null;
    if (updates.participants !== undefined) updateData.participants = updates.participants || [];
    if (updates.externalParticipants !== undefined) updateData.external_participants = updates.externalParticipants || null;
    if (updates.equipment !== undefined) updateData.equipment = updates.equipment || null;
    if (updates.scenario !== undefined) updateData.scenario = updates.scenario || null;
    if (updates.callLink !== undefined) updateData.call_link = updates.callLink || null;
    if (updates.meetingWith !== undefined) updateData.meeting_with = updates.meetingWith || null;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.subtasks !== undefined) updateData.subtasks = updates.subtasks;
    if (updates.comments !== undefined) updateData.comments = updates.comments;
    if (updates.files !== undefined) updateData.files = updates.files;
    if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt || null;
    if (updates.mediaUrls !== undefined) updateData.media_urls = updates.mediaUrls || [];
    if (updates.mediaFiles !== undefined) updateData.media_files = updates.mediaFiles || [];
    if (updates.postText !== undefined) updateData.post_text = updates.postText || '';
    if (updates.proofLink !== undefined) updateData.proof_link = updates.proofLink || '';
    if (updates.clientComment !== undefined) updateData.client_comment = updates.clientComment || null;
    if (updates.internalComments !== undefined) updateData.internal_comments = updates.internalComments || [];
    if (updates.revisionHistory !== undefined) updateData.revision_history = updates.revisionHistory || [];
    if (updates.approvedBy !== undefined) updateData.approved_by = updates.approvedBy || null;
    if (updates.approvedAt !== undefined) updateData.approved_at = updates.approvedAt || null;
    if (updates.rejectedCount !== undefined) updateData.rejected_count = updates.rejectedCount || 0;

    const organizationId = getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }

    return mapRowToTask(data);
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  async addClientComment(taskId: string, comment: string, changedBy: string, isGuest: boolean = true): Promise<Task> {
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    const revisionHistory = task.revision_history || [];
    const newRevision: RevisionHistoryEntry = {
      id: crypto.randomUUID(),
      status: TaskStatus.REJECTED,
      comment,
      changedBy,
      changedByType: isGuest ? 'guest' : 'user',
      timestamp: new Date().toISOString(),
    };

    return this.update(taskId, {
      clientComment: comment,
      revisionHistory: [...revisionHistory, newRevision],
    });
  },

  async addInternalComment(taskId: string, userId: string, text: string): Promise<Task> {
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    const internalComments = task.internal_comments || [];
    const newComment: InternalComment = {
      id: crypto.randomUUID(),
      userId,
      text,
      createdAt: new Date().toISOString(),
      isInternal: true,
    };

    return this.update(taskId, {
      internalComments: [...internalComments, newComment],
    });
  },

  async updateApprovalStatus(
    taskId: string,
    status: TaskStatus,
    changedBy: string,
    isGuest: boolean = false,
    comment?: string
  ): Promise<Task> {
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    const revisionHistory = task.revision_history || [];
    const newRevision: RevisionHistoryEntry = {
      id: crypto.randomUUID(),
      status,
      comment: comment || undefined,
      changedBy,
      changedByType: isGuest ? 'guest' : 'user',
      timestamp: new Date().toISOString(),
    };

    const updates: Partial<Task> = {
      status,
      revisionHistory: [...revisionHistory, newRevision],
    };

    if (status === TaskStatus.APPROVED) {
      updates.approvedBy = changedBy;
      updates.approvedAt = new Date().toISOString();
      updates.clientComment = comment || undefined;
    } else if (status === TaskStatus.REJECTED) {
      updates.rejectedCount = (task.rejected_count || 0) + 1;
      updates.clientComment = comment || '';
    }

    return this.update(taskId, updates);
  },

  async getTaskForGuest(taskId: string): Promise<GuestTaskView | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, status, deadline, type, media_urls, post_text, proof_link, client_comment, revision_history, rejected_count')
      .eq('id', taskId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status as TaskStatus,
      deadline: data.deadline,
      type: data.type as TaskType,
      mediaUrls: data.media_urls || [],
      postText: data.post_text || '',
      proofLink: data.proof_link || '',
      clientComment: data.client_comment,
      revisionHistory: data.revision_history || [],
      rejectedCount: data.rejected_count || 0,
    };
  },

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching project tasks:', error);
      return [];
    }

    return (data || []).map(mapRowToTask);
  },

  async getTasksByProjectForGuest(projectId: string): Promise<GuestTaskView[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, description, status, deadline, type, media_urls, media_files, post_text, proof_link,
        client_comment, revision_history, rejected_count, creator_id, created_at,
        approved_by, approved_at,
        creator:users!tasks_creator_id_fkey(name),
        approver:users!tasks_approved_by_fkey(name)
      `)
      .eq('project_id', projectId)
      .in('type', ['Post', 'Reels', 'Stories'])
      .in('status', ['Review', 'Pending Client', 'Approved', 'Rejected', 'Ready', 'Done'])
      .order('deadline', { ascending: true });

    console.log('Guest tasks query:', { projectId, error, dataLength: data?.length });

    if (error) {
      console.error('Error fetching guest tasks:', error);
      return [];
    }

    if (!data) return [];

    return data.map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status as TaskStatus,
      deadline: task.deadline,
      type: task.type as TaskType,
      mediaUrls: task.media_urls || [],
      mediaFiles: task.media_files || [],
      postText: task.post_text || '',
      proofLink: task.proof_link || '',
      clientComment: task.client_comment,
      revisionHistory: task.revision_history || [],
      rejectedCount: task.rejected_count || 0,
      creatorId: task.creator_id,
      createdAt: task.created_at,
      approvedBy: task.approved_by,
      approvedAt: task.approved_at,
      creatorName: task.creator?.name,
      approvedByName: task.approver?.name,
    }));
  },

  async getRevisionHistory(taskId: string): Promise<RevisionHistoryEntry[]> {
    const { data } = await supabase
      .from('tasks')
      .select('revision_history')
      .eq('id', taskId)
      .maybeSingle();

    return data?.revision_history || [];
  },

  async incrementRejectionCount(taskId: string): Promise<void> {
    const { data: task } = await supabase
      .from('tasks')
      .select('rejected_count')
      .eq('id', taskId)
      .single();

    if (task) {
      await this.update(taskId, {
        rejectedCount: (task.rejected_count || 0) + 1,
      });
    }
  },

  async sendToClient(taskId: string, userId: string): Promise<Task> {
    return this.updateApprovalStatus(
      taskId,
      TaskStatus.PENDING_CLIENT,
      userId,
      false,
      'Sent to client for approval'
    );
  }
};
