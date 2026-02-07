import { supabase } from '../lib/supabase';
import { Client, Transaction, ReconciliationStatus, BankCounterpartyAlias, User } from '../types';
import { getCurrentOrganizationId } from '../utils/organizationContext';

export function sanitizeCounterpartyName(raw: string): string {
  let result = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\n\/]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  result = result
    .replace(/Товарище\s+ство/gi, 'Товарищество')
    .replace(/Обще\s+ство/gi, 'Общество')
    .replace(/Предприя\s+тие/gi, 'Предприятие')
    .replace(/Учрежде\s+ние/gi, 'Учреждение')
    .replace(/Акционер\s+ное/gi, 'Акционерное')
    .replace(/ответствен\s+ностью/gi, 'ответственностью')
    .replace(/ограничен\s+ной/gi, 'ограниченной');

  return result;
}

export function extractBin(text: string): string {
  const match = text.match(/\b(\d{12})\b/);
  return match ? match[1] : '';
}

const LEGAL_PREFIXES = ['ТОО', 'ИП', 'АО', 'ЖШС', 'ОАО', 'ЗАО', 'ПАО', 'НАО', 'КТ', 'КХ', 'ПК', 'РГП', 'ГКП', 'КГП', 'ГУ', 'РГУ'];

export function bankNameToTitleCase(raw: string): string {
  if (!raw || !raw.trim()) return raw;
  const sanitized = sanitizeCounterpartyName(raw);
  const isLegalEntity = LEGAL_PREFIXES.some(p =>
    sanitized.toUpperCase().startsWith(p + ' ') || sanitized.toUpperCase().startsWith(p + ' «') || sanitized.toUpperCase().startsWith('"' + p + ' ')
  );
  if (isLegalEntity) {
    const spaceIdx = sanitized.indexOf(' ');
    if (spaceIdx === -1) return sanitized;
    const prefix = sanitized.substring(0, spaceIdx).toUpperCase();
    const rest = sanitized.substring(spaceIdx + 1);
    const restFormatted = rest.split(/\s+/).map(word => {
      if (/^["«]/.test(word)) return word;
      if (/^[A-Z]+$/i.test(word) && word.length <= 5) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
    return prefix + ' ' + restFormatted;
  }
  return sanitized.split(/\s+/).map(word => {
    if (/^[A-Z]+$/i.test(word) && word.length <= 5) return word.toUpperCase();
    if (/^\d/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function normalizeForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»""„‟\u201c\u201d\u201e\u201f]/g, '')
    .replace(/[ёЁ]/g, 'е')
    .replace(/тоо\s*/gi, '')
    .replace(/ип\s*/gi, '')
    .replace(/ао\s*/gi, '')
    .replace(/[^a-zа-яёa-z0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ReconciliationMatch {
  type: 'verified' | 'discrepancy' | 'new';
  existingTransaction?: Transaction;
  amountDiffers: boolean;
}

export const reconciliationService = {
  async getAliases(): Promise<BankCounterpartyAlias[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('bank_counterparty_aliases')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error fetching aliases:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      bankName: row.bank_name,
      bankBin: row.bank_bin,
      clientId: row.client_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async saveAlias(bankName: string, bankBin: string, clientId: string): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const { error } = await supabase
      .from('bank_counterparty_aliases')
      .upsert({
        organization_id: organizationId,
        bank_name: sanitizeCounterpartyName(bankName),
        bank_bin: bankBin,
        client_id: clientId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: bankBin ? 'organization_id,bank_bin' : undefined,
      });

    if (error) {
      console.error('Error saving alias:', error);
    }
  },

  findClientByBin(bin: string, clients: Client[]): Client | null {
    if (!bin) return null;
    return clients.find(c =>
      c.bin === bin || c.inn === bin
    ) || null;
  },

  findClientByAlias(bankName: string, bankBin: string, aliases: BankCounterpartyAlias[]): string | null {
    const sanitized = sanitizeCounterpartyName(bankName);

    if (bankBin) {
      const byBin = aliases.find(a => a.bankBin === bankBin);
      if (byBin) return byBin.clientId;
    }

    if (sanitized) {
      const byName = aliases.find(a =>
        normalizeForComparison(a.bankName) === normalizeForComparison(sanitized)
      );
      if (byName) return byName.clientId;
    }

    return null;
  },

  findClientByName(clientName: string, clients: Client[]): Client | null {
    if (!clientName) return null;
    const normalized = normalizeForComparison(clientName);

    const exact = clients.find(c => {
      const targets = [c.company, c.name, c.legalName].filter(Boolean);
      return targets.some(t => normalizeForComparison(t!) === normalized);
    });
    if (exact) return exact;

    const normalizedWords = normalized.split(/\s+/);
    const partial = clients.find(c => {
      const targets = [c.company, c.name, c.legalName].filter(Boolean).map(t => normalizeForComparison(t!));
      return targets.some(t => {
        const shorter = t.length <= normalized.length ? t : normalized;
        const longer = t.length <= normalized.length ? normalized : t;
        if (shorter.length < 5) return false;
        const ratio = shorter.length / longer.length;
        if (ratio < 0.4) return false;
        const tWords = t.split(/\s+/);
        const hasFullWordMatch = tWords.some(tw => tw.length >= 3 && normalizedWords.includes(tw)) ||
          normalizedWords.some(nw => nw.length >= 3 && tWords.includes(nw));
        if (hasFullWordMatch) return true;
        if (ratio >= 0.6 && longer.includes(shorter)) return true;
        return false;
      });
    });
    return partial || null;
  },

  findUserByIin(iin: string, users: User[]): User | null {
    if (!iin) return null;
    const cleaned = iin.replace(/\D/g, '');
    if (cleaned.length < 10) return null;
    return users.find(u => {
      if (!u.iin) return false;
      return u.iin.replace(/\D/g, '') === cleaned;
    }) || null;
  },

  findUserByName(bankName: string, users: User[]): User | null {
    if (!bankName) return null;
    const normalized = normalizeForComparison(bankName);
    const normalizedWords = normalized.split(/\s+/);
    return users.find(u => {
      const targets = [u.name].filter(Boolean).map(t => normalizeForComparison(t));
      return targets.some(t => {
        if (t === normalized) return true;
        const tWords = t.split(/\s+/);
        const shorter = t.length <= normalized.length ? t : normalized;
        const longer = t.length <= normalized.length ? normalized : t;
        if (shorter.length < 5) return false;
        const ratio = shorter.length / longer.length;
        if (ratio < 0.4) return false;
        const hasFullWordMatch = tWords.some(tw => tw.length >= 3 && normalizedWords.includes(tw)) ||
          normalizedWords.some(nw => nw.length >= 3 && tWords.includes(nw));
        if (hasFullWordMatch) return true;
        if (ratio >= 0.6 && longer.includes(shorter)) return true;
        return false;
      });
    }) || null;
  },

  matchClientSmart(
    bankName: string,
    bankBin: string,
    clients: Client[],
    aliases: BankCounterpartyAlias[],
    users?: User[]
  ): { clientId: string | null; userId: string | null; matchSource: 'bin' | 'alias' | 'name' | 'employee_iin' | 'employee_name' | 'none'; isEmployee: boolean } {
    const sanitizedName = sanitizeCounterpartyName(bankName);
    const extractedBin = bankBin || extractBin(bankName);

    if (extractedBin) {
      const byBin = this.findClientByBin(extractedBin, clients);
      if (byBin) return { clientId: byBin.id, userId: null, matchSource: 'bin', isEmployee: false };
    }

    if (extractedBin && users && users.length > 0) {
      const employee = this.findUserByIin(extractedBin, users);
      if (employee) return { clientId: null, userId: employee.id, matchSource: 'employee_iin', isEmployee: true };
    }

    const aliasMatch = this.findClientByAlias(sanitizedName, extractedBin, aliases);
    if (aliasMatch) return { clientId: aliasMatch, userId: null, matchSource: 'alias', isEmployee: false };

    const byName = this.findClientByName(sanitizedName, clients);
    if (byName) return { clientId: byName.id, userId: null, matchSource: 'name', isEmployee: false };

    if (users && users.length > 0) {
      const employeeByName = this.findUserByName(sanitizedName, users);
      if (employeeByName) return { clientId: null, userId: employeeByName.id, matchSource: 'employee_name', isEmployee: true };
    }

    return { clientId: null, userId: null, matchSource: 'none', isEmployee: false };
  },

  findMatchingTransaction(
    date: string,
    amount: number,
    clientId: string | null,
    docNumber: string,
    existingTransactions: Transaction[]
  ): ReconciliationMatch {
    if (docNumber) {
      const byDoc = existingTransactions.find(t =>
        t.bankDocumentNumber === docNumber ||
        t.description?.includes(`[DOC:${docNumber}]`)
      );
      if (byDoc) {
        const amountDiffers = Math.abs(byDoc.amount - amount) > 0.01;
        return {
          type: amountDiffers ? 'discrepancy' : 'verified',
          existingTransaction: byDoc,
          amountDiffers,
        };
      }
    }

    if (clientId) {
      const txDate = new Date(date);
      const candidates = existingTransactions.filter(t => {
        if (t.clientId !== clientId) return false;
        if (t.reconciliationStatus === 'verified' || t.reconciliationStatus === 'bank_import') return false;
        const tDate = new Date(t.date);
        const daysDiff = Math.abs(txDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 3;
      });

      const exactAmount = candidates.find(t => Math.abs(t.amount - amount) < 0.01);
      if (exactAmount) {
        return { type: 'verified', existingTransaction: exactAmount, amountDiffers: false };
      }

      const closeAmount = candidates.find(t => {
        const diff = Math.abs(t.amount - amount);
        const percent = (diff / Math.max(t.amount, amount)) * 100;
        return percent < 5;
      });
      if (closeAmount) {
        return {
          type: 'discrepancy',
          existingTransaction: closeAmount,
          amountDiffers: true,
        };
      }
    }

    return { type: 'new', amountDiffers: false };
  },

  async updateClientBin(clientId: string, bin: string): Promise<void> {
    if (!bin || !clientId) return;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const { data } = await supabase
      .from('clients')
      .select('inn')
      .eq('id', clientId)
      .maybeSingle();

    if (data && !data.inn) {
      await supabase
        .from('clients')
        .update({ inn: bin })
        .eq('id', clientId)
        .eq('organization_id', organizationId);
    }
  },
};
