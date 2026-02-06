import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCard, Package, Calendar, Wallet } from 'lucide-react';
import BillingPlansTab, { SubscriptionPlan } from './admin/BillingPlansTab';
import BillingModulesTab, { PlatformModule } from './admin/BillingModulesTab';
import BillingPeriodsTab, { PeriodBonus } from './admin/BillingPeriodsTab';
import BillingBalanceTab from './admin/BillingBalanceTab';

interface Props {
  currentUserId: string;
}

type SubTab = 'plans' | 'modules' | 'periods' | 'balance';

const TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'plans', label: 'Тарифы', icon: <CreditCard className="w-4 h-4" /> },
  { key: 'modules', label: 'Модули', icon: <Package className="w-4 h-4" /> },
  { key: 'periods', label: 'Периоды', icon: <Calendar className="w-4 h-4" /> },
  { key: 'balance', label: 'Баланс', icon: <Wallet className="w-4 h-4" /> },
];

const SuperAdminBilling: React.FC<Props> = ({ currentUserId }) => {
  const [subTab, setSubTab] = useState<SubTab>('plans');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [periods, setPeriods] = useState<PeriodBonus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [plansRes, modulesRes, periodsRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('platform_modules').select('*').order('sort_order'),
        supabase.from('subscription_period_bonuses').select('*').order('sort_order'),
      ]);

      setPlans(
        (plansRes.data || []).map((p: any) => ({
          ...p,
          features_display: Array.isArray(p.features_display) ? p.features_display : JSON.parse(p.features_display || '[]'),
        }))
      );
      setModules(modulesRes.data || []);
      setPeriods(periodsRes.data || []);
    } catch (err) {
      console.error('Error loading billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              subTab === tab.key
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'plans' && <BillingPlansTab plans={plans} onReload={loadAll} />}
      {subTab === 'modules' && <BillingModulesTab modules={modules} onReload={loadAll} />}
      {subTab === 'periods' && <BillingPeriodsTab periods={periods} onReload={loadAll} />}
      {subTab === 'balance' && <BillingBalanceTab adminUserId={currentUserId} />}
    </div>
  );
};

export default SuperAdminBilling;
