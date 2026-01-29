
import React, { useState } from 'react';
import { AIAgent, FAQItem, DocumentItem } from '../../types';
import { aiKnowledgeService } from '../../services/aiKnowledgeService';

interface KnowledgeBaseProps {
  agents: AIAgent[];
  onUpdate: (agentId: string, faqs: FAQItem[], docs: DocumentItem[]) => void;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ agents, onUpdate }) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const agent = agents.find(a => a.id === selectedAgentId);

  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  const addFAQ = async () => {
    if (!agent || !newQuestion || !newAnswer) return;

    try {
      await aiKnowledgeService.addFAQ(selectedAgentId, {
        question: newQuestion,
        answer: newAnswer,
        category: 'General'
      });

      const updatedFaqs = await aiKnowledgeService.getFAQs(selectedAgentId);
      onUpdate(selectedAgentId, updatedFaqs, agent.knowledgeBase.documents);

      setNewQuestion('');
      setNewAnswer('');
    } catch (error) {
      console.error('Error adding FAQ:', error);
    }
  };

  const removeFAQ = async (id: string) => {
    if (!agent) return;

    try {
      await aiKnowledgeService.deleteFAQ(id);
      const updatedFaqs = await aiKnowledgeService.getFAQs(selectedAgentId);
      onUpdate(selectedAgentId, updatedFaqs, agent.knowledgeBase.documents);
    } catch (error) {
      console.error('Error removing FAQ:', error);
    }
  };

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-3xl font-black text-gray-900">Intelligence Center</h3>
          <p className="text-gray-500 font-medium">Обучите своих агентов специфике вашего продукта</p>
        </div>
        <select 
          value={selectedAgentId} 
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="bg-white border rounded-2xl px-6 py-3 font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
        >
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white p-8 rounded-3xl border shadow-sm">
            <h4 className="text-lg font-black mb-6 uppercase tracking-wider flex items-center gap-2">
              <span className="text-indigo-600">Q&A</span> База данных (FAQ)
            </h4>
            
            <div className="space-y-4 mb-8">
              {agent?.knowledgeBase.faqs.map(faq => (
                <div key={faq.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group relative">
                   <p className="text-xs font-black text-indigo-500 uppercase mb-1">Вопрос:</p>
                   <p className="font-bold text-gray-800 mb-2">{faq.question}</p>
                   <p className="text-xs font-black text-gray-400 uppercase mb-1">Ответ:</p>
                   <p className="text-sm text-gray-600">{faq.answer}</p>
                   <button 
                     onClick={() => removeFAQ(faq.id)}
                     className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                   >
                     Удалить
                   </button>
                </div>
              ))}
              {agent?.knowledgeBase.faqs.length === 0 && (
                <div className="text-center py-10 text-gray-400 font-medium border-2 border-dashed rounded-3xl">
                  База вопросов пуста. Добавьте первый вопрос ниже.
                </div>
              )}
            </div>

            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-200">
               <input 
                 value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                 placeholder="Введите вопрос (например: Какие сроки доставки?)"
                 className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
               />
               <textarea 
                 value={newAnswer} onChange={e => setNewAnswer(e.target.value)}
                 placeholder="Введите ответ ИИ..."
                 className="w-full border rounded-xl px-4 py-3 text-sm h-32 resize-none focus:outline-none"
               />
               <button 
                 onClick={addFAQ}
                 className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
               >
                 Добавить в базу знаний
               </button>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-[#1e1e2d] text-white p-8 rounded-3xl shadow-xl">
             <h4 className="text-lg font-black mb-4 uppercase">Документация (RAG)</h4>
             <p className="text-sm text-gray-400 mb-6 leading-relaxed">Загрузите PDF или DOCX регламенты. ИИ будет индексировать их автоматически для поиска ответов.</p>
             <div className="border-2 border-dashed border-gray-700 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 hover:border-indigo-500 transition-all cursor-pointer">
                <span className="text-4xl">📎</span>
                <span className="text-xs font-bold uppercase tracking-widest opacity-60">Загрузить файл</span>
             </div>
             <div className="mt-6 space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <span className="text-xl">📄</span>
                      <div>
                        <p className="text-xs font-bold truncate w-32">Регламент_Прод.pdf</p>
                        <p className="text-[10px] opacity-40">1.2 MB • Индексировано</p>
                      </div>
                   </div>
                   <button className="text-red-400 text-xs">×</button>
                </div>
             </div>
          </section>

          <section className="bg-white p-6 rounded-3xl border shadow-sm">
             <h4 className="text-sm font-black mb-2 uppercase tracking-widest text-gray-400">Статистика обучения</h4>
             <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <span className="text-xs font-bold">Объем памяти</span>
                   <span className="text-lg font-black">24 / 500 MB</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-500" style={{ width: '5%' }}></div>
                </div>
                <p className="text-[10px] text-gray-400 leading-tight italic">
                   "Чем больше данных в базе, тем точнее ответы агента. Gemini 3 Pro лучше справляется с большими документами."
                </p>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
