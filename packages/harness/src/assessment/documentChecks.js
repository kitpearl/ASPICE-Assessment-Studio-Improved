// 문서 내부 일관성 검사 (프로세스 비종속, 순수 함수). 입력은 텍스트 블록(표 행 포함) 목록이다.
// 각 검사는 "의심 사항(finding candidate)"을 돌려줄 뿐이며 BP 등급을 직접 바꾸지 않는다.

/**
 * 수치 불일치: "전체 N <단위>" 가 선언된 문서에서, 같은 단위를 언급하는 행의 "P%" 와 "M건/개" 가 맞지 않는 경우.
 * 예) 전체 15 SVT 중 9건은 60% 인데 50% 로 표기.
 * @param {Array<{text: string, locator?: any}>} blocks
 * @param {{tolerancePct?: number}} [opts]
 */
export function scanRatioInconsistencies(blocks, { tolerancePct = 2 } = {}) {
  const totals = new Map(); // unit -> {total, locator}
  for (const b of blocks) {
    for (const m of String(b.text).matchAll(/전체\s*(\d+)\s*([A-Za-z][A-Za-z0-9]*|[가-힣]+)/g)) {
      totals.set(m[2], { total: Number(m[1]), locator: b.locator });
    }
  }
  const out = [];
  for (const b of blocks) {
    const text = String(b.text);
    for (const [unit, { total }] of totals) {
      if (!text.includes(unit)) continue;
      const pct = text.match(/(\d+(?:\.\d+)?)\s*%/);
      const cnt = text.match(/(\d+)\s*(?:건|개)/);
      if (!pct || !cnt) continue;
      const part = Number(cnt[1]);
      if (part > total) continue;
      const stated = Number(pct[1]);
      const actual = (part / total) * 100;
      if (Math.abs(actual - stated) > tolerancePct) {
        out.push({
          kind: "RATIO_MISMATCH",
          unit,
          stated: `${stated}%`,
          computed: `${part}/${total} = ${actual.toFixed(1)}%`,
          locator: b.locator,
          quote: text.trim().slice(0, 200),
        });
      }
    }
  }
  return out;
}

/**
 * 상태 모델 일관성: 상태 정의표에 없는 상태가 전이 설명(→ X)에 쓰이는 경우.
 * 상태 정의 행은 "N. State" 형식(예: "7. Closed")을 쓴다.
 */
export function scanStateModel(blocks) {
  const defined = [];
  for (const b of blocks) {
    const m = String(b.text).trim().match(/^\d+\.\s*([A-Za-z][A-Za-z ]*[A-Za-z])\s*$/);
    if (m) defined.push(m[1].trim());
  }
  if (defined.length < 3) return [];
  const lower = new Set(defined.map((s) => s.toLowerCase()));
  const used = new Map();
  for (const b of blocks) {
    // 상태 전이 설명 블록만 본다: "→ X" 로 시작하거나 화살표 앞에 정의된 상태명이 있는 경우.
    // ("Polarion 자동 → CCB 위원 전체" 같은 일반 화살표는 상태 전이가 아니다)
    const text = String(b.text);
    const beforeArrow = text.split("→")[0].toLowerCase();
    if (!(text.trim().startsWith("→") || [...lower].some((s) => beforeArrow.includes(s)))) continue;
    for (const m of text.matchAll(/→\s*([A-Z][A-Za-z]*(?:\s+[A-Za-z]+){0,4})/g)) {
      // 영문 대문자로 시작하는 단어열에서, 정의된 상태명 길이만큼 소문자 한정어(with 등) 포함해 읽는다.
      const name = m[1].trim().replace(/\s+(또는|및|\(|→).*$/, "");
      if (!used.has(name)) used.set(name, b.locator);
    }
  }
  const out = [];
  for (const [name, locator] of used) {
    if (lower.has(name.toLowerCase())) continue;
    const base = defined.find((d) => name.toLowerCase().startsWith(d.toLowerCase() + " "));
    out.push({
      kind: base ? "STATE_VARIANT_NOT_DEFINED" : "STATE_NOT_DEFINED",
      state: name,
      relatedDefinedState: base ?? null,
      definedStates: defined,
      locator,
    });
  }
  return out;
}

/**
 * 결정 결과 처리 누락: "A / B / C" 로 열거한 결정 결과 중, 열거 행 밖에서 한 번도 다뤄지지 않는 결과.
 * 예) Approve / Reject / Defer 를 열거하지만 Defer 이후 상태 전이·재검토·추적이 정의되지 않음.
 * @param {string[]} outcomes 검사할 결정 결과 표면형 목록(예: ["Approve","Reject","Defer"])
 * @param {string[]} [aliases] outcome 별 추가 표현 (key = outcome)
 */
export function scanDecisionOutcomeHandling(blocks, outcomes, aliases = {}) {
  const forms = (o) => [o, ...(aliases[o] ?? [])].map((s) => s.toLowerCase());
  const isEnumLine = (t) => t.includes("/") && outcomes.filter((o) => forms(o).some((f) => t.toLowerCase().includes(f))).length >= 2;
  const out = [];
  for (const o of outcomes) {
    const mentions = blocks.filter((b) => forms(o).some((f) => String(b.text).toLowerCase().includes(f)));
    if (!mentions.length) continue; // 열거 자체가 없음
    const enumOnly = mentions.every((b) => isEnumLine(String(b.text)));
    if (enumOnly) {
      out.push({
        kind: "OUTCOME_HANDLING_UNDEFINED",
        outcome: o,
        mentionedAt: mentions.map((b) => b.locator),
        rationale: `'${o}' 는 결정 결과로 열거되지만 열거 외 위치에서 후속 상태·재검토·추적이 정의되지 않았다.`,
      });
    }
  }
  return out;
}

/**
 * 문서 자체 BP 구성 vs 공식 PAM BP 구성 차이.
 * 문서에서 `<PROC>.BPn` 참조를 모아 개수를 비교한다. 의미 대응은 사람/LLM 판단이 필요하므로 후보만 돌려준다.
 */
export function compareBpMapping(blocks, processId, officialBpIds) {
  const re = new RegExp(`${processId.replace(".", "\\.")}\\.BP(\\d+)`, "g");
  const docBps = new Set();
  for (const b of blocks) for (const m of String(b.text).matchAll(re)) docBps.add(`BP${m[1]}`);
  const official = new Set(officialBpIds);
  const extra = [...docBps].filter((b) => !official.has(b)).sort();
  return {
    documentBpCount: docBps.size,
    officialBpCount: official.size,
    documentBps: [...docBps].sort(),
    notInOfficial: extra,
    mismatch: docBps.size !== official.size,
    note: docBps.size && docBps.size !== official.size
      ? "문서 자체 BP 번호 체계가 공식 PAM 과 다르다. BP 번호가 아니라 의미 기반으로 대응시켜야 한다."
      : "",
  };
}
