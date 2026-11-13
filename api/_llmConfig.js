// Shared LLM provider/model selection for the server-side services
// (_harnessService.js scoring and _qaDraftService.js QA drafts). Both read the
// explicitly-passed `env` object (Vercel serverless and the Vite dev middleware
// each hand us their own).

export const DEFAULT_MODELS = { openai: "gpt-4o", anthropic: "claude-sonnet-4-6" };

function parseConcurrency(raw, fallback) {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Provider precedence:
//   1. ASPICE_LLM_PROVIDER ("openai" | "anthropic") pins the provider
//   2. otherwise Anthropic when ANTHROPIC_API_KEY is set (default provider)
//   3. otherwise OpenAI when OPENAI_API_KEY is set
// Model: ASPICE_LLM_MODEL or DEFAULT_MODELS[provider].
// Concurrency: ASPICE_LLM_CONCURRENCY (default 5).
// Returns null when no usable key is configured.
export function resolveLlmConfig(env = {}) {
  const e = env ?? {};
  const pinned = e.ASPICE_LLM_PROVIDER;
  const provider =
    pinned === "openai" || pinned === "anthropic"
      ? pinned
      : e.ANTHROPIC_API_KEY
        ? "anthropic"
        : e.OPENAI_API_KEY
          ? "openai"
          : null;
  if (!provider) return null;
  const apiKey = provider === "anthropic" ? e.ANTHROPIC_API_KEY : e.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = e.ASPICE_LLM_MODEL || DEFAULT_MODELS[provider];
  const concurrency = parseConcurrency(e.ASPICE_LLM_CONCURRENCY, 5);
  return { provider, apiKey, model, concurrency };
}

// Bound the number of in-flight generateJson calls so a large request does
// not open dozens of API calls at once and hit rate limits.
export function limitConcurrency(client, max) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < max && queue.length) {
      const { prompt, resolve, reject } = queue.shift();
      active++;
      Promise.resolve()
        .then(() => client.generateJson(prompt))
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  return {
    ...client,
    generateJson(prompt) {
      return new Promise((resolve, reject) => {
        queue.push({ prompt, resolve, reject });
        pump();
      });
    },
  };
}
