import React from 'react';
import { Lock, Crown } from 'lucide-react';

interface ModuleGateProps {
  moduleSlug: string;
  moduleName: string;
  isAvailable: boolean;
  currentPlan: string;
  onNavigateToBilling: () => void;
  children: React.ReactNode;
}

const ModuleGate: React.FC<ModuleGateProps> = ({
  moduleName,
  isAvailable,
  currentPlan,
  onNavigateToBilling,
  children,
}) => {
  if (isAvailable) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0 blur-sm opacity-30 pointer-events-none select-none">
        <div className="p-6 sm:p-8">
          <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2"></div>
          <div className="h-4 w-72 bg-slate-100 rounded mb-8"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-28">
                <div className="h-3 w-20 bg-slate-100 rounded mb-3"></div>
                <div className="h-6 w-16 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-40">
                <div className="h-3 w-32 bg-slate-100 rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-slate-50 rounded"></div>
                  <div className="h-2 w-3/4 bg-slate-50 rounded"></div>
                  <div className="h-2 w-5/6 bg-slate-50 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/10 backdrop-blur-[2px]">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {moduleName}
          </h2>
          <p className="text-sm text-slate-500 mb-2">
            Этот модуль недоступен на тарифе <span className="font-semibold">{currentPlan}</span>
          </p>
          <p className="text-sm text-slate-400 mb-6">
            Перейдите на более высокий тариф или приобретите модуль отдельно, чтобы получить доступ.
          </p>
          <button
            onClick={onNavigateToBilling}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Crown className="w-4 h-4" />
            Улучшить тариф
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModuleGate;
