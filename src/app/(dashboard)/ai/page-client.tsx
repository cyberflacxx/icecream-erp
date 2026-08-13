'use client';

import { Bot, RefreshCcw, Sparkles, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type HealthCard = {
  detail: string;
  key: string;
  status: 'healthy' | 'problem' | 'unknown' | 'warning';
  title: string;
};

type ToolEvent = {
  detail: string;
  name: string;
  status: 'completed' | 'failed' | 'running';
  title: string;
};

type HealthPayload = {
  configured?: boolean;
  model?: string | null;
  provider?: string | null;
  summary?: HealthCard[];
};

type ChatMessage = {
  id: string;
  response?: string;
  toolEvents?: ToolEvent[];
  type: 'assistant' | 'user';
};

const suggestedPrompts = [
  'Check system health',
  'Find GRNs waiting to post',
  'Check inventory inconsistencies',
  'Analyse today\'s sales and stock',
  'Check fiscal period',
  'Audit role permissions',
];

function healthTone(status: HealthCard['status']) {
  if (status === 'healthy') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'problem') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function AbsoluteAiPageClient() {
  const [conversationId] = useState(() => crypto.randomUUID());
  const [previousInteractionId, setPreviousInteractionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<HealthCard[]>([]);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);

  const lastToolEvents = useMemo(
    () => [...messages].reverse().find((message) => message.type === 'assistant')?.toolEvents ?? [],
    [messages],
  );

  useEffect(() => {
    let active = true;
    void fetch('/api/ai/health', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Absolute AI health could not be loaded.');
        }
        return response.json();
      })
      .then((payload: HealthPayload) => {
        if (!active) return;
        setSummary(payload.summary ?? []);
        setConfigured(Boolean(payload.configured));
        setProviderLabel(
          payload.provider && payload.model
            ? `${payload.provider} / ${payload.model}`
            : payload.provider ?? payload.model ?? null,
        );
        setHealthError(null);
      })
      .catch((error) => {
        if (!active) return;
        setHealthError(error instanceof Error ? error.message : 'Absolute AI health could not be loaded.');
        setConfigured(null);
        setProviderLabel(null);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(nextPrompt: string) {
    const trimmed = nextPrompt.trim();
    if (!trimmed || submitting) return;
    if (configured === false) {
      setChatError('Absolute AI is deployed in read-only mode, but the Gemini provider is not configured yet.');
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      response: trimmed,
      type: 'user',
    };
    setMessages((current) => [...current, userMessage]);
    setPrompt('');
    setSubmitting(true);
    setChatError(null);

    try {
      const response = await fetch('/api/ai/chat', {
        body: JSON.stringify({
          conversationId,
          previousInteractionId,
          prompt: trimmed,
        }),
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? 'Absolute AI could not answer this request.');
      }

      setPreviousInteractionId(payload.previousInteractionId ?? null);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        response: String(payload.response ?? ''),
        toolEvents: Array.isArray(payload.toolEvents) ? payload.toolEvents : [],
        type: 'assistant',
      }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Absolute AI could not answer this request.';
      setChatError(message);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        response: message,
        type: 'assistant',
      }]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#fff5dd_0%,#ffffff_48%,#eef6ff_100%)] p-6 shadow-sm">
        <div className="absolute right-5 top-5 rounded-2xl border border-white/70 bg-white/80 p-3 text-amber-600 shadow-sm">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Absolute AI</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="rounded-2xl bg-slate-900 p-3 text-white">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-slate-900">Absolute AI</h1>
            <p className="text-sm text-slate-600">ERP System Doctor</p>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
          Read-only ERP diagnostics for GRNs, inventory, sales, fiscal periods, roles, and operational health.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.map((card) => (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">{card.title}</h2>
              <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase', healthTone(card.status))}>
                {card.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{card.detail}</p>
          </article>
        ))}
        {summary.length === 0 ? (
          <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600 md:col-span-2 xl:col-span-3">
            {healthError ?? 'Loading system doctor summary...'}
          </article>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Bot className="h-5 w-5" />
            <h2 className="text-base font-semibold">Suggested prompts</h2>
          </div>
          {configured === false ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Gemini is not configured for this environment yet.
              {providerLabel ? ` Expected provider: ${providerLabel}.` : null}
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {suggestedPrompts.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => { void submit(suggestion); }}
                disabled={submitting || configured === false}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tool activity</p>
            <div className="mt-3 space-y-2">
              {lastToolEvents.length > 0 ? lastToolEvents.map((event) => (
                <div key={`${event.name}-${event.detail}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{event.detail}</p>
                </div>
              )) : (
                <p className="text-sm text-slate-600">No tool activity yet.</p>
              )}
            </div>
          </div>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex min-h-[420px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto pb-4">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Ask Absolute AI about GRN posting, inventory mismatches, sales stock deduction, fiscal periods, or role permissions.
                </div>
              ) : messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6',
                    message.type === 'user'
                      ? 'ml-auto bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-800',
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.response}</p>
                </div>
              ))}
              {submitting ? (
                <div className="max-w-[85%] rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Absolute AI is checking the ERP...
                </div>
              ) : null}
            </div>

            <form
              className="border-t border-slate-200 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(prompt);
              }}
            >
              <label className="block text-sm font-medium text-slate-900" htmlFor="absolute-ai-prompt">
                Ask Absolute AI
              </label>
              <textarea
                id="absolute-ai-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={configured === false ? 'Gemini provider is not configured yet.' : 'Why is this GRN not posting?'}
                disabled={configured === false}
                className="mt-3 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {chatError ? chatError : configured === false ? 'Gemini configuration is required before chat can run.' : 'Absolute AI is read-only in this first release.'}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMessages([]);
                      setPreviousInteractionId(null);
                      setChatError(null);
                    }}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    New chat
                  </Button>
                  <Button type="submit" disabled={submitting || !prompt.trim() || configured === false}>
                    {submitting ? 'Checking...' : 'Ask Absolute AI'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </section>
    </div>
  );
}
