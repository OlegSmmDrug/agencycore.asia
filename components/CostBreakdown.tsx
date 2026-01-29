import React, { useState } from 'react';
import { CostAnalysis, CategoryCostBreakdown } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CostBreakdownProps {
  analysis: CostAnalysis;
}

const CATEGORY_COLORS: Record<string, string> = {
  smm: '#3b82f6',
  video: '#8b5cf6',
  target: '#ec4899',
  sites: '#10b981',
  salaries: '#f59e0b',
  models: '#ef4444',
  other: '#6b7280'
};

const CATEGORY_ICONS: Record<string, string> = {
  smm: '📱',
  video: '🎬',
  target: '🎯',
  sites: '🌐',
  salaries: '👥',
  models: '🌟',
  other: '📦'
};

const CostBreakdown: React.FC<CostBreakdownProps> = ({ analysis }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const chartData = analysis.categories.map(cat => ({
    name: cat.categoryName,
    value: cat.totalCost,
    percentage: cat.percentage
  }));

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-xl p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Детализация себестоимости
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="bg-white rounded-lg p-4 mb-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percentage }) => `${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => {
                      const category = analysis.categories[index];
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[category.category]}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value.toLocaleString()} ₸`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <div className="text-xs text-slate-500 mb-1">Общая себестоимость</div>
                <div className="text-lg font-bold text-slate-800">
                  {analysis.totalCost.toLocaleString()} ₸
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <div className="text-xs text-slate-500 mb-1">Выручка</div>
                <div className="text-lg font-bold text-blue-700">
                  {analysis.totalRevenue.toLocaleString()} ₸
                </div>
              </div>
              <div className={`bg-white p-3 rounded-lg border-2 text-center ${
                analysis.marginPercent >= 30 ? 'border-green-400' :
                analysis.marginPercent >= 15 ? 'border-yellow-400' :
                'border-red-400'
              }`}>
                <div className="text-xs text-slate-500 mb-1">Маржа</div>
                <div className={`text-lg font-bold ${
                  analysis.marginPercent >= 30 ? 'text-green-700' :
                  analysis.marginPercent >= 15 ? 'text-yellow-700' :
                  'text-red-700'
                }`}>
                  {analysis.marginPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Топ-3 категории расходов</h4>
              <div className="space-y-2">
                {analysis.topExpenseCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        idx === 0 ? 'bg-amber-500' :
                        idx === 1 ? 'bg-slate-400' :
                        'bg-orange-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{cat.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-800">
                        {cat.amount.toLocaleString()} ₸
                      </div>
                      <div className="text-xs text-slate-500">{cat.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
              <div className="text-sm font-medium text-green-700 mb-1">Чистая прибыль</div>
              <div className={`text-2xl font-bold ${
                analysis.netProfit >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {analysis.netProfit >= 0 ? '+' : ''}{analysis.netProfit.toLocaleString()} ₸
              </div>
              <div className="text-xs text-green-600 mt-1">
                {analysis.netProfit >= 0 ? 'Проект прибыльный' : 'Проект убыточный'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h4 className="text-lg font-bold text-slate-800 mb-4">Детализация по категориям</h4>
        <div className="space-y-3">
          {analysis.categories.map((category) => (
            <div key={category.category} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(category.category)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[category.category] }}
                  />
                  <span className="text-lg">{CATEGORY_ICONS[category.category]}</span>
                  <span className="font-semibold text-slate-800">{category.categoryName}</span>
                  <span className="text-sm text-slate-500">
                    ({category.items.length} {category.items.length === 1 ? 'позиция' : 'позиций'})
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-800">
                      {category.totalCost.toLocaleString()} ₸
                    </div>
                    <div className="text-xs text-slate-500">{category.percentage.toFixed(1)}%</div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      expandedCategory === category.category ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedCategory === category.category && (
                <div className="px-4 pb-4 bg-slate-50">
                  <div className="space-y-2">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-slate-100">
                        <div>
                          <div className="font-medium text-slate-700">{item.name}</div>
                          {item.count !== undefined && item.rate !== undefined && (
                            <div className="text-xs text-slate-500 mt-1">
                              {item.count} × {item.rate.toLocaleString()} ₸
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-800">{item.cost.toLocaleString()} ₸</div>
                          <div className="text-xs text-slate-500">
                            {((item.cost / category.totalCost) * 100).toFixed(1)}% категории
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CostBreakdown;
