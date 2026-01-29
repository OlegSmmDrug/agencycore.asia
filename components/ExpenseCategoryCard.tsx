import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Lock, Edit2, Copy } from 'lucide-react';

interface CategoryData {
  name: string;
  total: number;
  percentage: number;
  trend?: number;
  icon: string;
  color: string;
  fields: Array<{
    label: string;
    value: number;
    key: string;
    unit?: string;
    rate?: number;
    isManuallyEdited?: boolean;
  }>;
}

interface ExpenseCategoryCardProps {
  category: CategoryData;
  isEditing: boolean;
  onFieldChange?: (key: string, value: number) => void;
  onCopyFromPrevious?: () => void;
  previousMonthData?: number;
}

export const ExpenseCategoryCard: React.FC<ExpenseCategoryCardProps> = ({
  category,
  isEditing,
  onFieldChange,
  onCopyFromPrevious,
  previousMonthData
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTrendIcon = () => {
    if (!category.trend || category.trend === 0) return <Minus className="w-4 h-4" />;
    if (category.trend > 0) return <TrendingUp className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (!category.trend || category.trend === 0) return 'text-slate-400';
    if (category.trend > 0) return 'text-red-500';
    return 'text-green-500';
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('ru-RU');
  };

  return (
    <div className={`bg-white rounded-xl border-2 transition-all duration-200 ${
      isExpanded ? 'border-blue-300 shadow-lg' : 'border-slate-200 hover:border-slate-300'
    }`}>
      <div
        className="p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${category.color}`}>
              {category.icon}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{category.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{category.fields.length} параметров</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{formatNumber(category.total)} ₸</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium text-slate-600">{category.percentage.toFixed(1)}%</span>
              {category.trend !== undefined && (
                <div className={`flex items-center gap-1 text-xs font-medium ${getTrendColor()}`}>
                  {getTrendIcon()}
                  <span>{Math.abs(category.trend).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${category.color.replace('bg-', 'bg-gradient-to-r from-').replace('-100', '-400 to-').replace('100', '300')}`}
              style={{ width: `${Math.min(category.percentage, 100)}%` }}
            />
          </div>
          <button
            className={`ml-3 text-slate-400 hover:text-slate-600 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200 p-5 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-700">Детали расходов</h4>
            <div className="flex gap-2">
              {previousMonthData !== undefined && previousMonthData > 0 && onCopyFromPrevious && (
                <button
                  onClick={onCopyFromPrevious}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Копировать прошлый месяц ({formatNumber(previousMonthData)} ₸)
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {category.fields.map((field) => (
              <div key={field.key} className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">
                      {field.label}
                    </label>
                    {field.isManuallyEdited && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        <Lock className="w-3 h-3" />
                        Изменено вручную
                      </div>
                    )}
                  </div>
                  {field.rate && (
                    <span className="text-xs text-slate-500">
                      Ставка: {formatNumber(field.rate)} ₸ {field.unit || ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={field.value || ''}
                    onChange={(e) => onFieldChange?.(field.key, Number(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    disabled={!isEditing}
                    className={`flex-1 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      isEditing
                        ? 'border-slate-300 bg-white hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                    placeholder="0"
                  />
                  {field.unit && (
                    <span className="text-sm text-slate-500 min-w-[60px]">{field.unit}</span>
                  )}
                  {field.rate && field.value > 0 && (
                    <div className="text-right min-w-[100px]">
                      <div className="text-sm font-bold text-slate-900">
                        {formatNumber(field.value * field.rate)} ₸
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {category.fields.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">Нет данных для отображения</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
