// Parser for the VDA Automotive SPICE Guidelines 2026 (Korean markdown, with
// the English markdown as an optional companion for rule text).
// Pure: text in, drafts out.
//
// parseGuideline2026(koText, enText) → { version, rules, notes }

const VERSION = "Automotive SPICE Guidelines 3rd Edition 2026-07";
const NOTE_MAX = 1200;

// The brief's `[A-Za-z]+(?:\.\d+)?` cannot match "PA3.2"; `\.?\d*` covers
// "SWE.1", "PA3.2", "PA.3.2" and topic tags like "GEN".
const RULE_RE = /^\[([A-Za-z]+\.?\d*(?:\.\d+)?)\.(RL|RC)\.(\d+)\]\s*(.+)$/;
const HEADING_RE = /^#{1,6}\s+(.*)$/;
const NUM_HEADING_RE = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/;
const PAGE_RE = /^<!--\s*PDF page \d+(?:\s*\(printed p\.(\d+)\))?.*-->$/;
const RATING_RULES_LABEL_RE = /^\*\*등급 평가 규칙:?\*\*:?\s*$/;

const TOPIC_SECTIONS = [
  ["2.3.4", "TAC"],
  ["2.3.5", "COM"],
  ["2.5.1", "MBD"],
  ["2.5.2", "AGE"],
  ["2.5.3", "DEX"],
  ["2.5.4", "APA"],
  ["1.4.2", "GEN"],
];

/** "PA.3.2" → "PA3.2"; other prefixes unchanged. */
function normalizePrefix(prefix) {
  return prefix.replace(/^PA\.(\d)/, "PA$1");
}

function scopeOf(prefix) {
  if (/^[A-Z]{3}\.\d+$/.test(prefix)) return { kind: "process", id: prefix };
  const pa = /^PA(\d)\.(\d)$/.exec(prefix);
  if (pa) return { kind: "pa", id: `PA ${pa[1]}.${pa[2]}` };
  return { kind: "topic", id: prefix };
}

const INDICATOR_RE =
  /([A-Z]{3}\.\d+)\.BP(\d+)|(?<![.\w])BP ?(\d+)|GP ?(\d\.\d\.\d)|지표 (\d\.\d\.\d)|(?<!\w)PA ?(\d\.\d)(?![.\d])/g; // "SPL.2.PA1.1" (SPL.2.RL.3) → PA 1.1

/** All indicators in order of appearance, de-duplicated. */
function findIndicators(text, scope) {
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(INDICATOR_RE)) {
    let t = null;
    if (m[1]) t = { kind: "bp", process: m[1], id: `BP${m[2]}` };
    else if (m[3]) {
      if (scope.kind !== "process") continue;
      t = { kind: "bp", process: scope.id, id: `BP${m[3]}` };
    } else if (m[4]) t = { kind: "gp", id: `GP ${m[4]}` };
    else if (m[5]) t = { kind: "gp", id: `GP ${m[5]}` };
    else if (m[6]) t = { kind: "pa", id: `PA ${m[6]}` };
    const key = JSON.stringify(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function effectOf(part) {
  if (/N으로 등급 평가해야/.test(part)) return { effect: { kind: "cap", maxRating: "N" } };
  if (/P보다 높게/.test(part)) return { effect: { kind: "cap", maxRating: "P" } };
  if (/L보다 높게/.test(part)) return { effect: { kind: "cap", maxRating: "L" } };
  if (/F로 등급 평가해서는 안/.test(part)) return { effect: { kind: "cap", maxRating: "L" } };
  if (/그보다 높게/.test(part)) return { effect: { kind: "cap-source" } };
  // DEX.RL.7: "…하향 평가해서는 안 되지만 …"
  if (/하향 평가해서는 안 (?:된다|되지만)/.test(part)) return { effect: { kind: "must-not-downrate" } };
  if (/하향 평가해야 한다/.test(part)) return { effect: { kind: "must-downrate" } };
  // SYS.2.RL.5: "…로 등급 평가해야 한다" — rating value lost in the OCR source.
  if (/…\s*로 등급 평가해야/.test(part)) return { effect: { kind: "cap", maxRating: "N" }, inferred: true };
  return { effect: { kind: "other" } };
}

function conditionOf(part, scope) {
  if (part == null) return { kind: "evidence" };
  const rated = /([NP])(?: 또는 ([NP]))?으?로 등급 평가된다면/.exec(part);
  // "하향 평가되면" (SUP.8.RL.6) is a shorter variant of "하향 평가된다면".
  const downrated = /하향 평가(?:된다|되)면/.test(part);
  if (!rated && !downrated) return { kind: "evidence" };
  const source = findIndicators(part, scope)[0];
  if (!source) return { kind: "evidence" };
  const cond = { kind: "rating", source, when: ["N", "P"] };
  if (!rated) cond.reasonQualified = true;
  if (scope.kind === "process" && source.kind === "bp" && source.process !== scope.id) cond.crossProcess = true;
  return cond;
}

// Clause endings of the condition part. The last one followed by ", " marks the
// split; a plain last-comma split would cut target lists like "BP4, BP5, BP6".
const CLAUSE_END_RE = /(?:다면|더라도|경우|되면)\)?,\s/g;

/** Split a Korean rule sentence into { condPart, effPart }. */
function splitRule(text) {
  let cut = -1;
  for (const m of text.matchAll(CLAUSE_END_RE)) cut = m.index + m[0].length;
  if (cut >= 0) return { condPart: text.slice(0, cut).replace(/,\s$/, ""), effPart: text.slice(cut) };
  const comma = text.lastIndexOf(", ");
  return comma >= 0
    ? { condPart: text.slice(0, comma), effPart: text.slice(comma + 2) }
    : { condPart: null, effPart: text };
}

const BULLET_RE = /^(?:[-*•°]|·)\s/;
const isStop = (t) => !t || HEADING_RE.test(t) || PAGE_RE.test(t) || RULE_RE.test(t);

/**
 * Lines that continue the rule on line `i` (text `first`): wrapped text when
 * the sentence does not end with "." and, with `bullets` (KO only — the EN
 * file has OCR junk bullets after some rules), bullet lists after it. Single blank
 * lines are bridged; stops at a tag line, heading, page marker or a blank line
 * followed by another blank/stop line. Returns { text, last } (last consumed index).
 */
function continueRule(lines, i, first, { bullets = false } = {}) {
  let text = first;
  let last = i;
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t) {
      if (isStop((lines[j + 1] ?? "").trim())) break;
      continue;
    }
    if (isStop(t)) break;
    if (/\.$/.test(text) && !(bullets && BULLET_RE.test(t))) break;
    text += " " + t;
    last = j;
  }
  return { text: text.replace(/\s+/g, " ").trim(), last };
}

/** Map of normalized rule id → body text from the English file. */
function englishRuleMap(enText) {
  const map = new Map();
  if (!enText) return map;
  const lines = String(enText).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = RULE_RE.exec(lines[i].trim());
    if (!m) continue;
    const id = `${normalizePrefix(m[1])}.RL.${m[3]}`;
    const { text, last } = continueRule(lines, i, m[4].trim());
    if (!map.has(id)) map.set(id, text);
    i = last;
  }
  return map;
}

/** Owner of a numbered section: { kind, id } or null. */
function ownerOf(num, headings) {
  for (const [prefix, code] of TOPIC_SECTIONS) {
    if (num === prefix || num.startsWith(prefix + ".")) return { kind: "topic", id: code };
  }
  const top = /^([345])\.(\d+)/.exec(num);
  if (!top) return null;
  const text = headings.get(`${top[1]}.${top[2]}`) || "";
  if (top[1] === "3") {
    const p = /^([A-Z]{3}\.\d+)\s/.exec(text);
    return p ? { kind: "process", id: p[1] } : null;
  }
  const pa = /^(PA \d\.\d)\s/.exec(text);
  return pa ? { kind: "pa", id: pa[1] } : null;
}

export function parseGuideline2026(koText, enText) {
  const lines = String(koText).split(/\r?\n/);
  const enMap = englishRuleMap(enText);
  const rules = [];
  const notes = { process: {}, pa: {}, topic: {} };

  // Latest numbered heading text per number ("3.8" → "SWE.1 소프트웨어 요구사항 분석").
  const headings = new Map();
  let current = null; // { num, heading, page, body: [] }
  let page = 0;
  let inFrontMatter = false;

  const flush = () => {
    if (!current) return;
    const owner = ownerOf(current.num, headings);
    const text = current.body.join(" ").replace(/\s+/g, " ").trim();
    if (owner && text) {
      const bucket = (notes[owner.kind][owner.id] ||= []);
      bucket.push({ heading: current.heading, text: text.slice(0, NOTE_MAX), page: current.page });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i === 0 && line === "---") { inFrontMatter = true; continue; }
    if (inFrontMatter) { if (line === "---") inFrontMatter = false; continue; }
    if (!line) continue;

    const pm = PAGE_RE.exec(line);
    if (pm) { if (pm[1]) page = Number(pm[1]); continue; }

    const hm = HEADING_RE.exec(line);
    if (hm) {
      const nm = NUM_HEADING_RE.exec(hm[1].trim());
      if (nm) {
        flush();
        const num = nm[1];
        const heading = `${num} ${nm[2].trim()}`;
        for (const k of [...headings.keys()]) if (k.startsWith(num + ".")) headings.delete(k);
        headings.set(num, nm[2].trim());
        current = { num, heading, page, body: [] };
      }
      // Unnumbered headings (part titles etc.) are neither sections nor note text.
      continue;
    }

    const rm = RULE_RE.exec(line);
    if (rm) {
      const prefix = normalizePrefix(rm[1]);
      const id = `${prefix}.RL.${rm[3]}`;
      const scope = scopeOf(prefix);
      // Condition/effect come from the tag line itself; continuation lines
      // (e.g. MAN.3.RL.5 bullets) only extend the stored text.
      const { condPart, effPart } = splitRule(rm[4].trim());
      const cont = continueRule(lines, i, rm[4].trim(), { bullets: true });
      const text = cont.text;
      i = cont.last;
      const { effect, inferred } = effectOf(effPart);
      const sectionNum = current ? current.num : "";
      const rule = {
        id,
        scope,
        targets: findIndicators(effPart, scope),
        effect,
        condition: conditionOf(condPart, scope),
        text,
        textEn: enMap.get(id) ?? null,
        section: current ? current.heading : "",
        page,
        citation: `Guideline 2026 §${sectionNum} [${id}]`,
      };
      if (inferred) rule.inferred = true;
      rules.push(rule);
      continue;
    }

    if (RATING_RULES_LABEL_RE.test(line)) continue;
    if (current) current.body.push(line);
  }
  flush();

  return { version: VERSION, rules, notes };
}
