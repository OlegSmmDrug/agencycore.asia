import React, { useState, useEffect } from 'react';
import { Package, Check, Lock, Crown, Zap, ArrowRight, Shield, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrganization } from './OrganizationProvider';
import { moduleAccessService, ModuleAccess } from '../services/moduleAccessService';

const ModulesPage: React.FC = () => {
  const { organization } = useOrganization();
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [modulePrice, setModulePrice] = useState(5);
  const [planDisplayName, setPlanDisplayName] = useState('');
  const [planPrice, setPlanPrice] = useState(0);
  const [proPlanPrice, setProPlanPrice] = useState(25);

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    if (organization) {
      loadModules();
      loadCurrentPlanInfo();
    }
  }, [organization]);

  const loadPricing = async () => {
    try {
      const [moduleRes, proRes] = await Promise.all([
        supabase.from('platform_modules').select('price').eq('is_active', true).limit(1),
        supabase.from('subscription_plans').select('price_monthly').eq('name', 'PROFESSIONAL').maybeSingle(),
      ]);
      if (moduleRes.data?.[0]) setModulePrice(Number(moduleRes.data[0].price) || 5);
      if (proRes.data) setProPlanPrice(Number(proRes.data.price_monthly) || 25);
    } catch (err) {
      console.error('Error loading pricing:', err);
    }
  };

  const loadCurrentPlanInfo = async () => {
    if (!organization) return;
    const upperPlan = (organization.plan_name || 'Free').toUpperCase();
    try {
      const { data } = await supabase
        .from('subscription_plans')
        .select('display_name_ru, display_name, price_monthly')
        .eq('name', upperPlan)
        .maybeSingle();
      if (data) {
        setPlanDisplayName(data.display_name_ru || data.display_name || organization.plan_name || 'Free');
        setPlanPrice(Number(data.price_monthly) || 0);
      }
    } catch (err) {
      console.error('Error loading plan info:', err);
    }
  };

  const loadModules = async () => {
    if (!organization) return;

    setLoading(true);
    try {
      const data = await moduleAccessService.getOrganizationModules(
        organization.id,
        organization.plan_name || 'Free'
      );
      setModules(data);
    } catch (error) {
      console.error('Error loading modules:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Загрузка модулей...</div>
      </div>
    );
  }

  const availableModules = modules.filter(m => m.is_available);
  const lockedModules = modules.filter(m => !m.is_available);
  const hasAllModules = lockedModules.length === 0;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {hasAllModules && <Crown className="w-6 h-6 text-yellow-300" />}
                <h1 className="text-3xl font-bold">Ваш тариф: {planDisplayName || organization?.plan_name || 'Free'}</h1>
              </div>
              <p className="text-blue-100 text-lg">
                {hasAllModules
                  ? 'У вас доступны все модули платформы'
                  : 'Вы можете разблокировать дополнительные модули или улучшить тариф'
                }
              </p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold mb-1">${planPrice}</div>
              <div className="text-blue-100">в месяц</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{availableModules.length}</div>
                  <div className="text-blue-100 text-sm">Доступно модулей</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{lockedModules.length}</div>
                  <div className="text-blue-100 text-sm">Заблокировано</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{modules.length}</div>
                  <div className="text-blue-100 text-sm">Всего модулей</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {availableModules.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              Доступные модули
            </h2>
            <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              Активировано
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableModules.map((module) => (
              <div
                key={module.module_slug}
                className="bg-white border-2 border-green-200 rounded-2xl p-6 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="w-7 h-7 text-white" />
                  </div>
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{module.module_name}</h3>
                <p className="text-sm text-slate-600 mb-4">{module.module_description}</p>
                <div className="flex items-center gap-2 text-sm">
                  {module.is_unlocked ? (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                      Куплен отдельно (${modulePrice}/мес)
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                      Включен в тариф
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lockedModules.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              Дополнительные модули
            </h2>
            <div className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Требуют разблокировки
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  Разблокируйте больше возможностей
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Каждый модуль можно купить отдельно за ${modulePrice}/месяц, или улучшите тариф до Professional и получите все модули
                </p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200">
                    <DollarSign className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">${modulePrice} за модуль</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200">
                    <Crown className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-slate-700">Или ${proPlanPrice} за все</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lockedModules.map((module) => (
              <div
                key={module.module_slug}
                className="bg-white border-2 border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all relative group"
              >
                <div className="absolute top-4 right-4">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="w-7 h-7 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 pr-8">{module.module_name}</h3>
                <p className="text-sm text-slate-600 mb-6">{module.module_description}</p>
                <button className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 group">
                  <span>Разблокировать за ${modulePrice}/мес</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {lockedModules.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500 opacity-10 rounded-full -mr-48 -mt-48"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500 opacity-10 rounded-full -ml-32 -mb-32"></div>

          <div className="relative z-10 flex items-center gap-8">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-2xl">
              <Crown className="w-12 h-12 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold mb-3">Улучшите до Professional</h3>
              <p className="text-slate-300 text-lg mb-6">
                Получите доступ ко всем {modules.length} модулям платформы, безлимитным пользователям и VIP поддержке 24/7 всего за ${proPlanPrice}/месяц
              </p>
              <div className="flex items-center gap-4">
                <button className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 rounded-xl font-bold hover:from-yellow-500 hover:to-yellow-600 transition-all flex items-center gap-3 shadow-lg">
                  <span className="text-lg">Улучшить тариф</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="text-slate-400">
                  <div className="text-sm">Экономия до</div>
                  <div className="text-2xl font-bold text-white">${lockedModules.length * modulePrice - proPlanPrice}/мес</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulesPage;
