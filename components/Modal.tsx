
import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 transform transition-all scale-100`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5 flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">
            {title}
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="ms-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg
              className="h-3 w-3"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 14 14"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
              />
            </svg>
            <span className="sr-only">Close modal</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
