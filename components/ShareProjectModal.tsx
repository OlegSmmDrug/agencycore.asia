import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Calendar, ExternalLink, Link2, Shield, Eye, User, Mail, Phone, Send, Loader2 } from 'lucide-react';
import { guestAccessService } from '../services/guestAccessService';
import { guestUserService } from '../services/guestUserService';
import { GuestAccess, GuestUser, Project, User as UserType } from '../types';

interface ShareProjectModalProps {
  project: Project;
  onClose: () => void;
  currentUserId: string;
  currentUser?: UserType;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  project,
  onClose,
  currentUserId,
  currentUser
}) => {
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(null);
  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [managerContacts, setManagerContacts] = useState({ name: '', phone: '', email: '' });
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [activeSection, setActiveSection] = useState<'link' | 'permissions' | 'manager' | 'guests'>('link');

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
        const hasManagerData = accesses[0].managerName || accesses[0].managerPhone || accesses[0].managerEmail;
        if (hasManagerData) {
          setManagerContacts({
            name: accesses[0].managerName || '',
            phone: accesses[0].managerPhone || '',
            email: accesses[0].managerEmail || ''
          });
        } else if (currentUser) {
          const autoContacts = {
            name: currentUser.name || '',
            phone: currentUser.phone || '',
            email: currentUser.email || ''
          };
          setManagerContacts(autoContacts);
          guestAccessService.updateManagerContacts(
            accesses[0].id,
            autoContacts.name,
            autoContacts.phone,
            autoContacts.email
          ).catch(() => {});
        }
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
      const newAccess = await guestAccessService.createGuestAccess(project.id, currentUserId);
      setGuestAccess(newAccess);
      setIsEnabled(true);
      setPermissions(newAccess.permissions);
      if (currentUser) {
        const autoContacts = {
          name: currentUser.name || '',
          phone: currentUser.phone || '',
          email: currentUser.email || ''
        };
        setManagerContacts(autoContacts);
        guestAccessService.updateManagerContacts(
          newAccess.id,
          autoContacts.name,
          autoContacts.phone,
          autoContacts.email
        ).catch(() => {});
      }
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
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const sectionTabs = [
    { id: 'link' as const, label: 'Ссылка', icon: Link2 },
    { id: 'manager' as const, label: 'Менеджер', icon: User },
    { id: 'permissions' as const, label: 'Разрешения', icon: Shield },
    { id: 'guests' as const, label: `Гости${guests.length ? ` (${guests.length})` : ''}`, icon: Users },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Поделиться проектом</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{project.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : !guestAccess ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Клиентский портал</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">
                Создайте ссылку для клиента. Он сможет просматривать проект, одобрять контент и отслеживать прогресс.
              </p>
              <button
                onClick={generateLink}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm"
              >
                Создать ссылку
              </button>
            </div>
          ) : (
            <>
              <div className="px-6 pt-5 pb-3">
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-semibold text-slate-700">
                      {isEnabled ? 'Портал активен' : 'Портал отключен'}
                    </span>
                  </div>
                  <button
                    onClick={toggleAccess}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="px-6 py-2 flex gap-1 border-b border-slate-100">
                {sectionTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeSection === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-5">
                {activeSection === 'link' && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                        Ссылка для клиента
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={getShareLink()}
                          readOnly
                          className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono truncate"
                        />
                        <button
                          onClick={copyLink}
                          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
                            copied
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {copied ? <><Check className="w-3.5 h-3.5" /> Готово</> : <><Copy className="w-3.5 h-3.5" /> Копировать</>}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        Ссылка постоянная. Работает пока вы не отключите доступ.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Создана</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800">{formatDate(guestAccess.createdAt)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Eye className="w-3 h-3 text-slate-400" />
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Последний визит</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800">
                          {guestAccess.lastUsedAt ? formatDate(guestAccess.lastUsedAt) : 'Ещё не заходили'}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'manager' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Контакты менеджера</p>
                      {!isEditingContacts ? (
                        <button
                          onClick={() => setIsEditingContacts(true)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
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
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={handleSaveManagerContacts}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            Сохранить
                          </button>
                        </div>
                      )}
                    </div>

                    {!isEditingContacts && managerContacts.name ? (
                      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {getInitials(managerContacts.name)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{managerContacts.name}</p>
                            <p className="text-xs text-slate-500">Аккаунт-менеджер</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {managerContacts.email && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {managerContacts.email}
                            </div>
                          )}
                          {managerContacts.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {managerContacts.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : !isEditingContacts ? (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                        <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Контакты менеджера не заполнены</p>
                        <button
                          onClick={() => setIsEditingContacts(true)}
                          className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Заполнить
                        </button>
                      </div>
                    ) : null}

                    {isEditingContacts && (
                      <div className="space-y-3">
                        {[
                          { key: 'name', label: 'Имя менеджера', placeholder: 'Алексей Иванов', type: 'text' },
                          { key: 'phone', label: 'Телефон', placeholder: '+7 (701) 123-45-67', type: 'tel' },
                          { key: 'email', label: 'Email', placeholder: 'manager@agency.com', type: 'email' }
                        ].map(field => (
                          <div key={field.key}>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{field.label}</label>
                            <input
                              type={field.type}
                              value={managerContacts[field.key as keyof typeof managerContacts]}
                              onChange={e => setManagerContacts({ ...managerContacts, [field.key]: e.target.value })}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              placeholder={field.placeholder}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'permissions' && (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-4 bg-blue-600 rounded-full" />
                        <p className="text-xs font-bold text-slate-800">Основные действия</p>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { key: 'viewTasks', label: 'Просмотр контента' },
                          { key: 'approveContent', label: 'Одобрение/отклонение' },
                          { key: 'addComments', label: 'Комментарии' }
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions.includes(key)}
                              onChange={() => togglePermission(key)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700 font-medium">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                        <p className="text-xs font-bold text-slate-800">Видимость вкладок</p>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { key: 'viewOverview', label: 'Обзор проекта' },
                          { key: 'viewRoadmap', label: 'Дорожная карта' },
                          { key: 'viewNotes', label: 'Заметки' },
                          { key: 'viewCalendar', label: 'Контент-календарь' },
                          { key: 'viewFacebook', label: 'Facebook Ads' },
                          { key: 'viewGoogle', label: 'Google Ads' },
                          { key: 'viewTikTok', label: 'TikTok Ads' },
                          { key: 'viewLivedune', label: 'Instagram аналитика' }
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions.includes(key)}
                              onChange={() => togglePermission(key)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700 font-medium">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'guests' && (
                  <div>
                    {guests.length === 0 ? (
                      <div className="text-center py-10">
                        <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm text-slate-400 font-medium">Ещё никто не зарегистрировался</p>
                        <p className="text-xs text-slate-300 mt-1">Гости появятся после перехода по ссылке</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {guests.map(guest => (
                          <div key={guest.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                                {getInitials(guest.name)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{guest.name}</p>
                                <p className="text-xs text-slate-400">{guest.email}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatDate(guest.lastAccessAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
