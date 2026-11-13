// Shared harness orchestration used by both /api/analyze (per-process) and
// /api/project (multi-file, cross-process). Keeps response shapes stable
// between Vercel serverless functions and the Vite dev middleware.
//
// Helpers split into focused modules to keep this file scoped to "wire harness
// + scope artifacts per process":
//   _textExtractor.js   — PDF/DOCX/text extraction with page tracking
//   _artifactBuilder.js — payload → harness-ready artifact[]
//   _evidencePages.js   — annotate BP evidence with source-page numbers
//   _legacyAdapter.js   — ProcessVerdict → legacy UI shape + Koreanization

import { Harness, loadProcess, loadProcesses, loadWorkProducts, loadGuideline } from "aspice-harness";
import { ruleScorer, createLlmScorer, createHybridScorer, createCustomScorer, applyAppliedRules } from "aspice-harness/evaluators";
import { createLlmClient } from "aspice-harness/llm";
import { indexArtifacts, scopeArtifactsForProcess } from "aspice-harness/io";
import { loadProcessGraph } from "aspice-harness/spec";
import {
  buildProcessGraph,
  checkTraceability,
  checkConsistency,
  computeCoverage,
  analyzeChangePropagation,
} from "aspice-harness/crossProcess";

import { buildArtifacts } from "./_artifactBuilder.js";
import { annotateEvidenceWithPages } from "./_evidencePages.js";
import { toLegacyShape } from "./_legacyAdapter.js";
import { resolveLlmConfig, limitConcurrency } from "./_llmConfig.js";

// Recognised scorer engines. Anything unknown normalises to "hybrid" so the
// two modes (per-process / project) cannot diverge on scorer choice.
//   rule   — offline auto-keyword/WPID matching
//   llm    — LLM BP/WP/GP scoring (provider/model from _llmConfig.js)
//   hybrid — 0.4 rule + 0.6 llm (default)
//   custom — offline, user-authored rule book (see customScorer.js)
const KNOWN_ENGINES = new Set(["rule", "llm", "hybrid", "custom"]);

/**
 * Coerce the request body's engine selection into an ordered, deduped list of
 * known engines. Accepts either the new `engines: [...]` shape or the legacy
 * `engine: "..."` string. Always returns at least one engine.
 */
function resolveEngines(engines, engineLegacy) {
  const raw = Array.isArray(engines)
    ? engines
    : engineLegacy
      ? [engineLegacy]
      : [];
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (KNOWN_ENGINES.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length ? out : ["hybrid"];
}

// In-process cache of generateJson results, keyed by the full prompt content.
// Sampling is best-effort (no temperature is sent to Anthropic), so the same prompt can
// produce slightly different scores across calls — which surfaces as the same
// document earning different BP grades in process mode vs project mode. The
// cache pins one verdict per prompt so the two modes converge on identical
// scores for identical evidence within a server lifetime.
const llmResponseCache = new Map();

function memoizeLlmClient(client) {
  return {
    ...client,
    async generateJson(prompt) {
      const key = JSON.stringify([prompt.system, prompt.context, prompt.task]);
      if (llmResponseCache.has(key)) {
        return llmResponseCache.get(key);
      }
      const result = await client.generateJson(prompt);
      llmResponseCache.set(key, result);
      return result;
    },
  };
}

/** Build a single scorer for one engine id. */
function buildSingleScorer(engine, env, customRules) {
  if (engine === "rule") return ruleScorer;
  // Custom is offline: it scores against the user's rule book and falls back
  // to the auto-keyword rule scorer for practices no rule covers.
  if (engine === "custom") {
    return createCustomScorer({ ruleBook: customRules, fallback: ruleScorer });
  }
  const cfg = resolveLlmConfig(env);
  if (!cfg) {
    throw new Error(`engine=${engine} requires ANTHROPIC_API_KEY or OPENAI_API_KEY in server env.`);
  }
  const { provider, apiKey, model, concurrency } = cfg;
  const rawClient = limitConcurrency(createLlmClient({ provider, apiKey, model }), concurrency);
  const client = memoizeLlmClient(rawClient);
  const llm = createLlmScorer({ client });
  if (engine === "llm") return llm;
  if (engine === "hybrid") return createHybridScorer({ rule: ruleScorer, llm });
  throw new Error(`Unknown engine: ${engine}`);
}

const CONTEXT_PRIORITY = { "off-context": 3, partial: 2, consistent: 1, unknown: 0 };

/** Pick the most decisive contextConsistency status across multiple scorer outputs. */
function mergeContextConsistency(results) {
  let best = { status: "unknown", note: "" };
  let bestPrio = -1;
  for (const r of results) {
    const c = r?.contextConsistency || { status: "unknown", note: "" };
    const p = CONTEXT_PRIORITY[c.status] ?? 0;
    if (p > bestPrio) {
      bestPrio = p;
      best = c;
    }
  }
  return best;
}

/**
 * Wrap several scorers as one: each method runs every underlying scorer in
 * parallel and the result's `scorePercent` is the simple average. Evidence and
 * gaps from every scorer are concatenated with an `[engine]` prefix so the
 * report still shows what each engine saw. Used when the user picks more than
 * one engine in the UI.
 */
let _guidelineRulesById;
function guidelineRulesById() {
  if (!_guidelineRulesById) _guidelineRulesById = new Map((loadGuideline().rules ?? []).map((r) => [r.id, r]));
  return _guidelineRulesById;
}

// Union of every engine's appliedRules, deduped by ruleId (an applied=true entry wins).
function unionAppliedRules(results) {
  const byId = new Map();
  for (const r of results) {
    for (const e of r.appliedRules ?? []) {
      if (!e?.ruleId) continue;
      const prev = byId.get(e.ruleId);
      if (!prev || (prev.applied === false && e.applied !== false)) byId.set(e.ruleId, { ...e });
    }
  }
  return [...byId.values()];
}

function buildAveragingScorer(scorers) {
  const merge = (method) => async (ctx) => {
    const settled = await Promise.allSettled(scorers.map(({ scorer }) => scorer[method](ctx)));
    const oks = [];
    const evidence = [];
    const gaps = [];
    for (let i = 0; i < settled.length; i++) {
      const tag = scorers[i].id;
      const s = settled[i];
      if (s.status === "fulfilled" && s.value) {
        oks.push(s.value);
        for (const e of s.value.evidence ?? []) {
          evidence.push({ ...e, location: `[${tag}] ${e.location ?? ""}`.trim() });
        }
        for (const g of s.value.gaps ?? []) gaps.push(`[${tag}] ${g}`);
      } else {
        gaps.push(`[${tag}] failed: ${s.reason?.message ?? "unknown"}`);
      }
    }
    const scorePercent = oks.length
      ? Math.round(oks.reduce((a, b) => a + (b.scorePercent || 0), 0) / oks.length)
      : 0;
    const result = {
      scorePercent,
      evidence,
      gaps,
      pamCitation: oks.find((r) => r.pamCitation)?.pamCitation,
      contextConsistency: mergeContextConsistency(oks),
      appliedRules: unionAppliedRules(oks),
    };
    // Re-apply guideline caps so averaging cannot lift a score above an applied cap.
    applyAppliedRules(result, guidelineRulesById());
    const references = oks.find((r) => r.references)?.references;
    if (references) result.references = references;
    return result;
  };
  return { scoreBP: merge("scoreBP"), scoreWP: merge("scoreWP"), scoreGP: merge("scoreGP") };
}

function buildScorer(engines, env, customRules) {
  if (engines.length === 1) return buildSingleScorer(engines[0], env, customRules);
  const built = engines.map((id) => ({ id, scorer: buildSingleScorer(id, env, customRules) }));
  return buildAveragingScorer(built);
}

// Common per-process evaluation. Both /api/analyze (one process) and
// /api/project (many processes) drive the harness through this helper. Artifact
// scoping (scopeArtifactsForProcess) keeps, for each process, only the artifacts
// that belong to it (its own deliverables) or are of a document type
// appropriate to its area. The document-type restriction below applies at CL1
// only (targetLevel === 1); above CL1 every type is admissible evidence and
// only owner-based routing applies. CL1 area scope:
//   SUP            → 계획서 / 활동보고서 / 심사결과서
//   MAN.3          → 계획서 / 타당성 보고서
//   SYS·SWE·HWE·MLE 개발      → 명세서 / 설계서 / 분석보고서
//   SYS·SWE·HWE·MLE 검증·테스트 → 검증·테스트 계획서 / 결과서
// A deliverable owned by another process — e.g. the MAN.3 feasibility report —
// is never inherited as evidence elsewhere.
//
// `strict` refuses to fall back to another process's deliverable when a process
// has no own artifact (only ownerless files may serve as a last resort). Both
// modes now run strict so the same artifact is scoped — and therefore graded —
// identically in single-process and project runs. A file belonging to a
// different process than the one selected is dropped rather than scored.
//
// `extraBPs` is an optional list of user-defined Base Practices that the
// harness will merge into the process spec's BP list (see Harness#evaluateProcess).
async function evaluateOneProcess(harness, processSpec, indexedArtifacts, extraBPs = [], strict = false, mode = "process") {
  // The per-area document-type restriction is a CL1 rule only. Above CL1 every
  // document type is admissible evidence; only owner-based routing still applies.
  const docTypeScope = Number(harness?.targetLevel) === 1;
  const scoped = scopeArtifactsForProcess(processSpec, indexedArtifacts, { strict, docTypeScope });
  return harness.evaluateProcess({
    processId: processSpec.id,
    artifacts: scoped,
    extraBPs,
    // `mode` no longer changes BP scoring: process (/api/analyze) and project
    // (/api/project) grade the same artifact identically. Kept for call-site
    // stability and possible future narrative-only use. See buildBpPrompt.
    mode,
  });
}

/**
 * Pluck the user's custom BP definitions that apply to one process and
 * normalise them into the shape the harness BP evaluator expects. Custom BPs
 * carry an embedded `_customRule` so the CustomScorer scores them against the
 * user's keywords without the user having to add a separate matching rule.
 */
function customBPsForProcess(customRules, processId) {
  const list = Array.isArray(customRules?.customBPs) ? customRules.customBPs : [];
  return list
    .filter((b) => b && (b.processId === processId || b.processId === "*"))
    .map((b, idx) => {
      const keywords = (Array.isArray(b.keywords) ? b.keywords : [])
        .map((k) => String(k).trim())
        .filter(Boolean)
        .slice(0, 40);
      if (!keywords.length) return null;
      const weight = Number(b.weight);
      return {
        id: String(b.id || `${processId}.BP_custom_${idx + 1}`).slice(0, 60),
        title: String(b.title || "사용자 정의 BP").slice(0, 120),
        intent: String(b.intent || "").slice(0, 400),
        pamCitation: "사용자 정의",
        _custom: true,
        _customRule: {
          keywords,
          match: b.match === "all" ? "all" : "any",
          weight: Number.isFinite(weight) ? Math.max(0.1, Math.min(5, weight)) : 1,
        },
      };
    })
    .filter(Boolean);
}

function rejectIfNoArtifacts(arts, skipped) {
  if (arts.length) return;
  const detail = skipped.length
    ? `Every uploaded file failed to parse: ${skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}`
    : "No artifacts were provided.";
  throw new Error(detail);
}

/**
 * Per-process evaluation. Request body:
 *   { processId, artifact: {name, text|base64, mimeType}, targetLevel, engine }
 *   OR legacy: { processId, artifacts: [...], targetLevel, engine }
 * Response: legacy-shape adapter + harness ProcessVerdict.
 */
export async function handleEvaluate({ processId, artifact, artifacts, targetLevel = 1, engine, engines, customRules }, env) {
  const inputs = artifacts ?? (artifact ? [artifact] : []);
  const { artifacts: arts, skipped } = await buildArtifacts(inputs);
  rejectIfNoArtifacts(arts, skipped);

  const processSpec = loadProcess(processId);
  if (!processSpec) throw new Error(`Unknown process: ${processId}`);

  const resolved = resolveEngines(engines, engine);
  const scorer = buildScorer(resolved, env, customRules);
  const harness = new Harness({ scorer, targetLevel: Number(targetLevel) });

  // Index once up-front so the per-process filter sees wpidCandidates.
  const indexed = indexArtifacts(arts, { wpCatalog: loadWorkProducts() });
  const extraBPs = resolved.includes("custom") ? customBPsForProcess(customRules, processSpec.id) : [];
  // strict: scope to this process's own (or ownerless) deliverables, matching
  // project mode (/api/project) so a file grades the same in both modes.
  const verdict = await evaluateOneProcess(harness, processSpec, indexed, extraBPs, true);
  verdict.meta = {
    ...(verdict.meta || {}),
    skippedArtifacts: skipped,
    engines: resolved,
    engine: resolved[0],
  };
  annotateEvidenceWithPages(verdict, indexed);
  return { legacy: toLegacyShape(verdict, skipped), verdict };
}

/**
 * Multi-process / project evaluation. Request body:
 *   { processIds, artifacts: [...], targetLevel, engine }
 */
export async function handleProject({ processIds, artifacts, targetLevel = 1, engine, engines, customRules }, env) {
  const { artifacts: arts, skipped } = await buildArtifacts(artifacts || []);
  rejectIfNoArtifacts(arts, skipped);

  const resolved = resolveEngines(engines, engine);
  const scorer = buildScorer(resolved, env, customRules);
  const harness = new Harness({ scorer, targetLevel: Number(targetLevel) });

  const all = loadProcesses();
  const inScope = processIds?.length ? all.filter((p) => processIds.includes(p.id)) : all;

  const indexed = indexArtifacts(arts, { wpCatalog: loadWorkProducts() });
  const customActive = resolved.includes("custom");

  // Evaluate each process against only its own deliverables (strict scoping):
  // a process with no artifact of its own is not back-filled with another
  // process's documents, so e.g. the MAN.3 plan no longer leaks into SUP/SWE
  // findings. Cross-process checks below still see the full artifact set.
  const processVerdicts = await Promise.all(
    inScope.map((proc) =>
      evaluateOneProcess(
        harness,
        proc,
        indexed,
        customActive ? customBPsForProcess(customRules, proc.id) : [],
        true, // strict: a process is judged on its own deliverables, not inherited ones
        "project" // project mode: terser cross-referenced Finding narratives
      )
    )
  );

  // Cross-process checks still see the FULL artifact set — they need the
  // global view to detect missing traces / inconsistent IDs / coverage gaps.
  const seed = loadProcessGraph();
  const graph = buildProcessGraph(inScope, { seedEdges: seed.edges });
  const procById = new Map(inScope.map((p) => [p.id, p]));
  // The traceability matrix is scoped to the development area only — system /
  // software / hardware / ML engineering. Management (MAN), support (SUP),
  // acquisition (ACQ), supply (SPL), validation (VAL) and reuse (REU) edges
  // are excluded from the matrix. Mirrors Harness#evaluateProject.
  const DEV_AREA_CATEGORIES = new Set(["SYS", "SWE", "HWE", "MLE"]);
  const traceMatrices = [];
  for (const edge of graph.edges) {
    const tgt = procById.get(edge.to);
    const src = procById.get(edge.from);
    if (!tgt || !src) continue;
    if (
      !DEV_AREA_CATEGORIES.has(src.category) ||
      !DEV_AREA_CATEGORIES.has(tgt.category)
    ) {
      continue;
    }
    const targetWps = (tgt.outputWorkProducts ?? []).map((w) => w.id);
    if (!targetWps.length) continue;
    for (const via of edge.via) {
      const matrix = checkTraceability(indexed, {
        sourceProcess: edge.from,
        targetProcess: edge.to,
        sourceWp: via,
        targetWps,
      });
      // Skip a via-edge with no source IDs: there is nothing to trace *from*,
      // so coverage is undefined (—) and every target ID would be reported as a
      // spurious "도착 누락" (target orphan). Drops e.g. SYS.2 → SWE.1 via 17-54
      // "Requirement Attribute" when no attribute document carries trace IDs.
      // (A zero-source edge subsumes the both-sides-empty case.)
      if (matrix.sourceIds.length === 0) continue;
      traceMatrices.push(matrix);
    }
  }
  const consistency = checkConsistency(indexed);
  const coverage = computeCoverage(indexed);
  const changes = analyzeChangePropagation(indexed, { graph });

  const verdict = {
    processes: processVerdicts,
    crossProcess: { graph, traceMatrices, consistency, coverage, changes },
    meta: {
      targetLevel: Number(targetLevel),
      artifactCount: indexed.length,
      graphSource: graph.source,
      skippedArtifacts: skipped,
      engines: resolved,
      engine: resolved[0],
    },
  };
  annotateEvidenceWithPages(verdict, indexed);
  return { verdict };
}
