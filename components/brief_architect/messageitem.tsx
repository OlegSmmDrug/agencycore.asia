
import React from 'react';
import { Message } from '../types';

interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isAI = message.role === 'model';
  
  // Clean content from progress tags for the bubble, as they are tracked in the header
  const formattedContent = message.content.replace(/\[Прогресс.*?\]\s*\|\s*\[Статус.*?\]/, '').trim();

  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-8 animate-in slide-in-from-bottom-2 duration-300`}>
      <div 
        className={`max-w-[85%] rounded-xl p-5 shadow-sm transition-all ${
          isAI 
            ? 'bg-white border-l-4 border-l-indigo-600 border-y border-r border-slate-100 text-slate-800 rounded-tl-none' 
            : 'bg-slate-800 text-white rounded-tr-none'
        }`}
      >
        {isAI && (
          <div className="flex items-center space-x-2 mb-3 border-b border-slate-50 pb-2">
            <div className="bg-indigo-600 p-1 rounded">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Strategic Insight</span>
          </div>
        )}
        <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-[15px]">
          {formattedContent}
        </div>
        {!isAI && (
          <div className="mt-2 text-[10px] text-slate-400 text-right uppercase tracking-wider font-medium">
            Клиент: Ответ зафиксирован
          </div>
        )}
      </div>
    </div>
  );
};
