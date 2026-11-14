import { extractBilingualKeywords, bpKeywordSources, gpKeywordSources } from "../io/keywords.js";
import { classifyContextMatch } from "../io/projectContext.js";
import { displayArtifactName } from "../io/artifactRouting.js";
import { buildRuleObservationFinding } from "./findingBuilders.js";
import { termVariants } from "../assessment/semantics.js";
import { getBpKnowledge, getGpKnowledge, getWpKnowledge } from "../knowledge/index.js";

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
const ruleScorerCore = {
  async scoreBP({ process = {}, bp, artifacts, projectFingerprint }) {
    const bpFullId = `${process.id}.${bp.id}`;
    const pamCitation = bp.pamCitation ?? process.pamSection;
    const kwSets = extractBilingualKeywords(bpKeywordSources(bp), 10);
    if (!kwSets.ko.length && !kwSets.en.length) {
      return emptyBp({
        bpFullId,
        pamCitation,
        reason: "no keywords derivable from BP spec",
      });
    }
    const matchIndex = buildMatchIndex(artifacts, projectFingerprint);
    const { kws, total, ratio, evidence, missing, perArtifactHits } = matchBilingual(kwSets, artifacts, matchIndex);
    const scorePercent = scoreFromWeighted(ratio, 1);
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
    const matchedKws = kws.filter((k) => !missing.includes(k));
    const foundArtifacts = Array.from(
      new Set(evidence.map((e) => displayArtifactName(e?.artifactName)).filter(Boolean))
    );
    // Lead with what the artifact substantively appears to cover, then spell out
    // the *content* that the BP requires but is not yet evidenced — framed as a
    // gap to investigate, not a keyword tally. The mechanical "n/m 개념(%)" and
    // score-curve explanation are intentionally dropped: they read as a
    // word-matching report, whereas a consultant needs "무엇이 부족한가".
    const coveredHint = matchedKws.length
      ? `산출물에서 ${matchedKws.slice(0, 6).join(", ")}${matchedKws.length > 6 ? " 등" : ""}에 관한 내용은 확인되었습니다.`
      : `산출물에서 이 BP가 요구하는 내용이 뚜렷하게 확인되지 않았습니다.`;
    const artifactHint = foundArtifacts.length
      ? ` 근거 산출물: ${foundArtifacts.slice(0, 4).join(", ")}${foundArtifacts.length > 4 ? " 등" : ""}.`
      : "";
    const gapHint = missing.length
      ? ` 반면 ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " 등" : ""}에 해당하는 요구 내용은 본문·근거에서 충분히 다루어지지 않은 것으로 보여, 해당 측면이 실제로 기술·근거화되었는지와 보강이 필요한지에 대한 점검이 필요합니다.`
      : ` 이 BP가 요구하는 핵심 내용은 대체로 확인되었습니다.`;
    const finding = buildRuleObservationFinding({
      bpFullId,
      ruleId: RULE_ID_BP,
      situation:
        `내용 충실도 1차 검토(규칙 기반): ${coveredHint}${artifactHint}${gapHint}` +
        ` 자동 1차 검토는 내용의 표면적 포함 여부만 확인하므로, 위 내용이 요구사항을 실질적으로 충족하는지와 부족한 부분의 보완 방향은 시니어 평가자의 정성 검토가 필요합니다.`,
      evidence,
      pamCitation,
      scoreReason: `확인결과: 요구 내용 ${matchedCount}/${total} 항목 확인, 점수 ${scorePercent}% (자동 1차 검토 · 시니어 정성 검토 필요) · 증거 후보 검색 점수(${scoreFormula(matchedCount, total)})이며 충족도·등급이 아님`,
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

  async scoreWP({ process = {}, wp, artifacts, projectFingerprint }) {
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
            situation: `산출물 충실도 1차 검토(규칙 기반): 산출물 "${wpidHit.name}" 이 WP ${wp.id} (${wp.name}) 으로 식별되어 해당 작업산출물이 존재함이 확인되었습니다. 다만 이 산출물이 ${wp.name} 으로서 요구되는 내용·구성요소를 실질적으로 충족하는지는 시니어 평가자의 정성 검토가 필요합니다.`,
            evidence,
            pamCitation,
            scoreReason: `확인결과: WPID 직접 태깅 → 기저 점수 ${base}, 컨텍스트 보정 후 ${score}%`,
          }),
        ],
      };
    }
    // Fallback: name/alias match in filename or body
    const primary = wp.nameEn ?? wp.name;
    const needles = [
      ...(wp.aliases ?? []),
      primary,
      wp.name && wp.name !== primary && wp.name.length >= 5 ? wp.name : null,
    ].filter(Boolean).map((n) => n.toLowerCase());
    let needle = needles[0];
    let nameHit;
    for (const n of needles) {
      nameHit = artifacts.find((a) => (a.name + " " + (a.text ?? "")).toLowerCase().includes(n));
      if (nameHit) { needle = n; break; }
    }
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
            situation: `산출물 충실도 1차 검토(규칙 기반): WP ${wp.id} 식별자 태깅은 부재하나 "${nameHit.name}" 의 산출물명·본문에서 ${wp.name} 에 해당하는 내용이 확인되었습니다. 식별자 태깅이 없어 해당 작업산출물로 공식 관리·추적되는지 불명확하므로, 이 산출물의 ${wp.name} 요구 내용 충족 여부와 함께 시니어 평가자의 정성 검토가 필요합니다.`,
            evidence,
            pamCitation,
            scoreReason: `확인결과: 이름 매칭 → 기저 점수 ${base}, 컨텍스트 보정 후 ${score}%`,
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
          situation: `산출물 충실도 1차 검토(규칙 기반): WP ${wp.id} ${wp.name} 에 해당하는 작업산출물이 어떤 산출물에서도 식별되지 않았습니다. 해당 작업산출물의 부재 또는 다른 명칭으로의 산재 가능성이 있으므로, 실제 존재 여부와 내용 충족 여부에 대한 시니어 평가자의 확인이 필요합니다.`,
          evidence: [],
          pamCitation,
          scoreReason: `확인결과: 매칭 부재 → 0%`,
        }),
      ],
    };
  },

  async scoreGP({ process = {}, paSpec, gp, bpResults, artifacts, projectFingerprint }) {
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
            situation: `내용 충실도 1차 검토(규칙 기반): GP 1.1.1 (기본 프랙티스 의도 달성) 의 달성도는 개별 BP 결과로부터 파생됩니다. 전체 ${list.length} 개 BP 중 ${lowCount} 개가 'Largely'(51%) 임계 미만으로, 해당 BP들이 요구 내용을 충분히 충족하지 못한 것으로 보입니다. 이들 BP의 실질 충족 여부와 보강 방향은 시니어 평가자의 정성 검토가 필요합니다.`,
            evidence: [],
            pamCitation,
            scoreReason: `확인결과: BP scorePercent 평균 → ${scorePercent}%`,
          }),
        ],
      };
    }
    // CL2/CL3 GPs — heuristic keyword overlap
    const kwSets = extractBilingualKeywords(gpKeywordSources(gp, paSpec), 8);
    const matchIndex = buildMatchIndex(artifacts, projectFingerprint);
    const { kws, total, ratio, evidence, missing, perArtifactHits } = matchBilingual(kwSets, artifacts, matchIndex);
    const scorePercent = scoreFromWeighted(ratio, 1);
    const gaps = missing.length ? [`GP evidence missing: ${missing.slice(0, 5).join(", ")}`] : [];
    const contextConsistency = aggregateContext(matchIndex, perArtifactHits);
    const gpCtxContributing = [...perArtifactHits.keys()];
    if (contextConsistency.status === "off-context") gaps.push(offContextGap(namesWithStatus(matchIndex, gpCtxContributing, "off-context")));
    else if (contextConsistency.status === "partial") gaps.push(partialContextGap(namesWithStatus(matchIndex, gpCtxContributing, "partial", "off-context")));
    const matchedCount = (total || 0) - missing.length;
    const gpMatchedKws = kws.filter((k) => !missing.includes(k));
    const gpFoundArtifacts = Array.from(
      new Set(evidence.map((e) => displayArtifactName(e?.artifactName)).filter(Boolean))
    );
    const gpCoveredHint = gpMatchedKws.length
      ? `산출물에서 ${gpMatchedKws.slice(0, 6).join(", ")}${gpMatchedKws.length > 6 ? " 등" : ""}에 관한 내용은 확인되었습니다.`
      : `산출물에서 이 GP가 요구하는 내용이 뚜렷하게 확인되지 않았습니다.`;
    const gpArtifactHint = gpFoundArtifacts.length
      ? ` 근거 산출물: ${gpFoundArtifacts.slice(0, 4).join(", ")}${gpFoundArtifacts.length > 4 ? " 등" : ""}.`
      : "";
    const gpGapHint = missing.length
      ? ` 반면 ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " 등" : ""}에 해당하는 요구 내용은 본문·근거에서 충분히 다루어지지 않은 것으로 보여, 해당 측면이 실제로 기술·근거화되었는지와 보강이 필요한지에 대한 점검이 필요합니다.`
      : ` 이 GP가 요구하는 핵심 내용은 대체로 확인되었습니다.`;
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
            `내용 충실도 1차 검토(규칙 기반): ${gpCoveredHint}${gpArtifactHint}${gpGapHint}` +
            ` 자동 1차 검토는 내용의 표면적 포함 여부만 확인하므로, 위 내용이 요구사항을 실질적으로 충족하는지와 부족한 부분의 보완 방향은 시니어 평가자의 정성 검토가 필요합니다.`,
          evidence,
          pamCitation,
          scoreReason: `확인결과: 요구 내용 ${matchedCount}/${total || 0} 항목 확인, 점수 ${scorePercent}% (자동 1차 검토 · 시니어 정성 검토 필요)`,
        }),
      ],
    };
  },
};

export const ruleScorer = {
  async scoreBP(args) {
    const r = await ruleScorerCore.scoreBP(args);
    return withKnowledge(r, safeKnowledge(`bp ${args.process?.id}.${args.bp?.id}`, () => getBpKnowledge(args.process?.id, args.bp?.id)));
  },

  async scoreWP(args) {
    const r = await ruleScorerCore.scoreWP(args);
    return withKnowledge(r, safeKnowledge(`wp ${args.process?.id}.${args.wp?.id}`, () => getWpKnowledge(args.process?.id, args.wp?.id)));
  },

  async scoreGP(args) {
    const r = await ruleScorerCore.scoreGP(args);
    return withKnowledge(r, safeKnowledge(`gp ${args.process?.id}/${args.gp?.id}`, () => getGpKnowledge(args.paSpec?.id, args.gp?.id, args.process?.id)));
  },
};

// ── knowledge (references + hints) ───────────────────────────────────────

const HINT_SCORE_THRESHOLD = 51;
const MAX_HINTS = 2;
const HINT_CHARS = 80;

function safeKnowledge(what, fn) {
  try {
    return fn() ?? null;
  } catch (err) {
    console.warn(`[aspice/rule] knowledge lookup failed for ${what}: ${err?.message ?? err} (falling back to no references)`);
    return null;
  }
}

// references 를 싣고, 낮은 점수면 must-not-downrate 규칙을 확인 포인트로 gaps 에 덧붙인다.
// 점수는 바꾸지 않는다. 규칙 순서는 knowledge 선택 순서(프로세스/PA scope 먼저)를 따른다.
function withKnowledge(result, knowledge) {
  if (!knowledge) return result;
  const out = { ...result };
  if (knowledge.references) out.references = knowledge.references;
  if (out.scorePercent < HINT_SCORE_THRESHOLD) {
    const hints = (knowledge.guideline?.rules ?? [])
      .filter((r) => r.effect?.kind === "must-not-downrate")
      .slice(0, MAX_HINTS)
      .map((r) => `확인 포인트 [${r.id}]: ${clip(r.text, HINT_CHARS)}`);
    if (hints.length) out.gaps = [...(out.gaps ?? []), ...hints];
  }
  return out;
}

function clip(text, max) {
  const s = String(text ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

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

/** 점수 산식 설명: 50 + 50×(확인비율)^0.6 (컨텍스트 가중 전). 점수는 후보 탐색 순위이며 N/P/L/F 달성도가 아니다. */
function scoreFormula(matched, total) {
  if (!total) return "산식 없음";
  return `50+50×(${matched}/${total})^${GENEROSITY_EXPONENT}`;
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
      // 동의어(개시자≈제안자, 종료≈종결, 의사소통≈통보·알림 등)도 같은 개념으로 본다. 증거 후보 탐색용이다.
      const hitTerm = termVariants(kw).find((v) => hay.indexOf(v) >= 0);
      if (hitTerm !== undefined) {
        const ctx = matchIndex.get(a.name) ?? { score: null };
        // Unknown context (null) => weight 1.0 to preserve legacy behaviour
        // when no fingerprint is available.
        const w = ctx.score == null ? 1.0 : Math.max(0, Math.min(1, ctx.score));
        weighted += w;
        evidence.push({
          artifactName: a.name,
          quote: snippet(a.text ?? "", hitTerm, 400) || hitTerm,
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

// Match each language's keyword set separately and keep the one with the
// larger weighted hit ratio. An empty set is ignored; both empty => ratio 0.
function matchBilingual(kwSets, artifacts, matchIndex) {
  let best = { kws: [], total: 0, ratio: 0, evidence: [], missing: [], perArtifactHits: new Map() };
  let first = true;
  for (const kws of [kwSets.en, kwSets.ko]) {
    if (!kws.length) continue;
    const m = matchKeywords(kws, artifacts, matchIndex);
    const ratio = m.total ? m.weighted / m.total : 0;
    if (first || ratio > best.ratio) {
      best = { kws, total: m.total, ratio, evidence: m.evidence, missing: m.missing, perArtifactHits: m.perArtifactHits };
      first = false;
    }
  }
  return best;
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
        situation: `내용 충실도 1차 검토(규칙 기반): BP 명세에서 평가 기준이 될 핵심 내용을 도출하지 못해 자동 1차 검토를 적용할 수 없습니다 (${reason}). 시니어 평가자의 직접 평가가 필요합니다.`,
        evidence: [],
        pamCitation,
        scoreReason: `확인결과: 키워드 도출 실패 → 0%`,
      }),
    ],
  };
}
