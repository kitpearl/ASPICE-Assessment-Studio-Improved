import { useState } from "react";
import { T, FONTS } from "../theme";
import {
  formatPam,
  formatGuideline,
  findCappedRule,
  guidelineList,
  referencesToText,
} from "../utils/references";

const chipBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "2px 8px",
  borderRadius: 3,
  fontFamily: FONTS.mono,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.02em",
  lineHeight: 1.5,
  maxWidth: "100%",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
  textAlign: "left",
};

const GuidelineChip = ({ g, capped, open, onToggle }) => {
  const muted = g.displayOnly && !capped;
  const style = {
    ...chipBase,
    cursor: "pointer",
    background: muted ? T.surface3 : capped ? "#FEF2F2" : "#FFFBEB",
    color: muted ? T.textLo : capped ? T.err : T.warm,
    border: `1px solid ${muted ? T.borderM : capped ? T.err : `${T.warm}66`}`,
  };
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} style={style} title={g.summary || ""}>
      <span>{formatGuideline(g)}</span>
      {capped && (
        <span style={{ background: T.err, color: T.onAccent, borderRadius: 2, padding: "0 4px", fontSize: 9 }}>
          적용
        </span>
      )}
      {muted && <span style={{ fontSize: 9, fontWeight: 500 }}>타 프로세스 조건</span>}
    </button>
  );
};

/**
 * 평가 근거 표시. references 가 없으면 아무것도 렌더하지 않는다.
 * compact: 표·보고서용 한 줄 텍스트.
 */
export const ReferenceChips = ({ references, appliedRules, compact = false }) => {
  const [openId, setOpenId] = useState(null);
  if (!references) return null;
  const pamText = formatPam(references.pam);
  const guidelines = guidelineList(references);
  if (!pamText && !guidelines.length) return null;

  if (compact) {
    return (
      <div style={{
        marginTop: 4,
        fontFamily: FONTS.mono,
        fontSize: 9.5,
        color: T.textLo,
        lineHeight: 1.5,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}>
        {referencesToText(references, appliedRules)}
      </div>
    );
  }

  const openRule = guidelines.find((g) => g.id === openId);
  return (
    <div data-reference-chips style={{ marginBottom: 10, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          letterSpacing: "0.12em",
          color: T.textDim,
          fontWeight: 700,
          marginRight: 2,
        }}>근거</span>
        {pamText && (
          <span
            style={{ ...chipBase, background: T.accentSoft, color: T.accent, border: `1px solid ${T.accent}66` }}
            title={references.pam?.title || ""}
          >
            {pamText}
          </span>
        )}
        {guidelines.map((g) => (
          <GuidelineChip
            key={g.id}
            g={g}
            capped={!!findCappedRule(g.id, appliedRules)}
            open={openId === g.id}
            onToggle={() => setOpenId((cur) => (cur === g.id ? null : g.id))}
          />
        ))}
      </div>
      {openRule && (
        <div style={{
          marginTop: 6,
          padding: "6px 10px",
          background: T.surface,
          border: `1px solid ${T.borderL}`,
          borderLeft: `2px solid ${T.warm}`,
          borderRadius: 3,
          fontSize: 11.5,
          color: T.textMd,
          lineHeight: 1.55,
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}>
          {openRule.summary && <div>{openRule.summary}</div>}
          <div style={{ fontFamily: FONTS.mono, fontSize: 9.5, color: T.textLo, marginTop: openRule.summary ? 3 : 0 }}>
            {[openRule.section, openRule.page != null && openRule.page !== "" ? `p.${openRule.page}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferenceChips;
