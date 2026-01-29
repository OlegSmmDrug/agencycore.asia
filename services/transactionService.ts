import { supabase } from '../lib/supabase';
import { Transaction, PaymentType } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export const transactionService = {
  async getAll(): Promise<Transaction[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*, clients!inner(organization_id)')
      .eq('clients.organization_id', organizationId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      clientId: row.client_id,
      projectId: row.project_id,
      amount: Number(row.amount) || 0,
      date: row.date,
      type: row.type as PaymentType,
      description: row.description || '',
      isVerified: row.is_verified ?? true,
      createdBy: row.created_by,
      createdAt: row.created_at
    }));
  },

  async create(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        client_id: transaction.clientId,
        project_id: transaction.projectId,
        amount: transaction.amount,
        date: transaction.date,
        type: transaction.type,
        description: transaction.description || '',
        is_verified: transaction.isVerified ?? true,
        created_by: transaction.createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }

    return {
      id: data.id,
      clientId: data.client_id,
      projectId: data.project_id,
      amount: Number(data.amount) || 0,
      date: data.date,
      type: data.type as PaymentType,
      description: data.description || '',
      isVerified: data.is_verified ?? true,
      createdBy: data.created_by,
      createdAt: data.created_at
    };
  },

  async update(id: string, updates: Partial<Omit<Transaction, 'id'>>): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const updateData: any = {};

    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
    if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
    if (updates.isVerified !== undefined) updateData.is_verified = updates.isVerified;

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }
};
