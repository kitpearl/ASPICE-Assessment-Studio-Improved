# aspice-harness

Spec-driven **Automotive SPICE** assessment harness (CL1~CL3) with
cross-process consistency, traceability, and change-propagation verification.

판정 기준은 **PAM 4.1 한국어판(v4.1, 2026-08-24)** 과 **VDA ASPICE Guidelines
3rd Edition(2026-07)** 에서 직접 파싱한 canonical JSON(`spec/canonical/`)만을
사용합니다 — 하드코딩된 키워드나 휴리스틱이 아닙니다. 영문 제목·설명은 PAM 4.1
영문 canonical에서 병합해 `titleEn/descriptionEn/notesEn`로 보관합니다.

```
spec/
├── extractor.js              # sources → canonical JSON (진입점)
├── extract/                  # pam41.js · guideline2026.js · mergeEnglish.js · textUtil.js
├── tools/pdf2txt.mjs         # PAM PDF → 텍스트 (npm run pdf2txt)
├── sources/                  # 원문 (gitignore, 로컬 전용) — sources/README.md 참고
├── processGraph.seed.json    # 수작업 curated V-model edges (inputWorkProducts 근거)
└── canonical/                # 자동 생성 (커밋 대상)
    ├── processes/            # 프로세스별 JSON: 한국어 title/description/notes + 영문 *En
    ├── processAttributes.json# PA 1.1 ~ 3.2 + Generic Practices
    ├── workProducts.json     # 부록 B 정보 항목 + 특성(characteristics), 기존 별칭, retired
    ├── guideline.json        # 가이드라인 규칙 254건 + notes (서버 전용)
    ├── all.json              # 브라우저 번들 (guidelineRuleCounts 포함, 규칙 전문 제외)
    ├── ratingScale.json      # N/P-/P+/L-/L+/F + CL 집계 규칙
    ├── processGraph.json     # seed → canonical으로 복사된 edge 그래프
    └── _summary.json         # 추출 요약

src/
├── harness.js                # 런타임 파이프라인 (evaluateProcess / evaluateProject)
├── model/                    # 타입 (JSDoc @typedef)
├── knowledge/                # getBp/Gp/Wp/ProcessKnowledge + 프롬프트 포매터 (PAM 4.1 본문 + 가이드라인 규칙·노트)
├── evaluators/               # BP / WP / PA / CL 평가기 + rule/llm/hybrid scorer + citation guard
│                             #   guidelineEffects(상한 강제) · ratingConditions(등급 조건 후처리)
├── crossProcess/             # traceGraph · traceability · consistency · coverage · changePropagation
├── llm/                      # Anthropic / OpenAI adapters + PAM-인용 강제 프롬프트
└── io/                       # 파일 reader · WPID 인덱서 · 리포터 · excerpt builder

legacy/                       # v0.1.0 (참고용, deprecated)
test/fixtures/project/        # 7-file BMS-Lite 프로젝트 fixture
```

## Rating Scale (6-point extended)

PAM §3.2.2의 ISO/IEC 33020 4-point scale을 intacs 관례에 따라 6단계로 분할한
확장 스케일. BP·GP·PA는 6단계로 표시하고, **CL 집계 시에만** 4단계로 축소하여
표준 규칙을 적용합니다.

| Rating | Range   | BP/GP/PA 표시 | CL 집계 |
|:------:|:-------:|:-------------:|:-------:|
| N      | 0–15%   | N             | N       |
| P-     | 16–32%  | P-            | P       |
| P+     | 33–50%  | P+            | P       |
| L-     | 51–67%  | L-            | L       |
| L+     | 68–85%  | L+            | L       |
| F      | 86–100% | F             | F       |

CL 규칙 (PAM §3.2.2 준용):
- **CL1** = PA 1.1 Fully
- **CL2** = PA 1.1 Fully + PA 2.1/2.2 Largely 이상
- **CL3** = PA 1.1/2.1/2.2 Fully + PA 3.1/3.2 Largely 이상

## Pipeline

```
artifacts → indexArtifacts ──────────────────────┐
                                                  │
                         ┌── evaluateBPs      ────┤
                         ├── evaluateWPs      ────┤
                 ruleScorer / llmScorer /         │
                 hybridScorer                     │
                         ├── evaluatePAs      ────┼─► computeCapabilityLevel
                         │                        │
  crossProcess/ ◄────────┤                        │
    ├─ traceGraph (V-model seed)                  │
    ├─ traceability (bidirectional, per edge)     ▼
    ├─ consistency (ID status drift, 13-51)  ProcessVerdict[]
    ├─ changePropagation (SUP.10 CR → impact)     ↓
    └─ coverage (req 17-* → test 08-6x/15-52)   ProjectVerdict ──► renderReport (md/json)
```

## Scorer 엔진

| 엔진 | 외부 호출 | 장점 | 단점 |
|------|-----------|------|------|
| `rule`   | 없음 | 결정론적, 빠름, 무료. 한국어/영문 키워드를 함께 매칭(언어별 비율이 큰 쪽 채택), 근거(`references`) 첨부, 점수 51 미만이면 `확인 포인트 [규칙ID]` 제시 | 정성 평가 없음, keyword overlap 기반. 가이드라인 규칙은 점수에 개입하지 않음 |
| `llm`    | Anthropic or OpenAI (per BP/WP/GP) | PAM 4.1 본문 + 적용 가능한 가이드라인 규칙·노트를 프롬프트에 주입, PAM/가이드라인 인용 강제 | 호출당 비용·지연 |
| `hybrid` | Anthropic/OpenAI | rule:0.4 + llm:0.6 가중 융합 + 양방향 abstention. 융합 뒤 상한 재적용 | 둘 다 필요 |

**지식 조회 계층** (`src/knowledge/`): `getBpKnowledge / getGpKnowledge /
getWpKnowledge / getProcessKnowledge`가 PAM 본문과 해당 규칙을 모아 프롬프트
문자열로 만든다. 예산: 규칙 최대 12건, 노트 4건 × 1,200자, WP 특성 1,500자.

**인용 강제**: `src/evaluators/citationGuard.js`가 LLM 응답의 인용을 검증한다.
- PAM: `PAM 4.1 §4.4.1 SWE.1.BP2`, `PAM 4.1 §5.3.1 GP 2.1.1`, `PAM 4.1 Annex B 17-00`
- 가이드라인: `Guideline 2026 §3.8.2.2 [SWE.1.RL.4]`
- LLM은 `guidelineCitations`로 적용한 규칙을 돌려주며, 알 수 없는 규칙 ID는 버린다.
- 인용 누락 시 응답 거부 → hybrid에선 rule score 사용.

**가이드라인 상한 강제**: LLM이 "적용됨"으로 판단한 `cap` / `must-downrate`
규칙은 점수를 상한(N=15, P=50, L=85)으로 제한한다. hybrid 융합과 다중 엔진
평균 뒤에도 다시 적용된다.

**등급 조건 후처리**: `applyRatingConditionRules`는 "다른 지표의 등급이 …이면"
조건의 규칙(33건)을 결정론적으로 적용한다. 같은 프로세스 안의 규칙만 강제하며
(BP 평가 후, PA 평가 후 `Harness#evaluateProcess`에서 실행), 타 프로세스 의존
6건은 표시만 한다(`displayOnly`). 적용 내역은 `verdict.meta.ratingConditionRules`.

**결과 필드**: BP/GP/WP 결과는 `references { pam:{citation,page,title},
guideline:[{id,effect,section,page,summary,conditional?,displayOnly?}] }` 와
`appliedRules [{ruleId,applied,note,capped?,source?}]` 를 포함한다.

**LLM 설정** (aspice-app의 `api/_llmConfig.js`): `ASPICE_LLM_PROVIDER`,
`ASPICE_LLM_MODEL`, `ASPICE_LLM_CONCURRENCY`가 채점 경로에도 적용된다. 미지정 시
OPENAI 키만 있으면 openai/gpt-4o, ANTHROPIC 키만 있으면 anthropic/claude-sonnet-4-6.

**Prompt 캐싱**: Anthropic 어댑터는 `system` + `context`(프로세스 스펙 + 증적
발췌) 블록에 `cache_control: ephemeral`을 적용 → 같은 프로세스의 각 BP/GP 호출
사이에 prefix가 재사용됩니다.

## Cross-process 검증

(아래 PAM §표기는 일반 설명용이며, 평가 결과의 인용 형식은 위 "인용 강제" 참고)

- **traceGraph**: `spec/processGraph.seed.json`의 V-model edges를 canonical
  JSON으로 복사해 사용. 각 edge는 구체 WP ID를 지정.
- **traceability**: edge별로 source WP(예: 17-00)가 담고 있는 내부 ID
  (REQ-SYS-001)가 target 프로세스의 output 산출물에 인용되었는지 검증.
  Coverage%, orphan source/target 보고.
- **consistency**: 같은 ID가 여러 산출물에 등장할 때 상태 (`draft`/`review`/
  `approved`/`released`/`obsolete`)가 어긋나면 `status-drift` 경고.
- **coverage**: 17-* 요구사항 ID가 08-6x·15-52 산출물에 인용되는 비율.
- **changePropagation**: 13-16 산출물의 CR ID (`CR-042` 등)가 downstream
  설계·코드·테스트에 전파되었는지 추적. `propagated` / `verification-only` /
  `unresolved` 상태로 분류.

## 설치 및 사용

```bash
npm install
cp .env.example .env                 # (선택) API key 설정
npm run extract                      # spec/sources → spec/canonical/** 재생성
npm test                             # 전체 테스트 (node --test)
```

`npm run extract`는 `spec/sources/`(gitignore)에 원문이 필요하다. 없으면 안내와
함께 exit 1 한다. 준비 방법은 `spec/sources/README.md` — PAM 4.1 한국어 PDF는
`npm run pdf2txt -- <pdf> <txt>`로 텍스트화하고, 가이드라인 2026 ko/en 마크다운과
영문 PAM 4.1 canonical(`pam41-en/`, 운영 저장소에서 복사)을 배치한다. 원문 위치는
`ASPICE_SPEC_SOURCES`로 바꿀 수 있다. 추출 결과(`spec/canonical/**`)만 커밋한다.

### CLI

```bash
# 프로세스 목록
node src/cli.js list

# 단일 프로세스 평가 (오프라인 rule scorer)
node src/cli.js evaluate -p SYS.2 -l 1 -e rule ./evidence/*.md

# 복수 프로세스 (콤마 구분, 자동으로 프로젝트 리포트)
node src/cli.js evaluate -p "SYS.1,SYS.2,SYS.3,SWE.1,SYS.5,SUP.10" -l 2 -e hybrid ./project/*

# 전체 프로세스 + hybrid
node src/cli.js evaluate -p all -l 1 -e hybrid -f markdown -o report.md ./project/*
```

### 프로젝트 리포트 예 (BMS-Lite fixture)

```
## Capability Summary
| Process | CL | PA 1.1 |
|---|:-:|:-:|
| SYS.2 | 0 | P+ |
| SYS.3 | 0 | L- |
| ...

### Traceability Matrix
| From → To | WP | Src IDs | Tgt IDs | Coverage | Orphans |
|---|---|:-:|:-:|:-:|:-:|
| SYS.1 → SYS.2 | 17-00 | 19 | 19 | 100% | 0 / 0 |
| SYS.2 → SYS.3 | 17-00 | 19 | 18 |  95% | 1 / 0 |
| SYS.3 → SYS.5 | 04-06 | 18 | 12 |  61% | 7 / 0 |

### Change Propagation (SUP.10)
- CR-042 [propagated] — touched 3 artifacts
```

## 개발 로드맵

| Phase | 상태 | 내용 |
|-------|------|------|
| 1 — 기반              | ✅ | 디렉토리 스켈레톤, 6-point rating scale, 32 canonical 프로세스 JSON, 스모크 테스트 |
| 2 — 평가기            | ✅ | rule/llm/hybrid scorer, LLM 인용 강제 post-check, Anthropic/OpenAI adapter (caching), CLI engine |
| 3 — Cross-process     | ✅ | V-model seed graph, per-edge traceability, consistency findings, 요구사항→테스트 coverage, SUP.10 CR 전파 분석, 프로젝트 리포트 |
| 4 — 고도화 (미정)      | — | Guideline rule 추출 강화, 증적 자동 인덱싱 개선, UI(`aspice-app`) 통합, 배치/캐시 최적화 |

## 라이선스

MIT
