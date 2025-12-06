import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { generateChatReply } from './llmClient';
import {
  RepoAgentConversation,
  RepoAgentMessage,
  RepoAgentMessageRole,
} from './types';

interface HandleChatInput {
  conversationId?: string;
  userId: string;
  message: string;
  relatedErrorId?: string;
  relatedHealthCheckId?: string;
  relatedScenarioRunId?: string;
  relatedSweepRunId?: string;
}

async function upsertConversation(input: HandleChatInput) {
  if (input.conversationId) {
    const { data } = await supabaseAdmin
      .from('repo_agent_conversations')
      .select('*')
      .eq('id', input.conversationId)
      .maybeSingle();
    if (data) return data;
    logger.warn(
      { conversationId: input.conversationId },
      '[repoAgent][chatService] Conversation not found; creating new one'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('repo_agent_conversations')
    .insert([
      {
        created_by_user_id: input.userId,
        related_error_id: input.relatedErrorId ?? null,
        related_health_check_id: input.relatedHealthCheckId ?? null,
        related_scenario_run_id: input.relatedScenarioRunId ?? null,
        related_sweep_run_id: input.relatedSweepRunId ?? null,
        title: 'Repo Agent Chat',
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    throw error || new Error('Failed to create Repo Agent conversation');
  }

  return data;
}

function mapMessage(row: any): RepoAgentMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as RepoAgentMessageRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

async function fetchMessages(conversationId: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_agent_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw error;
  return (data || []).map(mapMessage);
}

async function resolveContext(conversation: any, input: HandleChatInput) {
  const context: Record<string, unknown> = {
    conversationId: conversation.id,
  };

  const errorId = input.relatedErrorId || conversation.related_error_id;
  if (errorId) {
    const { data } = await supabaseAdmin
      .from('repo_errors')
      .select('id, error_signature, error_message, status, occurrences, last_explanation')
      .eq('id', errorId)
      .maybeSingle();
    if (data) context.error = data;
  }

  const healthCheckId = input.relatedHealthCheckId || conversation.related_health_check_id;
  if (healthCheckId) {
    const { data } = await supabaseAdmin
      .from('repo_health_checks')
      .select('id, branch, severity, summary, tests_status, lint_status, build_status, created_at')
      .eq('id', healthCheckId)
      .maybeSingle();
    if (data) context.healthCheck = data;
  }

  const scenarioRunId = input.relatedScenarioRunId || conversation.related_scenario_run_id;
  if (scenarioRunId) {
    const { data } = await supabaseAdmin
      .from('repo_scenario_runs')
      .select('id, status, failing_step, logs, created_at')
      .eq('id', scenarioRunId)
      .maybeSingle();
    if (data) context.scenarioRun = data;
  }

  const sweepRunId = input.relatedSweepRunId || conversation.related_sweep_run_id;
  if (sweepRunId) {
    const { data } = await supabaseAdmin
      .from('repo_integrity_sweep_runs')
      .select('id, status, violation_summary, raw_report, created_at')
      .eq('id', sweepRunId)
      .maybeSingle();
    if (data) context.sweepRun = data;
  }

  return context;
}

function mapConversation(row: any, messages: RepoAgentMessage[]): RepoAgentConversation {
  return {
    id: row.id,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    relatedErrorId: row.related_error_id,
    relatedHealthCheckId: row.related_health_check_id,
    relatedScenarioRunId: row.related_scenario_run_id,
    relatedSweepRunId: row.related_sweep_run_id,
    messages,
  };
}

export async function handleChatMessage(
  input: HandleChatInput
): Promise<RepoAgentConversation> {
  const conversation = await upsertConversation(input);

  const { error: insertError } = await supabaseAdmin
    .from('repo_agent_messages')
    .insert([
      {
        conversation_id: conversation.id,
        role: 'user',
        content: input.message,
      },
    ]);

  if (insertError) {
    throw insertError;
  }

  const messages = await fetchMessages(conversation.id);
  const context = await resolveContext(conversation, input);

  let agentReply = '';
  try {
    agentReply = await generateChatReply({
      context,
      conversationMessages: messages.map((m) => ({
        role: m.role === 'agent' ? 'assistant' : (m.role as 'user' | 'assistant' | 'system'),
        content: m.content,
      })),
    });
  } catch (error) {
    logger.error({ error }, '[repoAgent][chatService] Failed to generate chat reply');
    agentReply = 'Unable to generate a response at this time.';
  }

  const { error: agentInsertError } = await supabaseAdmin
    .from('repo_agent_messages')
    .insert([
      {
        conversation_id: conversation.id,
        role: 'agent',
        content: agentReply,
      },
    ]);

  if (agentInsertError) {
    throw agentInsertError;
  }

  const updatedMessages = await fetchMessages(conversation.id);
  return mapConversation(conversation, updatedMessages);
}

