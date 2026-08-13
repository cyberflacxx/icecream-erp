import { ABSOLUTE_AI_DEFAULT_MODEL } from './types';
import type { AbsoluteAiProviderRequest, AbsoluteAiProviderResponse } from './types';
import { createGeminiProvider, normalizeAbsoluteAiProviderError } from './gemini';

export interface AbsoluteAiProvider {
  chat(input: AbsoluteAiProviderRequest): Promise<AbsoluteAiProviderResponse>;
}

type AbsoluteAiProviderConfigDiagnostics = {
  apiKeyHasLeadingWhitespace: boolean;
  apiKeyHasTrailingWhitespace: boolean;
  apiKeyLength: number;
  apiKeyPresent: boolean;
  model: string;
  provider: string;
};

export function getAbsoluteAiProviderName() {
  return String(process.env.AI_PROVIDER ?? 'gemini').trim().toLowerCase() || 'gemini';
}

export function getAbsoluteAiModel() {
  return String(process.env.GEMINI_MODEL ?? ABSOLUTE_AI_DEFAULT_MODEL).trim() || ABSOLUTE_AI_DEFAULT_MODEL;
}

export function isAbsoluteAiConfigured() {
  return getAbsoluteAiProviderName() === 'gemini' && Boolean(String(process.env.GEMINI_API_KEY ?? '').trim());
}

export function getAbsoluteAiProviderConfig() {
  return {
    apiKey: String(process.env.GEMINI_API_KEY ?? '').trim(),
    model: getAbsoluteAiModel(),
    provider: getAbsoluteAiProviderName(),
  };
}

export function getAbsoluteAiProviderConfigDiagnostics(): AbsoluteAiProviderConfigDiagnostics {
  const rawApiKey = String(process.env.GEMINI_API_KEY ?? '');

  return {
    apiKeyHasLeadingWhitespace: rawApiKey.length > 0 && rawApiKey.trimStart() !== rawApiKey,
    apiKeyHasTrailingWhitespace: rawApiKey.length > 0 && rawApiKey.trimEnd() !== rawApiKey,
    apiKeyLength: rawApiKey.trim().length,
    apiKeyPresent: Boolean(rawApiKey.trim()),
    model: getAbsoluteAiModel(),
    provider: getAbsoluteAiProviderName(),
  };
}

export function getAbsoluteAiProvider(): AbsoluteAiProvider {
  const { apiKey, model, provider } = getAbsoluteAiProviderConfig();

  if (provider !== 'gemini') {
    throw new Error(`Unsupported Absolute AI provider: ${provider}`);
  }

  return createGeminiProvider({
    apiKey,
    model,
  });
}

export { normalizeAbsoluteAiProviderError };
