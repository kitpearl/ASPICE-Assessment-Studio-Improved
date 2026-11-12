// PAM 4.1 본문 + 가이드라인 2026 규칙·노트 조회 계층 (Node 전용, canonical JSON 로더 사용)
import {
  loadGuideline,
  loadProcess,
  loadProcessAttributes,
  loadWorkProducts,
} from "../../spec/canonical/index.js";
import {
  MAX_RULES,
  selectRulesForBp,
  selectRulesForGp,
  selectRulesForProcess,
  conditionalTopicOf,
  toReference,
  effectString,
  truncate,
} from "./select.js";

export { MAX_RULES };
export const MAX_NOTES = 4;
export const NOTE_CHARS = 1200;
export const WP_CHARS = 1500;

// ---- 규칙 색인 (모듈 단위 지연 캐시) ----
let _index;
function ruleIndex() {
  if (_index) return _index;
  const { rules = [] } = loadGuideline();
  const order = new Map();
  const byTarget = new Map();
  const byScope = new Map();
  const push = (map, key, rule) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(rule);
  };
  rules.forEach((r, i) => {
    order.set(r, i);
    push(byScope, `${r.scope?.kind}:${r.scope?.id}`, r);
    for (const t of r.targets ?? []) {
      const key = t.kind === "bp" ? `bp:${t.process}:${t.id}` : `${t.kind}:${t.id}`;
      push(byTarget, key, r);
    }
  });
  _index = { rules, order, byTarget, byScope };
  return _index;
}

// 여러 후보 목록을 중복 없이 합치고 파일 순서로 정렬
function candidates(...lists) {
  const { order } = ruleIndex();
  const set = new Set(lists.flatMap((l) => l ?? []));
  return [...set].sort((a, b) => order.get(a) - order.get(b));
}

function clipNote(n) {
  return { heading: n.heading, text: truncate(n.text, NOTE_CHARS), page: n.page };
}

// 기본 노트(프로세스/PA) 앞 MAX_NOTES건 + 예산이 남으면 선택된 규칙의 topic 노트 첫 1건씩
function selectNotes(baseNotes, rules) {
  const { notes = {} } = loadGuideline();
  const out = (baseNotes ?? []).slice(0, MAX_NOTES).map(clipNote);
  const topics = [];
  for (const r of rules) {
    if (r.scope?.kind === "topic" && !topics.includes(r.scope.id)) topics.push(r.scope.id);
  }
  for (const t of topics) {
    if (out.length >= MAX_NOTES) break;
    const first = notes.topic?.[t]?.[0];
    if (first) out.push(clipNote(first));
  }
  return out;
}

function guidelineReferences(rules) {
  return rules.map((r) => toReference(r, { conditional: conditionalTopicOf(r) }));
}

// ---- 조회 ----
export function getBpKnowledge(processId, bpId) {
  const process = loadProcess(processId);
  if (!process) return null;
  const bp = (process.basePractices ?? []).find((b) => b.id === bpId);
  if (!bp) return null;
  const { byTarget, byScope } = ruleIndex();
  const pool = candidates(
    byTarget.get(`bp:${processId}:${bpId}`),
    byScope.get("topic:TAC"),
    byScope.get("topic:COM"),
  );
  const rules = selectRulesForBp(pool, process, bp);
  const { notes = {} } = loadGuideline();
  return {
    process: {
      id: process.id,
      name: process.name,
      nameEn: process.nameEn,
      purpose: process.purpose,
      outcomes: process.outcomes ?? [],
    },
    bp: {
      id: bp.id,
      title: bp.title,
      titleEn: bp.titleEn,
      description: bp.description,
      notes: bp.notes ?? [],
    },
    outputWorkProducts: process.outputWorkProducts ?? [],
    guideline: { rules, notes: selectNotes(notes.process?.[processId], rules) },
    references: {
      pam: { citation: bp.pamCitation, page: bp.page, title: bp.title },
      guideline: guidelineReferences(rules),
    },
  };
}

export function getGpKnowledge(paId, gpId, processId = null) {
  const pa = loadProcessAttributes()[paId];
  if (!pa) return null;
  const gp = (pa.genericPractices ?? []).find((g) => g.id === gpId);
  if (!gp) return null;
  const { byTarget, byScope } = ruleIndex();
  const pool = candidates(
    byTarget.get(`gp:${gpId}`),
    byTarget.get(`pa:${paId}`),
    byScope.get(`pa:${paId}`),
    paId === "PA 1.1" ? byScope.get("topic:GEN") : [],
  );
  const rules = selectRulesForGp(pool, paId, gpId, processId);
  const { notes = {} } = loadGuideline();
  return {
    pa: { id: pa.id, name: pa.name, scope: pa.scope, achievements: pa.achievements ?? [] },
    gp: {
      id: gp.id,
      title: gp.title,
      titleEn: gp.titleEn,
      description: gp.description,
      notes: gp.notes ?? [],
    },
    guideline: { rules, notes: selectNotes(notes.pa?.[paId], rules) },
    references: {
      pam: { citation: gp.pamCitation, page: gp.page, title: gp.title },
      guideline: guidelineReferences(rules),
    },
  };
}

export function getWpKnowledge(processId, wpId) {
  if (!loadProcess(processId)) return null;
  const wp = loadWorkProducts()[wpId];
  if (!wp) return null;
  return {
    wp: { id: wp.id, name: wp.name, nameEn: wp.nameEn, characteristics: wp.characteristics ?? {} },
    references: {
      pam: { citation: `PAM 4.1 Annex B ${wp.id}`, page: wp.page, title: wp.name },
      guideline: [],
    },
  };
}

export function getProcessKnowledge(processId) {
  const process = loadProcess(processId);
  if (!process) return null;
  const { rules = [], notes = {} } = loadGuideline();
  const { byScope } = ruleIndex();
  const own = selectRulesForProcess(byScope.get(`process:${processId}`) ?? rules, processId);
  return {
    process,
    guideline: {
      rules: own,
      notes: (notes.process?.[processId] ?? []).slice(0, MAX_NOTES).map(clipNote),
    },
  };
}

// ---- 프롬프트 서식 ----
const EFFECT_KO = {
  "cap:N": "N 상한",
  "cap:P": "P 상한",
  "cap:L": "L 상한",
  "cap-source": "출처 등급 상한",
  "must-downrate": "하향 필수",
  "must-not-downrate": "하향 금지",
  other: "참고",
};

export function formatRulesForPrompt(rules) {
  return (rules ?? [])
    .map((r) => {
      let line = `- [${r.id}] (${EFFECT_KO[effectString(r.effect)]}) ${r.text}`;
      const cond = conditionalTopicOf(r);
      if (cond) line += ` (조건부: ${cond})`;
      if (r.condition?.crossProcess) line += " (타 프로세스 등급 조건, 표시용)";
      return line;
    })
    .join("\n");
}

export function formatNotesForPrompt(notes) {
  return (notes ?? []).map((n) => `### ${n.heading} (p.${n.page})\n${n.text}`).join("\n\n");
}

export function formatWpCharacteristics(wp) {
  if (!wp) return "";
  const c = wp.characteristics ?? {};
  const lines = [`${wp.id} ${wp.name}${wp.nameEn ? ` (${wp.nameEn})` : ""}`];
  if (c.summary) lines.push(`요약: ${c.summary}`);
  if (c.identifies?.length) lines.push(`식별: ${c.identifies.join("; ")}`);
  if (c.includes?.length) lines.push(`포함: ${c.includes.join("; ")}`);
  if (c.examples?.length) lines.push(`예: ${c.examples.join("; ")}`);
  const text = lines.join("\n");
  return text.length > WP_CHARS ? text.slice(0, WP_CHARS - 1) + "…" : text;
}
