import { supabase } from '../lib/supabase';

export interface CalculatorCategoryInfo {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
}

let categoriesCache: CalculatorCategoryInfo[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export const calculatorCategoryHelper = {
  async getAllCategories(): Promise<CalculatorCategoryInfo[]> {
    const now = Date.now();
    if (categoriesCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return categoriesCache;
    }

    const { data, error } = await supabase
      .from('calculator_categories')
      .select('id, name, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading calculator categories:', error);
      return [];
    }

    const uniqueCategories = new Map<string, CalculatorCategoryInfo>();

    for (const cat of data || []) {
      const baseName = cat.name;
      if (!uniqueCategories.has(baseName)) {
        uniqueCategories.set(baseName, {
          id: cat.id,
          name: cat.name,
          icon: cat.icon || '📁',
          sortOrder: cat.sort_order || 999,
        });
      }
    }

    categoriesCache = Array.from(uniqueCategories.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    cacheTimestamp = now;

    return categoriesCache;
  },

  async getCategoryInfo(categoryId: string): Promise<CalculatorCategoryInfo | null> {
    const categories = await this.getAllCategories();

    const exactMatch = categories.find(c => c.id === categoryId);
    if (exactMatch) return exactMatch;

    const nameMatch = categories.find(c =>
      categoryId.toLowerCase().includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes(categoryId.toLowerCase())
    );
    if (nameMatch) return nameMatch;

    const legacyMap: Record<string, string> = {
      'smm': 'SMM',
      'video': 'Продакшн',
      'target': 'Таргет',
      'sites': 'Сайты',
    };

    const legacyName = legacyMap[categoryId.toLowerCase()];
    if (legacyName) {
      return categories.find(c => c.name === legacyName) || null;
    }

    return null;
  },

  async getCategoryByJobTitleAndTaskType(jobTitle: string, taskType: string): Promise<string> {
    const categories = await this.getAllCategories();
    const jobTitleLower = jobTitle.toLowerCase();
    const taskTypeLower = taskType.toLowerCase();

    if (jobTitleLower.includes('smm') || jobTitleLower.includes('контент')) {
      const smmCat = categories.find(c => c.name === 'SMM');
      return smmCat?.id || 'smm';
    }
    if (jobTitleLower.includes('mobilograph') || jobTitleLower.includes('мобилограф')) {
      const videoCat = categories.find(c => c.name === 'Продакшн' || c.name === 'Видеосъемка');
      return videoCat?.id || 'video';
    }
    if (jobTitleLower.includes('photographer') || jobTitleLower.includes('фотограф')) {
      const photoCat = categories.find(c => c.name === 'Фотосъемка');
      return photoCat?.id || 'photo';
    }
    if (jobTitleLower.includes('videographer') || jobTitleLower.includes('видеограф')) {
      const videoCat = categories.find(c => c.name === 'Видеосъемка');
      return videoCat?.id || 'video';
    }
    if (jobTitleLower.includes('target') || jobTitleLower.includes('таргет')) {
      const targetCat = categories.find(c => c.name === 'Таргет');
      return targetCat?.id || 'target';
    }
    if (jobTitleLower.includes('ai') || jobTitleLower.includes('ии') || jobTitleLower.includes('искусственный интеллект')) {
      const aiCat = categories.find(c => c.name === 'ИИ' || c.name === 'AI');
      return aiCat?.id || 'ai';
    }

    if (taskTypeLower.includes('post') || taskTypeLower.includes('пост') ||
        taskTypeLower.includes('reel') || taskTypeLower.includes('stor')) {
      const smmCat = categories.find(c => c.name === 'SMM');
      return smmCat?.id || 'smm';
    }
    if (taskTypeLower.includes('shoot') || taskTypeLower.includes('съемка')) {
      const videoCat = categories.find(c => c.name === 'Продакшн' || c.name === 'Видеосъемка');
      return videoCat?.id || 'video';
    }
    if (taskTypeLower.includes('ai') || taskTypeLower.includes('ии') || taskTypeLower.includes('gpt')) {
      const aiCat = categories.find(c => c.name === 'ИИ' || c.name === 'AI');
      return aiCat?.id || 'ai';
    }

    return categories[0]?.id || 'other';
  },

  clearCache() {
    categoriesCache = null;
    cacheTimestamp = 0;
  }
};
