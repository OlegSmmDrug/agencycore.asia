import React, { useState, useEffect } from 'react';
import { Project, KpiPreset, ProjectKpi } from '../types';
import { getAvailableKpis, applyKpiSuggestions } from '../services/kpiSuggestionService';

interface KpiSuggestionModalProps {
  project: Project;
  onClose: () => void;
  onApply: (kpis: ProjectKpi[]) => void;
}

const KpiSuggestionModal: React.FC<KpiSuggestionModalProps> = ({ project, onClose, onApply }) => {
  const [loading, setLoading] = useState(true);
  const [smmKpis, setSmmKpis] = useState<(KpiPreset & { available: boolean })[]>([]);
  const [adsKpis, setAdsKpis] = useState<(KpiPreset & { available: boolean })[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [kpiPlans, setKpiPlans] = useState<Record<string, number>>({});

  useEffect(() => {
    loadKpis();
  }, []);

  const loadKpis = async () => {
    setLoading(true);
    const { smm, ads } = await getAvailableKpis(project);
    setSmmKpis(smm);
    setAdsKpis(ads);
    setLoading(false);
  };

  const toggleKpi = (kpiId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(kpiId)) {
      newSelected.delete(kpiId);
      const newPlans = { ...kpiPlans };
      delete newPlans[kpiId];
      setKpiPlans(newPlans);
    } else {
      if (newSelected.size < 5) {
        newSelected.add(kpiId);
      }
    }
    setSelectedIds(newSelected);
  };

  const updateKpiPlan = (kpiId: string, value: number) => {
    setKpiPlans(prev => ({
      ...prev,
      [kpiId]: value
    }));
  };

  const handleApply = () => {
    const allKpis = [...smmKpis, ...adsKpis];
    const selectedPresets = allKpis.filter(kpi => selectedIds.has(kpi.id));

    const newKpis: ProjectKpi[] = selectedPresets.map(preset => ({
      id: `kpi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: preset.name,
      plan: kpiPlans[preset.id] || preset.default_plan || 0,
      fact: 0,
      unit: preset.unit,
      source: preset.source as 'manual' | 'livedune' | 'facebook',
      autoUpdate: preset.source !== 'manual',
      metricKey: preset.metric_key,
      lastSyncedAt: undefined
    }));

    onApply([...(project.kpis || []), ...newKpis]);
    onClose();
  };

  const getSourceIcon = (source: string) => {
    if (source === 'livedune') {
      return (
        <div className="w-5 h-5 rounded bg-pink-500 flex items-center justify-center">
          <span className="text-white text-[9px] font-bold">LD</span>
        </div>
      );
    } else if (source === 'facebook') {
      return (
        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
          <span className="text-white text-[9px] font-bold">FB</span>
        </div>
      );
    }
    return (
      <div className="w-5 h-5 rounded bg-gray-400 flex items-center justify-center">
        <span className="text-white text-[9px] font-bold">M</span>
      </div>
    );
  };

  const renderKpiCard = (kpi: KpiPreset & { available: boolean }) => {
    const isSelected = selectedIds.has(kpi.id);
    const isDisabled = !kpi.available || (selectedIds.size >= 5 && !isSelected);

    return (
      <div
        key={kpi.id}
        className={`p-4 rounded-xl border-2 transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : isDisabled
            ? 'border-gray-200 bg-gray-50 opacity-50'
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 mt-0.5 cursor-pointer"
            onClick={() => !isDisabled && toggleKpi(kpi.id)}
          >
            {isSelected ? (
              <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded border-2 border-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="flex items-center gap-2 mb-1 cursor-pointer"
              onClick={() => !isDisabled && toggleKpi(kpi.id)}
            >
              <h4 className="font-semibold text-sm text-slate-800">{kpi.name}</h4>
              {getSourceIcon(kpi.source)}
            </div>
            <p
              className="text-xs text-slate-600 leading-relaxed cursor-pointer"
              onClick={() => !isDisabled && toggleKpi(kpi.id)}
            >
              {kpi.description}
            </p>
            {!kpi.available && (
              <p className="text-xs text-red-600 mt-2 font-medium">Интеграция не подключена</p>
            )}
            {isSelected && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700">План:</label>
                <input
                  type="number"
                  value={kpiPlans[kpi.id] || kpi.default_plan || ''}
                  onChange={(e) => updateKpiPlan(kpi.id, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                {kpi.unit && (
                  <span className="text-xs text-slate-500">{kpi.unit}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-slate-800">Выберите KPI для отслеживания</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-600">
            Выберите до {5 - selectedIds.size} метрик для автоматического отслеживания ({selectedIds.size}/5 выбрано)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {smmKpis.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">SMM метрики</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {smmKpis.map(renderKpiCard)}
                  </div>
                </div>
              )}

              {adsKpis.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Рекламные метрики</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {adsKpis.map(renderKpiCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <span className="font-medium">Подсказка:</span> Метрики с иконкой LD (LiveDune) и FB (Facebook) будут обновляться автоматически
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleApply}
                disabled={selectedIds.size === 0}
                className={`px-6 py-2.5 rounded-lg transition-colors font-medium ${
                  selectedIds.size === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Применить ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiSuggestionModal;
