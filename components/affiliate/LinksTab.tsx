import React, { useState } from 'react';
import { Plus, Copy, Check, Trash2, ExternalLink, Info } from 'lucide-react';
import { PromoCode, affiliateService } from '../../services/affiliateService';

interface LinksTabProps {
  promoCodes: PromoCode[];
  organizationId: string;
  userId: string;
  onRefresh: () => void;
}

export const LinksTab: React.FC<LinksTabProps> = ({ promoCodes, organizationId, userId, onRefresh }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const appUrl = window.location.origin;

  const handleCreate = async () => {
    if (!newCode.trim()) return;
    setCreating(true);
    setError('');

    try {
      await affiliateService.createPromoCode(organizationId, userId, newCode);
      setNewCode('');
      setShowCreateForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Ошибка создания промокода');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить промокод?')) return;
    await affiliateService.deletePromoCode(id);
    onRefresh();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div
        onClick={() => setShowCreateForm(!showCreateForm)}
        className="border-2 border-dashed border-slate-300 rounded-xl p-5 flex items-center justify-between cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
      >
        <span className="text-base font-medium text-slate-700">Создать партнерскую ссылку</span>
        <Plus className="w-6 h-6 text-slate-400" />
      </div>

      {showCreateForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Промокод</label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
              placeholder="mypromo"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {newCode && (
              <p className="text-xs text-slate-400 mt-1.5">
                Ссылка: {appUrl}/?promo={newCode.toLowerCase()}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={!newCode.trim() || creating}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {creating ? 'Создание...' : 'Создать'}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewCode(''); setError(''); }}
              className="px-5 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-3 px-5 text-sm font-medium text-slate-500">Промокод</th>
              <th className="text-left py-3 px-5 text-sm font-medium text-slate-500">Адрес</th>
              <th className="text-center py-3 px-5 text-sm font-medium text-slate-500">Регистрации</th>
              <th className="text-center py-3 px-5 text-sm font-medium text-slate-500">Оплаты</th>
              <th className="text-left py-3 px-5 text-sm font-medium text-slate-500">Создан</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {promoCodes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                  У вас пока нет промокодов. Создайте первый.
                </td>
              </tr>
            ) : (
              promoCodes.map((pc) => {
                const link = `${appUrl}/?promo=${pc.code}`;
                return (
                  <tr key={pc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-900">{pc.code}</span>
                        <button
                          onClick={() => handleCopy(pc.code, `code-${pc.id}`)}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          {copiedId === `code-${pc.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-blue-600 truncate max-w-[250px]">{link}</span>
                        <button
                          onClick={() => handleCopy(link, `link-${pc.id}`)}
                          className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                        >
                          {copiedId === `link-${pc.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-center text-sm text-slate-600 font-medium">
                      {pc.registrationsCount}
                    </td>
                    <td className="py-3 px-5 text-center text-sm text-slate-600 font-medium">
                      {pc.paymentsCount}
                    </td>
                    <td className="py-3 px-5 text-sm text-slate-500">
                      {new Date(pc.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleDelete(pc.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {promoCodes.length > 0 && (
          <div className="px-5 py-2 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
            Показаны записи 1-{promoCodes.length} из {promoCodes.length}.
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600 leading-relaxed italic">
          Перешедший по вашей реферальной ссылке партнер, должен создать свой аккаунт в течение 30 дней, чтобы быть закрепленным за вами. Партнер не будет закреплен в случае, если создаст свой аккаунт после истечения 30 дней с момента перехода по ссылке или если будут очищены cookie-файлы в браузере.
        </p>
      </div>
    </div>
  );
};
