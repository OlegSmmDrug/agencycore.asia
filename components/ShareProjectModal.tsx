import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Calendar, ExternalLink, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { guestAccessService } from '../services/guestAccessService';
import { guestUserService } from '../services/guestUserService';
import { GuestAccess, GuestUser, Project } from '../types';

interface ShareProjectModalProps {
  project: Project;
  onClose: () => void;
  currentUserId: string;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  project,
  onClose,
  currentUserId
}) => {
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(null);
  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [managerContacts, setManagerContacts] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [isEditingContacts, setIsEditingContacts] = useState(false);

  useEffect(() => {
    loadGuestAccess();
    loadGuests();
  }, [project.id]);

  const loadGuestAccess = async () => {
    setIsLoading(true);
    try {
      const accesses = await guestAccessService.getGuestAccessByProject(project.id);
      if (accesses.length > 0) {
        setGuestAccess(accesses[0]);
        setIsEnabled(accesses[0].isActive);
        setPermissions(accesses[0].permissions);
        setManagerContacts({
          name: accesses[0].managerName || '',
          phone: accesses[0].managerPhone || '',
          email: accesses[0].managerEmail || ''
        });
      }
    } catch (error) {
      console.error('Error loading guest access:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGuests = async () => {
    try {
      const guestList = await guestUserService.getGuestsByProject(project.id);
      setGuests(guestList);
    } catch (error) {
      console.error('Error loading guests:', error);
    }
  };

  const generateLink = async () => {
    try {
      const newAccess = await guestAccessService.createGuestAccess(
        project.id,
        currentUserId
      );
      setGuestAccess(newAccess);
      setIsEnabled(true);
    } catch (error) {
      console.error('Error generating link:', error);
    }
  };

  const toggleAccess = async () => {
    if (!guestAccess) return;

    try {
      if (isEnabled) {
        await guestAccessService.deactivateGuestAccess(guestAccess.id);
      } else {
        await guestAccessService.reactivateGuestAccess(guestAccess.id);
      }
      setIsEnabled(!isEnabled);
      await loadGuestAccess();
    } catch (error) {
      console.error('Error toggling access:', error);
    }
  };

  const copyLink = () => {
    if (!guestAccess) return;

    const link = `${window.location.origin}/guest/project/${guestAccess.token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePermission = async (permission: string) => {
    if (!guestAccess) return;

    const newPermissions = permissions.includes(permission)
      ? permissions.filter(p => p !== permission)
      : [...permissions, permission];

    try {
      await guestAccessService.updatePermissions(guestAccess.id, newPermissions as any);
      setPermissions(newPermissions);
      await loadGuestAccess();
    } catch (error) {
      console.error('Error updating permissions:', error);
    }
  };

  const handleSaveManagerContacts = async () => {
    if (!guestAccess) return;

    try {
      await guestAccessService.updateManagerContacts(
        guestAccess.id,
        managerContacts.name,
        managerContacts.phone,
        managerContacts.email
      );
      setIsEditingContacts(false);
      await loadGuestAccess();
    } catch (error) {
      console.error('Error updating manager contacts:', error);
    }
  };

  const getShareLink = () => {
    if (!guestAccess) return '';
    return `${window.location.origin}/guest/project/${guestAccess.token}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-8 border-b-2 border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Поделиться проектом с клиентом</h2>
            <p className="text-sm text-gray-600 mt-2 font-semibold">{project.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all p-3 rounded-xl"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
              <p className="text-gray-600 mt-4 font-semibold">Загрузка...</p>
            </div>
          ) : (
            <>
              {!guestAccess ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center border-2 border-blue-200">
                  <ExternalLink className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Создать гостевую ссылку
                  </h3>
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    Создайте постоянную ссылку для доступа клиента к проекту. Он сможет просматривать и одобрять контент без входа в систему.
                  </p>
                  <button
                    onClick={generateLink}
                    className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    Создать ссылку
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-5 border-2 border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">Статус доступа</span>
                        {isEnabled ? (
                          <span className="px-4 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                            Активен
                          </span>
                        ) : (
                          <span className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                            Отключен
                          </span>
                        )}
                      </div>
                      <button
                        onClick={toggleAccess}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-200 transition-all border-2 border-gray-300 hover:border-gray-400"
                      >
                        {isEnabled ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-green-600" />
                            <span className="text-sm font-bold text-gray-700">Отключить</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                            <span className="text-sm font-bold text-gray-700">Включить</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
                      <label className="text-sm font-bold text-gray-800 mb-3 block uppercase tracking-wider">
                        Ссылка для клиента
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={getShareLink()}
                          readOnly
                          className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm text-gray-700 focus:outline-none font-semibold"
                        />
                        <button
                          onClick={copyLink}
                          className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg hover:shadow-xl hover:scale-105 ${
                            copied
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {copied ? (
                            <>
                              <Check className="w-5 h-5" />
                              <span className="text-sm">Скопировано!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-5 h-5" />
                              <span className="text-sm">Копировать</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-blue-900 mt-3 font-semibold">
                        Эта ссылка постоянная и будет работать до тех пор, пока вы не отключите её вручную.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-blue-300 transition-all shadow-md">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <span className="text-xs text-gray-600 font-bold uppercase">Создана</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{formatDate(guestAccess.createdAt)}</p>
                      </div>
                      <div className="bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-blue-300 transition-all shadow-md">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <span className="text-xs text-gray-600 font-bold uppercase">Последний доступ</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{formatDate(guestAccess.lastUsedAt)}</p>
                      </div>
                    </div>

                    <div className="border-t-2 border-gray-200 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-gray-600" />
                          <span className="text-base font-bold text-gray-800">Контакты менеджера</span>
                        </div>
                        {!isEditingContacts ? (
                          <button
                            onClick={() => setIsEditingContacts(true)}
                            className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            Редактировать
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setIsEditingContacts(false);
                                setManagerContacts({
                                  name: guestAccess?.managerName || '',
                                  phone: guestAccess?.managerPhone || '',
                                  email: guestAccess?.managerEmail || ''
                                });
                              }}
                              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            >
                              Отмена
                            </button>
                            <button
                              onClick={handleSaveManagerContacts}
                              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
                            >
                              Сохранить
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-600 font-bold uppercase mb-2 block">Имя менеджера</label>
                          {isEditingContacts ? (
                            <input
                              type="text"
                              value={managerContacts.name}
                              onChange={e => setManagerContacts({ ...managerContacts, name: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                              placeholder="Введите имя менеджера"
                            />
                          ) : (
                            <p className="text-sm text-gray-700 font-semibold px-4 py-3 bg-gray-50 rounded-xl">
                              {managerContacts.name || 'Не указано'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 font-bold uppercase mb-2 block">Телефон</label>
                          {isEditingContacts ? (
                            <input
                              type="tel"
                              value={managerContacts.phone}
                              onChange={e => setManagerContacts({ ...managerContacts, phone: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                              placeholder="+7 (777) 123-45-67"
                            />
                          ) : (
                            <p className="text-sm text-gray-700 font-semibold px-4 py-3 bg-gray-50 rounded-xl">
                              {managerContacts.phone || 'Не указано'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 font-bold uppercase mb-2 block">Email</label>
                          {isEditingContacts ? (
                            <input
                              type="email"
                              value={managerContacts.email}
                              onChange={e => setManagerContacts({ ...managerContacts, email: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                              placeholder="manager@example.com"
                            />
                          ) : (
                            <p className="text-sm text-gray-700 font-semibold px-4 py-3 bg-gray-50 rounded-xl">
                              {managerContacts.email || 'Не указано'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t-2 border-gray-200 pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Settings className="w-5 h-5 text-gray-600" />
                        <span className="text-base font-bold text-gray-800">Разрешения</span>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-bold text-gray-700 mb-3">Основные действия</p>
                          <div className="space-y-2">
                            {[
                              { key: 'viewTasks', label: 'Просмотр контента' },
                              { key: 'approveContent', label: 'Одобрение/отклонение контента' },
                              { key: 'addComments', label: 'Добавление комментариев' }
                            ].map(({ key, label }) => (
                              <label
                                key={key}
                                className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border-2 border-blue-200 hover:bg-blue-100 transition-all cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={permissions.includes(key)}
                                  onChange={() => togglePermission(key)}
                                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm font-semibold text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-gray-700 mb-3">Видимость вкладок</p>
                          <div className="space-y-2">
                            {[
                              { key: 'viewOverview', label: 'Обзор проекта' },
                              { key: 'viewRoadmap', label: 'Дорожная карта' },
                              { key: 'viewNotes', label: 'Заметки' },
                              { key: 'viewCalendar', label: 'Календарь контента' },
                              { key: 'viewFacebook', label: 'Facebook аналитика' },
                              { key: 'viewGoogle', label: 'Google Ads аналитика' },
                              { key: 'viewTikTok', label: 'TikTok Ads аналитика' },
                              { key: 'viewLivedune', label: 'Livedune аналитика' }
                            ].map(({ key, label }) => (
                              <label
                                key={key}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200 hover:bg-gray-100 transition-all cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={permissions.includes(key)}
                                  onChange={() => togglePermission(key)}
                                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm font-semibold text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {guests.length > 0 && (
                    <div className="border-t-2 border-gray-200 pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Users className="w-5 h-5 text-gray-600" />
                        <span className="text-base font-bold text-gray-800">
                          Зарегистрированные гости ({guests.length})
                        </span>
                      </div>
                      <div className="space-y-3">
                        {guests.map(guest => (
                          <div
                            key={guest.id}
                            className="flex items-center justify-between p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all"
                          >
                            <div>
                              <p className="text-sm font-bold text-gray-900">{guest.name}</p>
                              <p className="text-xs text-gray-600 mt-1">{guest.email}</p>
                            </div>
                            <span className="text-xs text-gray-500 font-semibold bg-white px-3 py-2 rounded-lg">
                              {formatDate(guest.lastAccessAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="p-8 border-t-2 border-gray-200 bg-gray-50 rounded-b-3xl">
          <button
            onClick={onClose}
            className="w-full px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 hover:border-gray-400 transition-all font-bold shadow-md hover:shadow-lg"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};