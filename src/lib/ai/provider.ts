import { ABSOLUTE_AI_DEFAULT_MODEL } from './types';
import type { AbsoluteAiProviderRequest, AbsoluteAiProviderResponse } from './types';
import { createGeminiProvider, normalizeAbsoluteAiProviderError } from './gemini';

export interface AbsoluteAiProvider {
  chat(input: AbsoluteAiProviderRequest): Promise<AbsoluteAiProviderResponse>;
}

export function getAbsoluteAiProviderName() {
  return String(process.env.AI_PROVIDER ?? 'gemini').trim().toLowerCase() || 'gemini';
}

export function getAbsoluteAiModel() {
  return String(process.env.GEMINI_MODEL ?? ABSOLUTE_AI_DEFAULT_MODEL).trim() || ABSOLUTE_AI_DEFAULT_MODEL;
}

export function isAbsoluteAiConfigured() {
  return getAbsoluteAiProviderName() === 'gemini' && Boolean(String(process.env.GEMINI_API_KEY ?? '').trim());
}

export function getAbsoluteAiProvider(): AbsoluteAiProvider {
  const provider = getAbsoluteAiProviderName();

  if (provider !== 'gemini') {
    throw new Error(`Unsupported Absolute AI provider: ${provider}`);
  }

  return createGeminiProvider({
    apiKey: String(process.env.GEMINI_API_KEY ?? '').trim(),
    model: getAbsoluteAiModel(),
  });
}

export { normalizeAbsoluteAiProviderError };
