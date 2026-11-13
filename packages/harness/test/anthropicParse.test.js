import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonStrict, createAnthropicClient } from "../src/llm/anthropic.js";

test("parseJsonStrict: parses raw JSON object", () => {
  assert.deepEqual(parseJsonStrict('{"scorePercent": 80}'), { scorePercent: 80 });
});

test("parseJsonStrict: strips ```json fences", () => {
  assert.deepEqual(parseJsonStrict('```json\n{"ok": true}\n```'), { ok: true });
});

test("parseJsonStrict: empty / whitespace output gives a clear error (not 'Unexpected end of JSON input')", () => {
  for (const t of ["", "   ", "\n\t"]) {
    assert.throws(() => parseJsonStrict(t), /empty model output/);
  }
});

test("parseJsonStrict: prose with no JSON object gives a clear error", () => {
  assert.throws(() => parseJsonStrict("죄송하지만 평가할 수 없습니다."), /No JSON object found/);
});

test("parseJsonStrict: truncated JSON reports length + tail instead of cryptic native error", () => {
  // Mimics a response cut off at max_tokens: opens an object + a nested one,
  // so a `{` and a `}` exist but the slice is not valid JSON.
  const truncated = '{"findings": [{"id": "F-01", "situation": "관찰된 사실}';
  assert.throws(
    () => parseJsonStrict(truncated),
    (err) => /failed to parse model JSON/.test(err.message) && /length=/.test(err.message),
  );
});

test("createAnthropicClient: request body carries no sampling parameters (Opus 4.7+ rejects temperature)", async () => {
  let body;
  const fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(
      JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "m", content: [{ type: "text", text: '{"ok":true}' }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const client = createAnthropicClient({ apiKey: "k", model: "claude-opus-4-8", fetch });
  const out = await client.generateJson({ system: "s", context: "c", task: "t" });
  assert.deepEqual(out.parsed, { ok: true });
  for (const k of ["temperature", "top_p", "top_k"]) assert.ok(!(k in body), `${k} must not be sent`);
  assert.equal(body.model, "claude-opus-4-8");
});
