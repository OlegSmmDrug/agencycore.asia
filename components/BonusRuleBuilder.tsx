import React, { useState, useEffect } from 'react';
import { BonusRule, MetricSource, ConditionType, RewardType, TieredConfigItem } from '../types';
import { bonusRuleService } from '../services/bonusRuleService';
import Modal from './Modal';

interface BonusRuleBuilderProps {
  ownerId: string;
  ownerType: 'jobTitle' | 'user';
  ownerLabel: string;
}

const metricSourceLabels: Record<MetricSource, string> = {
  sales_revenue: 'Выручка от продаж',
  project_retention: 'Процент продления проектов (Retention)',
  manual_kpi: 'Ручной KPI',
  tasks_completed: 'Количество выполненных задач',
  cpl_efficiency: 'Эффективность CPL',
  custom_metric: 'Пользовательская метрика'
};

const conditionTypeLabels: Record<ConditionType, string> = {
  always: 'Всегда (от любой суммы)',
  threshold: 'Порог (выполнить план)',
  tiered: 'Ступенчатая шкала'
};

const rewardTypeLabels: Record<RewardType, string> = {
  percent: 'Процент (%)',
  fixed_amount: 'Фиксированная сумма (₸)'
};

const BonusRuleBuilder: React.FC<BonusRuleBuilderProps> = ({ ownerId, ownerType, ownerLabel }) => {
  const [rules, setRules] = useState<BonusRule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BonusRule | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<BonusRule>>({
    name: '',
    metricSource: 'sales_revenue',
    conditionType: 'always',
    rewardType: 'percent',
    rewardValue: 0,
    applyToBase: true,
    isActive: true,
    calculationPeriod: 'monthly',
    thresholdOperator: '>=',
    thresholdValue: 0,
    tieredConfig: []
  });

  useEffect(() => {
    loadRules();
  }, [ownerId, ownerType]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await bonusRuleService.getByOwner(ownerId, ownerType);
      setRules(data);
    } catch (error) {
      console.error('Error loading bonus rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (rule?: BonusRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData(rule);
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        metricSource: 'sales_revenue',
        conditionType: 'always',
        rewardType: 'percent',
        rewardValue: 0,
        applyToBase: true,
        isActive: true,
        calculationPeriod: 'monthly',
        thresholdOperator: '>=',
        thresholdValue: 0,
        tieredConfig: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      if (editingRule) {
        await bonusRuleService.update(editingRule.id, formData);
      } else {
        await bonusRuleService.create({
          ...formData as Omit<BonusRule, 'id' | 'createdAt' | 'updatedAt'>,
          ownerId,
          ownerType
        });
      }
      await loadRules();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving bonus rule:', error);
      alert('Ошибка при сохранении правила');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить это правило мотивации?')) return;
    try {
      setLoading(true);
      await bonusRuleService.delete(id);
      await loadRules();
    } catch (error) {
      console.error('Error deleting bonus rule:', error);
      alert('Ошибка при удалении правила');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await bonusRuleService.toggleActive(id, isActive);
      await loadRules();
    } catch (error) {
      console.error('Error toggling bonus rule:', error);
    }
  };

  const addTieredLevel = () => {
    const currentTiers = formData.tieredConfig || [];
    setFormData({
      ...formData,
      tieredConfig: [...currentTiers, { min: 0, max: 100, reward: 0 }]
    });
  };

  const updateTieredLevel = (index: number, field: keyof TieredConfigItem, value: number) => {
    const tiers = [...(formData.tieredConfig || [])];
    tiers[index] = { ...tiers[index], [field]: value };
    setFormData({ ...formData, tieredConfig: tiers });
  };

  const removeTieredLevel = (index: number) => {
    const tiers = [...(formData.tieredConfig || [])];
    tiers.splice(index, 1);
    setFormData({ ...formData, tieredConfig: tiers });
  };

  const getConditionDisplay = (rule: BonusRule): string => {
    if (rule.conditionType === 'always') return 'От любой суммы';
    if (rule.conditionType === 'threshold') {
      return `База ${rule.thresholdOperator} ${rule.thresholdValue?.toLocaleString()} ₸`;
    }
    if (rule.conditionType === 'tiered') {
      return `Ступенчатая шкала (${rule.tieredConfig?.length || 0} уровней)`;
    }
    return '';
  };

  const getRewardDisplay = (rule: BonusRule): string => {
    if (rule.rewardType === 'percent') {
      return `${rule.rewardValue}%${rule.applyToBase ? ' от базы' : ''}`;
    }
    return `${rule.rewardValue.toLocaleString()} ₸`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Правила мотивации
        </h3>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
        >
          + Добавить правило
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
          <p className="text-slate-400 text-sm font-bold">Нет правил мотивации</p>
          <p className="text-slate-300 text-xs mt-1">Добавьте первое правило</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`p-6 rounded-2xl border transition-all ${
                rule.isActive
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-50 border-slate-100 opacity-50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-black text-slate-800">{rule.name}</h4>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                      rule.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {rule.isActive ? 'Активно' : 'Неактивно'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {metricSourceLabels[rule.metricSource]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(rule.id, !rule.isActive)}
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    title={rule.isActive ? 'Деактивировать' : 'Активировать'}
                  >
                    {rule.isActive ? '◉' : '○'}
                  </button>
                  <button
                    onClick={() => handleOpenModal(rule)}
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Редактировать"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    title="Удалить"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Условие</p>
                  <p className="text-xs font-bold text-slate-700">{getConditionDisplay(rule)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Награда</p>
                  <p className="text-xs font-bold text-emerald-600">{getRewardDisplay(rule)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingRule ? 'Редактировать правило' : 'Новое правило мотивации'}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Название правила</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Например: Комиссия с продаж"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Источник данных (База расчета)</label>
            <select
              value={formData.metricSource || 'sales_revenue'}
              onChange={e => setFormData({ ...formData, metricSource: e.target.value as MetricSource })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {Object.entries(metricSourceLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Тип условия</label>
            <select
              value={formData.conditionType || 'always'}
              onChange={e => setFormData({ ...formData, conditionType: e.target.value as ConditionType })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {Object.entries(conditionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {formData.conditionType === 'threshold' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Оператор</label>
                <select
                  value={formData.thresholdOperator || '>='}
                  onChange={e => setFormData({ ...formData, thresholdOperator: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value=">=">&gt;= (больше или равно)</option>
                  <option value="<=">&lt;= (меньше или равно)</option>
                  <option value="=">=  (равно)</option>
                  <option value=">">&gt; (больше)</option>
                  <option value="<">&lt; (меньше)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Порог (целевое значение)</label>
                <input
                  type="number"
                  value={formData.thresholdValue || 0}
                  onChange={e => setFormData({ ...formData, thresholdValue: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
            </div>
          )}

          {formData.conditionType === 'tiered' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold text-slate-700">Ступенчатая шкала</label>
                <button
                  onClick={addTieredLevel}
                  className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg"
                >
                  + Уровень
                </button>
              </div>
              <div className="space-y-2">
                {(formData.tieredConfig || []).map((tier, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                    <input
                      type="number"
                      value={tier.min}
                      onChange={e => updateTieredLevel(index, 'min', Number(e.target.value))}
                      placeholder="От"
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <span className="text-slate-400">-</span>
                    <input
                      type="number"
                      value={tier.max}
                      onChange={e => updateTieredLevel(index, 'max', Number(e.target.value))}
                      placeholder="До"
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <span className="text-slate-400">=</span>
                    <input
                      type="number"
                      value={tier.reward}
                      onChange={e => updateTieredLevel(index, 'reward', Number(e.target.value))}
                      placeholder="Награда"
                      className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <button
                      onClick={() => removeTieredLevel(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Тип награды</label>
            <select
              value={formData.rewardType || 'percent'}
              onChange={e => setFormData({ ...formData, rewardType: e.target.value as RewardType })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {Object.entries(rewardTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Значение награды {formData.rewardType === 'percent' ? '(%)' : '(₸)'}
            </label>
            <input
              type="number"
              value={formData.rewardValue || 0}
              onChange={e => setFormData({ ...formData, rewardValue: Number(e.target.value) })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          {formData.rewardType === 'percent' && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="applyToBase"
                checked={formData.applyToBase}
                onChange={e => setFormData({ ...formData, applyToBase: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="applyToBase" className="text-xs font-bold text-slate-700">
                Применять процент к базовой метрике
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Описание (необязательно)</label>
            <textarea
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Краткое описание правила..."
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={loading || !formData.name}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={handleCloseModal}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm uppercase rounded-xl transition-all"
            >
              Отмена
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BonusRuleBuilder;
