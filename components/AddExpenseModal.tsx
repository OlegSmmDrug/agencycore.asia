import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { calculatorService } from '../services/calculatorService';
import { ServiceItem } from './ServiceCalculator';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  onAdd: (service: ServiceItem, count: number, rate: number) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  onAdd,
}) => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [count, setCount] = useState<number>(1);
  const [customRate, setCustomRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadServices();
    }
  }, [isOpen, categoryId]);

  useEffect(() => {
    if (selectedService) {
      const defaultRate = selectedService.costPrice
        ? Number(selectedService.costPrice)
        : Math.round(Number(selectedService.price) * 0.6);
      setCustomRate(defaultRate);
    }
  }, [selectedService]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const allServices = await calculatorService.getAll();
      const filtered = allServices.filter(s => s.category === categoryId);
      setServices(filtered);
      if (filtered.length > 0) {
        setSelectedService(filtered[0]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!selectedService) return;
    onAdd(selectedService, count, customRate);
    handleClose();
  };

  const handleClose = () => {
    setSelectedService(null);
    setCount(1);
    setCustomRate(0);
    onClose();
  };

  if (!isOpen) return null;

  const totalCost = count * customRate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Добавить расход</h2>
            <p className="text-sm text-blue-100 mt-1">{categoryName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Нет доступных услуг в этой категории</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Выберите услугу
                </label>
                <select
                  value={selectedService?.id || ''}
                  onChange={(e) => {
                    const service = services.find(s => s.id === e.target.value);
                    setSelectedService(service || null);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Количество
                </label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                  min="1"
                  step="1"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Ставка (₸)
                </label>
                <input
                  type="number"
                  value={customRate}
                  onChange={(e) => setCustomRate(Number(e.target.value))}
                  min="0"
                  step="1000"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Себестоимость по умолчанию: {selectedService?.costPrice || Math.round(Number(selectedService?.price || 0) * 0.6)} ₸
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Итого:</span>
                  <span className="text-2xl font-bold text-blue-700">{totalCost.toLocaleString()} ₸</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 text-right">
                  {count} × {customRate.toLocaleString()} ₸
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedService || loading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
};
