import { T, FONTS } from "../theme";

// 구조화 평가(assessment) 표시. 서버가 만든 assessment / assessmentSummary 만 그대로 보여 주며 화면에서 다시 계산하지 않는다.
const SCOPE_LABEL = { DOCUMENT_ADEQUACY: "문서 적절성 검토", PROCESS_PERFORMANCE: "프로세스 수행 평가" };
const COND_COLOR = { TRUE: T.err, FALSE: T.ok, UNKNOWN: T.warm };
const COND_LABEL = { TRUE: "TRUE · 성립", FALSE: "FALSE · 불성립", UNKNOWN: "UNKNOWN · 확인 필요" };
const STATUS_LABEL = {
  NOT_EVALUATED: "평가 안 함",
  NOT_TRIGGERED: "미적용",
  PENDING_REVIEW: "검토 대기",
  APPLIED: "적용됨",
  APPLIED_NO_CHANGE: "성립·변경 없음",
  CONSTRAINT_RECORDED: "하향 금지 기록",
  NEEDS_REVIEW: "검토 필요",
};
const EFFECT_LABEL = {
  EXCLUDE_F: "F 불가",
  CAP_AT_RATING: "등급 상한",
  DOWNRATE_REQUIRED: "하향 필수",
  NOT_HIGHER_THAN_SOURCE: "선행 BP보다 높을 수 없음",
  PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON: "특정 사유 하향 금지",
  MANUAL_REVIEW: "수동 판단",
};
const ISSUE_LABEL = { RULE_PENDING: "규칙", CONFLICT: "충돌", FINDING_DEFERRED: "보류", DOCUMENT_CHECK: "문서 점검", INVARIANT_FAIL: "검증 실패" };

const Label = ({ children }) => (
  <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: T.textLo, letterSpacing: "0.15em", textTransform: "uppercase", margin: "14px 0 6px" }}>{children}</div>
);
const TH = { textAlign: "left", fontSize: 11, color: T.textLo, padding: "4px 8px", borderBottom: `1px solid ${T.borderL}`, fontWeight: 600 };
const TD = { fontSize: 12, color: T.textHi, padding: "5px 8px", borderBottom: `1px solid ${T.borderL}`, verticalAlign: "top" };

export function AssessmentPanel({ assessment, summary, defaultOpen = false, title }) {
  if (!assessment || !summary) return null;
  const evals = assessment.ruleEvaluations ?? [];
  // 등급에 영향이 있거나 확인이 필요한 규칙만 보여 준다(조건 불성립은 개수로만 표시)
  const quiet = (e) => e.applicationStatus === "NOT_TRIGGERED" || e.applicationStatus === "NOT_EVALUATED";
  const notTriggered = evals.filter(quiet).length;
  const shown = evals.filter((e) => !quiet(e));
  const checks = (assessment.consistencyChecks ?? []).filter((c) => c.status !== "PASS");
  return (
    <details open={defaultOpen} style={{ margin: "8px 0 20px", padding: "12px 18px", background: T.surface2, border: `1px solid ${T.borderL}`, borderRadius: 5 }} data-html2canvas-ignore="true">
      <summary style={{ cursor: "pointer", fontFamily: FONTS.mono, fontSize: 11, letterSpacing: "0.12em", fontWeight: 700, color: T.accent }}>
        {title ?? "구조화 평가 (Assessment)"} · {SCOPE_LABEL[summary.scope] ?? summary.scope}
        <span style={{ marginLeft: 10, color: T.textLo, fontWeight: 400 }}>
          약점 {summary.findingCount}건 · 검토 대기 {summary.openIssues.length}건
        </span>
      </summary>

      <div style={{ fontSize: 13, color: T.textMd, lineHeight: 1.55, marginTop: 10 }}>{summary.conclusion}</div>
      <div style={{ fontSize: 12, color: T.textLo, marginTop: 6 }}>
        공식 등급 분포: N {summary.distribution.N} · P {summary.distribution.P} · L {summary.distribution.L} · F {summary.distribution.F} · 미확정 {summary.distribution.UNRATED}
        {summary.noFindingStatement ? ` · ${summary.noFindingStatement}` : ""}
      </div>

      <Label>BP 등급 (공식 N/P/L/F · 제품 세분 등급은 괄호)</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {summary.bpRows.map((r) => (
          <div key={r.bpId} style={{ border: `1px solid ${T.borderM}`, borderRadius: 4, padding: "4px 10px", fontSize: 12, background: T.surface }}>
            <span style={{ fontFamily: FONTS.mono, color: T.textLo }}>{r.bpId.split(".").pop()}</span>{" "}
            <strong>{r.rating ?? "미확정"}</strong>
            {r.productGrade && <span style={{ color: T.textLo }}> ({r.productGrade})</span>}
            {r.retrievalScore != null && <span style={{ color: T.textDim }} title="증거 후보 검색 점수 — 충족도·등급이 아님"> · 검색 {r.retrievalScore}%</span>}
            <span style={{ color: T.textDim }}> · {r.status === "WITHHELD" ? "보류" : "잠정"}</span>
          </div>
        ))}
      </div>

      {shown.length > 0 && (
        <>
          <Label>가이드라인 규칙 적용 (조건 판정 → 효과) · 조건 불성립 {notTriggered}건 생략</Label>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={TH}>규칙</th><th style={TH}>대상</th><th style={TH}>효과</th><th style={TH}>조건</th><th style={TH}>처리</th><th style={TH}>등급 변화</th></tr></thead>
              <tbody>
                {shown.map((e, i) => (
                  <tr key={`${e.ruleId}-${e.targetId}-${i}`} title={e.rationale}>
                    <td style={{ ...TD, fontFamily: FONTS.mono }}>{e.ruleId}</td>
                    <td style={TD}>{(e.targetId ?? "").split(".").pop()}</td>
                    <td style={TD}>{EFFECT_LABEL[e.effectType] ?? e.effectType}</td>
                    <td style={{ ...TD, color: COND_COLOR[e.conditionResult], fontWeight: 600 }}>{COND_LABEL[e.conditionResult]}</td>
                    <td style={TD}>{STATUS_LABEL[e.applicationStatus] ?? e.applicationStatus}</td>
                    <td style={{ ...TD, fontFamily: FONTS.mono }}>{e.beforeRating ?? "-"} → {e.afterRating ?? "보류"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>UNKNOWN 은 등급을 바꾸지 않고 심사자 확인으로 남깁니다. 하향 필수 규칙의 감점 폭은 심사자가 정합니다.</div>
        </>
      )}

      {checks.length > 0 && (
        <>
          <Label>문서 내부 일관성 점검</Label>
          {checks.map((c) => (
            <div key={c.checkId} style={{ fontSize: 12, color: T.textHi, marginBottom: 6 }}>
              <strong>{c.checkId}</strong> · {c.detail}
              {(c.items ?? []).slice(0, 4).map((it, i) => (
                <div key={i} style={{ color: T.textMd, marginLeft: 12 }}>
                  {it.kind ?? ""} {it.state ?? it.outcome ?? ""} {it.computed ? `(${it.computed}, 표기 ${it.stated})` : ""} {it.rationale ?? ""} {it.note ?? ""}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {summary.openIssues.length > 0 && (
        <>
          <Label>미해결·검토 대기</Label>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: T.textMd, lineHeight: 1.5 }}>
            {summary.openIssues.slice(0, 20).map((o, i) => (
              <li key={i}><strong>[{ISSUE_LABEL[o.kind] ?? o.kind}] {o.ref}</strong> {o.text}</li>
            ))}
          </ul>
        </>
      )}

      <Label>입력·버전 추적</Label>
      <div style={{ fontSize: 11, color: T.textLo, lineHeight: 1.6, fontFamily: FONTS.mono }}>
        {(assessment.inputManifest ?? []).map((d) => (
          <div key={d.documentId}>{d.fileName} · sha256 {d.contentHash ? d.contentHash.slice(0, 12) : "-"} · 추출 {d.extractionStatus}{d.unreadableRanges?.length ? ` (${d.unreadableRanges.join(", ")})` : ""}</div>
        ))}
        <div>PAM {assessment.pamVersion} · {assessment.guidelineVersion}</div>
        <div>engine {assessment.engineVersion} · prompt {assessment.promptVersion}</div>
        <div>ruleset {assessment.ruleSetVersion} · schema {assessment.schemaVersion}</div>
      </div>
    </details>
  );
}
