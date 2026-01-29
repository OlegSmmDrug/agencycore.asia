
import React, { useState, useEffect } from 'react';
import { Client, ClientStatus, User, Transaction, PaymentType, SystemRole } from '../types';
import { CLIENT_STATUS_LABELS } from '../constants';
import { getAvailableManagers } from '../services/leadDistributionService';
import { crmPipelineStagesService, CrmPipelineStage } from '../services/crmPipelineStagesService';
import { useOrganization } from './OrganizationProvider';

interface ClientBoardProps {
  clients: Client[];
  users: User[];
  currentUser?: User;
  transactions?: Transaction[];
  onClientStatusChange: (clientId: string, newStatus: ClientStatus) => void;
  onClientClick: (client: Client) => void;
  onAddClient: () => void;
  onAddTransaction?: () => void;
  onArchiveClient: (clientId: string, archive: boolean) => void;
  onUpdateTransaction?: (transactionId: string, amount: number) => void;
  onDeleteTransaction?: (transactionId: string) => void;
}

const ClientBoard: React.FC<ClientBoardProps> = ({ clients, users, currentUser, transactions = [], onClientStatusChange, onClientClick, onAddClient, onAddTransaction, onArchiveClient, onUpdateTransaction, onDeleteTransaction }) => {
  const { organization: currentOrganization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('all');
  const [viewScope, setViewScope] = useState<'active' | 'archive' | 'transactions'>('active');
  const [editingTransaction, setEditingTransaction] = useState<{id: string, amount: number} | null>(null);
  const [pipelineStages, setPipelineStages] = useState<CrmPipelineStage[]>([]);
  const [showStageManager, setShowStageManager] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadPipelineStages();
    }
  }, [currentOrganization?.id]);

  const loadPipelineStages = async () => {
    if (!currentOrganization?.id) return;
    const stages = await crmPipelineStagesService.getActiveStages(currentOrganization.id);
    setPipelineStages(stages);
  };

  const filteredClients = clients.filter(client => {
      if (viewScope === 'active' && client.isArchived) return false;
      if (viewScope === 'archive' && !client.isArchived) return false;
      if (viewScope === 'transactions') return true; // Not used for filtering clients directly

      const matchesSearch = client.company.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            client.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = selectedSource === 'all' || client.source === selectedSource;
      const matchesManager = selectedManagerId === 'all' || client.managerId === selectedManagerId;
      
      return matchesSearch && matchesSource && matchesManager;
  });

  const columns = pipelineStages.map(stage => ({
    id: stage.statusKey,
    label: stage.label,
    color: stage.color
  }));

  const totalIncome = transactions.reduce((acc, t) => acc + t.amount, 0);
  const totalPrepaymentOnly = transactions
        .filter(t => t.type === PaymentType.PREPAYMENT)
        .reduce((acc, t) => acc + t.amount, 0);

  const activeDeals = clients.filter(c => c.status !== ClientStatus.LOST && !c.isArchived);
  const totalDealsSum = activeDeals.reduce((acc, c) => acc + c.budget, 0);
  const potentialRemaining = totalDealsSum - totalIncome;

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    e.dataTransfer.setData('clientId', clientId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, status: ClientStatus) => {
    e.preventDefault();
    const clientId = e.dataTransfer.getData('clientId');
    if (clientId) {
      onClientStatusChange(clientId, status);
    }
  };

  const uniqueSources = Array.from(new Set(clients.map(c => c.source)));

  const renderBoard = () => (
    <div className="flex flex-1 overflow-x-auto overflow-y-hidden pb-4 gap-4 snap-x snap-mandatory h-full">
        {columns.map((col) => {
            const columnClients = filteredClients.filter(c => c.status === col.id);
            const columnTotal = columnClients.reduce((acc, c) => acc + c.budget, 0);

            return (
                <div 
                    key={col.id} 
                    className={`flex-shrink-0 w-[85vw] md:w-80 flex flex-col h-full rounded-2xl bg-slate-100/50 border border-slate-200/60 overflow-hidden snap-center`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                >
                <div className={`p-4 bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10 ${col.color}`}>
                    <h3 className="font-bold text-slate-800 flex justify-between items-center mb-1 text-sm">
                        <span className="truncate mr-2" title={col.label}>{col.label}</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-semibold text-slate-500 border border-slate-200">
                        {columnClients.length}
                        </span>
                    </h3>
                    {columnTotal > 0 && (
                        <div className="text-[11px] font-semibold text-slate-400 mt-1">
                            Потенциал: <span className="text-slate-700">{columnTotal.toLocaleString()} ₸</span>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                    {columnClients.map((client) => (
                    <div 
                        key={client.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, client.id)}
                        onClick={() => onClientClick(client)}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer lg:cursor-grab active:cursor-grabbing group relative"
                    >
                        <div className="absolute top-3 right-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                            client.source === 'Website' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                            client.source === 'Creatium' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 font-bold' :
                            client.source === 'Referral' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-gray-50 text-gray-500 border-gray-100'
                        }`}>
                            {client.source === 'Website' ? 'Сайт' : client.source}
                        </span>
                        </div>

                        <div className="pr-10 mb-2">
                             <h4 className="font-bold text-slate-800 text-sm line-clamp-1 mb-0.5" title={client.company}>{client.company}</h4>
                             <p className="text-xs text-slate-500 font-medium">{client.name}</p>
                        </div>

                        {(() => {
                            const manager = users.find(u => u.id === client.managerId);
                            if (manager) {
                                return (
                                    <div className="mb-3 flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                            {manager.name.charAt(0)}
                                        </div>
                                        <span className="text-[10px] text-slate-500 truncate">{manager.name}</span>
                                    </div>
                                );
                            }
                            return (
                                <div className="mb-3 flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-bold flex-shrink-0">?</div>
                                    <span className="text-[10px] text-slate-400">Не назначен</span>
                                </div>
                            );
                        })()}
                        
                        {client.service && (
                            <div className="mb-3">
                                <span className="px-2 py-1 bg-slate-50 rounded-md border border-slate-100 text-[10px] uppercase tracking-wide font-medium text-slate-600 inline-block">{client.service}</span>
                            </div>
                        )}

                        <div className="mb-3 flex items-center gap-3 text-[10px] text-slate-400">
                            <div className="flex items-center gap-1" title="Дата и время создания лида">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span>
                                    {new Date(client.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                    {' '}
                                    {new Date(client.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {client.statusChangedAt && client.statusChangedAt !== client.createdAt && (
                                <div className="flex items-center gap-1" title="На текущем этапе с">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>
                                        {new Date(client.statusChangedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                        {' '}
                                        {new Date(client.statusChangedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                           <div>
                               <p className="text-[10px] text-slate-400 font-medium uppercase">Сумма сделки</p>
                               <p className="text-sm font-bold text-slate-800">{client.budget.toLocaleString()} ₸</p>
                           </div>
                           <div className="flex items-center gap-1">
                               {client.phone && (
                                   <div
                                       className="p-2 rounded-lg text-green-500 hover:bg-green-50 transition-colors"
                                       title="WhatsApp доступен"
                                   >
                                       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                           <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                       </svg>
                                   </div>
                               )}
                           </div>
                        </div>
                    </div>
                    ))}
                    {columnClients.length === 0 && (
                        <div className="h-full flex items-center justify-center min-h-[100px]">
                            <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-xl w-full mx-2">
                                <p className="text-xs text-slate-400 font-medium">Нет лидов</p>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            );
        })}
    </div>
  );

  const renderArchiveList = () => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
          <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                      <tr>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Компания</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Контакт</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Статус</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Сумма сделки</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Дата создания</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Действия</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredClients.map(client => (
                          <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-bold text-slate-700 cursor-pointer" onClick={() => onClientClick(client)}>{client.company}</td>
                              <td className="p-4 cursor-pointer" onClick={() => onClientClick(client)}>
                                  <div className="text-sm font-medium">{client.name}</div>
                                  <div className="text-xs text-slate-400">{client.phone}</div>
                              </td>
                              <td className="p-4 cursor-pointer" onClick={() => onClientClick(client)}>
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${client.status === ClientStatus.WON ? 'bg-green-100 text-green-700' : client.status === ClientStatus.LOST ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                      {CLIENT_STATUS_LABELS[client.status]}
                                  </span>
                              </td>
                              <td className="p-4 font-mono text-sm cursor-pointer" onClick={() => onClientClick(client)}>{client.budget.toLocaleString()} ₸</td>
                              <td className="p-4 text-xs text-slate-500 cursor-pointer" onClick={() => onClientClick(client)}>{new Date(client.createdAt).toLocaleDateString()}</td>
                              <td className="p-4">
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Восстановить сделку из архива?')) {
                                              onArchiveClient(client.id, false);
                                          }
                                      }}
                                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-200"
                                  >
                                      Восстановить
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              {filteredClients.length === 0 && (
                  <div className="p-12 text-center text-slate-400">В архиве пока пусто</div>
              )}
          </div>
      </div>
  );

  const renderTransactionList = () => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in">
          <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                      <tr>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Дата</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Клиент</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Сумма</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Тип</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Описание</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Действия</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => {
                          const client = clients.find(c => c.id === t.clientId);
                          return (
                              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 text-sm text-slate-600">{new Date(t.date).toLocaleDateString()} <span className="text-slate-400 text-xs">{new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                                  <td className="p-4">
                                      <div className="font-bold text-slate-700 text-sm">{client?.company || 'Удален'}</div>
                                      <div className="text-xs text-slate-400">{client?.name}</div>
                                  </td>
                                  <td className="p-4">
                                      <span className="font-mono font-bold text-green-600">+{t.amount.toLocaleString()} ₸</span>
                                  </td>
                                  <td className="p-4">
                                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-600 border border-slate-200">
                                          {t.type}
                                      </span>
                                  </td>
                                  <td className="p-4 text-sm text-slate-500 max-w-xs truncate" title={t.description}>
                                      {t.description || '-'}
                                  </td>
                                  <td className="p-4">
                                      <div className="flex items-center gap-2">
                                          {onUpdateTransaction && (
                                              <button
                                                  onClick={() => setEditingTransaction({id: t.id, amount: t.amount})}
                                                  className="text-blue-600 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 transition-colors"
                                                  title="Изменить сумму"
                                              >
                                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                  </svg>
                                              </button>
                                          )}
                                          {onDeleteTransaction && (
                                              <button
                                                  onClick={() => {
                                                      if (confirm('Удалить платеж?')) {
                                                          onDeleteTransaction(t.id);
                                                      }
                                                  }}
                                                  className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                                                  title="Удалить"
                                              >
                                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                              </button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                      {transactions.length === 0 && (
                          <tr><td colSpan={6} className="p-12 text-center text-slate-400">Нет транзакций</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
        {viewScope === 'active' && (
            <div className="mb-6 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory flex-shrink-0">
                <div className="flex-shrink-0 w-[85vw] md:w-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-blue-100 flex items-center space-x-4 min-w-[240px] snap-center">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Общая сумма сделок</p>
                        <p className="text-xl font-bold text-slate-800">{totalDealsSum.toLocaleString()} ₸</p>
                    </div>
                </div>
                <div className="flex-shrink-0 w-[85vw] md:w-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-teal-100 flex items-center space-x-4 min-w-[240px] snap-center">
                    <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold border border-teal-100">₸</div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Получено оплат (Доход)</p>
                        <p className="text-xl font-bold text-slate-800">{totalIncome.toLocaleString()} ₸</p>
                        <p className="text-[10px] text-slate-500">Из них предоплат: <span className="font-bold text-teal-600">{totalPrepaymentOnly.toLocaleString()} ₸</span></p>
                    </div>
                </div>
                <div className="flex-shrink-0 w-[85vw] md:w-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-indigo-100 flex items-center space-x-4 min-w-[240px] snap-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Остаток к получению</p>
                        <p className="text-xl font-bold text-slate-800">{potentialRemaining.toLocaleString()} ₸</p>
                    </div>
                </div>
            </div>
        )}

        <div className="mb-4 flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center flex-shrink-0">
             <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center">
                 <div className="bg-slate-100 p-1 rounded-lg flex shrink-0">
                     <button onClick={() => setViewScope('active')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewScope === 'active' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Рабочие</button>
                     <button onClick={() => setViewScope('transactions')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewScope === 'transactions' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Журнал платежей</button>
                     {currentUser?.systemRole === SystemRole.ADMIN && (
                       <button onClick={() => setViewScope('archive')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewScope === 'archive' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Архив</button>
                     )}
                 </div>
                 {currentUser?.systemRole === SystemRole.ADMIN && viewScope === 'active' && (
                   <button
                     onClick={() => setShowStageManager(true)}
                     className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
                     title="Управление этапами"
                   >
                     <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                     </svg>
                     Этапы
                   </button>
                 )}
                 {viewScope === 'active' && (
                    <>
                        <div className="relative flex-1 min-w-[200px] w-full md:w-auto">
                            <input type="text" placeholder="Поиск клиента..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 items-center w-full md:w-auto">
                            <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[140px]">
                                <option value="all">Все источники</option>
                                {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={selectedManagerId} onChange={(e) => setSelectedManagerId(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[160px]">
                                <option value="all">Все менеджеры</option>
                                {getAvailableManagers(users).map(u => <option key={u.id} value={u.id}>{u.name} ({u.jobTitle})</option>)}
                            </select>
                        </div>
                    </>
                 )}
             </div>
             {viewScope === 'transactions' ? (
                onAddTransaction && (
                    <button onClick={onAddTransaction} className="flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap w-full md:w-auto">
                        <span className="text-lg">+</span>
                        <span>Добавить платеж</span>
                    </button>
                )
             ) : (
                <button onClick={onAddClient} className="flex items-center justify-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap w-full md:w-auto">
                    <span className="text-lg">+</span>
                    <span>Новый лид</span>
                </button>
             )}
        </div>

        <div className="flex-1 min-h-0">
            {viewScope === 'active' ? renderBoard() : viewScope === 'transactions' ? renderTransactionList() : renderArchiveList()}
        </div>

        {editingTransaction && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Изменить сумму платежа</h3>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Новая сумма</label>
                        <input
                            type="number"
                            value={editingTransaction.amount}
                            onChange={(e) => setEditingTransaction({...editingTransaction, amount: Number(e.target.value)})}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setEditingTransaction(null)}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={() => {
                                if (onUpdateTransaction && editingTransaction.amount > 0) {
                                    onUpdateTransaction(editingTransaction.id, editingTransaction.amount);
                                    setEditingTransaction(null);
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Сохранить
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showStageManager && (
            <StageManagerModal
                organizationId={currentOrganization?.id || ''}
                onClose={() => {
                    setShowStageManager(false);
                    loadPipelineStages();
                }}
            />
        )}
    </div>
  );
};

const StageManagerModal: React.FC<{ organizationId: string; onClose: () => void }> = ({ organizationId, onClose }) => {
  const [stages, setStages] = useState<CrmPipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<CrmPipelineStage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    hint: '',
    level: 1,
    color: 'border-t-4 border-slate-300',
    statusKey: '' as ClientStatus
  });

  useEffect(() => {
    loadStages();
  }, []);

  const loadStages = async () => {
    setLoading(true);
    const data = await crmPipelineStagesService.getAllStages(organizationId);
    setStages(data);
    setLoading(false);
  };

  const handleToggleActive = async (stageId: string) => {
    await crmPipelineStagesService.toggleStageActive(stageId);
    await loadStages();
  };

  const handleEditClick = (stage: CrmPipelineStage) => {
    setEditingStage(stage);
    setFormData({
      label: stage.label,
      hint: stage.hint || '',
      level: stage.level,
      color: stage.color,
      statusKey: stage.statusKey
    });
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setFormData({
      label: '',
      hint: '',
      level: 1,
      color: 'border-t-4 border-slate-300',
      statusKey: 'New Lead' as ClientStatus
    });
  };

  const handleSaveStage = async () => {
    if (!formData.label.trim()) {
      alert('Введите название этапа');
      return;
    }

    if (editingStage) {
      // Редактирование существующего этапа
      const success = await crmPipelineStagesService.updateStage(editingStage.id, {
        label: formData.label,
        hint: formData.hint,
        level: formData.level,
        color: formData.color
      });

      if (success) {
        await loadStages();
        setEditingStage(null);
      } else {
        alert('Ошибка при сохранении этапа');
      }
    } else if (isCreating) {
      // Создание нового этапа
      const newStage = await crmPipelineStagesService.createStage(organizationId, {
        statusKey: formData.statusKey,
        label: formData.label,
        hint: formData.hint,
        level: formData.level,
        color: formData.color,
        sortOrder: stages.length + 1
      });

      if (newStage) {
        await loadStages();
        setIsCreating(false);
      } else {
        alert('Ошибка при создании этапа');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingStage(null);
    setIsCreating(false);
    setFormData({
      label: '',
      hint: '',
      level: 1,
      color: 'border-t-4 border-slate-300',
      statusKey: 'New Lead' as ClientStatus
    });
  };

  const availableColors = [
    { value: 'border-t-4 border-slate-300', label: 'Серый', preview: 'bg-slate-300' },
    { value: 'border-t-4 border-blue-400', label: 'Синий', preview: 'bg-blue-400' },
    { value: 'border-t-4 border-indigo-400', label: 'Индиго', preview: 'bg-indigo-400' },
    { value: 'border-t-4 border-purple-400', label: 'Фиолетовый', preview: 'bg-purple-400' },
    { value: 'border-t-4 border-teal-500', label: 'Бирюзовый', preview: 'bg-teal-500' },
    { value: 'border-t-4 border-green-500', label: 'Зеленый', preview: 'bg-green-500' },
    { value: 'border-t-4 border-yellow-400', label: 'Желтый', preview: 'bg-yellow-400' },
    { value: 'border-t-4 border-orange-400', label: 'Оранжевый', preview: 'bg-orange-400' },
    { value: 'border-t-4 border-red-400', label: 'Красный', preview: 'bg-red-400' },
    { value: 'border-t-4 border-pink-400', label: 'Розовый', preview: 'bg-pink-400' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Управление этапами CRM</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Управляйте этапами воронки продаж. Системные этапы можно редактировать, но нельзя удалить.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : (editingStage || isCreating) ? (
            <div className="bg-slate-50 rounded-xl p-6 border-2 border-teal-200">
              <h4 className="font-bold text-slate-800 mb-4">
                {editingStage ? 'Редактирование этапа' : 'Создание нового этапа'}
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Название этапа</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Например: Новый лид"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Подсказка для пользователя</label>
                  <textarea
                    value={formData.hint}
                    onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                    rows={2}
                    placeholder="Краткая подсказка, что делать на этом этапе"
                  />
                </div>

                {isCreating && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Статус (для системы)</label>
                    <select
                      value={formData.statusKey}
                      onChange={(e) => setFormData({ ...formData, statusKey: e.target.value as ClientStatus })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Contact Established">Contact Established</option>
                      <option value="Presentation">Presentation</option>
                      <option value="Contract Signing">Contract Signing</option>
                      <option value="In Work">In Work</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Уровень прогресса (0-3)</label>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Определяет заполнение шкалы прогресса (0 = 0%, 3 = 100%)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Цвет этапа</label>
                  <div className="grid grid-cols-5 gap-2">
                    {availableColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.value })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          formData.color === color.value
                            ? 'border-teal-600 bg-teal-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        title={color.label}
                      >
                        <div className={`h-3 w-full rounded ${color.preview}`}></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveStage}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <button
                  onClick={handleCreateClick}
                  className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Добавить новый этап
                </button>
              </div>

              <div className="space-y-3">
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      stage.isActive
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`h-3 w-16 rounded ${stage.color.replace('border-t-4', 'bg-opacity-100')}`}></div>
                          <h4 className="font-bold text-slate-800">{stage.label}</h4>
                          {stage.isSystem && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded font-medium">
                              Системный
                            </span>
                          )}
                        </div>
                        {stage.hint && (
                          <p className="text-sm text-slate-500 ml-[76px]">{stage.hint}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(stage)}
                          className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors border border-blue-200"
                          title="Редактировать"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggleActive(stage.id)}
                          disabled={stage.isSystem && stage.isActive}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            stage.isActive
                              ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                              : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {stage.isActive ? 'Скрыть' : 'Показать'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientBoard;
