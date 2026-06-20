/**
 * Minimal Anthropic (Claude) access over `fetch` — no `@anthropic-ai/sdk`,
 * matching the project's zero-dependency philosophy (cf. lib/stripe.ts).
 *
 *  - complete()      : a text completion. Returns text + token usage.
 *  - completeJson()  : forces a single tool call whose input_schema is your JSON
 *                      schema, so the model must return well-formed structured
 *                      data — the workhorse for agents (scoring, extraction, DNA).
 *
 * Every call reports usage to an optional `onUsage` sink (the agent runner uses
 * this to attribute tokens/cost to an agent_run and to the cost ledger).
 *
 * Degrades gracefully: with no ANTHROPIC_API_KEY the client runs in STUB mode and
 * returns clearly-marked placeholder output (cost 0). This keeps the app runnable
 * end-to-end in development; production callers that publish AI output should gate
 * on `aiConfigured` and surface a "not configured" notice (the Stripe pattern).
 */

import { modelFor, computeCostPence, type AiTier } from "./models";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** AI calls will hit the real API (key present). */
export const aiConfigured = Boolean(API_KEY);

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costPence: number;
  /** True when produced by STUB mode (no API key). */
  stub: boolean;
}

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  /** System prompt — the agent's role/instructions. */
  system?: string;
  /** Conversation so far (at minimum one user message). */
  messages: AiMessage[];
  /** Semantic model tier; defaults to "smart". */
  tier?: AiTier;
  maxTokens?: number;
  temperature?: number;
}

export interface CompleteResult {
  text: string;
  usage: AiUsage;
}

export interface JsonOptions<T> extends Omit<CompleteOptions, "messages"> {
  /** A single user instruction (the structured-output task). */
  prompt: string;
  /** Optional prior turns for context. */
  messages?: AiMessage[];
  /** JSON Schema (Anthropic tool input_schema) describing the desired shape. */
  schema: Record<string, unknown>;
  /** Tool name shown to the model; defaults to "respond". */
  toolName?: string;
  /** Used only to label stub output. */
  stubValue?: T;
}

/** Callback invoked with usage after each call (cost attribution). */
export type UsageSink = (usage: AiUsage) => void | Promise<void>;

export interface AiClient {
  complete(opts: CompleteOptions): Promise<CompleteResult>;
  completeJson<T>(opts: JsonOptions<T>): Promise<{ value: T; usage: AiUsage }>;
}

interface AnthropicResponse {
  model: string;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
  >;
  usage: { input_tokens: number; output_tokens: number };
}

async function callAnthropic(body: Record<string, unknown>): Promise<AnthropicResponse> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Anthropic request failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as AnthropicResponse;
}

function usageFrom(model: string, u: { input_tokens: number; output_tokens: number }): AiUsage {
  return {
    model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    costPence: computeCostPence(model, u.input_tokens, u.output_tokens),
    stub: false,
  };
}

const STUB_USAGE = (model: string): AiUsage => ({
  model,
  inputTokens: 0,
  outputTokens: 0,
  costPence: 0,
  stub: true,
});

/** Create a client bound to an optional usage sink. */
export function createAiClient(onUsage?: UsageSink): AiClient {
  const report = async (usage: AiUsage): Promise<AiUsage> => {
    if (onUsage) await onUsage(usage);
    return usage;
  };

  return {
    async complete(opts: CompleteOptions): Promise<CompleteResult> {
      const model = modelFor(opts.tier ?? "smart").id;
      if (!aiConfigured) {
        return {
          text: "[AI STUB] ANTHROPIC_API_KEY is not configured; returning placeholder text.",
          usage: await report(STUB_USAGE(model)),
        };
      }
      const res = await callAnthropic({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature,
        system: opts.system,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const text = res.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { text, usage: await report(usageFrom(res.model, res.usage)) };
    },

    async completeJson<T>(opts: JsonOptions<T>): Promise<{ value: T; usage: AiUsage }> {
      const model = modelFor(opts.tier ?? "smart").id;
      const toolName = opts.toolName ?? "respond";
      if (!aiConfigured) {
        return {
          value: (opts.stubValue ?? ({} as T)),
          usage: await report(STUB_USAGE(model)),
        };
      }
      const res = await callAnthropic({
        model,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature,
        system: opts.system,
        tools: [{ name: toolName, description: "Return the structured result.", input_schema: opts.schema }],
        tool_choice: { type: "tool", name: toolName },
        messages: [
          ...(opts.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: opts.prompt },
        ],
      });
      const toolUse = res.content.find(
        (b): b is { type: "tool_use"; id: string; name: string; input: unknown } => b.type === "tool_use"
      );
      if (!toolUse) throw new Error("Anthropic returned no tool_use block for completeJson().");
      return { value: toolUse.input as T, usage: await report(usageFrom(res.model, res.usage)) };
    },
  };
}

/** A shared client with no usage sink — for one-off calls outside an agent run. */
export const ai: AiClient = createAiClient();
