# aspice-app

Automotive SPICE (CL1–CL3) 평가 도구. 증적 문서를 업로드하면 `aspice-harness` 평가 엔진이 BP/WP/PA 채점, Capability Level 산정, 다중 프로세스 cross-process 정합성/추적성 검사를 수행한다.

기준 문서는 **PAM 4.1 한국어판(v4.1, 2026-08-24)** 과 **VDA ASPICE Guidelines 3rd Edition(2026-07)** 이다. 화면에는 `PAM v4.1 (2026-08-24)` / `Guidelines 3rd Ed. (2026-07)`로 표기하고, BP 제목은 한국어 위에 영문을 회색으로 덧붙인다.

UI는 React + Vite. 백엔드 평가는 Vercel Serverless Functions(`/api/analyze`, `/api/project`)에서 실행되며, 로컬 개발 시에는 `vite.config.js`의 `harnessDevPlugin`이 같은 핸들러를 dev 서버 미들웨어로 연결한다.

## 아키텍처

```
Browser (React SPA)
   │ POST /api/analyze            POST /api/project
   ▼                              ▼
api/analyze.js  ─────┐    ┌────── api/project.js
                     ▼    ▼
              api/_harnessService.js   (오케스트레이션)
                     │
                     ├── _textExtractor.js    PDF/DOCX/text → cleaned text + page map
                     ├── _artifactBuilder.js  payload → harness artifact[]
                     ├── _evidencePages.js    BP evidence ↔ source page 매핑
                     └── _legacyAdapter.js    ProcessVerdict → 레거시 UI shape + 한국어화
                     │
                     ▼
              aspice-harness  (npm workspace: packages/harness)
                Harness · evaluators · knowledge · crossProcess · spec/canonical
```

레거시 UI shape는 `/api/analyze`에만 적용된다 (`VerdictCard`가 소비). `/api/project`는 harness가 반환하는 `ProcessVerdict[]` + `crossProcess` 그대로 응답한다.

## 환경 변수

서버 측 (Vercel · 로컬 dev — `.env`/`aspice.env`에 보관, 절대 커밋 금지):

| 변수 | 필수 | 용도 |
|---|---|---|
| `OPENAI_API_KEY` | engine=`llm`/`hybrid` 사용 시 둘 중 하나 필수 | OpenAI로 LLM 채점 (기본 `gpt-4o`) |
| `ANTHROPIC_API_KEY` | 위와 동일 | Anthropic으로 LLM 채점 (기본 `claude-sonnet-4-6`) |
| `ASPICE_LLM_PROVIDER` | 선택 | `openai` \| `anthropic`로 공급자 고정. 미설정 시 OPENAI 키가 있으면 openai, 없고 ANTHROPIC 키만 있으면 anthropic |
| `ASPICE_LLM_MODEL` | 선택 | 모델 지정 (공급자 기본값 대체) |
| `ASPICE_LLM_CONCURRENCY` | 선택 | 동시 LLM 호출 수 (기본 5) |
| `SUPABASE_JWT_SECRET` | 운영 권장 | `/api/*` Bearer JWT 검증. 미설정 시 인증 스킵(개발용) |

`ASPICE_LLM_*` 는 `api/_llmConfig.js`에서 읽으며 채점 경로(`_harnessService.js`)와 QA 초안 경로에 모두 적용된다.

브라우저로 노출되는 변수는 `VITE_` prefix만 — 위 키들에는 절대 붙이지 말 것.

## 로컬 개발

```bash
npm install                    # npm workspaces: packages/harness 가 aspice-harness 로 링크됨
npm run dev                    # http://localhost:5174 (strictPort)
npm run build                  # dist/ 산출
npm run lint
npm run preview                # http://localhost:4173
```

`aspice-harness`는 이 리포의 npm workspace(`packages/harness`)다. 평가 엔진을 수정하면 dev 서버에 즉시 반영된다. 엔진 테스트는 `cd packages/harness && npm test`.

### 기준 문서(spec) 준비

원문(PAM 4.1 한국어 텍스트, 가이드라인 2026 ko/en 마크다운, 영문 PAM 4.1 canonical)은 저작권 때문에 gitignore되어 있다(`packages/harness/spec/sources/`). 준비 방법은 `packages/harness/spec/sources/README.md`를 따른다. 원문을 배치한 뒤:

```bash
cd packages/harness
npm run extract                # spec/canonical/** 재생성 (원문이 없으면 README 안내와 함께 exit 1)
```

커밋되는 것은 추출 결과(`spec/canonical/**`)뿐이다. 원문 위치는 `ASPICE_SPEC_SOURCES` 환경변수로 바꿀 수 있다. 자세한 내용은 `packages/harness/README.md`.

## 배포 (Vercel)

- `vercel.json`이 `api/analyze.js`, `api/project.js`의 `maxDuration`을 60초로 설정. 다중 프로세스 평가가 이를 초과할 수 있어 Promise.all로 병렬화되어 있음 (`Harness.evaluateProject`).
- 환경 변수는 Vercel Project Settings → Environment Variables에 등록.
- `aspice-harness`는 npm workspace(`packages/harness`)이므로 리포 루트에서 `npm install`이 되는 환경이면 별도 게시 없이 빌드된다. 가이드라인 전문(`spec/canonical/guideline.json`)은 서버 전용이며 브라우저 번들에는 `all.json`(프로세스별 규칙 수 `guidelineRuleCounts` 포함)만 들어간다.

## 디렉터리 구조

```
src/
  App.jsx                Auth 라우팅 (Landing/Login/Signup/Verify ↔ SolutionApp)
  SolutionApp.jsx        per-process · project 두 모드의 메인 컨테이너
  components/            UI 컴포넌트 (ModeToggle, ProcessCard, VerdictCard, …)
  hooks/                 useAnalysis · useProject · useHistory · useProjectHistory · useFontInjector
  auth/                  Supabase 기반 인증 (AuthContext, LoginPage, SignupPage, …)
  data/                  ASPICE 정적 데이터 (aspiceData, formats, detectRules, sampleReport, …)
  utils/                 fileReaders · exportReport · evidence · analysisPrompt
  theme.js               색상/폰트 토큰

api/
  analyze.js             Serverless: 단일 프로세스 평가 (JWT 검증 + handleEvaluate)
  project.js             Serverless: 프로젝트 평가 (JWT 검증 + handleProject)
  _harnessService.js     공통 오케스트레이션 (handleEvaluate · handleProject)
  _textExtractor.js      PDF/DOCX/text 추출 + 페이지 매핑
  _artifactBuilder.js    payload → harness artifact[]
  _evidencePages.js      BP 증거에 source page 번호 부여
  _legacyAdapter.js      ProcessVerdict → 레거시 UI shape + 한국어화

vite.config.js           dev 서버에 /api/* 미들웨어 부착 (harnessDevPlugin)
vercel.json              서버리스 함수 타임아웃 설정
```

## 디버깅 팁

- **PDF 텍스트가 깨짐 (예: `ÆŞÈ`)**: PDF가 ToUnicode CMap 없는 CID 폰트. `_textExtractor.js#cleanText`의 Latin Extended 클러스터 → `□` 치환이 적용되어 채점은 영향 안 받지만 evidence 인용이 사라진다. 원문 PDF를 다시 export하는 게 정공법.
- **BP 점수가 프로세스 모드 vs 프로젝트 모드에서 다름**: `_harnessService.js#filterArtifactsForProcess` 스코핑이 다르게 적용되었을 가능성. 두 모드 모두 같은 함수를 거친다 — 그래도 다르면 인덱싱 시점(`indexArtifacts`)을 확인.
- **`engine=hybrid` 호출이 401`engine=hybrid requires OPENAI_API_KEY`**: 서버 환경변수에 사용 가능한 LLM 키(`OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY`)가 없음. `ASPICE_LLM_PROVIDER`로 고정한 공급자의 키가 비어 있어도 같다. `engine=rule`은 키 없이도 동작.
- **`npm run extract`가 exit 1**: `spec/sources/`에 원문이 없음. `packages/harness/spec/sources/README.md` 참고.
- **`Unauthorized. Sign in required.`**: `SUPABASE_JWT_SECRET`이 설정되어 있는데 클라이언트가 Bearer 토큰을 보내지 않거나 만료. 로컬 검증만 할 거면 `.env`에서 변수 제거 → 인증 스킵 모드.
- **이력이 사라짐**: `useHistory`/`useProjectHistory`는 `localStorage` 기반. 도메인이 바뀌면 분리됨.

## 책임 분리 원칙

- **UI는 평가 로직을 모름**: `aspice-harness`의 ProcessVerdict shape는 `_legacyAdapter.js`에서만 변환. UI 변경이 평가 엔진에 새는 일 없음.
- **`api/_*.js`는 모두 서버 전용**: 브라우저 번들에 들어가면 안 됨. `pdf-parse`·`Buffer` 사용 때문.
- **Spec은 데이터, 코드 아님**: `packages/harness/spec/canonical/**`는 추출기(`npm run extract`) 산출물이다. 직접 수정하지 말고 원문/추출기를 고친다.

## 평가 근거(references)와 등급 조건 후처리

- 인용 형식: `PAM 4.1 §4.4.1 SWE.1.BP2`, `PAM 4.1 §5.3.1 GP 2.1.1`, `PAM 4.1 Annex B 17-00`, `Guideline 2026 §3.8.2.2 [SWE.1.RL.4]`.
- BP/GP/WP 결과는 `references { pam:{citation,page,title}, guideline:[{id,effect,section,page,summary,conditional?,displayOnly?}] }`와 `appliedRules [{ruleId,applied,note,capped?,source?}]`를 싣는다. 프로세스 verdict에는 `meta.ratingConditionRules`가 있다. UI는 `src/components/ReferenceChips.jsx`로 칩 표시한다.
- LLM 채점: 프롬프트에 PAM 4.1 본문과 해당 가이드라인 규칙·노트가 들어가고, LLM이 `guidelineCitations`로 적용 규칙을 돌려준다. 모르는 규칙 ID는 버린다. 적용된 `cap`/`must-downrate` 규칙은 점수를 상한(N=15, P=50, L=85)으로 제한하며, hybrid 융합·다중 엔진 평균 뒤에도 다시 적용된다.
- 룰 채점: 한국어/영문 키워드를 함께 매칭하고 근거를 붙이며, 점수가 51 미만이면 `확인 포인트 [규칙ID]`를 제시한다. 규칙은 점수를 바꾸지 않는다.
- 등급 조건 후처리(`applyRatingConditionRules`): "다른 지표가 이 등급이면 이 지표는 최대 ○"형 규칙은 같은 프로세스 안에서만 BP 평가 후, PA 평가 후에 결정론적으로 적용한다. 다른 프로세스 지표에 의존하는 규칙은 표시만 한다(`displayOnly`).
