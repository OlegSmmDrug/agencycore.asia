import { Client, PaymentType, Transaction, BankCounterpartyAlias, ReconciliationStatus } from '../types';
import { sanitizeCounterpartyName, extractBin, reconciliationService, ReconciliationMatch } from './reconciliationService';

export interface ParsedTransaction {
  date: string;
  amount: number;
  amountOriginal: number;
  currency: string;
  exchangeRate: number | null;
  clientName: string;
  clientNameRaw: string;
  clientBin: string;
  description: string;
  documentNumber: string;
  knpCode: string;
  paymentType: PaymentType;
  isIncome: boolean;
  matchedClientId: string | null;
  matchSource: 'bin' | 'alias' | 'name' | 'none';
  matchStatus: 'matched' | 'unmatched' | 'duplicate';
  reconciliation: ReconciliationMatch;
}

export interface ImportResult {
  transactions: ParsedTransaction[];
  format: '1c' | 'csv' | 'unknown';
  fileName: string;
  summary: {
    total: number;
    verified: number;
    discrepancies: number;
    newEntries: number;
    duplicates: number;
  };
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

function detectPaymentTypeFromText(text: string): PaymentType {
  const lower = text.toLowerCase();
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
  if (lower.includes('постоплат')) {
    return PaymentType.POSTPAYMENT;
  }
  return PaymentType.PREPAYMENT;
}

function mapPaymentTypeFromCSV(value: string): PaymentType {
  const lower = value.toLowerCase().trim();
  if (lower === 'предоплата' || lower.includes('предоплат')) return PaymentType.PREPAYMENT;
  if (lower === 'полная оплата' || lower.includes('полн')) return PaymentType.FULL;
  if (lower === 'постоплата' || lower.includes('постоплат')) return PaymentType.POSTPAYMENT;
  if (lower.includes('ретейнер') || lower.includes('абон')) return PaymentType.RETAINER;
  if (lower.includes('возврат') || lower.includes('refund')) return PaymentType.REFUND;
  return PaymentType.PREPAYMENT;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function extractOurAccount(content: string): string {
  const accountSection = content.match(/СекцияРасчСчет([\s\S]*?)КонецРасчСчет/i);
  if (accountSection) {
    const accMatch = accountSection[1].match(/РасчСчет=(\S+)/i);
    if (accMatch) return accMatch[1].trim();
    const numMatch = accountSection[1].match(/НомерСчета=(\S+)/i);
    if (numMatch) return numMatch[1].trim();
  }

  const headerPart = content.split(/СекцияДокумент/i)[0] || '';
  const fallbackMatch = headerPart.match(/РасчСчет=(\S+)/i);
  if (fallbackMatch) return fallbackMatch[1].trim();

  const sections = content.split(/СекцияДокумент/g).slice(1);
  if (sections.length === 0) return '';

  const accountCounts = new Map<string, number>();
  for (const section of sections) {
    const payer = section.match(/ПлательщикСчет=(\S+)/i);
    const recipient = section.match(/ПолучательСчет=(\S+)/i);
    if (payer) accountCounts.set(payer[1].trim(), (accountCounts.get(payer[1].trim()) || 0) + 1);
    if (recipient) accountCounts.set(recipient[1].trim(), (accountCounts.get(recipient[1].trim()) || 0) + 1);
  }

  let maxCount = 0;
  let mostFrequent = '';
  accountCounts.forEach((count, acc) => {
    if (count > maxCount) { maxCount = count; mostFrequent = acc; }
  });

  if (mostFrequent && maxCount > sections.length * 0.4) return mostFrequent;

  return '';
}

function parse1CFormat(content: string): Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus' | 'matchSource' | 'reconciliation'>[] {
  const results: Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus' | 'matchSource' | 'reconciliation'>[] = [];
  const sections = content.split(/СекцияДокумент/g).slice(1);

  const ourAccount = extractOurAccount(content);

  for (const section of sections) {
    if (!section.includes('КонецДокумента')) continue;

    const fieldMap = new Map<string, string>();
    const sectionLines = section.split(/\r?\n/);
    let curKey = '';
    let curVal = '';
    for (const line of sectionLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'КонецДокумента') {
        if (curKey) { fieldMap.set(curKey, curVal); curKey = ''; curVal = ''; }
        continue;
      }
      const fm = trimmed.match(/^([А-Яа-яA-Za-z_0-9]+)=(.*)/);
      if (fm) {
        if (curKey) fieldMap.set(curKey, curVal);
        curKey = fm[1];
        curVal = fm[2];
      } else if (curKey) {
        curVal += '\n' + trimmed;
      }
    }
    if (curKey) fieldMap.set(curKey, curVal);

    const getField = (name: string): string => fieldMap.get(name)?.trim() || '';

    const dateStr = getField('ДатаДокумента') || getField('ДатаОперации');
    const amountStr = getField('Сумма');
    const docNumber = getField('НомерДокумента');
    const description = getField('НазначениеПлатежа');
    const knpCode = getField('КодНазначенияПлатежа') || '';
    const currency = getField('Валюта') || 'KZT';

    const payerAccount = getField('ПлательщикСчет') || getField('ПлательщикРасчСчет') || '';
    const recipientAccount = getField('ПолучательСчет') || getField('ПолучательРасчСчет') || '';

    const payerNameRaw = getField('ПлательщикНаименование') || getField('Плательщик') || '';
    const payerBinRaw = getField('Плательщик_ИНН') || getField('Плательщик_БИН') || getField('ПлательщикИНН') || '';
    const recipientNameRaw = getField('ПолучательНаименование') || getField('Получатель') || '';
    const recipientBinRaw = getField('Получатель_ИНН') || getField('Получатель_БИН') || getField('ПолучательИНН') || '';

    if (!dateStr || !amountStr) continue;

    const amountOriginal = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.')) || 0;
    if (amountOriginal === 0) continue;

    let isIncome = true;
    let counterpartyNameRaw = payerNameRaw;
    let counterpartyBinRaw = payerBinRaw;

    if (ourAccount) {
      if (payerAccount === ourAccount) {
        isIncome = false;
        counterpartyNameRaw = recipientNameRaw;
        counterpartyBinRaw = recipientBinRaw;
      } else {
        isIncome = true;
        counterpartyNameRaw = payerNameRaw;
        counterpartyBinRaw = payerBinRaw;
      }
    } else {
      if (recipientNameRaw && payerNameRaw) {
        isIncome = true;
        counterpartyNameRaw = payerNameRaw;
        counterpartyBinRaw = payerBinRaw;
      }
    }

    const exchangeRate = currency.toUpperCase() === 'USD' ? parseExchangeRate(description) : null;
    const amountKZT = exchangeRate ? Math.abs(amountOriginal) * exchangeRate : Math.abs(amountOriginal);

    const clientNameSanitized = sanitizeCounterpartyName(counterpartyNameRaw);
    const clientBin = counterpartyBinRaw || extractBin(counterpartyNameRaw);

    results.push({
      date: parseDate(dateStr),
      amount: Math.round(amountKZT * 100) / 100,
      amountOriginal: Math.abs(amountOriginal),
      currency: currency.toUpperCase(),
      exchangeRate,
      clientName: clientNameSanitized,
      clientNameRaw: counterpartyNameRaw,
      clientBin,
      description,
      documentNumber: docNumber,
      knpCode,
      paymentType: detectPaymentTypeFromText(description),
      isIncome,
    });
  }

  return results;
}

function parseCSVFormat(content: string): Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus' | 'matchSource' | 'reconciliation'>[] {
  const results: Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus' | 'matchSource' | 'reconciliation'>[] = [];

  const lines = content.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return results;

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headerCells = parseCSVLine(lines[0], delimiter);
  const headers = headerCells.map(h => h.replace(/"/g, '').replace(/^\uFEFF/, '').trim().toLowerCase());

  const findCol = (...candidates: string[]): number => {
    for (const candidate of candidates) {
      const idx = headers.findIndex(h => h.includes(candidate.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = findCol('дата', 'date');
  const nameCol = findCol('клиент', 'наименование', 'фио', 'контрагент', 'плательщик', 'name', 'client');
  const creditCol = findCol('зачислен', 'приход', 'credit', 'кредит');
  const debitCol = findCol('списан', 'расход', 'debit', 'дебет');
  const amountCol = findCol('сумма', 'amount');
  const descCol = findCol('назначение', 'описание', 'description', 'purpose');
  const knpCol = findCol('кнп', 'knp', 'код');
  const binCol = findCol('бин', 'иин', 'bin', 'iin', 'инн', 'inn');
  const typeCol = findCol('тип платежа', 'тип', 'payment type', 'type');

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delimiter);
    if (cells.length < 2) continue;

    const dateStr = dateCol >= 0 ? cells[dateCol]?.replace(/"/g, '') : '';
    if (!dateStr) continue;

    let amount = 0;
    let isIncome = true;

    if (creditCol >= 0 && debitCol >= 0) {
      const creditVal = parseFloat((cells[creditCol] || '').replace(/\s/g, '').replace(',', '.')) || 0;
      const debitVal = parseFloat((cells[debitCol] || '').replace(/\s/g, '').replace(',', '.')) || 0;
      if (creditVal > 0) {
        amount = creditVal;
        isIncome = true;
      } else if (debitVal > 0) {
        amount = debitVal;
        isIncome = false;
      }
    } else if (amountCol >= 0 && cells[amountCol]) {
      const rawAmount = parseFloat(cells[amountCol].replace(/\s/g, '').replace(',', '.')) || 0;
      amount = Math.abs(rawAmount);
      isIncome = rawAmount >= 0;
    } else if (creditCol >= 0 && cells[creditCol]) {
      amount = parseFloat(cells[creditCol].replace(/\s/g, '').replace(',', '.')) || 0;
      isIncome = true;
    }

    if (amount === 0) continue;

    const clientNameRaw = nameCol >= 0 ? (cells[nameCol] || '') : '';
    const clientNameSanitized = sanitizeCounterpartyName(clientNameRaw);
    const description = descCol >= 0 ? (cells[descCol] || '') : '';
    const knpCode = knpCol >= 0 ? (cells[knpCol] || '') : '';
    const clientBinRaw = binCol >= 0 ? (cells[binCol] || '') : '';
    const clientBin = clientBinRaw || extractBin(clientNameRaw);
    const paymentTypeStr = typeCol >= 0 ? (cells[typeCol] || '') : '';

    const paymentType = paymentTypeStr
      ? mapPaymentTypeFromCSV(paymentTypeStr)
      : detectPaymentTypeFromText(description);

    results.push({
      date: parseDate(dateStr),
      amount,
      amountOriginal: amount,
      currency: 'KZT',
      exchangeRate: null,
      clientName: clientNameSanitized,
      clientNameRaw,
      clientBin,
      description,
      documentNumber: '',
      knpCode,
      paymentType,
      isIncome,
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
  existingTransactions: Transaction[],
  aliases: BankCounterpartyAlias[]
): Promise<ImportResult> {
  let content = await readFileAsText(file, 'windows-1251');

  if (content.includes('�') || (!content.includes('СекцияДокумент') && !content.includes('Дата'))) {
    content = await readFileAsText(file, 'utf-8');
  }

  const format = detectFormat(content, file.name);

  let rawTransactions: Omit<ParsedTransaction, 'matchedClientId' | 'matchStatus' | 'matchSource' | 'reconciliation'>[] = [];

  if (format === '1c') {
    rawTransactions = parse1CFormat(content);
  } else if (format === 'csv') {
    rawTransactions = parseCSVFormat(content);
  }

  const existingDocNumbers = existingTransactions
    .map(t => t.bankDocumentNumber || t.description?.match(/\[DOC:([^\]]+)\]/)?.[1])
    .filter(Boolean) as string[];

  let verified = 0;
  let discrepancies = 0;
  let newEntries = 0;
  let duplicates = 0;

  const transactions: ParsedTransaction[] = rawTransactions.map(t => {
    const { clientId, matchSource } = reconciliationService.matchClientSmart(
      t.clientName,
      t.clientBin,
      clients,
      aliases
    );

    const isDuplicate = t.documentNumber
      ? existingDocNumbers.includes(t.documentNumber)
      : false;

    const reconciliation = reconciliationService.findMatchingTransaction(
      t.date,
      t.amount,
      clientId,
      t.documentNumber,
      existingTransactions
    );

    if (isDuplicate) {
      duplicates++;
    } else if (reconciliation.type === 'verified') {
      verified++;
    } else if (reconciliation.type === 'discrepancy') {
      discrepancies++;
    } else {
      newEntries++;
    }

    return {
      ...t,
      matchedClientId: clientId,
      matchSource,
      matchStatus: isDuplicate ? 'duplicate' as const : clientId ? 'matched' as const : 'unmatched' as const,
      reconciliation,
    };
  });

  return {
    transactions,
    format,
    fileName: file.name,
    summary: {
      total: transactions.length,
      verified,
      discrepancies,
      newEntries,
      duplicates,
    },
  };
}
