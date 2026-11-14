// 독립 평가자 반복 실행 결과의 과반 합의 집계. 외부 LLM 호출 없음, 결정적.
// "[real]" = 실제 SUP.10 반복 실행 4회(independent-review/1.2.0)에서 관찰한 규칙 판정, "[synthetic]" = 합성.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRuleVerdicts, aggregateVerdicts, aggregateFlags, aggregateRatings, buildConsensus } from "../src/assessment/consensus.js";

const REAL_RUNS = [
  { "SUP.10.RL.1": "UNKNOWN", "SUP.10.RL.2": "FALSE", "SUP.10.RL.8": "UNKNOWN", "SUP.10.RL.10": "TRUE", "SUP.10.RL.7": "FALSE" },
  { "SUP.10.RL.1": "FALSE", "SUP.10.RL.2": "UNKNOWN", "SUP.10.RL.8": "UNKNOWN", "SUP.10.RL.10": "TRUE", "SUP.10.RL.7": "FALSE" },
  { "SUP.10.RL.1": "FALSE", "SUP.10.RL.2": "UNKNOWN", "SUP.10.RL.8": "FALSE", "SUP.10.RL.10": "TRUE", "SUP.10.RL.7": "FALSE" },
  { "SUP.10.RL.1": "FALSE", "SUP.10.RL.2": "UNKNOWN", "SUP.10.RL.8": "FALSE", "SUP.10.RL.10": "UNKNOWN", "SUP.10.RL.7": "FALSE" },
];

test("[real] 과반(전체 회차의 절반 초과)이 같은 판정만 채택한다", () => {
  const r = aggregateVerdicts(REAL_RUNS);
  assert.equal(r["SUP.10.RL.2"].consensus, "UNKNOWN"); // 3/4
  assert.equal(r["SUP.10.RL.2"].adopted, true);
  assert.deepEqual(r["SUP.10.RL.2"].counts, { TRUE: 0, FALSE: 1, UNKNOWN: 3, MISSING: 0 });
  assert.equal(r["SUP.10.RL.7"].consensus, "FALSE"); // 4/4
  assert.equal(r["SUP.10.RL.7"].agreement, 1);
  assert.equal(r["SUP.10.RL.10"].consensus, "TRUE"); // 3/4 — 일치 수가 많아도 과반이면 채택(참조표와 다를 수 있음은 별개)
  assert.equal(r["SUP.10.RL.1"].consensus, "FALSE");
});

test("[real] 과반이 없으면(2:2) 채택하지 않고 UNKNOWN 으로 남긴다", () => {
  const r = aggregateVerdicts(REAL_RUNS)["SUP.10.RL.8"];
  assert.equal(r.adopted, false);
  assert.equal(r.consensus, "UNKNOWN");
  assert.match(r.note, /과반 없음/);
  assert.deepEqual(r.counts, { TRUE: 0, FALSE: 2, UNKNOWN: 2, MISSING: 0 });
});

test("[synthetic] 규칙을 찾지 못한 회차(MISSING)는 분모에 포함되어 과반을 어렵게 한다", () => {
  const runs = [{ R: "TRUE" }, { R: "TRUE" }, {}, {}];
  const r = aggregateVerdicts(runs).R;
  assert.equal(r.adopted, false, "4회 중 2회는 과반이 아니다");
  assert.equal(r.counts.MISSING, 2);
  const r3 = aggregateVerdicts([{ R: "TRUE" }, { R: "TRUE" }, {}]).R;
  assert.equal(r3.adopted, true, "3회 중 2회는 과반");
});

test("[synthetic] 회차가 3회 미만이면 합의의 의미가 제한된다는 경고를 낸다", () => {
  const c = buildConsensus([{ verdicts: { R: "TRUE" } }, { verdicts: { R: "TRUE" } }]);
  assert.ok(c.warnings.some((w) => /3회 미만/.test(w)));
  assert.equal(c.runCount, 2);
  const none = buildConsensus([]);
  assert.equal(none.runCount, 0);
  assert.ok(none.warnings.length > 0);
});

test("[real] 문서 수준 발견은 과반 회차에서 발견된 것만 채택한다 (Defer 2/4 는 비채택)", () => {
  const flags = [
    { defer: false, riskAcceptance: true, ratio9of15: true },
    { defer: true, riskAcceptance: true, ratio9of15: true },
    { defer: true, riskAcceptance: true, ratio9of15: true },
    { defer: false, riskAcceptance: true, ratio9of15: true },
  ];
  const r = aggregateFlags(flags);
  assert.equal(r.defer.adopted, false);
  assert.equal(r.defer.count, 2);
  assert.equal(r.riskAcceptance.adopted, true);
  assert.equal(r.ratio9of15.count, 4);
  assert.equal(r.defer.rate, 0.5);
});

test("[synthetic] BP 등급은 최빈값이 과반일 때만 채택하고 아니면 미확정(null)", () => {
  const r = aggregateRatings([{ BP2: "L+", BP4: "F" }, { BP2: "L", BP4: "F" }, { BP2: "L+", BP4: "F" }, { BP2: "L", BP4: "F" }]);
  assert.equal(r.BP4.rating, "F");
  assert.equal(r.BP2.rating, null, "L+ 2 : L 2 는 과반 없음");
  assert.equal(r.BP2.adopted, false);
  assert.deepEqual(r.BP2.counts, { "L+": 2, L: 2 });
});

test("[real] 리뷰 마크다운 D 표에서 규칙 판정을 추출한다", () => {
  const md = `## C. 어쩌고
| SUP.10.RL.9 | 이 줄은 D 가 아니라 TRUE 가 들어 있어도 무시 | TRUE |

## D. 규칙별 적용 조건과 결과

| 규칙 ID | 적용 조건 | 조건 판정 | 근거 |
|---|---|---|---|
| SUP.10.RL.3 | 대표성 | **UNKNOWN** | §3.2 ... |
| SUP.10.RL.10 | 종결 수락 | TRUE | §10.2 |
| TAC.RL.1 | 클러스터 | **TRUE** | §9.2 |
| SUP.10.RL.7 | 검증 | FALSE | §7.1 |

## E. 중간 지적`;
  const v = parseRuleVerdicts(md);
  assert.deepEqual(v, { "SUP.10.RL.3": "UNKNOWN", "SUP.10.RL.10": "TRUE", "TAC.RL.1": "TRUE", "SUP.10.RL.7": "FALSE" });
});
