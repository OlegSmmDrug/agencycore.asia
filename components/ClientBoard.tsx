
import React, { useState, useEffect } from 'react';
import { Client, ClientStatus, User, Transaction, PaymentType, SystemRole, Project } from '../types';
import { CLIENT_STATUS_LABELS } from '../constants';
import { getAvailableManagers } from '../services/leadDistributionService';
import { crmPipelineStagesService, CrmPipelineStage } from '../services/crmPipelineStagesService';
import { useOrganization } from './OrganizationProvider';
import TransactionJournal from './TransactionJournal';

interface ClientBoardProps {
  clients: Client[];
  users: User[];
  currentUser?: User;
  transactions?: Transaction[];
  projects?: Project[];
  onClientStatusChange: (clientId: string, newStatus: ClientStatus) => void;
  onClientClick: (client: Client) => void;
  onAddClient: () => void;
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'isVerified'>) => void;
  onUpdateTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onArchiveClient: (clientId: string, archive: boolean) => void;
  onCreateClient?: (client: { name: string; company: string; bin: string }) => Promise<Client>;
  onReconcile?: (existingId: string, bankData: { amount: number; clientName: string; bin: string; docNumber: string }) => Promise<void>;
  onRepeatSale?: (parentClient: Client) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  'Website': 'Сайт',
  'Referral': 'Рекомендация',
  'Cold Call': 'Звонок',
  'Socials': 'Соцсети',
  'Creatium': 'Creatium',
  'WhatsApp': 'WhatsApp',
  'Manual': 'Ручной',
  'Bank Import': 'Банк',
  'Repeat': 'Повторная',
  'Other': 'Другое'
};

const SOURCE_STYLES: Record<string, string> = {
  'Creatium': 'bg-emerald-50 text-emerald-600 border-emerald-100 font-bold',
  'WhatsApp': 'bg-green-50 text-green-600 border-green-100',
  'Website': 'bg-blue-50 text-blue-600 border-blue-100',
  'Referral': 'bg-amber-50 text-amber-600 border-amber-100',
  'Cold Call': 'bg-orange-50 text-orange-600 border-orange-100',
  'Socials': 'bg-sky-50 text-sky-600 border-sky-100',
  'Bank Import': 'bg-slate-50 text-slate-500 border-slate-200',
  'Repeat': 'bg-teal-50 text-teal-600 border-teal-100 font-bold',
  'Manual': 'bg-gray-50 text-gray-500 border-gray-100',
  'Other': 'bg-gray-50 text-gray-500 border-gray-100'
};

const ClientBoard: React.FC<ClientBoardProps> = ({ clients, users, currentUser, transactions = [], projects = [], onClientStatusChange, onClientClick, onAddClient, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onArchiveClient, onCreateClient, onReconcile, onRepeatSale }) => {
  const { organization: currentOrganization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('all');
  const [viewScope, setViewScope] = useState<'active' | 'clients' | 'archive' | 'transactions'>('active');
  const [pipelineStages, setPipelineStages] = useState<CrmPipelineStage[]>([]);
  const [showStageManager, setShowStageManager] = useState(false);
  const [hideBankImports, setHideBankImports] = useState(true);

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

  const pipelineColumns = pipelineStages.filter(s =>
    s.statusKey !== ClientStatus.IN_WORK && s.statusKey !== ClientStatus.WON
  );

  const filteredClients = clients.filter(client => {
      if (viewScope === 'active') {
        if (client.isArchived) return false;
        if (hideBankImports && client.source === 'Bank Import') return false;
        if (client.status === ClientStatus.IN_WORK || client.status === ClientStatus.WON) return false;
      }
      if (viewScope === 'clients') {
        if (client.isArchived) return false;
        if (client.status !== ClientStatus.IN_WORK && client.status !== ClientStatus.WON) return false;
      }
      if (viewScope === 'archive' && !client.isArchived) return false;
      if (viewScope === 'transactions') return true;

      const matchesSearch = client.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            client.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = selectedSource === 'all' || client.source === selectedSource;
      const matchesManager = selectedManagerId === 'all' || client.managerId === selectedManagerId;

      return matchesSearch && matchesSource && matchesManager;
  });

  const columns = pipelineColumns.map(stage => ({
    id: stage.statusKey,
    label: stage.label,
    color: stage.color
  }));

  const totalIncome = transactions.reduce((acc, t) => acc + t.amount, 0);
  const totalPrepaymentOnly = transactions
        .filter(t => t.type === PaymentType.PREPAYMENT)
        .reduce((acc, t) => acc + t.amount, 0);

  const pipelineClients = clients.filter(c =>
    c.status !== ClientStatus.IN_WORK &&
    c.status !== ClientStatus.WON &&
    c.status !== ClientStatus.LOST &&
    !c.isArchived &&
    c.source !== 'Bank Import'
  );
  const totalDealsSum = pipelineClients.reduce((acc, c) => acc + c.budget, 0);
  const potentialRemaining = totalDealsSum - totalIncome;

  const inWorkClients = clients.filter(c =>
    (c.status === ClientStatus.IN_WORK || c.status === ClientStatus.WON) && !c.isArchived
  );
  const totalActiveRevenue = inWorkClients.reduce((acc, c) => acc + c.budget, 0);

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

  const uniqueSources = Array.from(new Set(clients.map(c => c.source))).filter(s => s !== 'Bank Import' || !hideBankImports);

  const bankImportCount = clients.filter(c => c.source === 'Bank Import' && !c.isArchived).length;

  const renderSourceBadge = (source: string) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${SOURCE_STYLES[source] || SOURCE_STYLES['Other']}`}>
      {SOURCE_LABELS[source] || source}
    </span>
  );

  const renderClientCard = (client: Client) => (
    <div
      key={client.id}
      draggable
      onDragStart={(e) => handleDragStart(e, client.id)}
      onClick={() => onClientClick(client)}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer lg:cursor-grab active:cursor-grabbing group relative"
    >
      <div className="absolute top-3 right-3">
        {renderSourceBadge(client.source)}
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
            <div className="p-2 rounded-lg text-green-500 hover:bg-green-50 transition-colors" title="WhatsApp доступен">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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
                    {columnClients.map(renderClientCard)}
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

  const renderClientBaseCard = (client: Client) => {
    const manager = users.find(u => u.id === client.managerId);
    const project = projects.find(p => p.clientId === client.id && !p.isArchived);
    return (
      <div
        key={client.id}
        onClick={() => onClientClick(client)}
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {client.logoUrl ? (
              <img src={client.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center text-sm font-bold shrink-0">
                {(client.company || client.name || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-slate-700 text-sm truncate">{client.company || client.name}</div>
              <div className="text-xs text-slate-400 truncate">{client.name}{client.phone ? ` \u00B7 ${client.phone}` : ''}</div>
            </div>
          </div>
          {project ? (
            <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-[10px] font-medium border border-teal-200 shrink-0">Проект</span>
          ) : client.status === ClientStatus.WON ? (
            <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-[10px] font-medium border border-green-200 shrink-0">Завершен</span>
          ) : (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-medium border border-blue-200 shrink-0">В работе</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {manager && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center text-white text-[10px] font-bold">{manager.name[0]}</div>
                <span className="text-[11px] text-slate-500">{manager.name}</span>
              </div>
            )}
          </div>
          <div className="font-bold text-sm text-slate-800">{client.budget.toLocaleString()} ₸</div>
        </div>
        {((client.services && client.services.length > 0) || client.service) && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
            {(client.services || []).slice(0, 3).map((s, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-50 rounded text-[10px] font-medium text-slate-500 border border-slate-100">{s}</span>
            ))}
            {(client.services || []).length > 3 && (
              <span className="px-2 py-0.5 bg-slate-50 rounded text-[10px] font-medium text-slate-400">+{(client.services || []).length - 3}</span>
            )}
            {(!client.services || client.services.length === 0) && client.service && (
              <span className="px-2 py-0.5 bg-slate-50 rounded text-[10px] font-medium text-slate-500 border border-slate-100">{client.service}</span>
            )}
          </div>
        )}
        {client.source === 'Repeat' && client.parentClientId && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] text-teal-600 font-medium">Повторная продажа</span>
          </div>
        )}
        {onRepeatSale && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              onClick={(e) => { e.stopPropagation(); onRepeatSale(client); }}
              className="w-full py-2 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors border border-teal-200"
            >
              Новая сделка
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderClientBase = () => {
    const clientBaseClients = filteredClients;
    const totalMonthlyRevenue = clientBaseClients.reduce((acc, c) => acc + c.budget, 0);
    const withProject = clientBaseClients.filter(c => c.projectLaunched);

    return (
      <div className="flex flex-col h-full gap-3">
        <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-col h-full">
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Компания</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Контакт</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Менеджер</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Услуги</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Бюджет</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Статус</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientBaseClients.map(client => {
                  const manager = users.find(u => u.id === client.managerId);
                  const project = projects.find(p => p.clientId === client.id && !p.isArchived);
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 cursor-pointer" onClick={() => onClientClick(client)}>
                        <div className="flex items-center gap-3">
                          {client.logoUrl ? (
                            <img src={client.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-bold">
                              {(client.company || client.name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-700 text-sm">{client.company || client.name}</div>
                            {client.source === 'Repeat' && client.parentClientId && (
                              <span className="text-[10px] text-teal-600 font-medium">Повторная продажа</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 cursor-pointer" onClick={() => onClientClick(client)}>
                        <div className="text-sm font-medium text-slate-700">{client.name}</div>
                        <div className="text-xs text-slate-400">{client.phone || client.email || '-'}</div>
                      </td>
                      <td className="p-4">
                        {manager ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-white text-[10px] font-bold">
                              {manager.name[0]}
                            </div>
                            <span className="text-xs text-slate-600">{manager.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {(client.services || []).slice(0, 2).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600 border border-slate-200">{s}</span>
                          ))}
                          {(client.services || []).length > 2 && (
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-500">+{(client.services || []).length - 2}</span>
                          )}
                          {(!client.services || client.services.length === 0) && client.service && (
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600 border border-slate-200">{client.service}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-sm text-slate-800">{client.budget.toLocaleString()} ₸</div>
                      </td>
                      <td className="p-4">
                        {project ? (
                          <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-md text-xs font-medium border border-teal-200">Проект активен</span>
                        ) : client.status === ClientStatus.WON ? (
                          <span className="px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium border border-green-200">Завершен</span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">В работе</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); onClientClick(client); }}
                            className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                          >
                            Открыть
                          </button>
                          {onRepeatSale && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRepeatSale(client); }}
                              className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors border border-teal-200"
                            >
                              Новая сделка
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {clientBaseClients.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm font-medium">Нет активных клиентов</p>
                <p className="text-xs mt-1">Клиенты появятся здесь после запуска проекта</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:hidden flex-1 overflow-y-auto space-y-3">
          {clientBaseClients.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm font-medium">Нет активных клиентов</p>
            </div>
          ) : (
            clientBaseClients.map(c => renderClientBaseCard(c))
          )}
        </div>
      </div>
    );
  };

  const renderArchiveList = () => (
      <div className="flex flex-col h-full gap-3">
        <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-col h-full">
            <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Компания</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Контакт</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Статус</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Сумма</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Дата</th>
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

        <div className="md:hidden flex-1 overflow-y-auto space-y-3">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">В архиве пока пусто</div>
          ) : (
            filteredClients.map(client => (
              <div key={client.id} onClick={() => onClientClick(client)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-700 text-sm truncate">{client.company}</div>
                    <div className="text-xs text-slate-400">{client.name}{client.phone ? ` \u00B7 ${client.phone}` : ''}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ml-2 ${client.status === ClientStatus.WON ? 'bg-green-100 text-green-700' : client.status === ClientStatus.LOST ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {CLIENT_STATUS_LABELS[client.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-slate-400">{new Date(client.createdAt).toLocaleDateString()}</div>
                  <div className="font-bold text-sm text-slate-800">{client.budget.toLocaleString()} ₸</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Восстановить сделку из архива?')) {
                      onArchiveClient(client.id, false);
                    }
                  }}
                  className="mt-3 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  Восстановить
                </button>
              </div>
            ))
          )}
        </div>
      </div>
  );

  const renderTransactionList = () => (
      onAddTransaction ? (
          <TransactionJournal
              transactions={transactions}
              clients={clients}
              projects={projects}
              users={users}
              onAddTransaction={onAddTransaction}
              onUpdateTransaction={onUpdateTransaction}
              onDeleteTransaction={onDeleteTransaction}
              onCreateClient={onCreateClient}
              onReconcile={onReconcile}
          />
      ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
              Функция добавления платежей недоступна
          </div>
      )
  );

  const renderContent = () => {
    switch (viewScope) {
      case 'active': return renderBoard();
      case 'clients': return renderClientBase();
      case 'transactions': return renderTransactionList();
      case 'archive': return renderArchiveList();
      default: return renderBoard();
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
        {viewScope === 'active' && (
            <div className="mb-6 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory flex-shrink-0">
                <div className="flex-shrink-0 w-[85vw] md:w-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-blue-100 flex items-center space-x-4 min-w-[240px] snap-center">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">В воронке (без банка)</p>
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
                <div className="flex-shrink-0 w-[85vw] md:w-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-green-100 flex items-center space-x-4 min-w-[240px] snap-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 font-bold border border-green-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Остаток к получению</p>
                        <p className="text-xl font-bold text-slate-800">{potentialRemaining.toLocaleString()} ₸</p>
                    </div>
                </div>
            </div>
        )}

        {viewScope === 'clients' && (
            <div className="mb-6 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory flex-shrink-0">
                <div className="flex-shrink-0 w-[85vw] md:w-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-teal-100 flex items-center space-x-4 min-w-[240px] snap-center">
                    <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold border border-teal-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Активных клиентов</p>
                        <p className="text-xl font-bold text-slate-800">{inWorkClients.length}</p>
                    </div>
                </div>
                <div className="flex-shrink-0 w-[85vw] md:w-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-blue-100 flex items-center space-x-4 min-w-[240px] snap-center">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">₸</div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Общий бюджет клиентов</p>
                        <p className="text-xl font-bold text-slate-800">{totalActiveRevenue.toLocaleString()} ₸</p>
                    </div>
                </div>
            </div>
        )}

        <div className="mb-4 flex flex-col gap-3 flex-shrink-0">
             <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                 <div className="flex items-center gap-2 w-full sm:w-auto">
                   <div className="bg-slate-100 p-1 rounded-lg flex overflow-x-auto shrink-0 max-w-full">
                       <button onClick={() => setViewScope('active')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${viewScope === 'active' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Воронка</button>
                       <button onClick={() => setViewScope('clients')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all relative whitespace-nowrap ${viewScope === 'clients' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                         База клиентов
                         {inWorkClients.length > 0 && (
                           <span className="ml-1.5 bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{inWorkClients.length}</span>
                         )}
                       </button>
                       <button onClick={() => setViewScope('transactions')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${viewScope === 'transactions' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Платежи</button>
                       {currentUser?.systemRole === SystemRole.ADMIN && (
                         <button onClick={() => setViewScope('archive')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${viewScope === 'archive' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Архив</button>
                       )}
                   </div>
                   {currentUser?.systemRole === SystemRole.ADMIN && viewScope === 'active' && (
                     <button
                       onClick={() => setShowStageManager(true)}
                       className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                       title="Управление этапами"
                     >
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                       </svg>
                     </button>
                   )}
                 </div>
                 {viewScope !== 'transactions' && (
                    <button onClick={onAddClient} className="flex items-center justify-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap w-full sm:w-auto shrink-0">
                        <span className="text-lg">+</span>
                        <span>Новый лид</span>
                    </button>
                 )}
             </div>
             {(viewScope === 'active' || viewScope === 'clients') && (
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="relative flex-1 min-w-0">
                        <input type="text" placeholder="Поиск клиента..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <div className="flex gap-2 items-center overflow-x-auto">
                        <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer min-w-0 flex-1 sm:flex-none sm:min-w-[140px]">
                            <option value="all">Все источники</option>
                            {uniqueSources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
                        </select>
                        <select value={selectedManagerId} onChange={(e) => setSelectedManagerId(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer min-w-0 flex-1 sm:flex-none sm:min-w-[160px]">
                            <option value="all">Все менеджеры</option>
                            {getAvailableManagers(users).map(u => <option key={u.id} value={u.id}>{u.name} ({u.jobTitle})</option>)}
                        </select>
                        {viewScope === 'active' && (
                          <button
                            onClick={() => setHideBankImports(!hideBankImports)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap shrink-0 ${
                              hideBankImports
                                ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                : 'bg-orange-50 border-orange-200 text-orange-600'
                            }`}
                            title={hideBankImports ? 'Показать контрагентов из банковского импорта' : 'Скрыть контрагентов из банковского импорта'}
                          >
                            {hideBankImports ? `Банк (${bankImportCount})` : `Банк: вкл`}
                          </button>
                        )}
                    </div>
                </div>
             )}
        </div>

        <div className="flex-1 min-h-0">
            {renderContent()}
        </div>

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
