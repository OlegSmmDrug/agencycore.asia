
import React from 'react';
import { User, SystemRole } from '../types';
import UserAvatar from './UserAvatar';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onReset: () => void;
  onUpdateUser: (user: User) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, currentUser, isOpen, onClose, onLogout, onReset, onUpdateUser }) => {

  // Menu items definition
  const allMenuItems = [
    { 
      id: 'dashboard', 
      label: 'Дашборд', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
      )
    },
    { 
      id: 'calculator', 
      label: 'Калькулятор', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      )
    },
    { 
      id: 'analytics', 
      label: 'Аналитика', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      )
    },
    { 
      id: 'crm', 
      label: 'CRM', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      )
    },
    { 
      id: 'projects', 
      label: 'Проекты', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      )
    },
    {
      id: 'tasks',
      label: 'Задачи',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
      )
    },
    {
      id: 'notes',
      label: 'Заметки',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      )
    },
    {
      id: 'knowledge',
      label: 'База знаний',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
      )
    },
    {
      id: 'documents',
      label: 'Документы',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )
    },
    {
      id: 'team',
      label: 'Команда',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      )
    },
    {
      id: 'integrations',
      label: 'Интеграции',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      )
    },
    {
      id: 'ai-agents',
      label: 'ИИ-Агенты',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      )
    },
    {
      id: 'brief-architect',
      label: 'Архитектор брифов',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
      )
    },
    {
      id: 'settings',
      label: 'Настройки',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      )
    }
  ];

  // Filter items based on user allowed modules
  // Admin sees everything
  const menuItems = allMenuItems.filter(item => {
    if (!currentUser) return false;
    if (currentUser.systemRole === SystemRole.ADMIN) return true;
    return currentUser.allowedModules.includes(item.id);
  });

  return (
    <>
      {/* Mobile Backdrop - z-30 to be under sidebar but over content */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container - z-40 to be under modals (z-50) but over backdrop and content */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 text-slate-300 z-40 
        transform transition-transform duration-300 ease-in-out border-r border-slate-800 shadow-2xl lg:static lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 md:p-8 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg mr-3 flex items-center justify-center">
               <span className="text-white text-lg font-bold">A</span>
            </div>
            AgencyCore
          </h1>
          {/* Close button (Mobile only) */}
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar h-[calc(100vh-180px)]">
          <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 mt-4">Меню</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose(); // Close drawer on mobile selection
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={`${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'}`}>
                  {item.icon}
              </span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {currentUser && (
           <>
             <div className="absolute bottom-0 left-0 w-full p-4 bg-slate-900 border-t border-slate-800">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm p-3">
                  <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          setActiveTab('settings');
                          onClose();
                        }}
                        className="flex items-center space-x-3 overflow-hidden hover:bg-slate-700/50 rounded-lg p-2 -m-2 transition-all flex-1 group"
                        title="Настройки профиля"
                      >
                          <div className="relative flex-shrink-0">
                              <UserAvatar src={currentUser.avatar} name={currentUser.name} className="border border-slate-600 group-hover:border-blue-500 transition-colors" size="md" />
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-800 rounded-full"></div>
                          </div>
                          <div className="overflow-hidden text-left">
                               <p className="text-sm text-white font-semibold truncate group-hover:text-blue-400 transition-colors">{currentUser.name}</p>
                               <p className="text-[10px] text-slate-400 truncate group-hover:text-slate-300 transition-colors">{currentUser.jobTitle}</p>
                          </div>
                      </button>
                      <div className="flex space-x-1 ml-2">
                          <button
                              onClick={onReset}
                              className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Сброс данных (Очистить)"
                          >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                          <button
                              onClick={onLogout}
                              className="text-slate-500 hover:text-white p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Выйти"
                          >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                          </button>
                      </div>
                  </div>
                </div>
             </div>
           </>
        )}
      </div>
    </>
  );
};

export default Sidebar;
