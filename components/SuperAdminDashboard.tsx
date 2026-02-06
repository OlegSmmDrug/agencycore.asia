import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import { BarChart3, Users, TrendingUp, TrendingDown, DollarSign, Activity, Search, Building2, Plus, Edit, LogOut, Gift, Link2, UserCheck, Clock, CheckCircle, Ban, Trash2, Server } from 'lucide-react';
import OrganizationEditModal from './OrganizationEditModal';
import SystemMetricsPanel from './SystemMetricsPanel';

interface PlatformStats {
  total_mrr: number;
  active_users: number;
  total_organizations: number;
  active_organizations: number;
  new_organizations_last_month: number;
  churned_organizations_last_month: number;
  churn_rate: number;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan_name: string | null;
  subscription_status: string | null;
  mrr: number;
  users_count: number;
  projects_count: number;
  is_blocked: boolean;
  created_at: string;
  additional_users_count?: number;
  subscription_period?: string;
  subscription_end_date?: string;
}

interface AffiliatePromoCode {
  id: string;
  code: string;
  org_name: string;
  user_name: string;
  registrations_count: number;
  payments_count: number;
  is_active: boolean;
  created_at: string;
}

interface AffiliateReferral {
  id: string;
  referrer_org_name: string;
  referred_org_name: string;
  level: number;
  is_active: boolean;
  created_at: string;
}

interface AffiliatePayout {
  id: string;
  user_name: string;
  org_name: string;
  amount: number;
  status: string;
  bank_details: string;
  requested_at: string;
  processed_at: string | null;
}

interface AffiliateAdminStats {
  totalPromoCodes: number;
  totalReferrals: number;
  activeReferrals: number;
  pendingPayouts: number;
  totalCommissions: number;
}

const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'affiliate' | 'system'>('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  const [affPromoCodes, setAffPromoCodes] = useState<AffiliatePromoCode[]>([]);
  const [affReferrals, setAffReferrals] = useState<AffiliateReferral[]>([]);
  const [affPayouts, setAffPayouts] = useState<AffiliatePayout[]>([]);
  const [affStats, setAffStats] = useState<AffiliateAdminStats>({ totalPromoCodes: 0, totalReferrals: 0, activeReferrals: 0, pendingPayouts: 0, totalCommissions: 0 });
  const [affLoading, setAffLoading] = useState(false);
  const [affSubTab, setAffSubTab] = useState<'codes' | 'referrals' | 'payouts'>('codes');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadPlatformStats();
      if (activeTab === 'tenants') {
        loadOrganizations();
      }
      if (activeTab === 'affiliate') {
        loadAffiliateData();
      }
    }
  }, [activeTab, currentUserId]);

  const loadPlatformStats = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase.rpc('get_platform_statistics', {
        user_id: currentUserId
      });
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Error loading platform stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_organizations_list', {
        user_id: currentUserId,
        search_query: searchQuery || null,
        limit_count: 50,
        offset_count: 0
      });
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAffiliateData = async () => {
    setAffLoading(true);
    try {
      const { data: codes } = await supabase
        .from('promo_codes')
        .select('*, users!promo_codes_user_id_fkey(name), organizations!promo_codes_organization_id_fkey(name)')
        .order('created_at', { ascending: false });

      const mappedCodes: AffiliatePromoCode[] = (codes || []).map((c: any) => ({
        id: c.id,
        code: c.code,
        org_name: c.organizations?.name || '-',
        user_name: c.users?.name || '-',
        registrations_count: c.registrations_count || 0,
        payments_count: c.payments_count || 0,
        is_active: c.is_active,
        created_at: c.created_at,
      }));
      setAffPromoCodes(mappedCodes);

      const { data: regs } = await supabase
        .from('referral_registrations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const regOrgIds = [...new Set((regs || []).flatMap((r: any) => [r.referrer_org_id, r.referred_org_id]))];
      const orgMap: Record<string, string> = {};
      if (regOrgIds.length > 0) {
        const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', regOrgIds);
        (orgs || []).forEach((o: any) => { orgMap[o.id] = o.name; });
      }

      const mappedRefs: AffiliateReferral[] = (regs || []).map((r: any) => ({
        id: r.id,
        referrer_org_name: orgMap[r.referrer_org_id] || '-',
        referred_org_name: orgMap[r.referred_org_id] || '-',
        level: r.level,
        is_active: r.is_active,
        created_at: r.created_at,
      }));
      setAffReferrals(mappedRefs);

      const { data: payouts } = await supabase
        .from('referral_payouts')
        .select('*, users!referral_payouts_user_id_fkey(name), organizations!referral_payouts_organization_id_fkey(name)')
        .order('requested_at', { ascending: false });

      const mappedPayouts: AffiliatePayout[] = (payouts || []).map((p: any) => ({
        id: p.id,
        user_name: p.users?.name || '-',
        org_name: p.organizations?.name || '-',
        amount: Number(p.amount),
        status: p.status,
        bank_details: p.bank_details || '',
        requested_at: p.requested_at,
        processed_at: p.processed_at,
      }));
      setAffPayouts(mappedPayouts);

      const { count: totalCodes } = await supabase.from('promo_codes').select('id', { count: 'exact', head: true });
      const { count: totalRefs } = await supabase.from('referral_registrations').select('id', { count: 'exact', head: true }).eq('level', 1);
      const { count: activeRefs } = await supabase.from('referral_registrations').select('id', { count: 'exact', head: true }).eq('level', 1).eq('is_active', true);
      const { count: pendingPay } = await supabase.from('referral_payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      const { data: commData } = await supabase.from('referral_transactions').select('commission_amount');
      const totalComm = (commData || []).reduce((s: number, t: any) => s + Number(t.commission_amount), 0);

      setAffStats({
        totalPromoCodes: totalCodes || 0,
        totalReferrals: totalRefs || 0,
        activeReferrals: activeRefs || 0,
        pendingPayouts: pendingPay || 0,
        totalCommissions: totalComm,
      });
    } catch (err) {
      console.error('Error loading affiliate data:', err);
    } finally {
      setAffLoading(false);
    }
  };

  const handlePayoutAction = async (payoutId: string, action: 'paid' | 'rejected') => {
    await supabase
      .from('referral_payouts')
      .update({ status: action, processed_at: new Date().toISOString() })
      .eq('id', payoutId);
    loadAffiliateData();
  };

  const handleDeletePromoCode = async (id: string) => {
    if (!confirm('Удалить промокод?')) return;
    await supabase.from('promo_codes').delete().eq('id', id);
    loadAffiliateData();
  };

  const handleTogglePromoCode = async (id: string, currentActive: boolean) => {
    await supabase.from('promo_codes').update({ is_active: !currentActive }).eq('id', id);
    loadAffiliateData();
  };

  const handleSearch = () => {
    loadOrganizations();
  };

  const handleLogout = async () => {
    await authService.signOut();
    window.location.reload();
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">Нет подписки</span>;

    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      'active': { bg: 'bg-green-100', text: 'text-green-700', label: 'Активен' },
      'trial': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Триал' },
      'past_due': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Ожидание' },
      'canceled': { bg: 'bg-red-100', text: 'text-red-700', label: 'Заблокирован' },
      'trial_expired': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Триал истек' }
    };

    const config = statusConfig[status] || statusConfig['active'];
    return (
      <span className={`px-2 py-1 text-xs rounded-full font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getPlanBadge = (planName: string | null) => {
    if (!planName) return <span className="px-3 py-1 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">Бесплатный</span>;

    const planConfig: Record<string, { bg: string; text: string; displayName: string }> = {
      'Free': { bg: 'bg-slate-100', text: 'text-slate-600', displayName: 'Бесплатный' },
      'Starter': { bg: 'bg-blue-100', text: 'text-blue-600', displayName: 'Стартовый' },
      'Professional': { bg: 'bg-green-100', text: 'text-green-600', displayName: 'Профессионал' },
      'Enterprise': { bg: 'bg-orange-100', text: 'text-orange-600', displayName: 'Корпоративный' }
    };

    const config = planConfig[planName] || planConfig['Free'];
    return (
      <span className={`px-3 py-1 text-xs rounded-full font-medium ${config.bg} ${config.text}`}>
        {config.displayName}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Панель супер-администратора</h2>
            <p className="text-sm text-slate-500 mt-1">Мониторинг платформы и управление компаниями</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Обзор
            </div>
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'tenants'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Компании
            </div>
          </button>
          <button
            onClick={() => setActiveTab('affiliate')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'affiliate'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Партнерская программа
            </div>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'system'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Система
            </div>
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {stats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Общий MRR</p>
                        <h3 className="text-2xl font-bold text-slate-800">${stats.total_mrr.toLocaleString()}</h3>
                      </div>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Ежемесячный доход</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Активные пользователи</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.active_users.toLocaleString()}</h3>
                      </div>
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Всего пользователей</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Компании</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.active_organizations}/{stats.total_organizations}</h3>
                      </div>
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Building2 className="w-5 h-5 text-orange-600" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Активных из общего числа</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Отток</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.churn_rate}%</h3>
                      </div>
                      <div className="p-2 bg-red-100 rounded-lg">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Churn rate за месяц</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Статистика платформы</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between py-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-sm text-slate-600">Новых компаний за месяц</span>
                      </div>
                      <span className="text-lg font-bold text-slate-800">+{stats.new_organizations_last_month}</span>
                    </div>

                    <div className="flex items-center justify-between py-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-sm text-slate-600">Отток за месяц</span>
                      </div>
                      <span className="text-lg font-bold text-slate-800">-{stats.churned_organizations_last_month}</span>
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <Activity className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-sm text-slate-600">Здоровье системы</span>
                      </div>
                      <span className="text-lg font-bold text-emerald-600">99.98%</span>
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <DollarSign className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm text-slate-600">Средний доход на пользователя</span>
                      </div>
                      <span className="text-lg font-bold text-slate-800">$17.50</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Нет данных</h3>
                  <p className="text-slate-600">
                    Статистика появится после создания первых компаний и пользователей в системе.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Поиск по названию компании или email..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Создать компанию
                </div>
              </button>
            </div>

            {organizations.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">Название</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">Владелец</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">План</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">Статус</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">MRR</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">Пользователи</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">Проекты</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600">Создано</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {organizations.map((org) => (
                        <tr key={org.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{org.name}</div>
                            <div className="text-xs text-slate-500">{org.slug}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{org.owner_email}</td>
                          <td className="px-6 py-4">
                            {getPlanBadge(org.plan_name)}
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(org.subscription_status)}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">${org.mrr.toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{org.users_count}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{org.projects_count}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(org.created_at).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedOrganization(org)}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Нет компаний</h3>
                  <p className="text-slate-600 mb-6">
                    В системе пока нет зарегистрированных компаний. Создайте первую компанию, чтобы начать работу.
                  </p>
                  <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Создать компанию
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'affiliate' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Промокодов</p>
                    <h3 className="text-2xl font-bold text-slate-800">{affStats.totalPromoCodes}</h3>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg"><Link2 className="w-4 h-4 text-blue-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Всего рефералов</p>
                    <h3 className="text-2xl font-bold text-slate-800">{affStats.totalReferrals}</h3>
                  </div>
                  <div className="p-2 bg-emerald-100 rounded-lg"><Users className="w-4 h-4 text-emerald-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Активных рефералов</p>
                    <h3 className="text-2xl font-bold text-slate-800">{affStats.activeReferrals}</h3>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg"><UserCheck className="w-4 h-4 text-green-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Заявок на вывод</p>
                    <h3 className="text-2xl font-bold text-slate-800">{affStats.pendingPayouts}</h3>
                  </div>
                  <div className="p-2 bg-amber-100 rounded-lg"><Clock className="w-4 h-4 text-amber-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Всего комиссий</p>
                    <h3 className="text-2xl font-bold text-slate-800">{affStats.totalCommissions.toLocaleString('ru-RU')} тг</h3>
                  </div>
                  <div className="p-2 bg-teal-100 rounded-lg"><DollarSign className="w-4 h-4 text-teal-600" /></div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {(['codes', 'referrals', 'payouts'] as const).map((tab) => {
                const labels = { codes: 'Промокоды', referrals: 'Рефералы', payouts: 'Выплаты' };
                return (
                  <button
                    key={tab}
                    onClick={() => setAffSubTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      affSubTab === tab ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {affLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {affSubTab === 'codes' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Код</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Организация</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Владелец</th>
                            <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Регистрации</th>
                            <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Оплаты</th>
                            <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Статус</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Создан</th>
                            <th className="px-5 py-3 w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {affPromoCodes.length === 0 ? (
                            <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">Промокодов пока нет</td></tr>
                          ) : (
                            affPromoCodes.map((pc) => (
                              <tr key={pc.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-5 py-3 font-mono text-sm font-semibold text-slate-800">{pc.code}</td>
                                <td className="px-5 py-3 text-sm text-slate-600">{pc.org_name}</td>
                                <td className="px-5 py-3 text-sm text-slate-600">{pc.user_name}</td>
                                <td className="px-5 py-3 text-center text-sm font-medium text-slate-800">{pc.registrations_count}</td>
                                <td className="px-5 py-3 text-center text-sm font-medium text-slate-800">{pc.payments_count}</td>
                                <td className="px-5 py-3 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {pc.is_active ? 'Активен' : 'Отключен'}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-500">{new Date(pc.created_at).toLocaleDateString('ru-RU')}</td>
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleTogglePromoCode(pc.id, pc.is_active)}
                                      className={`p-1.5 rounded-lg transition-colors ${pc.is_active ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-green-50 text-green-500'}`}
                                      title={pc.is_active ? 'Отключить' : 'Включить'}
                                    >
                                      {pc.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={() => handleDeletePromoCode(pc.id)}
                                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                                      title="Удалить"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {affSubTab === 'referrals' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Реферер (кто привел)</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Реферал (кого привели)</th>
                            <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Уровень</th>
                            <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Статус</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Дата</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affReferrals.length === 0 ? (
                            <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">Рефералов пока нет</td></tr>
                          ) : (
                            affReferrals.map((ref) => (
                              <tr key={ref.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-5 py-3 text-sm font-medium text-slate-800">{ref.referrer_org_name}</td>
                                <td className="px-5 py-3 text-sm text-slate-600">{ref.referred_org_name}</td>
                                <td className="px-5 py-3 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    ref.level === 1 ? 'bg-blue-100 text-blue-700' :
                                    ref.level === 2 ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {ref.level}-й уровень
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ref.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {ref.is_active ? 'Активен' : 'Неактивен'}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-500">{new Date(ref.created_at).toLocaleDateString('ru-RU')}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {affSubTab === 'payouts' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Пользователь</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Организация</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Сумма</th>
                            <th className="px-5 py-3 text-center text-xs font-medium text-slate-600">Статус</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Реквизиты</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-slate-600">Дата заявки</th>
                            <th className="px-5 py-3 w-28"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {affPayouts.length === 0 ? (
                            <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">Заявок на выплату пока нет</td></tr>
                          ) : (
                            affPayouts.map((p) => (
                              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-5 py-3 text-sm font-medium text-slate-800">{p.user_name}</td>
                                <td className="px-5 py-3 text-sm text-slate-600">{p.org_name}</td>
                                <td className="px-5 py-3 text-sm font-semibold text-slate-800">{p.amount.toLocaleString('ru-RU')} тг</td>
                                <td className="px-5 py-3 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    p.status === 'paid' ? 'bg-green-100 text-green-700' :
                                    p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    p.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {p.status === 'paid' ? 'Выплачено' :
                                     p.status === 'rejected' ? 'Отклонено' :
                                     p.status === 'processing' ? 'В обработке' :
                                     'Ожидание'}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate">{p.bank_details || '-'}</td>
                                <td className="px-5 py-3 text-sm text-slate-500">{new Date(p.requested_at).toLocaleDateString('ru-RU')}</td>
                                <td className="px-5 py-3">
                                  {p.status === 'pending' && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handlePayoutAction(p.id, 'paid')}
                                        className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors font-medium"
                                      >
                                        Выплатить
                                      </button>
                                      <button
                                        onClick={() => handlePayoutAction(p.id, 'rejected')}
                                        className="px-2.5 py-1 bg-red-100 text-red-600 text-xs rounded-lg hover:bg-red-200 transition-colors font-medium"
                                      >
                                        Отклонить
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'system' && <SystemMetricsPanel />}
      </div>

      {selectedOrganization && (
        <OrganizationEditModal
          organization={selectedOrganization}
          onClose={() => setSelectedOrganization(null)}
          onUpdate={() => {
            loadOrganizations();
            loadPlatformStats();
          }}
        />
      )}
    </div>
  );
};

export default SuperAdminDashboard;
