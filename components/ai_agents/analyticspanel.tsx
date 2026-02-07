
import React, { useState, useEffect } from 'react';
import { UsageStats, AIAgent } from '../../types';
import { aiCreditService, AiTransaction } from '../../services/aiCreditService';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface AnalyticsPanelProps {
  stats: UsageStats;
  agents: AIAgent[];
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ stats, agents }) => {
  const [transactions, setTransactions] = useState<AiTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setTxLoading(true);
    const data = await aiCreditService.getTransactionHistory(30);
    setTransactions(data);
    setTxLoading(false);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 bg-white p-8 rounded-3xl border shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
               Активность агентов (последние 7 дней)
               <select className="text-xs border rounded px-2 py-1">
                  <option>Все агенты</option>
                  <option>Системный мозг</option>
               </select>
            </h3>
            <div className="h-64 flex items-end gap-2 px-4 border-b border-l relative">
               {[40, 65, 30, 85, 90, 45, 70].map((h, i) => (
                 <div key={i} className="flex-1 bg-blue-500/10 rounded-t-lg relative group transition-all hover:bg-blue-500/30 cursor-pointer">
                    <div className="absolute bottom-0 left-0 right-0 bg-blue-600 rounded-t-lg transition-all" style={{ height: `${h}%` }}></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                       {Math.floor(h * 2.4)} запросов
                    </div>
                 </div>
               ))}
               <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-gray-400 font-bold px-2">
                  <span>ПН</span><span>ВТ</span><span>СР</span><span>ЧТ</span><span>ПТ</span><span>СБ</span><span>ВС</span>
               </div>
            </div>
         </div>

         <div className="bg-white p-8 rounded-3xl border shadow-sm flex flex-col">
            <h3 className="text-lg font-bold mb-6">Распределение бюджета</h3>
            <div className="flex-1 flex flex-col justify-center">
               <div className="relative w-40 h-40 mx-auto mb-6">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                     <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                     <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#4f46e5" strokeWidth="3" strokeDasharray="60, 100" />
                     <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="30, 100" strokeDashoffset="-60" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-2xl font-black text-gray-900">${stats.costSpent.toFixed(2)}</span>
                     <span className="text-[10px] text-gray-400 font-bold uppercase">Total</span>
                  </div>
               </div>
               <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                        <span className="text-gray-600">Claude 3.5 Sonnet</span>
                     </div>
                     <span className="font-bold">60%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span className="text-gray-600">Claude 3.5 Haiku</span>
                     </div>
                     <span className="font-bold">30%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                        <span className="text-gray-400">Other</span>
                     </div>
                     <span className="font-bold">10%</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <section className="bg-white p-8 rounded-3xl border">
         <h3 className="text-lg font-bold mb-6">Эффективность по агентам</h3>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                  <tr>
                     <th className="px-6 py-4">Агент</th>
                     <th className="px-6 py-4">Запросы</th>
                     <th className="px-6 py-4">Токены</th>
                     <th className="px-6 py-4">Стоимость</th>
                     <th className="px-6 py-4">Успешность</th>
                     <th className="px-6 py-4">Действия</th>
                  </tr>
               </thead>
               <tbody className="divide-y">
                  {agents.map(agent => (
                    <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">🤖</div>
                             <div>
                                <p className="font-bold text-gray-900">{agent.name}</p>
                                <p className="text-[10px] text-gray-400 uppercase">{agent.role}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-4 font-medium">842</td>
                       <td className="px-6 py-4 font-medium text-gray-400">124k</td>
                       <td className="px-6 py-4 font-bold text-green-600">$0.82</td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: '92%' }}></div>
                             </div>
                             <span className="text-[10px] font-bold">92%</span>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-800 font-bold">Детали</button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </section>

      <section className="bg-white p-8 rounded-3xl border">
        <h3 className="text-lg font-bold mb-6">История AI-операций</h3>
        {txLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">AI-операций пока нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Модель</th>
                  <th className="px-4 py-3">Запрос</th>
                  <th className="px-4 py-3">Токены (вх/вых)</th>
                  <th className="px-4 py-3">Кредиты</th>
                  <th className="px-4 py-3">Баланс</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map(tx => {
                  const isTopup = tx.model_slug === 'topup' || tx.model_slug === 'purchase' || tx.model_slug === 'admin_deduct';
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString('ru-RU')}{' '}
                        {new Date(tx.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {isTopup ? (
                          <span className="text-xs font-bold text-emerald-600">{tx.model_slug === 'purchase' ? 'Покупка' : tx.model_slug === 'topup' ? 'Зачисление' : 'Списание'}</span>
                        ) : (
                          <span className="text-xs font-mono text-gray-600">{tx.model_slug}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                        {tx.request_summary || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-600">
                        {isTopup ? '-' : `${tx.input_tokens.toLocaleString()} / ${tx.output_tokens.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                          isTopup && tx.markup_cost < 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {isTopup && tx.markup_cost < 0 ? (
                            <><ArrowUpCircle className="w-3 h-3" />+{Math.abs(tx.markup_cost).toFixed(4)}</>
                          ) : (
                            <><ArrowDownCircle className="w-3 h-3" />-{tx.markup_cost.toFixed(4)}</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {tx.balance_after.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AnalyticsPanel;
