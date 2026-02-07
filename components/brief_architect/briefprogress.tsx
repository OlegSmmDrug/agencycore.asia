
import React from 'react';

interface BriefProgressProps {
  progress: number;
  status: string;
}

export const BriefProgress: React.FC<BriefProgressProps> = ({ progress, status }) => {
  return (
    <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Статус:</span>
            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
              {status}
            </span>
          </div>
          <span className="text-sm font-bold text-slate-700">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
