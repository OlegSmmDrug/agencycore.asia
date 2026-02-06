import { AIAgent, Message } from '../types';
import { STYLE_GUIDELINES } from '../constants/aiAgents';
import { getCurrentOrganizationId } from '../utils/organizationContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AgentResponseResult {
  text: string;
  metadata?: {
    leadScore?: number;
    extractedInfo?: Record<string, any>;
    triggers?: string[];
  };
  proposedAction?: {
    type: string;
    description: string;
    reasoning: string;
    data: Record<string, any>;
  };
  tokensUsed: number;
  cost: number;
}

async function callClaudeProxy(body: Record<string, any>): Promise<ClaudeResponse> {
  const organizationId = getCurrentOrganizationId();
  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/claude-proxy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...body,
      organization_id: organizationId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data.error?.message || data.error || `Claude API error: ${response.status}`;
    throw new Error(String(msg));
  }

  return data;
}

export const processAgentResponse = async (
  agent: AIAgent,
  messageHistory: Message[],
  userInput: string
): Promise<AgentResponseResult> => {
  const systemPrompt = buildSystemPrompt(agent);
  const claudeMessages = convertMessagesToClaudeFormat(messageHistory, userInput);

  const data = await callClaudeProxy({
    model: agent.model,
    max_tokens: agent.settings.maxTokens,
    temperature: agent.settings.temperature,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const text = data.content[0]?.text || 'Нет ответа от AI';
  const metadata = agent.role === 'seller' ? extractLeadMetadata(text, userInput) : undefined;
  const proposedAction = extractProposedAction(text, agent);
  const cost = calculateCost(data.usage.input_tokens + data.usage.output_tokens, agent.model);

  return {
    text,
    metadata,
    proposedAction,
    tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
    cost,
  };
};

function buildSystemPrompt(agent: AIAgent): string {
  const styleGuide = STYLE_GUIDELINES[agent.settings.communicationStyle] || '';

  let prompt = `${agent.settings.systemPrompt}\n\n`;
  prompt += `Стиль общения: ${styleGuide}\n\n`;

  if (agent.settings.useKnowledgeBase && agent.knowledgeBase.faqs.length > 0) {
    prompt += `БАЗА ЗНАНИЙ (FAQ):\n`;
    agent.knowledgeBase.faqs.forEach((faq, index) => {
      prompt += `${index + 1}. Вопрос: ${faq.question}\n   Ответ: ${faq.answer}\n\n`;
    });
  }

  if (agent.role === 'seller') {
    prompt += `\nВАЖНО: В конце диалога, когда получишь достаточно информации, предложи действие в формате:
[ACTION: create_lead]
Обоснование: <почему считаешь, что это хороший лид>
Данные: name=<имя>, phone=<телефон>, email=<email>, budget=<бюджет>, score=<оценка 1-10>`;
  }

  return prompt;
}

function convertMessagesToClaudeFormat(history: Message[], newUserInput: string): ClaudeMessage[] {
  const recentHistory = history.slice(-10);

  const messages: ClaudeMessage[] = recentHistory.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  messages.push({ role: 'user', content: newUserInput });
  return messages;
}

function extractLeadMetadata(aiResponse: string, userInput: string): {
  leadScore?: number;
  extractedInfo?: Record<string, any>;
  triggers?: string[];
} {
  const metadata: any = {};

  const scoreMatch = aiResponse.match(/score[:\s]*(\d+)/i);
  if (scoreMatch) {
    metadata.leadScore = parseInt(scoreMatch[1]);
  }

  const extractedInfo: Record<string, any> = {};

  const nameMatch = userInput.match(/меня зовут\s+([а-яёa-z]+)/i) ||
                    userInput.match(/я\s+([а-яёa-z]+)/i);
  if (nameMatch) extractedInfo.name = nameMatch[1];

  const phoneMatch = userInput.match(/(\+?\d[\d\s\-\(\)]{9,})/);
  if (phoneMatch) extractedInfo.phone = phoneMatch[1].replace(/\s/g, '');

  const emailMatch = userInput.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  if (emailMatch) extractedInfo.email = emailMatch[1];

  const budgetMatch = userInput.match(/бюджет[:\s]*(\d+)/i) ||
                      userInput.match(/(\d+)\s*(тысяч|тыс|руб|₽|тенге)/i);
  if (budgetMatch) extractedInfo.budget = parseInt(budgetMatch[1]);

  if (Object.keys(extractedInfo).length > 0) {
    metadata.extractedInfo = extractedInfo;
  }

  const triggers: string[] = [];
  const lowerResponse = aiResponse.toLowerCase();
  if (lowerResponse.includes('срочно') || lowerResponse.includes('urgent')) {
    triggers.push('СРОЧНОСТЬ');
  }
  if (extractedInfo.budget && extractedInfo.budget > 100000) {
    triggers.push('БОЛЬШОЙ БЮДЖЕТ');
  }

  if (triggers.length > 0) {
    metadata.triggers = triggers;
  }

  return metadata;
}

function extractProposedAction(text: string, _agent: AIAgent): any {
  const actionMatch = text.match(/\[ACTION:\s*(\w+)\]([\s\S]*?)(?=\[ACTION:|$)/i);
  if (!actionMatch) return null;

  const actionType = actionMatch[1];
  const actionContent = actionMatch[2];

  const reasoningMatch = actionContent.match(/Обоснование[:\s]*(.*?)(?=Данные:|$)/is);
  const dataMatch = actionContent.match(/Данные[:\s]*(.*)/is);

  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Нет обоснования';
  const dataStr = dataMatch ? dataMatch[1].trim() : '';

  const data: Record<string, any> = {};
  if (dataStr) {
    const pairs = dataStr.split(',');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key && value) {
        data[key] = value;
      }
    });
  }

  return {
    type: actionType,
    description: `${actionType}: ${reasoning.substring(0, 100)}`,
    reasoning,
    data,
  };
}

function calculateCost(totalTokens: number, model: string): number {
  const costPer1k: Record<string, number> = {
    'claude-3-5-sonnet-20241022': 0.003,
    'claude-3-5-haiku-20241022': 0.0008,
    'claude-3-opus-20240229': 0.015,
  };

  const rate = costPer1k[model] || 0.003;
  return (totalTokens / 1000) * rate;
}

export const qualifyLead = async (conversationText: string): Promise<number> => {
  const prompt = `Проанализируй диалог с потенциальным клиентом и оцени качество лида от 1 до 10, где:
- 1-3: Низкое качество (нет бюджета, не целевая аудитория, тайм-кикеры)
- 4-6: Среднее качество (есть интерес, но бюджет/срочность не ясны)
- 7-9: Высокое качество (четкий запрос, бюджет, готовность работать)
- 10: Горячий лид (срочность, большой бюджет, принимающий решения)

Диалог:
${conversationText}

Ответь ТОЛЬКО числом от 1 до 10.`;

  try {
    const data = await callClaudeProxy({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 10,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const scoreText = data.content[0]?.text || '5';
    const score = parseInt(scoreText.match(/\d+/)?.[0] || '5');
    return Math.min(Math.max(score, 1), 10);
  } catch (error) {
    console.error('Error qualifying lead:', error);
    return 5;
  }
};

export const extractContactData = (text: string): Record<string, string> => {
  const data: Record<string, string> = {};

  const nameMatch = text.match(/(?:меня зовут|я|name[:\s]+)([а-яёa-z\s]+)/i);
  if (nameMatch) data.name = nameMatch[1].trim();

  const phoneMatch = text.match(/(\+?\d[\d\s\-\(\)]{9,})/);
  if (phoneMatch) data.phone = phoneMatch[1].replace(/\s/g, '');

  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  if (emailMatch) data.email = emailMatch[1];

  const budgetMatch = text.match(/(?:бюджет|budget)[:\s]*(\d+)/i);
  if (budgetMatch) data.budget = budgetMatch[1];

  return data;
};
