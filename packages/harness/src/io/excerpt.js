/**
 * Build a compact, keyword-aware evidence excerpt from a set of artifacts.
 * Used by the LLM scorer to stay within a prompt budget while surfacing
 * the passages most likely to contain BP/GP/WP evidence.
 *
 * Strategy per artifact:
 *   1. Find the top-N keyword hits (window around each hit).
 *   2. Merge overlapping windows.
 *   3. If nothing matched, take the head of the text.
 *   4. Truncate to `perArtifactChars`.
 *
 * @param {{
 *   artifacts: import("../model/evidence.js").Artifact[],
 *   keywords: string[],
 *   maxChars?: number,
 *   perArtifactChars?: number,
 *   window?: number,
 * }} opts
 */
export function buildExcerpt({
  artifacts,
  keywords = [],
  maxChars = 18000,
  perArtifactChars = 3600,
  window = 600,
}) {
  const kws = (keywords || []).filter(Boolean).map((k) => k.toLowerCase());
  const chunks = [];
  for (const a of artifacts) {
    const text = a.text || "";
    if (!text) continue;
    const body = kws.length ? keywordPassages(text, kws, window, perArtifactChars) : head(text, perArtifactChars);
    const hdr = `--- ${a.name}${a.wpidCandidates?.length ? ` [WPs: ${a.wpidCandidates.join(", ")}]` : ""} ---`;
    chunks.push(`${hdr}\n${body.trim()}`);
  }
  return truncate(chunks.join("\n\n"), maxChars);
}

function keywordPassages(text, kws, window, limit) {
  const lower = text.toLowerCase();
  const spans = [];
  for (const kw of kws) {
    let from = 0;
    while (from < lower.length) {
      const i = lower.indexOf(kw, from);
      if (i < 0) break;
      spans.push([Math.max(0, i - window), Math.min(text.length, i + kw.length + window)]);
      from = i + kw.length;
    }
  }
  if (!spans.length) return head(text, limit);
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [spans[0]];
  for (let i = 1; i < spans.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = spans[i];
    if (cur[0] <= prev[1]) prev[1] = Math.max(prev[1], cur[1]);
    else merged.push(cur);
  }
  let acc = "";
  for (const [a, b] of merged) {
    const piece = text.slice(a, b);
    if (acc.length + piece.length + 6 > limit) break;
    acc += (acc ? "\n…\n" : "") + piece;
  }
  return acc || head(text, limit);
}

function head(text, n) {
  return text.length > n ? text.slice(0, n) + "\n…(truncated)" : text;
}

function truncate(text, n) {
  return text.length > n ? text.slice(0, n) + "\n…(total excerpt truncated)" : text;
}

/**
 * Tokenize a PAM description into significant keywords for matching.
 * Drops stopwords and splits on non-letters.
 */
const STOPWORDS = new Set([
  // articles / determiners
  "a","an","the","this","these","those","that","which","such",
  // conjunctions
  "and","or","but","nor","yet","so",
  // prepositions
  "of","to","for","in","on","with","by","from","at","into","onto","between",
  "across","under","over","through","upon","without","within","via","per",
  // be / modals / aux
  "is","are","be","been","being","was","were",
  "shall","should","must","may","can","could","would","will",
  // pronouns / quantifiers
  "all","any","each","every","some","none","both","either","neither",
  "their","them","they","it","its","his","her","our","your","my",
  // PAM note/e.g. tokens that leak through
  "note","notes","e","g","i","ie","eg","etc",
  // generic connectives / fillers that surface from PAM prose but carry no
  // assessment signal (data-driven: these appear across many BP descriptions,
  // e.g. "according to", "based on", "with respect to", "traceability alone
  // does not ..."). Domain qualifiers like "appropriate"/"relevant" are kept.
  "according","including","include","includes","included","alone","based",
  "does","using","used","regarding","regard","respect","make","makes",
  "take","takes","need","needs","well","also","other","others","before",
  "after","once","onto",
  // politeness / instruction fillers that leak from PAM prose ("please refer
  // to ...") and read as nonsense when surfaced as a required concept.
  "please","refer","refers","shown","given","above","below",
]);

// PAM PDF-extraction artifact scrubber.
//
// The canonical spec is generated from a markdown conversion of the PAM PDF.
// In the PDF the per-process "Process outcomes" table sits immediately after
// the last Base Practice, and its rotated/vertical "Outcome" column header is
// extracted REVERSED as "emoctuO". The result is that the LAST BP description
// of many processes carries a trailing run like:
//   "... affected parties. SWE.2 Software Architectural Design 1 emoctuO 2 emoctuO ..."
// i.e. a leaked "<ProcId> <Process Name>" header followed by "<n> emoctuO"
// outcome-list rows (plus stray markdown table-cell pipes "|").
//
// Tokenizing that tail injects garbage keywords ("emoctuo") and off-topic
// process-name words into BP/GP concept sets. We cut the description at the
// start of that trailing boilerplate, then defensively scrub any residue.
const PROC_ID_RE = /\b[A-Z]{2,4}\.\d+\b/g;

export function stripPamArtifacts(text) {
  let s = String(text ?? "");
  const art = s.search(/emoctuo/i);
  if (art !== -1) {
    let cut = art;
    // Rewind to the leaked "<ProcId> ..." header that introduces the reversed
    // Outcomes list, if one sits just before the artifact.
    const head = s.slice(0, art);
    let last = -1, m;
    PROC_ID_RE.lastIndex = 0;
    while ((m = PROC_ID_RE.exec(head))) last = m.index;
    if (last !== -1 && art - last <= 80) cut = last;
    // Pull the cut back over the table pipes / whitespace right before it.
    while (cut > 0 && /[\s|]/.test(s[cut - 1])) cut--;
    s = s.slice(0, cut);
  }
  // Belt-and-braces: drop any residual reversed-Outcome tokens and table pipes.
  s = s.replace(/\bemoctuo\b/gi, " ").replace(/\|/g, " ");
  return s.replace(/\s{2,}/g, " ").trim();
}

export function extractKeywords(description, max = 8) {
  const tokens = stripPamArtifacts(description)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);
}
