import React, { useState } from 'react';
import { MarketingChannel, MarketingSpend } from '../../../services/marketingChannelService';

interface SpendEntryModalProps {
  channel: MarketingChannel;
  month: string;
  existingData?: MarketingSpend;
  onSave: (channelId: string, month: string, data: Partial<MarketingSpend>) => void;
  onClose: () => void;
}

const SpendEntryModal: React.FC<SpendEntryModalProps> = ({
  channel, month, existingData, onSave, onClose,
}) => {
  const [amount, setAmount] = useState(existingData?.amount?.toString() || '');
  const [leadsCount, setLeadsCount] = useState(existingData?.leadsCount?.toString() || '');
  const [clicks, setClicks] = useState(existingData?.clicks?.toString() || '');
  const [impressions, setImpressions] = useState(existingData?.impressions?.toString() || '');
  const [conversions, setConversions] = useState(existingData?.conversions?.toString() || '');
  const [notes, setNotes] = useState(existingData?.notes || '');

  const handleSave = () => {
    onSave(channel.id, month, {
      amount: parseFloat(amount) || 0,
      leadsCount: parseInt(leadsCount) || 0,
      clicks: parseInt(clicks) || 0,
      impressions: parseInt(impressions) || 0,
      conversions: parseInt(conversions) || 0,
      notes,
    });
  };

  const monthLabel = new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-black text-lg text-slate-900">{channel.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{monthLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Расход (₸)', value: amount, setter: setAmount, type: 'number', placeholder: '0' },
            { label: 'Лиды', value: leadsCount, setter: setLeadsCount, type: 'number', placeholder: '0' },
            { label: 'Клики', value: clicks, setter: setClicks, type: 'number', placeholder: '0' },
            { label: 'Показы', value: impressions, setter: setImpressions, type: 'number', placeholder: '0' },
            { label: 'Конверсии', value: conversions, setter: setConversions, type: 'number', placeholder: '0' },
          ].map(field => (
            <div key={field.label}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{field.label}</label>
              <input
                type={field.type}
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Заметки</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>

          {parseFloat(amount) > 0 && parseInt(leadsCount) > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                <span>CPL (расчетный)</span>
                <span className="text-slate-900">{Math.round(parseFloat(amount) / parseInt(leadsCount)).toLocaleString()} ₸</span>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-slate-800 transition-all"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpendEntryModal;
