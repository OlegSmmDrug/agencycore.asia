import React from 'react';
import { AlertTriangle, AlertCircle, Info, TrendingUp, XCircle } from 'lucide-react';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  suggestion?: string;
}

interface ExpenseValidationProps {
  revenue: number;
  totalExpenses: number;
  projectBudget: number;
  marginPercent: number;
  previousMonthExpenses?: number;
  missingFields?: string[];
}

export const ExpenseValidation: React.FC<ExpenseValidationProps> = ({
  revenue,
  totalExpenses,
  projectBudget,
  marginPercent,
  previousMonthExpenses,
  missingFields = []
}) => {
  const issues: ValidationIssue[] = [];

  if (revenue < totalExpenses) {
    issues.push({
      type: 'error',
      message: 'Убыточный месяц',
      suggestion: `Расходы (${totalExpenses.toLocaleString()} ₸) превышают выручку (${revenue.toLocaleString()} ₸) на ${(totalExpenses - revenue).toLocaleString()} ₸`
    });
  }

  if (revenue === 0 && totalExpenses > 0) {
    issues.push({
      type: 'warning',
      message: 'Выручка не указана',
      suggestion: `Укажите выручку или используйте бюджет проекта (${projectBudget.toLocaleString()} ₸)`
    });
  }

  if (marginPercent < 15 && marginPercent > 0) {
    issues.push({
      type: 'warning',
      message: 'Низкая маржинальность',
      suggestion: `Текущая маржа ${marginPercent.toFixed(1)}% ниже рекомендуемого минимума 15%`
    });
  }

  if (previousMonthExpenses && totalExpenses > previousMonthExpenses * 1.3) {
    const increase = ((totalExpenses - previousMonthExpenses) / previousMonthExpenses * 100).toFixed(0);
    issues.push({
      type: 'warning',
      message: 'Резкий рост расходов',
      suggestion: `Расходы выросли на ${increase}% по сравнению с прошлым месяцем`
    });
  }

  if (totalExpenses > projectBudget * 1.1) {
    issues.push({
      type: 'error',
      message: 'Превышение бюджета проекта',
      suggestion: `Расходы превышают бюджет проекта на ${((totalExpenses / projectBudget - 1) * 100).toFixed(0)}%`
    });
  }

  if (missingFields.length > 0) {
    issues.push({
      type: 'info',
      message: 'Неполные данные',
      suggestion: `Не заполнено полей: ${missingFields.length}`
    });
  }

  if (totalExpenses === 0 && revenue === 0) {
    issues.push({
      type: 'info',
      message: 'Данные не заполнены',
      suggestion: 'Начните с указания выручки и расходов за месяц'
    });
  }

  if (issues.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Все отлично!</h3>
            <p className="text-sm text-green-700">Никаких проблем не обнаружено</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, index) => {
        const Icon = issue.type === 'error' ? XCircle : issue.type === 'warning' ? AlertTriangle : Info;
        const colors = {
          error: {
            bg: 'bg-gradient-to-r from-red-50 to-rose-50',
            border: 'border-red-200',
            iconBg: 'bg-red-100',
            icon: 'text-red-600',
            title: 'text-red-900',
            text: 'text-red-700'
          },
          warning: {
            bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
            border: 'border-amber-200',
            iconBg: 'bg-amber-100',
            icon: 'text-amber-600',
            title: 'text-amber-900',
            text: 'text-amber-700'
          },
          info: {
            bg: 'bg-gradient-to-r from-blue-50 to-sky-50',
            border: 'border-blue-200',
            iconBg: 'bg-blue-100',
            icon: 'text-blue-600',
            title: 'text-blue-900',
            text: 'text-blue-700'
          }
        };

        const color = colors[issue.type];

        return (
          <div key={index} className={`${color.bg} border-2 ${color.border} rounded-xl p-4`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 ${color.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color.icon}`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold ${color.title} mb-1`}>{issue.message}</h3>
                {issue.suggestion && (
                  <p className={`text-sm ${color.text}`}>{issue.suggestion}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
