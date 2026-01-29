import { supabase } from '../lib/supabase';

export interface ExecutorCompany {
  id: string;
  organizationId: string;
  shortName: string;
  legalName: string;
  bin: string;
  phone?: string;
  email?: string;
  website?: string;
  regAddress?: string;
  legalAddress?: string;
  directorName: string;
  directorPosition: string;
  authorityBasis?: string;
  bankName?: string;
  iban?: string;
  bik?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

const mapRowToExecutorCompany = (row: any): ExecutorCompany => ({
  id: row.id,
  organizationId: row.organization_id,
  shortName: row.short_name,
  legalName: row.legal_name,
  bin: row.bin,
  phone: row.phone,
  email: row.email,
  website: row.website,
  regAddress: row.reg_address,
  legalAddress: row.legal_address,
  directorName: row.director_name,
  directorPosition: row.director_position,
  authorityBasis: row.authority_basis,
  bankName: row.bank_name,
  iban: row.iban,
  bik: row.bik,
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const executorCompanyService = {
  async getAll(): Promise<ExecutorCompany[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('executor_companies')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToExecutorCompany);
  },

  async getDefault(): Promise<ExecutorCompany | null> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return null;

    const { data, error } = await supabase
      .from('executor_companies')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToExecutorCompany(data) : null;
  },

  async getById(id: string): Promise<ExecutorCompany | null> {
    const { data, error } = await supabase
      .from('executor_companies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToExecutorCompany(data) : null;
  },

  async create(company: Omit<ExecutorCompany, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExecutorCompany> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) throw new Error('No organization ID');

    const { data, error } = await supabase
      .from('executor_companies')
      .insert({
        organization_id: organizationId,
        short_name: company.shortName,
        legal_name: company.legalName,
        bin: company.bin,
        phone: company.phone,
        email: company.email,
        website: company.website,
        reg_address: company.regAddress,
        legal_address: company.legalAddress,
        director_name: company.directorName,
        director_position: company.directorPosition,
        authority_basis: company.authorityBasis,
        bank_name: company.bankName,
        iban: company.iban,
        bik: company.bik,
        is_default: company.isDefault
      })
      .select()
      .single();

    if (error) throw error;
    return mapRowToExecutorCompany(data);
  },

  async update(id: string, updates: Partial<ExecutorCompany>): Promise<ExecutorCompany> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.shortName !== undefined) updateData.short_name = updates.shortName;
    if (updates.legalName !== undefined) updateData.legal_name = updates.legalName;
    if (updates.bin !== undefined) updateData.bin = updates.bin;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.website !== undefined) updateData.website = updates.website;
    if (updates.regAddress !== undefined) updateData.reg_address = updates.regAddress;
    if (updates.legalAddress !== undefined) updateData.legal_address = updates.legalAddress;
    if (updates.directorName !== undefined) updateData.director_name = updates.directorName;
    if (updates.directorPosition !== undefined) updateData.director_position = updates.directorPosition;
    if (updates.authorityBasis !== undefined) updateData.authority_basis = updates.authorityBasis;
    if (updates.bankName !== undefined) updateData.bank_name = updates.bankName;
    if (updates.iban !== undefined) updateData.iban = updates.iban;
    if (updates.bik !== undefined) updateData.bik = updates.bik;
    if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;

    const { data, error } = await supabase
      .from('executor_companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapRowToExecutorCompany(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('executor_companies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
