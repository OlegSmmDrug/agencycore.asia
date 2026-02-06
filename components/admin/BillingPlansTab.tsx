import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Plus, Trash2, Check, X, Crown } from 'lucide-react';

interface PlanFeature {
  text: string;
  included: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  display_name_ru: string;
  description_ru: string;
  price_monthly: number;
  price_kzt: number;
  max_users: number | null;
  max_projects: number | null;
  additional_user_price_usd: number;
  additional_user_price_kzt: number;
  features_display: PlanFeature[];
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  plans: SubscriptionPlan[];
  onReload: () => void;
}

const BillingPlansTab: React.FC<Props> = ({ plans, onReload }) => {
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SubscriptionPlan>>({});
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  const startEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan.id);
    setForm({ ...plan, features_display: [...plan.features_display] });
    setNewFeature('');
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setForm({});
  };

  const handleSave = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          display_name_ru: form.display_name_ru,
          description_ru: form.description_ru,
          price_monthly: form.price_monthly,
          price_kzt: form.price_kzt,
          max_users: form.max_users,
          max_projects: form.max_projects,
          additional_user_price_usd: form.additional_user_price_usd,
          additional_user_price_kzt: form.additional_user_price_kzt,
          features_display: form.features_display,
          is_popular: form.is_popular,
        })
        .eq('id', editingPlan);

      if (error) throw error;
      setEditingPlan(null);
      onReload();
    } catch (err) {
      console.error('Error saving plan:', err);
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setForm({
      ...form,
      features_display: [...(form.features_display || []), { text: newFeature.trim(), included: true }],
    });
    setNewFeature('');
  };

  const removeFeature = (idx: number) => {
    setForm({
      ...form,
      features_display: (form.features_display || []).filter((_, i) => i !== idx),
    });
  };

  const toggleFeature = (idx: number) => {
    const features = [...(form.features_display || [])];
    features[idx] = { ...features[idx], included: !features[idx].included };
    setForm({ ...form, features_display: features });
  };

  const planColors: Record<string, { border: string; badge: string; badgeText: string }> = {
    'FREE': { border: 'border-slate-300', badge: 'bg-slate-100', badgeText: 'text-slate-600' },
    'STARTER': { border: 'border-blue-300', badge: 'bg-blue-100', badgeText: 'text-blue-700' },
    'PROFESSIONAL': { border: 'border-emerald-300', badge: 'bg-emerald-100', badgeText: 'text-emerald-700' },
    'ENTERPRISE': { border: 'border-amber-300', badge: 'bg-amber-100', badgeText: 'text-amber-700' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Тарифные планы</h3>
          <p className="text-sm text-slate-500">Настройте цены, лимиты и описания для каждого тарифа</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const isEditing = editingPlan === plan.id;
          const data = isEditing ? form : plan;
          const colors = planColors[plan.name] || planColors['FREE'];

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 ${colors.border} p-6 transition-all ${isEditing ? 'ring-2 ring-blue-400 shadow-lg' : 'shadow-sm'}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${colors.badge} ${colors.badgeText}`}>
                    {plan.name}
                  </span>
                  {data.is_popular && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                      <Crown className="w-3 h-3" /> ПОПУЛЯРНЫЙ
                    </span>
                  )}
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => startEdit(plan)}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Редактировать
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-xs font-medium border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Название (RU)</label>
                  {isEditing ? (
                    <input
                      value={data.display_name_ru || ''}
                      onChange={e => setForm({ ...form, display_name_ru: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-800">{plan.display_name_ru || plan.display_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Описание</label>
                  {isEditing ? (
                    <input
                      value={data.description_ru || ''}
                      onChange={e => setForm({ ...form, description_ru: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 truncate">{plan.description_ru || '-'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <NumberField
                  label="Цена (USD)"
                  value={data.price_monthly}
                  editing={isEditing}
                  onChange={v => setForm({ ...form, price_monthly: v ?? 0 })}
                  suffix="$"
                />
                <NumberField
                  label="Цена (KZT)"
                  value={data.price_kzt}
                  editing={isEditing}
                  onChange={v => setForm({ ...form, price_kzt: v ?? 0 })}
                  suffix="₸"
                />
                <NumberField
                  label="Макс. польз."
                  value={data.max_users}
                  editing={isEditing}
                  onChange={v => setForm({ ...form, max_users: v })}
                  nullable
                  nullLabel="Безлимит"
                />
                <NumberField
                  label="Макс. проект."
                  value={data.max_projects}
                  editing={isEditing}
                  onChange={v => setForm({ ...form, max_projects: v })}
                  nullable
                  nullLabel="Безлимит"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <NumberField
                  label="Доп. польз. (USD)"
                  value={data.additional_user_price_usd}
                  editing={isEditing}
                  onChange={v => setForm({ ...form, additional_user_price_usd: v ?? 0 })}
                  suffix="$"
                />
                <NumberField
                  label="Доп. польз. (KZT)"
                  value={data.additional_user_price_kzt}
                  editing={isEditing}
                  onChange={v => setForm({ ...form, additional_user_price_kzt: v ?? 0 })}
                  suffix="₸"
                />
              </div>

              {isEditing && (
                <div className="mb-3 flex items-center gap-2">
                  <label className="text-xs text-slate-600">Популярный:</label>
                  <button
                    onClick={() => setForm({ ...form, is_popular: !form.is_popular })}
                    className={`w-8 h-5 rounded-full transition-colors relative ${form.is_popular ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${form.is_popular ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Фичи</label>
                <div className="space-y-1.5">
                  {(data.features_display || []).map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {isEditing ? (
                        <button onClick={() => toggleFeature(idx)} className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${f.included ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          {f.included && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                      ) : (
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${f.included ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
                          {f.included && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      )}
                      <span className={`text-xs ${f.included ? 'text-slate-700' : 'text-slate-400'}`}>{f.text}</span>
                      {isEditing && (
                        <button onClick={() => removeFeature(idx)} className="ml-auto p-0.5 hover:bg-red-50 rounded text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <div className="flex gap-1.5 mt-2">
                      <input
                        value={newFeature}
                        onChange={e => setNewFeature(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addFeature()}
                        placeholder="Новая фича..."
                        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button onClick={addFeature} className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                        <Plus className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function NumberField({ label, value, editing, onChange, suffix, nullable, nullLabel }: {
  label: string;
  value?: number | null;
  editing: boolean;
  onChange: (v: number | null) => void;
  suffix?: string;
  nullable?: boolean;
  nullLabel?: string;
}) {
  const displayValue = value === null || value === undefined
    ? (nullLabel || '-')
    : `${value.toLocaleString()}${suffix ? ' ' + suffix : ''}`;

  if (!editing) {
    return (
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
        <p className="text-sm font-bold text-slate-800">{displayValue}</p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value === null || value === undefined ? '' : value}
          onChange={e => {
            const v = e.target.value;
            if (v === '' && nullable) onChange(null);
            else onChange(parseFloat(v) || 0);
          }}
          placeholder={nullable ? 'Безлимит' : '0'}
          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}

export default BillingPlansTab;
