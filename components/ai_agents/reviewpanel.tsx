
import React from 'react';
import { AIAction } from '../../types';

interface ReviewPanelProps {
  actions: AIAction[];
  onApprove: (action: AIAction) => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({ actions, onApprove }) => {
  const pendingActions = actions.filter(a => a.status === 'pending');

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
         <h3 className="text-xl font-bold">Действия на проверку ({pendingActions.length})</h3>
         <button className="text-sm bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-lg font-bold border border-indigo-100">История действий</button>
      </div>

      {pendingActions.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-dashed">
           <div className="text-5xl mb-4">✅</div>
           <p className="font-bold">Все действия проверены!</p>
           <p className="text-sm">Агенты работают в штатном режиме.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pendingActions.map(action => (
            <div key={action.id} className="bg-white border rounded-2xl p-6 flex flex-col md:flex-row gap-6 hover:shadow-lg transition-shadow">
               <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Action Pending</span>
                     <span className="text-xs text-gray-400">{new Date(action.createdAt).toLocaleString()}</span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{action.description}</h4>
                  <div className="bg-gray-50 p-4 rounded-xl mb-4">
                     <p className="text-xs font-bold text-gray-400 uppercase mb-2">Обоснование ИИ (Reasoning):</p>
                     <p className="text-sm text-gray-700 italic leading-relaxed">"{action.reasoning}"</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
                     <div className="flex items-center gap-1">
                        <span>🤖 Агент:</span>
                        <span className="text-indigo-600">{action.agentName}</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <span>🏷️ Тип:</span>
                        <span className="text-gray-900 uppercase">{action.actionType.replace('_', ' ')}</span>
                     </div>
                  </div>
               </div>
               <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-center">
                  <button
                    onClick={() => onApprove(action)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                  >
                    Одобрить и выполнить
                  </button>
                  <button className="bg-white text-red-600 border border-red-100 px-6 py-2 rounded-xl font-bold text-sm hover:bg-red-50">
                    Отклонить
                  </button>
                  <button className="text-xs text-gray-400 hover:text-gray-600 underline font-medium mt-2">Редактировать и обучить</button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;
