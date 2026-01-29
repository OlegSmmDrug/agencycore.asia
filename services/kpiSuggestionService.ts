import { supabase } from '../lib/supabase';
import { KpiPreset, ProjectKpi, Project } from '../types';

export const getKpiPresets = async (): Promise<KpiPreset[]> => {
  const { data, error } = await supabase
    .from('kpi_presets')
    .select('*')
    .order('display_order');

  if (error) {
    console.error('Error fetching KPI presets:', error);
    return [];
  }

  return data || [];
};

export const getAvailableKpis = async (project: Project): Promise<{
  smm: (KpiPreset & { available: boolean })[];
  ads: (KpiPreset & { available: boolean })[];
}> => {
  const presets = await getKpiPresets();

  const hasLivedune = !!(project.liveduneAccessToken && project.liveduneAccountId);
  const hasFacebook = !!(project.facebookAccessToken && project.adAccountId);

  const smmPresets = presets
    .filter(p => p.category === 'smm')
    .map(p => ({
      ...p,
      available: p.source === 'livedune' ? hasLivedune : p.source === 'manual'
    }));

  const adsPresets = presets
    .filter(p => p.category === 'ads')
    .map(p => ({
      ...p,
      available: p.source === 'facebook' ? hasFacebook : p.source === 'manual'
    }));

  return {
    smm: smmPresets,
    ads: adsPresets
  };
};

export const applyKpiSuggestions = (
  selectedPresets: KpiPreset[],
  existingKpis: ProjectKpi[] = []
): ProjectKpi[] => {
  const newKpis: ProjectKpi[] = selectedPresets.map(preset => ({
    id: `kpi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: preset.name,
    plan: preset.default_plan,
    fact: 0,
    unit: preset.unit,
    source: preset.source as 'manual' | 'livedune' | 'facebook',
    autoUpdate: preset.source !== 'manual',
    metricKey: preset.metric_key,
    lastSyncedAt: undefined
  }));

  return [...existingKpis, ...newKpis];
};

export const getKpiPresetsByIds = async (presetIds: string[]): Promise<KpiPreset[]> => {
  if (presetIds.length === 0) return [];

  const { data, error } = await supabase
    .from('kpi_presets')
    .select('*')
    .in('id', presetIds);

  if (error) {
    console.error('Error fetching KPI presets by IDs:', error);
    return [];
  }

  return data || [];
};

export const getRecommendedKpis = (project: Project): string[] => {
  const hasLivedune = !!(project.liveduneAccessToken && project.liveduneAccountId);
  const hasFacebook = !!(project.facebookAccessToken && project.adAccountId);

  const recommended: string[] = [];

  if (hasLivedune) {
    recommended.push('reach', 'er', 'followers');
  }

  if (hasFacebook) {
    recommended.push('cpl', 'ctr', 'leads');
  }

  return recommended;
};
