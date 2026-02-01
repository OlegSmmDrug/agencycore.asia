import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Calendar,
  ArrowUp,
  ArrowDown,
  Briefcase,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { unifiedAnalyticsService, MonthlyAnalytics } from '../services/unifiedAnalyticsService';
import { useOrganization } from './OrganizationProvider';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  iconColor: string;
  format?: 'currency' | 'number' | 'percentage';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  iconColor,
  format = 'number',
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;

    if (format === 'currency') {
      return `${val.toLocaleString()} ₸`;
    } else if (format === 'percentage') {
      return `${val.toFixed(1)}%`;
    } else {
      return val.toLocaleString();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-600 font-medium">{title}</span>
        <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-2">{formatValue(value)}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {change >= 0 ? (
            <ArrowUp className="w-4 h-4 text-green-600" />
          ) : (
            <ArrowDown className="w-4 h-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.abs(change).toFixed(1)}% vs прошлый период
          </span>
        </div>
      )}
    </div>
  );
};

export const UnifiedAnalyticsDashboard: React.FC = () => {
  const { organization } = useOrganization();
  const [monthlyData, setMonthlyData] = useState<MonthlyAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>(
    'month'
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (organization?.id) {
      loadAnalytics();
    }
  }, [organization?.id, selectedMonth, selectedPeriod]);

  const loadAnalytics = async () => {
    if (!organization?.id) return;

    try {
      setIsLoading(true);
      const startDate = calculateStartDate();
      const data = await unifiedAnalyticsService.getMonthlyAnalytics(
        organization.id,
        startDate
      );
      setMonthlyData(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStartDate = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'month':
        return `${selectedMonth}-01`;
      case 'quarter': {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return quarterStart.toISOString().split('T')[0];
      }
      case 'year':
        return `${now.getFullYear()}-01-01`;
      case 'all':
        return '2020-01-01';
      default:
        return `${selectedMonth}-01`;
    }
  };

  const filteredData = useMemo(() => {
    if (selectedPeriod === 'month') {
      return monthlyData.filter((d) => d.month.startsWith(selectedMonth));
    } else if (selectedPeriod === 'quarter') {
      const now = new Date();
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      const quarterMonths = [quarterStart, quarterStart + 1, quarterStart + 2]
        .map((m) => `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`)
        .join('|');
      return monthlyData.filter((d) =>
        new RegExp(quarterMonths).test(d.month)
      );
    } else if (selectedPeriod === 'year') {
      const year = new Date().getFullYear();
      return monthlyData.filter((d) => d.month.startsWith(String(year)));
    }
    return monthlyData;
  }, [monthlyData, selectedPeriod, selectedMonth]);

  const aggregatedData = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        income: 0,
        expenses: 0,
        profit: 0,
        margin: 0,
        new_projects: 0,
        active_projects: 0,
        new_clients: 0,
        won_clients: 0,
        publications: 0,
        tasks_completed: 0,
        team_size: 0,
      };
    }

    const totals = filteredData.reduce(
      (acc, row) => ({
        income: acc.income + row.income,
        expenses: acc.expenses + row.expenses,
        new_projects: acc.new_projects + row.new_projects,
        active_projects: Math.max(acc.active_projects, row.active_projects),
        new_clients: acc.new_clients + row.new_clients,
        won_clients: acc.won_clients + row.won_clients,
        publications: acc.publications + row.publications,
        tasks_completed: acc.tasks_completed + row.tasks_completed,
        team_size: Math.max(acc.team_size, row.team_size),
      }),
      {
        income: 0,
        expenses: 0,
        new_projects: 0,
        active_projects: 0,
        new_clients: 0,
        won_clients: 0,
        publications: 0,
        tasks_completed: 0,
        team_size: 0,
      }
    );

    const profit = totals.income - totals.expenses;
    const margin = totals.income > 0 ? (profit / totals.income) * 100 : 0;

    return { ...totals, profit, margin };
  }, [filteredData]);

  const comparisonData = useMemo(() => {
    if (monthlyData.length < 2) return null;

    const currentPeriodData = filteredData;
    const prevPeriodStart = getPreviousPeriodStart();
    const prevPeriodData = monthlyData.filter((d) => d.month >= prevPeriodStart && d.month < calculateStartDate());

    if (prevPeriodData.length === 0) return null;

    const calcTotal = (data: MonthlyAnalytics[], key: keyof MonthlyAnalytics) =>
      data.reduce((sum, d) => sum + (Number(d[key]) || 0), 0);

    return {
      income: unifiedAnalyticsService.calculateChange(
        calcTotal(currentPeriodData, 'income'),
        calcTotal(prevPeriodData, 'income')
      ),
      expenses: unifiedAnalyticsService.calculateChange(
        calcTotal(currentPeriodData, 'expenses'),
        calcTotal(prevPeriodData, 'expenses')
      ),
      new_projects: unifiedAnalyticsService.calculateChange(
        calcTotal(currentPeriodData, 'new_projects'),
        calcTotal(prevPeriodData, 'new_projects')
      ),
      won_clients: unifiedAnalyticsService.calculateChange(
        calcTotal(currentPeriodData, 'won_clients'),
        calcTotal(prevPeriodData, 'won_clients')
      ),
      publications: unifiedAnalyticsService.calculateChange(
        calcTotal(currentPeriodData, 'publications'),
        calcTotal(prevPeriodData, 'publications')
      ),
      tasks_completed: unifiedAnalyticsService.calculateChange(
        calcTotal(currentPeriodData, 'tasks_completed'),
        calcTotal(prevPeriodData, 'tasks_completed')
      ),
    };
  }, [monthlyData, filteredData, selectedPeriod, selectedMonth]);

  const getPreviousPeriodStart = () => {
    const currentStart = new Date(calculateStartDate());
    if (selectedPeriod === 'month') {
      currentStart.setMonth(currentStart.getMonth() - 1);
    } else if (selectedPeriod === 'quarter') {
      currentStart.setMonth(currentStart.getMonth() - 3);
    } else if (selectedPeriod === 'year') {
      currentStart.setFullYear(currentStart.getFullYear() - 1);
    }
    return currentStart.toISOString().split('T')[0];
  };

  const chartData = useMemo(() => {
    return filteredData.map((d) => ({
      month: new Date(d.month).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      income: d.income,
      expenses: d.expenses,
      profit: d.income - d.expenses,
      new_projects: d.new_projects,
      won_clients: d.won_clients,
      publications: d.publications,
      tasks_completed: d.tasks_completed,
    }));
  }, [filteredData]);

  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-500">Загрузка данных аналитики...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Унифицированная аналитика</h2>
          <p className="text-sm text-gray-500 mt-1">Все данные системы в одном месте</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="bg-transparent border-none focus:outline-none text-sm font-medium"
            >
              <option value="month">Месяц</option>
              <option value="quarter">Квартал</option>
              <option value="year">Год</option>
              <option value="all">Все время</option>
            </select>
          </div>

          {selectedPeriod === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('ru-RU', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Выручка"
          value={aggregatedData.income}
          change={comparisonData?.income}
          icon={<DollarSign className="w-5 h-5 text-white" />}
          iconColor="bg-blue-600"
          format="currency"
        />
        <MetricCard
          title="Прибыль"
          value={aggregatedData.profit}
          change={
            comparisonData
              ? unifiedAnalyticsService.calculateChange(aggregatedData.profit, aggregatedData.profit)
              : undefined
          }
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          iconColor="bg-green-600"
          format="currency"
        />
        <MetricCard
          title="Новые проекты"
          value={aggregatedData.new_projects}
          change={comparisonData?.new_projects}
          icon={<Briefcase className="w-5 h-5 text-white" />}
          iconColor="bg-purple-600"
        />
        <MetricCard
          title="Клиенты (Won)"
          value={aggregatedData.won_clients}
          change={comparisonData?.won_clients}
          icon={<Users className="w-5 h-5 text-white" />}
          iconColor="bg-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Публикации контента"
          value={aggregatedData.publications}
          change={comparisonData?.publications}
          icon={<FileText className="w-5 h-5 text-white" />}
          iconColor="bg-pink-600"
        />
        <MetricCard
          title="Задачи выполнено"
          value={aggregatedData.tasks_completed}
          change={comparisonData?.tasks_completed}
          icon={<CheckCircle className="w-5 h-5 text-white" />}
          iconColor="bg-teal-600"
        />
        <MetricCard
          title="Размер команды"
          value={aggregatedData.team_size}
          icon={<Users className="w-5 h-5 text-white" />}
          iconColor="bg-indigo-600"
        />
        <MetricCard
          title="Рентабельность"
          value={aggregatedData.margin}
          icon={<Target className="w-5 h-5 text-white" />}
          iconColor="bg-emerald-600"
          format="percentage"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Финансовая динамика</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="income" fill="#3b82f6" name="Выручка" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Расходы" radius={[8, 8, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Прибыль"
                  dot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Операционные метрики</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="new_projects"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Новые проекты"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="won_clients"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Клиенты (Won)"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="publications"
                  stroke="#ec4899"
                  strokeWidth={2}
                  name="Публикации"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Сводка по месяцам</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Месяц</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Выручка</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Расходы</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Прибыль</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Проекты</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Клиенты</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Контент</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, index) => {
                const profit = row.income - row.expenses;
                return (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium text-gray-900">
                      {new Date(row.month).toLocaleDateString('ru-RU', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900">
                      {row.income.toLocaleString()} ₸
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900">
                      {row.expenses.toLocaleString()} ₸
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span
                        className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {profit.toLocaleString()} ₸
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900">{row.new_projects}</td>
                    <td className="py-4 px-4 text-right text-gray-900">{row.won_clients}</td>
                    <td className="py-4 px-4 text-right text-gray-900">{row.publications}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="py-4 px-4">Итого</td>
                <td className="py-4 px-4 text-right">{aggregatedData.income.toLocaleString()} ₸</td>
                <td className="py-4 px-4 text-right">
                  {aggregatedData.expenses.toLocaleString()} ₸
                </td>
                <td className="py-4 px-4 text-right text-green-600">
                  {aggregatedData.profit.toLocaleString()} ₸
                </td>
                <td className="py-4 px-4 text-right">{aggregatedData.new_projects}</td>
                <td className="py-4 px-4 text-right">{aggregatedData.won_clients}</td>
                <td className="py-4 px-4 text-right">{aggregatedData.publications}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
