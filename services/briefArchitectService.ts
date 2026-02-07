import { BriefMessage, BriefSession } from '../components/brief_architect/types';
import { BRIEF_SYSTEM_PROMPT } from '../components/brief_architect/constants';
import { getCurrentOrganizationId } from '../utils/organizationContext';
import { supabase } from '../lib/supabase';

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

function convertBriefMessagesToClaudeFormat(messages: BriefMessage[]): ClaudeMessage[] {
  return messages.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.content
  }));
}

export async function sendBriefMessage(
  messageHistory: BriefMessage[],
  userInput: string
): Promise<string> {
  const claudeMessages = convertBriefMessagesToClaudeFormat([
    ...messageHistory,
    { role: 'user', content: userInput }
  ]);

  const data = await callClaudeProxy({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: BRIEF_SYSTEM_PROMPT,
    messages: claudeMessages,
  });

  if (!data.content?.[0]?.text) {
    throw new Error('Invalid response from Claude API');
  }

  return data.content[0].text;
}

export async function saveBriefSession(session: Partial<BriefSession>): Promise<string> {
  const organizationId = getCurrentOrganizationId();
  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  if (session.id) {
    const { error } = await supabase
      .from('brief_sessions')
      .update({
        title: session.title,
        messages: session.messages,
        brief_data: session.briefData,
        progress: session.progress,
        status: session.status,
        is_complete: session.isComplete,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (error) throw error;
    return session.id;
  } else {
    const { data, error } = await supabase
      .from('brief_sessions')
      .insert({
        organization_id: organizationId,
        user_id: session.userId,
        client_id: session.clientId || null,
        title: session.title || 'Новый бриф',
        messages: session.messages || [],
        brief_data: session.briefData || null,
        progress: session.progress || 5,
        status: session.status || 'Начало интервью',
        is_complete: session.isComplete || false,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }
}

export async function loadBriefSessions(): Promise<BriefSession[]> {
  const organizationId = getCurrentOrganizationId();
  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const { data, error } = await supabase
    .from('brief_sessions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    clientId: row.client_id,
    title: row.title,
    messages: row.messages || [],
    briefData: row.brief_data,
    progress: row.progress,
    status: row.status,
    isComplete: row.is_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function deleteBriefSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('brief_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}

export async function getGoogleApiKey(): Promise<string | null> {
  const organizationId = getCurrentOrganizationId();
  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('id')
    .eq('type', 'google_gemini')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (!integration) return null;

  const { data: credential } = await supabase
    .from('integration_credentials')
    .select('value')
    .eq('integration_id', integration.id)
    .eq('key', 'api_key')
    .maybeSingle();

  return credential?.value || null;
}
