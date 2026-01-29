import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  trend?: { value: number; isPositive: boolean };
  alert?: 'success' | 'warning' | 'danger';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-blue-50',
  iconColor = 'text-blue-600',
  trend,
  alert
}) => {
  const alertColors = {
    success: 'border-green-200 bg-green-50/50',
    warning: 'border-yellow-200 bg-yellow-50/50',
    danger: 'border-red-200 bg-red-50/50'
  };

  const borderClass = alert ? alertColors[alert] : 'border-slate-200 bg-white';

  return (
    <div className={`p-6 rounded-xl shadow-sm border ${borderClass} flex flex-col justify-between h-full`}>
      <div className="flex justify-between items-start">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{title}</p>
        {Icon && (
          <div className={`p-2 ${iconBgColor} rounded-lg ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold text-slate-800">{value}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1.5 font-medium">{subtitle}</p>
        )}
        {trend && (
          <div className={`text-xs font-semibold mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
};

interface ProgressCardProps {
  title: string;
  current: number;
  target: number;
  unit?: string;
  color?: string;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  current,
  target,
  unit = '₸',
  color = 'bg-blue-500'
}) => {
  const percentage = Math.min((current / target) * 100, 100);

  return (
    <div className="p-6 rounded-xl shadow-sm border border-slate-200 bg-white">
      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-4">{title}</p>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-3xl font-bold text-slate-800">
            {current.toLocaleString('ru-RU')} {unit}
          </span>
          <span className="text-sm text-slate-500">
            / {target.toLocaleString('ru-RU')} {unit}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className={`${color} h-full rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-lg font-bold text-slate-700">{percentage.toFixed(1)}%</p>
      </div>
    </div>
  );
};

interface AlertBadgeProps {
  level: 'info' | 'warning' | 'danger';
  children: React.ReactNode;
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({ level, children }) => {
  const styles = {
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    danger: 'bg-red-100 text-red-700 border-red-200'
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[level]}`}>
      {children}
    </span>
  );
};

interface DataTableProps {
  headers: string[];
  rows: Array<Array<string | number | React.ReactNode>>;
  onRowClick?: (index: number) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ headers, rows, onRowClick }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            {headers.map((header, idx) => (
              <th key={idx} className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider py-3 px-4">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick?.(rowIdx)}
              className={`border-b border-slate-100 last:border-0 ${onRowClick ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
            >
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="py-3 px-4 text-sm text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="w-12 h-12 text-slate-300 mb-3" />}
      <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
  );
};
