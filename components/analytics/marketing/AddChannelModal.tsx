import React, { useState } from 'react';

interface AddChannelModalProps {
  onSave: (name: string, type: string, color: string) => void;
  onClose: () => void;
}

const PRESETS = [
  { name: 'Google Ads', type: 'paid', color: '#4285f4' },
  { name: 'Facebook Ads', type: 'paid', color: '#1877f2' },
  { name: 'Instagram Ads', type: 'paid', color: '#e4405f' },
  { name: 'TikTok Ads', type: 'paid', color: '#010101' },
  { name: 'Яндекс.Директ', type: 'paid', color: '#fc3f1d' },
  { name: 'SEO', type: 'organic', color: '#10b981' },
  { name: 'Реферальная программа', type: 'referral', color: '#06b6d4' },
  { name: 'Email-рассылки', type: 'organic', color: '#8b5cf6' },
  { name: 'Creatium (сайт)', type: 'organic', color: '#f59e0b' },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#64748b'];

const AddChannelModal: React.FC<AddChannelModalProps> = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('paid');
  const [color, setColor] = useState('#3b82f6');
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    onSave(preset.name, preset.type, preset.color);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-lg text-slate-900">Добавить канал</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            onClick={() => setMode('presets')}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'presets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Готовые каналы
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Свой канал
          </button>
        </div>

        {mode === 'presets' ? (
          <div className="grid grid-cols-1 gap-2">
            {PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => handlePresetClick(preset)}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left"
              >
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: preset.color }} />
                <span className="font-bold text-sm text-slate-800 flex-1">{preset.name}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                  preset.type === 'paid' ? 'bg-amber-50 text-amber-600' :
                  preset.type === 'organic' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {preset.type === 'paid' ? 'Платный' : preset.type === 'organic' ? 'Органика' : 'Реферал'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Название канала</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Например: Telegram Ads"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Тип</label>
              <div className="flex gap-2">
                {[
                  { value: 'paid', label: 'Платный' },
                  { value: 'organic', label: 'Органика' },
                  { value: 'referral', label: 'Реферал' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                      type === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Цвет</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-xl transition-all ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => name.trim() && onSave(name.trim(), type, color)}
              disabled={!name.trim()}
              className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-2"
            >
              Добавить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddChannelModal;
