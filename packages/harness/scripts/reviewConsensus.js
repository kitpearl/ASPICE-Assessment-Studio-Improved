// 독립 평가자 반복 실행 결과(마크다운 N개)의 규칙 판정을 과반 합의로 집계한다.
// 사용: node scripts/reviewConsensus.js <결과1.md> <결과2.md> <결과3.md> [...]   (LLM 호출 없음)
import { readFileSync } from "node:fs";
import { parseRuleVerdicts, buildConsensus } from "../src/assessment/consensus.js";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node scripts/reviewConsensus.js <review1.md> <review2.md> <review3.md> [...]");
  process.exit(2);
}
const runs = files.map((f) => ({ verdicts: parseRuleVerdicts(readFileSync(f, "utf8")) }));
const c = buildConsensus(runs);
console.log(`회차 ${c.runCount}회`);
for (const w of c.warnings) console.log(`! ${w}`);
console.log("\n규칙         | 합의     | 채택 | 합의율 | 비고");
for (const [id, v] of Object.entries(c.verdicts)) {
  console.log(`${id.padEnd(12)} | ${v.consensus.padEnd(8)} | ${v.adopted ? "O" : "X "}   | ${(v.agreement * 100).toFixed(0).padStart(3)}%   | ${v.note}`);
}
const adopted = Object.values(c.verdicts).filter((v) => v.adopted).length;
console.log(`\n채택 ${adopted}/${Object.keys(c.verdicts).length}건, 과반 없음 ${Object.keys(c.verdicts).length - adopted}건(UNKNOWN 으로 유지)`);
console.log(`\n${c.interpretation}`);
