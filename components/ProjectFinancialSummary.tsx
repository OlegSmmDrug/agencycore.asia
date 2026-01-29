import React from 'react';
import { ProjectExpense, Project } from '../types';

interface ProjectFinancialSummaryProps {
  project: Project;
  expenses: ProjectExpense[];
}

const ProjectFinancialSummary: React.FC<ProjectFinancialSummaryProps> = ({ project, expenses }) => {
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.totalExpenses, 0);
  const totalRevenue = expenses.reduce((sum, exp) => sum + exp.revenue, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const budgetSpent = totalExpenses;
  const budgetRemaining = project.budget - budgetSpent;
  const budgetSpentPercent = project.budget > 0 ? (budgetSpent / project.budget) * 100 : 0;

  const monthsTracked = expenses.length;
  const avgMonthlyExpenses = monthsTracked > 0 ? totalExpenses / monthsTracked : 0;
  const avgMonthlyRevenue = monthsTracked > 0 ? totalRevenue / monthsTracked : 0;

  const categoryBreakdown: Record<string, number> = expenses.reduce((acc, exp) => {
    acc.smm += exp.smmExpenses || 0;
    acc.production += exp.productionExpenses || 0;
    acc.salaries += (exp.pmExpenses || 0) + (exp.targetologistExpenses || 0);
    acc.models += exp.modelsExpenses || 0;
    acc.other += exp.otherExpenses || 0;

    if (exp.dynamicExpenses) {
      Object.values(exp.dynamicExpenses).forEach(item => {
        acc[item.category] = (acc[item.category] || 0) + item.cost;
      });
    }

    return acc;
  }, {
    smm: 0,
    production: 0,
    salaries: 0,
    models: 0,
    other: 0
  } as Record<string, number>);

  const totalCategorized = Object.values(categoryBreakdown).reduce((sum, val) => sum + val, 0);

  const topCategories = Object.entries(categoryBreakdown)
    .map(([key, value]) => ({
      name: key === 'smm' ? 'SMM' :
            key === 'production' ? 'Production' :
            key === 'video' ? 'Видео' :
            key === 'salaries' ? 'Зарплаты' :
            key === 'target' ? 'Таргет' :
            key === 'sites' ? 'Сайты' :
            key === 'models' ? 'Модели' : 'Прочие',
      value,
      percent: totalCategorized > 0 ? (value / totalCategorized) * 100 : 0
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const projectDuration = project.duration || 30;
  const daysElapsed = project.startDate
    ? Math.floor((new Date().getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const progressPercent = projectDuration > 0 ? Math.min((daysElapsed / projectDuration) * 100, 100) : 0;

  const projectedTotalExpenses = progressPercent > 0 && progressPercent < 100
    ? (totalExpenses / progressPercent) * 100
    : totalExpenses;

  const projectedProfit = totalRevenue - projectedTotalExpenses;
  const projectedMargin = totalRevenue > 0 ? (projectedProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-6 border-2 border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">{project.name}</h2>
            <div className="text-slate-300 text-sm">Финансовый обзор проекта</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Бюджет проекта</div>
            <div className="text-3xl font-bold">{project.budget.toLocaleString()} ₸</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-xs text-slate-300 mb-1">Всего расходов</div>
            <div className="text-2xl font-bold">{totalExpenses.toLocaleString()} ₸</div>
            <div className="text-xs text-slate-400 mt-1">{budgetSpentPercent.toFixed(1)}% бюджета</div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-xs text-slate-300 mb-1">Выручка</div>
            <div className="text-2xl font-bold text-green-400">{totalRevenue.toLocaleString()} ₸</div>
            <div className="text-xs text-slate-400 mt-1">За {monthsTracked} мес.</div>
          </div>

          <div className={`bg-white/10 backdrop-blur rounded-lg p-4 border-2 ${
            totalProfit >= 0 ? 'border-green-400' : 'border-red-400'
          }`}>
            <div className="text-xs text-slate-300 mb-1">Чистая прибыль</div>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()} ₸
            </div>
            <div className={`text-xs mt-1 ${totalProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {overallMargin.toFixed(1)}% маржа
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-xs text-slate-300 mb-1">Остаток бюджета</div>
            <div className={`text-2xl font-bold ${budgetRemaining >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {budgetRemaining.toLocaleString()} ₸
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {budgetRemaining >= 0 ? 'В рамках' : 'Превышение'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">💰</span>
            Средние показатели
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Средние расходы в месяц</span>
              <span className="text-lg font-bold text-slate-800">{avgMonthlyExpenses.toLocaleString()} ₸</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Средняя выручка в месяц</span>
              <span className="text-lg font-bold text-green-700">{avgMonthlyRevenue.toLocaleString()} ₸</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Средняя прибыль в месяц</span>
              <span className={`text-lg font-bold ${
                (avgMonthlyRevenue - avgMonthlyExpenses) >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {(avgMonthlyRevenue - avgMonthlyExpenses).toLocaleString()} ₸
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Топ-5 категорий расходов
          </h3>
          <div className="space-y-2">
            {topCategories.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    idx === 0 ? 'bg-amber-500' :
                    idx === 1 ? 'bg-slate-400' :
                    idx === 2 ? 'bg-orange-600' :
                    'bg-slate-300'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-800">{cat.value.toLocaleString()} ₸</div>
                  <div className="text-xs text-slate-500">{cat.percent.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">🔮</span>
          Прогноз до конца проекта
        </h3>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600">Прогресс проекта</span>
            <span className="font-semibold text-slate-800">{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU') : '-'}</span>
            <span>{daysElapsed} из {projectDuration} дней</span>
            <span>{project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : '-'}</span>
          </div>
        </div>

        {progressPercent > 0 && progressPercent < 100 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="text-xs text-slate-600 mb-1">Прогноз расходов</div>
              <div className="text-xl font-bold text-slate-800">{projectedTotalExpenses.toLocaleString()} ₸</div>
              <div className="text-xs text-slate-500 mt-1">До конца проекта</div>
            </div>
            <div className={`bg-white p-4 rounded-lg border-2 ${
              projectedProfit >= 0 ? 'border-green-400' : 'border-red-400'
            }`}>
              <div className="text-xs text-slate-600 mb-1">Прогноз прибыли</div>
              <div className={`text-xl font-bold ${projectedProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {projectedProfit >= 0 ? '+' : ''}{projectedProfit.toLocaleString()} ₸
              </div>
              <div className={`text-xs mt-1 ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {projectedMargin.toFixed(1)}% маржа
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="text-xs text-slate-600 mb-1">Осталось дней</div>
              <div className="text-xl font-bold text-blue-700">{Math.max(0, projectDuration - daysElapsed)}</div>
              <div className="text-xs text-slate-500 mt-1">До завершения</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectFinancialSummary;
