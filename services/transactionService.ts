import { supabase } from '../lib/supabase';
import { Transaction, PaymentType, ReconciliationStatus, TransactionCategory } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

function mapRow(row: any): Transaction {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    userId: row.user_id || undefined,
    payrollRecordId: row.payroll_record_id || undefined,
    amount: Number(row.amount) || 0,
    date: row.date,
    type: row.type as PaymentType,
    category: row.category as TransactionCategory | undefined,
    description: row.description || '',
    isVerified: row.is_verified ?? true,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reconciliationStatus: row.reconciliation_status || 'manual',
    bankDocumentNumber: row.bank_document_number || '',
    bankAmount: Number(row.bank_amount) || 0,
    bankClientName: row.bank_client_name || '',
    bankBin: row.bank_bin || '',
    bankImportedAt: row.bank_imported_at,
    linkedTransactionId: row.linked_transaction_id,
    amountDiscrepancy: row.amount_discrepancy || false,
  };
}

export const transactionService = {
  async getAll(): Promise<Transaction[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      console.warn('No organization ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return (data || []).map(mapRow);
  },

  async create(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const organizationId = getCurrentOrganizationId();
    const insertData: any = {
      client_id: transaction.clientId || null,
      project_id: transaction.projectId || null,
      user_id: transaction.userId || null,
      payroll_record_id: transaction.payrollRecordId || null,
      organization_id: organizationId,
      amount: transaction.amount,
      date: transaction.date,
      type: transaction.type,
      category: transaction.category || (transaction.amount >= 0 ? 'Income' : 'Other'),
      description: transaction.description || '',
      is_verified: transaction.isVerified ?? true,
      created_by: transaction.createdBy,
      reconciliation_status: transaction.reconciliationStatus || 'manual',
      bank_document_number: transaction.bankDocumentNumber || '',
      bank_amount: transaction.bankAmount || 0,
      bank_client_name: transaction.bankClientName || '',
      bank_bin: transaction.bankBin || '',
      bank_imported_at: transaction.bankImportedAt || null,
      linked_transaction_id: transaction.linkedTransactionId || null,
      amount_discrepancy: transaction.amountDiscrepancy || false,
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }

    return mapRow(data);
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
    if (updates.reconciliationStatus !== undefined) updateData.reconciliation_status = updates.reconciliationStatus;
    if (updates.bankDocumentNumber !== undefined) updateData.bank_document_number = updates.bankDocumentNumber;
    if (updates.bankAmount !== undefined) updateData.bank_amount = updates.bankAmount;
    if (updates.bankClientName !== undefined) updateData.bank_client_name = updates.bankClientName;
    if (updates.bankBin !== undefined) updateData.bank_bin = updates.bankBin;
    if (updates.bankImportedAt !== undefined) updateData.bank_imported_at = updates.bankImportedAt;
    if (updates.linkedTransactionId !== undefined) updateData.linked_transaction_id = updates.linkedTransactionId;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.amountDiscrepancy !== undefined) updateData.amount_discrepancy = updates.amountDiscrepancy;
    if (updates.userId !== undefined) updateData.user_id = updates.userId;
    if (updates.payrollRecordId !== undefined) updateData.payroll_record_id = updates.payrollRecordId;

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

  async reconcileTransaction(
    existingId: string,
    bankAmount: number,
    bankClientName: string,
    bankBin: string,
    bankDocNumber: string
  ): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) throw new Error('Organization ID is required');

    const { data: existing } = await supabase
      .from('transactions')
      .select('amount')
      .eq('id', existingId)
      .maybeSingle();

    if (!existing) return;

    const amountDiffers = Math.abs(Number(existing.amount) - bankAmount) > 0.01;

    const updateData: any = {
      reconciliation_status: amountDiffers ? 'discrepancy' : 'verified',
      bank_amount: bankAmount,
      bank_client_name: bankClientName,
      bank_bin: bankBin,
      bank_document_number: bankDocNumber,
      bank_imported_at: new Date().toISOString(),
      amount_discrepancy: amountDiffers,
    };

    if (amountDiffers) {
      updateData.amount = bankAmount;
    }

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', existingId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error reconciling transaction:', error);
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
