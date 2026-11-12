import { extractKeywords } from "./excerpt.js";

export { extractKeywords };

// Trailing particles / verb endings, longest first so "에서" wins over "에".
const SUFFIXES = [
  "에서는", "으로는", "에서의", "되어야", "으로", "에서", "에게", "까지", "부터", "에는", "와의", "과의",
  "되고", "되며", "되어", "해야", "하게", "하고", "하며", "하여", "한다", "하는", "하기", "된다", "되는",
  "을", "를", "이", "가", "은", "는", "의", "에", "과", "와", "로", "및", "등", "도", "한", "된",
  "할", "될", "함", "됨",
].sort((a, b) => b.length - a.length);

const VERB_ENDINGS = ["하고", "하며", "하여", "한다", "하는", "하기", "된다", "되는"];

const KO_STOPWORDS = new Set([
  "한다", "있다", "없다", "된다", "대한", "위한", "따라", "통해", "경우", "수행", "정의", "보장", "수립",
  "식별", "문서화", "기반", "사용", "해당", "관련", "포함", "다음", "또는", "그리고", "예를", "들어",
  "기본", "사례", "비고", "프로세스", "작업",
  "있는", "있도록", "않는", "것이다", "에서", "내에서", "하며", "미치", "미칠", "포함할", "사용될", "용이하게",
]);

function stripSuffix(token) {
  for (const s of SUFFIXES) {
    if (token.length - s.length >= 2 && token.endsWith(s)) return token.slice(0, -s.length);
  }
  // Short verb forms like "정한다" leave a 1-char stem: not a keyword.
  if (VERB_ENDINGS.some((s) => token.length > s.length && token.endsWith(s))) return "";
  return token;
}

/**
 * Korean keyword extraction: split on non-Hangul/alnum, strip trailing
 * particles, drop stopwords and 1-char tokens, rank by frequency.
 * English-only text yields [].
 */
export function extractKoreanKeywords(text, max = 10) {
  const freq = new Map();
  for (const raw of (text || "").toLowerCase().split(/[^\p{Script=Hangul}a-z0-9]+/u)) {
    if (!raw || !/\p{Script=Hangul}/u.test(raw)) continue;
    if (KO_STOPWORDS.has(raw)) continue;
    const t = stripSuffix(raw);
    if (t.length < 2 || KO_STOPWORDS.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);
}

/** @returns {{ko: string[], en: string[]}} */
export function extractBilingualKeywords({ ko = "", en = "" } = {}, max = 10) {
  return { ko: extractKoreanKeywords(ko, max), en: extractKeywords(en, max) };
}

const join = (...p) => p.filter(Boolean).join(" ");

/**
 * Keyword source text per language. English falls back to title/description
 * while the spec has no titleEn (legacy English-only canonical data).
 */
export function bpKeywordSources(bp) {
  return {
    ko: join(bp.title, bp.description),
    en: bp.titleEn ? join(bp.titleEn, bp.descriptionEn) : join(bp.title, bp.description),
  };
}

export function gpKeywordSources(gp, paSpec) {
  return {
    ko: join(gp.title, gp.description, paSpec?.scope),
    en: gp.titleEn
      ? join(gp.titleEn, gp.descriptionEn, paSpec?.scopeEn)
      : join(gp.title, gp.description, paSpec?.scope),
  };
}
