// 구조화 평가(assessment) 공통 상수. 프로세스 비종속 — 모든 ASPICE 프로세스에 동일하게 적용된다.

export const SCHEMA_VERSION = "assessment-schema/1.0.0";
export const ENGINE_VERSION = "assessment-engine/1.0.0";
/** 규칙 처리 로직(효과 분류·조건 3값 평가·고정점 계산) 버전. 가이드라인 원문 버전과 별개다. */
export const RULE_LOGIC_VERSION = "assessment-rules/1.0.0";
/** 이 모듈 자체는 LLM 프롬프트를 쓰지 않는다. LLM 결과를 받아 쓸 때 호출자가 실제 프롬프트 버전을 넘긴다. */
export const PROMPT_VERSION_NONE = "none (deterministic assessment layer)";

export const ASSESSMENT_SCOPES = ["DOCUMENT_ADEQUACY", "PROCESS_PERFORMANCE"];
export const EVIDENCE_TYPES = [
  "PLAN",
  "TEMPLATE",
  "EXECUTION_RECORD",
  "TOOL_CONFIGURATION",
  "INTERVIEW",
  "SELF_DECLARATION",
];
/** 실제 수행·운영을 입증하는 증거 유형 (계획·템플릿·자기선언은 제외). */
export const PERFORMANCE_EVIDENCE_TYPES = ["EXECUTION_RECORD", "TOOL_CONFIGURATION", "INTERVIEW"];

export const EVIDENCE_STATUSES = [
  "SUPPORTED",
  "PARTIAL",
  "CONTRADICTED",
  "NOT_OBSERVED",
  "UNREADABLE",
  "NOT_APPLICABLE",
];
export const CONDITION_RESULTS = ["TRUE", "FALSE", "UNKNOWN"];
export const RULE_EFFECT_TYPES = [
  "EXCLUDE_F",
  "CAP_AT_RATING",
  "DOWNRATE_REQUIRED",
  "NOT_HIGHER_THAN_SOURCE",
  "PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON",
  "MANUAL_REVIEW",
];
export const RULE_APPLICATION_STATUSES = [
  "NOT_EVALUATED",
  "NOT_TRIGGERED",
  "PENDING_REVIEW",
  "APPLIED",
  "APPLIED_NO_CHANGE",
  "CONSTRAINT_RECORDED",
  "NEEDS_REVIEW",
];
export const FINDING_DISPOSITIONS = ["ACCEPTED", "MODIFIED", "REJECTED", "DEFERRED"];
export const FINDING_TYPES = ["WEAKNESS", "STRENGTH", "OBSERVATION", "MISSING_EXPECTATION"];
export const RATING_STATUSES = ["PROPOSED", "FINAL", "WITHHELD", "NOT_APPLICABLE"];
export const OFFICIAL_RATINGS = ["N", "P", "L", "F"];
export const CLASSIFICATIONS = ["VALID", "PARTIALLY_VALID", "FALSE_POSITIVE", "UNDETERMINED"];
