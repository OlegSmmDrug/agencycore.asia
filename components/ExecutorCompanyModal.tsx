import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ExecutorCompany, executorCompanyService } from '../services/executorCompanyService';

interface ExecutorCompanyModalProps {
  executor: ExecutorCompany | null;
  onClose: () => void;
  onSaved: () => void;
}

const ExecutorCompanyModal: React.FC<ExecutorCompanyModalProps> = ({
  executor,
  onClose,
  onSaved
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    shortName: '',
    legalName: '',
    bin: '',
    phone: '',
    email: '',
    website: '',
    regAddress: '',
    legalAddress: '',
    directorName: '',
    directorPosition: '',
    authorityBasis: '',
    bankName: '',
    iban: '',
    bik: '',
    isDefault: false
  });

  useEffect(() => {
    if (executor) {
      setFormData({
        shortName: executor.shortName,
        legalName: executor.legalName,
        bin: executor.bin,
        phone: executor.phone || '',
        email: executor.email || '',
        website: executor.website || '',
        regAddress: executor.regAddress || '',
        legalAddress: executor.legalAddress || '',
        directorName: executor.directorName,
        directorPosition: executor.directorPosition,
        authorityBasis: executor.authorityBasis || '',
        bankName: executor.bankName || '',
        iban: executor.iban || '',
        bik: executor.bik || '',
        isDefault: executor.isDefault
      });
    }
  }, [executor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.shortName.trim() || !formData.legalName.trim() || !formData.bin.trim()) {
      alert('Заполните обязательные поля');
      return;
    }

    setIsSaving(true);
    try {
      if (executor) {
        await executorCompanyService.update(executor.id, formData);
      } else {
        await executorCompanyService.create(formData as any);
      }
      onSaved();
    } catch (error) {
      console.error('Error saving executor company:', error);
      alert('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {executor ? 'Редактировать организацию' : 'Добавить организацию'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Краткое название *
                </label>
                <input
                  type="text"
                  value={formData.shortName}
                  onChange={e => handleChange('shortName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юридическое название *
                </label>
                <input
                  type="text"
                  value={formData.legalName}
                  onChange={e => handleChange('legalName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  БИН/ИИН *
                </label>
                <input
                  type="text"
                  value={formData.bin}
                  onChange={e => handleChange('bin', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Веб-сайт
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => handleChange('website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Адрес регистрации
                </label>
                <input
                  type="text"
                  value={formData.regAddress}
                  onChange={e => handleChange('regAddress', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юридический адрес
                </label>
                <input
                  type="text"
                  value={formData.legalAddress}
                  onChange={e => handleChange('legalAddress', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ФИО директора *
                </label>
                <input
                  type="text"
                  value={formData.directorName}
                  onChange={e => handleChange('directorName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Должность директора *
                </label>
                <input
                  type="text"
                  value={formData.directorPosition}
                  onChange={e => handleChange('directorPosition', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Основание полномочий
                </label>
                <input
                  type="text"
                  value={formData.authorityBasis}
                  onChange={e => handleChange('authorityBasis', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Устав / Уведомление №..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Банк
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={e => handleChange('bankName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ИИК (IBAN)
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={e => handleChange('iban', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  БИК
                </label>
                <input
                  type="text"
                  value={formData.bik}
                  onChange={e => handleChange('bik', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={e => handleChange('isDefault', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                Использовать по умолчанию
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExecutorCompanyModal;
