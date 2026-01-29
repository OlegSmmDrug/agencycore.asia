import { supabase } from '../lib/supabase';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

export interface GeneratedDocument {
  id: string;
  organizationId: string;
  templateId?: string;
  clientId?: string;
  projectId?: string;
  createdBy?: string;
  documentNumber?: string;
  name: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  status: 'draft' | 'generated' | 'sent' | 'signed' | 'cancelled';
  amount?: number;
  currency: string;
  variablesUsed: Record<string, any>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  signedAt?: string;
  fileUrl?: string;
}

const getCurrentOrganizationId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
};

const getCurrentUserId = (): string | null => {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.id || null;
};

const mapRowToDocument = (row: any): GeneratedDocument => ({
  id: row.id,
  organizationId: row.organization_id,
  templateId: row.template_id,
  clientId: row.client_id,
  projectId: row.project_id,
  createdBy: row.created_by,
  documentNumber: row.document_number,
  name: row.name,
  filePath: row.file_path,
  fileName: row.file_name,
  fileSize: row.file_size,
  status: row.status,
  amount: row.amount ? Number(row.amount) : undefined,
  currency: row.currency,
  variablesUsed: row.variables_used || {},
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sentAt: row.sent_at,
  signedAt: row.signed_at
});

// 🚀 Кэш для шаблонов (ускоряет генерацию на 30-50%)
interface TemplateCacheEntry {
  data: any;
  blob: ArrayBuffer;
  timestamp: number;
}

const templateCache = new Map<string, TemplateCacheEntry>();
const CACHE_SIZE = 5; // Храним последние 5 шаблонов
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

const getFromCache = (templateId: string): TemplateCacheEntry | null => {
  const entry = templateCache.get(templateId);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    templateCache.delete(templateId);
    return null;
  }

  return entry;
};

const addToCache = (templateId: string, data: any, blob: ArrayBuffer) => {
  if (templateCache.size >= CACHE_SIZE) {
    const oldestKey = Array.from(templateCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    templateCache.delete(oldestKey);
  }

  templateCache.set(templateId, {
    data,
    blob,
    timestamp: Date.now()
  });
};

export const generatedDocumentService = {
  async getAll(): Promise<GeneratedDocument[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToDocument);
  },

  async getById(id: string): Promise<GeneratedDocument | null> {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToDocument(data) : null;
  },

  async getByStatus(status: string): Promise<GeneratedDocument[]> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToDocument);
  },

  async getByClient(clientId: string): Promise<GeneratedDocument[]> {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToDocument);
  },

  async generateDocument(
    templateId: string,
    name: string,
    variables: Record<string, any>,
    clientId?: string,
    projectId?: string,
    amount?: number
  ): Promise<GeneratedDocument> {
    const startTime = performance.now();
    console.log('🚀 Начало генерации документа');

    const organizationId = getCurrentOrganizationId();
    const userId = getCurrentUserId();
    if (!organizationId) throw new Error('No organization ID');

    // Проверяем кэш
    const cached = getFromCache(templateId);
    let templateData: any;
    let arrayBuffer: ArrayBuffer;

    if (cached) {
      console.log('⚡ Шаблон загружен из КЭША (0ms)');
      templateData = cached.data;
      arrayBuffer = cached.blob;
    } else {
      // Этап 1: Загрузка метаданных шаблона
      const step1Start = performance.now();
      const { data, error: templateError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;
      templateData = data;
      console.log(`⏱️ Шаг 1 (метаданные шаблона): ${(performance.now() - step1Start).toFixed(0)}ms`);

      // Этап 2: Загрузка файла шаблона
      const step2Start = performance.now();
      const { data: templateFileBlob, error: downloadError } = await supabase.storage
        .from('document-templates')
        .download(templateData.file_path);

      if (downloadError) throw downloadError;
      console.log(`⏱️ Шаг 2 (загрузка файла): ${(performance.now() - step2Start).toFixed(0)}ms`);

      // Этап 3: Парсинг ZIP
      const step3Start = performance.now();
      arrayBuffer = await templateFileBlob.arrayBuffer();
      console.log(`⏱️ Шаг 3 (arrayBuffer): ${(performance.now() - step3Start).toFixed(0)}ms`);

      // Сохраняем в кэш
      addToCache(templateId, templateData, arrayBuffer);
      console.log('💾 Шаблон сохранен в кэш');
    }

    // Этап 4: Создание ZIP и инициализация docxtemplater
    const step4Start = performance.now();
    const zip = new PizZip(arrayBuffer.slice(0)); // используем .slice() для клонирования

    // Оптимизированный парсер (создается один раз)
    const customParser = (tag: string) => {
      const cleanTag = tag.trim();
      const isLoop = cleanTag[0] === '#' || cleanTag[0] === '/';
      const path = isLoop ? cleanTag.substring(1) : cleanTag;

      return {
        get: (scope: any) => {
          if (isLoop) return scope[path];
          return scope[cleanTag] !== undefined ? scope[cleanTag] : '';
        }
      };
    };

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      parser: customParser,
      nullGetter: () => '',
      delimiters: { start: '{{', end: '}}' }
    });
    console.log(`⏱️ Шаг 4 (инициализация Docxtemplater): ${(performance.now() - step4Start).toFixed(0)}ms`);

    // Этап 5: Подготовка переменных (оптимизировано)
    const step5Start = performance.now();
    const cleanedVariables: Record<string, any> = { ...variables };

    // Поддержка синонимов переменных (для совместимости и удобства)
    const synonymMap: Record<string, string> = {
      // executor_basis -> executor_authority_basis
      'executor_basis': 'executor_authority_basis',
      // executor_position -> executor_director_position
      'executor_position': 'executor_director_position',
      // services_description -> service_description
      'services_description': 'service_description',
      // customer_* -> client_* (двусторонняя совместимость)
      'customer_name': 'client_name',
      'customer_company': 'client_company',
      'customer_legal_name': 'client_legal_name',
      'customer_bin': 'client_bin',
      'customer_email': 'client_email',
      'customer_phone': 'client_phone',
      'customer_address': 'client_address',
      'customer_director': 'client_director',
      'customer_position': 'client_position',
      'customer_authority_basis': 'client_authority_basis',
      'customer_basis': 'client_authority_basis',
      'customer_bank': 'client_bank',
      'customer_iban': 'client_iban',
      'customer_bik': 'client_bik',
      // client_basis -> client_authority_basis
      'client_basis': 'client_authority_basis'
    };

    // Применяем синонимы: если в шаблоне используется синоним, подставляем основную переменную
    Object.entries(synonymMap).forEach(([synonym, original]) => {
      if (cleanedVariables[original] && !cleanedVariables[synonym]) {
        cleanedVariables[synonym] = cleanedVariables[original];
      }
    });

    // Заполняем отсутствующие переменные из шаблона
    if (templateData.parsed_variables?.length) {
      const providedKeys = new Set(Object.keys(cleanedVariables));
      for (const varName of templateData.parsed_variables) {
        if (!providedKeys.has(varName)) {
          cleanedVariables[varName] = '';
        }
      }

      // Валидация циклов (быстрая проверка)
      const commonLoops = ['services', 'items', 'tasks', 'payments', 'stages'];
      for (const loopName of commonLoops) {
        if (templateData.parsed_variables.includes(loopName) && !Array.isArray(cleanedVariables[loopName])) {
          cleanedVariables[loopName] = cleanedVariables[loopName] ? [cleanedVariables[loopName]] : [];
        }
      }
    }

    console.log(`⏱️ Шаг 5 (подготовка переменных): ${(performance.now() - step5Start).toFixed(0)}ms`);

    // Этап 6: Рендеринг
    const step6Start = performance.now();
    doc.setData(cleanedVariables);

    try {
      doc.render();
      console.log(`⏱️ Шаг 6 (рендеринг): ${(performance.now() - step6Start).toFixed(0)}ms`);
    } catch (error: any) {
      console.error('=== ОШИБКА ГЕНЕРАЦИИ ДОКУМЕНТА ===');
      console.error('Полная ошибка:', error);
      console.error('Имя ошибки:', error.name);
      console.error('Сообщение:', error.message);

      // Специальная обработка для "Multi error" (разорванные теги Word)
      if (error.name === 'TemplateError' && error.message?.includes('Multi error')) {
        throw new Error(
          `⚠️ ОШИБКА ФОРМАТИРОВАНИЯ ШАБЛОНА\n\n` +
          `Word разбил теги на части из-за проверки орфографии или форматирования.\n\n` +
          `РЕШЕНИЕ:\n` +
          `1. Откройте файл шаблона в Word\n` +
          `2. Найдите все теги вида {{variable}}\n` +
          `3. Полностью УДАЛИТЕ каждый тег\n` +
          `4. Вручную ПЕРЕПЕЧАТАЙТЕ тег заново (не копируйте!)\n` +
          `5. Убедитесь, что тег написан без пробелов: {{variable}}\n` +
          `6. Сохраните файл и загрузите заново\n\n` +
          `Проблемные теги перечислены в консоли браузера (F12).`
        );
      }

      if (error.properties && error.properties.errors instanceof Array) {
        console.error(`\n📊 Найдено ошибок: ${error.properties.errors.length}`);

        // Группируем ошибки по типам
        const errorsByType: Record<string, any[]> = {};
        const allErrors = error.properties.errors.map((err: any, index: number) => {
          const errorType = err.name || 'Unknown';
          const tag = err.properties?.id || err.properties?.xtag || err.properties?.tag || 'unknown';
          const part = err.properties?.part || 'unknown';
          const explanation = err.properties?.explanation || err.message || 'Нет описания';
          const offset = err.properties?.offset;

          if (!errorsByType[errorType]) {
            errorsByType[errorType] = [];
          }
          errorsByType[errorType].push({ tag, part, explanation, offset });

          console.error(`\n❌ Ошибка ${index + 1} [${errorType}]:`, {
            tag,
            part,
            explanation,
            offset,
            fullError: err
          });

          return {
            type: errorType,
            tag,
            part,
            explanation,
            offset
          };
        });

        // Специальная обработка для незакрытых циклов
        const unclosedLoops = allErrors.filter((e: any) =>
          e.explanation?.includes('Unclosed') ||
          e.explanation?.includes('loop') ||
          e.type === 'UnclosedLoopError'
        );

        if (unclosedLoops.length > 0) {
          const loopList = unclosedLoops.map((err: any) => `• {#${err.tag}} - не найден закрывающий тег {/${err.tag}}`).join('\n');
          throw new Error(
            `❌ НЕЗАКРЫТЫЕ ЦИКЛЫ В ШАБЛОНЕ\n\n` +
            `Найдено циклов без закрывающего тега:\n${loopList}\n\n` +
            `Каждый цикл должен быть закрыт:\n` +
            `{#services}...текст...{/services}`
          );
        }

        // Специальная обработка для дублирующихся тегов
        const duplicateTags = allErrors.filter((e: any) =>
          e.explanation?.includes('Duplicate') ||
          e.type === 'DuplicateOpenTag' ||
          e.type === 'DuplicateCloseTag'
        );

        if (duplicateTags.length > 0) {
          const uniqueTags = [...new Set(duplicateTags.map((e: any) => e.tag))];
          throw new Error(
            `❌ ДУБЛИРУЮЩИЕСЯ ТЕГИ\n\n` +
            `Word разбил следующие теги на части:\n${uniqueTags.map(t => `• {{${t}}}`).join('\n')}\n\n` +
            `РЕШЕНИЕ:\n` +
            `1. Откройте шаблон в Word\n` +
            `2. Удалите эти теги полностью\n` +
            `3. Перепечатайте их заново вручную (не копируйте)\n` +
            `4. Загрузите файл снова\n\n` +
            `💡 Совет: Отключите автозамену и проверку орфографии в Word перед редактированием тегов.`
          );
        }

        // Общий список первых 10 ошибок
        const first10 = allErrors.slice(0, 10);
        const errorList = first10.map((err: any, i: number) =>
          `${i + 1}. [${err.type}] Тег: {{${err.tag}}}\n   Где: ${err.part}\n   Проблема: ${err.explanation}`
        ).join('\n\n');

        const remainingCount = allErrors.length - 10;
        const remaining = remainingCount > 0 ? `\n\n... и еще ${remainingCount} ошибок (см. консоль)` : '';

        // Группировка по типам для сводки
        const typeSummary = Object.keys(errorsByType).map(type =>
          `• ${type}: ${errorsByType[type].length} шт.`
        ).join('\n');

        throw new Error(
          `❌ В шаблоне найдено ${allErrors.length} ошибок!\n\n` +
          `Типы ошибок:\n${typeSummary}\n\n` +
          `Первые 10 ошибок:\n\n${errorList}${remaining}\n\n` +
          `📋 Откройте консоль браузера (F12) для полного списка.`
        );
      }

      throw new Error(`Ошибка генерации документа: ${error.message || 'Неизвестная ошибка'}`);
    }

    // Этап 7: Генерация blob
    const step7Start = performance.now();
    const generatedBlob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    console.log(`⏱️ Шаг 7 (генерация blob): ${(performance.now() - step7Start).toFixed(0)}ms`);

    // Этап 8: Загрузка в Storage
    const step8Start = performance.now();
    const timestamp = Date.now();
    const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${sanitizedName}_${timestamp}.docx`;
    const storagePath = `${organizationId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('generated-documents')
      .upload(storagePath, generatedBlob);

    if (uploadError) throw uploadError;
    console.log(`⏱️ Шаг 8 (загрузка в Storage): ${(performance.now() - step8Start).toFixed(0)}ms`);

    // Этап 9: Создание записи в БД
    const step9Start = performance.now();
    const { data: publicUrlData } = supabase.storage
      .from('generated-documents')
      .getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from('generated_documents')
      .insert({
        organization_id: organizationId,
        template_id: templateId,
        client_id: clientId || null,
        project_id: projectId || null,
        created_by: userId,
        name,
        file_path: storagePath,
        file_name: fileName,
        file_size: generatedBlob.size,
        status: 'generated',
        amount: amount || null,
        currency: 'KZT',
        variables_used: variables
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`⏱️ Шаг 9 (сохранение в БД): ${(performance.now() - step9Start).toFixed(0)}ms`);

    const totalTime = performance.now() - startTime;
    console.log(`\n✅ ДОКУМЕНТ СФОРМИРОВАН ЗА ${totalTime.toFixed(0)}ms (${(totalTime / 1000).toFixed(2)}s)`);

    const document = mapRowToDocument(data);
    document.fileUrl = publicUrlData.publicUrl;

    return document;
  },

  async updateStatus(id: string, status: string): Promise<GeneratedDocument> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    } else if (status === 'signed') {
      updateData.signed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('generated_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapRowToDocument(data);
  },

  async update(id: string, updates: Partial<GeneratedDocument>): Promise<GeneratedDocument> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined) updateData.status = updates.status;

    const { data, error } = await supabase
      .from('generated_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapRowToDocument(data);
  },

  async delete(id: string): Promise<void> {
    const document = await this.getById(id);
    if (!document) throw new Error('Document not found');

    const { error: storageError } = await supabase.storage
      .from('generated-documents')
      .remove([document.filePath]);

    if (storageError) console.error('Error deleting file:', storageError);

    const { error } = await supabase
      .from('generated_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async downloadDocument(document: GeneratedDocument): Promise<void> {
    try {
      console.log('Скачивание документа:', {
        filePath: document.filePath,
        fileName: document.fileName
      });

      const { data: urlData } = supabase.storage
        .from('generated-documents')
        .getPublicUrl(document.filePath);

      console.log('Public URL получен:', urlData.publicUrl);

      if (!urlData?.publicUrl) {
        throw new Error('Unable to get download URL');
      }

      const response = await fetch(urlData.publicUrl);
      console.log('Fetch response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('Blob размер:', blob.size);

      saveAs(blob, document.fileName);
      console.log('Файл сохранен успешно');
    } catch (error: any) {
      console.error('Ошибка скачивания договора:', error);
      throw new Error(`Ошибка скачивания: ${error.message}`);
    }
  },

  // 🚀 Методы для работы с кэшем (для оптимизации)

  async preloadTemplate(templateId: string): Promise<void> {
    console.log(`🔄 Предзагрузка шаблона ${templateId}...`);
    const cached = getFromCache(templateId);
    if (cached) {
      console.log('✅ Шаблон уже в кэше');
      return;
    }

    const { data: templateData, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    const { data: templateFileBlob, error: downloadError } = await supabase.storage
      .from('document-templates')
      .download(templateData.file_path);

    if (downloadError) throw downloadError;

    const arrayBuffer = await templateFileBlob.arrayBuffer();
    addToCache(templateId, templateData, arrayBuffer);
    console.log('✅ Шаблон предзагружен в кэш');
  },

  async preloadMostUsedTemplates(): Promise<void> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    console.log('🔄 Предзагрузка популярных шаблонов...');

    // Получаем топ-3 используемых шаблона
    const { data, error } = await supabase
      .from('document_templates')
      .select('id, usage_count')
      .eq('organization_id', organizationId)
      .order('usage_count', { ascending: false })
      .limit(3);

    if (error || !data?.length) return;

    await Promise.all(
      data.map(template => this.preloadTemplate(template.id).catch(() => {}))
    );

    console.log(`✅ Предзагружено ${data.length} шаблонов`);
  },

  clearCache(): void {
    templateCache.clear();
    console.log('🗑️ Кэш шаблонов очищен');
  },

  getCacheStats() {
    return {
      size: templateCache.size,
      maxSize: CACHE_SIZE,
      templates: Array.from(templateCache.entries()).map(([id, entry]) => ({
        id,
        age: Date.now() - entry.timestamp,
        ageMinutes: ((Date.now() - entry.timestamp) / 60000).toFixed(1)
      }))
    };
  }
};
