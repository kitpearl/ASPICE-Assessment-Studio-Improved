import OpenAI from "openai";

/**
 * OpenAI client adapter with JSON response mode.
 * The OpenAI API does not expose the same prompt-caching primitive as
 * Anthropic, so system+context+task are concatenated. Costs for repeated
 * per-BP calls are higher than via Anthropic caching — users who care
 * about cost-efficient bulk assessment should prefer the Anthropic provider.
 */
// GPT-5 family and the o-series reasoning models changed the chat-completions
// contract: token budget moved to `max_completion_tokens`, and they reject any
// `temperature` other than the default (so `temperature=0`/`seed` must be
// omitted). gpt-4o and earlier keep the original `max_tokens` + temperature/seed
// path. Match on the leading family token so e.g. gpt-5.5 / gpt-5-mini / o3 all
// take the new path.
function usesReasoningContract(model = "") {
  return /^(gpt-5|o[1-9])/i.test(model);
}

export function createOpenAIClient({ apiKey, model = "gpt-4o", maxTokens = 8192, temperature = 0, seed = 42 } = {}) {
  if (!apiKey) throw new Error("OpenAI apiKey required");
  const client = new OpenAI({ apiKey });
  const reasoning = usesReasoningContract(model);

  return {
    provider: "openai",
    model,

    async generateJson({ system, context, task }) {
      const messages = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: [context, task].filter(Boolean).join("\n\n") });

      const params = {
        model,
        response_format: { type: "json_object" },
        messages,
      };
      if (reasoning) {
        // GPT-5 / o-series: token budget renamed; temperature/seed unsupported
        // (the API only accepts the default temperature, so determinism comes
        // from the model rather than temperature=0).
        params.max_completion_tokens = maxTokens;
      } else {
        // temperature=0 + fixed seed → reproducible scoring across repeated runs.
        // Without these, gpt-4o defaults to temperature=1 and the verdict varies
        // significantly each time the same artifact is re-evaluated.
        params.max_tokens = maxTokens;
        params.temperature = temperature;
        params.seed = seed;
      }

      const res = await client.chat.completions.create(params);

      const text = res.choices?.[0]?.message?.content ?? "";
      return { parsed: JSON.parse(text), raw: text, usage: res.usage };
    },
  };
}
