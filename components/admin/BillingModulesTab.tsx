import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Package } from 'lucide-react';

export interface PlatformModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  price_kzt: number;
  sort_order: number;
  is_active: boolean;
}

interface Props {
  modules: PlatformModule[];
  onReload: () => void;
}

const BillingModulesTab: React.FC<Props> = ({ modules, onReload }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PlatformModule>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (mod: PlatformModule) => {
    setEditingId(mod.id);
    setForm({ ...mod });
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
        .from('platform_modules')
        .update({
          name: form.name,
          description: form.description,
          price: form.price,
          price_kzt: form.price_kzt,
          is_active: form.is_active,
          sort_order: form.sort_order,
        })
        .eq('id', editingId);

      if (error) throw error;
      setEditingId(null);
      onReload();
    } catch (err) {
      console.error('Error saving module:', err);
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (mod: PlatformModule) => {
    try {
      await supabase
        .from('platform_modules')
        .update({ is_active: !mod.is_active })
        .eq('id', mod.id);
      onReload();
    } catch (err) {
      console.error('Error toggling module:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-800">Модули платформы</h3>
        <p className="text-sm text-slate-500">Управляйте модулями, ценами и доступностью. Модули по $5 доступны для покупки отдельно на тарифах Free/Starter.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Модуль</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Slug</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Цена (USD)</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Цена (KZT)</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Порядок</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Статус</th>
                <th className="px-5 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => {
                const isEditing = editingId === mod.id;
                const data = isEditing ? form : mod;

                return (
                  <tr key={mod.id} className={`border-b border-slate-100 ${isEditing ? 'bg-blue-50/40' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            value={data.name || ''}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                          />
                          <input
                            value={data.description || ''}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 focus:outline-none focus:border-blue-500"
                            placeholder="Описание"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mod.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            <Package className={`w-4 h-4 ${mod.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <span className={`text-sm font-medium ${mod.is_active ? 'text-slate-800' : 'text-slate-400'}`}>{mod.name}</span>
                            {mod.description && (
                              <p className="text-[11px] text-slate-400 max-w-[200px] truncate">{mod.description}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-slate-500">{mod.slug}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={data.price ?? 0}
                          onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                          className="w-20 text-center border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-sm font-medium text-slate-700">${mod.price}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={data.price_kzt ?? 0}
                          onChange={e => setForm({ ...form, price_kzt: parseFloat(e.target.value) || 0 })}
                          className="w-24 text-center border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-sm text-slate-600">{mod.price_kzt?.toLocaleString()} ₸</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={data.sort_order ?? 0}
                          onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                          className="w-16 text-center border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">{mod.sort_order}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => !isEditing && toggleActive(mod)}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                          (isEditing ? data.is_active : mod.is_active)
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        } transition-colors`}
                      >
                        {(isEditing ? data.is_active : mod.is_active) ? 'Активен' : 'Отключен'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={cancelEdit} className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">
                            Отмена
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            {saving ? '...' : 'Сохр.'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(mod)}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          Изменить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BillingModulesTab;
