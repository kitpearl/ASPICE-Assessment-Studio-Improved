# PAM 4.1 · 가이드라인 2026 기반 지식 베이스 설계

- 작성일: 2026-11-12
- 브랜치: `QA-assessment`
- 원본 문서:
  - `AutomotiveSPICE_PAM_41_Korean.pdf` (VDA QMC, PAM 4.1, 2026-08-24, 한국어판)
  - `ASPICE_Guideline_Edition_2026_ko.md` (Automotive SPICE 가이드라인 제3차 개정판 2026-07, 한국어 기계 번역본)
  - `ASPICE_Guideline_Edition_2026.md` (같은 가이드라인 영어 OCR본, 규칙 영문 원문 대조용)

## 1. 배경과 의도

엔진(`packages/harness`)의 판정 기준은 지금까지 PAM v4.0 영문 Markdown과 VDA 가이드라인 2024-03-12에서 추출한 canonical JSON이었다. 두 기준 문서가 PAM 4.1과 가이드라인 2026년판으로 개정되었다. 사용자 요청은 세 가지다.

1. 개정된 두 문서를 **룰 기반 분석의 기준 데이터**로 삼는다.
2. 같은 데이터를 **LLM 분석의 RAG(검색 보강) 데이터**로 삼는다.
3. 프로세스 모드·프로젝트 모드·QA Audit 모드의 **분석 결과에 적극 반영하고 근거로 제시**한다.

현재 상태에서 확인한 문제:

- BP 설명에 PDF 추출 노이즈(표 행 중복, 비고 문장 섞임)가 들어 있다. 예: SWE.1.BP1 설명에 성과 목록과 표 구분자가 그대로 붙어 있다.
- 가이드라인은 `guidelineRules.json`으로 추출되지만 **어떤 분석 경로에서도 읽지 않는다**. 프롬프트에도 들어가지 않고 UI에도 나오지 않는다.
- LLM 프롬프트의 기준 문맥은 "프로세스 목적 한 줄 + BP 한 줄"뿐이다. 비고·성과·정보 항목 특징·가이드라인 규칙이 없다.
- 결과 화면(VerdictCard, ProjectReportCard)에 `pamCitation`이 전달되지만 **표시하지 않는다**. 근거 제시가 없다.
- 룰 스코어러의 키워드 추출은 영문 전용(`[a-z0-9]`)이다. 한국어 산출물은 영문 BP 키워드와만 대조된다.

## 2. 목표 / 비목표 / 실패 조건

**목표**

- PAM 4.1 한국어판에서 32개 프로세스(목적·성과·BP·비고·출력 정보 항목), PA 1.1~3.2(범위·달성·GP·비고), 부록 B 정보 항목 특징 112건을 깨끗하게 추출해 canonical JSON을 교체한다.
- 가이드라인 2026에서 규칙 254건(`[XXX.RL.n]`)을 구조화한다. 각 규칙은 적용 대상(BP/GP/PA), 효과(하향 금지·하향 필수·등급 상한), 출처(절·쪽), 한국어 본문, 영어 원문을 가진다. 프로세스·PA·공통 주제별 해설 문단도 RAG 문맥으로 보관한다.
- 룰 스코어러: 한국어·영어 양쪽 키워드로 대조하고, 결과에 PAM 4.1 인용과 적용 가능한 가이드라인 규칙을 근거로 붙인다.
- LLM 스코어러: 프롬프트에 PAM 4.1 원문(BP 전문·비고·성과·정보 항목 특징)과 해당 BP/GP/WP에 적용되는 가이드라인 규칙·해설을 넣는다. 응답에서 PAM 4.1 인용과 **적용한 가이드라인 규칙 ID**를 받고, 등급 상한 규칙은 점수에 강제한다.
- QA Audit 모드 AI 초안: BP 목록을 PAM 4.1 한국어 본문으로 주고, 해당 프로세스의 가이드라인 규칙을 참고 문맥으로 준다.
- 세 모드의 결과 화면·PDF·텍스트 내보내기에 근거(PAM 4.1 절·쪽, 가이드라인 규칙 ID·요지)를 표시한다.
- 화면·프롬프트·CLI·README의 버전 표기를 PAM 4.1 / 가이드라인 2026으로 바꾼다.

**비목표**

- 임베딩 기반 벡터 검색. "RAG"는 ID 매핑으로 결정론적으로 찾는 구조화 검색이다(프로세스·BP·GP·WP 키로 조회).
- PAM 4.1 영문 PDF의 재추출. 영문은 운영 저장소가 이미 추출한 영문 4.1 canonical을 가져와 키워드 보조·병기용으로만 쓴다.
- CL4·CL5(PA 4.x, 5.x) 평가. 추출은 하되 평가 경로에는 넣지 않는다.
- Cybersecurity PAM, 등급 백분율 경계 변경, 하이브리드 가중치 변경.
- 가이드라인 규칙의 조건을 룰 스코어러가 기계적으로 판정하는 것. 조건("~라면")은 산출물 의미를 읽어야 하므로 LLM만 판정한다. 룰 스코어러는 규칙을 "확인 포인트"로 제시만 한다.

**실패 조건 (동작해도 실패로 보는 경우)**

- 기존 164개 하네스 테스트의 영문 fixture 평가 결과가 깨지는 것(영문 산출물 점수 하락).
- 가이드라인 규칙 ID가 LLM이 지어낸 것인데 화면에 근거로 나오는 것.
- `workProducts.json`의 한국어·영문 alias(스크립트 `scripts/patch-wp-aliases.mjs`로 덧붙인 것)가 재추출로 사라지는 것.
- 브라우저 번들(`all.json`)이 가이드라인 전문까지 품어 크게 커지는 것.
- 프로세스 모드와 프로젝트 모드의 같은 증적에 대한 점수가 서로 달라지는 것(현재 보장 원칙 유지).

## 3. 원본 문서 분석 결과

### 3.1 PAM 4.1 한국어 PDF

- `pdf-parse`로 추출하면 178쪽, 17만 자. 페이지 마커 `<!-- Page N -->`의 N이 인쇄 쪽번호와 같다.
- 4장 프로세스 절: `4.4.1. SWE.1 소프트웨어 요구사항 분석` 형태 제목 → `프로세스 ID / 프로세스 이름 / 프로세스 목적 / 프로세스 성과 1)~ / 기본 사례 / SWE.1.BP1: 제목. 설명 / 비고 n: ...` 순서. 출력 정보 항목 표는 `08-60 검증 방안  X  X` 형식으로 성과 매핑 X표가 붙는다.
- 5장 PA 절: `5.3.1. PA 2.1 ...` → `프로세스 속성 범위 / 프로세스 속성 달성 1)~ / 일반 사례 / GP 2.1.1: 제목. 설명 줄들 / 비고`.
- 부록 B: `ID / 이름 / 특징(식별 항목·포함 사항·예시 및 참조)` 3행 구조, 112개 항목. v4.0 catalog의 118개와 차이가 있으므로 ID 기준으로 병합하고 4.1에 없는 ID는 `retired: true`로 남긴다.
- BP 머리글은 대부분 `SWE.1.BP1:` 형식이지만 콜론이 없는 것(`SYS.4.BP3 `, `SYS.5.BP5 `, `MLE.2.BP4 `)과 점이 빠진 것(`SPL2.BP7:`)이 있다. 파서는 둘 다 허용한다.
- BP 수가 v4.0과 다른 프로세스: MLE.2(7→6, v4.0 BP5 삭제 후 재번호), SPL.2(7→8, BP7 "지원 형태·서비스 수준·기간 의사소통"이 한국어판에 있음). 나머지 30개는 수가 같다.
- 영문 본문은 운영 저장소(`C:\workspace\assessment-studio\backend\src\main\resources\spec\canonical`)가 영문 PAM 4.1 PDF에서 이미 추출한 canonical(프로세스 32개, BP `notes` 214건, PA 1.1~3.2)을 가져온다. 거기에는 SPL.2.BP7이 없으므로 그 BP만 영문이 비고, 그 외는 BP ID로 1:1 대응한다.
- 등급 척도(3.2.2, 표 6~8)는 v4.0과 같다. `ratingScale.json`은 출처 표기만 PAM 4.1로 바꾼다.

### 3.2 가이드라인 2026 한국어 Markdown

- 규칙은 모두 줄 시작 `[TAG] 본문` 형식, 254건 고유. 영어본과 태그가 1:1로 맞는다(단 `PA.3.2.RL.10` ↔ `PA3.2.RL.10` 표기 차이 하나).
- 태그 접두: 프로세스(`SWE.1`), PA(`PA2.1`), 공통 주제(`GEN` 일반, `TAC` 추적성·일관성, `COM` 의사소통, `MBD` 모델 기반 개발, `AGE` 애자일, `DEX` 외부 개발, `APA` 적용 파라미터).
- 효과 문구 통계(254건): "하향 평가해서는 안 된다" 91, "하향 평가해야 한다" 108, "P보다 높게 등급 평가해서는 안 된다" 29, "L보다 높게" 8, "F로 등급 평가해서는 안 된다" 10, "N으로 등급 평가해야 한다" 2, 그 외(일관성 요구 등) 소수.
- 대상 표기: 대부분 `SWE.1.BP5`, `GP 2.1.1`처럼 완전한 ID. 일부는 절 안에서 `지표 BP2`처럼 프로세스를 생략하므로 소속 절(3.x 프로세스, 4.x/5.x PA)에서 보충한다.
- `SYS.2.RL.5`는 한·영 모두 OCR로 등급 값이 빠져 있다. 같은 취지의 `SWE.1.RL.4`가 N이므로 N 상한으로 두고 `inferred: true`를 표시한다(내 결정).
- 페이지 마커 `<!-- PDF page N (printed p.M) -->` 292개. 인용에는 인쇄 쪽(M)을 쓴다.
- 영어본에 없는 태그: `MLE.3.RL.1`, `PA3.2.RL.14`(영문 본문 없음으로 둔다).
- **등급 조건 규칙** 33건: 조건이 산출물 내용이 아니라 다른 지표의 등급이다. 두 형태가 있다.
  - 명시 등급: "BP3이 N 또는 P로 등급 평가된다면 PA 1.1을 L보다 높게…"(SUP.1.RL.3 등).
  - 사유 한정 하향: "GP 2.1.1이 …에 적합하지 않아 하향 평가된다면 GP 2.1.2를 하향…"(PA2.1.RL.9 등). 사유는 기계로 확인할 수 없다.
  - 이 중 7건(MAN.3.RL.17~21, REU.2.RL.3, PIM.3.RL.3)은 **다른 프로세스**의 BP 등급에 의존한다.
- 해설 문단: 3.x 프로세스 절의 "일반 정보"와 각 규칙 소절의 설명, 4.x/5.x PA 절, 2.3.4(추적성)·2.3.5(의사소통)·2.5.x(특정 환경) 등이 RAG 문맥 후보다.

## 4. 데이터 설계

### 4.1 원본 보관 (`packages/harness/spec/sources/`)

원격 저장소가 공개(public)이므로 **VDA 문서 원문은 git에 넣지 않는다**(사용자 결정). `spec/sources/`는 `.gitignore`에 넣고, `spec/sources/README.md`(커밋)에 어떤 파일을 어디서 가져와 두는지 적는다. 추출 결과 JSON은 런타임에 필요하므로 커밋한다.

| 파일 (gitignore) | 내용 |
|---|---|
| `spec/sources/AutomotiveSPICE_PAM_41_ko.txt` | PDF에서 추출한 텍스트(페이지 마커 포함). `node spec/tools/pdf2txt.mjs <pdf> <txt>`로 재생성 |
| `spec/sources/ASPICE_Guideline_2026_ko.md` | 한국어 가이드라인 원본 복사 |
| `spec/sources/ASPICE_Guideline_2026_en.md` | 영어 가이드라인 원본 복사(규칙 영문 대조용) |
| `spec/sources/pam41-en/processes/*.json`, `pam41-en/processAttributes.json` | 운영 저장소의 영문 PAM 4.1 canonical 복사(영문 제목·설명·비고 출처) |

기존 루트의 `Automotive-SPICE-PAM-v40.md`, `ASPICE Guideline_20240312.md`는 git에서 제거하고(`git rm`) 더 이상 읽지 않는다. 추출기는 원문이 없으면 명확한 오류 메시지와 함께 중단한다.

### 4.2 canonical 산출물 (`spec/canonical/`)

**`processes/<ID>.json`** (교체)

```json
{
  "id": "SWE.1",
  "name": "소프트웨어 요구사항 분석",
  "nameEn": "Software Requirements Analysis",
  "category": "SWE",
  "pamVersion": "4.1",
  "pamSection": "4.4.1",
  "page": 49,
  "purpose": "프로세스 목적은 ... 수립하는 것이다.",
  "outcomes": [{ "id": 1, "text": "소프트웨어 요구사항이 명세된다." }],
  "basePractices": [{
    "id": "BP1",
    "title": "소프트웨어 요구사항을 명세한다",
    "description": "시스템 요구사항과 시스템 아키텍처를 사용하여 ... 문서화한다.",
    "notes": ["비고 1: 요구사항의 특징은 ...", "비고 2: ..."],
    "titleEn": "Specify software requirements",
    "descriptionEn": "Use the system requirements and the system architecture to identify ...",
    "page": 50,
    "pamCitation": "PAM 4.1 §4.4.1 SWE.1.BP1"
  }],
  "outputWorkProducts": [{ "id": "17-00", "name": "요구사항", "nameEn": "Requirement" }],
  "inputWorkProducts": [],
  "traceBPs": ["BP5"]
}
```

- `title`/`description`/`notes`/`purpose`/`outcomes`는 PAM 4.1 한국어가 권위 본문이다.
- `titleEn`/`descriptionEn`/`notesEn`은 운영 저장소의 영문 PAM 4.1 canonical에서 같은 BP ID로 가져온다(SPL.2.BP7만 영문 없음). `nameEn`(프로세스), PA의 `nameEn`/`scopeEn`, GP의 `titleEn`/`descriptionEn`도 같은 출처다.
- `traceBPs`는 제목·설명에 "추적성" 또는 "일관성"이 들어간 BP.
- `pamCitation` 형식: `PAM 4.1 §<절> <프로세스>.<BP>`. 쪽은 `page`로 따로 둔다.

**`processAttributes.json`** (교체): PA 1.1~5.2를 모두 추출하되 평가기는 기존대로 `level <= targetLevel`만 쓴다. GP는 `{id, title, description, notes[], page, pamCitation: "PAM 4.1 §5.3.1 GP 2.1.1"}`.

**`workProducts.json`** (병합): ID별 `{id, name(한), nameEn(v4.0 영문), aliases(기존 유지 + 한국어 이름이 5자 이상이면 추가), characteristics: {summary, identifies[], includes[], examples[]}, page, retired?}`. 4.1에 없는 v4.0 ID는 `retired: true`로 유지해 기존 alias 탐지와 테스트를 깨지 않는다.

**`guideline.json`** (신규, 브라우저 번들에 넣지 않음)

```json
{
  "version": "Automotive SPICE Guidelines 3rd Edition 2026-07",
  "rules": [{
    "id": "SWE.1.RL.4",
    "scope": { "kind": "process", "id": "SWE.1" },
    "targets": [{ "kind": "bp", "process": "SWE.1", "id": "BP2" }],
    "effect": { "kind": "cap", "maxRating": "N" },
    "condition": { "kind": "evidence" },
    "text": "\"기능\"과 \"비기능\"이 유일한 요구사항 범주화 또는 분류 기준이라면, SWE.1.BP2를 N으로 등급 평가해야 한다.",
    "textEn": "If “functional” and “non-functional” are the only requirements categorization or classification criterion, then SWE.1.BP2 shall be rated as N.",
    "section": "3.8.2.2 요구사항의 구조화",
    "page": 120,
    "citation": "Guideline 2026 §3.8.2.2 [SWE.1.RL.4]"
  }],
  "notes": {
    "process": { "SWE.1": [{ "heading": "3.8.1.2 운영 환경에 대한 영향", "text": "...", "page": 119 }] },
    "pa": { "PA 2.1": [ ... ] },
    "topic": { "TAC": [ ... ], "COM": [ ... ], "MBD": [ ... ], "AGE": [ ... ], "DEX": [ ... ], "APA": [ ... ], "GEN": [ ... ] }
  }
}
```

효과 분류 규칙(한국어 본문 기준, 미판정 시 영어 본문으로 재시도):

| 문구 | effect |
|---|---|
| 하향 평가해서는 안 된다 | `must-not-downrate` |
| 하향 평가해야 한다 | `must-downrate` (F 불가, 상한 85) |
| N으로 등급 평가해야 한다 | `cap` N (상한 15) |
| P보다 높게 등급 평가해서는 안 된다 | `cap` P (상한 50) |
| L보다 높게 등급 평가해서는 안 된다 / F로 등급 평가해서는 안 된다 | `cap` L (상한 85) |
| 그보다 높게 등급 평가해서는 안 된다 | `cap-source` (조건 지표의 점수를 상한으로) |
| 그 외 | `other` (점수 미개입, 근거 표시만) |

조건 분류(`condition`):

| 형태 | condition |
|---|---|
| 산출물 내용 조건(기본) | `{ "kind": "evidence" }` — LLM만 판정 |
| "X가 N 또는 P로 등급 평가된다면" | `{ "kind": "rating", "source": {kind, process?, id}, "when": ["N","P"] }` |
| "X가 …때문에 하향 평가된다면" (사유 한정) | `{ "kind": "rating", "source": …, "when": ["N","P"], "reasonQualified": true }` — 사유는 확인할 수 없으므로 출처 지표가 N/P일 때만 성립으로 본다(보수적 해석, 내 결정). LLM 프롬프트에도 넣어 사유가 맞으면 LLM이 적용할 수 있게 한다 |
| 출처 지표가 다른 프로세스 | 위에 `"crossProcess": true` — 점수에 개입하지 않고 근거로만 표시 |

대상 식별: 본문의 `XXX.n.BPm`, `GP d.d.d`, `PA d.d`; 프로세스 절 안의 `BPm`/`지표 BPm`은 절의 프로세스로 보충; PA 절 안의 `지표 d.d.d`는 GP로 보충. 공통 주제 규칙은 명시 대상이 있으면 그 대상에, 없으면 주제 코드로만 남긴다.

해설 문단: 각 `#####`/`######` 소절을 하나의 note로 만들고, 규칙 줄과 페이지 마커는 제외하며, 1,200자에서 자른다.

**`all.json`** (브라우저 번들): 기존 구성에 `version: "aspice-v4.1"`, `sources` 메타를 더한다. 가이드라인은 넣지 않는다. BP `notes`는 넣는다(프로세스 카드에서 BP 설명을 보여 줄 수 있도록).

### 4.3 추출기

`spec/extractor.js`를 PAM 4.1 텍스트·가이드라인 2026 파서로 다시 쓴다. 모듈을 나눈다.

- `spec/extract/pam41.js`: 프로세스·PA·부록 B 파서.
- `spec/extract/guideline2026.js`: 규칙·해설 파서, 영어 본문 대조.
- `spec/extract/mergeEnglish.js`: 영문 PAM 4.1 canonical(`spec/sources/pam41-en/`)의 제목·설명·비고 병합, 기존 `workProducts.json`의 영문 이름·alias 유지.
- `spec/extractor.js`: 조립과 파일 출력, `_summary.json`.

`npm run extract`로 전체 재생성, 결과 JSON은 git에 커밋한다(Vercel 빌드가 추출을 돌리지 않으므로).

## 5. 지식 조회 계층 (RAG)

`packages/harness/src/knowledge/index.js` (신규, Node 전용):

```js
getBpKnowledge(processId, bpId)  // → { pam: {...}, guideline: { rules: [...], notes: [...] } }
getGpKnowledge(paId, gpId)
getWpKnowledge(processId, wpId)  // 부록 B 특징 포함
getProcessKnowledge(processId)   // 프로세스 전체(QA 모드, 프롬프트 공용 문맥)
```

적용 규칙 선택:

- BP: `targets`에 해당 프로세스·BP가 있는 규칙 + `TAC` 규칙(해당 BP가 `traceBPs`일 때) + `COM` 규칙(제목에 "의사소통"이 있을 때). `MBD/AGE/DEX/APA` 규칙은 명시 대상이 그 BP일 때만 포함하고 `conditional: "<주제명>"`을 달아 조건부임을 알린다.
- GP: `targets`에 해당 GP 또는 그 PA가 있는 규칙. `GEN` 규칙은 PA 1.1에.
- WP: 규칙은 붙이지 않고 부록 B 특징만 준다.
- 프롬프트 예산: 규칙 최대 12건, 해설 note 최대 4건(각 1,200자), 부록 B 특징 최대 1,500자. 초과분은 자른다.

각 조회 결과는 `references` 객체도 만든다(결과에 그대로 실림):

```json
{
  "pam": { "citation": "PAM 4.1 §4.4.1 SWE.1.BP2", "page": 50, "title": "소프트웨어 요구사항을 구조화한다" },
  "guideline": [{ "id": "SWE.1.RL.4", "effect": "cap:N", "section": "3.8.2.2", "page": 120, "summary": "\"기능/비기능\"만이 분류 기준이면 BP2는 N" }]
}
```

## 6. 평가기 변경

### 6.1 룰 스코어러

- 키워드: `extractKeywords`를 `extractKeywordsBilingual`로 확장. 한국어 토큰화는 공백·문장부호로 나누고 뒤 조사(을/를/이/가/은/는/의/에/에서/과/와/로/으로/및/등/도)를 떼며 2자 이상 한글 토큰을 쓴다. 불용어(한다/있다/대한/위한/따라/통해/경우/수행/정의 등 PAM 상투어)를 뺀다. 영어 키워드는 `titleEn + descriptionEn`에서 기존 방식으로 뽑는다.
- 점수: 한국어 키워드 적중률과 영어 키워드 적중률을 따로 구해 **큰 쪽**을 쓴다. 한국어 산출물은 한국어 키워드로, 영문 산출물은 영문 키워드로 평가되어 기존 영문 fixture 점수가 유지된다. 가중치(컨텍스트 적합도)는 기존대로 적용한다.
- WP 이름 매칭 후보: `aliases ∪ {nameEn} ∪ {name(5자 이상일 때)}`.
- 결과에 `references`를 붙인다. 점수가 51% 미만이면 적용 가능한 가이드라인 규칙 중 `must-not-downrate` 2건까지를 "확인 포인트: [SWE.1.RL.7] 도구 속성으로 분석을 입증하면 하향 금지" 형태로 `gaps`에 덧붙인다. 점수는 바꾸지 않는다.

### 6.2 LLM 스코어러

- 프롬프트(system): "Automotive SPICE PAM 4.1 및 VDA 가이드라인 제3판(2026)에 따라 평가하는 심사원". 가이드라인 규칙은 조건이 성립할 때만 적용하고, 적용한 규칙만 `guidelineCitations`에 넣으라고 지시한다.
- 프롬프트(context, 캐시 블록): 프로세스 목적·성과 전체, 평가 대상 BP 전문(설명·비고), 출력 정보 항목 목록, 프로세스 가이드라인 해설 note, 적용 가능한 규칙 목록(ID·효과·본문). GP·WP도 같은 구성(WP는 부록 B 특징).
- 응답 JSON에 `guidelineCitations: [{ "ruleId": "SWE.1.RL.4", "applied": true, "note": "..." }]`를 추가한다.
- 인용 검증(`citationGuard.js`): PAM 인용 정규식에 `PAM 4.1 §...`를 허용한다(`PAM §...`도 계속 허용). `guidelineCitations`는 알려진 규칙 ID만 남기고 나머지는 버린다(응답 전체는 거부하지 않음). 남은 항목은 `appliedRules`로 정규화한다.
- 점수 강제(`applyGuidelineEffects`): `applied: true`인 규칙이 `cap`이면 `scorePercent`를 상한으로 깎고, `must-downrate`면 85로 깎는다. 깎였으면 `gaps`에 "가이드라인 [ID] 적용: 상한 N" 한 줄을 넣는다. `must-not-downrate`는 점수를 바꾸지 않는다.
- 결과에 `references`(5절)와 `appliedRules`를 실린다.

### 6.3 하이브리드 · 다중 엔진 평균

- 융합 점수에도 `appliedRules`의 상한을 다시 적용한다(룰 점수가 상한을 넘겨 끌어올리지 못하게). `references`는 LLM 쪽을 우선하고 없으면 룰 쪽을 쓴다.
- `_harnessService.js`의 평균 스코어러도 같은 함수를 호출한다.

### 6.4 평가기 오케스트레이터

`bpEvaluator`/`wpEvaluator`/`paEvaluator`가 스코어러 결과의 `references`·`appliedRules`를 결과 객체에 그대로 싣는다. `pamCitation`은 `references.pam.citation`과 같은 값으로 채운다.

### 6.5 등급 조건 규칙 후처리 (`applyRatingConditionRules`)

`Harness#evaluateProcess`에서 BP 평가 후(PA 1.1 집계 전)와 GP 평가 후에 한 번씩 돈다.

- 대상: `condition.kind === "rating"`이고 `crossProcess`가 아닌 규칙. 출처 지표(같은 프로세스의 BP, 같은 PA 또는 하위 PA의 GP)의 현재 등급이 `when`에 들면 성립.
- 성립 시 효과 적용: `cap`은 상한 백분율로 절단, `cap-source`는 출처 지표의 `scorePercent`를 상한으로, `must-downrate`는 85로 절단. 깎인 결과에는 `appliedRules`에 `{id, effect, source: "rule-engine"}`을 추가하고 `gaps`에 "가이드라인 [ID] 적용: BP1이 P이므로 상한 …" 한 줄을 넣는다.
- 출처가 PA 1.1 자체인 규칙(SUP.1.RL.3 등)은 PA 1.1 점수에 적용한다.
- `crossProcess` 7건은 `references.guideline`에 `displayOnly: true`로 실어 화면에서 "타 프로세스 등급 조건"으로 표시만 한다. 프로세스 모드·프로젝트 모드의 점수 일치 원칙을 지키기 위해서다(사용자 결정).
- 이 단계는 스코어러 종류와 무관하게 돈다(rule/llm/hybrid/custom 모두).

### 6.6 LLM 공급자

채점 경로(`_harnessService.js`)는 지금 `openai`/`gpt-4o` 고정이다. QA 초안 경로와 같은 규칙(`ASPICE_LLM_PROVIDER`, `ASPICE_LLM_MODEL`, 키 존재 순)으로 공급자를 고르게 맞춘다. 기본 동작(OPENAI 키만 있을 때 gpt-4o)은 바뀌지 않는다. 프롬프트 문맥 예산은 5절 수치로 시작하고, 로컬 측정에서 프로세스당 60초를 넘기면 해설 note 수부터 줄인다.

## 7. 모드별 반영

### 7.1 프로세스 모드 (`/api/analyze`, VerdictCard)

- `_legacyAdapter.toLegacyShape`가 BP별 `references`·`appliedRules`를 통과시킨다.
- BP 행에 "근거" 줄을 추가한다: PAM 칩(`PAM 4.1 §4.4.1 SWE.1.BP2 · p.50`)과 가이드라인 칩(`[SWE.1.RL.4] N 상한`, `[SWE.1.RL.7] 하향 금지`). 칩을 누르면 규칙 본문이 펼쳐진다. 적용된(점수에 반영된) 규칙은 색을 달리한다.
- 텍스트·PDF 내보내기(`exportReport.js`)에 근거 줄을 넣는다.
- ProcessCard의 BP 목록은 한국어 제목을 보여 주고, 영문 제목을 작게 덧붙인다.

### 7.2 프로젝트 모드 (`/api/project`, ProjectReportCard)

- BP 표·GP 표의 약점 열 아래에 근거(PAM 인용 + 가이드라인 ID 목록)를 한 줄로 표시한다.
- PDF 내보내기(`exportProjectReport.js`)에 같은 줄을 넣고, 보고서 머리에 "기준: PAM 4.1 (2026-08-24), Guidelines 3rd Ed. (2026-07)"을 적는다.

### 7.3 QA Audit 모드 (`/api/qa-draft`, 초안 편집기)

- `draft.js` 프롬프트: 시스템 문구를 "ASPICE 4.1"로, BP 목록을 PAM 4.1 한국어 제목·설명으로 주고, 프로세스별 가이드라인 규칙(최대 12건)을 "참고 규칙" 문맥으로 준다. `rationale`에 사용한 규칙 ID를 괄호로 적게 한다.
- `draft.js`는 브라우저 안전 모듈이므로 규칙 목록은 서버(`_qaDraftService.js`)가 `getProcessKnowledge`로 만들어 `generateDrafts`에 넘긴다.
- 응답 구조·sanitize·확정 로직은 바꾸지 않는다.

### 7.4 버전 표기

AppHeader·AppFooter·LandingPage·HelpModal·exportHelpGuide·exportReport·exportProjectReport·프롬프트(bp/gp/wp/draft)·cli·README(루트, harness)를 "PAM v4.1 (2026-08-24) · Guidelines 3rd Ed. (2026-07)"로 바꾼다.

## 8. 테스트

- 추출기: 32개 프로세스, SWE.1 BP 6개·성과 7개, SYS.4 BP 5개(콜론 없는 BP3 포함), MLE.2 BP 6개, SPL.2 BP 8개(`SPL2.BP7` 오타 허용), PA 1.1~3.2 존재와 GP 수(2.1: 6, 2.2: 4, 3.1: 4, 3.2: 4), 부록 B 112건, SWE.1.BP1 `notes` 4건, `titleEn` 존재(SWE.1.BP1)와 부재(SPL.2.BP7), WP alias 유지(17-00에 "srs"), 4.1에 없는 v4.0 WP ID `retired`.
- 가이드라인: 규칙 254건, `SWE.1.RL.4` → 대상 SWE.1.BP2·효과 cap N·영문 본문 존재·page 120, `PA2.1.RL.1` → 대상 GP 2.1.1·must-not-downrate, `SUP.10.RL.1` → 대상 SUP.10.BP2(절 보충)·cap L, `PA3.2.RL.10` 태그 정규화, `SYS.2.RL.5` inferred, `SUP.1.RL.3` → condition rating(source BP3, when N/P)·대상 PA 1.1·cap L, `MAN.3.RL.17` → crossProcess, `SUP.10.RL.5` → cap-source, `PA2.1.RL.9` → reasonQualified.
- 등급 조건 후처리: SUP.10에서 BP2가 P일 때 BP3이 BP2 점수를 넘지 못함, SUP.1에서 BP3이 N일 때 PA 1.1 상한 85, 조건 불성립 시 무변경, crossProcess 규칙은 점수 불변.
- 지식 조회: SWE.1.BP5에 TAC 규칙 포함, SWE.1.BP6에 COM 규칙 포함, SWE.3.BP4에 MBD.RL.5가 conditional로 포함, 예산 초과 시 절단.
- 룰 스코어러: 한국어 산출물이 한국어 BP 키워드로 L 이상 획득, 기존 영문 fixture 테스트 전부 통과, `references` 존재, 저점수 시 확인 포인트 gaps.
- 인용 검증·효과 강제: `PAM 4.1 §4.4.1 SWE.1.BP2` 통과, 미지 규칙 ID 제거, cap N 적용 시 15로 절단, 하이브리드 융합 후에도 상한 유지.
- 어댑터: `toLegacyShape` 출력에 `references` 포함.
- 프론트: `npm run lint`, `npm run build` 통과. 화면 확인은 로컬 기동 후 수동.

## 9. 단계 (구현 순서)

1. 원본 보관과 PDF 텍스트 추출 도구.
2. PAM 4.1 파서 + legacy 병합 + 테스트.
3. 가이드라인 2026 파서 + 테스트.
4. 지식 조회 계층 + 테스트.
5. 룰 스코어러 양언어 키워드·근거 + 테스트.
6. 인용 검증·효과 강제 + LLM 프롬프트 + 하이브리드/평균 반영 + 테스트.
7. 평가기·어댑터·API 결과 shape.
8. QA 초안 프롬프트.
9. UI 근거 표시, 내보내기, 버전 표기.
10. README·harness README 갱신, 전체 테스트·lint·build.

## 10. 결정 사항

**사용자가 정한 것 (2026-11-12)**

- 대상은 `aspice-app`이다. 추출 JSON은 독립 파일로 만들어 운영 저장소(`assessment-studio`)에도 복사해 쓸 수 있게 한다. 운영 이식 자체는 이 작업 범위 밖이다.
- 영문 BP 본문은 운영 저장소의 영문 PAM 4.1 canonical을 재사용한다.
- 등급 조건 규칙은 프로세스 안의 것만 결정론적 후처리로 강제하고, 타 프로세스 의존 7건은 표시만 한다.
- VDA 원문은 gitignore하고 추출 JSON만 커밋한다.

**내가 정한 것**

- 한국어 PAM 4.1 본문을 권위 텍스트로 삼는다. 화면의 BP 제목·설명이 한국어로 바뀌고 영문은 작게 덧붙인다.
- 산출물 내용 조건 규칙의 점수 개입은 LLM이 "적용됨"이라고 판단한 규칙에 한해 상한만 강제한다. 룰 스코어러는 규칙을 근거·확인 포인트로만 쓴다.
- 사유 한정 등급 조건("…때문에 하향 평가된다면")은 출처 지표가 N/P일 때만 성립으로 본다.
- `SYS.2.RL.5`의 누락된 등급 값은 N으로 추정한다.
- 가이드라인 전문은 서버 전용 JSON으로 두고 브라우저 번들에 넣지 않는다. 화면은 API 응답의 `references`만 쓴다. 프로세스 카드의 "Guideline" 통계는 번들에 넣는 프로세스별 규칙 수로 바꾼다.
- 4.1에서 사라진 v4.0 정보 항목 ID는 `retired`로 남긴다.
- 출력 정보 항목↔성과 매핑(X표)은 텍스트 추출에서 열 위치를 복원할 수 없어 추출하지 않는다.
- 채점 경로의 LLM 공급자 선택을 QA 초안 경로와 같은 환경변수 규칙으로 맞춘다.
