import React, { useState, useEffect } from 'react';
import { User, SystemRole } from '../types';
import { moduleAccessService } from '../services/moduleAccessService';

interface UserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (user: Partial<User>) => void;
  isCeo?: boolean;
  availableJobTitles?: string[];
  onAddJobTitle?: (title: string) => void;
}

interface PlatformModule {
  slug: string;
  name: string;
  icon: string;
  description: string;
}

const parseBirthdayFromIIN = (iin: string): string | null => {
  const digits = iin.replace(/\D/g, '');
  if (digits.length < 7) return null;

  const yy = parseInt(digits.substring(0, 2), 10);
  const mm = parseInt(digits.substring(2, 4), 10);
  const dd = parseInt(digits.substring(4, 6), 10);
  const century = parseInt(digits.substring(6, 7), 10);

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  let year: number;
  if (century >= 1 && century <= 6) {
    if (century <= 2) year = 1800 + yy;
    else if (century <= 4) year = 1900 + yy;
    else year = 2000 + yy;
  } else {
    year = yy >= 50 ? 1900 + yy : 2000 + yy;
  }

  const monthStr = String(mm).padStart(2, '0');
  const dayStr = String(dd).padStart(2, '0');

  const testDate = new Date(year, mm - 1, dd);
  if (testDate.getFullYear() !== year || testDate.getMonth() !== mm - 1 || testDate.getDate() !== dd) {
    return null;
  }

  return `${year}-${monthStr}-${dayStr}`;
};

const formatBirthdayDisplay = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const getAgeFromBirthday = (dateStr: string): number => {
  const today = new Date();
  const birth = new Date(dateStr + 'T00:00:00');
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const UserModal: React.FC<UserModalProps> = ({ isOpen, user, onClose, onSave, isCeo, availableJobTitles = [], onAddJobTitle }) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [isAddingNewTitle, setIsAddingNewTitle] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [availableModules, setAvailableModules] = useState<PlatformModule[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadAvailableModules();
    }

    if (user) {
      setFormData({ ...user });
    } else {
      setFormData({
        name: '',
        email: '',
        avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150',
        systemRole: SystemRole.MEMBER,
        jobTitle: availableJobTitles[0] || 'CEO',
        allowedModules: [],
        salary: 0,
        iin: '',
        balance: 0,
        password: '123456'
      });
    }
    setIsAddingNewTitle(false);
    setNewJobTitle('');
  }, [user, isOpen, availableJobTitles]);

  const loadAvailableModules = async () => {
    const modules = await moduleAccessService.getAllModules();
    setAvailableModules(modules.map((m: any) => ({
      slug: m.slug,
      name: m.name,
      icon: m.icon,
      description: m.description
    })));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleModuleToggle = (module: string) => {
    const current = formData.allowedModules || [];
    if (current.includes(module)) {
      setFormData({ ...formData, allowedModules: current.filter(m => m !== module) });
    } else {
      setFormData({ ...formData, allowedModules: [...current, module] });
    }
  };

  const handleAddNewJobTitle = () => {
    if (newJobTitle.trim() && onAddJobTitle) {
      onAddJobTitle(newJobTitle.trim());
      setFormData({ ...formData, jobTitle: newJobTitle.trim() });
      setIsAddingNewTitle(false);
      setNewJobTitle('');
    }
  };

  const handleIINChange = (value: string) => {
    const cleaned = value.replace(/[^0-9\s]/g, '');
    const birthday = parseBirthdayFromIIN(cleaned);
    setFormData({ ...formData, iin: cleaned, birthday: birthday || formData.birthday });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {user ? 'Редактировать сотрудника' : 'Новый сотрудник'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Имя</label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email || ''}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Должность</label>
            {isAddingNewTitle ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newJobTitle}
                  onChange={e => setNewJobTitle(e.target.value)}
                  placeholder="Введите название должности"
                  className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                  onKeyPress={e => e.key === 'Enter' && handleAddNewJobTitle()}
                />
                <button
                  type="button"
                  onClick={handleAddNewJobTitle}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingNewTitle(false); setNewJobTitle(''); }}
                  className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-300"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={formData.jobTitle || ''}
                  onChange={e => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  {availableJobTitles.map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
                {onAddJobTitle && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNewTitle(true)}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 whitespace-nowrap"
                    title="Добавить новую должность"
                  >
                    + Новая
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Системная роль</label>
            <select
              value={formData.systemRole || SystemRole.MEMBER}
              onChange={e => setFormData({ ...formData, systemRole: e.target.value as SystemRole })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              {Object.values(SystemRole).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Оклад</label>
              <input
                type="number"
                value={formData.salary || 0}
                onChange={e => {
                  const val = Number(e.target.value);
                  setFormData({ ...formData, salary: isNaN(val) ? 0 : val });
                }}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ИИН</label>
              <input
                type="text"
                value={formData.iin || ''}
                onChange={e => handleIINChange(e.target.value)}
                placeholder="Введите ИИН"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
              {formData.birthday && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-sm text-emerald-700 font-medium">
                    {formatBirthdayDisplay(formData.birthday)}
                  </span>
                  <span className="text-xs text-emerald-500">
                    ({getAgeFromBirthday(formData.birthday)} лет)
                  </span>
                </div>
              )}
              {formData.iin && formData.iin.replace(/\D/g, '').length >= 7 && !parseBirthdayFromIIN(formData.iin) && (
                <p className="mt-1 text-xs text-red-500">Некорректный ИИН -- не удалось определить дату рождения</p>
              )}
            </div>
          </div>

          {isCeo && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Пароль для входа</label>
              <input
                type="text"
                value={formData.password || ''}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="Введите пароль"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Пароль для авторизации сотрудника в системе</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Доступ к модулям</label>
            <div className="flex flex-wrap gap-2">
              {availableModules.map(module => (
                <button
                  key={module.slug}
                  type="button"
                  onClick={() => handleModuleToggle(module.slug)}
                  title={module.description}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    (formData.allowedModules || []).includes(module.slug)
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {module.name}
                </button>
              ))}
            </div>
            {availableModules.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">Загрузка модулей...</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL аватара</label>
            <input
              type="url"
              value={formData.avatar || ''}
              onChange={e => setFormData({ ...formData, avatar: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
