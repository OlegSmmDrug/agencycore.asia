import React, { useState, useEffect } from 'react';
import { FileText, Save, Eye, EyeOff, ExternalLink, Loader, Check } from 'lucide-react';
import { legalPageService, LegalPage } from '../services/legalPageService';

const SLUG_LABELS: Record<string, string> = {
  'offer': 'Публичная оферта',
  'return-policy': 'Условия возврата',
  'contacts': 'Контактная информация',
  'requisites': 'Реквизиты организации',
  'privacy-policy': 'Политика конфиденциальности',
};

const LegalPagesAdmin: React.FC = () => {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<LegalPage | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    const data = await legalPageService.getAllPages();
    setPages(data);
    if (data.length > 0) {
      selectPage(data[0]);
    }
    setLoading(false);
  };

  const selectPage = (page: LegalPage) => {
    setSelectedPage(page);
    setEditTitle(page.title);
    setEditContent(page.content);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedPage) return;
    setSaving(true);
    const success = await legalPageService.updatePage(selectedPage.id, {
      title: editTitle,
      content: editContent,
    });
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const updated = pages.map(p =>
        p.id === selectedPage.id ? { ...p, title: editTitle, content: editContent, updated_at: new Date().toISOString() } : p
      );
      setPages(updated);
      setSelectedPage({ ...selectedPage, title: editTitle, content: editContent });
    }
    setSaving(false);
  };

  const handleTogglePublish = async (page: LegalPage) => {
    const success = await legalPageService.updatePage(page.id, {
      is_published: !page.is_published,
    });
    if (success) {
      const updated = pages.map(p =>
        p.id === page.id ? { ...p, is_published: !p.is_published } : p
      );
      setPages(updated);
      if (selectedPage?.id === page.id) {
        setSelectedPage({ ...selectedPage, is_published: !page.is_published });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Юридические страницы</h2>
        <p className="text-sm text-slate-500 mt-1">Управление публичными страницами для Robokassa и пользователей</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => selectPage(page)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                selectedPage?.id === page.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  selectedPage?.id === page.id ? 'bg-blue-100' : 'bg-slate-100'
                }`}>
                  <FileText className={`w-4 h-4 ${selectedPage?.id === page.id ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 truncate">
                    {SLUG_LABELS[page.slug] || page.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      page.is_published ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {page.is_published ? 'Опубликовано' : 'Скрыто'}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedPage && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  {SLUG_LABELS[selectedPage.slug] || selectedPage.title}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePublish(selectedPage)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedPage.is_published
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {selectedPage.is_published ? (
                      <><EyeOff className="w-3.5 h-3.5" /> Скрыть</>
                    ) : (
                      <><Eye className="w-3.5 h-3.5" /> Опубликовать</>
                    )}
                  </button>
                  <a
                    href={`/legal/${selectedPage.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Превью
                  </a>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Заголовок</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); setSaved(false); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Содержимое (HTML)</label>
                  <textarea
                    value={editContent}
                    onChange={(e) => { setEditContent(e.target.value); setSaved(false); }}
                    rows={16}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Ссылка: /legal/{selectedPage.slug}
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saved ? 'Сохранено' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Предпросмотр</h4>
              <div
                className="prose prose-slate max-w-none
                  [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:mb-3 [&_h2]:mt-0
                  [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-4 [&_h3]:mb-2
                  [&_p]:text-sm [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-2
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
                  [&_li]:text-sm [&_li]:text-slate-600 [&_li]:mb-1
                  [&_strong]:text-slate-800"
                dangerouslySetInnerHTML={{ __html: editContent }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalPagesAdmin;
