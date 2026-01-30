import React, { useState, useEffect } from 'react';

interface ProjectDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  duration: number;
  onSave: (startDate: string, duration: number) => void;
  onRenew: () => void;
}

const ProjectDatesModal: React.FC<ProjectDatesModalProps> = ({
  isOpen,
  onClose,
  startDate,
  duration,
  onSave,
  onRenew
}) => {
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempDuration, setTempDuration] = useState(duration);

  useEffect(() => {
    setTempStartDate(startDate);
    setTempDuration(duration);
  }, [startDate, duration]);

  if (!isOpen) return null;

  const calculateEndDate = () => {
    if (!tempStartDate) return '-';
    const start = new Date(tempStartDate);
    start.setDate(start.getDate() + tempDuration);
    return start.toLocaleDateString('ru-RU');
  };

  const handleSave = () => {
    onSave(tempStartDate, tempDuration);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Сроки проекта</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Начало
              </label>
              <input
                type="date"
                value={tempStartDate || ''}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-lg font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Срок (дней)
              </label>
              <input
                type="number"
                value={tempDuration || ''}
                onChange={(e) => setTempDuration(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-lg font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Окончание
            </label>
            <div className="px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl">
              <p className="text-lg font-bold text-slate-800">{calculateEndDate()}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Быстрый выбор срока
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setTempDuration(7)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                  tempDuration === 7
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                7 дней
              </button>
              <button
                onClick={() => setTempDuration(14)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                  tempDuration === 14
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                14 дней
              </button>
              <button
                onClick={() => setTempDuration(30)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                  tempDuration === 30
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                30 дней
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              onRenew();
              onClose();
            }}
            className="w-full px-6 py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Продлить текущий (+30 дней)</span>
          </button>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
            >
              Сохранить
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDatesModal;
