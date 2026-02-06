import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Gift } from 'lucide-react';

export interface PeriodBonus {
  id: string;
  period_key: string;
  period_label: string;
  months: number;
  bonus_months: number;
  sort_order: number;
  is_active: boolean;
}

interface Props {
  periods: PeriodBonus[];
  onReload: () => void;
}

const BillingPeriodsTab: React.FC<Props> = ({ periods, onReload }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PeriodBonus>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (p: PeriodBonus) => {
    setEditingId(p.id);
    setForm({ ...p });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscription_period_bonuses')
        .update({
          period_label: form.period_label,
          months: form.months,
          bonus_months: form.bonus_months,
          sort_order: form.sort_order,
          is_active: form.is_active,
        })
        .eq('id', editingId);

      if (error) throw error;
      setEditingId(null);
      onReload();
    } catch (err) {
      console.error('Error saving period:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-800">Периоды подписки</h3>
        <p className="text-sm text-slate-500">Настройте варианты периодов и бонусные месяцы за длительную подписку</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {periods.map((p) => {
          const isEditing = editingId === p.id;
          const data = isEditing ? form : p;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border ${isEditing ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'} p-5 shadow-sm transition-all`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 rounded-lg ${p.is_active ? 'bg-green-100' : 'bg-slate-100'}`}>
                  <Gift className={`w-4 h-4 ${p.is_active ? 'text-green-600' : 'text-slate-400'}`} />
                </div>
                {isEditing ? (
                  <input
                    value={data.period_label || ''}
                    onChange={e => setForm({ ...form, period_label: e.target.value })}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-800">{p.period_label}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Месяцев</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={data.months ?? 0}
                      onChange={e => setForm({ ...form, months: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-lg font-bold text-slate-800">{p.months}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Бонус</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={data.bonus_months ?? 0}
                      onChange={e => setForm({ ...form, bonus_months: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-lg font-bold text-emerald-600">+{p.bonus_months} мес.</p>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs text-slate-600">Активен:</label>
                  <button
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`w-8 h-5 rounded-full transition-colors relative ${form.is_active ? 'bg-green-500' : 'bg-slate-300'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${form.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button onClick={cancelEdit} className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">
                      Отмена
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      {saving ? '...' : 'Сохр.'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(p)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Редактировать
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BillingPeriodsTab;
