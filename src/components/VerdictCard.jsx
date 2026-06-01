import { forwardRef, useState } from "react";
import { Loader2, FileDown, Download, MapPin } from "lucide-react";

const QUOTE_PREVIEW_CHARS = 120;
const QUOTE_COLLAPSED_MAX_HEIGHT = 60;
import { T, FONTS } from "../theme";
import { RATING_META, RATING_ORDER, countRatings, isCl1Pass } from "../data/ratingMeta";
import { normalizeEvidence } from "../utils/evidence";

const VerdictHeader = ({ proc, results, fileName, date, cl1Pass, counts, totalBps, viewingHistory, exporting, onExportPdf, onExportTxt }) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 20,
    marginBottom: 28,
  }}>
    <div style={{ flex: "1 1 300px" }}>
      <div style={{
        fontFamily: FONTS.mono,
        fontSize: 10,
        letterSpacing: "0.15em",
        color: T.textLo,
        textTransform: "uppercase",
        marginBottom: 10,
        fontWeight: 700,
      }}>Capability Level 1 · 평가 결과</div>
      <h3 style={{
        fontFamily: FONTS.sans,
        fontSize: 42,
        fontWeight: 700,
        letterSpacing: "-0.035em",
        margin: "0 0 12px 0",
        lineHeight: 1.05,
        color: cl1Pass ? T.ok : T.err,
      }}>
        {cl1Pass ? "적합 (Conformant)" : "갭 발견 (Gap Detected)"}
        <span style={{
          fontSize: 18,
          marginLeft: 12,
          fontWeight: 400,
          color: T.textMd,
          letterSpacing: "-0.01em",
        }}>
          · {totalBps - (counts.N||0) - (counts.P||0)}/{totalBps} BP가 L 이상
        </span>
      </h3>
      <p style={{
        fontSize: 14,
        color: T.textMd,
        lineHeight: 1.6,
        maxWidth: 580,
        margin: 0,
        fontWeight: 400,
      }}>
        {results.summary}
      </p>
      <div style={{
        fontFamily: FONTS.mono,
        fontSize: 10,
        color: T.textLo,
        marginTop: 12,
        letterSpacing: "0.05em",
      }}>
        {proc.id} · {fileName || "—"} · {date.toLocaleString("ko-KR")}
        {viewingHistory && (
          <span style={{ color: T.warm, marginLeft: 8 }}>· 이력 열람</span>
        )}
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-html2canvas-ignore="true">
      <button
        onClick={onExportPdf}
        disabled={exporting}
        style={{
          background: T.accent,
          color: T.onAccent,
          border: "none",
          padding: "12px 22px",
          fontFamily: FONTS.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: exporting ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 700,
          borderRadius: 3,
          opacity: exporting ? 0.6 : 1,
        }}
      >
        {exporting ? <Loader2 size={13} className="anim-spin" /> : <FileDown size={13} />}
        {exporting ? "생성 중" : "PDF 내보내기"}
      </button>
      <button
        onClick={onExportTxt}
        style={{
          background: "transparent",
          color: T.textMd,
          border: `1px solid ${T.borderM}`,
          padding: "8px 22px",
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 3,
        }}
      >
        <Download size={11} /> 텍스트
      </button>
    </div>
  </div>
);

const RatingCountsGrid = ({ counts, totalBps }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 30 }}>
    {RATING_ORDER.map((k) => {
      const m = RATING_META[k];
      const c = counts[k] || 0;
      const pct = totalBps ? (c / totalBps * 100) : 0;
      return (
        <div key={k} style={{
          background: m.bg,
          color: m.fg,
          padding: "10px 18px",
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${m.bar}33`,
          borderRadius: 4,
        }}>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            opacity: 0.85,
            letterSpacing: "0.15em",
            fontWeight: 600,
          }}>{k}  ·  {m.label.toUpperCase()}</div>
          <div style={{
            fontFamily: FONTS.sans,
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1,
            marginTop: 5,
            letterSpacing: "-0.03em",
          }}>{c}</div>
          <div style={{
            fontSize: 10,
            opacity: 0.7,
            marginTop: 3,
            fontFamily: FONTS.mono,
          }}>{pct.toFixed(0)}%  ·  {m.range}</div>
        </div>
      );
    })}
  </div>
);

const InsightsPair = ({ strengths, gaps }) => {
  if (!strengths && !gaps) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 30 }}>
      {strengths && (
        <div style={{ padding: "16px 20px", background: "#ECFDF5", border: `1px solid #A7F3D0`, borderLeft: `3px solid ${T.ok}`, borderRadius: "0 4px 4px 0" }}>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: T.ok,
            letterSpacing: "0.15em",
            marginBottom: 6,
            fontWeight: 700,
          }}>◆ 강점</div>
          <div style={{ fontSize: 13, color: T.textHi, lineHeight: 1.55 }}>{strengths}</div>
        </div>
      )}
      {gaps && (
        <div style={{ padding: "16px 20px", background: "#FEF2F2", border: `1px solid #FECACA`, borderLeft: `3px solid ${T.err}`, borderRadius: "0 4px 4px 0" }}>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: T.err,
            letterSpacing: "0.15em",
            marginBottom: 6,
            fontWeight: 700,
          }}>◆ Finding</div>
          <div style={{ fontSize: 13, color: T.textHi, lineHeight: 1.55 }}>{gaps}</div>
        </div>
      )}
    </div>
  );
};

const EvidenceQuote = ({ quote }) => {
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = quote.length > QUOTE_PREVIEW_CHARS;
  const collapsed = needsCollapse && !expanded;
  return (
    <>
      <div
        data-evidence-quote
        data-collapsed={collapsed ? "true" : "false"}
        style={{
          fontSize: 12,
          color: T.textMd,
          lineHeight: 1.55,
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
          minWidth: 0,
          maxWidth: "100%",
          border: `1px solid ${T.borderL}`,
          borderRadius: 3,
          padding: "6px 10px",
          background: "#FAFBFC",
          maxHeight: collapsed ? QUOTE_COLLAPSED_MAX_HEIGHT : "none",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {quote}
        {collapsed && (
          <div
            data-html2canvas-ignore="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 22,
              background: "linear-gradient(to bottom, rgba(250,251,252,0), #FAFBFC 80%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          data-html2canvas-ignore="true"
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            padding: "2px 8px",
            background: "transparent",
            border: `1px solid ${T.borderM}`,
            borderRadius: 3,
            color: T.accent,
            fontFamily: FONTS.mono,
            fontSize: 9.5,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {expanded ? "접기" : "더 보기"}
        </button>
      )}
    </>
  );
};

const EvidenceList = ({ items }) => {
  if (!items.length) {
    return (
      <div style={{ fontSize: 11.5, color: T.textLo, fontStyle: "italic" }}>
        제시된 증거 없음
      </div>
    );
  }
  return (
    <div
      data-evidence-scroll
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      {items.map((ev, i) => (
        <div key={i} style={{
          background: T.surface,
          border: `1px solid ${T.borderL}`,
          borderLeft: `2px solid ${T.accent}`,
          borderRadius: 3,
          padding: "8px 12px",
          minWidth: 0,
          maxWidth: "100%",
        }}>
          {ev.location && (
            <div style={{
              display: "inline-flex",
              alignItems: "flex-start",
              gap: 5,
              padding: "2px 8px",
              background: T.accentSoft,
              border: `1px solid ${T.accent}66`,
              borderRadius: 3,
              fontFamily: FONTS.mono,
              fontSize: 9.5,
              color: T.accent,
              fontWeight: 600,
              letterSpacing: "0.04em",
              marginBottom: ev.quote ? 6 : 0,
              maxWidth: "100%",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}>
              <MapPin size={10} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                {ev.location}
              </span>
            </div>
          )}
          {ev.quote && <EvidenceQuote quote={ev.quote} />}
        </div>
      ))}
    </div>
  );
};

const FINDING_TYPE_META = {
  weakness: { label: "약점 (WEAKNESS)", bg: "#FEF2F2", border: "#FECACA", bar: T.err, fg: T.err },
  strength: { label: "강점 (STRENGTH)", bg: "#ECFDF5", border: "#A7F3D0", bar: T.ok, fg: T.ok },
  observation: { label: "관찰 (OBSERVATION)", bg: "#F4F6F8", border: "#D4D4D8", bar: T.textLo, fg: T.textMd },
};

// BGB Rating Rule 인용은 형식이 [<scope>.RL.<n>] 이다 (예: [MAN.3.RL.8]).
// 근거 증적에는 현재 평가 중인 프로세스 영역(processId, 예: "MAN.3")에 해당하는
// 규칙만 노출한다 — 타 프로세스(GEN/DEX/APA 등)에서 교차 참조된 규칙은 평가자의
// 초점을 흐리므로 제외한다. processId 가 없으면(레거시 호출) 필터하지 않는다.
const scopeBgbRefs = (bgbRL, processId) => {
  if (!Array.isArray(bgbRL)) return [];
  if (!processId) return bgbRL;
  const prefix = `[${processId}.RL.`;
  return bgbRL.filter((r) => typeof r === "string" && r.startsWith(prefix));
};

const StandardRefChips = ({ refs, processId }) => {
  if (!refs) return null;
  // ISO 근거(refs.iso)는 BP 평가에서 제외한다 (요청): PAM·BGB 만 노출.
  const all = [
    ...(refs.pam ?? []).map((r) => ({ kind: "PAM", text: r })),
    ...(refs.pamNote ?? []).map((r) => ({ kind: "Note", text: r })),
    ...scopeBgbRefs(refs.bgbRL, processId).map((r) => ({ kind: "BGB", text: r })),
  ];
  if (all.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
      {all.map((r, i) => (
        <span
          key={`${r.kind}-${i}-${r.text}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "#0A0A0C",
            color: "#FFFFFF",
            border: "1px solid #0A0A0C",
            borderRadius: 3,
            padding: "2px 7px",
            fontFamily: FONTS.mono,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.04em",
            maxWidth: "100%",
            wordBreak: "break-all",
            whiteSpace: "normal",
          }}
        >
          <span style={{ opacity: 0.7 }}>{r.kind}</span>
          <span>{r.text}</span>
        </span>
      ))}
    </div>
  );
};

const FindingSection = ({ label, body, accent }) => (
  <div style={{ marginTop: 8 }}>
    <div style={{
      fontFamily: FONTS.mono,
      fontSize: 9,
      letterSpacing: "0.12em",
      color: accent ?? T.textDim,
      fontWeight: 700,
      marginBottom: 3,
      textTransform: "uppercase",
    }}>{label}</div>
    <div style={{ fontSize: 12.5, color: T.textHi, lineHeight: 1.55, wordBreak: "break-word", overflowWrap: "anywhere" }}>
      {body}
    </div>
  </div>
);

// 증적(quote) 원문을 그대로 덤프하지 않고, Finding 의 서술 슬롯
// (situation → gap → impact) 을 한 문단으로 엮어 "무엇을 발견했는지" 를 진술한다.
// 서술 슬롯이 모두 비어 있는 레거시/덤프형 데이터는 evidence quote 로 폴백한다.
const buildFindingNarrative = (finding) => {
  const parts = [finding.situation, finding.gap, finding.impact]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return normalizeEvidence(finding.evidence ?? [])
    .map((e) => e.quote)
    .filter(Boolean)
    .join(" ");
};

const FindingCard = ({ finding, processId }) => {
  const meta = FINDING_TYPE_META[finding.type] || FINDING_TYPE_META.observation;
  const loc = finding.location ?? {};
  const ri = finding.ratingImpact ?? {};
  const narrative = buildFindingNarrative(finding);
  return (
    <div
      data-finding-card
      data-finding-type={finding.type}
      style={{
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderLeft: `3px solid ${meta.bar}`,
        borderRadius: 4,
        padding: "10px 14px 12px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{
          fontFamily: FONTS.mono,
          fontSize: 9.5,
          letterSpacing: "0.12em",
          color: meta.fg,
          fontWeight: 700,
          textTransform: "uppercase",
        }}>◆ {meta.label}</span>
        {finding.id && (
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: T.textLo, letterSpacing: "0.04em" }}>
            {finding.id}
          </span>
        )}
      </div>
      {narrative && (
        <FindingSection label="Finding" body={narrative} accent={meta.fg} />
      )}
      {/* 권고(RECOMMENDATION) 섹션은 BP 평가 결과에서 제외한다 (요청). */}
      {(loc.found || loc.recommended) && (
        <FindingSection
          label="위치 (LOCATION)"
          accent={T.textDim}
          body={
            <span>
              {loc.found && <span>발견: <strong>{loc.found}</strong></span>}
              {loc.found && loc.recommended && <span style={{ color: T.textLo }}> · </span>}
              {loc.recommended && <span>권고 위치: <strong>{loc.recommended}</strong></span>}
            </span>
          }
        />
      )}
      <StandardRefChips refs={finding.standardReferences} processId={processId} />
      {(ri.ruleApplied || ri.scoreDelta) && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px dashed ${meta.border}`,
          fontFamily: FONTS.mono,
          fontSize: 9.5,
          color: T.textDim,
          letterSpacing: "0.02em",
          lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 700, color: T.textMd }}>Rating Rule · </span>
          {ri.ruleId && <span>{ri.ruleId}</span>}
          {typeof ri.scoreDelta === "number" && ri.scoreDelta !== 0 && (
            <span style={{ marginLeft: 6, color: ri.scoreDelta < 0 ? T.err : T.ok }}>
              Δ {ri.scoreDelta > 0 ? "+" : ""}{ri.scoreDelta}%
            </span>
          )}
          {ri.reason && (
            <div style={{ color: T.textMd, marginTop: 2 }}>{ri.reason}</div>
          )}
        </div>
      )}
    </div>
  );
};


const BpRatingRow = ({ proc, bp, rating }) => {
  const m = RATING_META[rating.rating] || RATING_META.N;
  const findings = Array.isArray(rating.findings) ? rating.findings : [];
  const evidenceItems = normalizeEvidence(rating.evidence);
  const hasFindings = findings.length > 0;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "60px minmax(0, 1fr)",
      background: T.surface2,
      border: `1px solid ${T.borderL}`,
      borderRadius: 4,
      overflow: "hidden",
    }}>
      <div style={{
        background: m.bg,
        color: m.fg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px 0",
        borderRight: `1px solid ${m.bar}40`,
      }}>
        <div style={{
          fontFamily: FONTS.sans,
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}>{rating.rating}</div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 8,
          opacity: 0.8,
          marginTop: 4,
        }}>{m.range}</div>
      </div>
      <div style={{ padding: "14px 18px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap", minWidth: 0 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600, color: T.accent, flexShrink: 0 }}>
            {proc.id}.{bp.id}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textHi, letterSpacing: "-0.005em", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {bp.title}
          </span>
        </div>
        {hasFindings ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {findings.map((f, i) => (
              <FindingCard key={f.id || `${bp.id}-f-${i}`} finding={f} processId={proc.id} />
            ))}
            <StandardRefChips refs={rating.standardReferences} processId={proc.id} />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: T.textMd, lineHeight: 1.6, marginBottom: 10, wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>
              <strong style={{ color: T.err, fontWeight: 600 }}>약점 · </strong>{rating.rationale}
            </div>
            <div style={{
              fontFamily: FONTS.mono,
              fontSize: 9,
              letterSpacing: "0.12em",
              color: T.textDim,
              fontWeight: 700,
              marginBottom: 6,
            }}>약점 (WEAKNESS)</div>
            <EvidenceList items={evidenceItems} />
            <StandardRefChips refs={rating.standardReferences} processId={proc.id} />
          </>
        )}
      </div>
    </div>
  );
};

// forwardRef: PDF 내보내기가 이 section의 DOM 노드를 html2canvas로 복제하기 위해 필요.
const HarnessVerdictBlock = ({ verdict }) => {
  if (!verdict) return null;
  const pa11 = verdict.pas?.find((p) => p.paId === "PA 1.1");
  const clColor = verdict.capabilityLevel >= 1 ? T.ok : T.err;
  return (
    <div style={{
      margin: "8px 0 20px",
      padding: "14px 18px",
      background: T.surface2,
      border: `1px solid ${T.borderL}`,
      borderRadius: 5,
      display: "flex",
      flexWrap: "wrap",
      gap: 18,
      alignItems: "center",
    }} data-html2canvas-ignore="true">
      <div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: T.textLo, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 3 }}>Harness CL · 능력 수준</div>
        <div style={{ color: clColor, fontWeight: 700, fontSize: 18 }}>CL{verdict.capabilityLevel}</div>
      </div>
      {pa11 && (
        <div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: T.textLo, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 3 }}>PA 1.1 · 수행 속성</div>
          <div style={{ color: T.textHi, fontWeight: 700, fontSize: 16, fontFamily: FONTS.mono }}>{pa11.rating}
            <span style={{ fontSize: 10, color: T.textLo, marginLeft: 6 }}>→ {pa11.collapsed}</span>
          </div>
        </div>
      )}
      {verdict.meta?.pamSection && (
        <div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: T.textLo, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 3 }}>PAM 섹션</div>
          <div style={{ color: T.textHi, fontSize: 13, fontFamily: FONTS.mono }}>§{verdict.meta.pamSection}</div>
        </div>
      )}
      <div style={{ flex: 1, textAlign: "right", color: T.textLo, fontSize: 11 }}>
        {verdict.capabilityLevelReason}
      </div>
    </div>
  );
};

// exportReport.js는 data-pdf-export-root 속성으로 이 섹션을 찾으므로 해당 속성을 유지해야 함.
export const VerdictCard = forwardRef(function VerdictCard(
  { proc, results, fileName, date, viewingHistory, exporting, onExportPdf, onExportTxt },
  ref
) {
  const counts = countRatings(results.ratings);
  const totalBps = proc.bps.length;
  const cl1Pass = isCl1Pass(results.ratings);

  return (
    <section ref={ref} data-pdf-export-root="true" style={{
      background: T.surface,
      border: `1px solid ${T.borderL}`,
      borderRadius: 6,
      padding: "36px 36px 40px",
      position: "relative",
    }}>
      <div style={{
        position: "absolute",
        top: -11,
        left: 26,
        background: cl1Pass ? "#ECFDF5" : "#FEF2F2",
        color: cl1Pass ? T.ok : T.err,
        border: `1px solid ${cl1Pass ? T.ok : T.err}`,
        padding: "4px 14px",
        fontFamily: FONTS.mono,
        fontSize: 11,
        letterSpacing: "0.15em",
        fontWeight: 700,
        borderRadius: 3,
      }}>§ 03 · NPLF 평가 결과</div>

      <VerdictHeader
        proc={proc}
        results={results}
        fileName={fileName}
        date={date}
        cl1Pass={cl1Pass}
        counts={counts}
        totalBps={totalBps}
        viewingHistory={viewingHistory}
        exporting={exporting}
        onExportPdf={onExportPdf}
        onExportTxt={onExportTxt}
      />

      <RatingCountsGrid counts={counts} totalBps={totalBps} />

      <HarnessVerdictBlock verdict={results._verdict} />

      <InsightsPair strengths={results.strengths} gaps={results.gaps} />

      <div style={{
        fontFamily: FONTS.mono,
        fontSize: 18,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: T.accent,
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: `1px solid ${T.borderL}`,
        fontWeight: 700,
      }}>BP별 평가 (BP-level Ratings)</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {proc.bps.map((bp) => {
          const rating = results.ratings.find((x) => x.bp === bp.id)
            || { rating: "N", rationale: "응답 누락", evidence: "없음" };
          return <BpRatingRow key={bp.id} proc={proc} bp={bp} rating={rating} />;
        })}
      </div>
    </section>
  );
});
