import React, { useState, useEffect } from 'react';
import { AIAgent, AIAction, UsageStats, Lead, FAQItem, DocumentItem } from '../types';
import { ROLE_TEMPLATES, DEFAULT_AGENT_SETTINGS, DEFAULT_PERMISSIONS } from '../constants/aiAgents';
import Hub from './ai_agents/hub';
import SettingsPanel from './ai_agents/SettingsPanel';
import ChatTester from './ai_agents/chattester';
import ReviewPanel from './ai_agents/reviewpanel';
import AnalyticsPanel from './ai_agents/analyticspanel';
import KnowledgeBase from './ai_agents/knowledgebase';
import { aiAgentService } from '../services/aiAgentService';
import { aiLeadService } from '../services/aiLeadService';
import { aiActionService } from '../services/aiActionService';
import { aiKnowledgeService } from '../services/aiKnowledgeService';
import { aiUsageService } from '../services/aiUsageService';
import { aiCreditService, AiCreditBalance } from '../services/aiCreditService';
import { supabase } from '../lib/supabase';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { Zap, ShoppingCart, Coins, AlertTriangle } from 'lucide-react';

interface AIAgentsModuleProps {
  onNavigateToIntegrations?: () => void;
}

const AIAgentsModule: React.FC<AIAgentsModuleProps> = ({ onNavigateToIntegrations }) => {
  const [view, setView] = useState<'hub' | 'agents' | 'review' | 'kb' | 'analytics'>('hub');
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [actions, setActions] = useState<AIAction[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<UsageStats>({
    requestsToday: 0,
    tokensUsed: 0,
    costSpent: 0,
    successRate: 100
  });
  const [loading, setLoading] = useState(true);
  const [creditBalance, setCreditBalance] = useState<AiCreditBalance>({ balance: 0, isAiEnabled: false, dailyLimit: null });
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [creditPriceKzt, setCreditPriceKzt] = useState(1);

  useEffect(() => {
    loadAiBalance();
    loadData();
  }, []);

  const loadAiBalance = async () => {
    const balance = await aiCreditService.getBalance();
    setCreditBalance(balance);
    const price = await aiCreditService.getCreditPriceKzt();
    setCreditPriceKzt(price);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [agentsData, actionsData, leadsData, statsData] = await Promise.all([
        aiAgentService.getAllAgents(),
        aiActionService.getAllActions(),
        aiLeadService.getAllLeads(),
        aiUsageService.getUsageStats('month')
      ]);

      if (agentsData.length === 0) {
        await initializeDefaultAgents();
        const newAgents = await aiAgentService.getAllAgents();
        setAgents(newAgents);
      } else {
        await Promise.all(
          agentsData.map(async (agent) => {
            const [faqs, docs] = await Promise.all([
              aiKnowledgeService.getFAQs(agent.id),
              aiKnowledgeService.getDocuments(agent.id)
            ]);
            agent.knowledgeBase = { faqs, documents: docs };
          })
        );
        setAgents(agentsData);
      }

      setActions(actionsData);
      setLeads(leadsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading AI agents data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultAgents = async () => {
    const roles = Object.keys(ROLE_TEMPLATES) as Array<keyof typeof ROLE_TEMPLATES>;

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const template = ROLE_TEMPLATES[role];

      await aiAgentService.createAgent({
        name: template.name,
        model: i === 0 ? 'claude-sonnet-4-5-20250929' : 'claude-haiku-4-5-20251001',
        role: role,
        status: i === 0 ? 'active' : 'inactive',
        triggers: i === 0 ? ['creatium_webhook', 'whatsapp_incoming'] : [],
        settings: {
          ...DEFAULT_AGENT_SETTINGS,
          communicationStyle: template.style,
          systemPrompt: template.basePrompt
        },
        permissions: DEFAULT_PERMISSIONS,
        knowledgeBase: { faqs: [], documents: [] },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  };

  const handleUpdateAgent = async (updatedAgent: AIAgent) => {
    try {
      await aiAgentService.updateAgent(updatedAgent.id, updatedAgent);
      setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
    } catch (error) {
      console.error('Error updating agent:', error);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await aiAgentService.deleteAgent(agentId);
      setAgents(prev => prev.filter(a => a.id !== agentId));
      setSelectedAgentId(null);
    } catch (error) {
      console.error('Error deleting agent:', error);
    }
  };

  const handleKBUpdate = async (agentId: string, faqs: FAQItem[], docs: DocumentItem[]) => {
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, knowledgeBase: { faqs, documents: docs } } : a
    ));
  };

  const handleApproveAction = async (action: AIAction) => {
    try {
      await aiActionService.approveAction(action.id, 'current_user_id');
      await loadData();
    } catch (error) {
      console.error('Error approving action:', error);
    }
  };

  const handleToggleAi = async () => {
    const newState = !creditBalance.isAiEnabled;
    if (newState && creditBalance.balance <= 0) {
      setShowTopupModal(true);
      return;
    }
    const ok = await aiCreditService.toggleAi(newState);
    if (ok) {
      setCreditBalance(prev => ({ ...prev, isAiEnabled: newState }));
    }
  };

  const handlePurchaseCredits = async () => {
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) return;
    setTopupLoading(true);
    const result = await aiCreditService.purchaseCredits(amount);
    setTopupLoading(false);
    if (result.success) {
      setCreditBalance(prev => ({ ...prev, balance: result.balanceAfter || prev.balance }));
      setShowTopupModal(false);
      setTopupAmount('');
    } else {
      alert(result.error || 'Ошибка покупки');
    }
  };

  const handleAIResponse = async (agentId: string, response: any) => {
    setStats(prev => ({
      ...prev,
      requestsToday: prev.requestsToday + 1,
      costSpent: prev.costSpent + (response.cost || 0.002),
    }));

    if (response.billing) {
      setCreditBalance(prev => ({ ...prev, balance: response.billing.balance_after ?? prev.balance }));
    }

    if (response.proposedAction) {
      const agent = agents.find(a => a.id === agentId);
      const newAction: Partial<AIAction> = {
        agentId: agentId,
        agentName: agent?.name || 'Unknown',
        actionType: response.proposedAction.type,
        description: response.proposedAction.description,
        reasoning: response.proposedAction.reasoning,
        data: response.proposedAction.data,
        status: agent?.settings.autoMode ? 'approved' : 'pending',
        createdAt: Date.now()
      };

      try {
        const created = await aiActionService.createAction(newAction);
        setActions(prev => [created, ...prev]);

        if (agent?.settings.autoMode) {
          await handleApproveAction(created);
        }
      } catch (error) {
        console.error('Error creating action:', error);
      }
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-600">Загрузка AI-агентов...</p>
        </div>
      </div>
    );
  }

  if (!creditBalance.isAiEnabled) {
    return (
      <div className="relative h-screen overflow-hidden">
        <div className="absolute inset-0 blur-sm opacity-40 pointer-events-none select-none">
          <div className="flex flex-col md:flex-row h-full bg-[#f8f9fa] text-gray-900 font-sans">
            <aside className="w-full md:w-64 border-r bg-white shrink-0">
              <div className="p-6 border-b">
                <h2 className="text-xl font-black text-gray-900">ИИ-Агенты</h2>
                <p className="text-xs text-gray-500 mt-1">AI Operations Center</p>
              </div>
              <nav className="p-4 space-y-2">
                <div className="px-4 py-3 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">Центр управления</div>
                <div className="px-4 py-3 rounded-xl text-gray-400 font-bold text-sm">База знаний</div>
                <div className="px-4 py-3 rounded-xl text-gray-400 font-bold text-sm">Аналитика</div>
                <div className="px-4 py-3 rounded-xl text-gray-400 font-bold text-sm">Панель контроля</div>
              </nav>
              <div className="p-4 border-t">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Агенты (6)</p>
                <div className="space-y-2">
                  {['Продавец', 'Проектописатель', 'ТЗ-составитель', 'Контролёр', 'Финализатор', 'Отзывник'].map((name) => (
                    <div key={name} className="px-3 py-2 rounded-xl text-xs font-medium text-gray-400 flex items-center justify-between">
                      <span>{name}</span>
                      <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
            <main className="flex-1 p-10">
              <div className="grid grid-cols-4 gap-6 mb-8">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-2xl p-6 h-28 border border-gray-100"></div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-white rounded-2xl p-6 h-40 border border-gray-100"></div>
                ))}
              </div>
            </main>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/20 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
              <Zap className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Активируйте AI</h2>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              Для работы ИИ-агентов необходимо пополнить баланс AI-кредитов и активировать модуль.
              Никаких сложных настроек -- просто пополните баланс и включите.
            </p>
            {creditBalance.balance > 0 ? (
              <div className="mb-4 p-3 bg-emerald-50 rounded-xl">
                <p className="text-xs text-emerald-700 font-medium">Ваш баланс: {creditBalance.balance.toFixed(2)} кредитов</p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl">
                <p className="text-xs text-amber-700 font-medium">Баланс: 0 кредитов. Пополните, чтобы начать.</p>
              </div>
            )}
            <div className="space-y-2">
              {creditBalance.balance > 0 && (
                <button
                  onClick={handleToggleAi}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  Включить AI
                </button>
              )}
              <button
                onClick={() => setShowTopupModal(true)}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  creditBalance.balance > 0
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Coins className="w-4 h-4" />
                Пополнить баланс
              </button>
            </div>
          </div>
        </div>

        {showTopupModal && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/40 backdrop-blur-[2px]">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold text-slate-800 mb-1">Купить AI-кредиты</h3>
              <p className="text-xs text-slate-500 mb-4">Кредиты спишутся с вашего основного баланса (KZT)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Количество кредитов</label>
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    placeholder="100"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-bold focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2 mt-2">
                    {[100, 500, 1000, 5000].map(v => (
                      <button
                        key={v}
                        onClick={() => setTopupAmount(v.toString())}
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {topupAmount && parseFloat(topupAmount) > 0 && (
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <p className="text-xs text-blue-700">
                      К оплате: <span className="font-bold">{(parseFloat(topupAmount) * creditPriceKzt).toLocaleString()} KZT</span>
                      <span className="text-blue-500 ml-1">({creditPriceKzt} KZT / кредит)</span>
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowTopupModal(false); setTopupAmount(''); }}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handlePurchaseCredits}
                    disabled={topupLoading || !topupAmount || parseFloat(topupAmount) <= 0}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {topupLoading ? 'Обработка...' : 'Купить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#f8f9fa] text-gray-900 font-sans">
      <aside className="w-full md:w-64 border-r md:border-b-0 border-b bg-white shrink-0 overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-black text-gray-900">ИИ-Агенты</h2>
          <p className="text-xs text-gray-500 mt-1">AI Operations Center</p>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => setView('hub')}
            className={`w-full px-4 py-3 rounded-xl text-left font-bold text-sm transition-all ${
              view === 'hub' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Центр управления
          </button>
          <button
            onClick={() => setView('kb')}
            className={`w-full px-4 py-3 rounded-xl text-left font-bold text-sm transition-all ${
              view === 'kb' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            База знаний
          </button>
          <button
            onClick={() => setView('analytics')}
            className={`w-full px-4 py-3 rounded-xl text-left font-bold text-sm transition-all ${
              view === 'analytics' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Аналитика
          </button>
          <button
            onClick={() => setView('review')}
            className={`w-full px-4 py-3 rounded-xl text-left font-bold text-sm transition-all flex items-center justify-between ${
              view === 'review' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>Панель контроля</span>
            {actions.filter(a => a.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2 py-1 rounded-full">
                {actions.filter(a => a.status === 'pending').length}
              </span>
            )}
          </button>
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs font-bold text-gray-400 uppercase mb-3">Агенты ({agents.length})</p>
          <div className="space-y-2">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgentId(agent.id); setView('agents'); }}
                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium transition-all flex items-center justify-between ${
                  selectedAgentId === agent.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{agent.name}</span>
                <span className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-auto md:h-20 border-b bg-white flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-10 py-4 md:py-0 shrink-0 gap-4 md:gap-0">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            {view !== 'hub' && (
              <button onClick={() => setView('hub')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">🏠</button>
            )}
            <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase">
              {view === 'hub' && 'Центр управления ИИ'}
              {view === 'agents' && (selectedAgent ? selectedAgent.name : 'Агенты')}
              {view === 'review' && 'Панель контроля'}
              {view === 'kb' && 'Центр знаний'}
              {view === 'analytics' && 'Аналитика'}
            </h2>
          </div>
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto justify-between md:justify-end">
            <button
              onClick={() => setShowTopupModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                creditBalance.balance < 10
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : creditBalance.balance < 50
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <Coins className="w-4 h-4" />
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase block leading-none">AI баланс</span>
                <span className="text-sm font-black">{creditBalance.balance.toFixed(2)} кр.</span>
              </div>
            </button>
            <button
              onClick={handleToggleAi}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                creditBalance.isAiEnabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {creditBalance.isAiEnabled ? 'AI Вкл' : 'AI Выкл'}
            </button>
            <button
              onClick={() => setView('review')}
              className="relative p-3 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100"
            >
              <span className="text-lg">&#9878;</span>
              {actions.filter(a => a.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                  {actions.filter(a => a.status === 'pending').length}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {view === 'hub' && (
            <Hub
              agents={agents}
              stats={stats}
              leads={leads}
              onNavigateAgents={() => setView('hub')}
            />
          )}
          {view === 'review' && (
            <ReviewPanel
              actions={actions}
              onApprove={handleApproveAction}
            />
          )}
          {view === 'analytics' && (
            <AnalyticsPanel
              stats={stats}
              agents={agents}
            />
          )}
          {view === 'kb' && (
            <KnowledgeBase
              agents={agents}
              onUpdate={handleKBUpdate}
            />
          )}

          {view === 'agents' && selectedAgent && (
            <div className="flex h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <SettingsPanel
                  agent={selectedAgent}
                  onUpdate={handleUpdateAgent}
                  onDelete={handleDeleteAgent}
                />
              </div>
              <div className="w-full xl:w-[450px] border-l bg-white hidden lg:flex flex-col shrink-0 shadow-lg">
                <ChatTester
                  agent={selectedAgent}
                  onAIResponse={(resp) => handleAIResponse(selectedAgent.id, resp)}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {showTopupModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Купить AI-кредиты</h3>
            <p className="text-xs text-slate-500 mb-4">Кредиты спишутся с вашего основного баланса (KZT)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Количество кредитов</label>
                <input
                  type="number"
                  value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)}
                  placeholder="100"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-bold focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2 mt-2">
                  {[100, 500, 1000, 5000].map(v => (
                    <button
                      key={v}
                      onClick={() => setTopupAmount(v.toString())}
                      className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {topupAmount && parseFloat(topupAmount) > 0 && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-700">
                    К оплате: <span className="font-bold">{(parseFloat(topupAmount) * creditPriceKzt).toLocaleString()} KZT</span>
                    <span className="text-blue-500 ml-1">({creditPriceKzt} KZT / кредит)</span>
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowTopupModal(false); setTopupAmount(''); }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                >
                  Отмена
                </button>
                <button
                  onClick={handlePurchaseCredits}
                  disabled={topupLoading || !topupAmount || parseFloat(topupAmount) <= 0}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {topupLoading ? 'Обработка...' : 'Купить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgentsModule;
