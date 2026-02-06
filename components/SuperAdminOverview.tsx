import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign, Users, Building2, TrendingUp, TrendingDown,
  FolderOpen, UserPlus, ArrowRight, Crown, Calendar, Briefcase,
  Activity, ChevronRight, Zap
} from 'lucide-react';

interface PlatformStats {
  total_mrr: number;
  active_users: number;
  total_organizations: number;
  active_organizations: number;
  new_organizations_last_month: number;
  churned_organizations_last_month: number;
  churn_rate: number;
}

interface OrgItem {
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
}

interface Props {
  currentUserId: string;
  onNavigateToTab: (tab: 'tenants' | 'affiliate' | 'system') => void;
}

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  'Free': { label: 'Бесплатный', color: 'text-slate-600', bg: 'bg-slate-100', bar: 'bg-slate-400' },
  'Starter': { label: 'Стартовый', color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500' },
  'Professional': { label: 'Профессионал', color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
  'Enterprise': { label: 'Корпоративный', color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500' },
};

const SuperAdminOverview: React.FC<Props> = ({ currentUserId, onNavigateToTab }) => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [organizations, setOrganizations] = useState<OrgItem[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUserId) loadData();
  }, [currentUserId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, orgsRes, projRes, clientRes] = await Promise.all([
        supabase.rpc('get_platform_statistics', { user_id: currentUserId }),
        supabase.rpc('get_organizations_list', {
          user_id: currentUserId,
          search_query: null,
          limit_count: 50,
          offset_count: 0
        }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      setOrganizations(orgsRes.data || []);
      setTotalProjects(projRes.count || 0);
      setTotalClients(clientRes.count || 0);
    } catch (error) {
      console.error('Error loading overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const netGrowth = stats.new_organizations_last_month - stats.churned_organizations_last_month;
  const arpu = stats.active_users > 0 ? Math.round(stats.total_mrr / stats.active_users) : 0;

  const recentOrgs = [...organizations]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const topOrgs = [...organizations]
    .filter(o => o.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 5);

  const planCounts: Record<string, number> = {};
  organizations.forEach(org => {
    const plan = org.plan_name || 'Free';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });
  const totalForPlans = organizations.length || 1;

  const formatRelativeDate = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    if (diff < 7) return `${diff} дн. назад`;
    if (diff < 30) return `${Math.floor(diff / 7)} нед. назад`;
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getPlanStyle = (planName: string | null) => {
    return PLAN_CONFIG[planName || 'Free'] || PLAN_CONFIG['Free'];
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="MRR"
          value={`$${stats.total_mrr.toLocaleString()}`}
          sublabel="Ежемесячный доход"
          icon={<DollarSign className="w-5 h-5" />}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="ARPU"
          value={`$${arpu}`}
          sublabel="Доход на пользователя"
          icon={<Crown className="w-5 h-5" />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Пользователи"
          value={stats.active_users.toLocaleString()}
          sublabel="Активных на платформе"
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Компании"
          value={`${stats.active_organizations}`}
          sublabel={`из ${stats.total_organizations} всего`}
          icon={<Building2 className="w-5 h-5" />}
          iconBg="bg-sky-100"
          iconColor="text-sky-600"
        />
        <StatCard
          label="Проекты"
          value={totalProjects.toLocaleString()}
          sublabel="На всей платформе"
          icon={<FolderOpen className="w-5 h-5" />}
          iconBg="bg-teal-100"
          iconColor="text-teal-600"
        />
        <StatCard
          label="Клиенты"
          value={totalClients.toLocaleString()}
          sublabel="На всей платформе"
          icon={<Briefcase className="w-5 h-5" />}
          iconBg="bg-rose-100"
          iconColor="text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-5">Рост за месяц</h3>
          <div className="space-y-5">
            <GrowthRow
              label="Новые компании"
              value={`+${stats.new_organizations_last_month}`}
              icon={<UserPlus className="w-4 h-4 text-emerald-600" />}
              valueColor="text-emerald-600"
            />
            <GrowthRow
              label="Отток компаний"
              value={`-${stats.churned_organizations_last_month}`}
              icon={<TrendingDown className="w-4 h-4 text-red-500" />}
              valueColor="text-red-500"
            />
            <div className="border-t border-slate-100 pt-4">
              <GrowthRow
                label="Чистый рост"
                value={netGrowth >= 0 ? `+${netGrowth}` : `${netGrowth}`}
                icon={netGrowth >= 0
                  ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                  : <TrendingDown className="w-4 h-4 text-red-500" />
                }
                valueColor={netGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}
                bold
              />
            </div>
            <div className="border-t border-slate-100 pt-4">
              <GrowthRow
                label="Churn rate"
                value={`${stats.churn_rate}%`}
                icon={<Activity className="w-4 h-4 text-slate-500" />}
                valueColor={stats.churn_rate > 5 ? 'text-red-500' : stats.churn_rate > 2 ? 'text-amber-500' : 'text-emerald-600'}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-5">Распределение планов</h3>
          <div className="space-y-4">
            {Object.entries(PLAN_CONFIG).map(([key, config]) => {
              const count = planCounts[key] || 0;
              const pct = Math.round((count / totalForPlans) * 100);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                    <span className="text-sm font-bold text-slate-700">{count} <span className="text-xs font-normal text-slate-400">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.bar} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Всего компаний</span>
            <span className="text-sm font-bold text-slate-700">{organizations.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-5">Быстрые действия</h3>
          <div className="space-y-2">
            <QuickAction
              label="Управление компаниями"
              description={`${stats.total_organizations} компаний`}
              icon={<Building2 className="w-4 h-4" />}
              onClick={() => onNavigateToTab('tenants')}
            />
            <QuickAction
              label="Партнерская программа"
              description="Промокоды и рефералы"
              icon={<Zap className="w-4 h-4" />}
              onClick={() => onNavigateToTab('affiliate')}
            />
            <QuickAction
              label="Мониторинг системы"
              description="База данных и нагрузка"
              icon={<Activity className="w-4 h-4" />}
              onClick={() => onNavigateToTab('system')}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Новые компании</h3>
            <button
              onClick={() => onNavigateToTab('tenants')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Все <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {recentOrgs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Нет данных</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentOrgs.map((org) => {
                const plan = getPlanStyle(org.plan_name);
                return (
                  <div key={org.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{org.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${plan.bg} ${plan.color}`}>
                          {plan.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400">{org.users_count} польз.</span>
                        <span className="text-xs text-slate-400">{org.projects_count} проект.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
                      <Calendar className="w-3 h-3" />
                      {formatRelativeDate(org.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Топ по выручке</h3>
            <button
              onClick={() => onNavigateToTab('tenants')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Все <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {topOrgs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Нет платящих компаний</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {topOrgs.map((org, idx) => {
                const plan = getPlanStyle(org.plan_name);
                return (
                  <div key={org.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-slate-200 text-slate-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{org.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${plan.bg} ${plan.color}`}>
                          {plan.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400">{org.users_count} польз.</span>
                        <span className="text-xs text-slate-400">{org.projects_count} проект.</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 flex-shrink-0">
                      ${org.mrr.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function StatCard({ label, value, sublabel, icon, iconBg, iconColor }: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>{icon}</div>
      </div>
      <h3 className="text-2xl font-bold text-slate-800 mb-0.5">{value}</h3>
      <p className="text-xs text-slate-400">{sublabel}</p>
    </div>
  );
}

function GrowthRow({ label, value, icon, valueColor, bold }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueColor: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-slate-50 rounded-lg">{icon}</div>
        <span className={`text-sm text-slate-600 ${bold ? 'font-semibold' : ''}`}>{label}</span>
      </div>
      <span className={`text-lg font-bold ${valueColor}`}>{value}</span>
    </div>
  );
}

function QuickAction({ label, description, icon, onClick }: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
    >
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-700 block">{label}</span>
        <span className="text-xs text-slate-400">{description}</span>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
    </button>
  );
}

export default SuperAdminOverview;
