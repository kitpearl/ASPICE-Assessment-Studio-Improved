import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lookupStandardRefs,
  loadBgbIndex,
  loadIsoIndex,
  _clearStandardRefsCache,
} from "../spec/standardRefs.js";

// After P5-bis the BGB index is auto-extracted from the VDA guideline by
// scripts/extractBgbRules.js. The exact ruleId set per BP is a property of
// that source document; the tests below pin behaviour (lookup works, refs
// match the regex, dedupe holds, MD + CSV both feed the index) without
// hard-coding every value the extractor produced.

const RL_RE = /^\[[A-Z][A-Z0-9.]*\.RL\.(?:\d+|xx)\]$/;
const ISO_RE = /^ISO(?:\/IEC)?\s+\d+/;

test("lookupStandardRefs: returns rule IDs for an extracted BP and ISO clauses from the CSV", () => {
  _clearStandardRefsCache();
  const refs = lookupStandardRefs("SWE.2.BP1");
  assert.ok(refs.bgbRL.length > 0, "expected SWE.2.BP1 to carry BGB rule IDs after extraction");
  for (const rl of refs.bgbRL) assert.match(rl, RL_RE);
  // ISO mappings are still authored manually in bpToClauses.csv (ISO
  // extraction is deferred per P5-bis scope decision).
  assert.ok(refs.iso.includes("ISO 26262-6:2018 §8.4.5"));
  assert.ok(refs.iso.includes("ISO/IEC 25010:2011 §4.2"));
});

test("lookupStandardRefs: unknown BP yields empty arrays (no throw)", () => {
  _clearStandardRefsCache();
  const refs = lookupStandardRefs("XYZ.99.BP99");
  assert.deepEqual(refs.bgbRL, []);
  assert.deepEqual(refs.iso, []);
});

test("lookupStandardRefs: null / non-string / empty input is safe", () => {
  for (const x of [null, undefined, "", 42, {}, []]) {
    const refs = lookupStandardRefs(x);
    assert.deepEqual(refs, { bgbRL: [], iso: [] });
  }
});

test("loadBgbIndex / loadIsoIndex: every surfaced ref matches its validator", () => {
  _clearStandardRefsCache();
  const bgb = loadBgbIndex();
  const iso = loadIsoIndex();
  for (const arr of bgb.values()) {
    for (const rl of arr) assert.match(rl, RL_RE);
  }
  for (const arr of iso.values()) {
    for (const c of arr) assert.match(c, ISO_RE);
  }
});

test("lookupStandardRefs: multiple rules can map to the same BP", () => {
  _clearStandardRefsCache();
  // Pick a BP we know the extractor populated heavily (SUP.10.BP2 has
  // several rules in the source). The exact count is brittle; just check
  // that the system supports >1.
  const refs = lookupStandardRefs("SUP.10.BP2");
  assert.ok(refs.bgbRL.length > 1, "expected SUP.10.BP2 to carry multiple rule IDs");
});

test("lookupStandardRefs: bracketed rule IDs from the extractor are accepted", () => {
  _clearStandardRefsCache();
  const refs = lookupStandardRefs("SYS.2.BP1");
  assert.ok(refs.bgbRL.some((r) => r.startsWith("[SYS.2.RL.")), "expected SYS.2.BP1 to include native SYS.2 rules");
});

test("loadBgbIndex: index keys cover both CSV-style and MD-style sources, deduped per (BP, ref)", () => {
  _clearStandardRefsCache();
  const idx = loadBgbIndex();
  // The extractor populates BPs across many processes. Sanity-check breadth:
  assert.ok(idx.size > 50, `expected wide BP coverage; got ${idx.size}`);
  // Within each BP, refs are deduped (set semantics).
  for (const arr of idx.values()) {
    assert.equal(arr.length, new Set(arr).size, "expected ref array to be deduped");
  }
});

// Confirm that the loader still picks up content from .md files: ISO
// clauses for SWE.3 are authored in bpToClauses.md (no MD-side BGB demo
// remains after P5-bis — both bgb files are auto-generated CSV/MD).
test("lookupStandardRefs: ISO clauses authored in Markdown are loaded (SWE.3)", () => {
  _clearStandardRefsCache();
  const refs = lookupStandardRefs("SWE.3.BP1");
  assert.ok(refs.iso.includes("ISO 26262-6:2018 §9.4.3"));
  assert.ok(refs.iso.includes("ISO/IEC 25010:2011 §4.2"));
});
