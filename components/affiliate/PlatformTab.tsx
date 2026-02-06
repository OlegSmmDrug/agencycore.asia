import React from 'react';
import { Globe, ExternalLink, Layout, Palette } from 'lucide-react';

export const PlatformTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Globe className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Платформа LP</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          Создавайте лендинги для привлечения новых клиентов через вашу партнерскую программу.
          Используйте готовые шаблоны или создайте свой собственный дизайн.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
          <div className="p-4 bg-slate-50 rounded-xl">
            <Layout className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Готовые шаблоны</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <Palette className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Гибкая настройка</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <ExternalLink className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Свой домен</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-500 rounded-lg text-sm">
          Скоро будет доступно
        </div>
      </div>
    </div>
  );
};
