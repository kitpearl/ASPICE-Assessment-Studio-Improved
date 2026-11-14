// 구조화 평가 패리티 골든 생성기.
// 사용: node scripts/genAssessmentGolden.js <dir>
//   <dir> 안의 *-input.json({verdict, artifacts, skipped?, engines}) 마다 같은 이름의 <name>.json 을 만든다.
//   운영(Java) 저장소의 backend/src/test/resources/golden/assessment 가 <dir> 이다. Java 의 AssessmentParityTest 가
//   같은 입력을 VerdictAssessmentAdapter 로 변환해 이 출력과 deep-equal 비교한다.
// assessmentId 는 고정(ASM-GOLDEN)이고 documentId·contentHash 는 파일명·본문 해시라 결정적이다.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { assessmentFromVerdict } from "../src/assessment/fromVerdict.js";

const dir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("usage: node scripts/genAssessmentGolden.js <dir>");
  process.exit(2);
}
const inputs = readdirSync(dir).filter((f) => f.endsWith("-input.json")).sort();
if (!inputs.length) {
  console.error(`${dir} 에 *-input.json 이 없다`);
  process.exit(2);
}
for (const f of inputs) {
  const { verdict, artifacts = [], skipped = [], engines = [] } = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  const a = assessmentFromVerdict(verdict, { artifacts, skipped, engines, assessmentId: "ASM-GOLDEN" });
  const out = resolve(dir, `${basename(f, "-input.json")}.json`);
  writeFileSync(out, JSON.stringify(a, null, 2) + "\n", "utf8");
  console.log(`${basename(out)}: bp ${a.bpResults.length} · findings ${a.findings.length} · rules ${a.ruleEvaluations.length} · evidence ${a.evidence.length}`);
}
