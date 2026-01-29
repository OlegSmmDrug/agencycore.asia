import { supabase } from '../lib/supabase';

export interface PaymentTypeOption {
  id: string;
  organizationId?: string;
  name: string;
  legalText: string;
  orderIndex: number;
  isGlobal: boolean;
  createdAt: string;
}

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

const mapRowToPaymentType = (row: any): PaymentTypeOption => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  legalText: row.legal_text,
  orderIndex: row.order_index,
  isGlobal: row.is_global,
  createdAt: row.created_at
});

export const paymentTypeService = {
  async getAll(): Promise<PaymentTypeOption[]> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('payment_type_options')
      .select('*')
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapRowToPaymentType);
  },

  async getById(id: string): Promise<PaymentTypeOption | null> {
    const { data, error } = await supabase
      .from('payment_type_options')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToPaymentType(data) : null;
  },

  async create(paymentType: Omit<PaymentTypeOption, 'id' | 'createdAt'>): Promise<PaymentTypeOption> {
    const organizationId = getCurrentOrganizationId();

    const { data, error } = await supabase
      .from('payment_type_options')
      .insert({
        organization_id: paymentType.isGlobal ? null : organizationId,
        name: paymentType.name,
        legal_text: paymentType.legalText,
        order_index: paymentType.orderIndex,
        is_global: paymentType.isGlobal
      })
      .select()
      .single();

    if (error) throw error;
    return mapRowToPaymentType(data);
  },

  async update(id: string, updates: Partial<PaymentTypeOption>): Promise<PaymentTypeOption> {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.legalText !== undefined) updateData.legal_text = updates.legalText;
    if (updates.orderIndex !== undefined) updateData.order_index = updates.orderIndex;

    const { data, error } = await supabase
      .from('payment_type_options')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapRowToPaymentType(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_type_options')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
