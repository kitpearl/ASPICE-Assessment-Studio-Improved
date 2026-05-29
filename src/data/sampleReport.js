// 데모용 샘플 리포트 (API 호출 없이 UI 미리보기)
// SWE.2에 고정 — 5 BPs, 6-tier 등급 샘플(N/P-/P+/L-/L+/F)
//
// P6: 각 ratings[i] 에 findings[] 를 채워 VerdictCard 가 새 UI (FindingCard
// 스택, 표준 인용 chip, Rating Rule strip, 청자 배너) 를 그대로 시연하도록 함.
// findings 가 비어 있는 경우 BpRatingRow 는 legacy "약점 · rationale" 경로로
// 폴백하므로, 기존 rationale/evidence 필드는 그대로 유지한다.
// 인용에 사용된 [PROC.RL.N] 식별자는 P5-bis 의 추출 결과 (spec/bgb/
// bpToRatingLevels.csv) 와 일치한다.
export const SAMPLE_PROCESS_ID = "SWE.2";
export const SAMPLE_FILE_NAME = "sample_SWAD_v2.1.docx";
export const SAMPLE_FILE_SIZE = 1843200;

const REFS_BP1 = {
  pam: ["PAM §SWE.2 BP1"],
  pamNote: [],
  bgbRL: ["[DEX.RL.13]", "[DEX.RL.15]"],
  iso: ["ISO 26262-6:2018 §8.4.5"],
};
const REFS_BP2 = {
  pam: ["PAM §SWE.2 BP2"],
  pamNote: [],
  bgbRL: ["[SWE.2.RL.1]"],
  iso: ["ISO 26262-6:2018 §8.5.1"],
};
const REFS_BP3 = {
  pam: ["PAM §SWE.2 BP3"],
  pamNote: [],
  bgbRL: [],
  iso: [],
};
const REFS_BP4 = {
  pam: ["PAM §SWE.2 BP4"],
  pamNote: [],
  bgbRL: ["[DEX.RL.12]"],
  iso: [],
};
const REFS_BP5 = {
  pam: ["PAM §SWE.2 BP5"],
  pamNote: [],
  bgbRL: [],
  iso: [],
};

export const SAMPLE_RESULTS = {
  ratings: [
    {
      bp: "BP1",
      rating: "L+",
      rationale: "정적 아키텍처(컴포넌트/인터페이스) 명세가 문서화되어 있으나, 일부 외부 인터페이스 상세 정의 미흡.",
      evidence: [
        {
          quote: "10개 SW 컴포넌트의 책임·의존성을 도식화하고, 각 컴포넌트의 입력·출력 신호를 표로 정리.",
          location: "§3.1 Component Diagram, p.14",
        },
        {
          quote: "외부 인터페이스 14개 중 3개(IF-EXT-07, 09, 12)는 데이터 타입·범위·주기가 'TBD'로 표기됨.",
          location: "§3.3 Interface List — Table 3-2, pp.20-22",
        },
      ],
      standardReferences: REFS_BP1,
      findings: [
        {
          id: "F-SWE.2.BP1-01",
          bpId: "SWE.2.BP1",
          type: "strength",
          situation:
            "정적 아키텍처 명세가 컴포넌트 단위로 구조화되어 있으며, 10개 SW 컴포넌트의 책임·의존성·입출력 신호가 §3.1 다이어그램과 표로 일관되게 정의되어 있음.",
          gap: "",
          impact: "",
          recommendation: "",
          location: { found: "SWAD §3.1 Component Diagram, p.14", recommended: null },
          evidence: [
            {
              artifactName: "sample_SWAD_v2.1.docx",
              quote: "10개 SW 컴포넌트의 책임·의존성을 도식화하고, 각 컴포넌트의 입력·출력 신호를 표로 정리.",
              location: "§3.1 Component Diagram, p.14",
            },
          ],
          standardReferences: REFS_BP1,
          ratingImpact: {
            ruleApplied: false,
            ruleId: null,
            scoreDelta: 0,
            reason: "확인하라: 컴포넌트 단위 구조화가 BP1 outcome 의 정적 view 요건을 충족",
          },
        },
        {
          id: "F-SWE.2.BP1-02",
          bpId: "SWE.2.BP1",
          type: "weakness",
          situation:
            "외부 인터페이스 14개 중 3개(IF-EXT-07, 09, 12)의 데이터 타입·범위·주기가 'TBD' 로 표기되어 있어 BP1 outcome (정의된 인터페이스) 이 부분 충족 상태이다.",
          gap: "IF-EXT-07/09/12 의 데이터 타입, 값 범위, 갱신 주기, 에러 처리 동작이 명세에서 정의되지 않음.",
          impact:
            "후속 BP2 (동적 view 정의) 가 동일 인터페이스를 참조해야 하나 기준이 부재해 BP2/BP4 통합 시 inconsistency 가 발생할 수 있음.",
          recommendation:
            "추가하라: §3.3 Interface List 의 IF-EXT-07/09/12 행에 데이터 타입, 범위, 주기, 에러 처리 규칙을 정의하고 IF-XREF.xlsx 와 양방향 추적을 연결.",
          location: {
            found: "SWAD §3.3 Interface List Table 3-2, pp.20-22",
            recommended: "SWAD §3.3 Interface List Table 3-2 의 IF-EXT-07/09/12 행",
          },
          evidence: [
            {
              artifactName: "sample_SWAD_v2.1.docx",
              quote:
                "외부 인터페이스 14개 중 3개(IF-EXT-07, 09, 12)는 데이터 타입·범위·주기가 'TBD'로 표기됨.",
              location: "§3.3 Interface List — Table 3-2, pp.20-22",
            },
          ],
          standardReferences: REFS_BP1,
          ratingImpact: {
            ruleApplied: true,
            ruleId: "[DEX.RL.13]",
            scoreDelta: -8,
            reason:
              "감점하라: 외부 인터페이스 정의 미흡으로 BP1 을 F 가 아닌 L+ 로 상한 (DEX.RL.13 적용)",
          },
        },
      ],
    },
    {
      bp: "BP2",
      rating: "L-",
      rationale: "시퀀스 다이어그램 등 동적 측면이 일부 작성되었으나, 소프트웨어 모드/상태 전환 행위 정의가 부분적.",
      evidence: [
        {
          quote: "정상 시동/정상 종료/저전압 진입 등 5개 시나리오 중 3개에 대해 시퀀스 다이어그램이 제공됨.",
          location: "§4 Sequence Diagrams, pp.27-33",
        },
        {
          quote: "Diagnostic Mode ↔ Operational Mode 간 상태 전환 조건이 본문에 서술되어 있으나 상태 전이도(state machine)는 누락.",
          location: "§4.2 SW Modes, p.35",
        },
      ],
      standardReferences: REFS_BP2,
      findings: [
        {
          id: "F-SWE.2.BP2-01",
          bpId: "SWE.2.BP2",
          type: "weakness",
          situation:
            "동적 view 가 §4 시퀀스 다이어그램 일부 (5 시나리오 중 3개) 와 §4.2 모드 서술만으로 구성되어, 진단↔정상 모드 전환의 정형 정의가 부재한 상태이다.",
          gap:
            "Diagnostic Mode ↔ Operational Mode 간 상태 전이도(state machine) 가 부재하고, 5개 시나리오 중 저전력 종료/오류 복구 2개 시나리오의 시퀀스가 미작성.",
          impact:
            "BP4 통합/추적 시 동적 행위가 명세화되지 않아 SWE.4 단위 테스트 설계자가 모드 전이 조건을 자체 가정해야 함 (오해 위험).",
          recommendation:
            "추가하라: §4.2 SW Modes 에 진단/정상 모드 간 state machine 다이어그램을 작성하고, 누락된 2개 시나리오 (저전력 종료, 오류 복구) 의 시퀀스 다이어그램을 §4 에 추가.",
          location: {
            found: "SWAD §4.2 SW Modes, p.35",
            recommended: "SWAD §4.2 SW Modes 신규 §4.2.1 State Machine 절",
          },
          evidence: [
            {
              artifactName: "sample_SWAD_v2.1.docx",
              quote:
                "Diagnostic Mode ↔ Operational Mode 간 상태 전환 조건이 본문에 서술되어 있으나 상태 전이도(state machine)는 누락.",
              location: "§4.2 SW Modes, p.35",
            },
          ],
          standardReferences: REFS_BP2,
          ratingImpact: {
            ruleApplied: true,
            ruleId: "[SWE.2.RL.1]",
            scoreDelta: -18,
            reason:
              "감점하라: 동적 view 정형 정의 부분으로 BP2 를 L- 로 하향 (SWE.2.RL.1 적용)",
          },
        },
      ],
    },
    {
      bp: "BP3",
      rating: "P+",
      rationale: "아키텍처 분석이 수행되었으나, Cybersecurity/Safety 관련 설계 결정 근거 문서화 미흡.",
      evidence: [
        {
          quote: "성능·메모리 사용량에 대한 정량 분석 결과(예: 최악 응답시간 12ms, RAM 사용 78%)가 정리되어 있음.",
          location: "§5.1 Performance Analysis, pp.41-43",
        },
        {
          quote: "Action Item 5건 중 2건(AI-03 보안 위협 모델링, AI-04 ASIL-B 결정 trace)이 'Open' 상태로 미결.",
          location: "SWAD Review MoM 2026-01-20, §3 Action Items",
        },
      ],
      standardReferences: REFS_BP3,
      findings: [
        {
          id: "F-SWE.2.BP3-01",
          bpId: "SWE.2.BP3",
          type: "observation",
          situation:
            "성능 분석 (응답시간 12ms, RAM 78%) 은 §5.1 에 정량적으로 정리되어 있으나, Safety·Cybersecurity 관련 분석은 Action Item 2건이 미결 상태로 BP3 outcome 의 설계 결정 근거가 충분히 문서화되지 않음.",
          gap: "AI-03 (보안 위협 모델링) 과 AI-04 (ASIL-B 결정 trace) 의 결과가 SWAD 본문 또는 별도 분석 문서로 연결되지 않은 채 'Open' 상태이다.",
          impact:
            "Cybersecurity (ISO/SAE 21434) / Functional Safety (ISO 26262) 평가 시 설계 결정 근거가 traceable 하지 않아 PA 1.1 outcome 부분 충족.",
          recommendation:
            "기록하라: AI-03/AI-04 의 분석 결과를 SWAD §5.2 (Safety/Security Analysis) 신설 절에 작성하고, ASIL-B 결정 trace 를 §5.3 의 PHA→SWAD 매핑 표에 추가.",
          location: {
            found: "SWAD Review MoM 2026-01-20, §3 Action Items",
            recommended: "SWAD §5.2 Safety/Security Analysis 신설 절",
          },
          evidence: [
            {
              artifactName: "SWAD Review MoM 2026-01-20",
              quote: "Action Item 5건 중 2건(AI-03 보안 위협 모델링, AI-04 ASIL-B 결정 trace)이 'Open' 상태로 미결.",
              location: "§3 Action Items",
            },
          ],
          standardReferences: REFS_BP3,
          ratingImpact: {
            ruleApplied: false,
            ruleId: null,
            scoreDelta: -32,
            reason: "감점하라: 설계 결정 근거 미결 항목 2건으로 BP3 를 P+ 로 평가",
          },
        },
      ],
    },
    {
      bp: "BP4",
      rating: "F",
      rationale: "Teamer를 통해 SW 아키텍처와 SW 요구사항 간 양방향 추적성 완전 확립. 0 orphan.",
      evidence: [
        {
          quote: "SW 요구사항 142건 → 아키텍처 요소 추적 100%, 역방향(아키텍처 → 요구사항) 추적도 100%, orphan 0건.",
          location: "Teamer Traceability Matrix 2026-03-15, summary p.1",
        },
      ],
      standardReferences: REFS_BP4,
      findings: [
        {
          id: "F-SWE.2.BP4-01",
          bpId: "SWE.2.BP4",
          type: "strength",
          situation:
            "SW 요구사항 142건 ↔ 아키텍처 요소 간 양방향 추적이 Teamer 도구 상에서 100% 일치하며 orphan 이 0 건으로 확인됨. BP4 outcome (요구사항-아키텍처 추적성) 이 완전 충족.",
          gap: "",
          impact: "",
          recommendation: "",
          location: {
            found: "Teamer Traceability Matrix 2026-03-15, summary p.1",
            recommended: null,
          },
          evidence: [
            {
              artifactName: "Teamer Traceability Matrix 2026-03-15",
              quote: "SW 요구사항 142건 → 아키텍처 요소 추적 100%, 역방향(아키텍처 → 요구사항) 추적도 100%, orphan 0건.",
              location: "summary p.1",
            },
          ],
          standardReferences: REFS_BP4,
          ratingImpact: {
            ruleApplied: false,
            ruleId: null,
            scoreDelta: 0,
            reason: "확인하라: BP4 outcome 완전 충족, 감점 사유 없음",
          },
        },
      ],
    },
    {
      bp: "BP5",
      rating: "L-",
      rationale: "합의된 아키텍처가 관련 이해관계자에게 배포되었으나, 일부 팀의 검토 수신 확인이 누락.",
      evidence: [
        {
          quote: "SWAD v2.1이 SharePoint에 게시되고 7개 팀에 알림 메일이 발송된 기록 확인.",
          location: "SharePoint 배포 이력 — Distribution Log 2026-02-08",
        },
        {
          quote: "수신 확인서(서명 PDF) 7건 중 6건만 제출, QA 팀 1건 누락.",
          location: "Distribution Log Annex A, p.2",
        },
      ],
      standardReferences: REFS_BP5,
      findings: [
        {
          id: "F-SWE.2.BP5-01",
          bpId: "SWE.2.BP5",
          type: "weakness",
          situation:
            "SWAD v2.1 이 SharePoint 에 배포되고 7개 팀 알림 메일이 발송되었음이 확인되나, 수신 확인서가 6건만 제출되어 QA 팀 1건의 수신·검토 확인이 부재함.",
          gap: "QA 팀의 SWAD v2.1 수신 확인서 (서명 PDF) 가 Distribution Log Annex A 에 누락.",
          impact:
            "BP5 outcome (관련 이해관계자에 대한 공식 배포 및 확인) 의 'confirmation by stakeholders' 요건이 부분 충족이며, QA 가 합의된 아키텍처를 기반으로 검증 계획을 수립하지 못할 위험.",
          recommendation:
            "보완하라: QA 팀 책임자로부터 SWAD v2.1 수신 확인서 (서명 PDF) 를 수령하여 Distribution Log Annex A 에 추가하고, 검토 의견이 있다면 Review MoM 에 반영.",
          location: {
            found: "Distribution Log Annex A, p.2",
            recommended: "Distribution Log Annex A 의 QA 팀 행 (현재 공란)",
          },
          evidence: [
            {
              artifactName: "Distribution Log 2026-02-08",
              quote: "수신 확인서(서명 PDF) 7건 중 6건만 제출, QA 팀 1건 누락.",
              location: "Annex A, p.2",
            },
          ],
          standardReferences: REFS_BP5,
          ratingImpact: {
            ruleApplied: false,
            ruleId: null,
            scoreDelta: -16,
            reason: "감점하라: 이해관계자 수신 확인 1건 누락으로 BP5 를 L- 로 평가",
          },
        },
      ],
    },
  ],
  summary: "BP3(아키텍처 분석) P+ 미달로 CL1 미충족. 설계 결정 근거 문서화 및 Safety 분석 보완 필요.",
  strengths: "Teamer 기반 완전한 양방향 추적성 확립(BP4 F), 정적 아키텍처 체계적 명세(BP1 L+)",
  gaps: "아키텍처 분석 근거 문서화 미흡(BP3 P+), 동적 행위 정의 불완전(BP2 L-), 이해관계자 검토 확인 누락(BP5 L-)",
};
