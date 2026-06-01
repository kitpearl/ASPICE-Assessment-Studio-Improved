// Korean translations of Automotive SPICE base-practice (BP) and generic-
// practice (GP) titles, used by the project-mode report UIs (ProjectReportCard,
// exportProjectReport) to render the 제목 columns in Korean. The harness verdict
// carries only the English PAM titles, so these maps koreanize on the client.
//
// BP titles are keyed by "<processId>.<bpId>" (e.g. "SUP.1.BP1") because the
// same BP id means different things in different processes. GP titles are
// process-independent and keyed by GP id alone (e.g. "GP 2.1.1").
//
// Mirrors api/_bpTitlesKo.js (server path); keep the two BP maps in sync.

const BP_TITLES_KO = {
  // SYS.2 System Requirements Analysis
  "SYS.2.BP1": "시스템 요구사항 명세",
  "SYS.2.BP2": "시스템 요구사항 구조화",
  "SYS.2.BP3": "시스템 요구사항 분석",
  "SYS.2.BP4": "시스템 컨텍스트 영향 분석",
  "SYS.2.BP5": "일관성 확보 및 양방향 추적성 구축",
  "SYS.2.BP6": "합의된 시스템 요구사항 및 컨텍스트 영향 공유",

  // SYS.3 System Architectural Design
  "SYS.3.BP1": "시스템 아키텍처 정적 측면 명세",
  "SYS.3.BP2": "시스템 아키텍처 동적 측면 명세",
  "SYS.3.BP3": "시스템 아키텍처 분석",
  "SYS.3.BP4": "일관성 확보 및 양방향 추적성 구축",
  "SYS.3.BP5": "합의된 시스템 아키텍처 공유",

  // SYS.4 System Integration and Integration Verification
  "SYS.4.BP1": "시스템 통합 검증 방안 명세",
  "SYS.4.BP2": "검증 방안 선정",
  "SYS.4.BP3": "시스템 요소 통합 및 통합 검증 수행",
  "SYS.4.BP4": "일관성 확보 및 양방향 추적성 구축",
  "SYS.4.BP5": "결과 요약 및 공유",

  // SYS.5 System Verification
  "SYS.5.BP1": "시스템 검증 방안 명세",
  "SYS.5.BP2": "검증 방안 선정",
  "SYS.5.BP3": "통합 시스템 검증 수행",
  "SYS.5.BP4": "일관성 확보 및 양방향 추적성 구축",
  "SYS.5.BP5": "결과 요약 및 공유",

  // SWE.1 Software Requirements Analysis
  "SWE.1.BP1": "소프트웨어 요구사항 명세",
  "SWE.1.BP2": "소프트웨어 요구사항 구조화",
  "SWE.1.BP3": "소프트웨어 요구사항 분석",
  "SWE.1.BP4": "운영 환경 영향 분석",
  "SWE.1.BP5": "일관성 확보 및 양방향 추적성 구축",
  "SWE.1.BP6": "합의된 소프트웨어 요구사항 공유",

  // SWE.2 Software Architectural Design
  "SWE.2.BP1": "소프트웨어 아키텍처 정적 측면 명세",
  "SWE.2.BP2": "소프트웨어 아키텍처 동적 측면 명세",
  "SWE.2.BP3": "소프트웨어 아키텍처 분석",
  "SWE.2.BP4": "일관성 확보 및 양방향 추적성 구축",
  "SWE.2.BP5": "합의된 소프트웨어 아키텍처 공유",

  // SWE.3 Software Detailed Design and Unit Construction
  "SWE.3.BP1": "상세 설계 정적 측면 명세",
  "SWE.3.BP2": "상세 설계 동적 측면 명세",
  "SWE.3.BP3": "소프트웨어 유닛 개발",
  "SWE.3.BP4": "일관성 확보 및 양방향 추적성 구축",
  "SWE.3.BP5": "합의된 소프트웨어 상세 설계 공유",

  // SWE.4 Software Unit Verification
  "SWE.4.BP1": "소프트웨어 유닛 검증 방안 명세",
  "SWE.4.BP2": "소프트웨어 유닛 검증 방안 선정",
  "SWE.4.BP3": "소프트웨어 유닛 검증",

  // SWE.5 Software Component Verification and Integration Verification
  "SWE.5.BP1": "소프트웨어 통합 검증 방안 명세",
  "SWE.5.BP2": "소프트웨어 컴포넌트 동작 검증 방안 명세",
  "SWE.5.BP3": "검증 방안 선정",
  "SWE.5.BP4": "소프트웨어 요소 통합 및 통합 검증 수행",
  "SWE.5.BP5": "소프트웨어 컴포넌트 검증 수행",
  "SWE.5.BP6": "일관성 확보 및 양방향 추적성 구축",
  "SWE.5.BP7": "결과 요약 및 공유",

  // SWE.6 Software Verification
  "SWE.6.BP1": "소프트웨어 검증 방안 명세",
  "SWE.6.BP2": "검증 방안 선정",
  "SWE.6.BP3": "통합 소프트웨어 검증",
  "SWE.6.BP4": "일관성 확보 및 양방향 추적성 구축",
  "SWE.6.BP5": "결과 요약 및 공유",

  // SUP.1 Quality Assurance
  "SUP.1.BP1": "품질 보증의 독립성 확보",
  "SUP.1.BP2": "품질 보증 기준 정의",
  "SUP.1.BP3": "작업 산출물 품질 보증",
  "SUP.1.BP4": "프로세스 활동 품질 보증",
  "SUP.1.BP5": "품질 보증 활동 요약 및 공유",
  "SUP.1.BP6": "부적합 사항 해결 보장",
  "SUP.1.BP7": "부적합 사항 에스컬레이션",

  // SUP.8 Configuration Management
  "SUP.8.BP1": "형상 항목 식별",
  "SUP.8.BP2": "형상 항목 속성 정의",
  "SUP.8.BP3": "형상 관리 체계 구축",
  "SUP.8.BP4": "변경 통제",
  "SUP.8.BP5": "베이스라인 설정",
  "SUP.8.BP6": "형상 상태 요약 및 공유",
  "SUP.8.BP7": "완전성 및 일관성 확보",
  "SUP.8.BP8": "백업 및 복구 메커니즘 가용성 검증",

  // SUP.9 Problem Resolution Management
  "SUP.9.BP1": "문제 식별 및 기록",
  "SUP.9.BP2": "문제 원인 및 영향 파악",
  "SUP.9.BP3": "긴급 해결 조치 승인",
  "SUP.9.BP4": "경고 알림 발행",
  "SUP.9.BP5": "문제 해결 착수",
  "SUP.9.BP6": "문제 종결까지 추적",
  "SUP.9.BP7": "문제 해결 활동 상태 보고",

  // SUP.10 Change Request Management
  "SUP.10.BP1": "변경 요청 식별 및 기록",
  "SUP.10.BP2": "변경 요청 분석 및 평가",
  "SUP.10.BP3": "구현 전 변경 요청 승인",
  "SUP.10.BP4": "양방향 추적성 구축",
  "SUP.10.BP5": "변경 요청 구현 확인",
  "SUP.10.BP6": "변경 요청 종결까지 추적",

  // MAN.3 Project Management
  "MAN.3.BP1": "작업 범위 정의",
  "MAN.3.BP2": "프로젝트 생명주기 정의",
  "MAN.3.BP3": "프로젝트 타당성 평가",
  "MAN.3.BP4": "작업 패키지 정의 및 모니터링",
  "MAN.3.BP5": "프로젝트 산정 및 자원 정의·모니터링",
  "MAN.3.BP6": "필요 역량·지식·경험 정의 및 모니터링",
  "MAN.3.BP7": "프로젝트 인터페이스 및 합의 사항 정의·모니터링",
  "MAN.3.BP8": "프로젝트 일정 정의 및 모니터링",
  "MAN.3.BP9": "일관성 확보",
  "MAN.3.BP10": "프로젝트 진척 검토 및 보고",
};

// Generic practices (PA 1.1 ~ PA 3.2) — identical across all processes.
const GP_TITLES_KO = {
  "GP 1.1.1": "프로세스 산출물(outcome) 달성",

  "GP 2.1.1": "프로세스 수행 목표 식별 및 전략 정의",
  "GP 2.1.2": "프로세스 수행 계획 수립",
  "GP 2.1.3": "자원 필요량 결정",
  "GP 2.1.4": "자원 식별 및 확보",
  "GP 2.1.5": "프로세스 수행 모니터링 및 조정",
  "GP 2.1.6": "관련 당사자 간 인터페이스 관리",

  "GP 2.2.1": "작업산출물 요구사항 정의",
  "GP 2.2.2": "작업산출물 보관 및 통제 요구사항 정의",
  "GP 2.2.3": "작업산출물 식별·보관·통제",
  "GP 2.2.4": "작업산출물 검토 및 조정",

  "GP 3.1.1": "표준 프로세스 수립 및 유지",
  "GP 3.1.2": "필요 역량 결정",
  "GP 3.1.3": "필요 자원 결정",
  "GP 3.1.4": "표준 프로세스 모니터링 방법 결정",

  "GP 3.2.1": "컨텍스트 요구사항을 충족하는 정의된 프로세스 배포",
  "GP 3.2.2": "정의된 역할의 필요 역량 확보",
  "GP 3.2.3": "정의된 프로세스 수행 지원 자원 확보",
  "GP 3.2.4": "정의된 프로세스 수행 모니터링",
};

/** Korean BP title, or the English fallback when no translation exists. */
export function bpTitleKo(processId, bpId, fallback = "") {
  return BP_TITLES_KO[`${processId}.${bpId}`] ?? fallback;
}

/** Korean GP title, or the English fallback when no translation exists. */
export function gpTitleKo(gpId, fallback = "") {
  return GP_TITLES_KO[gpId] ?? fallback;
}
