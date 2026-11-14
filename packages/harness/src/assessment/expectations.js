// 공식 기대사항 정규화(파이프라인 1단계)와 증거 후보 검색(2단계). 모든 프로세스에 동일하게 적용된다.
import { extractBilingualKeywords } from "../io/keywords.js";
import { termVariants, conceptsIn, isFunctionWord } from "./semantics.js";
import { classifyBlock } from "./evidenceReasoning.js";

const splitKo = (s) => String(s ?? "").split(/(?<=[다.])\s+(?=[가-힣A-Z“"])/).map((x) => x.trim()).filter(Boolean);
const splitEn = (s) => String(s ?? "").split(/(?<=[.])\s+(?=[A-Z“"])/).map((x) => x.trim()).filter(Boolean);

/**
 * PAM BP 의 description 을 문장 단위 기대사항으로 정규화한다. NOTE 는 기대사항이 아니라 참고(notes)로 분리한다.
 * @param {{id: string, pamSection?: string, basePractices: any[]}} processSpec
 */
export function normalizeExpectations(processSpec) {
  const out = [];
  for (const bp of processSpec.basePractices ?? []) {
    const en = String(bp.descriptionEn ?? "");
    const noteIdx = en.search(/NOTE\s*\d+\s*:/);
    const enMain = noteIdx >= 0 ? en.slice(0, noteIdx) : en;
    const notes = noteIdx >= 0 ? en.slice(noteIdx).split(/(?=NOTE\s*\d+\s*:)/).map((n) => n.trim()).filter(Boolean) : [];
    const ko = splitKo(bp.description);
    const enS = splitEn(enMain);
    const aligned = ko.length === enS.length;
    const citation = bp.pamCitation ?? `PAM 4.1 ${processSpec.pamSection ?? ""} ${processSpec.id}.${bp.id}`.trim();
    ko.forEach((sentence, i) => {
      out.push({
        expectationId: `${processSpec.id}.${bp.id}.E${i + 1}`,
        processId: processSpec.id,
        bpId: bp.id,
        normativeReference: citation,
        textKo: sentence,
        textEn: aligned ? enS[i] : enMain,
        enAligned: aligned,
        concepts: [...conceptsIn(`${sentence} ${aligned ? enS[i] : enMain}`)],
        notes,
      });
    });
    if (!ko.length) {
      out.push({
        expectationId: `${processSpec.id}.${bp.id}.E1`,
        processId: processSpec.id,
        bpId: bp.id,
        normativeReference: citation,
        textKo: bp.title ?? "",
        textEn: bp.titleEn ?? "",
        enAligned: false,
        concepts: [],
        notes,
      });
    }
  }
  return out;
}

/**
 * 지적 문장을 같은 BP 의 기대사항에 연결한다(후보 매핑). 기대사항 키워드 그룹(동의어 포함)이 2개 이상 겹칠 때만 연결하고,
 * 모호하면 null 을 돌려준다. 이 매핑은 충돌 "탐지"에만 쓰이며 결함 판정이 아니다.
 */
export function bestExpectationFor(text, expectations) {
  const t = String(text ?? "").toLowerCase();
  let best = null;
  let tie = false;
  for (const ex of expectations ?? []) {
    const { ko, en } = extractBilingualKeywords({ ko: ex.textKo, en: ex.textEn ?? "" }, 10);
    const groups = [...ko, ...en].filter((k) => !isFunctionWord(k)).map((k) => termVariants(k));
    const hits = groups.filter((vs) => vs.some((v) => t.includes(v))).length;
    if (hits < 2) continue;
    if (!best || hits > best.hits) { best = { id: ex.expectationId, hits }; tie = false; }
    else if (hits === best.hits) tie = true;
  }
  return best && !tie ? best.id : null;
}

/**
 * 증거 후보 검색: 본문·표·부록 전체 블록에서 기대사항과 관련된 후보를 찾는다.
 * 점수는 "검색 순위"일 뿐 충족 판단이 아니다. 목차·매핑표·자기선언은 후보에 포함하되 blockKind 로 표시한다.
 * @param {{textKo: string, textEn?: string}} expectation
 * @param {Array<{text: string, locator?: any}>} blocks
 */
export function searchEvidenceCandidates(expectation, blocks, { topN = 8 } = {}) {
  const { ko, en } = extractBilingualKeywords({ ko: expectation.textKo, en: expectation.textEn ?? "" }, 10);
  const groups = [...ko, ...en].filter((k) => !isFunctionWord(k)).map((k) => termVariants(k));
  const ranked = [];
  for (const block of blocks ?? []) {
    const t = String(block.text ?? "").toLowerCase();
    const matched = [];
    groups.forEach((variants) => {
      const hit = variants.find((v) => t.includes(v));
      if (hit) matched.push(variants[0]);
    });
    if (!matched.length) continue;
    ranked.push({ block, blockKind: classifyBlock(block.text), matchedKeywords: matched, searchScore: matched.length / Math.max(groups.length, 1) });
  }
  const weight = (r) => (r.blockKind === "BODY" ? 1 : 0.4);
  ranked.sort((a, b) => b.searchScore * weight(b) - a.searchScore * weight(a));
  return ranked.slice(0, topN);
}
