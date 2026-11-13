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
export function createAnthropicClient({ apiKey, model = "claude-sonnet-4-6", maxTokens = 16384, fetch } = {}) {
  if (!apiKey) throw new Error("Anthropic apiKey required");
  // `fetch` is injectable for tests (request-body assertions); undefined → SDK default.
  const client = new Anthropic({ apiKey, ...(fetch ? { fetch } : {}) });

  return {
    provider: "anthropic",
    model,

    async generateJson({ system, context, task }) {
      const systemParts = [];
      if (system) systemParts.push({ type: "text", text: system, cache_control: { type: "ephemeral" } });

      const userContent = [];
      if (context) userContent.push({ type: "text", text: context, cache_control: { type: "ephemeral" } });
      userContent.push({ type: "text", text: task || "" });

      // 샘플링 파라미터(temperature/top_p/top_k)는 보내지 않는다. Claude Opus 4.7 이후
      // 모델은 이 필드를 받으면 400 Bad Request 를 돌려주고, temperature=0 은 이전
      // 모델에서도 동일 출력을 보장하지 않았다. 결정성은 프롬프트와 JSON 엄격 파싱,
      // 그리고 서버 쪽 llmResponseCache(_harnessService.js) 로 확보한다.
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
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
