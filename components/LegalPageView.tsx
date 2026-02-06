import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { legalPageService, LegalPage } from '../services/legalPageService';

interface LegalPageViewProps {
  slug: string;
}

const LegalPageView: React.FC<LegalPageViewProps> = ({ slug }) => {
  const [page, setPage] = useState<LegalPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await legalPageService.getPublishedPage(slug);
      setPage(data);
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Страница не найдена</h1>
          <p className="text-slate-500 mb-4">Запрошенная страница не существует или не опубликована.</p>
          <a href="/" className="text-blue-600 hover:underline">Вернуться на главную</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </a>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <div
            className="legal-content prose prose-slate max-w-none
              [&_h2]:text-xl [&_h2]:sm:text-2xl [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:mb-4 [&_h2]:mt-0
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-6 [&_h3]:mb-3
              [&_p]:text-sm [&_p]:sm:text-base [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-3
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
              [&_li]:text-sm [&_li]:sm:text-base [&_li]:text-slate-600 [&_li]:mb-2
              [&_strong]:text-slate-800"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          Последнее обновление: {new Date(page.updated_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
};

export default LegalPageView;
