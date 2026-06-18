import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonStrict } from "../src/llm/anthropic.js";

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
