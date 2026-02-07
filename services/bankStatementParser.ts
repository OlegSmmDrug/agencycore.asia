import { Client, PaymentType } from '../types';

export interface ParsedTransaction {
  date: string;
  amount: number;
  amountOriginal: number;
  currency: string;
  exchangeRate: number | null;
  clientName: string;
  clientBin: string;
  description: string;
  documentNumber: string;
  knpCode: string;
  paymentType: PaymentType;
  matchedClientId: string | null;
  matchStatus: 'matched' | 'unmatched' | 'duplicate';
}

export interface ImportResult {
  transactions: ParsedTransaction[];
  format: '1c' | 'csv' | 'unknown';
  fileName: string;
}

function detectFormat(content: string, fileName: string): '1c' | 'csv' | 'unknown' {
  if (content.includes('1CClientBankExchange') || content.includes('СекцияДокумент')) {
    return '1c';
  }
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
    return 'csv';
  }
  if (content.includes(';') && content.includes('\n')) {
    const lines = content.trim().split('\n');
    if (lines.length > 1 && lines[0].split(';').length > 3) {
      return 'csv';
    }
  }
  return 'unknown';
}

function parseDate(dateStr: string): string {
  const cleaned = dateStr.trim();
  const ddmmyyyy = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }
  const yyyymmdd = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    return cleaned;
  }
  return new Date().toISOString().split('T')[0];
}

function parseExchangeRate(description: string): number | null {
  const match = description.match(/[Кк]урс\s+сделки\s+(\d+[\.,]\d+)/i);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  const match2 = description.match(/[Кк]урс\s+(\d+[\.,]\d+)/i);
  if (match2) {
    return parseFloat(match2[1].replace(',', '.'));
  }
  return null;
}

function detectPaymentType(description: string): PaymentType {
  const lower = description.toLowerCase();
  if (lower.includes('предоплат') || lower.includes('аванс')) {
    return PaymentType.PREPAYMENT;
  }
  if (lower.includes('возврат') || lower.includes('refund')) {
    return PaymentType.REFUND;
  }
  if (lower.includes('абон') || lower.includes('ретейнер') || lower.includes('ежемес')) {
    return PaymentType.RETAINER;
  }
  if (lower.includes('полн') && lower.includes('оплат')) {
    return PaymentType.FULL;
  }
  return PaymentType.PREPAYMENT;
}

function matchClient(
  clientName: string,
  clientBin: string,
  clients: Client[]
): string | null {
  if (clientBin) {
    const byBin = clients.find(c =>
      c.bin === clientBin || c.inn === clientBin
    );
    if (byBin) return byBin.id;
  }

  if (clientName) {
    const normalized = clientName.toLowerCase().trim();
    const exact = clients.find(c =>
      c.company?.toLowerCase().trim() === normalized ||
      c.name?.toLowerCase().trim() === normalized ||
      c.legalName?.toLowerCase().trim() === normalized
    );
    if (exact) return exact.id;

    const partial = clients.find(c => {
      const company = c.company?.toLowerCase().trim() || '';
      const name = c.name?.toLowerCase().trim() || '';
      const legal = c.legalName?.toLowerCase().trim() || '';
      return (
        (company && normalized.includes(company)) ||
        (company && company.includes(normalized)) ||
        (name && normalized.includes(name)) ||
        (legal && normalized.includes(legal))
      );
    });
    if (partial) return partial.id;
  }

  return null;
}

function parse1CFormat(content: string): Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus'>[] {
  const results: Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus'>[] = [];

  const sections = content.split(/СекцияДокумент/g).slice(1);

  for (const section of sections) {
    if (section.includes('КонецДокумента') === false) continue;

    const getField = (name: string): string => {
      const patterns = [
        new RegExp(`^${name}=(.*)$`, 'mi'),
        new RegExp(`${name}=(.*)`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = section.match(pattern);
        if (match) return match[1].trim();
      }
      return '';
    };

    const dateStr = getField('ДатаДокумента') || getField('ДатаОперации');
    const amountStr = getField('Сумма');
    const docNumber = getField('НомерДокумента');
    const payerName = getField('ПлательщикНаименование') || getField('Плательщик');
    const payerBin = getField('Плательщик_ИНН') || getField('Плательщик_БИН') || getField('ПлательщикИНН');
    const description = getField('НазначениеПлатежа');
    const knpCode = getField('КодНазначенияПлатежа') || '';
    const currency = getField('Валюта') || 'KZT';

    if (!dateStr || !amountStr) continue;

    const amountOriginal = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.')) || 0;
    if (amountOriginal <= 0) continue;

    const exchangeRate = currency.toUpperCase() === 'USD' ? parseExchangeRate(description) : null;
    const amountKZT = exchangeRate ? amountOriginal * exchangeRate : amountOriginal;

    results.push({
      date: parseDate(dateStr),
      amount: Math.round(amountKZT * 100) / 100,
      amountOriginal,
      currency: currency.toUpperCase(),
      exchangeRate,
      clientName: payerName,
      clientBin: payerBin,
      description,
      documentNumber: docNumber,
      knpCode,
      paymentType: detectPaymentType(description),
    });
  }

  return results;
}

function parseCSVFormat(content: string): Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus'>[] {
  const results: Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus'>[] = [];

  const lines = content.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return results;

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.replace(/"/g, '').trim().toLowerCase());

  const findCol = (...candidates: string[]): number => {
    for (const candidate of candidates) {
      const idx = headers.findIndex(h =>
        h.includes(candidate.toLowerCase())
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = findCol('дата', 'date');
  const nameCol = findCol('наименование', 'фио', 'контрагент', 'плательщик', 'name');
  const creditCol = findCol('зачислен', 'приход', 'credit', 'кредит');
  const debitCol = findCol('списан', 'расход', 'debit', 'дебет');
  const amountCol = findCol('сумма', 'amount');
  const descCol = findCol('назначение', 'описание', 'description', 'purpose');
  const knpCol = findCol('кнп', 'knp', 'код');
  const binCol = findCol('бин', 'иин', 'bin', 'iin', 'инн', 'inn');

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.replace(/"/g, '').trim());
    if (cells.length < 3) continue;

    const dateStr = dateCol >= 0 ? cells[dateCol] : '';
    if (!dateStr) continue;

    let amount = 0;
    if (creditCol >= 0 && cells[creditCol]) {
      amount = parseFloat(cells[creditCol].replace(/\s/g, '').replace(',', '.')) || 0;
    } else if (amountCol >= 0 && cells[amountCol]) {
      amount = parseFloat(cells[amountCol].replace(/\s/g, '').replace(',', '.')) || 0;
    }

    if (amount <= 0 && debitCol >= 0 && cells[debitCol]) {
      continue;
    }
    if (amount <= 0) continue;

    const clientName = nameCol >= 0 ? cells[nameCol] : '';
    const description = descCol >= 0 ? cells[descCol] : '';
    const knpCode = knpCol >= 0 ? cells[knpCol] : '';
    const clientBin = binCol >= 0 ? cells[binCol] : '';

    results.push({
      date: parseDate(dateStr),
      amount,
      amountOriginal: amount,
      currency: 'KZT',
      exchangeRate: null,
      clientName,
      clientBin,
      description,
      documentNumber: '',
      knpCode,
      paymentType: detectPaymentType(description),
    });
  }

  return results;
}

export function readFileAsText(file: File, encoding: string = 'windows-1251'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, encoding);
  });
}

export async function parseStatementFile(
  file: File,
  clients: Client[],
  existingDocNumbers: string[]
): Promise<ImportResult> {
  let content = await readFileAsText(file, 'windows-1251');

  if (content.includes('�') || (!content.includes('СекцияДокумент') && !content.includes('Дата'))) {
    content = await readFileAsText(file, 'utf-8');
  }

  const format = detectFormat(content, file.name);

  let rawTransactions: Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus'>[] = [];

  if (format === '1c') {
    rawTransactions = parse1CFormat(content);
  } else if (format === 'csv') {
    rawTransactions = parseCSVFormat(content);
  }

  const transactions: ParsedTransaction[] = rawTransactions.map(t => {
    const matchedClientId = matchClient(t.clientName, t.clientBin, clients);
    const isDuplicate = t.documentNumber
      ? existingDocNumbers.includes(t.documentNumber)
      : false;

    return {
      ...t,
      matchedClientId,
      matchStatus: isDuplicate ? 'duplicate' : matchedClientId ? 'matched' : 'unmatched',
    };
  });

  return {
    transactions,
    format,
    fileName: file.name,
  };
}
