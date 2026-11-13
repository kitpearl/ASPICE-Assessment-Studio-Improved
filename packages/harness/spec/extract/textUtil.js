// Text helpers for parsing pdf-parse output of the Korean ASPICE PAM 4.1.

const PAGE_MARKER_RE = /^<!-- Page (\d+) -->$/;

/** True when the (trimmed) line is a `<!-- Page N -->` marker. */
export function isPageMarker(line) {
  return PAGE_MARKER_RE.test(line.trim());
}

/**
 * Remove per-page noise: blank lines, lines starting with `©`, the
 * `VDA Quality Management Center` header and lines holding only a page
 * number. `<!-- Page N -->` markers are kept. Every kept line has its
 * trailing whitespace removed.
 */
export function stripNoise(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith("©")) return false;
      if (t === "VDA Quality Management Center") return false;
      if (/^\d+$/.test(t)) return false;
      return true;
    })
    .join("\n");
}

/** Page number of the nearest `<!-- Page N -->` marker at or before `index` (0 if none). */
export function pageAt(lines, index) {
  for (let i = Math.min(index, lines.length - 1); i >= 0; i--) {
    const m = PAGE_MARKER_RE.exec(lines[i].trim());
    if (m) return Number(m[1]);
  }
  return 0;
}

/** Join wrapped lines with a single space and collapse runs of whitespace. */
export function joinWrapped(lines) {
  const arr = Array.isArray(lines) ? lines : String(lines).split(/\r?\n/);
  return arr
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
