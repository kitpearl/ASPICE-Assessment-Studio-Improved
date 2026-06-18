import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client adapter.
 *
 * Exposes a uniform `generateJson({ system, context, task })` surface that
 * the harness LlmScorer uses regardless of provider.
 *
 * Prompt caching: the `system` and `context` blocks are marked with
 * `cache_control: ephemeral` so that repeated per-BP / per-GP calls for the
 * same process reuse the prefix. The `task` block is dynamic and not cached.
 */
export function createAnthropicClient({ apiKey, model = "claude-sonnet-4-6", maxTokens = 16384, temperature = 0 } = {}) {
  if (!apiKey) throw new Error("Anthropic apiKey required");
  const client = new Anthropic({ apiKey });

  return {
    provider: "anthropic",
    model,

    async generateJson({ system, context, task }) {
      const systemParts = [];
      if (system) systemParts.push({ type: "text", text: system, cache_control: { type: "ephemeral" } });

      const userContent = [];
      if (context) userContent.push({ type: "text", text: context, cache_control: { type: "ephemeral" } });
      userContent.push({ type: "text", text: task || "" });

      // temperature=0 minimises sampling variance so the same artifact yields
      // a stable verdict on repeated evaluations.
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemParts.length ? systemParts : undefined,
        messages: [{ role: "user", content: userContent }],
      });

      const text = (res.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      // A truncated response (model hit the output token cap) yields JSON that
      // begins with `{` but is cut off mid-object — JSON.parse then throws the
      // cryptic "Unexpected end of JSON input". Surface a clear, actionable
      // cause here instead so the harness logs/fallback explain what happened.
      if (res.stop_reason === "max_tokens") {
        throw new Error(
          `model output truncated at max_tokens=${maxTokens} (incomplete JSON); raise ASPICE_LLM_MAX_TOKENS or reduce excerpt size`,
        );
      }
      return { parsed: parseJsonStrict(text), raw: text, usage: res.usage };
    },
  };
}

export function parseJsonStrict(text) {
  if (!text || !text.trim()) throw new Error("empty model output (no text content returned)");
  // Accept raw JSON OR JSON wrapped in ```json ... ``` fences.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object found in model output");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) {
    // Likely truncated/malformed JSON — include length + a tail snippet so the
    // failure is diagnosable from the logs rather than just "Unexpected end of JSON input".
    const snippet = cleaned.slice(Math.max(0, cleaned.length - 120));
    throw new Error(`failed to parse model JSON (${err.message}); output length=${cleaned.length}, tail=…${snippet}`);
  }
}
