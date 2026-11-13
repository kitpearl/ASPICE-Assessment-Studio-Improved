import jsPDF from "jspdf";
import { normalizeEvidence } from "./evidence";
import { referencesToText, cappedRules } from "./references";
import { captureToPngCanvas, sliceCanvasToPdfPage } from "./pdfPaginator";
import { RATING_META, RATING_ORDER, countRatings, isCl1Pass } from "../data/ratingMeta";
import { FINDING_TYPE_LABEL, flattenStandardRefs, buildFindingNarrative } from "./findings";

// 표준 인용 리스트({kind,text}[]) 를 "PAM xxx, BGB yyy" 형태의 한 줄로 만든다.
const formatRefs = (refs) => refs.map((r) => `${r.kind} ${r.text}`).join(", ");

// 텍스트 결과물은 PDF(=VerdictCard 캡처) 와 동일한 내용을 담아야 한다.
// 따라서 VerdictCard 의 렌더 구조 — 헤더 판정 / 등급 분포 / 강점·Finding /
// BP별 Finding 카드(서술·위치·표준근거·Rating Rule) — 를 그대로 글로 옮긴다.
// (HarnessVerdictBlock 은 화면에서 data-html2canvas-ignore 라 PDF 에 빠지므로
//  여기서도 제외한다.)
export const exportReportAsText = ({ proc, results, fileName, date }) => {
  const counts = countRatings(results.ratings);
  const totalBps = proc.bps.length;
  const cl1Pass = isCl1Pass(results.ratings);
  // VerdictHeader 와 동일한 식: N/P 를 뺀 나머지를 "L 이상" 으로 본다.
  const aboveL = totalBps - (counts.N || 0) - (counts.P || 0);

  const L = [];
  const push = (s = "") => L.push(s);
  const rule = (ch = "─") => L.push(ch.repeat(64));

  // ── 헤더 (VerdictHeader) ──
  push("§ 03 · NPLF 평가 결과");
  push("Capability Level 1 · 평가 결과");
  rule("=");
  push(`판정: ${cl1Pass ? "적합 (Conformant)" : "갭 발견 (Gap Detected)"} · ${aboveL}/${totalBps} BP가 L 이상`);
  push(`프로세스: ${proc.id} ${proc.name}`);
  push(`문서: ${fileName || "—"}`);
  push(`일시: ${date.toLocaleString("ko-KR")}`);
  push();
  if (results.summary) {
    push(`[Summary] ${results.summary}`);
    push();
  }

  // ── 등급 분포 (RatingCountsGrid) ──
  push("등급 분포 (Rating Distribution)");
  rule();
  RATING_ORDER.forEach((k) => {
    const m = RATING_META[k];
    const c = counts[k] || 0;
    const pct = totalBps ? (c / totalBps) * 100 : 0;
    push(`  ${k.padEnd(3)} · ${m.label.toUpperCase().padEnd(11)} ${String(c).padStart(2)}개  ${pct.toFixed(0)}% · ${m.range}`);
  });
  push();

  // ── 강점 / Finding (InsightsPair) ──
  if (results.strengths || results.gaps) {
    if (results.strengths) {
      push("◆ 강점");
      push(`  ${results.strengths}`);
      push();
    }
    if (results.gaps) {
      push("◆ Finding");
      push(`  ${results.gaps}`);
      push();
    }
  }

  // ── BP별 평가 (BpRatingRow) ──
  push("BP별 평가 (BP-level Ratings)");
  rule("=");
  push();

  proc.bps.forEach((bp) => {
    const rating =
      results.ratings.find((x) => x.bp === bp.id) ||
      { rating: "N", rationale: "응답 누락", evidence: "없음" };
    const m = RATING_META[rating.rating] || RATING_META.N;
    // 각 BP 단락 상단에 BP 번호를 머릿글로 먼저 노출한다.
    // (BP 번호가 [등급] (범위) 뒤에 묻혀 누락된 것처럼 보이던 문제 수정)
    rule("─");
    push(`${proc.id}.${bp.id}  ${bp.title}`);
    push(`  판정: [${rating.rating}] (${m.range})`);
    const refText = referencesToText(rating.references, rating.appliedRules, { pamSep: " / " });
    if (refText) push(`  근거: ${refText}`);
    cappedRules(rating.references, rating.appliedRules).forEach((c) => {
      push(`  등급 상한 적용: [${c.id}] ${c.capLabel} · ${c.source}${c.note ? ` — ${c.note}` : ""}`);
    });

    const findings = Array.isArray(rating.findings) ? rating.findings : [];
    if (findings.length > 0) {
      // 신규: Finding 카드 스택 (FindingCard)
      findings.forEach((f) => {
        const label = FINDING_TYPE_LABEL[f.type] || FINDING_TYPE_LABEL.observation;
        push(`  ◆ ${label}${f.id ? `  ${f.id}` : ""}`);
        const narrative = buildFindingNarrative(f);
        if (narrative) push(`    Finding: ${narrative}`);

        const loc = f.location ?? {};
        if (loc.found || loc.recommended) {
          const segs = [];
          if (loc.found) segs.push(`발견: ${loc.found}`);
          if (loc.recommended) segs.push(`권고 위치: ${loc.recommended}`);
          push(`    위치 (LOCATION): ${segs.join(" · ")}`);
        }

        const refs = flattenStandardRefs(f.standardReferences, proc.id);
        if (refs.length) push(`    표준 근거: ${formatRefs(refs)}`);

        const ri = f.ratingImpact ?? {};
        if (ri.ruleApplied || ri.scoreDelta) {
          const bits = [];
          if (ri.ruleId) bits.push(ri.ruleId);
          if (typeof ri.scoreDelta === "number" && ri.scoreDelta !== 0) {
            bits.push(`Δ ${ri.scoreDelta > 0 ? "+" : ""}${ri.scoreDelta}%`);
          }
          push(`    Rating Rule · ${bits.join("  ")}`);
          if (ri.reason) push(`      ${ri.reason}`);
        }
        push();
      });
      const ratingRefs = flattenStandardRefs(rating.standardReferences, proc.id);
      if (ratingRefs.length) {
        push(`  표준 근거: ${formatRefs(ratingRefs)}`);
        push();
      }
    } else {
      // 레거시: rationale + 약점(WEAKNESS) + evidence 리스트
      push(`  약점 · ${rating.rationale}`);
      push("  약점 (WEAKNESS)");
      const evidenceItems = normalizeEvidence(rating.evidence);
      if (evidenceItems.length === 0) {
        push("    제시된 증거 없음");
      } else {
        evidenceItems.forEach((ev, i) => {
          const loc = ev.location ? `[${ev.location}] ` : "";
          push(`    ${i + 1}. ${loc}${ev.quote || "(내용 없음)"}`);
        });
      }
      const ratingRefs = flattenStandardRefs(rating.standardReferences, proc.id);
      if (ratingRefs.length) push(`  표준 근거: ${formatRefs(ratingRefs)}`);
      push();
    }
  });

  const blob = new Blob([L.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ASPICE_${proc.id}_report.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// PDF 내보내기용 인쇄 스타일: 화면의 다크 테마를 종이용 라이트 레이아웃으로 덮어쓴다.
// 모든 폰트 크기는 화면 대비 약 0.9× 로 축소되어 종이에 맞춰져 있음.
const PRINT_STYLE = `
  #pdf-export-root { background:#FFFFFF !important; color:#3F3F46 !important; border:1.5px solid #0A0A0C !important; border-radius:4px !important; padding:18px 22px 20px !important; font-family:'Inter',system-ui,sans-serif !important; }
  #pdf-export-root, #pdf-export-root * { color:#3F3F46 !important; letter-spacing:-0.005em !important; }
  #pdf-export-root > div:first-child { background:#FFFFFF !important; color:#0A0A0C !important; border:1.5px solid #0A0A0C !important; font-size:8px !important; padding:3px 10px !important; top:-9px !important; }
  #pdf-export-root > div:first-child * { color:#0A0A0C !important; }
  #pdf-export-root h3 { color:#0A0A0C !important; font-size:20px !important; margin:0 0 5px 0 !important; font-weight:700 !important; }
  #pdf-export-root h3 > span { font-size:11px !important; color:#52525C !important; }
  #pdf-export-root p { font-size:9.5px !important; line-height:1.45 !important; margin:0 !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] { gap:7px !important; margin-bottom:13px !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div { background:#FFFFFF !important; border-radius:4px !important; padding:9px 13px !important; border-width:1px 1px 1px 4px !important; border-style:solid !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div > div:nth-child(1) { font-size:8px !important; font-weight:700 !important; opacity:1 !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div > div:nth-child(2) { font-size:29px !important; line-height:1 !important; margin-top:5px !important; font-weight:800 !important; color:#111827 !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div > div:nth-child(3) { font-size:8px !important; color:#6B7280 !important; opacity:1 !important; margin-top:3px !important; }
  #pdf-export-root div[style*="1fr 1fr"] { gap:9px !important; margin-bottom:13px !important; }
  #pdf-export-root div[style*="1fr 1fr"] > div { background:#FAFAFA !important; border:1px solid #D4D4D8 !important; border-left:2.5px solid #0A0A0C !important; border-radius:0 3px 3px 0 !important; padding:9px 11px !important; }
  #pdf-export-root div[style*="1fr 1fr"] > div > div:nth-child(1) { font-size:8px !important; color:#0A0A0C !important; font-weight:700 !important; margin-bottom:3px !important; }
  #pdf-export-root div[style*="1fr 1fr"] > div > div:nth-child(2) { font-size:10px !important; color:#3F3F46 !important; line-height:1.45 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] { background:#FFFFFF !important; border:1px solid #0A0A0C !important; border-radius:3px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(1) { background:#FFFFFF !important; color:#0A0A0C !important; border-right:1px solid #0A0A0C !important; padding:6px 0 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(1) > div:nth-child(1) { font-size:18px !important; font-weight:800 !important; color:#0A0A0C !important; line-height:1 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(1) > div:nth-child(2) { font-size:6.5px !important; color:#52525C !important; opacity:1 !important; margin-top:2px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) { padding:7px 11px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(2) { font-size:9px !important; color:#3F3F46 !important; line-height:1.4 !important; margin-bottom:5px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(3) { font-size:7px !important; color:#52525C !important; letter-spacing:0.12em !important; font-weight:700 !important; margin-bottom:3px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) { gap:3px !important; max-height:none !important; overflow:visible !important; padding-right:0 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div { background:#FAFAFA !important; border:1px solid #D4D4D8 !important; border-left:2px solid #0A0A0C !important; padding:5px 8px !important; }
  /* Evidence "location" pill — black bg + white text + visible icon. Force span/svg color so icon and label both render in PDF. */
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:first-child { background:#0A0A0C !important; color:#FFFFFF !important; border:1px solid #0A0A0C !important; padding:2px 7px !important; font-size:7px !important; font-weight:700 !important; letter-spacing:0.06em !important; margin-bottom:3px !important; display:inline-flex !important; align-items:center !important; gap:4px !important; max-width:100% !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:first-child * { color:#FFFFFF !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:first-child svg { color:#FFFFFF !important; stroke:#FFFFFF !important; fill:none !important; width:8px !important; height:8px !important; flex-shrink:0 !important; }
  /* Quote box — show full content (no scroll), neutralise screen-only background/border. */
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:last-child { font-size:8.5px !important; color:#3F3F46 !important; line-height:1.4 !important; max-height:none !important; overflow:visible !important; padding:4px 6px !important; background:#FFFFFF !important; border:none !important; }
  #pdf-export-root > div[style*="flex-direction: column"]:last-child { gap:5px !important; }
  /* P4: finding cards. Inline styles already render well in
     PDF; these rules just tighten paddings/fonts for paper. */
  #pdf-export-root [data-finding-card] { padding:7px 11px 9px !important; border-radius:3px !important; }
  #pdf-export-root [data-finding-card] > div:first-child { margin-bottom:4px !important; gap:6px !important; }
  #pdf-export-root [data-finding-card] > div:first-child > span { font-size:7px !important; }
  #pdf-export-root [data-finding-card] > div { margin-top:5px !important; }
  #pdf-export-root [data-finding-card] > div > div:first-child { font-size:6.5px !important; margin-bottom:2px !important; }
  #pdf-export-root [data-finding-card] > div > div:last-child { font-size:9px !important; line-height:1.4 !important; }
`;

const attachPrintStyle = (clonedDoc, clonedElement) => {
  // VerdictCard always renders the section with data-pdf-export-root. Prefer the
  // cloned element passed by html2canvas; query the doc as a safety net.
  const target =
    (clonedElement && clonedElement.hasAttribute && clonedElement.hasAttribute("data-pdf-export-root")
      ? clonedElement
      : null) ||
    (clonedElement && clonedElement.querySelector ? clonedElement.querySelector("[data-pdf-export-root]") : null) ||
    clonedDoc.querySelector("[data-pdf-export-root]");
  if (!target) {
    throw new Error("PDF 인쇄 스타일을 적용할 평가 결과 섹션(data-pdf-export-root)을 찾지 못했습니다.");
  }
  target.id = "pdf-export-root";
  const s = clonedDoc.createElement("style");
  s.textContent = PRINT_STYLE;
  (clonedDoc.head || clonedDoc.documentElement).appendChild(s);
  // Belt-and-braces: also mutate inline styles directly so the print look
  // applies even if the injected <style> doesn't reach html2canvas's renderer
  // (selector specificity, attribute mismatch, etc.).
  applyInlinePdfStyle(target);
};

const setStyle = (el, patch) => {
  if (!el) return;
  for (const [k, v] of Object.entries(patch)) {
    el.style.setProperty(k, v, "important");
  }
};

// P4: Finding 카드 안의 모든 quote/pill 요소도 evidence-list 와 동일한 보정을
// 받도록 한다. lucide SVG 의 PDF 렌더 문제 회피 + quote 박스의 max-height 제거가
// 핵심이며, 카드 자체의 색상/패딩은 PRINT_STYLE 의 [data-finding-card] 규칙이
// 담당한다.
const applyInlineFindingStyle = (bodyCell) => {
  bodyCell.querySelectorAll("[data-finding-card]").forEach((card) => {
    setStyle(card, {
      padding: "7px 11px 9px",
      "border-radius": "3px",
    });
  });
  bodyCell.querySelectorAll("[data-evidence-quote]").forEach((quote) => {
    setStyle(quote, {
      "font-size": "8.5px",
      color: "#3F3F46",
      "line-height": "1.4",
      "max-height": "none",
      overflow: "visible",
      padding: "4px 6px",
      background: "#FFFFFF",
      border: "none",
    });
  });
  // Location pills inside finding evidence — same SVG-vanishing workaround
  // as the legacy path: replace the lucide icon + label with plain "▸ {text}".
  bodyCell
    .querySelectorAll("[data-finding-card] [data-evidence-quote]")
    .forEach((quote) => {
      const item = quote.parentElement;
      if (!item) return;
      const pill = Array.from(item.children).find(
        (c) =>
          c !== quote &&
          c.nodeType === 1 &&
          !c.hasAttribute("data-html2canvas-ignore") &&
          c.tagName !== "BUTTON"
      );
      if (!pill) return;
      const labelText = pill.textContent ? pill.textContent.trim() : "";
      pill.innerHTML = "";
      const label = pill.ownerDocument.createElement("span");
      label.textContent = "▸ " + labelText;
      setStyle(label, { color: "#FFFFFF", "font-weight": "700" });
      pill.appendChild(label);
      setStyle(pill, {
        background: "#0A0A0C",
        color: "#FFFFFF",
        border: "1px solid #0A0A0C",
        "border-radius": "3px",
        padding: "2px 8px",
        "font-size": "7.5px",
        "font-weight": "700",
        "letter-spacing": "0.04em",
        "margin-bottom": "3px",
        display: "inline-block",
        "max-width": "100%",
        "word-break": "break-all",
        "white-space": "normal",
        "font-family": "'JetBrains Mono', monospace",
      });
    });
};

// Walk the verdict section in the cloned doc and rewrite inline styles for
// the elements the PDF cares about. This is the load-bearing path now — the
// CSS in PRINT_STYLE remains as a backstop but is no longer required.
const applyInlinePdfStyle = (root) => {
  setStyle(root, {
    background: "#FFFFFF",
    color: "#3F3F46",
    border: "1.5px solid #0A0A0C",
    "border-radius": "4px",
    padding: "18px 22px 20px",
    "font-family": "'Inter',system-ui,sans-serif",
  });

  // Iterate every BP rating row (grid with 60px + minmax columns).
  root.querySelectorAll('div[style*="60px"][style*="minmax"]').forEach((row) => {
    setStyle(row, { background: "#FFFFFF", border: "1px solid #0A0A0C", "border-radius": "3px" });
    const cells = row.children;
    if (cells.length < 2) return;
    const [ratingCell, bodyCell] = cells;

    // Left rating cell — strip rating-color background, big bold rating glyph.
    setStyle(ratingCell, {
      background: "#FFFFFF",
      color: "#0A0A0C",
      "border-right": "1px solid #0A0A0C",
      padding: "6px 0",
    });
    const ratingChildren = ratingCell.children;
    if (ratingChildren[0]) setStyle(ratingChildren[0], { "font-size": "18px", "font-weight": "800", color: "#0A0A0C", "line-height": "1" });
    if (ratingChildren[1]) setStyle(ratingChildren[1], { "font-size": "6.5px", color: "#52525C", opacity: "1", "margin-top": "2px" });

    // Right body cell — title row, then either (new) FindingCard stack or
    // (legacy) rationale + evidence list. Detect findings mode and skip the
    // legacy mutation so the new card layout flows untouched.
    setStyle(bodyCell, { padding: "7px 11px" });
    // 근거 칩(ReferenceChips)·상한 사유 블록은 references/appliedRules 유무에 따라 끼어들기 때문에
    // 위치 계산에서 빼고 따로 줄인다(Finding 모드·레거시 모드 공통).
    const chips = bodyCell.querySelector("[data-reference-chips]");
    if (chips) {
      setStyle(chips, { "margin-bottom": "4px" });
      chips.querySelectorAll("span, button").forEach((el) => setStyle(el, { "font-size": "7px", padding: "0 4px" }));
    }
    const capReason = bodyCell.querySelector("[data-cap-reason]");
    if (capReason) {
      setStyle(capReason, { padding: "4px 8px", "margin-bottom": "4px", "font-size": "8px", "line-height": "1.4" });
      capReason.querySelectorAll("div").forEach((el) => setStyle(el, { "font-size": "8px", "line-height": "1.4" }));
    }
    if (bodyCell.querySelector("[data-finding-card]")) {
      applyInlineFindingStyle(bodyCell);
      return;
    }
    const body = Array.from(bodyCell.children).filter(
      (c) => !c.hasAttribute("data-reference-chips") && !c.hasAttribute("data-cap-reason"),
    );
    if (body[1]) setStyle(body[1], { "font-size": "9px", color: "#3F3F46", "line-height": "1.4", "margin-bottom": "5px" });
    if (body[2]) setStyle(body[2], { "font-size": "7px", color: "#52525C", "letter-spacing": "0.12em", "font-weight": "700", "margin-bottom": "3px" });
    const evidenceList = body[3];
    if (!evidenceList) return;
    setStyle(evidenceList, { gap: "3px", "max-height": "none", overflow: "visible", "padding-right": "0" });

    Array.from(evidenceList.children).forEach((item) => {
      setStyle(item, { background: "#FAFAFA", border: "1px solid #D4D4D8", "border-left": "2px solid #0A0A0C", padding: "5px 8px" });
      // Find the quote/pill by attribute. Children layout is variable now
      // (pill optional, quote optional, "더 보기" toggle button optional),
      // so positional destructuring is unsafe.
      const quote = item.querySelector('[data-evidence-quote]');
      const pill = Array.from(item.children).find(
        (c) => c !== quote && c.nodeType === 1 && !c.hasAttribute("data-html2canvas-ignore") && c.tagName !== "BUTTON"
      );
      if (pill) {
        // html2canvas struggles with lucide SVG inside inline-flex containers
        // (icon AND label sometimes vanish in the rasterised output). Replace
        // the pill contents with a single plain-text label, which renders
        // reliably as a normal block element.
        const labelText = pill.textContent ? pill.textContent.trim() : "";
        pill.innerHTML = "";
        const label = pill.ownerDocument.createElement("span");
        label.textContent = "▸ " + labelText;
        setStyle(label, { color: "#FFFFFF", "font-weight": "700" });
        pill.appendChild(label);
        setStyle(pill, {
          background: "#0A0A0C",
          color: "#FFFFFF",
          border: "1px solid #0A0A0C",
          "border-radius": "3px",
          padding: "2px 8px",
          "font-size": "7.5px",
          "font-weight": "700",
          "letter-spacing": "0.04em",
          "margin-bottom": "3px",
          display: "inline-block",
          "max-width": "100%",
          "word-break": "break-all",
          "white-space": "normal",
          "font-family": "'JetBrains Mono', monospace",
        });
      }
      if (quote) {
        setStyle(quote, {
          "font-size": "8.5px",
          color: "#3F3F46",
          "line-height": "1.4",
          "max-height": "none",
          overflow: "visible",
          padding: "4px 6px",
          background: "#FFFFFF",
          border: "none",
        });
      }
    });
  });
};

const formatHeaderDate = (d) => {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}. ${m}. ${day}. ${hh}:${mi}`;
};

const renderHeader = (pdf, proc, pageWidth, headerH, headerPad, cont) => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(248, 248, 250); pdf.rect(0, 0, pageWidth, headerH, "F");
  pdf.setDrawColor(180, 180, 188); pdf.setLineWidth(0.3);
  pdf.line(0, headerH, pageWidth, headerH);
  pdf.setTextColor(10, 10, 12); pdf.setFontSize(10);
  pdf.text(`ASPICE PAM 4.1 · ${proc.id} ${proc.name}${cont ? " (cont.)" : ""}`, headerPad, 10);
  pdf.setFontSize(7.5); pdf.setTextColor(100, 100, 110);
  pdf.text(formatHeaderDate(new Date()), pageWidth - headerPad, 10, { align: "right" });
};

const sliceCanvasToPdf = (pdf, canvas, imgX, yTop, sliceMm, srcY, srcH, scaledImgW) => {
  sliceCanvasToPdfPage(pdf, canvas, {
    srcY, srcH,
    dstX: imgX, dstY: yTop, dstW: scaledImgW, dstH: sliceMm,
  });
};

const DISCLAIMER_TEXT = "주의 : 본 진단 및 평가 결과는 비공식 갭 진단이며, iNTACS 공식 평가를 대체하지 않으며, 심사 또는 평가 근거로 사용되지 않습니다.";

// jsPDF 기본 폰트(Helvetica)는 한글을 못 그려서 pdf.text() 로는 disclaimer 가 mojibake 가 된다.
// html2canvas 로 한 번 캡처해 이미지로 모든 페이지에 도장 찍듯이 박아준다.
const captureDisclaimerImage = async () => {
  const stage = document.createElement("div");
  // width 는 본문 캡처와 비슷한 스케일(약 1100px) 로 잡고, 한글 평균 폭(≈12px @ 11pt)
  // 기준으로 disclaimer 한 줄(≈71자)이 여유롭게 들어가도록 폰트는 11px 로 둔다.
  stage.style.cssText = `
    position: fixed;
    left: -99999px;
    top: 0;
    width: 1100px;
    padding: 4px 12px;
    background: #FFFFFF;
    font-family: 'Inter', 'Noto Sans KR', system-ui, sans-serif;
    font-size: 11px;
    color: #6B7280;
    text-align: center;
    letter-spacing: -0.005em;
    line-height: 1.35;
  `;
  stage.textContent = DISCLAIMER_TEXT;
  document.body.appendChild(stage);
  try {
    return await captureToPngCanvas(stage);
  } finally {
    stage.remove();
  }
};

export const exportReportAsPdf = async ({ proc, node }) => {
  const canvas = await captureToPngCanvas(node, {
    windowWidth: node.scrollWidth,
    onclone: attachPrintStyle,
  });

  const disclaimerCanvas = await captureDisclaimerImage();
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  // 본문 하단 여백을 12mm 로 잡아 footer 위에 disclaimer 한 줄이 들어갈 공간을 확보한다.
  const marginY = 12;
  const sideMargin = 5;
  const headerPad = 8;
  const headerH = 16;
  const scaledImgW = pageWidth - sideMargin * 2;
  const imgH = (canvas.height * scaledImgW) / canvas.width;
  const imgX = sideMargin;

  renderHeader(pdf, proc, pageWidth, headerH, headerPad, false);
  const positionY = headerH + 4;
  const pxPerMm = canvas.width / scaledImgW;

  if (imgH + positionY + marginY <= pageHeight) {
    pdf.addImage(imgData, "PNG", imgX, positionY, scaledImgW, imgH);
  } else {
    const firstMm = pageHeight - positionY - marginY;
    const otherMm = pageHeight - headerH - 4 - marginY;
    const fp = Math.min(canvas.height, Math.floor(firstMm * pxPerMm));
    sliceCanvasToPdf(pdf, canvas, imgX, positionY, fp / pxPerMm, 0, fp, scaledImgW);
    let sy = fp;
    let rem = canvas.height - fp;
    while (rem > 0) {
      pdf.addPage();
      renderHeader(pdf, proc, pageWidth, headerH, headerPad, true);
      const sp = Math.min(rem, Math.floor(otherMm * pxPerMm));
      sliceCanvasToPdf(pdf, canvas, imgX, positionY, sp / pxPerMm, sy, sp, scaledImgW);
      sy += sp;
      rem -= sp;
    }
  }

  const disclaimerImg = disclaimerCanvas.toDataURL("image/png");
  const disclaimerWMm = pageWidth - sideMargin * 2;
  const disclaimerHMm = (disclaimerCanvas.height * disclaimerWMm) / disclaimerCanvas.width;
  const pc = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    pdf.setPage(i);
    pdf.addImage(disclaimerImg, "PNG", sideMargin, pageHeight - 4 - disclaimerHMm - 1.2, disclaimerWMm, disclaimerHMm);
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 130);
    pdf.text(`Automotive SPICE® VDA QMC · ASPICE Workbench  ·  ${i}/${pc}`, pageWidth / 2, pageHeight - 4, { align: "center" });
  }
  pdf.save(`ASPICE_${proc.id}_report_${Date.now()}.pdf`);
};
