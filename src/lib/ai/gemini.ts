import { GoogleGenAI } from '@google/genai';

import { sanitizeAbsoluteAiAuditValue } from './audit';
import {
  ABSOLUTE_AI_MAX_TOOL_ROUNDS,
  ABSOLUTE_AI_PROVIDER_TIMEOUT_MS,
} from './types';
import type {
  AbsoluteAiProviderRequest,
  AbsoluteAiProviderResponse,
  AbsoluteAiToolEvent,
  AbsoluteAiToolResult,
  AbsoluteAiUsage,
} from './types';

type GeminiProviderConfig = {
  apiKey: string;
  model: string;
};

type GeminiInteractionTool = {
  description?: string;
  name: string;
  parameters?: Record<string, unknown>;
  type: 'function';
};

type GeminiErrorLike = Error & {
  body?: string;
  details?: unknown;
  error?: unknown;
  status?: number;
  statusCode?: number;
};

type GeminiProbeMode = 'full' | 'legacy_invalid' | 'plain' | 'trivial';

type GeminiProbeRequest = {
  executeTool?: AbsoluteAiProviderRequest['executeTool'];
  mode: GeminiProbeMode;
  prompt?: string;
  systemInstruction?: string;
  tools?: AbsoluteAiProviderRequest['tools'];
};

type GeminiProbeResponse = {
  error: ReturnType<typeof getSanitizedGeminiProviderErrorDetails> | null;
  functionCalls: Array<{
    arguments: Record<string, unknown>;
    id: string;
    name: string;
  }>;
  interactionId: string | null;
  response: string;
  status: string | null;
  toolEvents: AbsoluteAiToolEvent[];
  usage: AbsoluteAiUsage | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutHandle: NodeJS.Timeout | undefined;

  return Promise.race([
    promise.finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }),
    new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('Absolute AI provider request timed out.')), timeoutMs);
    }),
  ]);
}

function toToolEvent(name: string, result: AbsoluteAiToolResult): AbsoluteAiToolEvent {
  return {
    detail: result.summary,
    name,
    status: 'completed',
    title: name.replace(/_/g, ' '),
  };
}

function normalizeUsage(usage: Record<string, unknown> | null | undefined): AbsoluteAiUsage | null {
  if (!usage) return null;

  const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    inputTokens: toNumber(usage.total_input_tokens),
    outputTokens: toNumber(usage.total_output_tokens),
    toolTokens: toNumber(usage.total_tool_tokens),
    totalTokens: toNumber(usage.total_tokens),
  };
}

function extractRecordArray(input: unknown) {
  return Array.isArray(input)
    ? input.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    : [];
}

function extractFunctionCalls(interaction: Record<string, unknown>) {
  const steps = extractRecordArray(interaction.steps);
  const outputs = extractRecordArray(interaction.outputs);
  const candidates = [...steps, ...outputs];

  return candidates.filter((entry): entry is Record<string, unknown> => (
    Boolean(entry) &&
    typeof entry === 'object' &&
    String((entry as { type?: unknown }).type ?? '') === 'function_call'
  ));
}

function extractOutputText(interaction: Record<string, unknown>) {
  if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }

  const candidates = [
    ...extractRecordArray(interaction.outputs),
    ...extractRecordArray(interaction.steps),
  ];

  for (const candidate of candidates) {
    if (String(candidate.type ?? '') === 'text' && typeof candidate.text === 'string' && candidate.text.trim()) {
      return candidate.text.trim();
    }

    if (String(candidate.type ?? '') !== 'model_output') {
      continue;
    }

    const content = extractRecordArray(candidate.content);
    const text = content
      .filter((entry) => entry?.type === 'text' && typeof entry.text === 'string')
      .map((entry) => String(entry.text))
      .join('\n')
      .trim();

    if (text) return text;
  }

  return 'Absolute AI could not generate a response.';
}

function tryParseJsonBody(body: string | undefined) {
  if (!body) return null;

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return body;
  }
}

export function getSanitizedGeminiProviderErrorDetails(error: unknown) {
  const value = error as GeminiErrorLike | undefined;
  const parsedBody = tryParseJsonBody(value?.body);

  return sanitizeAbsoluteAiAuditValue({
    details: value?.details ?? null,
    error: value?.error ?? parsedBody ?? null,
    message: value?.message ?? 'Absolute AI provider error.',
    name: value?.name ?? 'Error',
    status: Number(value?.status ?? value?.statusCode ?? 0) || null,
  }) as {
    details?: unknown;
    error?: unknown;
    message?: string;
    name?: string;
    status?: number | null;
  };
}

function logGeminiProviderError(error: unknown, context: string) {
  console.error('Absolute AI Gemini provider error', {
    context,
    ...getSanitizedGeminiProviderErrorDetails(error),
  });
}

export function normalizeAbsoluteAiProviderError(error: unknown) {
  const diagnostics = getSanitizedGeminiProviderErrorDetails(error);
  const status = Number(diagnostics.status ?? 0);
  const message = diagnostics.message ?? 'Absolute AI provider error.';

  if (
    status === 429 ||
    /quota|rate limit|too many requests/i.test(message)
  ) {
    return {
      message: 'Absolute AI is temporarily at its usage limit. Please try again later.',
      status: 429,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /api key|permission|unauthorized|forbidden/i.test(message)
  ) {
    return {
      message: 'Absolute AI is unavailable right now.',
      status: 503,
    };
  }

  return {
    message: 'Absolute AI is unavailable right now.',
    status: 503,
  };
}

function buildGeminiInteractionTools(tools: AbsoluteAiProviderRequest['tools']): GeminiInteractionTool[] {
  return tools.map((tool) => ({
    description: tool.description,
    name: tool.name,
    parameters: tool.parameters,
    type: 'function',
  }));
}

function buildLegacyInvalidGeminiTools(tools: AbsoluteAiProviderRequest['tools']) {
  return tools.map((tool) => ({
    description: tool.description,
    name: tool.name,
    parameters: tool.parameters,
  }));
}

function throwIfGeminiInteractionFailed(interaction: Record<string, unknown>) {
  const status = String(interaction.status ?? '').trim().toLowerCase();
  if (!status || !['failed', 'cancelled', 'incomplete', 'budget_exceeded'].includes(status)) {
    return;
  }

  const error = Object.assign(
    new Error(`Gemini interaction ended with status ${status}.`),
    {
      details: interaction.errors ?? null,
      status: 503,
    },
  );

  throw error;
}

async function runGeminiInteraction(
  ai: GoogleGenAI,
  config: GeminiProviderConfig,
  input: AbsoluteAiProviderRequest,
  overrideTools?: Array<Record<string, unknown>>,
): Promise<AbsoluteAiProviderResponse> {
  let previousInteractionId = input.previousInteractionId ?? null;
  let nextInput: unknown = input.prompt;
  let latestInteractionId: string | null = null;
  const toolEvents: AbsoluteAiToolEvent[] = [];
  let usage: AbsoluteAiUsage | null = null;

  for (let round = 0; round < ABSOLUTE_AI_MAX_TOOL_ROUNDS; round += 1) {
    const interaction = await withTimeout(
      ai.interactions.create({
        input: nextInput as never,
        model: config.model,
        previous_interaction_id: previousInteractionId ?? undefined,
        system_instruction: input.systemInstruction,
        tools: (overrideTools ?? buildGeminiInteractionTools(input.tools)) as never,
      }),
      ABSOLUTE_AI_PROVIDER_TIMEOUT_MS,
    ) as Record<string, unknown>;

    throwIfGeminiInteractionFailed(interaction);

    latestInteractionId = typeof interaction.id === 'string' ? interaction.id : latestInteractionId;
    usage = normalizeUsage((interaction.usage ?? null) as Record<string, unknown> | null | undefined) ?? usage;
    const functionCalls = extractFunctionCalls(interaction);

    if (functionCalls.length === 0) {
      return {
        interactionId: latestInteractionId,
        model: config.model,
        response: extractOutputText(interaction),
        toolEvents,
        usage,
      };
    }

    const functionResults = [];
    for (const call of functionCalls) {
      const name = String(call.name ?? '').trim();
      if (!name) continue;
      const result = await input.executeTool(
        name,
        ((call.arguments ?? {}) as Record<string, unknown>),
      );
      toolEvents.push(toToolEvent(name, result));
      functionResults.push({
        call_id: String(call.id ?? ''),
        name,
        result: result.data,
        type: 'function_result',
      });
    }

    nextInput = functionResults;
    previousInteractionId = latestInteractionId;
  }

  return {
    interactionId: latestInteractionId,
    model: config.model,
    response: 'Absolute AI stopped after reaching its tool execution limit for this request.',
    toolEvents,
    usage,
  };
}

export async function runGeminiProviderProbe(
  config: GeminiProviderConfig,
  request: GeminiProbeRequest,
): Promise<GeminiProbeResponse> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const prompt = request.prompt
    ?? (request.mode === 'full'
      ? 'Check system health'
      : request.mode === 'trivial'
        ? 'Call the echo_ready function once, then reply READY.'
        : 'Reply READY.');

  const tools = request.tools ?? [];

  try {
    if (request.mode === 'legacy_invalid') {
      const interaction = await withTimeout(
        ai.interactions.create({
          input: prompt,
          model: config.model,
          system_instruction: request.systemInstruction ?? 'Reply READY only.',
          tools: buildLegacyInvalidGeminiTools(tools) as never,
        }),
        ABSOLUTE_AI_PROVIDER_TIMEOUT_MS,
      ) as Record<string, unknown>;

      throwIfGeminiInteractionFailed(interaction);

      return {
        error: null,
        functionCalls: extractFunctionCalls(interaction).map((call) => ({
          arguments: ((call.arguments ?? {}) as Record<string, unknown>),
          id: String(call.id ?? ''),
          name: String(call.name ?? ''),
        })),
        interactionId: typeof interaction.id === 'string' ? interaction.id : null,
        response: extractOutputText(interaction),
        status: typeof interaction.status === 'string' ? interaction.status : null,
        toolEvents: [],
        usage: normalizeUsage((interaction.usage ?? null) as Record<string, unknown> | null | undefined),
      };
    }

    const probeTools = request.mode === 'trivial'
      ? [{
          description: 'Returns READY.',
          friendlyName: 'Echo READY',
          name: 'echo_ready',
          parameters: {
            additionalProperties: false,
            properties: {},
            required: [],
            type: 'object',
          },
        }]
      : tools;

    const result = await runGeminiInteraction(
      ai,
      config,
      {
        executeTool: request.mode === 'trivial'
          ? async () => ({
              data: { status: 'READY' },
              summary: 'READY',
            })
          : request.executeTool ?? (async () => ({
              data: {},
              summary: 'No-op tool result.',
            })),
        previousInteractionId: null,
        prompt,
        systemInstruction: request.systemInstruction ?? 'Reply READY only.',
        tools: probeTools,
      },
      request.mode === 'plain' ? [] : undefined,
    );

    return {
      error: null,
      functionCalls: [],
      interactionId: result.interactionId,
      response: result.response,
      status: 'completed',
      toolEvents: result.toolEvents,
      usage: result.usage,
    };
  } catch (error) {
    logGeminiProviderError(error, `probe:${request.mode}`);
    return {
      error: getSanitizedGeminiProviderErrorDetails(error),
      functionCalls: [],
      interactionId: null,
      response: '',
      status: 'failed',
      toolEvents: [],
      usage: null,
    };
  }
}

export function createGeminiProvider(config: GeminiProviderConfig) {
  return {
    async chat(input: AbsoluteAiProviderRequest): Promise<AbsoluteAiProviderResponse> {
      if (!config.apiKey) {
        throw new Error('Missing GEMINI_API_KEY.');
      }

      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      try {
        return await runGeminiInteraction(ai, config, input);
      } catch (error) {
        logGeminiProviderError(error, 'chat');
        throw error;
      }
    },
  };
}
