import { test } from "node:test";
import assert from "node:assert/strict";
import { _clearStandardRefsCache, loadBgbIndex, loadIsoIndex } from "../spec/standardRefs.js";

// The MD parser is exercised indirectly through the public lookup API. The
// demo files in spec/{bgb,iso}/ contain headings, paragraphs, and a single
// pipe table each — so picking up the table rows while ignoring prose covers
// the parser's core branches.

test("MD parser: ignores prose / titles outside pipe tables (BGB)", () => {
  _clearStandardRefsCache();
  const idx = loadBgbIndex();
  for (const key of idx.keys()) {
    assert.doesNotMatch(key, /매핑|Rating|BGB|Level/);
  }
  for (const arr of idx.values()) {
    for (const v of arr) assert.match(v, /^RL\d+(\.\d+)?$/);
  }
});

test("MD parser: ignores prose outside pipe tables (ISO)", () => {
  _clearStandardRefsCache();
  const idx = loadIsoIndex();
  for (const arr of idx.values()) {
    for (const v of arr) assert.match(v, /^ISO(\/IEC)?\s+\d+/);
  }
});

test("loader: scanning the real spec directory does not throw on the demo layout", () => {
  _clearStandardRefsCache();
  assert.doesNotThrow(() => loadBgbIndex());
  assert.doesNotThrow(() => loadIsoIndex());
});
