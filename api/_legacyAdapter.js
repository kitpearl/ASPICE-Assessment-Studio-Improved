// Bridges the harness ProcessVerdict to the legacy UI shape
// {ratings, summary, strengths, gaps} that the per-process VerdictCard
// component still consumes. Also Koreanizes English template phrases
// emitted by ruleScorer/hybridScorer so the verdict UI is single-language.

import { displayArtifactName } from "aspice-harness/io";
import { bpTitleKo } from "./_bpTitlesKo.js";

// Translate rule/hybrid scorer English template phrases (and the [rule]/[llm]
// tag prefixes that hybridScorer prepends) into Korean.
export function koreanizeGap(text) {
  if (!text) return text;
  let out = String(text);
  out = out.replace(/^\[rule\]\s*/i, "[규칙] ");
  out = out.replace(/^\[llm\]\s*/i, "[LLM] ");
  out = out.replace(/No evidence found for keywords:/i, "키워드 증거 미발견:");
  out = out.replace(/GP evidence missing:/i, "GP 증거 누락:");
  out = out.replace(/No artifact satisfies WP\s+(\S+)\s+(.+)/i, "WP $1 $2를 만족하는 산출물 없음");
  out = out.replace(/No explicit WP ID\s+(\S+)\s+tagging;\s*matched on name\./i, "명시적 WP ID $1 태깅 없음. 이름으로 매칭됨.");
  out = out.replace(/Some base practices below ['"]Largely['"] threshold/i, "일부 BP가 'Largely' 기준 미만");
  out = out.replace(/no keywords derivable from BP spec/i, "BP 명세에서 키워드 추출 불가");
  out = out.replace(/^rejected:\s*/i, "거부됨: ");
  out = out.replace(/rule threw:/i, "규칙 평가 실패:");
  out = out.replace(/llm threw:/i, "LLM 평가 실패:");
  return out;
}

function summarizeProjectFingerprint(fp) {
  if (!fp || !Array.isArray(fp.dominant) || fp.dominant.length === 0) return "";
  const top = fp.dominant.slice(0, 6).join(", ");
  const off = (fp.perArtifact ?? [])
    .filter((p) => p.contextMatch != null && p.contextMatch < 0.3)
    .map((p) => p.name);
  if (off.length) {
    return ` · 프로젝트 식별자: ${top} · 컨텍스트 이탈 의심 파일: ${off.join(", ")}`;
  }
  return ` · 프로젝트 식별자: ${top}`;
}

// Compress a noisy gap line into a short improvement point. Strips engine tags,
// keeps only the first sentence, drops trailing 합니다/부족/필요 verbs, and caps
// at ~60 chars so each item reads as a scannable improvement bullet.
function condenseGap(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/^\[(규칙|LLM)\]\s*/i, "");
  const firstSentence = s.split(/\.\s+/)[0];
  if (firstSentence) s = firstSentence;
  s = s.replace(/(에 대한 추가적?인? 설명이 필요합니다|이 (부족|필요)합니다|합니다)\.?$/u, "");
  s = s.replace(/\.+$/u, "").trim();
  // 예전에는 60자에서 잘라 약점 설명이 문장 중간에서 끊겼다(예: "…관련 이해관…"). 전체 서술은 findings 에 그대로 있다.
  if (s.length > 220) s = s.slice(0, 218) + "…";
  return s;
}

// Rating basis shown in front of every summary line.
const BASIS_PREFIX = "기준: PAM 4.1 · Guidelines 2026 · ";

function buildWeaknessText(f) {
  if (!f) return "";
  return [f.situation, f.gap].map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).join(" ");
}

/** Convert ProcessVerdict → legacy UI shape {ratings, summary, strengths, gaps}. */
export function toLegacyShape(v, skipped = []) {
  const ratings = (v.bps || []).map((b) => {
    const gaps = (b.gaps || []).map(koreanizeGap).map(condenseGap).filter(Boolean);
    // 약점(weakness) Finding 은 점수와 무관하게 요약에 나타나야 한다.
    const weaknessNotes = (b.findings || []).filter((f) => f?.type === "weakness").map((f) => condenseGap(buildWeaknessText(f))).filter(Boolean);
    const notes = [...weaknessNotes, ...gaps];
    const rationale = notes.length
      ? `Finding — ${notes.slice(0, 3).join(" / ")}`
      : "특이 Finding 없음";
    return {
      bp: b.id,
      rating: b.rating,
      rationale,
      evidence: (b.evidence || []).slice(0, 6).map((e) => {
        // displayArtifactName strips template/scaffolding folders (e.g.
        // "2026년 템플릿/…") from the shown name; the raw name was already used
        // for page annotation upstream, so this is display-only.
        const base = e.location || displayArtifactName(e.artifactName) || "";
        const loc = e.page != null
          ? (base ? `${base} · p.${e.page}` : `p.${e.page}`)
          : base;
        return { quote: e.quote || "", location: loc };
      }),
      pamCitation: b.pamCitation,
      contextConsistency: b.contextConsistency,
      // P4: surface the structured findings + standardReferences so the
      // VerdictCard can render conclusion-statement cards instead of the
      // collapsed legacy rationale. When findings is empty the UI falls
      // back to the rationale + evidence path above.
      findings: Array.isArray(b.findings) ? b.findings : [],
      standardReferences: b.standardReferences ?? { pam: [], pamNote: [], bgbRL: [], iso: [], incose: [] },
      references: b.references,
      appliedRules: b.appliedRules ?? [],
    };
  });
  const hasType = (b, t) => (b.findings || []).some((f) => f?.type === t);
  const anyFindings = (v.bps || []).some((b) => (b.findings || []).length > 0);
  // 강점: 강점 Finding 이 있고 약점 Finding 이 없는 BP. 점수 ≥68% 라는 이유만으로 자동 포함하지 않는다.
  // (Finding 을 전혀 내지 않는 스코어러의 레거시 결과만 점수 기준으로 폴백)
  const strong = (v.bps || []).filter((b) => (anyFindings ? hasType(b, "strength") && !hasType(b, "weakness") : b.scorePercent >= 68));
  // Finding 요약: 점수<51% 이거나 약점 Finding 이 있는 BP
  const weak = (v.bps || []).filter((b) => b.scorePercent < 51 || hasType(b, "weakness"));
  const reviewNeeded = (v.bps || []).filter((b) => !weak.includes(b) && (b.gaps || []).length > 0);
  const skipNote = skipped.length
    ? ` · 스킵된 파일 ${skipped.length}개: ${skipped.map((s) => s.name).join(", ")}`
    : "";
  const fpNote = summarizeProjectFingerprint(v.projectFingerprint);
  const summary = `${BASIS_PREFIX}CL${v.capabilityLevel} — ${v.capabilityLevelReason ?? ""} (제출 문서 기준 적절성 검토. 실제 수행에 따른 PA/CL 달성은 수행 증거 없이 확정하지 않음)${skipNote}${fpNote}`;
  return {
    ratings,
    summary,
    strengths:
      strong
        .map((b) => `${b.id} ${bpTitleKo(v.processId, b.id, b.title)}`)
        .join(", ") || "강점으로 식별된 BP 없음",
    gaps:
      weak
        .map((b) => `${b.id}: ${condenseGap(koreanizeGap(buildWeaknessText((b.findings || []).find((f) => f?.type === "weakness")) || b.gaps?.[0])) || "부족"}`)
        .join("; ") ||
      (reviewNeeded.length
        ? `확정된 약점 없음 · 검토 필요 관찰 ${reviewNeeded.length}건(${reviewNeeded.map((b) => b.id).join(", ")})`
        : "특이 Finding 없음"),
    projectFingerprint: v.projectFingerprint,
  };
}
