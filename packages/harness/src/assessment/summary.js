// 최종 평가 데이터 하나에서 요약(강점·Finding·등급 분포·결론)을 만든다.
// 화면·텍스트·PDF 는 모두 이 결과만 렌더링한다 — 각자 따로 계산하지 않는다.

const ACTIVE = new Set(["ACCEPTED", "MODIFIED"]);
const NEGATIVE = new Set(["WEAKNESS", "MISSING_EXPECTATION"]);

export const bpOfExpectation = (expectationId) => String(expectationId).replace(/\.E\d+$/, "");

export function deriveSummary(a) {
  const findings = a.findings ?? [];
  const active = findings.filter((f) => ACTIVE.has(f.disposition));
  const bpOfFinding = (f) => f.bpId ?? bpOfExpectation(f.expectationIds?.[0] ?? "");
  const strengths = active.filter((f) => f.findingType === "STRENGTH");
  const weaknesses = active.filter((f) => NEGATIVE.has(f.findingType));
  const deferred = findings.filter((f) => f.disposition === "DEFERRED");
  const pendingRules = (a.ruleEvaluations ?? []).filter((r) => r.applicationStatus === "PENDING_REVIEW" || r.applicationStatus === "NEEDS_REVIEW");
  const openConflicts = (a.conflicts ?? []).filter((c) => c.resolution !== "RESOLVED_BY_EVIDENCE");

  const distribution = { N: 0, P: 0, L: 0, F: 0, UNRATED: 0 };
  const bpRows = (a.bpResults ?? []).map((bp) => {
    const val = bp.rating.value;
    if (val && distribution[val] != null) distribution[val] += 1;
    else distribution.UNRATED += 1;
    return {
      bpId: bp.bpId,
      rating: val,
      productGrade: bp.rating.productGrade ?? null,
      status: bp.rating.status,
      retrievalScore: bp.retrievalScore ?? null,
      unresolvedIssues: bp.rating.unresolvedIssues,
    };
  });

  const openIssues = [
    ...pendingRules.map((r) => ({ kind: "RULE_PENDING", ref: `${r.ruleId}${r.targetId ? `→${r.targetId}` : ""}`, text: r.rationale })),
    ...openConflicts.map((c) => ({ kind: "CONFLICT", ref: c.conflictId, text: c.rationale })),
    ...(a.consistencyChecks ?? []).filter((c) => c.status !== "PASS" && c.checkId !== "ASSESSMENT-INVARIANTS").map((c) => ({ kind: "DOCUMENT_CHECK", ref: c.checkId, text: c.detail })),
    ...(a.consistencyChecks ?? []).filter((c) => c.status === "FAIL" && c.checkId === "ASSESSMENT-INVARIANTS").map((c) => ({ kind: "INVARIANT_FAIL", ref: c.checkId, text: c.detail })),
    ...deferred.map((f) => ({ kind: "FINDING_DEFERRED", ref: f.findingId, text: f.dispositionReason })),
  ];

  const isDoc = a.assessmentScope === "DOCUMENT_ADEQUACY";
  return {
    assessmentId: a.assessmentId,
    scope: a.assessmentScope,
    // 문서 적절성 검토는 계획서가 요구를 충족하도록 정의됐는지만 말한다. 실제 PA/CL 달성은 말하지 않는다.
    conclusion: isDoc
      ? "문서 적절성 검토(잠정). 이 결과는 계획서가 BP 기대사항을 충족하도록 정의했는지에 대한 검토이며 실제 프로세스 수행에 따른 PA/CL 달성을 판정하지 않는다."
      : a.capabilityResult?.status === "FINAL"
        ? `프로세스 수행 평가 결과: Capability Level ${a.capabilityResult.value ?? "-"}`
        : "프로세스 수행 평가(미확정). 미해결 사항이 있어 PA/CL 을 확정하지 않았다.",
    capability: isDoc ? { status: "NOT_APPLICABLE", value: null } : { status: a.capabilityResult?.status, value: a.capabilityResult?.value ?? null },
    distribution,
    bpRows,
    strengths: strengths.map((f) => ({ findingId: f.findingId, bpId: bpOfFinding(f), claim: f.claim ?? "" })),
    weaknesses: weaknesses.map((f) => ({ findingId: f.findingId, bpId: bpOfFinding(f), claim: f.claim ?? "", type: f.findingType })),
    openIssues,
    findingCount: weaknesses.length,
    // "특이 Finding 없음"은 약점도 미해결 사항도 없을 때만 허용한다.
    noFindingStatement: weaknesses.length === 0 && openIssues.length === 0 ? "특이 Finding 없음" : null,
  };
}

/** 텍스트(그리고 화면·PDF 의 텍스트 레이어) 공통 렌더러. */
export function renderSummaryText(s) {
  const lines = [];
  lines.push(`평가 범위: ${s.scope === "DOCUMENT_ADEQUACY" ? "문서 적절성 검토" : "프로세스 수행 평가"}`);
  lines.push(`결론: ${s.conclusion}`);
  lines.push(`등급 분포(공식 N/P/L/F): N ${s.distribution.N} · P ${s.distribution.P} · L ${s.distribution.L} · F ${s.distribution.F} · 미확정 ${s.distribution.UNRATED}`);
  for (const r of s.bpRows) lines.push(`  ${r.bpId}: ${r.rating ?? "미확정"}${r.productGrade ? ` (제품 세분 ${r.productGrade})` : ""} [${r.status}]`);
  lines.push(`◆ 강점 ${s.strengths.length}건`);
  for (const f of s.strengths) lines.push(`  - ${f.bpId}: ${f.claim}`);
  lines.push(`◆ Finding ${s.findingCount}건`);
  if (s.noFindingStatement) lines.push(`  ${s.noFindingStatement}`);
  for (const f of s.weaknesses) lines.push(`  - ${f.bpId}: ${f.claim}`);
  if (s.openIssues.length) {
    lines.push(`◆ 미해결·검토 대기 ${s.openIssues.length}건`);
    for (const o of s.openIssues) lines.push(`  - [${o.ref}] ${o.text}`);
  }
  return lines.join("\n");
}

/** 렌더된 텍스트에서 최종 등급과 Finding 수를 다시 읽는다(출력 간 일치 검사용). */
export function parseRenderedSummary(text) {
  const ratings = {};
  for (const m of String(text).matchAll(/^\s+(\S+\.BP\d+|BP\d+): (N|P|L|F|미확정)/gm)) ratings[m[1]] = m[2];
  const findingCount = Number(String(text).match(/◆ Finding (\d+)건/)?.[1] ?? NaN);
  const strengthCount = Number(String(text).match(/◆ 강점 (\d+)건/)?.[1] ?? NaN);
  return { ratings, findingCount, strengthCount, claimsNoFinding: /특이 Finding 없음/.test(text) };
}
