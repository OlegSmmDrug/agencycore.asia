
import React, { useState, useEffect } from 'react';

interface QuickLink {
  id: string;
  name: string;
  url: string;
  color?: string;
}

interface QuickLinksProps {
  links?: QuickLink[];
  onSave: (links: QuickLink[]) => void;
}

const COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-lime-500',
  'bg-sky-500',
  'bg-violet-500'
];

const getRandomColor = () => {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
};

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const QuickLinks: React.FC<QuickLinksProps> = ({ links = [], onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableLinks, setEditableLinks] = useState<QuickLink[]>([]);

  useEffect(() => {
    if (Array.isArray(links)) {
      setEditableLinks(links);
    } else if (links && typeof links === 'object') {
      const converted: QuickLink[] = [];
      const oldFormat = links as any;
      if (oldFormat.figma) converted.push({ id: 'figma', name: 'Дизайн', url: oldFormat.figma, color: 'bg-slate-500' });
      if (oldFormat.drive) converted.push({ id: 'drive', name: 'Drive', url: oldFormat.drive, color: 'bg-blue-400' });
      if (oldFormat.kp) converted.push({ id: 'kp', name: 'Оффер', url: oldFormat.kp, color: 'bg-emerald-400' });
      if (oldFormat.contentPlan) converted.push({ id: 'contentPlan', name: 'План', url: oldFormat.contentPlan, color: 'bg-amber-300' });
      setEditableLinks(converted);
    } else {
      setEditableLinks([]);
    }
  }, [links]);

  const handleAddLink = () => {
    const newLink: QuickLink = {
      id: `link_${Date.now()}`,
      name: '',
      url: '',
      color: getRandomColor()
    };
    setEditableLinks([...editableLinks, newLink]);
  };

  const handleUpdateLink = (id: string, field: 'name' | 'url', value: string) => {
    setEditableLinks(editableLinks.map(link =>
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  const handleDeleteLink = (id: string) => {
    setEditableLinks(editableLinks.filter(link => link.id !== id));
  };

  const handleSave = () => {
    const validLinks = editableLinks.filter(link => link.name.trim() && link.url.trim());
    onSave(validLinks);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditableLinks(links);
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 className="font-bold text-slate-800">Быстрые ссылки</h3>
        </div>
        <button
          onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {isEditing ? 'Отмена' : 'Изменить'}
        </button>
      </div>

      <div>
        {isEditing ? (
          <div className="space-y-3">
            {editableLinks.map((link, index) => (
              <div key={link.id} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1 space-y-2">
                  <input
                    placeholder="Название ссылки"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={link.name}
                    onChange={(e) => handleUpdateLink(link.id, 'name', e.target.value)}
                  />
                  <input
                    placeholder="https://..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={link.url}
                    onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                  />
                </div>
                <button
                  onClick={() => handleDeleteLink(link.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg mt-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={handleAddLink}
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + Добавить ссылку
            </button>
            <button
              onClick={handleSave}
              className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              Сохранить
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {editableLinks.length === 0 ? (
              <div className="col-span-2 text-center py-6 text-sm text-slate-400">
                Нет ссылок. Нажмите "Изменить" чтобы добавить.
              </div>
            ) : (
              editableLinks.map(link => (
                <a
                  key={link.id}
                  href={link.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all"
                >
                  <div className={`w-8 h-8 ${link.color || 'bg-slate-500'} rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                    {getInitials(link.name)}
                  </div>
                  <span className="text-sm text-slate-700 truncate">{link.name}</span>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickLinks;
