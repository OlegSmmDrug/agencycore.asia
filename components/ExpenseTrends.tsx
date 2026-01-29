import React, { useState } from 'react';
import { ProjectExpense } from '../types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface ExpenseTrendsProps {
  expenses: ProjectExpense[];
  projectBudget: number;
}

type ChartType = 'line' | 'bar' | 'area';
type MetricType = 'expenses' | 'margin' | 'revenue' | 'categories';

const ExpenseTrends: React.FC<ExpenseTrendsProps> = ({ expenses, projectBudget }) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [metricType, setMetricType] = useState<MetricType>('expenses');

  const sortedExpenses = [...expenses].sort((a, b) => a.month.localeCompare(b.month));

  const chartData = sortedExpenses.map(exp => ({
    month: new Date(exp.month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
    totalExpenses: exp.totalExpenses,
    revenue: exp.revenue,
    margin: exp.marginPercent,
    netProfit: exp.revenue - exp.totalExpenses,
    smm: exp.smmExpenses,
    production: exp.productionExpenses,
    salaries: exp.pmExpenses,
    target: exp.targetologistExpenses,
    models: exp.modelsExpenses,
    other: exp.otherExpenses
  }));

  const averageExpenses = sortedExpenses.length > 0
    ? sortedExpenses.reduce((sum, exp) => sum + exp.totalExpenses, 0) / sortedExpenses.length
    : 0;

  const averageMargin = sortedExpenses.length > 0
    ? sortedExpenses.reduce((sum, exp) => sum + exp.marginPercent, 0) / sortedExpenses.length
    : 0;

  const totalRevenue = sortedExpenses.reduce((sum, exp) => sum + exp.revenue, 0);
  const totalExpenses = sortedExpenses.reduce((sum, exp) => sum + exp.totalExpenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  const lastMonth = sortedExpenses[sortedExpenses.length - 1];
  const prevMonth = sortedExpenses[sortedExpenses.length - 2];

  const expenseTrend = lastMonth && prevMonth
    ? ((lastMonth.totalExpenses - prevMonth.totalExpenses) / prevMonth.totalExpenses) * 100
    : 0;

  const marginTrend = lastMonth && prevMonth
    ? lastMonth.marginPercent - prevMonth.marginPercent
    : 0;

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (metricType) {
      case 'expenses':
        if (chartType === 'line') {
          return (
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
              <Legend />
              <Line type="monotone" dataKey="totalExpenses" stroke="#ef4444" strokeWidth={2} name="Расходы" />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Выручка" />
            </LineChart>
          );
        } else if (chartType === 'bar') {
          return (
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
              <Legend />
              <Bar dataKey="totalExpenses" fill="#ef4444" name="Расходы" />
              <Bar dataKey="revenue" fill="#10b981" name="Выручка" />
            </BarChart>
          );
        } else {
          return (
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
              <Legend />
              <Area type="monotone" dataKey="totalExpenses" stackId="1" stroke="#ef4444" fill="#ef4444" name="Расходы" />
              <Area type="monotone" dataKey="netProfit" stackId="2" stroke="#10b981" fill="#10b981" name="Прибыль" />
            </AreaChart>
          );
        }

      case 'margin':
        if (chartType === 'line') {
          return (
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
              <Line type="monotone" dataKey="margin" stroke="#8b5cf6" strokeWidth={3} name="Маржа %" />
            </LineChart>
          );
        } else if (chartType === 'bar') {
          return (
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="margin" fill="#8b5cf6" name="Маржа %" />
            </BarChart>
          );
        } else {
          return (
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
              <Area type="monotone" dataKey="margin" stroke="#8b5cf6" fill="#8b5cf6" name="Маржа %" />
            </AreaChart>
          );
        }

      case 'revenue':
        if (chartType === 'line') {
          return (
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Выручка" />
              <Line type="monotone" dataKey="netProfit" stroke="#3b82f6" strokeWidth={2} name="Чистая прибыль" />
            </LineChart>
          );
        } else if (chartType === 'bar') {
          return (
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" name="Выручка" />
              <Bar dataKey="netProfit" fill="#3b82f6" name="Чистая прибыль" />
            </BarChart>
          );
        } else {
          return (
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" name="Выручка" />
            </AreaChart>
          );
        }

      case 'categories':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
            <Legend />
            <Bar dataKey="smm" stackId="a" fill="#3b82f6" name="SMM" />
            <Bar dataKey="production" stackId="a" fill="#8b5cf6" name="Production" />
            <Bar dataKey="salaries" stackId="a" fill="#f59e0b" name="Зарплаты" />
            <Bar dataKey="target" stackId="a" fill="#ec4899" name="Таргет" />
            <Bar dataKey="models" stackId="a" fill="#ef4444" name="Модели" />
            <Bar dataKey="other" stackId="a" fill="#6b7280" name="Прочие" />
          </BarChart>
        );

      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₸`} />
            <Legend />
            <Line type="monotone" dataKey="totalExpenses" stroke="#ef4444" strokeWidth={2} name="Расходы" />
          </LineChart>
        );
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="text-slate-400 text-lg">Недостаточно данных для построения графиков</div>
        <div className="text-slate-500 text-sm mt-2">Добавьте расходы хотя бы за 2 месяца</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Аналитика и тренды
        </h3>
        <div className="flex gap-2">
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as MetricType)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="expenses">Расходы vs Выручка</option>
            <option value="margin">Маржинальность</option>
            <option value="revenue">Доходность</option>
            <option value="categories">По категориям</option>
          </select>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="line">Линейный</option>
            <option value="bar">Столбчатый</option>
            <option value="area">Область</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-700 mb-1">Средние расходы</div>
          <div className="text-xl font-bold text-blue-900">{averageExpenses.toLocaleString()} ₸</div>
          {lastMonth && prevMonth && (
            <div className={`text-xs mt-1 ${expenseTrend > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {expenseTrend > 0 ? '↑' : '↓'} {Math.abs(expenseTrend).toFixed(1)}% к пред. месяцу
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="text-xs text-purple-700 mb-1">Средняя маржа</div>
          <div className="text-xl font-bold text-purple-900">{averageMargin.toFixed(1)}%</div>
          {lastMonth && prevMonth && (
            <div className={`text-xs mt-1 ${marginTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {marginTrend > 0 ? '↑' : '↓'} {Math.abs(marginTrend).toFixed(1)}% к пред. месяцу
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="text-xs text-green-700 mb-1">Общая выручка</div>
          <div className="text-xl font-bold text-green-900">{totalRevenue.toLocaleString()} ₸</div>
          <div className="text-xs text-green-600 mt-1">{expenses.length} {expenses.length === 1 ? 'месяц' : 'месяцев'}</div>
        </div>

        <div className={`bg-gradient-to-br p-4 rounded-lg border-2 ${
          totalProfit >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-400' : 'from-red-50 to-red-100 border-red-400'
        }`}>
          <div className={`text-xs mb-1 ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            Общая прибыль
          </div>
          <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
            {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()} ₸
          </div>
          <div className={`text-xs mt-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalProfit >= 0 ? 'Прибыльный проект' : 'Убыточный проект'}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={350}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-700 mb-1">Прогноз на след. месяц</div>
          <div className="text-lg font-bold text-blue-900">
            {lastMonth ? `${lastMonth.totalExpenses.toLocaleString()} ₸` : '-'}
          </div>
          <div className="text-xs text-blue-600 mt-1">На основе последнего месяца</div>
        </div>

        <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
          <div className="text-xs text-purple-700 mb-1">Всего периодов</div>
          <div className="text-lg font-bold text-purple-900">{expenses.length}</div>
          <div className="text-xs text-purple-600 mt-1">
            {sortedExpenses[0]?.month} - {sortedExpenses[sortedExpenses.length - 1]?.month}
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${
          averageMargin >= 30 ? 'bg-green-50 border-green-200' :
          averageMargin >= 15 ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className={`text-xs mb-1 ${
            averageMargin >= 30 ? 'text-green-700' :
            averageMargin >= 15 ? 'text-yellow-700' :
            'text-red-700'
          }`}>
            Состояние проекта
          </div>
          <div className={`text-lg font-bold ${
            averageMargin >= 30 ? 'text-green-900' :
            averageMargin >= 15 ? 'text-yellow-900' :
            'text-red-900'
          }`}>
            {averageMargin >= 30 ? 'Отличное' : averageMargin >= 15 ? 'Удовлетворительное' : 'Требует внимания'}
          </div>
          <div className={`text-xs mt-1 ${
            averageMargin >= 30 ? 'text-green-600' :
            averageMargin >= 15 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            Средняя маржа {averageMargin.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseTrends;
