import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("extractor exits with message when sources missing", () => {
  const r = spawnSync(process.execPath, ["spec/extractor.js"], {
    cwd: HARNESS,
    env: { ...process.env, ASPICE_SPEC_SOURCES: join(tmpdir(), "no-such-dir") },
    encoding: "utf8",
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /spec\/sources\/README\.md/);
});
