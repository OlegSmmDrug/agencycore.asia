import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Zap, TrendingUp, DollarSign, Plus, Loader, Package, Lock, Crown, Users, Briefcase, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrganization } from './OrganizationProvider';
import { moduleAccessService, ModuleAccess } from '../services/moduleAccessService';
import { planLimitsService } from '../services/planLimitsService';

interface BillingSectionProps {
  userId: string;
}

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  displayName: string;
  description: string;
  priceMonthly: number;
  priceRu: number;
  maxUsers: number | null;
  maxProjects: number | null;
  features: PlanFeature[];
  isPopular?: boolean;
  upgradeNote?: string;
}

const BillingSection: React.FC<BillingSectionProps> = ({ userId }) => {
  const { organization } = useOrganization();
  const [currentPlan, setCurrentPlan] = useState<string>('FREE');
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [additionalUsers, setAdditionalUsers] = useState(0);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<'6months' | '9months' | '1year' | '2years'>('1year');
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'plans' | 'modules' | 'usage'>('plans');

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'FREE',
      displayName: 'Бесплатный',
      description: 'Для частных пользователей или стартовых команд',
      priceMonthly: 0,
      priceRu: 0,
      maxUsers: 2,
      maxProjects: 10,
      features: [
        { text: 'До 2 пользователей', included: true },
        { text: '10 проектов в работе', included: true },
        { text: 'Базовую CRM', included: true },
        { text: 'Модуль аналитики', included: false },
        { text: 'API интеграция', included: false },
      ],
      upgradeNote: 'Триггер для апгрейда: Приглашение 3-го пользователя'
    },
    {
      id: 'starter',
      name: 'STARTER',
      displayName: 'Стартовый',
      description: 'Для растущих команд и большей совместной работы',
      priceMonthly: 9,
      priceRu: 4050,
      maxUsers: 10,
      maxProjects: 100,
      features: [
        { text: 'Всё что в FREE тарифе', included: true },
        { text: '3-10 пользователей', included: true },
        { text: '100 проектов в работе', included: true },
        { text: 'Зарплатную ведомость', included: true },
        { text: 'API интеграция', included: false },
      ],
      isPopular: false
    },
    {
      id: 'professional',
      name: 'PROFESSIONAL',
      displayName: 'Профессиональный',
      description: 'Для растущих команд и большей совместной работы',
      priceMonthly: 25,
      priceRu: 11250,
      maxUsers: 25,
      maxProjects: null,
      features: [
        { text: 'Всё что в СТАРТОВОМ тарифе', included: true },
        { text: 'до 25 пользователей', included: true },
        { text: 'ERP модуль Аналитики', included: true },
        { text: 'Продвинутые готовые модули', included: true },
        { text: 'API интеграция', included: true },
      ],
      isPopular: true
    },
    {
      id: 'enterprise',
      name: 'ENTERPRISE',
      displayName: 'Enterprise',
      description: 'Для больших команд с индивидуальными потребностями',
      priceMonthly: 499,
      priceRu: 224550,
      maxUsers: null,
      maxProjects: null,
      features: [
        { text: 'Всё из Профессионального', included: true },
        { text: 'Неограниченное количество пользователей', included: true },
        { text: 'Приоритетная поддержка 24/7', included: true },
        { text: 'Выделенный менеджер', included: true },
        { text: 'Кастомная интеграция', included: true },
      ],
    }
  ];

  useEffect(() => {
    if (organization) {
      loadSubscriptionData();
      loadModules();
      loadUsageStats();
    }
  }, [organization?.id]);

  const loadSubscriptionData = async () => {
    if (!organization?.id) return;

    try {
      setCurrentPlan(organization.plan_name || 'Free');

      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (user) {
        setBalance(user.balance || 0);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const loadModules = async () => {
    if (!organization) return;

    try {
      const data = await moduleAccessService.getOrganizationModules(
        organization.id,
        organization.plan_name || 'Free'
      );
      setModules(data);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const loadUsageStats = async () => {
    if (!organization) return;

    try {
      const stats = await planLimitsService.getUsageStats(organization.plan_name || 'Free');
      setUsageStats(stats);
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  const handleSelectPlan = async (planName: string) => {
    if (!organization?.id) return;

    setIsLoading(true);
    try {
      const selectedPlan = plans.find(p => p.name === planName);
      if (!selectedPlan) return;

      const { error } = await supabase
        .from('organizations')
        .update({
          plan_name: planName,
          mrr: selectedPlan.priceRu,
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', organization.id);

      if (!error) {
        setCurrentPlan(planName);
        await loadModules();
        await loadUsageStats();
        alert('Тариф успешно изменен!');
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      alert('Ошибка при смене тарифа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Введите корректную сумму');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ balance: balance + amount })
        .eq('id', userId);

      if (!error) {
        setBalance(balance + amount);
        setTopUpAmount('');
        setShowTopUpModal(false);
        alert('Баланс успешно пополнен!');
      }
    } catch (error) {
      console.error('Error topping up balance:', error);
      alert('Ошибка при пополнении баланса');
    } finally {
      setIsLoading(false);
    }
  };

  const isPremium = currentPlan === 'Professional' || currentPlan === 'Enterprise';
  const availableModules = modules.filter(m => m.is_available);
  const lockedModules = modules.filter(m => !m.is_available);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2 mb-1">
              {isPremium && <Crown className="w-5 h-5 text-yellow-300" />}
              <h3 className="text-base sm:text-lg font-semibold">Текущий тариф</h3>
            </div>
            <p className="text-xl sm:text-2xl font-bold">{plans.find(p => p.name === currentPlan)?.displayName || 'Бесплатный'}</p>
          </div>
          <div className="w-full sm:w-auto sm:text-right">
            <h3 className="text-base sm:text-lg font-semibold mb-1">Баланс</h3>
            <p className="text-xl sm:text-2xl font-bold">{balance.toLocaleString()} ₸</p>
            <button
              onClick={() => setShowTopUpModal(true)}
              className="mt-2 w-full sm:w-auto bg-white text-blue-600 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Пополнить
            </button>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSection('plans')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeSection === 'plans'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Тарифы</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSection('modules')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeSection === 'modules'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span>Модули</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSection('usage')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeSection === 'usage'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Использование</span>
          </div>
        </button>
      </div>

      {/* Plans section */}
      {activeSection === 'plans' && (
        <div className="space-y-6">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Выберите тариф</h2>
            <p className="text-sm sm:text-base text-slate-600">Простая модель Freemium, разработанная для масштабирования вместе с клиентами</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border-2 p-4 sm:p-6 relative transition-all hover:shadow-lg ${
                  plan.isPopular
                    ? 'border-blue-500 shadow-lg'
                    : currentPlan === plan.name
                    ? 'border-green-500'
                    : 'border-slate-200'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">
                    ПОПУЛЯРНЫЙ
                  </div>
                )}

                {currentPlan === plan.name && (
                  <div className="absolute -top-2.5 right-2 sm:right-4 bg-green-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1">
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    Активен
                  </div>
                )}

                <div className="mb-3 sm:mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-1">{plan.displayName}</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mb-2 sm:mb-3">{plan.description}</p>
                </div>

                <div className="mb-3 sm:mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-slate-800">{plan.priceMonthly}$</span>
                    {plan.priceMonthly > 0 && (
                      <span className="text-slate-500 text-xs sm:text-sm">/ месяц</span>
                    )}
                  </div>
                  {plan.priceRu > 0 && (
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">{plan.priceRu.toLocaleString()} ₸ / месяц</p>
                  )}
                </div>

                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  <p className="text-xs sm:text-sm font-semibold text-slate-700">Включает:</p>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-xs sm:text-sm ${feature.included ? 'text-slate-700' : 'text-slate-400'}`}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                {plan.upgradeNote && (
                  <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">
                      <span className="font-semibold">Триггер для апгрейда:</span> {plan.upgradeNote.replace('Триггер для апгрейда: ', '')}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={isLoading || currentPlan === plan.name}
                  className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${
                    currentPlan === plan.name
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : plan.isPopular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isLoading ? (
                    <Loader className="w-5 h-5 animate-spin mx-auto" />
                  ) : currentPlan === plan.name ? (
                    'Текущий тариф'
                  ) : (
                    'Выбрать тариф'
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800">Дополнительные пользователи</h3>
                  <p className="text-xs sm:text-sm text-slate-500">3$ за пользователя в месяц</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Количество пользователей:
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAdditionalUsers(Math.max(0, additionalUsers - 1))}
                      disabled={additionalUsers === 0}
                      className="w-10 h-10 rounded-lg border-2 border-slate-300 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-xl font-semibold text-slate-600">&minus;</span>
                    </button>
                    <input
                      type="number"
                      value={additionalUsers}
                      onChange={(e) => setAdditionalUsers(Math.max(0, parseInt(e.target.value) || 0))}
                      className="flex-1 text-center text-2xl font-bold border-2 border-slate-200 rounded-lg py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                    />
                    <button
                      onClick={() => setAdditionalUsers(additionalUsers + 1)}
                      className="w-10 h-10 rounded-lg border-2 border-blue-500 bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
                    >
                      <span className="text-xl font-semibold">+</span>
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">Стоимость:</span>
                    <span className="text-lg font-bold text-blue-600">{additionalUsers * 3}$ / месяц</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">В тенге:</span>
                    <span className="text-lg font-bold text-blue-600">{(additionalUsers * 3 * 450).toLocaleString()} ₸ / месяц</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800">Период подписки</h3>
                  <p className="text-xs sm:text-sm text-slate-500">Получите бонусные месяцы</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { id: '6months', label: '6 месяцев', bonus: '+1 месяц в подарок', months: 6, bonusMonths: 1 },
                  { id: '9months', label: '9 месяцев', bonus: '+1 месяц в подарок', months: 9, bonusMonths: 1 },
                  { id: '1year', label: '1 год', bonus: '+2 месяца в подарок', months: 12, bonusMonths: 2 },
                  { id: '2years', label: '2 года', bonus: '+6 месяцев в подарок', months: 24, bonusMonths: 6 },
                ].map((period) => (
                  <button
                    key={period.id}
                    onClick={() => setSubscriptionPeriod(period.id as any)}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all ${
                      subscriptionPeriod === period.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            subscriptionPeriod === period.id
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-slate-300'
                          }`}>
                            {subscriptionPeriod === period.id && (
                              <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                            )}
                          </div>
                          <span className="font-semibold text-slate-800 text-sm sm:text-base">{period.label}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-blue-600 font-medium ml-7 mt-1">{period.bonus}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 bg-green-50 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Итого к оплате:</div>
                <div className="text-2xl font-bold text-green-600">
                  {(() => {
                    const periods: Record<string, { months: number; price: number }> = {
                      '6months': { months: 6, price: 6 },
                      '9months': { months: 9, price: 9 },
                      '1year': { months: 12, price: 12 },
                      '2years': { months: 24, price: 24 }
                    };
                    const selected = periods[subscriptionPeriod];
                    return `${selected.price * 10}$ за ${selected.months} мес.`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modules section */}
      {activeSection === 'modules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Модули платформы</h2>
              <p className="text-slate-600">Активировано модулей: {availableModules.length} / {modules.length}</p>
            </div>
          </div>

          {availableModules.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Доступные модули</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableModules.map((module) => (
                  <div
                    key={module.module_slug}
                    className="bg-white border-2 border-green-200 rounded-xl p-4 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-green-600" />
                      </div>
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-slate-800 mb-2">{module.module_name}</h4>
                    <p className="text-sm text-slate-600 mb-3">{module.module_description}</p>
                    {module.is_unlocked ? (
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        Куплен отдельно
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Включен в тариф
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {lockedModules.length > 0 && !isPremium && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Заблокированные модули</h3>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-orange-600" />
                  <p className="text-sm text-slate-700">
                    Разблокируйте больше модулей: по $5 за модуль или улучшите тариф до Professional ($25) и получите все модули
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lockedModules.map((module) => (
                  <div
                    key={module.module_slug}
                    className="bg-white border-2 border-slate-200 rounded-xl p-4 hover:shadow-lg transition-all relative"
                  >
                    <Lock className="absolute top-4 right-4 w-5 h-5 text-slate-400" />
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-3">
                      <Package className="w-6 h-6 text-slate-400" />
                    </div>
                    <h4 className="font-semibold text-slate-800 mb-2 pr-8">{module.module_name}</h4>
                    <p className="text-sm text-slate-600 mb-3">{module.module_description}</p>
                    <button className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                      Разблокировать за $5/мес
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage section */}
      {activeSection === 'usage' && usageStats && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Использование ресурсов</h2>
            <p className="text-slate-600">Текущее использование вашего тарифа</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Пользователи</h3>
                  <p className="text-sm text-slate-500">
                    {usageStats.users.current} из {usageStats.users.limit || '∞'}
                  </p>
                </div>
              </div>
              <div className="mb-2">
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      usageStats.users.percentage >= 90
                        ? 'bg-red-500'
                        : usageStats.users.percentage >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(usageStats.users.percentage, 100)}%` }}
                  />
                </div>
              </div>
              {usageStats.users.limit && usageStats.users.percentage >= 80 && (
                <div className="flex items-center gap-2 text-sm text-orange-600 mt-3">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Близко к лимиту. Рассмотрите улучшение тарифа.</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Проекты</h3>
                  <p className="text-sm text-slate-500">
                    {usageStats.projects.current} из {usageStats.projects.limit || '∞'}
                  </p>
                </div>
              </div>
              <div className="mb-2">
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      usageStats.projects.percentage >= 90
                        ? 'bg-red-500'
                        : usageStats.projects.percentage >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(usageStats.projects.percentage, 100)}%` }}
                  />
                </div>
              </div>
              {usageStats.projects.limit && usageStats.projects.percentage >= 80 && (
                <div className="flex items-center gap-2 text-sm text-orange-600 mt-3">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Близко к лимиту. Рассмотрите улучшение тарифа.</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-800 mb-3">Ограничения вашего тарифа</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-700">
                  Пользователей: {usageStats.users.limit || 'Без ограничений'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-700">
                  Проектов: {usageStats.projects.limit || 'Без ограничений'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-700">
                  Модулей доступно: {availableModules.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top up modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">Пополнить баланс</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Сумма пополнения (₸)
              </label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                placeholder="Введите сумму"
                min="0"
              />
              <div className="mt-3 grid grid-cols-2 sm:flex gap-2">
                {[1000, 5000, 10000, 50000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTopUpAmount(amount.toString())}
                    className="px-2 sm:px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    {amount.toLocaleString()} ₸
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount('');
                }}
                className="flex-1 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg text-sm sm:text-base font-medium hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleTopUp}
                disabled={isLoading || !topUpAmount || parseFloat(topUpAmount) <= 0}
                className="flex-1 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    Пополнить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingSection;
