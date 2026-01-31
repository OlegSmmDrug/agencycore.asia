import React from 'react';
import { Project, ProjectExpense } from '../types';

interface PlanFactComparisonProps {
  project: Project;
  expense: ProjectExpense;
}

interface ComparisonItem {
  name: string;
  plan: number;
  fact: number;
  planCost: number;
  factCost: number;
  variance: number;
  variancePercent: number;
}

const PlanFactComparison: React.FC<PlanFactComparisonProps> = ({ project, expense }) => {
  const comparisons: ComparisonItem[] = [];

  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[_\s]+/g, '')
      .replace(/[^a-zа-я0-9]/g, '')
      .trim();
  };

  if (project.contentMetrics && expense.dynamicExpenses) {
    const metricsByService: Record<string, { plan: number; fact: number; items: any[] }> = {};

    Object.entries(project.contentMetrics).forEach(([label, metric]: [string, any]) => {
      const plan = metric.plan || 0;
      const fact = metric.fact || 0;
      const labelNormalized = normalize(label);

      const matchingItems = Object.values(expense.dynamicExpenses || {}).filter(item => {
        const serviceName = item.serviceName;
        const serviceNameNormalized = normalize(serviceName);

        const serviceNameParts = serviceName.split(' - ');
        const serviceType = serviceNameParts.length > 1 ? serviceNameParts[1] : serviceName;
        const serviceTypeNormalized = normalize(serviceType);

        return serviceNameNormalized === labelNormalized ||
               serviceNameNormalized.includes(labelNormalized) ||
               labelNormalized.includes(serviceNameNormalized) ||
               serviceTypeNormalized === labelNormalized ||
               labelNormalized.includes(serviceTypeNormalized);
      });

      if (matchingItems.length > 0) {
        if (!metricsByService[label]) {
          metricsByService[label] = { plan, fact, items: [] };
        }
        metricsByService[label].items.push(...matchingItems);
      }
    });

    for (const [label, data] of Object.entries(metricsByService)) {
      const totalCount = data.items.reduce((sum, item) => sum + (item.count || 0), 0);
      const totalCost = data.items.reduce((sum, item) => sum + (item.cost || 0), 0);
      const avgRate = totalCount > 0 ? totalCost / totalCount : 0;

      const planCost = data.plan * avgRate;
      const factCost = data.fact * avgRate;
      const variance = data.fact - data.plan;
      const variancePercent = data.plan > 0 ? ((data.fact - data.plan) / data.plan) * 100 : 0;

      comparisons.push({
        name: label,
        plan: data.plan,
        fact: data.fact,
        planCost: Math.round(planCost),
        factCost: Math.round(factCost),
        variance,
        variancePercent
      });
    }
  }

  if (comparisons.length === 0) {
    return null;
  }

  const totalPlanCost = comparisons.reduce((sum, item) => sum + item.planCost, 0);
  const totalFactCost = comparisons.reduce((sum, item) => sum + item.factCost, 0);
  const totalVariance = totalFactCost - totalPlanCost;
  const totalVariancePercent = totalPlanCost > 0 ? (totalVariance / totalPlanCost) * 100 : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="text-2xl">📈</span>
        Сравнение План / Факт
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-700 mb-1">Плановая себестоимость</div>
          <div className="text-2xl font-bold text-blue-900">{totalPlanCost.toLocaleString()} ₸</div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-700 mb-1">Фактическая себестоимость</div>
          <div className="text-2xl font-bold text-green-900">{totalFactCost.toLocaleString()} ₸</div>
        </div>

        <div className={`p-4 rounded-lg border-2 ${
          totalVariance <= 0 ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'
        }`}>
          <div className={`text-sm mb-1 ${
            totalVariance <= 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            Отклонение
          </div>
          <div className={`text-2xl font-bold ${
            totalVariance <= 0 ? 'text-green-900' : 'text-red-900'
          }`}>
            {totalVariance >= 0 ? '+' : ''}{totalVariance.toLocaleString()} ₸
          </div>
          <div className={`text-xs mt-1 ${
            totalVariance <= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {totalVariancePercent >= 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Услуга</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">План (шт)</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Факт (шт)</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Δ (шт)</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">План (₸)</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Факт (₸)</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Отклонение</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-sm font-medium text-slate-800">{item.name}</td>
                <td className="py-3 px-4 text-sm text-center text-slate-600">{item.plan}</td>
                <td className="py-3 px-4 text-sm text-center font-semibold text-slate-800">{item.fact}</td>
                <td className={`py-3 px-4 text-sm text-center font-semibold ${
                  item.variance > 0 ? 'text-red-600' :
                  item.variance < 0 ? 'text-green-600' :
                  'text-slate-500'
                }`}>
                  {item.variance > 0 ? '+' : ''}{item.variance}
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-600">
                  {item.planCost.toLocaleString()} ₸
                </td>
                <td className="py-3 px-4 text-sm text-right font-semibold text-slate-800">
                  {item.factCost.toLocaleString()} ₸
                </td>
                <td className={`py-3 px-4 text-sm text-right font-bold ${
                  item.factCost - item.planCost > 0 ? 'text-red-600' :
                  item.factCost - item.planCost < 0 ? 'text-green-600' :
                  'text-slate-500'
                }`}>
                  {item.factCost - item.planCost > 0 ? '+' : ''}
                  {(item.factCost - item.planCost).toLocaleString()} ₸
                  <div className="text-xs">
                    ({item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%)
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td className="py-3 px-4 text-sm font-bold text-slate-800">ИТОГО</td>
              <td className="py-3 px-4 text-sm text-center font-semibold text-slate-700">
                {comparisons.reduce((sum, item) => sum + item.plan, 0)}
              </td>
              <td className="py-3 px-4 text-sm text-center font-bold text-slate-800">
                {comparisons.reduce((sum, item) => sum + item.fact, 0)}
              </td>
              <td className={`py-3 px-4 text-sm text-center font-bold ${
                comparisons.reduce((sum, item) => sum + item.variance, 0) > 0 ? 'text-red-600' :
                comparisons.reduce((sum, item) => sum + item.variance, 0) < 0 ? 'text-green-600' :
                'text-slate-500'
              }`}>
                {comparisons.reduce((sum, item) => sum + item.variance, 0) > 0 ? '+' : ''}
                {comparisons.reduce((sum, item) => sum + item.variance, 0)}
              </td>
              <td className="py-3 px-4 text-sm text-right font-semibold text-slate-700">
                {totalPlanCost.toLocaleString()} ₸
              </td>
              <td className="py-3 px-4 text-sm text-right font-bold text-slate-800">
                {totalFactCost.toLocaleString()} ₸
              </td>
              <td className={`py-3 px-4 text-sm text-right font-bold ${
                totalVariance > 0 ? 'text-red-600' :
                totalVariance < 0 ? 'text-green-600' :
                'text-slate-500'
              }`}>
                {totalVariance > 0 ? '+' : ''}{totalVariance.toLocaleString()} ₸
                <div className="text-xs">
                  ({totalVariancePercent > 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%)
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Интерпретация:</h4>
        <ul className="text-xs text-slate-600 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span><span className="font-semibold text-green-600">Зеленый</span> - факт меньше плана (экономия, хорошо)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-600 font-bold">✗</span>
            <span><span className="font-semibold text-red-600">Красный</span> - факт больше плана (перерасход, требует внимания)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-500 font-bold">=</span>
            <span><span className="font-semibold text-slate-600">Серый</span> - точное соответствие плану</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PlanFactComparison;
