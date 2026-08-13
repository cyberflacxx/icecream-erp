import { GoogleGenAI } from '@google/genai';

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

type GeminiErrorLike = Error & {
  details?: unknown;
  status?: number;
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

function extractFunctionCalls(interaction: Record<string, unknown>) {
  const steps = Array.isArray(interaction.steps) ? interaction.steps : [];
  const outputs = Array.isArray(interaction.outputs) ? interaction.outputs : [];
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

  const steps = Array.isArray(interaction.steps) ? interaction.steps : [];
  for (const step of steps) {
    if (!step || typeof step !== 'object' || String((step as { type?: unknown }).type ?? '') !== 'model_output') {
      continue;
    }

    const content = Array.isArray((step as { content?: unknown }).content)
      ? (step as { content: Array<Record<string, unknown>> }).content
      : [];
    const text = content
      .filter((entry) => entry?.type === 'text' && typeof entry.text === 'string')
      .map((entry) => String(entry.text))
      .join('\n')
      .trim();

    if (text) return text;
  }

  return 'Absolute AI could not generate a response.';
}

export function normalizeAbsoluteAiProviderError(error: unknown) {
  const value = error as GeminiErrorLike | undefined;
  const status = Number(value?.status ?? 0);
  const message = value?.message ?? 'Absolute AI provider error.';

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

export function createGeminiProvider(config: GeminiProviderConfig) {
  return {
    async chat(input: AbsoluteAiProviderRequest): Promise<AbsoluteAiProviderResponse> {
      if (!config.apiKey) {
        throw new Error('Missing GEMINI_API_KEY.');
      }

      const ai = new GoogleGenAI({ apiKey: config.apiKey });
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
            tools: input.tools as never,
          }),
          ABSOLUTE_AI_PROVIDER_TIMEOUT_MS,
        ) as Record<string, unknown>;

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
            result: [
              {
                text: JSON.stringify(result.data),
                type: 'text',
              },
            ],
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
    },
  };
}
