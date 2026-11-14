# SUP.10 BP별 심사자 참조 판정표 (초안)

> 심사자 검토용 참조 판정 초안이다. 계획서만으로 BP별 확정 N/P/L/F 또는 실제 Capability Level 을 정답으로 고정하지 않으며, LLM 결과·엔진 다수결을 정답으로 사용하지 않는다.

- 평가 범위: DOCUMENT_ADEQUACY (문서 적절성 검토 — 실제 PA/CL 달성 아님)
- 큐레이션: CURATED
- 문서: (문서번호)BSD_SUP10_CR_Plan_26.docx · sha256 0a0eeb6a4f45f5ec9e0f47f1c4d592aef0a00713c02547a1b0a9a82008985e2b · V1.0 (개정 이력표 기준) · 추출 OK

## 문서 자체 BP(8) ↔ 공식 PAM BP(6)

| 문서 BP | 공식 BP | 대응 | 비고 |
|---|---|---|---|
| BP1 변경요청 관리 전략 수립 (§3) | - | NONE | 공식 SUP.10 BP 에 '전략 수립' BP 가 없다. 내용(§3 CCB 구성·원칙)은 BP3 승인 체계의 근거로 쓰일 수 있으나 BP 자체 대응은 없다. |
| BP2 변경요청 식별·기록 (§4.1) | BP1 | PARTIAL | 공식 BP1 의 식별·기록 부분. |
| BP3 변경요청 상태 기록 (§4.3) | BP1 | PARTIAL | 공식 BP1 의 '상태 배정' 부분. 문서는 BP 를 둘로 나누었다. |
| BP4 모든 변경요청 평가 (§5) | BP2 | EXACT |  |
| BP5 구현 전 변경요청 승인 (§6) | BP3 | EXACT |  |
| BP6 변경요청 구현 검토 (§7) | BP5 | EXACT |  |
| BP7 변경요청 종결까지 추적 (§8) | BP6 | EXACT |  |
| BP8 양방향 추적성 (§9) | BP4 | EXACT |  |

> 문서가 인용한 PAM 4.0 의 8 BP 구성은 이번에 제공된 PAM 4.1(6 BP)과 다르다. PAM 4.0 원문은 확인하지 못했으므로 두 버전의 차이는 UNDETERMINED 이다.

## SUP.10.BP1 변경 요청을 식별하고 기록한다

**공식 기대사항** (PAM 4.1 §4.8.4 SUP.10.BP1 (p.96))
- KO: 변경 요청의 적용 범위가 식별된다. 각 변경 요청이 변경 요청의 개시자 및 이유를 포함하여 고유하게 식별, 설명, 기록된다. 추적이 용이하도록 각 변경 요청에 상태가 배정된다.
- EN: The scope for application of change requests is identified. Each change request is uniquely identified, described, and recorded, including the initiator and reason of the change request. A status is assigned to each change request to facilitate tracking.
- 문서 대응: 문서 BP2(식별·기록 §4.1·§4.2) + 문서 BP3(상태 기록 §4.3). 문서 BP1(전략)은 대응 BP 없음.

### 기대사항별 증거

- **SUP.10.BP1.E1** 변경 요청 적용 범위 식별 — 문서 적절성 초안 상태: `PARTIAL`
  - 인정 가능한 긍정 증거: EV-S10-01 (§2); EV-S10-02 (§2.2)
  - 확인된 약점: 적용 범위가 '베이스라인 설정된 산출물·코드'로만 한정된다. PAM NOTE 1 의 제품·프로세스·방법 변경 범위는 문서에 없다(UNDETERMINED: 의도적 한정인지 심사자 확인).
- **SUP.10.BP1.E2** 고유 식별·설명·기록(개시자·이유 포함) — 문서 적절성 초안 상태: `SUPPORTED`
  - 인정 가능한 긍정 증거: EV-S10-03 (§4.1 · Step 1); EV-S10-04 (§4.1 · Step 2); EV-S10-05 (§4.1 · Step 3); EV-S10-06 (§4.2 · 변경 사유)
  - 추가 수행 증거 필요: Polarion 의 ID 자동 부여·필수 입력 설정(도구 설정)과 실제 등록된 CR 샘플 — 계획서의 선언은 PLAN 증거다.
- **SUP.10.BP1.E3** 추적을 위한 상태 배정 — 문서 적절성 초안 상태: `SUPPORTED`
  - 인정 가능한 긍정 증거: EV-S10-07 (§4.3 · 1. Submitted)
  - 확인된 약점: 상태 목록 7개에 '구현 중 재작업 후 조건부 종결' 상태(Closed with Risk Acceptance)가 없다 → 문서 일관성 항목 OM-02 참조.
  - 추가 수행 증거 필요: Polarion 워크플로우 상태 설정.

### 관련 규칙과 조건 성립 여부

| 규칙 | 효과 | 조건 | 판단 근거 · 필요한 정보 |
|---|---|---|---|
| SUP.10.RL.11 | DOWNRATE_REQUIRED | **UNKNOWN** | BP1 이 개시자·사유 정보 누락 때문에 P/N 인지에 달려 있다. 문서는 제안자·변경 사유를 필수 입력으로 정의하므로 조건이 성립할 근거는 현재 없으나, BP1 임시 등급은 심사자가 정한다. ⟶ 심사자의 BP1 임시 등급 |
| SUP.10.RL.2 | DOWNRATE_REQUIRED | **UNKNOWN** | BP1 이 내용 불충분으로 P/N 인 경우 BP2 하향. BP1 임시 등급이 정해져야 판정된다. ⟶ 심사자의 BP1 임시 등급 |

### Rule·LLM·Hybrid 지적 판정

| 엔진 | 지적 | 분류 | 근거 |
|---|---|---|---|
| RULE | '개시자'에 해당하는 내용이 본문에서 충분히 다루어지지 않음 | **FALSE_POSITIVE** | 문서는 '제안자'를 개시자 의미로 쓴다. §4.1 Step1·Step3, §4.2 '제안자' 필드가 개시자의 식별·기록이다. 키워드 불일치(개시자≠제안자)일 뿐 내용 부재가 아니다. [EV-S10-03, EV-S10-05] |
| RULE | '고유'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | §4.1 Step2 의 ID 자동 부여(BSD-CR-NNNN 일련번호)가 고유 식별이다. [EV-S10-04] |
| RULE | '배정'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | §4.3 상태표(Submitted 가 등록 직후 상태)가 상태 배정에 대응한다. 의미는 있고 표면 단어('배정')만 다르다. [EV-S10-07] |
| RULE | '용이하도록'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | '추적이 용이하도록'은 목적 부사구이며 독립 요구사항이 아니다. 요구사항은 '상태 배정'이다.  |
| RULE | 요구 내용 6/10 항목 확인, 점수 87% | **UNDETERMINED** | 87% 는 50+50×(6/10)^0.6 의 검색 점수다(코드 ruleScorer.scoreFromWeighted). 충족도·등급이 아니며 정답 판정 대상이 아니다.  |
| LLM | 고유 ID 자동 부여, 제안자 및 변경 사유 기록, 영향 산출물 명시, 발생원 분류가 정의됨 | **VALID** | §4.1·§4.2·§2.2 가 뒷받침한다. 단 이는 계획서의 정의이며 운영 실적이 아니다. [EV-S10-03, EV-S10-04, EV-S10-05, EV-S10-06, EV-S10-02] |
| HYBRID | 상태(신규, 조사 중, 승인 대기, 승인됨, 구현 중, 구현 완료, 종결) 자동 관리 | **PARTIALLY_VALID** | 상태 관리 자체는 맞지만 나열된 상태명이 문서와 다르다. 문서의 7 상태는 Submitted / Under Review / Approved / Rejected / In Implementation / Under Verification / Closed 이며 '승인 대기'·'구현 완료'는 없고 Rejected 가 빠졌다. [EV-S10-07, EV-S10-46, EV-S10-47, EV-S10-31] |
| HYBRID | 강점(고유 ID·제안자·상태 배정)과 Rule 관찰(개시자·고유·배정 부족)이 동시에 출력됨 | **VALID** | 같은 기대사항에 대한 긍정·부정 지적이 최종 출력 전에 해소되지 않았다는 리포트 구조 문제. 증거 기준으로는 Rule 쪽이 기각되어야 한다. [EV-S10-03, EV-S10-04, EV-S10-07] |

### 누락된 중요 검토 사항

- **OM-BP1-1** [UNDETERMINED] 적용 범위가 제품 산출물·코드에 한정되고 프로세스·방법 변경(PAM NOTE 1)이 명시되지 않음 (EV-S10-01)

### 심사자 확인 질문

1. CR 적용 범위에서 프로세스·방법 변경을 의도적으로 제외했습니까? 제외라면 다른 문서가 이를 다룹니까?
2. Polarion 의 CR Work Item 워크플로우 설정과 샘플 CR 5건을 확인할 수 있습니까(계획→운영 증거)?

## SUP.10.BP2 변경 요청을 분석하고 평가한다

**공식 기대사항** (PAM 4.1 §4.8.4 SUP.10.BP2 (p.96))
- KO: 변경 요청이 분석 기준에 따라 관련 당사자에 의해 분석된다. 변경 요청의 영향을 받는 작업 산출물 및 다른 변경 요청에 대한 종속성이 결정된다. 변경 요청의 영향이 평가된다.
- EN: The change requests are analyzed by relevant parties according to the analysis criteria. The work products affected by the change requests and dependencies on other change requests are determined. The impact of the change requests is assessed.
- 문서 대응: 문서 BP4(모든 변경요청 평가 §5) — 의미상 EXACT.

### 기대사항별 증거

- **SUP.10.BP2.E1** 분석 기준에 따라 관련 당사자가 분석 — 문서 적절성 초안 상태: `SUPPORTED`
  - 인정 가능한 긍정 증거: EV-S10-10 (§5); EV-S10-13 (§6.2 · Step 2); EV-S10-12 (§3.2 · CCB 위원 - 기술); EV-S10-09 (§4.1 · Step 4)
  - 확인된 약점: 분석 기준은 5개 영향 영역(일정·공수·품질·안전·외부 인터페이스)이다. PAM NOTE 4 의 자원 요구량·일정·리스크·이익 중 리스크·이익은 영역에 없다(NOTE 는 예시이므로 결함이 아님, 심사자 확인).
  - 추가 수행 증거 필요: 작성된 Impact Analysis Report 샘플.
- **SUP.10.BP2.E2** 영향받는 작업 산출물 및 다른 CR 과의 종속성 결정 — 문서 적절성 초안 상태: `SUPPORTED`
  - 인정 가능한 긍정 증거: EV-S10-08 (§4.2 · 변경 대상 CI); EV-S10-15 (§5.3 · 영향 CI 매트릭스); EV-S10-14 (§9.4 · CR → 다른 CR)
  - 추가 수행 증거 필요: Polarion 'Linked CR' 필드 설정과 사용 사례.
- **SUP.10.BP2.E3** 변경 요청의 영향 평가 — 문서 적절성 초안 상태: `PARTIAL`
  - 인정 가능한 긍정 증거: EV-S10-10 (§5); EV-S10-11 (§5.1 · 일정 (Schedule)); EV-S10-19 (§5.1 · 공수 (Effort)); EV-S10-43 (§5.3 · 승인 권장 사항)
  - 확인된 약점: 사전(구현 전) 분석에 '부작용' 분석이 명시되지 않는다. '부작용'은 §7 구현 검토(사후)에서만 등장한다. 사전 영역은 일정·공수·품질·안전·외부 인터페이스이고, 다른 기능에 미치는 영향은 영향 CI 매트릭스와 §5.2 트리거 조건(다중 SWC·인터페이스 변경)으로 간접 다뤄진다.

### 관련 규칙과 조건 성립 여부

| 규칙 | 효과 | 조건 | 판단 근거 · 필요한 정보 |
|---|---|---|---|
| SUP.10.RL.1 | EXCLUDE_F | **UNKNOWN** | 분석이 잠재적 부작용을 다루지 않는가: 사전 분석 영역에 부작용 항목이 명시되지 않았지만 영향 CI 매트릭스·트리거 조건이 간접적으로 다룬다. 사전 부작용 분석과 사후 부작용 확인은 다른 것이므로 심사자 판단이 필요하다. ⟶ 심사자의 '잠재적 부작용을 다루지 않음' 해석(사전 분석 범위) |
| SUP.10.RL.2 | DOWNRATE_REQUIRED | **UNKNOWN** | BP1 임시 등급이 P/N 인지에 달려 있다. ⟶ BP1 임시 등급 |
| SUP.10.RL.6 | DOWNRATE_REQUIRED | **UNKNOWN** | BP4 가 'CR 과 영향 작업 산출물 간 의존성 누락' 때문에 P/N 일 때만 성립한다. BP4 의 다른 약점은 전파 대상이 아니다. ⟶ BP4 임시 등급과 하향 사유 |

### Rule·LLM·Hybrid 지적 판정

| 엔진 | 지적 | 분류 | 근거 |
|---|---|---|---|
| RULE | '당사자'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | 분석 주체가 문서에 있다: WP 책임자(§6.2 Step2), 관련 CCB 위원 기술/시스템/안전(§6.2 Step3), QA Lead(§4.1 Step4). [EV-S10-13, EV-S10-12, EV-S10-09] |
| HYBRID | 영향도 분석이 5개 영역(기술, 시스템, 품질, 안전, 형상)으로 구조화되고 각 CCB 위원이 영역별로 평가 | **FALSE_POSITIVE** | 사실 혼동이다. §5.1 의 5개 영향 영역은 일정·공수·품질·안전·외부 인터페이스다. 기술·시스템·품질·안전·형상은 §3.2 의 CCB 위원 역할 목록이다. 분석 체계가 있다는 결론은 맞지만 이 근거 서술은 틀렸다. [EV-S10-10, EV-S10-11, EV-S10-50, EV-S10-12, EV-S10-20] |
| LLM | 영향도 분석(5 영역 + 4 등급)과 CCB 위원별 역할 분담으로 관련 당사자가 분석 | **VALID** | §5·§3.2·§6.2 가 뒷받침한다. 'CCB 위원별 역할 분담'은 영역이 아니라 위원 역할임을 구분하면 사실에 부합한다. [EV-S10-10, EV-S10-12, EV-S10-13] |
| RULE | 요구 내용 9/10 항목 확인, 점수 97% | **UNDETERMINED** | 검색 점수(50+50×0.9^0.6). 충족도 아님. 같은 리포트의 BP2 'F' 와 RL.1·RL.2·RL.6 후보는 별개 사안이다.  |

### 누락된 중요 검토 사항

- **OM-BP2-1** [CONFIRMED_FROM_SOURCE] 사전 부작용 분석과 사후 부작용 확인의 구분 — 사전 분석에 부작용 항목이 없고 사후(§7)에만 있다 (EV-S10-10, EV-S10-28, EV-S10-42)

### 심사자 확인 질문

1. §5.1 의 5개 영역 외에 '다른 기능·산출물에 미치는 부작용'을 사전에 분석하는 절차가 다른 문서(BSD-SVP-001 §8 등)에 있습니까?
2. RL.1 의 '잠재적 부작용을 다루지 않음'을 영향 CI 매트릭스·회귀 범위 결정이 충족한다고 봅니까?

## SUP.10.BP3 구현 전에 변경 요청을 승인한다

**공식 기대사항** (PAM 4.1 §4.8.4 SUP.10.BP3 (p.96))
- KO: 분석 결과 및 자원 가용성을 기반으로 변경 요청의 우선순위가 지정되고 구현이 승인된다.
- EN: The change requests are prioritized and approved for implementation based on the analysis results and the availability of resources.
- 문서 대응: 문서 BP5(구현 전 변경요청 승인 §6) — 의미상 EXACT. 문서 BP1(§3 CCB 구성)이 승인 체계의 근거.

### 기대사항별 증거

- **SUP.10.BP3.E1** 분석 결과와 자원 가용성에 근거한 우선순위 지정·구현 승인 — 문서 적절성 초안 상태: `PARTIAL`
  - 인정 가능한 긍정 증거: EV-S10-22 (§6.1 · Level 1); EV-S10-49 (§3.2 · CCB Chair (의장)); EV-S10-17 (§6.2 · Step 5); EV-S10-18 (§6.2 · Step 1); EV-S10-43 (§5.3 · 승인 권장 사항)
  - 확인된 약점: 분석 결과에 근거한 승인(권장 사항 + 5-Level 권한)은 정의되어 있다.
  - 확인된 약점: 자원 '요구량 추정'(§5.1 공수 재산정)은 있으나 자원 '가용성 확인'은 승인 절차(§6.2)에 없다. Level 4 의 '자원 추가 투입 필요'는 승인권자를 정하는 트리거이지 가용성 확인이 아니다.
  - 확인된 약점: 우선순위 지정: §6.2 Step1 의 제목은 '분류·우선순위'이나 내용은 영향도 분류와 Level 결정뿐이며 우선순위 기준·릴리스 배정(PAM NOTE 6)은 없다.
  - 추가 수행 증거 필요: CCB 회의록 샘플(결정·사유·우선순위).

### 관련 규칙과 조건 성립 여부

| 규칙 | 효과 | 조건 | 판단 근거 · 필요한 정보 |
|---|---|---|---|
| SUP.10.RL.3 | EXCLUDE_F | **UNKNOWN** | 승인 권한에 모든 관련 분야·이해관계자가 대표되는가: CCB 는 기술·시스템·품질·안전·형상 위원과 외부 검토자(수시)를 두지만 ① SW 검증·시험 담당은 CCB 위원에 없고 ② Level 1·2 승인권자는 WP 책임자+QA Lead, PM 뿐이며 ③ 형상 위원이 PM 겸직이다. 대표성이 충분한지는 증거만으로 TRUE/FALSE 를 정할 수 없다 — UNKNOWN 유지. 모든 관련자가 대표된다고 서술하면서 F 제한을 적용하는 것은 모순이다. ⟶ 프로젝트의 '관련 분야·이해관계자' 목록과 Level 별 승인권자 구성에 대한 심사자 판단 |
| SUP.10.RL.4 | DOWNRATE_REQUIRED | **UNKNOWN** | 승인 결정이 정당한 이유 없이/적시에 내려지지 않음이 '명백'해야 한다. 계획서만으로는 관찰할 수 없다(수행 증거 필요). ⟶ CCB 회의록, 결정 지연 기록 |
| SUP.10.RL.5 | NOT_HIGHER_THAN_SOURCE | **UNKNOWN** | BP2 가 P/N 일 때만 성립한다. BP2 가 L 이상이면 선행조건을 충족하지 않는다. ⟶ BP2 임시 등급 |

### Rule·LLM·Hybrid 지적 판정

| 엔진 | 지적 | 분류 | 근거 |
|---|---|---|---|
| RULE | '가용성'에 해당하는 내용이 충분히 다루어지지 않음 | **PARTIALLY_VALID** | 키워드 불일치를 넘어 실제로 자원 가용성 확인이 승인 절차에 없다(공수 추정만 있음). 지적의 내용은 타당하나 근거는 키워드 부재가 아니라 의미 비교여야 한다. [EV-S10-19, EV-S10-16] |
| LLM | CCB 에 모든 관련 분야와 이해관계자가 포함되어 있음 (RL.3 '적용' 표기 병존) | **PARTIALLY_VALID** | 구성(기술·시스템·품질·안전·형상·외부)은 §3.2 와 일치한다. 그러나 '모든 관련 분야가 대표됨'은 단정할 수 없고(UNKNOWN), 대표된다고 서술하면서 RL.3 상한을 '적용'으로 표기해 L+ 로 낮춘 것은 자기모순이다. [EV-S10-12, EV-S10-20, EV-S10-21, EV-S10-22] |
| HYBRID | RL.3 상한 규칙이 충족됨(CCB 에 모든 관련 분야·이해관계자 대표) — 그러나 RL.3 L 상한(적용)이 표시되고 BP3 가 L+ | **VALID** | 규칙 표시·적용 후보·조건 성립·등급 변경이 구분되지 않은 리포트 결함이다. 조건이 TRUE 로 입증되지 않았으므로 하향을 확정할 수 없고, 서술상 FALSE 라면 적용하면 안 된다.  |

### 누락된 중요 검토 사항

- **OM-BP3-1** [CONFIRMED_FROM_SOURCE] 자원 요구량 추정과 자원 가용성 확인의 구분 — 가용성 확인 절차 없음 (EV-S10-19, EV-S10-16, EV-S10-17)
- **OM-BP3-2** [CONFIRMED_FROM_SOURCE] 우선순위 지정 기준·릴리스 배정 없음 (EV-S10-18)
- **OM-BP3-3** [CONFIRMED_FROM_SOURCE] Defer 결정 이후 처리(상태 전이·재심의 시점·추적) 미정의 (EV-S10-17, EV-S10-43, EV-S10-41)

### 심사자 확인 질문

1. SW 검증·시험 담당이 CCB 위원이 아닌 점이 RL.3 의 '관련 분야 미대표'에 해당합니까?
2. Level 1·2(WP 책임자+QA Lead, PM)의 승인권자 구성이 '모든 관련 분야 대표'를 충족합니까? 안전 영향 없음 조건이 이를 보완합니까?
3. 자원 가용성을 어디서 확인합니까(PM 일정 마진 흡수 §6.1 Level 2 가 해당합니까)?

## SUP.10.BP4 양방향 추적성을 수립한다

**공식 기대사항** (PAM 4.1 §4.8.4 SUP.10.BP4 (p.97))
- KO: 변경 요청과 변경 요청의 영향을 받는 작업 산출물 간의 양방향 추적성을 수립한다. 변경 요청이 문제로 인해 시작된 경우, 변경 요청과 해당 문제 보고서 간의 양방향 추적성을 수립한다.
- EN: Establish bidirectional traceability between the change requests and the work products affected by the change requests. In case that the change requests are initiated by problems, establish bidirectional traceability between the change requests and the corresponding problem reports.
- 문서 대응: 문서 BP8(양방향 추적성 §9) — 의미상 EXACT.

### 기대사항별 증거

- **SUP.10.BP4.E1** CR ↔ 영향받는 작업 산출물 양방향 추적성 — 문서 적절성 초안 상태: `SUPPORTED`
  - 인정 가능한 긍정 증거: EV-S10-23 (§9); EV-S10-24 (§9.3 · 등록 시); EV-S10-15 (§5.3 · 영향 CI 매트릭스)
  - 확인된 약점: '추적표'(9장 SyRS ↔ CR ↔ 산출물 ↔ NC)는 BP 매핑표(§2.1·§11.1)에서만 언급되고 9장 본문에는 표 자체가 없다. 본문은 추적 체인 도식과 정/역방향 설명이다.
  - 확인된 약점: 'orphan CR 0건 보장'은 자기선언이다.
  - 추가 수행 증거 필요: Polarion Linked Items 설정과 실제 추적 매트릭스(양방향 쿼리 결과).
- **SUP.10.BP4.E2** 문제로 시작된 CR ↔ 문제 보고서 양방향 추적성 — 문서 적절성 초안 상태: `SUPPORTED`
  - 인정 가능한 긍정 증거: EV-S10-25 (§9.4 · NC → CR (해결)); EV-S10-06 (§4.2 · 변경 사유)
  - 확인된 약점: NC → CR 방향 설명은 충분하나 CR → NC 방향은 '검증 실패 시 새 NC 생성'으로 한정되고, 문제로 시작된 CR 의 NC 링크 자체는 §4.2 '관련 NC' 필드가 담당한다(§4.2 인용 필요).
  - 추가 수행 증거 필요: NC↔CR 링크 샘플(SUP.9 문제 해결 계획서 BSD-PMP-001 확인 필요).

### 관련 규칙과 조건 성립 여부

| 규칙 | 효과 | 조건 | 판단 근거 · 필요한 정보 |
|---|---|---|---|
| TAC.RL.1 | PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON | **UNKNOWN** | 추적성이 개별 원자 요소가 아닌 합리적 정보 묶음 사이에 수립된 경우에 한해, 그 사유로 하향 금지. 문서는 CR ↔ CI(산출물·코드 ID 목록) 단위로 추적한다 — 묶음 단위 여부는 심사자 판단. ⟶ 추적 단위가 묶음인지 판단 |
| TAC.RL.2 | PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON | **UNKNOWN** | 도구 기반 자동 추적을 쓰지 않고 수동 스냅샷 검사를 쓰는 경우에 한해 그 사유 하향 금지. 이 문서는 도구 자동 추적을 선언한다 — 조건은 성립하지 않는 것으로 보이나 운영 증거 없이 확정하지 않는다. ⟶ 실제 추적 방식(도구/수동) |
| TAC.RL.3 | PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON | **UNKNOWN** | 명시적 검토·분석 기록이 없는 대신 페어 작업·피어 스팟 체크 등을 쓰는 경우에 한해 그 사유 하향 금지. 해당 대체 접근 근거 없음. ⟶ 검토 기록 대체 접근 여부 |
| SUP.10.RL.6 | DOWNRATE_REQUIRED | **UNKNOWN** | BP4 가 'CR 과 영향 작업 산출물 간 의존성 누락' 때문에 P/N 일 때만 BP2 로 전파한다. BP4 의 모든 약점을 전파하지 않는다. 문서는 해당 의존성 누락의 직접 증거가 없다. ⟶ BP4 임시 등급과 하향 사유 |

### Rule·LLM·Hybrid 지적 판정

| 엔진 | 지적 | 분류 | 근거 |
|---|---|---|---|
| RULE | '간의'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | '간의'(…사이의)는 관계 표현이며 독립 요구 내용이 아니다. 삭제해도 요구사항(양방향 추적성)은 변하지 않는다.  |
| LLM | 9장에 SyRS ↔ CR ↔ 산출물 ↔ NC 추적표가 존재함을 명시 | **PARTIALLY_VALID** | 추적 체계 기술은 맞으나 '추적표 존재'는 매핑표 문구에 의존한다. 9장 본문에 추적표 인스턴스는 없다. 인용 위치(§3.1, §2.1, §4.2)가 핵심 본문(§9)이 아니라 원칙·매핑표다. [EV-S10-27, EV-S10-23, EV-S10-24] |

### 심사자 확인 질문

1. 추적 단위가 CR ↔ CI 목록(묶음)입니까 원자 요소입니까? TAC.RL.1 의 '합리적 묶음' 사유에 해당합니까?
2. Polarion Linked Items 로 실제 양방향 쿼리를 시연할 수 있습니까?

## SUP.10.BP5 변경 요청의 구현을 확인한다

**공식 기대사항** (PAM 4.1 §4.8.4 SUP.10.BP5 (p.97))
- KO: 변경 요청의 구현이 관련 이해관계자에 의해 종료 전에 확인된다.
- EN: The implementation of the change requests is confirmed before closure by relevant stakeholders.
- 문서 대응: 문서 BP6(변경요청 구현 검토 §7) — 의미상 EXACT.

### 기대사항별 증거

- **SUP.10.BP5.E1** 관련 이해관계자에 의한, 종료 전 구현 확인 — 문서 적절성 초안 상태: `PARTIAL`
  - 인정 가능한 긍정 증거: EV-S10-28 (§7); EV-S10-29 (§7.1 · 3. 검증); EV-S10-30 (§7.2 · ⚠ Conditional); EV-S10-44 (§4.2 · 변경 내용 (After))
  - 확인된 약점: 확인 주체가 QA Lead 와 SW 시험 담당 중심이다. 요청 제안자(개시자)나 영향을 받는 이해관계자의 구현 확인은 §7 에 정의되지 않았다(→ 심사자 확인: '관련 이해관계자'의 범위).
  - 확인된 약점: 수용 기준은 회귀 PASS/Conditional/FAIL 판정과 CR 의 '신규 합격 기준'(§4.2)으로 존재한다. RL.8 기준으로는 포함된 것으로 보인다.
  - 확인된 약점: 'Closed with Risk Acceptance' 조건부 종결이 상태표에 없다(OM-02).
  - 추가 수행 증거 필요: 회귀 검증 결과 매트릭스, QA Lead 검증 보고서 샘플.

### 관련 규칙과 조건 성립 여부

| 규칙 | 효과 | 조건 | 판단 근거 · 필요한 정보 |
|---|---|---|---|
| SUP.10.RL.7 | DOWNRATE_REQUIRED | **UNKNOWN** | 구현 확인이 '관련 프로세스가 적용되지 않았음'을 놓치는지는 수행 기록 없이 판정할 수 없다. ⟶ 구현 확인 기록(수행 증거) |
| SUP.10.RL.8 | DOWNRATE_REQUIRED | **FALSE** | 구현 확인에 합의된 수용 기준·정책이 없는가: CR 의 신규 합격 기준(§4.2)과 회귀 판정표(§7.2)가 문서 수준에서 존재하므로 조건 불성립으로 보인다. '합의'(CCB 승인) 여부는 심사자가 최종 확인한다. ⟶ 수용 기준이 CCB 에서 합의되는지 확인 |
| SUP.10.RL.9 | DOWNRATE_REQUIRED | **UNKNOWN** | BP2 가 구현 확인 정보 누락 때문에 P/N 일 때만 성립한다. ⟶ BP2 임시 등급과 사유 |

### Rule·LLM·Hybrid 지적 판정

| 엔진 | 지적 | 분류 | 근거 |
|---|---|---|---|
| RULE | '확인'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | §7 은 '검증'·'검토'라는 단어로 구현 확인 절차를 정의한다(검증 ≈ 확인). [EV-S10-28, EV-S10-29] |
| RULE | '의해'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | '~에 의해'는 기능어이며 독립 요구 내용이 아니다.  |
| RULE | '이해관계자'에 해당하는 내용이 충분히 다루어지지 않음 | **PARTIALLY_VALID** | 구현 확인 주체는 QA Lead 중심이며 개시자·영향 이해관계자의 확인은 없다. 단어 부재가 아니라 의미(확인 주체 범위) 때문에 타당하다. [EV-S10-29] |
| RULE | '종료'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | 문서는 '종결'(Closed)을 쓴다(§4.3, §7.2, §10.2). 종료 ≈ 종결. [EV-S10-31, EV-S10-34] |
| LLM | 구현 확인 절차가 '구현 후 검증 + 회귀 검증'으로 언급되나 실제로 관련 이해관… (설명 잘림) | **PARTIALLY_VALID** | 우려(관련 이해관계자에 의한 확인이 불명확)는 타당할 수 있으나 인용 증거가 §2.1 BP 매핑표·목차성 문구를 덤프한 것이라 근거로 부적절하다(§7.1 이 본문 근거). 설명 후반부는 출력에서 잘려 판정할 수 없다 — 잘린 부분은 UNDETERMINED. [EV-S10-29, EV-S10-27] |

### 누락된 중요 검토 사항

- **OM-BP5-1** [CONFIRMED_FROM_SOURCE] 개시자(제안자)의 구현 확인·종결 관여가 정의되지 않음 (RL.10 과 함께 판단) (EV-S10-29, EV-S10-31)
- **OM-BP5-2** [CONFIRMED_FROM_SOURCE] Closed with Risk Acceptance 조건부 종결이 7개 상태 목록에 없음 (EV-S10-38, EV-S10-31, EV-S10-47)

### 심사자 확인 질문

1. '관련 이해관계자'를 QA Lead 로 충분하다고 봅니까? 요청 제안자의 확인이 필요하다고 봅니까?
2. Conditional 결과의 'Risk Accepted' 결정은 CCB 승인 대상입니까, 그리고 그 CR 은 어떤 상태로 추적됩니까?

## SUP.10.BP6 변경 요청을 종료까지 추적한다

**공식 기대사항** (PAM 4.1 §4.8.4 SUP.10.BP6 (p.97))
- KO: 변경 요청을 종료까지 추적한다. 변경 요청의 상태가 영향받는 모든 당사자에게 의사소통된다.
- EN: The change requests are tracked to closure. The status of the change requests is communicated to all affected parties.
- 문서 대응: 문서 BP7(변경요청 종결까지 추적 §8). 상태 통보는 §4.1 Step5, §6.2 Step7, §10.2 Step9 에 분산되어 있다.

### 기대사항별 증거

- **SUP.10.BP6.E1** 변경 요청을 종료(종결)까지 추적 — 문서 적절성 초안 상태: `SUPPORTED`
  - 인정 가능한 긍정 증거: EV-S10-31 (§4.3 · 7. Closed); EV-S10-35 (§8.1); EV-S10-34 (§10.2 · Step 9)
  - 확인된 약점: §8 의 KPI 는 계획 목표치이며 운영 실적이 아니다.
  - 확인된 약점: Defer 이후와 Closed with Risk Acceptance 상태는 추적 경로가 정의되지 않았다(OM-02, OM-03).
  - 추가 수행 증거 필요: CR 처리 현황(KPI 실적).
- **SUP.10.BP6.E2** 상태를 영향받는 모든 당사자에게 의사소통 — 문서 적절성 초안 상태: `PARTIAL`
  - 인정 가능한 긍정 증거: EV-S10-32 (§4.1 · Step 5 통보); EV-S10-33 (§6.2 · Step 7); EV-S10-34 (§10.2 · Step 9)
  - 확인된 약점: 통보는 등록(CCB 위원 전체), 결정(전 관계자), 종결 시점에 정의되어 있다. 구현·검증 중 상태 변경과 외부(OEM) 당사자에 대한 통보 대상은 정의되지 않았다.
  - 확인된 약점: '전 관계자'의 범위가 정의되지 않았다.
  - 추가 수행 증거 필요: Polarion 알림 규칙 설정.

### 관련 규칙과 조건 성립 여부

| 규칙 | 효과 | 조건 | 판단 근거 · 필요한 정보 |
|---|---|---|---|
| SUP.10.RL.10 | DOWNRATE_REQUIRED | **UNKNOWN** | 두 조건이 함께 필요하다: ① 개시자가 종결을 충분히 승인하지 않음 — 문서는 종결 검증을 QA Lead·CM Lead 가 수행한다고 정의하며 개시자 관여가 없다(조건 ①은 성립 가능성이 높으나 심사자 확인), ② 그것이 프로젝트와 관련하여 실질적인가 — 증거로 판단되지 않음(UNKNOWN). 조건 ②가 없으면 적용하지 않는다. ⟶ 개시자 승인 부재의 프로젝트 영향 판단 |
| SUP.10.RL.11 | DOWNRATE_REQUIRED | **UNKNOWN** | BP1 이 개시자·사유 누락으로 P/N 일 때만 성립한다. ⟶ BP1 임시 등급과 사유 |

### Rule·LLM·Hybrid 지적 판정

| 엔진 | 지적 | 분류 | 근거 |
|---|---|---|---|
| RULE | '종료'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | 종결(Closed)로 표현되어 있다(§4.3 Closed, §10.2 Step9, 제목 §8 '종결까지 추적'). [EV-S10-31, EV-S10-34] |
| RULE | '의사소통'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | 의사소통은 '통보·자동 알림'으로 정의되어 있다(§4.1 Step5, §6.2 Step7, §10.2 Step9). 다만 범위의 완전성은 별도 항목(BP6.E2 약점)이다. [EV-S10-32, EV-S10-33, EV-S10-34] |
| RULE | '당사자'·'영향받'에 해당하는 내용이 충분히 다루어지지 않음 | **FALSE_POSITIVE** | '영향받'은 '영향받는'의 잘린 토큰이다. 당사자는 'CCB 위원 전체'·'전 관계자'로 표현된다. [EV-S10-32, EV-S10-33] |
| LLM | 상태가 CCB 위원 등 주요 내부 이해관계자에게 자동 통보됨 | **PARTIALLY_VALID** | §4.1 Step5 의 CCB 위원 통보는 맞다. 그러나 §6.2 Step7(전 관계자)·§10.2 Step9(종결 통보)를 놓쳤고, 외부·모든 영향 당사자 범위는 확인되지 않았다. 또 이는 계획서의 정의이며 실제 통보 운영이 아니다. [EV-S10-32, EV-S10-33, EV-S10-34] |

### 누락된 중요 검토 사항

- **OM-BP6-1** [CONFIRMED_FROM_SOURCE] 구현·검증 단계 상태 변경과 외부(OEM) 당사자에 대한 통보 범위 미정의 (EV-S10-32, EV-S10-33, EV-S10-21)

### 심사자 확인 질문

1. '영향받는 모든 당사자'에 OEM·외부 검토자가 포함됩니까? 포함이면 통보 수단은 무엇입니까?
2. 개시자(제안자)가 종결을 승인·확인하는 절차가 별도 문서에 있습니까? 없다면 프로젝트에 실질적인 영향이 있습니까(RL.10 조건 ②)?

## 문서 수준 일관성·누락 항목

- **OM-01** [CONFIRMED_FROM_SOURCE] 문서 자체 BP 8개 vs 공식 PAM 4.1 BP 6개 — BP 번호 체계가 달라 BP 번호로 대응하면 오판한다 (EV-S10-36, EV-S10-37, EV-S10-45)
- **OM-02** [CONFIRMED_FROM_SOURCE] §7.2 가 'Closed with Risk Acceptance' 상태로 전이하지만 §4.3 의 7개 상태 목록에 없다 (EV-S10-38, EV-S10-31)
- **OM-03** [CONFIRMED_FROM_SOURCE] 결정 결과 Defer 이후 상태 전이·재심의·추적이 정의되지 않는다(§6.2 Step6 은 Approved/Rejected 만) (EV-S10-17, EV-S10-41, EV-S10-43)
- **OM-04** [CONFIRMED_FROM_SOURCE] §5.2 H 등급 회귀 범위가 '전체 SVT 50% (…9건)'이나 F 등급이 '전체 15 SVT'이므로 9/15 = 60% 이다. 50% 와 9건이 서로 맞지 않는다 (EV-S10-39, EV-S10-40)
- **OM-05** [CONFIRMED_FROM_SOURCE] 자기충족 선언('BP1~BP8 모두 충족 — Capability Level 1')은 증거가 아니다. 계획서로 CL 달성을 선언할 수 없다 (EV-S10-37, EV-S10-48)
- **OM-06** [UNDETERMINED] 문서 관리 일관성: 표지 승인일(2026.04.01)·개정 이력(2026-05-06)·검토 회의록(2025-12-22)·기준선 ID(BSD-CRP-001)의 날짜·번호가 서로 다르다. 인용 PAM 도 v4.0 이다 (EV-S10-45, EV-S10-48) — 표지·개정이력 원문 인용은 증거 풀에 넣지 않았다(표 셀 단위 인용은 mammoth 추출 형식에 의존). 심사자가 원본 문서에서 직접 확인한다.

## 엔진 리포트 수준 이슈

- **RP-01** [VALID] 문서 적절성 검토 결과를 '판정: 적합 · 6/6 BP 가 L 이상', 'All CL1 required PAs met' 로 출력 — 계획서만으로 실제 PA/CL 달성을 결론지을 수 없다 — 세 리포트 공통 헤더·[Summary]
- **RP-02** [VALID] '강점' 목록에 6개 BP 가 전부 들어간다 — BP 점수 ≥68% 이면 자동 강점 처리(api/_legacyAdapter.js strong 필터), 강점 Finding 존재 여부와 무관 — api/_legacyAdapter.js:94
- **RP-03** [VALID] LLM 리포트 BP5 에 WEAKNESS 가 있으나 상단 요약은 '특이 Finding 없음' — 요약은 BP 점수<51% 만 Finding 으로 센다 — api/_legacyAdapter.js:95 (weak 필터), 108
- **RP-04** [VALID] LLM BP5 약점 설명이 '…관련 이해관…'에서 끊긴다 — 원인은 출력 변환 단계의 condenseGap(60자 절단) — api/_legacyAdapter.js condenseGap: s.slice(0, 58) + '…'
- **RP-05** [VALID] Hybrid 리포트에서 Rule 중간 점수(87%/97%/83%/85%)와 최종 등급이 구분 없이 함께 출력되고 점수 곡선이 설명되지 않는다 — hybridScorer.js: findings 단순 병합(LLM 먼저, Rule 뒤)
- **RP-06** [UNDETERMINED] 입력 목록 '(문서번호)BSD_SUP9_PM_Plan_26.docx 외 1개' 가 첫 문서로 SUP.9 계획서를 표시하나 모든 인용 위치는 SUP.10 계획서다 — 실제 입력 구성이 리포트에 정확히 기록되었는지 확인하지 못했다 — 리포트 헤더 '문서:' 줄

## 열람하지 못한 자료 (필요 범위)

- (문서번호)BSD_SUP9_PM_Plan_26.docx — NC→CR 전환·CR 번호 체계 관련 절(BSD-PMP-001 §9.2 등) (열람하지 않음)
- ASPICE_SUP.10_report_*.pdf — BP5 LLM 약점 설명 전체 문장 (.txt 에서 잘려 있고 PDF 는 대조하지 않음)
- AutomotiveSPICE_PAM_40 (원문) — SUP.10 BP 구성 (문서가 인용한 8 BP 의 근거 확인용 — 제공되지 않음)

## 증거 목록

| ID | 위치 | 유형 | 인용 |
|---|---|---|---|
| EV-S10-01 | §2 | PLAN | 베이스라인이 설정된 산출물·코드의 변경은 본 SUP.10 절차를 거쳐야 하며 |
| EV-S10-02 | §2.2 · CR 발생원 | PLAN | 프로젝트 환경 변경 |
| EV-S10-03 | §4.1 · CR 등록 절차 · Step 1 | PLAN | 제안자 (전 인력) → Polarion ALM "New Change Request" |
| EV-S10-04 | §4.1 · CR 등록 절차 · Step 2 | PLAN | Polarion ALM 자동 (BSD-CR-NNNN, 4자리 일련번호) |
| EV-S10-05 | §4.1 · CR 등록 절차 · Step 3 | PLAN | 제안자: 제목, 변경 사유, 영향 산출물, 긴급도 |
| EV-S10-06 | §4.2 · CR 등록 필수 정보 · 변경 사유 | PLAN | 발생원 5종 중 1 (NC해결/OEM요구/기술결정/표준변경/환경변경) |
| EV-S10-07 | §4.3 · CR 상태 전이 · 1. Submitted | PLAN | 제안자 등록 완료, QA Lead 분류 대기 |
| EV-S10-08 | §4.2 · CR 등록 필수 정보 · 변경 대상 CI | PLAN | 영향 받는 산출물·코드 ID 목록 (Polarion CI 다중 링크) |
| EV-S10-09 | §4.1 · CR 등록 절차 · Step 4 | PLAN | QA Lead (24h 내) → 영향도 사전 분류 (L/M/H/F) |
| EV-S10-10 | §5 | PLAN | 모든 CR은 CCB 승인 전에 5개 영향 영역에 대해 평가되며 |
| EV-S10-11 | §5.1 · 5개 영향 영역 평가 · 일정 (Schedule) | PLAN | Critical Path 영향, 마일스톤 지연 일수 |
| EV-S10-12 | §3.2 · CCB 구성 · CCB 위원 - 기술 | PLAN | SW Architect (김SW) |
| EV-S10-13 | §6.2 · CCB 심의 절차 · Step 2 | PLAN | WP 책임자가 5 영향 영역 분석서 작성 (3~5일) |
| EV-S10-14 | §9.4 · NC ↔ CR 양방향 추적 · CR → 다른 CR | PLAN | CR이 다른 CR을 트리거하는 경우 (예: NCAP 변경 → 코드 변경) — "Linked CR" 필드 |
| EV-S10-15 | §5.3 · 영향도 평가 산출물 · 영향 CI 매트릭스 | PLAN | Polarion ALM 자동 - CR ↔ 영향 받는 CI 매핑 (전수) |
| EV-S10-16 | §6.1 · 5-Level 승인 권한 · Level 4 | PLAN | 영향도 F (Full) + 예산 ≥ 5% 영향 + 자원 추가 투입 필요 |
| EV-S10-17 | §6.2 · CCB 심의 절차 · Step 5 | PLAN | Approve / Reject / Defer + 사유 + 회의록 작성 (24h 내) |
| EV-S10-18 | §6.2 · CCB 심의 절차 · Step 1 | PLAN | QA Lead가 24h 내 영향도 분류 → 적합한 Level 결정 |
| EV-S10-19 | §5.1 · 5개 영향 영역 평가 · 공수 (Effort) | PLAN | WP별 공수 재산정 (BSD-FEAS-001 §7 PERT 방식) |
| EV-S10-20 | §3.2 · CCB 구성 · CCB 위원 - 형상 | PLAN | CM Lead (PM 겸직) |
| EV-S10-21 | §3.2 · CCB 구성 · 외부 검토자 (수시) | PLAN | OEM 인터페이스 변경 시 입회, 영향도 ≥ High CR 시 의무 |
| EV-S10-22 | §6.1 · 5-Level 승인 권한 · Level 1 | PLAN | WP 책임자 + QA Lead |
| EV-S10-23 | §9 | PLAN | 모든 CR과 그 영향 받는 산출물·NC 사이의 양방향 추적성을 Polarion ALM에서 자동 유지한다. |
| EV-S10-24 | §9.3 · 역방향 추적: CR → 영향 산출물 · 등록 시 | PLAN | 영향 CI 매트릭스 (제안자 작성) |
| EV-S10-25 | §9.4 · NC ↔ CR 양방향 추적 · NC → CR (해결) | PLAN | NC 해결을 위해 산출물·코드 변경 필요 시 → 자동 CR 제안 (Polarion 워크플로우) |
| EV-S10-26 | §9.1 | SELF_DECLARATION | ✓ Polarion ALM의 "Linked Items" 기능으로 양방향 자동 추적. orphan CR 0건 보장. |
| EV-S10-27 | §2.1 · ASPICE SUP.10 BP 매핑 · SUP.10.BP8 | SELF_DECLARATION | 9장 SyRS ↔ CR ↔ 산출물 ↔ NC 추적표 |
| EV-S10-28 | §7 | PLAN | 승인된 CR이 정확히 구현되고 부작용 없이 적용되었는지 검증한다. |
| EV-S10-29 | §7.1 · 구현 검증 4단계 · 3. 검증 | PLAN | QA Lead가 변경 후 산출물·코드 적합성 검증, 회귀 검증 결과 검토 |
| EV-S10-30 | §7.2 · 회귀 검증 결과 판정 · ⚠ Conditional | PLAN | Risk Accepted 결정 (CCB 검토) |
| EV-S10-31 | §4.3 · CR 상태 전이 · 7. Closed | PLAN | 검증 통과, 베이스라인 갱신 완료, 종결 |
| EV-S10-32 | §4.1 · CR 등록 절차 · Step 5 통보 | PLAN | Polarion 자동 → CCB 위원 전체 |
| EV-S10-33 | §6.2 · CCB 심의 절차 · Step 7 | PLAN | 전 관계자 자동 통보 (Polarion 알림) |
| EV-S10-34 | §10.2 · 베이스라인 후 변경 절차 · Step 9 | PLAN | Polarion 상태 → Closed + 통보 |
| EV-S10-35 | §8.1 · CR 추적 KPI | PLAN | Open CR 누적 (Backlog) |
| EV-S10-36 | §2.1 · ASPICE SUP.10 BP 매핑 (8개 BP) · SUP.10.BP1 | SELF_DECLARATION | 변경요청 관리 전략 수립 |
| EV-S10-37 | §11.1 | SELF_DECLARATION | ✓ ASPICE SUP.10 BP1~BP8 (8개 BP) 모두 충족 — Capability Level 1. |
| EV-S10-38 | §7.2 · 회귀 검증 결과 판정 · ⚠ Conditional | PLAN | → Closed with Risk Acceptance (후속 모니터링) |
| EV-S10-39 | §5.2 · 종합 영향도 4등급 · H (High) | PLAN | 전체 SVT 50% (Critical/High 우선순위 9건) |
| EV-S10-40 | §5.2 · 종합 영향도 4등급 · F (Full) | PLAN | 전체 15 SVT 재실행 + Phase 1~4 재수행 |
| EV-S10-41 | §6.2 · CCB 심의 절차 · Step 6 | PLAN | Approved → In Implementation 또는 Rejected (종결) |
| EV-S10-42 | §3.1 | PLAN | ② 영향도 사전 평가 (Pre-Implementation Impact): 5 영향 영역 평가 후 CCB 승인. |
| EV-S10-43 | §5.3 · 영향도 평가 산출물 · 승인 권장 사항 | PLAN | 영향도 종합 등급 + CCB 결정 권장 (Approve / Reject / Defer) |
| EV-S10-44 | §4.2 · CR 등록 필수 정보 · 변경 내용 (After) | PLAN | 변경 후 상태 + 신규 합격 기준 |
| EV-S10-45 | §1.2 · 참조 문서 · [R1] | PLAN | Process Reference Model — SUP.10 (Change Request Management) 8 BPs |
| EV-S10-46 | §4.3 · CR 상태 전이 · 4. Rejected | PLAN | CCB 거절, 사유 기록 |
| EV-S10-47 | §7.2 · CR 상태 전이 · 6. Under Verification | PLAN | 회귀 검증 + 영향도 검증 중 |
| EV-S10-48 | §11.3 | SELF_DECLARATION | ✓ 만장일치 승인. 5-Level 권한 + 7 상태 + 양방향 추적성 + BSD-SVP-001 §8 연동 합의 |
| EV-S10-49 | §3.2 · CCB 구성 · CCB Chair (의장) | PLAN | 월 1회 정기 CCB 의장, 비정기 CCB 소집권, 최종 CR 의사결정 |
| EV-S10-50 | §5.1 · 5개 영향 영역 평가 | PLAN | 공수 (Effort) |
