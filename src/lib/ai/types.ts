import type { AuthContext } from '@/lib/api-auth';

export const ABSOLUTE_AI_DEFAULT_MODEL = 'gemini-3.6-flash';
export const ABSOLUTE_AI_MAX_PROMPT_LENGTH = 2_000;
export const ABSOLUTE_AI_MAX_TOOL_ROUNDS = 6;
export const ABSOLUTE_AI_MAX_RESULT_ROWS = 25;
export const ABSOLUTE_AI_PROVIDER_TIMEOUT_MS = 20_000;

export type AbsoluteAiHealthStatus = 'healthy' | 'warning' | 'problem' | 'unknown';

export type AbsoluteAiHealthCard = {
  detail: string;
  key: string;
  status: AbsoluteAiHealthStatus;
  title: string;
};

export type AbsoluteAiToolEvent = {
  detail: string;
  name: string;
  status: 'completed' | 'failed' | 'running';
  title: string;
};

export type AbsoluteAiUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  toolTokens: number | null;
  totalTokens: number | null;
};

export type AbsoluteAiChatRequest = {
  conversationId?: string | null;
  previousInteractionId?: string | null;
  prompt: string;
};

export type AbsoluteAiChatResponse = {
  conversationId: string;
  model: string;
  previousInteractionId: string | null;
  response: string;
  toolEvents: AbsoluteAiToolEvent[];
  usage: AbsoluteAiUsage | null;
};

export type AbsoluteAiToolDefinition = {
  description: string;
  friendlyName: string;
  name: string;
  parameters: Record<string, unknown>;
};

export type AbsoluteAiToolExecutionContext = {
  auth: AuthContext;
};

export type AbsoluteAiToolResult = {
  data: Record<string, unknown>;
  summary: string;
};

export type AbsoluteAiProviderRequest = {
  executeTool: (name: string, args: Record<string, unknown>) => Promise<AbsoluteAiToolResult>;
  previousInteractionId?: string | null;
  prompt: string;
  systemInstruction: string;
  tools: AbsoluteAiToolDefinition[];
};

export type AbsoluteAiProviderResponse = {
  interactionId: string | null;
  model: string;
  response: string;
  toolEvents: AbsoluteAiToolEvent[];
  usage: AbsoluteAiUsage | null;
};

export type AbsoluteAiAuditRow = {
  conversationId?: string | null;
  model?: string | null;
  provider?: string | null;
  requestId: string;
  responseSummary?: string | null;
  sanitizedToolArguments?: Record<string, unknown> | null;
  sessionId?: string | null;
  toolName?: string | null;
  toolResultStatus: string;
  usageMetadata?: Record<string, unknown> | null;
  userPrompt: string;
};
