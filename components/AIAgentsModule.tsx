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
import { integrationCredentialService } from '../services/integrationCredentialService';
import { Key, Settings } from 'lucide-react';

const CLAUDE_INTEGRATION_ID = 'e109a03d-7c0a-4819-8c03-0afdc253678d';

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
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    checkClaudeApiKey();
    loadData();
  }, []);

  const checkClaudeApiKey = async () => {
    const envKey = import.meta.env.VITE_CLAUDE_API_KEY || '';
    if (envKey) {
      setApiKeyConfigured(true);
      return;
    }

    try {
      const hasKey = await integrationCredentialService.hasCredentials(
        CLAUDE_INTEGRATION_ID,
        ['api_key']
      );
      setApiKeyConfigured(hasKey);
    } catch {
      setApiKeyConfigured(false);
    }
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
        model: i === 0 ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022',
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

  const handleAIResponse = async (agentId: string, response: any) => {
    setStats(prev => ({
      ...prev,
      requestsToday: prev.requestsToday + 1,
      costSpent: prev.costSpent + (response.cost || 0.002),
    }));

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

  if (apiKeyConfigured === false) {
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
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
              <Key className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Подключите Claude API</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Для работы ИИ-агентов необходим ключ Claude API от Anthropic.
              Подключите его в разделе Интеграции, чтобы активировать модуль.
            </p>
            <button
              onClick={() => onNavigateToIntegrations?.()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Перейти в Интеграции
            </button>
          </div>
        </div>
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
              view === 'hub' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Центр управления
          </button>
          <button
            onClick={() => setView('kb')}
            className={`w-full px-4 py-3 rounded-xl text-left font-bold text-sm transition-all ${
              view === 'kb' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            База знаний
          </button>
          <button
            onClick={() => setView('analytics')}
            className={`w-full px-4 py-3 rounded-xl text-left font-bold text-sm transition-all ${
              view === 'analytics' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Аналитика
          </button>
          <button
            onClick={() => setView('review')}
            className={`w-full px-4 py-3 rounded-xl text-left font-bold text-sm transition-all flex items-center justify-between ${
              view === 'review' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
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
                  selectedAgentId === agent.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
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
          <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto justify-between md:justify-end">
            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Расходы ИИ (Месяц)</span>
              <span className="text-base md:text-lg font-black text-indigo-600">${stats.costSpent.toFixed(3)} / $20.00</span>
              <div className="w-32 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${Math.min((stats.costSpent / 20) * 100, 100)}%` }}></div>
              </div>
            </div>
            <button
              onClick={() => setView('review')}
              className="relative p-3 bg-gray-50 rounded-2xl hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100"
            >
              ⚖️
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
    </div>
  );
};

export default AIAgentsModule;
