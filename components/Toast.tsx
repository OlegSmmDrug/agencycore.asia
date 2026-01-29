
import React, { useEffect } from 'react';
import { Notification } from '../types';

interface ToastContainerProps {
  notifications: Notification[];
  removeNotification: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ notifications, removeNotification }) => {
  return (
    <div aria-live="assertive" className="fixed inset-0 z-[100] flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-end space-y-4">
      {notifications.map((notif) => (
        <Toast key={notif.id} notification={notif} onClose={() => removeNotification(notif.id)} />
      ))}
    </div>
  );
};

const Toast: React.FC<{ notification: Notification; onClose: () => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [notification, onClose]);

  const bgColors = {
    success: 'bg-white border-l-4 border-green-500',
    info: 'bg-white border-l-4 border-blue-500',
    warning: 'bg-white border-l-4 border-orange-500',
  };

  const icons = {
    success: (
      <div className="flex-shrink-0">
        <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    info: (
      <div className="flex-shrink-0">
        <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    warning: (
      <div className="flex-shrink-0">
        <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    )
  };

  return (
    <div className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 transition-all transform animate-fade-in-up ${bgColors[notification.type]}`}>
      <div className="p-4">
        <div className="flex items-start">
          {icons[notification.type]}
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-slate-900">
              {notification.type === 'success' ? 'Успешно' : notification.type === 'info' ? 'Уведомление' : 'Внимание'}
            </p>
            <p className="mt-1 text-sm text-slate-500 break-words">{notification.message}</p>
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToastContainer;
