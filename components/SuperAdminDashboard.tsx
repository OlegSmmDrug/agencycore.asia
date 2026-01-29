import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import { BarChart3, Users, TrendingUp, TrendingDown, DollarSign, Activity, Search, Building2, Plus, Edit, LogOut } from 'lucide-react';
import OrganizationEditModal from './OrganizationEditModal';

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

const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants'>('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

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
