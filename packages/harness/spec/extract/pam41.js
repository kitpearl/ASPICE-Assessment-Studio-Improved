// Parser for the Korean Automotive SPICE PAM 4.1 text (pdf-parse output in
// spec/sources/AutomotiveSPICE_PAM_41_ko.txt). Pure: text in, drafts out.
//
// parsePam41(text) → { processes, processAttributes, informationItems }

import { isPageMarker, joinWrapped, pageAt, stripNoise } from "./textUtil.js";

const TOC_RE = /\.{5,}/;
const PROCESS_HEAD_RE = /^(\d\.\d+\.\d+)\.\s+([A-Z]{3}\.\d+)\s+(.+)$/;
const CHAPTER5_RE = /^5\.\s+프로세스 능력 수준/;
const BP_HEAD_RE = /^([A-Z]{3})\.?(\d+)\.BP(\d+):?\s+(.*)$/;
// "참고 8:" is a source typo for "비고 8:" (REU.2.BP6).
const NOTE_RE = /^(비고|참고)\s*\d+\s*:/;
const ITEM_RE = /^(\d+)\)\s+(.*)$/;
const WP_ROW_RE = /^(\d{2}-\d{2})\s+(\S.*?)(\s+X)*\s*$/;
const PA_HEAD_RE = /^(\d\.\d\.\d)\.\s+(PA \d\.\d)\s+(.+?)\s*프로세스 속성\s*$/;
// `\.?` tolerates the source typo "GP 5.2.2. 합의된 …" (stray dot after the id).
const GP_HEAD_RE = /^(GP \d\.\d\.\d)\.?:?\s+(.*)$/;
const ENDS_WITH_X_RE = /\sX$/;
const INFO_ID_RE = /^(\d{2}-\d{2})$/;
const BULLET_RE = /^•\s*/;

const isToc = (l) => TOC_RE.test(l);

export function parsePam41(text) {
  const lines = stripNoise(text).split("\n");
  const findFrom = (start, re) => {
    for (let i = start; i < lines.length; i++) if (re.test(lines[i]) && !isToc(lines[i])) return i;
    return -1;
  };

  const ch5 = findFrom(0, CHAPTER5_RE);
  const annexA = ch5 >= 0 ? findFrom(ch5, /^부록 A(\s|$)/) : -1;
  const annexB = findFrom(Math.max(ch5, 0), /^부록 B(\s|$)/);
  const annexC = annexB >= 0 ? findFrom(annexB + 1, /^부록 C(\s|$)/) : -1;

  const procEnd = ch5 >= 0 ? ch5 : lines.length;
  const paEnd = annexA >= 0 ? annexA : annexB >= 0 ? annexB : lines.length;

  return {
    processes: parseProcesses(lines, 0, procEnd),
    processAttributes: ch5 >= 0 ? parseProcessAttributes(lines, ch5, paEnd) : {},
    informationItems: annexB >= 0 ? parseInformationItems(lines, annexB + 1, annexC >= 0 ? annexC : lines.length) : {},
  };
}

// ---------------------------------------------------------------- helpers

/** Split "제목. 설명…" at the first sentence end (". " or end of text). */
function splitTitle(full) {
  const m = /^(.+?)\.(?:\s+|$)([\s\S]*)$/.exec(full);
  if (!m) return { title: full.trim(), description: "" };
  return { title: m[1].trim(), description: m[2].trim() };
}

/** Collect numbered `n)` items; unnumbered lines continue the previous item. */
function collectItems(itemLines) {
  const out = [];
  for (const l of itemLines) {
    const m = ITEM_RE.exec(l.trim());
    if (m) out.push({ id: Number(m[1]), parts: [m[2]] });
    else if (out.length) out[out.length - 1].parts.push(l);
  }
  return out.map((o) => ({ id: o.id, text: joinWrapped(o.parts) }));
}

function nextContentLine(lines, i, end) {
  for (let j = i + 1; j < end; j++) if (!isPageMarker(lines[j])) return lines[j].trim();
  return null;
}

// -------------------------------------------------------------- processes

function parseProcesses(lines, start, end) {
  const heads = [];
  for (let i = start; i < end; i++) {
    const l = lines[i].trim();
    if (isToc(l)) continue;
    const m = PROCESS_HEAD_RE.exec(l);
    if (m) heads.push({ index: i, pamSection: m[1], id: m[2], name: m[3].trim() });
  }
  return heads.map((h, k) =>
    parseProcessSection(lines, h, h.index + 1, k + 1 < heads.length ? heads[k + 1].index : end),
  );
}

function parseProcessSection(lines, head, start, end) {
  const { id: procId, pamSection } = head;
  let state = "pre";
  const purposeLines = [];
  const outcomeLines = [];
  const bps = [];
  let cur = null;
  const wps = [];

  for (let i = start; i < end; i++) {
    const raw = lines[i];
    if (isPageMarker(raw)) continue;
    const l = raw.trim();

    if (state !== "scoreboard" && state !== "wps" && state !== "sbBps") {
      if (l === "프로세스 목적") { state = "purpose"; continue; }
      if (l === "프로세스 성과") { state = "outcomes"; continue; }
      if (l === "기본 사례" && (state === "outcomes" || state === "purpose")) { state = "bps"; continue; }
    }

    switch (state) {
      case "purpose":
        purposeLines.push(l);
        break;
      case "outcomes":
        if (!NOTE_RE.test(l)) outcomeLines.push(l);
        break;
      case "bps": {
        if (l.startsWith(`${procId} `) && nextContentLine(lines, i, end) === "성과") {
          state = "scoreboard";
          cur = null;
          break;
        }
        const m = BP_HEAD_RE.exec(l);
        const num = m ? Number(m[3]) : NaN;
        const lastNum = bps.length ? bps[bps.length - 1].num : 0;
        if (m && `${m[1]}.${m[2]}` === procId && num > lastNum) {
          cur = { num, page: pageAt(lines, i), textLines: [m[4]], notes: [], inNote: false };
          bps.push(cur);
        } else if (cur && NOTE_RE.test(l)) {
          cur.notes.push([l]);
          cur.inNote = true;
        } else if (cur) {
          if (cur.inNote) cur.notes[cur.notes.length - 1].push(l);
          else cur.textLines.push(l);
        }
        break;
      }
      case "scoreboard":
        if (l === "출력 정보 항목") state = "wps";
        break;
      case "wps": {
        if (l === "기본 사례") { state = "sbBps"; break; }
        const m = WP_ROW_RE.exec(l);
        if (m) wps.push({ id: m[1], name: m[2].trim() });
        break;
      }
      default:
        break;
    }
  }

  const seenWp = new Set();
  const outputWorkProducts = wps.filter((w) => (seenWp.has(w.id) ? false : (seenWp.add(w.id), true)));

  const basePractices = bps.map((b) => {
    const id = `BP${b.num}`;
    const { title, description } = splitTitle(joinWrapped(b.textLines));
    return {
      id,
      title,
      description,
      notes: b.notes.map((n) => joinWrapped(n)),
      page: b.page,
      pamCitation: `PAM 4.1 §${pamSection} ${procId}.${id}`,
    };
  });

  return {
    id: procId,
    name: head.name,
    category: procId.split(".")[0],
    pamSection,
    page: pageAt(lines, head.index),
    purpose: joinWrapped(purposeLines),
    outcomes: collectItems(outcomeLines),
    basePractices,
    outputWorkProducts,
    traceBPs: basePractices
      .filter((b) => /추적성|일관성/.test(`${b.title} ${b.description}`))
      .map((b) => b.id),
  };
}

// ---------------------------------------------------- process attributes

function parseProcessAttributes(lines, start, end) {
  const heads = [];
  for (let i = start; i < end; i++) {
    const l = lines[i].trim();
    if (isToc(l)) continue;
    const m = PA_HEAD_RE.exec(l);
    if (m) heads.push({ index: i, pamSection: m[1], id: m[2], name: m[3].trim() });
  }
  const out = {};
  heads.forEach((h, k) => {
    out[h.id] = parsePaSection(lines, h, h.index + 1, k + 1 < heads.length ? heads[k + 1].index : end);
  });
  return out;
}

function parsePaSection(lines, head, start, end) {
  const { id: paId, pamSection } = head;
  let state = "pre";
  const scopeLines = [];
  const achievementLines = [];
  const gps = [];
  let cur = null;

  for (let i = start; i < end; i++) {
    const raw = lines[i];
    if (isPageMarker(raw)) continue;
    const l = raw.trim();
    if (state === "done") break;

    if (state !== "gps") {
      if (l === "프로세스 속성 범위") { state = "scope"; continue; }
      if (l === "프로세스 속성 달성") { state = "achievements"; continue; }
      if (l === "일반 사례" && state === "achievements") { state = "gps"; continue; }
    }

    if (state === "scope") scopeLines.push(l);
    else if (state === "achievements") achievementLines.push(l);
    else if (state === "gps") {
      // The scoreboard starts with "PA x.y …"; everything after it is a table.
      if (/^PA \d\.\d(\s|$)/.test(l)) { state = "done"; continue; }
      const m = GP_HEAD_RE.exec(l);
      if (m && !ENDS_WITH_X_RE.test(l)) {
        cur = { id: m[1], page: pageAt(lines, i), textLines: [m[2]], notes: [], inNote: false };
        gps.push(cur);
      } else if (cur && NOTE_RE.test(l)) {
        cur.notes.push([l]);
        cur.inNote = true;
      } else if (cur) {
        if (cur.inNote) {
          // GP notes are interleaved with indicator lines. A note continues
          // while its last line has no sentence end, or with bullet items.
          const note = cur.notes[cur.notes.length - 1];
          const prev = note[note.length - 1];
          if (BULLET_RE.test(l) || !/\.$/.test(prev)) {
            note.push(l);
            continue;
          }
          cur.inNote = false;
        }
        cur.textLines.push(l);
      }
    }
  }

  return {
    id: paId,
    level: Number(paId.slice(3, 4)),
    name: head.name,
    pamSection,
    page: pageAt(lines, head.index),
    scope: joinWrapped(scopeLines),
    achievements: collectItems(achievementLines),
    genericPractices: gps.map((g) => {
      const { title, description } = splitTitle(joinWrapped(g.textLines));
      return {
        id: g.id,
        title,
        description,
        notes: g.notes.map((n) => joinWrapped(n)),
        page: g.page,
        pamCitation: `PAM 4.1 §${pamSection} ${g.id}`,
      };
    }),
  };
}

// ------------------------------------------------- annex B information items

const SECTION_HEADS = [
  ["identifies", /^식별 항목\s*:\s*(.*)$/],
  ["includes", /^포함 사항\s*:\s*(.*)$/],
  ["examples", /^예시 및 참조\s*:\s*(.*)$/],
];

const NAME_CONT_MAX = 20;

function parseInformationItems(lines, start, end) {
  const items = [];
  let cur = null;
  for (let i = start; i < end; i++) {
    const raw = lines[i];
    if (isPageMarker(raw)) continue;
    const l = raw.trim();
    if (/^ID\s+이름\s+특징$/.test(l) || /^표 B\.\s*\d/.test(l)) continue;

    const idm = INFO_ID_RE.exec(l);
    if (idm) {
      cur = { id: idm[1], page: pageAt(lines, i), name: null, summary: [], section: "summary",
        lists: { identifies: [], includes: [], examples: [] } };
      items.push(cur);
      continue;
    }
    if (!cur) continue;
    if (cur.name === null) { cur.name = l; cur.nameOpen = true; continue; }

    const head = SECTION_HEADS.find(([, re]) => re.test(l));
    // Names wrap in the narrow table column ("밸리데이션 방안 선택" + "집합").
    // A short line that is not a sentence end, bullet or section head still
    // belongs to the name; the summary column is wide, so its lines are long.
    if (cur.nameOpen) {
      if (!head && !BULLET_RE.test(l) && !/(\.|다)$/.test(l) && l.length <= NAME_CONT_MAX) {
        cur.name = `${cur.name} ${l}`;
        continue;
      }
      cur.nameOpen = false;
    }
    if (head) {
      cur.section = head[0];
      const rest = head[1].exec(l)[1];
      if (rest) cur.lists[cur.section].push([rest.replace(BULLET_RE, "")]);
      continue;
    }
    if (cur.section === "summary") { cur.summary.push(l); continue; }
    const list = cur.lists[cur.section];
    if (BULLET_RE.test(l) || !list.length) list.push([l.replace(BULLET_RE, "")]);
    else list[list.length - 1].push(l);
  }

  const out = {};
  for (const it of items) {
    out[it.id] = {
      id: it.id,
      name: it.name,
      page: it.page,
      characteristics: {
        summary: joinWrapped(it.summary),
        identifies: it.lists.identifies.map((p) => joinWrapped(p)),
        includes: it.lists.includes.map((p) => joinWrapped(p)),
        examples: it.lists.examples.map((p) => joinWrapped(p)),
      },
    };
  }
  return out;
}
