import { ListChecks, Target, BookOpen } from "lucide-react";
import { T, FONTS, SECTION_CONTAINER_STYLE } from "../theme";
import { Stat } from "./Stat";
import { SectionBadge } from "./SectionBadge";

export const ProcessCard = ({ proc }) => (
  <section style={SECTION_CONTAINER_STYLE}>
    <SectionBadge>{proc.id}</SectionBadge>

    <h2 style={{
      fontFamily: FONTS.sans,
      fontSize: 30,
      fontWeight: 700,
      margin: "10px 0 8px 0",
      letterSpacing: "-0.025em",
      color: T.textHi,
    }}>{proc.name}</h2>
    {proc.nameEn && (
      <div style={{
        fontFamily: FONTS.mono,
        fontSize: 11,
        color: T.textLo,
        letterSpacing: "0.04em",
        margin: "-4px 0 12px 0",
      }}>{proc.nameEn}</div>
    )}

    <div style={{ display: "flex", gap: 22, marginBottom: 22, flexWrap: "wrap" }}>
      <Stat icon={<ListChecks size={13}/>} label="Base Practices" value={proc.bps.length} />
      <Stat icon={<Target size={13}/>} label="Outcomes" value={proc.outcomes.length} />
      <Stat icon={<BookOpen size={13}/>} label="Guideline rules" value={proc.guidelineRuleCount ?? 0} />
    </div>

    <div style={{
      fontFamily: FONTS.sans,
      fontSize: 14.5,
      fontWeight: 400,
      color: T.textMd,
      lineHeight: 1.6,
      borderLeft: `2px solid ${T.accent}`,
      paddingLeft: 16,
      marginBottom: 20,
      fontStyle: "italic",
    }}>
      &quot;{proc.purpose}&quot;
    </div>

    <details>
      <summary style={{
        cursor: "pointer",
        fontFamily: FONTS.mono,
        fontSize: 10,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: T.accent,
        marginBottom: 10,
        fontWeight: 600,
      }}>▾ Base Practices ({proc.bps.length})</summary>
      <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
        {proc.bps.map((bp) => (
          <li key={bp.id} style={{
            padding: "12px 0",
            borderBottom: `1px dashed ${T.borderL}`,
            fontSize: 13,
            lineHeight: 1.55,
            color: T.textMd,
          }}>
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              color: T.accent,
              marginRight: 10,
            }}>{bp.id}</span>
            <strong style={{ color: T.textHi, fontWeight: 600 }}>{bp.title}.</strong>{" "}
            {bp.titleEn && (
              <span style={{ color: T.textDim, fontSize: 11.5, marginRight: 6 }}>{bp.titleEn}</span>
            )}
            <span>{bp.description}</span>
            {bp.notes?.length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary style={{
                  cursor: "pointer",
                  fontFamily: FONTS.mono,
                  fontSize: 9.5,
                  letterSpacing: "0.1em",
                  color: T.textLo,
                  fontWeight: 600,
                }}>NOTES ({bp.notes.length})</summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: T.textLo, lineHeight: 1.55 }}>
                  {bp.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </details>
  </section>
);
