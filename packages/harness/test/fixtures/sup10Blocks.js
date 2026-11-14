// 실제 문서 발췌: (문서번호)BSD_SUP10_CR_Plan_26.docx (sha256 0a0eeb6a…, 2026-11-14 추출). 표 셀은 한 줄씩 블록으로 만든다.
// 이 파일의 데이터는 REAL_DOC_EXCERPT 이다. 합성 사례는 각 테스트 안에서 별도로 만들며 "[synthetic]" 로 표시한다.
const b = (section, text, extra = {}) => ({ documentId: "DOC-SUP10-PLAN", text, locator: { section, ...extra } });

export const REAL_BODY = [
  b("4.1", "CR 제안 | 제안자 (전 인력) → Polarion ALM \"New Change Request\"", { table: "CR 등록 절차", cell: "Step 1" }),
  b("4.1", "ID 자동 부여 | Polarion ALM 자동 (BSD-CR-NNNN, 4자리 일련번호)", { table: "CR 등록 절차", cell: "Step 2" }),
  b("4.1", "통보 | Polarion 자동 → CCB 위원 전체", { table: "CR 등록 절차", cell: "Step 5" }),
  b("6.2", "통보 | 전 관계자 자동 통보 (Polarion 알림)", { table: "CCB 심의 절차", cell: "Step 7" }),
  b("10.2", "CR 종결 | Polarion 상태 → Closed + 통보", { table: "베이스라인 후 변경 절차", cell: "Step 9" }),
  b("5.1", "일정 (Schedule) | Critical Path 영향, 마일스톤 지연 일수", { table: "5개 영향 영역" }),
  b("5.1", "공수 (Effort) | 추가 공수 (PERT TE 대비 %) | WP별 공수 재산정 (BSD-FEAS-001 §7 PERT 방식)", { table: "5개 영향 영역" }),
];

export const REAL_STATE_BLOCKS = [
  ...["1. Submitted", "2. Under Review", "3. Approved", "4. Rejected", "5. In Implementation", "6. Under Verification", "7. Closed"].map((t) => b("4.3", t)),
  b("4.3", "→ Under Review (QA Lead 분류)"),
  b("4.3", "→ Approved 또는 Rejected"),
  b("4.3", "→ In Implementation"),
  b("4.3", "→ Under Verification (구현 완료)"),
  b("4.3", "→ Closed 또는 → In Implementation (재작업)"),
  b("7.2", "→ Closed (베이스라인 갱신 후 종결)"),
  b("7.2", "→ Closed with Risk Acceptance (후속 모니터링)"),
  b("7.2", "→ In Implementation (Step 1 반복)"),
];

export const REAL_DECISION_BLOCKS = [
  b("5.3", "영향도 종합 등급 + CCB 결정 권장 (Approve / Reject / Defer)"),
  b("6.2", "Approve / Reject / Defer + 사유 + 회의록 작성 (24h 내)"),
  b("6.2", "Approved → In Implementation 또는 Rejected (종결)"),
  b("4.3", "CCB 거절, 사유 기록"),
];

export const REAL_RATIO_BLOCKS = [
  b("5.2", "전체 SVT 50% (Critical/High 우선순위 9건)", { table: "종합 영향도 4등급", cell: "H (High)" }),
  b("5.2", "전체 15 SVT 재실행 + Phase 1~4 재수행", { table: "종합 영향도 4등급", cell: "F (Full)" }),
];

export const REAL_LISTS = {
  impact_areas: ["일정 (Schedule)", "공수 (Effort)", "품질 (Quality)", "안전 (Safety / ASIL)", "외부 인터페이스"],
  ccb_roles: ["CCB Chair (의장)", "CCB 위원 - 기술", "CCB 위원 - 시스템", "CCB 위원 - 품질", "CCB 위원 - 안전", "CCB 위원 - 형상", "외부 검토자 (수시)"],
};

export const REAL_BP_MAPPING_BLOCKS = Array.from({ length: 8 }, (_, i) => b("2.1", `SUP.10.BP${i + 1}`));
