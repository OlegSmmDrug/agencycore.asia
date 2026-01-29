import { AIAgent, Message } from '../types';
import { STYLE_GUIDELINES } from '../constants/aiAgents';
import { integrationCredentialService } from './integrationCredentialService';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

let cachedApiKey: string | null = null;

async function getClaudeApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const envKey = import.meta.env.VITE_CLAUDE_API_KEY || '';
  if (envKey) {
    console.log('[Claude] Using API key from environment');
    cachedApiKey = envKey;
    return envKey;
  }

  try {
    console.log('[Claude] Attempting to get API key from database...');
    const apiKey = await integrationCredentialService.getCredential(
      'e109a03d-7c0a-4819-8c03-0afdc253678d',
      'api_key'
    );

    if (apiKey) {
      console.log('[Claude] Successfully retrieved API key from database');
      cachedApiKey = apiKey;
      return apiKey;
    }

    console.warn('[Claude] No API key found in database');
  } catch (error) {
    console.error('[Claude] Failed to get Claude API key from database:', error);
  }

  throw new Error('Claude API ключ не настроен. Добавьте его в разделе Интеграции');
}

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

export const processAgentResponse = async (
  agent: AIAgent,
  messageHistory: Message[],
  userInput: string
): Promise<AgentResponseResult> => {
  console.log('[Claude] Starting agent response processing...');

  let apiKey: string;
  try {
    apiKey = await getClaudeApiKey();
    console.log('[Claude] API key obtained successfully');
  } catch (error: any) {
    console.error('[Claude] Failed to get API key:', error);
    throw new Error(`API Key Error: ${error.message}`);
  }

  const systemPrompt = buildSystemPrompt(agent);
  const claudeMessages = convertMessagesToClaudeFormat(messageHistory, userInput);

  console.log('[Claude] Making API request to:', CLAUDE_API_URL);
  console.log('[Claude] Model:', agent.model);
  console.log('[Claude] Max tokens:', agent.settings.maxTokens);

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: agent.model,
        max_tokens: agent.settings.maxTokens,
        temperature: agent.settings.temperature,
        system: systemPrompt,
        messages: claudeMessages
      })
    });

    console.log('[Claude] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Claude] API error response:', errorData);

      let errorMessage = `Claude API error: ${response.status}`;
      if (errorData.error?.message) {
        errorMessage += ` - ${errorData.error.message}`;
      }

      throw new Error(errorMessage);
    }

    const data: ClaudeResponse = await response.json();
    console.log('[Claude] Successfully received response');

    const text = data.content[0]?.text || 'Нет ответа от AI';

    const metadata = agent.role === 'seller' ? extractLeadMetadata(text, userInput) : undefined;
    const proposedAction = extractProposedAction(text, agent);
    const cost = calculateCost(data.usage.input_tokens + data.usage.output_tokens, agent.model);

    return {
      text,
      metadata,
      proposedAction,
      tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
      cost
    };
  } catch (error: any) {
    console.error('[Claude] Processing error:', error);

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Ошибка сети. Проверьте подключение к интернету и CORS настройки.');
    }

    throw new Error(error.message || 'Ошибка при обращении к Claude API');
  }
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
    content: msg.content
  }));

  messages.push({
    role: 'user',
    content: newUserInput
  });

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

function extractProposedAction(text: string, agent: AIAgent): any {
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
    data
  };
}

function calculateCost(totalTokens: number, model: string): number {
  const costPer1k: Record<string, number> = {
    'claude-3-5-sonnet-20241022': 0.003,
    'claude-3-5-haiku-20241022': 0.0008,
    'claude-3-opus-20240229': 0.015
  };

  const rate = costPer1k[model] || 0.003;
  return (totalTokens / 1000) * rate;
}

export const qualifyLead = async (conversationText: string): Promise<number> => {
  const apiKey = await getClaudeApiKey();

  const prompt = `Проанализируй диалог с потенциальным клиентом и оцени качество лида от 1 до 10, где:
- 1-3: Низкое качество (нет бюджета, не целевая аудитория, тайм-кикеры)
- 4-6: Среднее качество (есть интерес, но бюджет/срочность не ясны)
- 7-9: Высокое качество (четкий запрос, бюджет, готовность работать)
- 10: Горячий лид (срочность, большой бюджет, принимающий решения)

Диалог:
${conversationText}

Ответь ТОЛЬКО числом от 1 до 10.`;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data: ClaudeResponse = await response.json();
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
