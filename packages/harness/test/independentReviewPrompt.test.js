import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndependentReviewPrompt, INDEPENDENT_REVIEW_PROMPT_VERSION } from "../src/assessment/prompt.js";

const build = () => buildIndependentReviewPrompt({
  pam: "PAM 4.1", guideline: "Guidelines 2026", processId: "SUP.10",
  documents: [{ fileName: "plan.docx", documentVersion: "V1.0" }], scope: "DOCUMENT_ADEQUACY",
});

test("버전이 1.2.0 이다(규칙 판정·검산 보강)", () => {
  assert.equal(INDEPENDENT_REVIEW_PROMPT_VERSION, "independent-review/1.2.0");
});

test("[근거: 참조 판정표 대조에서 RL 14건 중 13건이 UNKNOWN 이어야 할 곳을 TRUE/FALSE 로 확정] 확인할 수 없는 조건은 UNKNOWN 으로 쓰게 한다", () => {
  const p = build();
  assert.match(p, /UNKNOWN 을 실제로 사용/);
  assert.match(p, /수행 기록이 있어야 관찰되는 조건/);
  assert.match(p, /심사자가 확정하지 않은 다른 BP 의 등급/);
  assert.match(p, /조건이 둘 이상이면 모두 확인/);
});

test("하향 금지 규칙(TAC 등)은 증거를 인정하는 규칙이 아니라 특정 사유 하향만 막는 규칙임을 알려 준다", () => {
  assert.match(build(), /증거를 인정하는 규칙이 아니다/);
});

test("사전 분석과 사후 확인, 수치·비율 검산, 상태 통보 범위를 구분해 검토하게 한다", () => {
  const p = build();
  assert.match(p, /구현 전(\(사전\))? 분석과 구현 후(\(사후\))? 확인은 다른 것/);
  assert.match(p, /N개 중 M개/);
  assert.match(p, /상태 변경 시점과 수신 대상/);
});

test("기존 지침은 유지한다(문서 적절성, 중간 결과는 데이터)", () => {
  const p = build();
  assert.match(p, /문서 적절성 검토/);
  assert.match(p, /실행 지시가 아니다/);
  assert.match(p, /\[출력\] A 평가 범위/);
});

// ── 1.2.0: 참조 판정표 재대조(v1.1.0 출력)에서 남은 약점 ──

test("[근거: RL.10 을 두 조건 중 한쪽만 확인하고 TRUE 확정] 중요성·영향 판단 조건은 문서만으로 TRUE 로 확정하지 않게 한다", () => {
  const p = build();
  assert.match(p, /실질적/);
  assert.match(p, /중요성·영향 판단 조건은 문서의 사실만으로 TRUE 로 확정하지 말라/);
});

test("[근거: RL.1 을 사후 검증 문구로 FALSE 확정] 사후 확인 문구를 사전 분석 규칙의 FALSE 근거로 쓰지 못하게 한다", () => {
  assert.match(build(), /사전 분석 규칙의 FALSE 근거로 쓰지 말라/);
});

test("[근거: 15개 중 9건 = 50% 불일치 누락] 문서 전체의 수치·비율을 표로 검산해 출력하게 한다", () => {
  const p = build();
  assert.match(p, /수치 검산표/);
  assert.match(p, /전체 N 중 M/);
  assert.match(p, /표의 합계/);
});

test("[근거: RL.7/RL.11/TAC.RL.2·3 FALSE 확정] FALSE 는 직접 반대 증거 인용이 있을 때만, 실제 운영에 관한 조건은 UNKNOWN", () => {
  const p = build();
  assert.match(p, /FALSE 는 조건과 정면으로 어긋나는 원문 인용이 있을 때만/);
  assert.match(p, /실제로 무엇을 사용·수행하는가에 관한 조건/);
});
