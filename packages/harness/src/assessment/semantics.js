// 한국어/영어 PAM 문구의 의미 대응 사전 (프로세스 비종속).
// 용도는 두 가지뿐이다: (1) 키워드 증거 후보 탐색 시 동의어 확장, (2) "부재" 주장에 대한 반대 증거 탐색.
// 이 사전만으로 결함을 확정하지 않는다 — 확정은 의미 판단(LLM·심사자)의 몫이다.

/** 요구사항이 아닌 기능어(조사·접속·관형 표현). 키워드/결함 근거로 쓰지 않는다. */
export const FUNCTION_WORDS = new Set([
  "간의", "의해", "의하여", "의한", "용이하도록", "용이하게", "용이한", "위해", "위하여", "위한",
  "통해", "통하여", "인해", "때문", "대해", "대하여", "대한", "따라", "따른", "받는", "받은", "있는", "있도록",
  "경우", "해당", "다음", "각각", "또는", "그리고", "및", "등",
]);

/**
 * 개념 그룹. terms 중 하나라도 본문에 있으면 해당 개념이 관찰된 것으로 본다(후보 단계).
 * distinctFrom: 의미가 비슷해 보이지만 서로의 증거로 인정하면 안 되는 개념.
 */
export const CONCEPTS = {
  initiator: {
    label: "개시자/제안자",
    terms: ["개시자", "제안자", "요청자", "발의자", "등록자", "작성 요청", "initiator", "requester", "originator", "proposer", "submitter", "raised by"],
  },
  closure: {
    label: "종료/종결",
    terms: ["종료", "종결", "닫", "closure", "closed", "close "],
  },
  communication: {
    label: "의사소통/통보",
    terms: ["의사소통", "통보", "알림", "통지", "공유", "전파", "전달", "communicat", "notif", "inform", "announce"],
  },
  unique_id: {
    label: "고유 식별",
    terms: ["고유", "자동 부여", "자동 채번", "채번", "일련번호", "식별자", "unique", "identifier", "id 부여", "id 자동"],
  },
  assignment: {
    label: "배정/지정",
    terms: ["배정", "부여", "지정", "할당", "assign", "allocated"],
  },
  reason: {
    label: "이유/사유",
    terms: ["이유", "사유", "원인", "reason", "rationale"],
  },
  status: {
    label: "상태",
    terms: ["상태", "status", "state"],
  },
  stakeholder: {
    label: "이해관계자/당사자",
    terms: ["이해관계자", "관계자", "관련자", "당사자", "위원", "stakeholder", "relevant part", "affected part"],
  },
  approval: {
    label: "승인",
    terms: ["승인", "결재", "approv", "authoriz"],
  },
  verification: {
    label: "검증/확인",
    terms: ["검증", "확인", "검토", "verif", "confirm", "review"],
  },
  resource_estimate: {
    label: "자원 요구량 추정",
    terms: ["공수", "추정", "자원 요구", "요구 자원", "resource requirement", "effort estimat", "estimate"],
    distinctFrom: ["resource_availability"],
  },
  resource_availability: {
    label: "자원 가용성 확인",
    terms: ["가용성", "가용", "자원 확보", "투입 가능", "여유 자원", "availability", "available resource"],
    distinctFrom: ["resource_estimate"],
  },
  side_effect_pre: {
    label: "사전 부작용 분석",
    terms: ["부작용 분석", "부작용 사전", "사전 부작용", "potential side effect", "side effect analysis"],
    distinctFrom: ["side_effect_post"],
  },
  side_effect_post: {
    label: "사후 부작용 확인",
    terms: ["부작용 없이", "부작용 확인", "회귀 검증", "회귀 시험", "regression"],
    distinctFrom: ["side_effect_pre"],
  },
  defer: {
    label: "보류/연기 결정",
    terms: ["defer", "보류", "연기"],
  },
};

/** 개념의 모든 표면형(소문자). */
function surfaceForms(conceptId) {
  return (CONCEPTS[conceptId]?.terms ?? []).map((t) => t.toLowerCase());
}

/** 한 키워드(예: "개시자")가 속한 개념의 동의어 전체. 속한 개념이 없으면 [kw] 만. */
export function termVariants(kw) {
  const k = String(kw ?? "").toLowerCase();
  if (!k) return [];
  const out = new Set([k]);
  for (const id of Object.keys(CONCEPTS)) {
    const forms = surfaceForms(id);
    if (forms.some((f) => f.trim() === k)) {
      for (const f of forms) out.add(f);
    }
  }
  return [...out];
}

/** 텍스트에서 관찰된 개념 ID 집합. */
export function conceptsIn(text) {
  const t = String(text ?? "").toLowerCase();
  const found = new Set();
  for (const id of Object.keys(CONCEPTS)) {
    if (surfaceForms(id).some((f) => t.includes(f))) found.add(id);
  }
  return found;
}

/** 한 키워드(예: "개시자")가 속한 개념 ID. 없으면 null. */
export function conceptOfTerm(kw) {
  const k = String(kw ?? "").toLowerCase().trim();
  if (!k) return null;
  return Object.keys(CONCEPTS).find((id) => surfaceForms(id).some((f) => f.trim() === k)) ?? null;
}

export const isFunctionWord = (w) => FUNCTION_WORDS.has(String(w ?? "").trim());

/**
 * 개념의 반대 증거 후보를 블록 목록에서 찾는다.
 * @param {string} conceptId
 * @param {Array<{text: string, locator?: any, blockKind?: string}>} blocks
 * @returns {Array<{block: any, term: string}>}
 */
export function findConceptCandidates(conceptId, blocks) {
  const forms = surfaceForms(conceptId);
  const hits = [];
  for (const block of blocks ?? []) {
    const t = String(block.text ?? "").toLowerCase();
    const term = forms.find((f) => t.includes(f));
    if (term) hits.push({ block, term });
  }
  return hits;
}
