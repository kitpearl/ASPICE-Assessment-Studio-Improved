// 참조 판정표 마크다운 생성: node scripts/genReferenceTable.js <processId|ALL> [outDir]
// 큐레이션된 표가 없는 프로세스는 PAM·가이드라인에서 만든 골격을 쓴다.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadProcesses } from "../spec/canonical/index.js";
import { loadReferenceTable, renderReferenceMarkdown, validateReferenceTable } from "../src/assessment/referenceTable.js";

const [which = "SUP.10", out = resolve("../../docs/reference-judgments")] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ids = which === "ALL" ? loadProcesses().map((p) => p.id) : [which];
for (const id of ids) {
  const t = await loadReferenceTable(id);
  const problems = validateReferenceTable(t);
  if (problems.length) { console.error(id, problems); process.exit(1); }
  writeFileSync(resolve(out, `${id}.md`), renderReferenceMarkdown(t), "utf8");
  console.log(`${id}: ${t.curation}`);
}
