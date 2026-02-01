import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, Cell, PieChart, Pie
} from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, FileText, Target, Calendar, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MonthlyMetrics {
  month: string;
  new_projects: number;
  active_projects: number;
  new_clients: number;
  won_clients: number;
  publications: number;
  income: number;
  expenses: number;
  tasks_completed: number;
  team_size: number;
  avg_project_budget: number;
}

interface CorrelationData {
  metric1: string;
  metric2: string;
  correlation: number;
  insight: string;
}

interface UnifiedAnalyticsProps {
  organizationId: string;
}

const UnifiedAnalytics: React.FC<UnifiedAnalyticsProps> = ({ organizationId }) => {
  const [monthlyData, setMonthlyData] = useState<MonthlyMetrics[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('3m');
  const [activeView, setActiveView] = useState<'overview' | 'growth' | 'efficiency' | 'correlations'>('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, [organizationId, selectedPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const periodMonths = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : selectedPeriod === '12m' ? 12 : 24;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - periodMonths);

      const { data, error } = await supabase.rpc('get_unified_analytics', {
        p_organization_id: organizationId,
        p_start_date: startDate.toISOString().split('T')[0]
      });

      if (error) {
        console.error('Analytics query error:', error);
        await loadFallbackData();
      } else if (data) {
        setMonthlyData(data);
        calculateCorrelations(data);
      }
    } catch (err) {
      console.error('Analytics load error:', err);
      await loadFallbackData();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackData = async () => {
    const { data: monthlyStats } = await supabase.rpc('get_monthly_stats_fallback', {
      p_organization_id: organizationId
    });
    if (monthlyStats) {
      setMonthlyData(monthlyStats);
      calculateCorrelations(monthlyStats);
    }
  };

  const calculateCorrelations = (data: MonthlyMetrics[]) => {
    if (data.length < 2) return;

    const correlationPairs: CorrelationData[] = [
      {
        metric1: 'new_clients',
        metric2: 'new_projects',
        correlation: calculatePearson(data.map(d => d.new_clients), data.map(d => d.new_projects)),
        insight: 'Связь между привлечением клиентов и запуском проектов'
      },
      {
        metric1: 'publications',
        metric2: 'income',
        correlation: calculatePearson(data.map(d => d.publications), data.map(d => d.income)),
        insight: 'Влияние контент-активности на доход'
      },
      {
        metric1: 'team_size',
        metric2: 'active_projects',
        correlation: calculatePearson(data.map(d => d.team_size), data.map(d => d.active_projects)),
        insight: 'Соотношение команды и активных проектов'
      },
      {
        metric1: 'new_projects',
        metric2: 'income',
        correlation: calculatePearson(data.map(d => d.new_projects), data.map(d => d.income)),
        insight: 'Как новые проекты влияют на выручку'
      }
    ];

    setCorrelations(correlationPairs.filter(c => !isNaN(c.correlation)));
  };

  const calculatePearson = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  };

  const kpiCards = useMemo(() => {
    if (monthlyData.length === 0) return [];

    const latest = monthlyData[monthlyData.length - 1];
    const previous = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : latest;

    const calculateGrowth = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return ((current - prev) / prev) * 100;
    };

    return [
      {
        title: 'Новые проекты',
        value: latest.new_projects,
        growth: calculateGrowth(latest.new_projects, previous.new_projects),
        icon: FileText,
        color: 'bg-blue-500'
      },
      {
        title: 'Выручка',
        value: `${(latest.income / 1000000).toFixed(1)}M ₸`,
        growth: calculateGrowth(latest.income, previous.income),
        icon: DollarSign,
        color: 'bg-green-500'
      },
      {
        title: 'Публикации',
        value: latest.publications,
        growth: calculateGrowth(latest.publications, previous.publications),
        icon: Target,
        color: 'bg-purple-500'
      },
      {
        title: 'Клиенты',
        value: latest.new_clients,
        growth: calculateGrowth(latest.new_clients, previous.new_clients),
        icon: Users,
        color: 'bg-orange-500'
      }
    ];
  }, [monthlyData]);

  const chartData = useMemo(() => {
    return monthlyData.map(d => ({
      month: new Date(d.month).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      'Проекты': d.new_projects,
      'Клиенты': d.new_clients,
      'Контент': d.publications,
      'Доход (тыс ₸)': d.income / 1000,
      'Конверсия %': d.new_clients > 0 ? (d.won_clients / d.new_clients * 100) : 0,
      'Прибыль (тыс ₸)': (d.income - d.expenses) / 1000
    }));
  }, [monthlyData]);

  const efficiencyMetrics = useMemo(() => {
    if (monthlyData.length === 0) return [];

    return monthlyData.map(d => ({
      month: new Date(d.month).toLocaleDateString('ru-RU', { month: 'short' }),
      'Проектов на человека': d.team_size > 0 ? (d.active_projects / d.team_size).toFixed(2) : 0,
      'Контент на проект': d.active_projects > 0 ? (d.publications / d.active_projects).toFixed(1) : 0,
      'Доход на сотрудника': d.team_size > 0 ? (d.income / d.team_size / 1000).toFixed(0) : 0
    }));
  }, [monthlyData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">Загрузка аналитики...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            Унифицированная Аналитика
          </h2>
          <p className="text-gray-400 mt-1">Связи между блоками системы в динамике</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
          >
            <option value="3m">3 месяца</option>
            <option value="6m">6 месяцев</option>
            <option value="12m">12 месяцев</option>
            <option value="all">Все время</option>
          </select>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {[
          { id: 'overview', label: 'Обзор', icon: Target },
          { id: 'growth', label: 'Рост', icon: TrendingUp },
          { id: 'efficiency', label: 'Эффективность', icon: Users },
          { id: 'correlations', label: 'Связи', icon: Link2 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeView === tab.id
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <div key={idx} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                card.growth >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {card.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(card.growth).toFixed(1)}%
              </div>
            </div>
            <div className="text-gray-400 text-sm mb-1">{card.title}</div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Динамика ключевых метрик</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="Проекты" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="Клиенты" stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="Контент" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Финансовая динамика</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="Доход (тыс ₸)" fill="#10b981" />
                <Line type="monotone" dataKey="Прибыль (тыс ₸)" stroke="#22c55e" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'growth' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Рост клиентской базы</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="Клиенты" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.6} />
                <Area type="monotone" dataKey="Проекты" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Конверсия и выручка</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis yAxisId="left" stroke="#9ca3af" />
                <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Доход (тыс ₸)" fill="#10b981" />
                <Line yAxisId="right" type="monotone" dataKey="Конверсия %" stroke="#ef4444" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'efficiency' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Эффективность команды</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={efficiencyMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="Проектов на человека" fill="#3b82f6" />
                <Line type="monotone" dataKey="Контент на проект" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="Доход на сотрудника" stroke="#10b981" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'correlations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {correlations.map((corr, idx) => (
              <div key={idx} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Корреляция</h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    Math.abs(corr.correlation) > 0.7 ? 'bg-green-500/20 text-green-400' :
                    Math.abs(corr.correlation) > 0.4 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {(corr.correlation * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-gray-400 mb-2">
                  <span className="text-blue-400 font-medium">{corr.metric1}</span>
                  {' ↔ '}
                  <span className="text-purple-400 font-medium">{corr.metric2}</span>
                </div>
                <p className="text-sm text-gray-500">{corr.insight}</p>
                <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      Math.abs(corr.correlation) > 0.7 ? 'bg-green-500' :
                      Math.abs(corr.correlation) > 0.4 ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${Math.abs(corr.correlation) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedAnalytics;
