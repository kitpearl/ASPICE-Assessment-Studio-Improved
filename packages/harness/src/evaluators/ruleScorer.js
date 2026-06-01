import { extractKeywords } from "../io/excerpt.js";
import { classifyContextMatch } from "../io/projectContext.js";
import { displayArtifactName } from "../io/artifactRouting.js";
import { buildRuleObservationFinding } from "./findingBuilders.js";

const EMPTY_REFS = { pam: [], pamNote: [], bgbRL: [], iso: [] };
const RULE_ID_BP = "RULE-KEYWORD-OVERLAP";
const RULE_ID_WP = "RULE-WPID-OR-NAME";
const RULE_ID_GP_DERIVED = "RULE-GP-DERIVED-FROM-BP";
const RULE_ID_GP_HEURISTIC = "RULE-KEYWORD-OVERLAP";

function refsFromPamCitation(pamCitation) {
  return pamCitation ? { pam: [pamCitation], pamNote: [], bgbRL: [], iso: [] } : { ...EMPTY_REFS };
}

/**
 * RuleScorer — offline, deterministic scorer.
 *
 * scoreBP: overlap between BP keywords and artifact text/filenames.
 * scoreWP: whether any artifact is tagged with the expected WPID, or the
 *          WP name appears in filenames/body.
 * scoreGP: keyword overlap on GP title + PA scope; for PA 1.1 the score is
 *          derived from prior BP results (since GP 1.1.1 is "achieve the
 *          intent of the base practices").
 *
 * Project-context: when a `projectFingerprint` is supplied, each artifact's
 * context-match score (0..1, or null = unknown) acts as a per-artifact weight
 * on the keyword hit it provides. A match coming only from off-context
 * artifacts cannot earn full credit; it also feeds the categorical
 * `contextConsistency` field returned alongside the score.
 *
 * This scorer never fabricates evidence and always produces JSON-safe output.
 * @type {import("./scorer.js").Scorer}
 */
export const ruleScorer = {
  async scoreBP({ process, bp, artifacts, projectFingerprint }) {
    const bpFullId = `${process.id}.${bp.id}`;
    const pamCitation = bp.pamCitation ?? process.pamSection;
    const kws = extractKeywords(`${bp.title} ${bp.description ?? ""}`, 10);
    if (!kws.length) {
      return emptyBp({
        bpFullId,
        pamCitation,
        reason: "no keywords derivable from BP spec",
      });
    }
    const matchIndex = buildMatchIndex(artifacts, projectFingerprint);
    const { weighted, total, evidence, missing, perArtifactHits } = matchKeywords(kws, artifacts, matchIndex);
    const scorePercent = scoreFromWeighted(weighted, total);
    const gaps = missing.length
      ? [`No evidence found for keywords: ${missing.slice(0, 6).join(", ")}`]
      : [];
    const contextConsistency = aggregateContext(matchIndex, perArtifactHits);
    const ctxContributing = [...perArtifactHits.keys()];
    if (contextConsistency.status === "off-context") {
      gaps.push(offContextGap(namesWithStatus(matchIndex, ctxContributing, "off-context")));
    } else if (contextConsistency.status === "partial") {
      gaps.push(partialContextGap(namesWithStatus(matchIndex, ctxContributing, "partial", "off-context")));
    }
    const matchedCount = total - missing.length;
    const ratio = total > 0 ? Math.round((matchedCount / total) * 100) : 0;
    const matchedKws = kws.filter((k) => !missing.includes(k));
    const foundArtifacts = Array.from(
      new Set(evidence.map((e) => displayArtifactName(e?.artifactName)).filter(Boolean))
    );
    const matchedHint = matchedKws.length
      ? ` 확인된 핵심 개념: ${matchedKws.slice(0, 6).join(", ")}${matchedKws.length > 6 ? " 등" : ""}.`
      : "";
    const artifactHint = foundArtifacts.length
      ? ` 근거 산출물: ${foundArtifacts.slice(0, 4).join(", ")}${foundArtifacts.length > 4 ? " 등" : ""}.`
      : "";
    const missingHint = missing.length
      ? ` 아직 산출물 본문·메타데이터에서 단어로 확인되지 않은 개념: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " 등" : ""}.`
      : "";
    const finding = buildRuleObservationFinding({
      bpFullId,
      ruleId: RULE_ID_BP,
      situation:
        `자동 키워드 점검(규칙 기반): 이 BP가 요구하는 핵심 개념 ${total}개 중 ${matchedCount}개(${ratio}%)가 산출물에서 확인되었습니다.` +
        matchedHint +
        artifactHint +
        missingHint +
        ` 점수(${scorePercent}%)는 키워드 부재를 곧 요구사항 미충족으로 보지 않는 정성적 보정 곡선(일치 개념에 기본 신뢰점수 부여 + 누락 개념 완만 감점)으로 산출되었습니다.` +
        ` 단어 일치는 개념의 표현 여부만 확인할 뿐 의미적 충족까지 보장하지 않으므로, 확인된 개념의 실질 충족 여부와 위 미확인 개념의 의미적 반영 여부는 시니어 평가자의 정성 검토가 필요합니다.`,
      evidence,
      pamCitation,
      scoreReason: `계산하라: 핵심 개념 ${matchedCount}/${total} 확인 → 정성적 보정 점수 ${scorePercent}% (일치 개념 기본 신뢰 + 누락 완만 감점)`,
    });
    return {
      scorePercent,
      evidence,
      gaps,
      contextConsistency,
      standardReferences: refsFromPamCitation(pamCitation),
      findings: [finding],
    };
  },

  async scoreWP({ process, wp, artifacts, projectFingerprint }) {
    const bpFullId = `${process.id}.${wp.id}`;
    const pamCitation = process.pamSection ? `PAM §${process.pamSection}` : undefined;
    const refs = refsFromPamCitation(pamCitation);
    const matchIndex = buildMatchIndex(artifacts, projectFingerprint);
    const wpidHit = artifacts.find((a) => a.wpidCandidates?.includes(wp.id));
    if (wpidHit) {
      const ctx = artifactContext(matchIndex, wpidHit);
      const base = 90;
      const score = applyContextPenalty(base, ctx.score);
      const gaps = [];
      if (ctx.status === "off-context") gaps.push(offContextGap([wpidHit.name], "WP 태깅 산출물"));
      else if (ctx.status === "partial") gaps.push(partialContextGap([wpidHit.name], "WP 태깅 산출물"));
      const evidence = [
        {
          artifactName: wpidHit.name,
          quote: `Artifact tagged as WP ${wp.id} ${wp.name}`,
          location: "wpidCandidates",
        },
      ];
      return {
        scorePercent: score,
        evidence,
        gaps,
        contextConsistency: { status: ctx.status, note: ctx.note },
        standardReferences: refs,
        findings: [
          buildRuleObservationFinding({
            bpFullId,
            ruleId: RULE_ID_WP,
            situation: `자동 키워드 점검(규칙 기반): 산출물 "${wpidHit.name}" 이 WP ${wp.id} (${wp.name}) 식별자로 태깅되어 확인되었습니다. 의미적 충족 여부는 시니어 평가자의 추가 검토가 필요합니다.`,
            evidence,
            pamCitation,
            scoreReason: `계산하라: WPID 직접 태깅 → 기저 점수 ${base}, 컨텍스트 보정 후 ${score}%`,
          }),
        ],
      };
    }
    // Fallback: name/alias match in filename or body
    const needle = wp.name.toLowerCase();
    const nameHit = artifacts.find((a) =>
      (a.name + " " + (a.text ?? "")).toLowerCase().includes(needle)
    );
    if (nameHit) {
      const ctx = artifactContext(matchIndex, nameHit);
      const base = 60;
      const score = applyContextPenalty(base, ctx.score);
      const gaps = [`No explicit WP ID ${wp.id} tagging; matched on name.`];
      if (ctx.status === "off-context") gaps.push(offContextGap([nameHit.name]));
      else if (ctx.status === "partial") gaps.push(partialContextGap([nameHit.name]));
      const evidence = [
        {
          artifactName: nameHit.name,
          quote: snippet(nameHit.text ?? nameHit.name, needle, 400),
        },
      ];
      return {
        scorePercent: score,
        evidence,
        gaps,
        contextConsistency: { status: ctx.status, note: ctx.note },
        standardReferences: refs,
        findings: [
          buildRuleObservationFinding({
            bpFullId,
            ruleId: RULE_ID_WP,
            situation: `자동 키워드 점검(규칙 기반): WP ${wp.id} 식별자 태깅은 부재하나 "${nameHit.name}" 산출물명/본문에서 WP 명칭 일치가 확인되었습니다. 의미적 충족 여부는 시니어 평가자의 추가 검토가 필요합니다.`,
            evidence,
            pamCitation,
            scoreReason: `계산하라: 이름 매칭 → 기저 점수 ${base}, 컨텍스트 보정 후 ${score}%`,
          }),
        ],
      };
    }
    return {
      scorePercent: 0,
      evidence: [],
      gaps: [`No artifact satisfies WP ${wp.id} ${wp.name}`],
      contextConsistency: { status: "unknown", note: "" },
      standardReferences: refs,
      findings: [
        buildRuleObservationFinding({
          bpFullId,
          ruleId: RULE_ID_WP,
          situation: `자동 키워드 점검(규칙 기반): WP ${wp.id} ${wp.name} 에 대한 식별자 태깅·이름 일치가 어떤 산출물에서도 확인되지 않았습니다. 의미적 충족 여부는 시니어 평가자의 추가 검토가 필요합니다.`,
          evidence: [],
          pamCitation,
          scoreReason: `계산하라: 매칭 부재 → 0%`,
        }),
      ],
    };
  },

  async scoreGP({ process, paSpec, gp, bpResults, artifacts, projectFingerprint }) {
    const bpFullId = `${process.id}.${gp.id}`;
    const pamCitation = `PAM §5 ${gp.id}`;
    const refs = refsFromPamCitation(pamCitation);
    // PA 1.1: GP 1.1.1 depends entirely on BP achievement.
    if (paSpec.id === "PA 1.1") {
      const list = bpResults ?? [];
      const bpAvg =
        list.reduce((s, r) => s + (r.scorePercent ?? 0), 0) /
        Math.max(list.length, 1);
      const scorePercent = Math.round(bpAvg);
      const lowCount = list.filter((r) => r.scorePercent < 51).length;
      const gaps = lowCount > 0 ? ["Some base practices below 'Largely' threshold"] : [];
      return {
        scorePercent,
        evidence: [],
        gaps,
        // PA 1.1 inherits the worst BP-level context concern so it surfaces
        // at the PA roll-up too.
        contextConsistency: rollupBpContext(bpResults),
        standardReferences: refs,
        findings: [
          buildRuleObservationFinding({
            bpFullId,
            ruleId: RULE_ID_GP_DERIVED,
            situation: `자동 키워드 점검(규칙 기반): GP 1.1.1 (Achieve the intent of the base practices) 는 BP 결과로부터 파생됩니다. 전체 ${list.length} 개 BP 중 ${lowCount} 개가 'Largely' 임계 (51%) 미만으로 확인되었습니다. 의미적 충족 여부는 시니어 평가자의 추가 검토가 필요합니다.`,
            evidence: [],
            pamCitation,
            scoreReason: `계산하라: BP scorePercent 평균 → ${scorePercent}%`,
          }),
        ],
      };
    }
    // CL2/CL3 GPs — heuristic keyword overlap
    const kws = extractKeywords(`${gp.title} ${gp.description ?? ""} ${paSpec.scope ?? ""}`, 8);
    const matchIndex = buildMatchIndex(artifacts, projectFingerprint);
    const { weighted, total, evidence, missing, perArtifactHits } = matchKeywords(kws, artifacts, matchIndex);
    const scorePercent = scoreFromWeighted(weighted, total || 1);
    const gaps = missing.length ? [`GP evidence missing: ${missing.slice(0, 5).join(", ")}`] : [];
    const contextConsistency = aggregateContext(matchIndex, perArtifactHits);
    const gpCtxContributing = [...perArtifactHits.keys()];
    if (contextConsistency.status === "off-context") gaps.push(offContextGap(namesWithStatus(matchIndex, gpCtxContributing, "off-context")));
    else if (contextConsistency.status === "partial") gaps.push(partialContextGap(namesWithStatus(matchIndex, gpCtxContributing, "partial", "off-context")));
    const matchedCount = (total || 0) - missing.length;
    const ratio = total > 0 ? Math.round((matchedCount / total) * 100) : 0;
    const gpMatchedKws = kws.filter((k) => !missing.includes(k));
    const gpFoundArtifacts = Array.from(
      new Set(evidence.map((e) => displayArtifactName(e?.artifactName)).filter(Boolean))
    );
    const gpMatchedHint = gpMatchedKws.length
      ? ` 확인된 핵심 개념: ${gpMatchedKws.slice(0, 6).join(", ")}${gpMatchedKws.length > 6 ? " 등" : ""}.`
      : "";
    const gpArtifactHint = gpFoundArtifacts.length
      ? ` 근거 산출물: ${gpFoundArtifacts.slice(0, 4).join(", ")}${gpFoundArtifacts.length > 4 ? " 등" : ""}.`
      : "";
    const gpMissingHint = missing.length
      ? ` 아직 산출물 본문·메타데이터에서 단어로 확인되지 않은 개념: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " 등" : ""}.`
      : "";
    return {
      scorePercent,
      evidence,
      gaps,
      contextConsistency,
      standardReferences: refs,
      findings: [
        buildRuleObservationFinding({
          bpFullId,
          ruleId: RULE_ID_GP_HEURISTIC,
          situation:
            `자동 키워드 점검(규칙 기반): 이 GP가 요구하는 핵심 개념 ${total || 0}개 중 ${matchedCount}개(${ratio}%)가 산출물에서 확인되었습니다.` +
            gpMatchedHint +
            gpArtifactHint +
            gpMissingHint +
            ` 점수(${scorePercent}%)는 키워드 부재를 곧 미충족으로 보지 않는 정성적 보정 곡선으로 산출되었으며, 단어 일치는 표현 여부만 확인할 뿐 의미적 충족까지 보장하지 않으므로 시니어 평가자의 정성 검토가 필요합니다.`,
          evidence,
          pamCitation,
          scoreReason: `계산하라: 핵심 개념 ${matchedCount}/${total || 0} 확인 → 정성적 보정 점수 ${scorePercent}% (일치 개념 기본 신뢰 + 누락 완만 감점)`,
        }),
      ],
    };
  },
};

// ── project-context helpers ──────────────────────────────────────────────

// Build a `name → {score, status}` map from the precomputed fingerprint so
// match-time lookups are O(1). When no fingerprint is supplied (e.g. unit
// tests, single-artifact runs), every artifact reads as "unknown" and the
// score behaves identically to the pre-upgrade rule scorer.
function buildMatchIndex(artifacts, fingerprint) {
  const map = new Map();
  const perArtifact = fingerprint?.perArtifact ?? [];
  const byName = new Map(perArtifact.map((p) => [p.name, p]));
  for (const a of artifacts ?? []) {
    const entry = byName.get(a.name);
    const score = entry?.contextMatch ?? null;
    map.set(a.name, { score, status: classifyContextMatch(score) });
  }
  return map;
}

function artifactContext(matchIndex, artifact) {
  const e = matchIndex.get(artifact.name) ?? { score: null, status: "unknown" };
  return { score: e.score, status: e.status, note: noteFor(e.status) };
}

function noteFor(status) {
  switch (status) {
    case "off-context": return "산출물이 배치의 주요 제품/프로젝트 식별자와 일치하지 않음";
    case "partial": return "산출물이 배치 식별자 일부만 공유함";
    case "consistent": return "산출물이 배치의 주요 식별자와 일치함";
    default: return "";
  }
}

// ── concrete context-mismatch finding text ────────────────────────────────
//
// The categorical status alone ("partial" / "off-context") reads as a generic
// flag. These builders turn it into an actionable observation by (a) naming the
// specific artifact(s) that triggered it and (b) spelling out, with examples,
// what "다른 컨텍스트" concretely looks like so a senior assessor knows what to
// go check.
const CTX_EXAMPLE =
  "다른 프로젝트·제품 템플릿의 식별자·참조(예: 이전 프로젝트명·ECU명)가 정리되지 않고 남아 있거나, " +
  "in-scope/out-of-scope 경계가 산출물마다 다르게 가정된 경우일 수 있습니다";

function namesHint(names) {
  if (!names.length) return "";
  const shown = names.slice(0, 3).map((n) => `'${displayArtifactName(n)}'`).join(", ");
  return ` (예: ${shown}${names.length > 3 ? " 등" : ""})`;
}

// names with the given context status, drawn from the artifacts that actually
// contributed evidence (so we never name an unrelated artifact).
function namesWithStatus(matchIndex, names, ...wanted) {
  return names.filter((n) => wanted.includes(matchIndex.get(n)?.status ?? "unknown"));
}

// `subject` lets callers tailor the noun ("매칭 산출물" vs "WP 태깅 산출물").
function offContextGap(names, subject = "매칭된 산출물") {
  return (
    `프로젝트 컨텍스트 불일치: ${subject}${namesHint(names)}이 이 프로젝트가 아닌 다른 제품/프로젝트의 것으로 보입니다. ` +
    `${CTX_EXAMPLE}. 해당 산출물이 본 프로젝트의 범위를 정의·충족하는지 시니어 평가자의 확인이 필요합니다.`
  );
}

function partialContextGap(names, subject = "일부 매칭 산출물") {
  return (
    `프로젝트 컨텍스트 부분 일치: ${subject}${namesHint(names)}이 이 프로젝트와 다른 컨텍스트로 보입니다. ` +
    `${CTX_EXAMPLE}. 해당 산출물이 본 프로젝트의 범위를 정의·충족하는지 시니어 평가자의 확인이 필요합니다.`
  );
}

// Per-keyword weighted scoring with a *qualitative-generosity* curve.
//
// Rationale (요청: "현재 평가가 너무 타이트해 점수를 여유있게 부여"): keyword
// absence is NOT the same as requirement non-conformance — a concept can be
// satisfied semantically without the exact surface word appearing. So once at
// least one concept is confirmed, the matched concepts earn a baseline of trust
// (50) and the remaining gap is penalised softly via a concave curve
// (ratio^0.6) rather than linearly. Effect: raw 70% → ~90, raw 50% → ~78,
// raw 30% → ~66. A complete miss (weighted ≤ 0) still scores 0 so genuinely
// unevidenced BPs are not inflated.
const GENEROSITY_BASE = 50;
const GENEROSITY_EXPONENT = 0.6;
function scoreFromWeighted(weighted, total) {
  if (!total || weighted <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, weighted / total));
  const score = GENEROSITY_BASE + (100 - GENEROSITY_BASE) * Math.pow(ratio, GENEROSITY_EXPONENT);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function applyContextPenalty(score, contextMatch) {
  if (contextMatch == null) return score;
  // Linear floor at 0.5 for off-context, 1.0 for fully consistent.
  const factor = 0.5 + 0.5 * Math.max(0, Math.min(1, contextMatch));
  return Math.round(score * factor);
}

function aggregateContext(matchIndex, perArtifactHits) {
  // Look only at artifacts that actually contributed evidence.
  const contributing = [...perArtifactHits.keys()];
  if (!contributing.length) return { status: "unknown", note: "" };
  const statuses = contributing.map((n) => matchIndex.get(n)?.status ?? "unknown");
  if (statuses.every((s) => s === "off-context")) {
    return { status: "off-context", note: noteFor("off-context") };
  }
  if (statuses.some((s) => s === "off-context") || statuses.some((s) => s === "partial")) {
    return { status: "partial", note: noteFor("partial") };
  }
  if (statuses.every((s) => s === "consistent")) {
    return { status: "consistent", note: noteFor("consistent") };
  }
  return { status: "unknown", note: "" };
}

function rollupBpContext(bpResults) {
  const order = { "off-context": 3, partial: 2, consistent: 1, unknown: 0 };
  let worst = { status: "unknown", note: "" };
  for (const r of bpResults ?? []) {
    const cc = r.contextConsistency ?? { status: "unknown", note: "" };
    if ((order[cc.status] ?? 0) > (order[worst.status] ?? 0)) worst = cc;
  }
  return worst;
}

// ── matchers ─────────────────────────────────────────────────────────────

function matchKeywords(keywords, artifacts, matchIndex) {
  const evidence = [];
  const missing = [];
  const perArtifactHits = new Map();
  let weighted = 0;
  for (const kw of keywords) {
    let matched = false;
    for (const a of artifacts) {
      const hay = (a.name + " " + (a.text ?? "")).toLowerCase();
      const idx = hay.indexOf(kw);
      if (idx >= 0) {
        const ctx = matchIndex.get(a.name) ?? { score: null };
        // Unknown context (null) => weight 1.0 to preserve legacy behaviour
        // when no fingerprint is available.
        const w = ctx.score == null ? 1.0 : Math.max(0, Math.min(1, ctx.score));
        weighted += w;
        evidence.push({
          artifactName: a.name,
          quote: snippet(a.text ?? "", kw, 400) || kw,
        });
        perArtifactHits.set(a.name, (perArtifactHits.get(a.name) ?? 0) + 1);
        matched = true;
        break;
      }
    }
    if (!matched) missing.push(kw);
  }
  return { weighted, total: keywords.length, evidence, missing, perArtifactHits };
}

function snippet(text, needle, radius = 400) {
  if (!text || !needle) return "";
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return "";
  // Find a clean window: extend the raw [i-radius, i+needle+radius] outward to
  // the nearest sentence/paragraph boundary so the snippet doesn't begin or
  // end mid-word. Falls back to the raw window if no boundary is found within
  // a reasonable extension budget.
  const rawStart = Math.max(0, i - radius);
  const rawEnd = Math.min(text.length, i + needle.length + radius);
  const start = expandBackToBoundary(text, rawStart, Math.max(0, rawStart - 200));
  const end = expandForwardToBoundary(text, rawEnd, Math.min(text.length, rawEnd + 200));
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

// A "real" sentence terminator: . ! ? (incl. CJK fullwidth) or newline.
// Decimal points like "0.5" are excluded by requiring whitespace / end-of-text
// AFTER the terminator (so "0.5" does not split, "끝났다. " does).
const SENTENCE_TERMINATOR = /[.!?。！？]/;

function isSentenceEndAt(text, p) {
  const ch = text[p];
  if (ch === "\n") return true;
  if (!SENTENCE_TERMINATOR.test(ch)) return false;
  const next = text[p + 1];
  return next === undefined || /\s/.test(next);
}

function expandBackToBoundary(text, from, floor) {
  for (let p = from; p > floor; p--) {
    if (isSentenceEndAt(text, p - 1)) return p;
  }
  // No boundary in budget — at least don't start mid-word.
  for (let p = from; p > floor; p--) {
    if (/\s/.test(text[p - 1])) return p;
  }
  return from;
}

function expandForwardToBoundary(text, from, ceil) {
  for (let p = from; p < ceil; p++) {
    if (isSentenceEndAt(text, p)) return p + 1;
  }
  for (let p = from; p < ceil; p++) {
    if (/\s/.test(text[p])) return p;
  }
  return from;
}


function emptyBp({ bpFullId, pamCitation, reason }) {
  return {
    scorePercent: 0,
    evidence: [],
    gaps: [reason],
    contextConsistency: { status: "unknown", note: "" },
    standardReferences: refsFromPamCitation(pamCitation),
    findings: [
      buildRuleObservationFinding({
        bpFullId,
        ruleId: RULE_ID_BP,
        situation: `자동 키워드 점검(규칙 기반): BP 명세에서 키워드를 도출하지 못해 자동 점검을 적용할 수 없습니다 (${reason}). 시니어 평가자의 직접 평가가 필요합니다.`,
        evidence: [],
        pamCitation,
        scoreReason: `계산하라: 키워드 도출 실패 → 0%`,
      }),
    ],
  };
}
