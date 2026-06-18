import { resolveProvider } from "./provider.js";
import { createAnthropicClient } from "./anthropic.js";
import { createOpenAIClient } from "./openai.js";

/**
 * Create a provider-agnostic LLM client. Detection/selection is handled by
 * `resolveProvider` — callers may pass explicit opts or rely on env vars.
 *
 * @param {{provider?: "anthropic"|"openai", apiKey?: string, model?: string}} [opts]
 */
export function createLlmClient(opts = {}) {
  const resolved = resolveProvider(opts);
  const maxTokens = parseMaxTokens(process.env.ASPICE_LLM_MAX_TOKENS);
  if (resolved.provider === "anthropic") {
    return createAnthropicClient({
      apiKey: resolved.apiKey,
      model: resolved.model ?? process.env.ASPICE_LLM_MODEL ?? "claude-sonnet-4-6",
      ...(maxTokens ? { maxTokens } : {}),
    });
  }
  if (resolved.provider === "openai") {
    return createOpenAIClient({
      apiKey: resolved.apiKey,
      model: resolved.model ?? process.env.ASPICE_LLM_MODEL ?? "gpt-4o",
      ...(maxTokens ? { maxTokens } : {}),
    });
  }
  throw new Error(`Unsupported provider: ${resolved.provider}`);
}

function parseMaxTokens(raw) {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
