import React, { useState, useEffect } from 'react';
import { X, Save, Building2, DollarSign, Users, Calendar, Lock, Unlock, Plus, Minus, Check, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ModuleAccess {
  module_slug: string;
  module_name: string;
  module_description: string;
  module_icon: string;
  is_available: boolean;
  is_unlocked: boolean;
  requires_unlock: boolean;
}

interface OrganizationEditModalProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    owner_email: string;
    plan_name: string | null;
    subscription_status: string | null;
    mrr: number;
    users_count: number;
    is_blocked: boolean;
    additional_users_count?: number;
    subscription_period?: string;
    subscription_end_date?: string;
  };
  onClose: () => void;
  onUpdate: () => void;
}

const OrganizationEditModal: React.FC<OrganizationEditModalProps> = ({ organization, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    plan_name: organization.plan_name || 'Free',
    subscription_status: organization.subscription_status || 'active',
    subscription_period: organization.subscription_period || '1year',
    additional_users_count: organization.additional_users_count || 0,
    is_blocked: organization.is_blocked || false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [unlockedModules, setUnlockedModules] = useState<Set<string>>(new Set());

  const plans = [
    { id: 'Free', name: 'Бесплатный', price: 0 },
    { id: 'Starter', name: 'Стартовый', price: 10 },
    { id: 'Professional', name: 'Профессионал', price: 25 },
    { id: 'Enterprise', name: 'Корпоративный', price: 50 },
  ];

  const statuses = [
    { id: 'active', name: 'Активен', color: 'bg-green-100 text-green-700' },
    { id: 'trial', name: 'Триал', color: 'bg-blue-100 text-blue-700' },
    { id: 'past_due', name: 'Ожидание оплаты', color: 'bg-orange-100 text-orange-700' },
    { id: 'canceled', name: 'Отменен', color: 'bg-red-100 text-red-700' },
    { id: 'trial_expired', name: 'Триал истек', color: 'bg-slate-100 text-slate-700' },
  ];

  const periods = [
    { id: '1month', name: '1 месяц', bonus: 0 },
    { id: '6months', name: '6 месяцев', bonus: 1 },
    { id: '9months', name: '9 месяцев', bonus: 1 },
    { id: '1year', name: '1 год', bonus: 2 },
    { id: '2years', name: '2 года', bonus: 6 },
  ];

  useEffect(() => {
    loadModules();
  }, [formData.plan_name]);

  const loadModules = async () => {
    try {
      const { data, error } = await supabase.rpc('get_organization_module_access', {
        org_id: organization.id,
        plan: formData.plan_name
      });
      if (error) throw error;
      setModules(data || []);

      const unlocked = new Set<string>();
      (data || []).forEach((m: ModuleAccess) => {
        if (m.is_unlocked) {
          unlocked.add(m.module_slug);
        }
      });
      setUnlockedModules(unlocked);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const toggleModule = (moduleSlug: string) => {
    setUnlockedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleSlug)) {
        newSet.delete(moduleSlug);
      } else {
        newSet.add(moduleSlug);
      }
      return newSet;
    });
  };

  const calculateMRR = () => {
    const selectedPlan = plans.find(p => p.id === formData.plan_name);
    const baseMRR = selectedPlan ? selectedPlan.price : 0;
    const additionalUsersMRR = formData.additional_users_count * 3;

    const unlockedModulesCount = formData.plan_name === 'Professional' || formData.plan_name === 'Enterprise'
      ? 0
      : unlockedModules.size;
    const modulesMRR = unlockedModulesCount * 5;

    return baseMRR + additionalUsersMRR + modulesMRR;
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const mrr = calculateMRR();
      const selectedPeriod = periods.find(p => p.id === formData.subscription_period);
      const bonusMonths = selectedPeriod?.bonus || 0;

      const { error: orgError } = await supabase
        .from('organizations')
        .update({
          plan_name: formData.plan_name,
          subscription_status: formData.subscription_status,
          subscription_period: formData.subscription_period,
          additional_users_count: formData.additional_users_count,
          bonus_months: bonusMonths,
          mrr: mrr,
          is_blocked: formData.is_blocked,
          updated_at: new Date().toISOString()
        })
        .eq('id', organization.id);

      if (orgError) throw orgError;

      for (const moduleSlug of unlockedModules) {
        const { error: moduleError } = await supabase
          .from('organization_modules')
          .upsert({
            organization_id: organization.id,
            module_slug: moduleSlug,
            is_unlocked: true,
            unlocked_at: new Date().toISOString()
          }, {
            onConflict: 'organization_id,module_slug'
          });
        if (moduleError) throw moduleError;
      }

      const modulesToLock = modules
        .filter(m => !unlockedModules.has(m.module_slug) && m.is_unlocked)
        .map(m => m.module_slug);

      for (const moduleSlug of modulesToLock) {
        const { error: lockError } = await supabase
          .from('organization_modules')
          .update({ is_unlocked: false })
          .eq('organization_id', organization.id)
          .eq('module_slug', moduleSlug);
        if (lockError) throw lockError;
      }

      setMessage({ type: 'success', text: 'Организация обновлена!' });
      setTimeout(() => {
        onUpdate();
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error updating organization:', error);
      setMessage({ type: 'error', text: 'Ошибка при обновлении' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Редактирование организации</h2>
              <p className="text-sm text-slate-500">{organization.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-xs text-slate-500 mb-1">Email владельца</p>
              <p className="text-sm font-medium text-slate-800">{organization.owner_email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Пользователей в системе</p>
              <p className="text-sm font-medium text-slate-800">{organization.users_count}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Тарифный план
            </label>
            <div className="grid grid-cols-2 gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setFormData(prev => ({ ...prev, plan_name: plan.id }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.plan_name === plan.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-800">{plan.name}</div>
                  <div className="text-sm text-slate-600 mt-1">${plan.price}/месяц</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Статус подписки
            </label>
            <div className="grid grid-cols-2 gap-3">
              {statuses.map((status) => (
                <button
                  key={status.id}
                  onClick={() => setFormData(prev => ({ ...prev, subscription_status: status.id }))}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    formData.subscription_status === status.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Период подписки
            </label>
            <div className="grid grid-cols-2 gap-3">
              {periods.map((period) => (
                <button
                  key={period.id}
                  onClick={() => setFormData(prev => ({ ...prev, subscription_period: period.id }))}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    formData.subscription_period === period.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-800">{period.name}</div>
                  {period.bonus > 0 && (
                    <div className="text-xs text-green-600 mt-1">+{period.bonus} мес. в подарок</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Дополнительные пользователи (3$ за пользователя)
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setFormData(prev => ({ ...prev, additional_users_count: Math.max(0, prev.additional_users_count - 1) }))}
                disabled={formData.additional_users_count === 0}
                className="w-12 h-12 rounded-lg border-2 border-slate-300 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold text-slate-800">{formData.additional_users_count}</div>
                <div className="text-sm text-slate-500 mt-1">Дополнительных пользователей</div>
              </div>
              <button
                onClick={() => setFormData(prev => ({ ...prev, additional_users_count: prev.additional_users_count + 1 }))}
                className="w-12 h-12 rounded-lg border-2 border-blue-500 bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">
                Доступные модули
              </label>
              {(formData.plan_name === 'Professional' || formData.plan_name === 'Enterprise') && (
                <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded-full">
                  Все модули включены
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {modules.map((module) => {
                const isAutoIncluded = formData.plan_name === 'Professional' || formData.plan_name === 'Enterprise';
                const isUnlocked = unlockedModules.has(module.module_slug);

                return (
                  <button
                    key={module.module_slug}
                    onClick={() => !isAutoIncluded && toggleModule(module.module_slug)}
                    disabled={isAutoIncluded}
                    className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                      isAutoIncluded || isUnlocked
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    } ${isAutoIncluded ? 'opacity-75' : ''}`}
                  >
                    {(isAutoIncluded || isUnlocked) && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="flex items-start gap-2 pr-6">
                      <Package className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{module.module_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{module.module_description}</div>
                        {!isAutoIncluded && (
                          <div className="text-xs text-blue-600 font-medium mt-1">$5/мес</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Базовый план:</span>
              <span className="text-lg font-bold text-slate-800">${plans.find(p => p.id === formData.plan_name)?.price || 0}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Дополнительные пользователи:</span>
              <span className="text-lg font-bold text-slate-800">${formData.additional_users_count * 3}</span>
            </div>
            {!(formData.plan_name === 'Professional' || formData.plan_name === 'Enterprise') && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Дополнительные модули ({unlockedModules.size}):</span>
                <span className="text-lg font-bold text-slate-800">${unlockedModules.size * 5}</span>
              </div>
            )}
            <div className="h-px bg-green-200 my-2"></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">Итого MRR:</span>
              <span className="text-2xl font-bold text-green-600">${calculateMRR()}</span>
            </div>
          </div>

          <div>
            <button
              onClick={() => setFormData(prev => ({ ...prev, is_blocked: !prev.is_blocked }))}
              className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                formData.is_blocked
                  ? 'border-red-500 bg-red-50'
                  : 'border-green-500 bg-green-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {formData.is_blocked ? (
                  <Lock className="w-5 h-5 text-red-600" />
                ) : (
                  <Unlock className="w-5 h-5 text-green-600" />
                )}
                <div>
                  <div className={`font-semibold ${formData.is_blocked ? 'text-red-700' : 'text-green-700'}`}>
                    {formData.is_blocked ? 'Организация заблокирована' : 'Организация активна'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {formData.is_blocked ? 'Пользователи не могут войти в систему' : 'Пользователи имеют полный доступ'}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>Сохранение...</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Сохранить изменения
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationEditModal;
