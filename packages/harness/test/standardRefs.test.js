import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lookupStandardRefs,
  loadBgbIndex,
  loadIsoIndex,
  _clearStandardRefsCache,
} from "../spec/standardRefs.js";

test("lookupStandardRefs: returns BGB RL and ISO clauses for a demo BP", () => {
  _clearStandardRefsCache();
  const refs = lookupStandardRefs("SWE.2.BP1");
  assert.deepEqual(refs.bgbRL.sort(), ["RL3", "RL3.2"].sort());
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

test("loadBgbIndex / loadIsoIndex: drop rows with invalid ref formats", () => {
  _clearStandardRefsCache();
  // The loaders run hasBgbRL / hasIsoClause validators internally. The demo
  // CSV ships only well-formed rows, so all of them must appear in the index.
  const bgb = loadBgbIndex();
  const iso = loadIsoIndex();
  for (const arr of bgb.values()) {
    for (const rl of arr) assert.match(rl, /^RL\d+(\.\d+)?$/);
  }
  for (const arr of iso.values()) {
    for (const c of arr) assert.match(c, /^ISO(\/IEC)?\s+\d+/);
  }
});

test("lookupStandardRefs: multiple rows for the same BP all surface", () => {
  _clearStandardRefsCache();
  const refs = lookupStandardRefs("SWE.2.BP1");
  // BP1 has two RL rows and two ISO rows in the demo CSV.
  assert.equal(refs.bgbRL.length, 2);
  assert.equal(refs.iso.length, 2);
});

test("lookupStandardRefs: picks up entries from the demo Markdown file (SWE.3)", () => {
  _clearStandardRefsCache();
  const refs = lookupStandardRefs("SWE.3.BP1");
  // SWE.3 mappings live in the .md demo file, not the .csv.
  assert.deepEqual(refs.bgbRL.sort(), ["RL3", "RL3.2"].sort());
  assert.ok(refs.iso.includes("ISO 26262-6:2018 §9.4.3"));
  assert.ok(refs.iso.includes("ISO/IEC 25010:2011 §4.2"));
});

test("loadBgbIndex: union of CSV and MD sources is deduped per (BP, ref)", () => {
  _clearStandardRefsCache();
  const idx = loadBgbIndex();
  // SWE.2.BP1 is in the CSV; SWE.3.BP1 is in the MD. Both should be present.
  assert.ok(idx.has("SWE.2.BP1"));
  assert.ok(idx.has("SWE.3.BP1"));
  // Within each BP, refs are deduped (set semantics).
  for (const arr of idx.values()) {
    assert.equal(arr.length, new Set(arr).size, "expected ref array to be deduped");
  }
});
