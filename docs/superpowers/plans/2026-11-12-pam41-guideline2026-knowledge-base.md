# PAM 4.1 · 가이드라인 2026 지식 베이스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평가 엔진의 기준 데이터를 PAM 4.1 한국어판 + VDA 가이드라인 2026으로 교체하고, 룰·LLM 채점과 세 모드의 결과 화면이 그 데이터를 근거로 쓰고 보여 주게 한다.

**Architecture:** `packages/harness/spec`의 추출기가 원문(gitignore)에서 canonical JSON(커밋)을 만든다. 새 `src/knowledge` 모듈이 프로세스·BP·GP·WP 키로 PAM 본문과 가이드라인 규칙을 조회해 룰 스코어러·LLM 프롬프트·QA 초안에 공급하고, 결과 객체에 `references`/`appliedRules`를 실어 API와 UI까지 전달한다. 가이드라인 등급 조건 규칙은 Harness 안의 후처리 단계가 결정론적으로 적용한다.

**Tech Stack:** Node 20 ESM, `node --test`, pdf-parse, React 19 + Vite, OpenAI/Anthropic SDK.

**Spec:** `docs/superpowers/specs/2026-11-12-pam41-guideline2026-knowledge-base-design.md`

## Global Constraints

- 원문 파일(`packages/harness/spec/sources/**`)은 git에 넣지 않는다. 추출 JSON(`spec/canonical/**`)은 커밋한다.
- 원문이 없는 환경(CI, Vercel)에서도 `npm test`가 통과해야 한다. 원문을 읽는 테스트는 파일이 없으면 `skip`한다.
- 기존 영문 fixture(`test/fixtures/**`)의 룰 스코어러 점수와 164개 기존 테스트의 통과 상태를 유지한다.
- 브라우저 번들 `spec/canonical/all.json`에 가이드라인 규칙 본문·해설을 넣지 않는다(프로세스별 규칙 수만).
- 인용 형식: PAM은 `PAM 4.1 §<절> <ID>` (예 `PAM 4.1 §4.4.1 SWE.1.BP2`, `PAM 4.1 §5.3.1 GP 2.1.1`), 가이드라인은 `Guideline 2026 §<절> [<규칙ID>]`.
- 등급 상한 백분율: N=15, P=50, L=85 (`ratingScale.json`의 max 값).
- 프롬프트 예산: 규칙 최대 12건, 해설 note 최대 4건(각 1,200자), 부록 B 특징 최대 1,500자.
- 테스트 명령은 항상 `packages/harness`에서 `node --test test/<file>.test.js`. 백엔드 Gradle·`gradlew --stop`과 무관한 저장소다.
- 커밋 단계는 사용자가 커밋을 허용했을 때만 실행한다. 허용이 없으면 작업 트리에 두고 다음 작업으로 넘어간다.
- 한글이 들어가는 파일 내용은 Bash heredoc으로 쓰지 않는다(깨짐). Write/Edit 도구를 쓴다.

## Review Focus

1. 한국어 산출물만 올렸을 때 BP가 영문 키워드 때문에 0점이 되지 않아야 한다 → Task 4 테스트 `bilingual: korean-only artifact scores by korean keywords`.
2. LLM이 존재하지 않는 규칙 ID(`SWE.1.RL.99`)를 인용해도 응답이 버려지지 않고 그 ID만 제거되어야 한다 → Task 7 테스트 `normalizeGuidelineCitations drops unknown ids`.
3. 하이브리드에서 룰 점수가 LLM이 적용한 상한(N=15)을 넘겨 융합 점수를 끌어올리면 안 된다 → Task 8 테스트 `hybrid keeps applied cap after fusion`.
4. 등급 조건 후처리가 조건 불성립(출처 BP가 L 이상)일 때 점수를 바꾸면 안 되고, 타 프로세스 규칙은 어떤 경우에도 점수를 바꾸면 안 된다 → Task 9 테스트 두 건.
5. 원문이 없는 환경에서 `npm run extract`는 명확한 오류로 멈추고 `npm test`는 통과해야 한다 → Task 5 테스트 `extractor exits with message when sources missing`.

---

### Task 1: 원문 보관 구조와 PDF 텍스트 추출 도구

**Files:**
- Create: `packages/harness/spec/tools/pdf2txt.mjs`
- Create: `packages/harness/spec/sources/README.md`
- Create: `packages/harness/spec/sources/.gitkeep`
- Modify: `.gitignore` (루트)
- Modify: `packages/harness/package.json` (scripts)
- Delete(git rm): `packages/harness/Automotive-SPICE-PAM-v40.md`, `packages/harness/ASPICE Guideline_20240312.md`

**Interfaces:**
- Produces: 로컬 파일 `spec/sources/AutomotiveSPICE_PAM_41_ko.txt`(페이지 마커 `<!-- Page N -->`), `spec/sources/ASPICE_Guideline_2026_ko.md`, `spec/sources/ASPICE_Guideline_2026_en.md`, `spec/sources/pam41-en/processes/*.json`, `spec/sources/pam41-en/processAttributes.json`. 이후 모든 추출 작업이 이 경로를 읽는다.
- 스크립트: `npm run pdf2txt -- <pdf> <txt>`.

- [ ] **Step 1: `.gitignore`에 추가**

```
packages/harness/spec/sources/*
!packages/harness/spec/sources/README.md
!packages/harness/spec/sources/.gitkeep
```

- [ ] **Step 2: `spec/tools/pdf2txt.mjs` 작성** — `pdf-parse`의 `pagerender`로 텍스트 아이템을 y좌표 차 2 이상이면 줄바꿈, x 간격 2 이상이면 공백으로 이어 붙이고, 페이지마다 `\n<!-- Page N -->\n`을 앞에 붙여 UTF-8로 쓴다. 인자: `process.argv[2]` 입력 PDF, `[3]` 출력 txt. 끝에 `pages N chars M`을 출력한다. (세션 스크래치패드의 `tools/pdf2txt.mjs`와 같은 로직. `createRequire`는 harness의 `package.json` 기준.)

- [ ] **Step 3: `package.json` scripts에 `"pdf2txt": "node spec/tools/pdf2txt.mjs"` 추가**

- [ ] **Step 4: 원문을 `spec/sources/`에 둔다**

```bash
cd packages/harness
npm run pdf2txt -- "C:/Users/LG/OneDrive - 브이웨이/바탕 화면/AssessmentStudio/AutomotiveSPICE_PAM_41_Korean.pdf" spec/sources/AutomotiveSPICE_PAM_41_ko.txt
cp "C:/Users/LG/OneDrive - 브이웨이/바탕 화면/AssessmentStudio/ASPICE_Guideline_Edition_2026_ko.md" spec/sources/ASPICE_Guideline_2026_ko.md
cp "C:/Users/LG/OneDrive - 브이웨이/바탕 화면/AssessmentStudio/ASPICE_Guideline_Edition_2026.md" spec/sources/ASPICE_Guideline_2026_en.md
mkdir -p spec/sources/pam41-en && cp -r C:/workspace/assessment-studio/backend/src/main/resources/spec/canonical/processes spec/sources/pam41-en/ && cp C:/workspace/assessment-studio/backend/src/main/resources/spec/canonical/processAttributes.json spec/sources/pam41-en/
```

Expected: `pages 178 chars 170547` 근처, `git status`에 sources 파일이 나타나지 않음.

- [ ] **Step 5: `spec/sources/README.md` 작성** — 위 다섯 파일의 이름, 출처(사용자 OneDrive 바탕 화면 폴더 `AssessmentStudio`, 운영 저장소 canonical), 재생성 명령, "공개 저장소라 원문은 커밋하지 않는다"는 이유를 적는다.

- [ ] **Step 6: 옛 원문 제거**

```bash
git rm "packages/harness/Automotive-SPICE-PAM-v40.md" "packages/harness/ASPICE Guideline_20240312.md"
```

- [ ] **Step 7: 커밋(허용 시)** `chore(spec): PAM 4.1·가이드라인 2026 원문 보관 구조와 pdf2txt 도구`

---

### Task 2: PAM 4.1 한국어 파서

**Files:**
- Create: `packages/harness/spec/extract/pam41.js`
- Create: `packages/harness/spec/extract/textUtil.js`
- Test: `packages/harness/test/extractPam41.test.js`

**Interfaces:**
- Produces:
  - `parsePam41(text: string) → { processes: ProcessDraft[], processAttributes: Record<string, PaDraft>, informationItems: Record<string, InfoItemDraft> }`
  - `ProcessDraft = { id, name, category, pamSection, page, purpose, outcomes: [{id, text}], basePractices: [{id, title, description, notes: string[], page, pamCitation}], outputWorkProducts: [{id, name}], traceBPs: string[] }`
  - `PaDraft = { id, level, name, pamSection, page, scope, achievements: [{id, text}], genericPractices: [{id, title, description, notes: string[], page, pamCitation}] }`
  - `InfoItemDraft = { id, name, page, characteristics: { summary, identifies: string[], includes: string[], examples: string[] } }`
  - `textUtil.js`: `stripNoise(text) → string` (빈 줄, `©`로 시작하는 줄, `VDA Quality Management Center` 줄, 쪽번호만 있는 줄 제거하되 `<!-- Page N -->`은 유지), `pageAt(lines, index) → number`, `joinWrapped(lines) → string` (줄바꿈을 공백으로 합치고 다중 공백 정리).
- 테스트는 `spec/sources/AutomotiveSPICE_PAM_41_ko.txt`가 없으면 `t.skip()`.

- [ ] **Step 1: 실패하는 테스트 작성** (`test/extractPam41.test.js`)

```js
const SRC = resolve(__dirname, "../spec/sources/AutomotiveSPICE_PAM_41_ko.txt");
const text = existsSync(SRC) ? readFileSync(SRC, "utf8") : null;
test("pam41: 32 processes with expected BP counts", { skip: !text }, () => {
  const { processes } = parsePam41(text);
  assert.equal(processes.length, 32);
  const counts = Object.fromEntries(processes.map((p) => [p.id, p.basePractices.length]));
  assert.equal(counts["SWE.1"], 6);
  assert.equal(counts["SYS.4"], 5);   // "SYS.4.BP3 " 콜론 없음
  assert.equal(counts["MLE.2"], 6);   // "MLE.2.BP4 " 콜론 없음
  assert.equal(counts["SPL.2"], 8);   // "SPL2.BP7:" 점 누락
  assert.equal(counts["MAN.3"], 10);
});
test("pam41: SWE.1 fields", { skip: !text }, () => {
  const p = parsePam41(text).processes.find((x) => x.id === "SWE.1");
  assert.equal(p.name, "소프트웨어 요구사항 분석");
  assert.equal(p.pamSection, "4.4.1");
  assert.equal(p.page, 49);
  assert.match(p.purpose, /^프로세스 목적은 시스템 요구사항 및 시스템 아키텍처와 일관된/);
  assert.equal(p.outcomes.length, 7);
  const bp1 = p.basePractices[0];
  assert.equal(bp1.title, "소프트웨어 요구사항을 명세한다");
  assert.match(bp1.description, /^시스템 요구사항과 시스템 아키텍처를 사용하여/);
  assert.doesNotMatch(bp1.description, /비고/);
  assert.equal(bp1.notes.length, 4);
  assert.match(bp1.notes[0], /^비고 1: 요구사항의 특징은/);
  assert.equal(bp1.page, 50);
  assert.equal(bp1.pamCitation, "PAM 4.1 §4.4.1 SWE.1.BP1");
  assert.deepEqual(p.outputWorkProducts.map((w) => w.id).sort(), ["13-51", "13-52", "15-51", "17-00", "17-54"]);
  assert.equal(p.outputWorkProducts.find((w) => w.id === "17-00").name, "요구사항");
  assert.deepEqual(p.traceBPs, ["BP5"]);
});
test("pam41: BP description keeps bullet items and excludes scoreboard rows", { skip: !text }, () => {
  const p = parsePam41(text).processes.find((x) => x.id === "SYS.4");
  assert.match(p.basePractices[0].description, /검증 방안의 기법/);
  assert.equal(p.basePractices.filter((b) => b.id === "BP1").length, 1);
});
test("pam41: process attributes PA 1.1..5.2 and GP shapes", { skip: !text }, () => {
  const { processAttributes: pas } = parsePam41(text);
  assert.deepEqual(Object.keys(pas), ["PA 1.1","PA 2.1","PA 2.2","PA 3.1","PA 3.2","PA 4.1","PA 4.2","PA 5.1","PA 5.2"]);
  assert.equal(pas["PA 2.1"].level, 2);
  assert.equal(pas["PA 2.1"].name, "프로세스 수행 관리");
  assert.equal(pas["PA 2.1"].achievements.length, 8);
  assert.equal(pas["PA 2.1"].genericPractices.length, 6);
  assert.equal(pas["PA 2.2"].genericPractices.length, 4);   // "GP 2.2.1 제목." 콜론 없음
  const gp = pas["PA 2.1"].genericPractices[0];
  assert.equal(gp.id, "GP 2.1.1");
  assert.equal(gp.title, "프로세스 수행에 대한 목표를 식별하고 전략을 정의한다");
  assert.match(gp.description, /프로세스 활동 범위가/);
  assert.ok(gp.notes.length >= 3);
  assert.equal(gp.pamCitation, "PAM 4.1 §5.3.1 GP 2.1.1");
  assert.equal(pas["PA 1.1"].genericPractices[0].id, "GP 1.1.1");
});
test("pam41: annex B information items", { skip: !text }, () => {
  const { informationItems } = parsePam41(text);
  assert.equal(Object.keys(informationItems).length, 112);
  const it = informationItems["01-50"];
  assert.equal(it.name, "통합된 소프트웨어");
  assert.match(it.characteristics.summary, /^여러 소프트웨어 컴포넌트를 통합하여/);
  assert.deepEqual(it.characteristics.identifies, ["모든 구성된 소프트웨어 엘리먼트"]);
  assert.deepEqual(it.characteristics.includes, ["적용 매개변수"]);
  assert.deepEqual(it.characteristics.examples, ["스터빙이 포함된 시뮬레이터", "객체 코드"]);
  assert.equal(informationItems["17-00"].name, "요구사항");
});
```

- [ ] **Step 2: 실행해 실패 확인** `node --test test/extractPam41.test.js` → `Cannot find module .../spec/extract/pam41.js`

- [ ] **Step 3: `textUtil.js`와 `pam41.js` 구현**

파서 결정 사항(시그니처와 테스트가 정하지 않는 것):
- 프로세스 절 머리글: `^(\d\.\d+\.\d+)\.\s+([A-Z]{3}\.\d+)\s+(.+)$`, 목차 줄(점선 `\.{5,}` 포함)은 제외. 절 범위는 다음 머리글 또는 `^5\.\s+프로세스 능력 수준` 비목차 줄까지.
- 절 안 순서: `프로세스 목적` 다음 줄들 → `프로세스 성과`까지 purpose; `n)` 항목이 outcomes(이어지는 줄은 앞 항목에 붙임); `기본 사례` 이후 BP 블록; 절 끝의 스코어보드(`^<ID> <이름>\n성과\n1\n…` 이후)는 `출력 정보 항목` 줄 다음의 `^(\d{2}-\d{2})\s+(\S.*?)(\s+X)*\s*$` 행만 outputWorkProducts로 쓰고 `BPn: … X` 행은 버린다.
- BP 머리글 정규식: `^([A-Z]{3})\.?(\d+)\.BP(\d+):?\s+(.*)$`, 프로세스 ID는 절의 ID와 비교해 다르면 무시. 제목은 첫 문장(첫 `. ` 또는 `다.` 뒤 공백)까지, 끝의 마침표 제거. 설명은 제목 뒤부터 다음 BP·`비고 n:`·스코어보드 전까지, `•` 항목은 ` • 항목` 형태로 한 문단에 합친다. `비고 n:`으로 시작하는 블록은 다음 `비고`/BP까지를 한 note로 합쳐 `notes`에 넣는다. 페이지는 BP 머리글 줄의 `pageAt`.
- PA 절 머리글: `^(\d\.\d\.\d)\.\s+(PA \d\.\d)\s+(.+?)\s*프로세스 속성\s*$`(이름에서 "프로세스 속성" 접미 제거). GP 머리글: `^(GP \d\.\d\.\d):?\s+(.*)$`, 스코어보드 행(` X` 끝)은 제외. 설명은 머리글 이후 `비고`가 아닌 줄들을 합친다.
- 부록 B: `부록 B` 비목차 줄부터 `부록 C`까지. `^\d{2}-\d{2}\s*$` 줄이 항목 시작, 다음 줄이 이름, 그 다음부터 다음 항목 전까지가 특징. `식별 항목:`, `포함 사항:`, `예시 및 참조:` 머리로 구간을 나누고 `•` 항목을 배열로, 첫 구간 전 텍스트를 `summary`로. `ID  이름  특징` 머리행과 `표 B. 2` 줄은 버린다.
- `traceBPs`: 제목+설명에 `추적성` 또는 `일관성`이 있는 BP ID.

- [ ] **Step 4: 테스트 통과 확인** `node --test test/extractPam41.test.js` → 5 pass

- [ ] **Step 5: 커밋(허용 시)** `feat(spec): PAM 4.1 한국어 파서`

---

### Task 3: 가이드라인 2026 파서

**Files:**
- Create: `packages/harness/spec/extract/guideline2026.js`
- Test: `packages/harness/test/extractGuideline2026.test.js`

**Interfaces:**
- Produces: `parseGuideline2026(koText: string, enText: string|null) → { version: string, rules: Rule[], notes: { process: Record<procId, Note[]>, pa: Record<paId, Note[]>, topic: Record<topicCode, Note[]> } }`
  - `Rule = { id, scope: {kind: "process"|"pa"|"topic", id}, targets: Target[], effect: {kind: "must-not-downrate"|"must-downrate"|"cap"|"cap-source"|"other", maxRating?: "N"|"P"|"L"}, condition: {kind: "evidence"} | {kind: "rating", source: Target, when: ("N"|"P")[], reasonQualified?: true, crossProcess?: true}, text, textEn: string|null, section, page, citation, inferred?: true }`
  - `Target = {kind: "bp", process, id} | {kind: "gp", id} | {kind: "pa", id}` (`id`는 `BP2`, `GP 2.1.1`, `PA 1.1` 형식)
  - `Note = { heading, text, page }` (text 1,200자 절단)
- 테스트는 원문이 없으면 skip.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test("guideline: 254 unique rules", { skip: !ko }, () => {
  const g = parseGuideline2026(ko, en);
  assert.equal(g.rules.length, 254);
  assert.equal(new Set(g.rules.map((r) => r.id)).size, 254);
  assert.ok(g.rules.find((r) => r.id === "PA3.2.RL.10").textEn.startsWith("If the indicator GP 3.1.1"));  // EN 태그 PA.3.2 정규화
  assert.equal(g.rules.find((r) => r.id === "MLE.3.RL.1").textEn, null);
});
test("guideline: SWE.1.RL.4 cap N on SWE.1.BP2", { skip: !ko }, () => {
  const r = rules.find((x) => x.id === "SWE.1.RL.4");
  assert.deepEqual(r.scope, { kind: "process", id: "SWE.1" });
  assert.deepEqual(r.targets, [{ kind: "bp", process: "SWE.1", id: "BP2" }]);
  assert.deepEqual(r.effect, { kind: "cap", maxRating: "N" });
  assert.deepEqual(r.condition, { kind: "evidence" });
  assert.equal(r.section, "3.8.2.2 요구사항의 구조화");
  assert.equal(r.page, 120);
  assert.equal(r.citation, "Guideline 2026 §3.8.2.2 [SWE.1.RL.4]");
});
test("guideline: effects", { skip: !ko }, () => {
  assert.deepEqual(by("PA2.1.RL.1").effect, { kind: "must-not-downrate" });
  assert.deepEqual(by("PA2.1.RL.1").targets, [{ kind: "gp", id: "GP 2.1.1" }]);
  assert.deepEqual(by("SUP.10.RL.1").targets, [{ kind: "bp", process: "SUP.10", id: "BP2" }]);  // "지표 BP2" 절 보충
  assert.deepEqual(by("SUP.10.RL.1").effect, { kind: "cap", maxRating: "L" });                  // "F로 등급 평가해서는 안 된다"
  assert.deepEqual(by("MBD.RL.5").effect, { kind: "cap", maxRating: "P" });                      // "P보다 높게"
  assert.deepEqual(by("MBD.RL.5").targets, [{ kind: "bp", process: "SWE.3", id: "BP4" }]);
  assert.deepEqual(by("MBD.RL.5").scope, { kind: "topic", id: "MBD" });
  assert.deepEqual(by("SYS.2.RL.5").effect, { kind: "cap", maxRating: "N" });
  assert.equal(by("SYS.2.RL.5").inferred, true);
  assert.deepEqual(by("PIM.3.RL.2").effect, { kind: "other" });
});
test("guideline: rating conditions", { skip: !ko }, () => {
  assert.deepEqual(by("SUP.1.RL.3").condition, { kind: "rating", source: { kind: "bp", process: "SUP.1", id: "BP3" }, when: ["N", "P"] });
  assert.deepEqual(by("SUP.1.RL.3").targets, [{ kind: "pa", id: "PA 1.1" }]);
  assert.deepEqual(by("SUP.1.RL.3").effect, { kind: "cap", maxRating: "L" });
  assert.deepEqual(by("SUP.10.RL.5").effect, { kind: "cap-source" });
  assert.equal(by("PA2.1.RL.9").condition.reasonQualified, true);
  assert.deepEqual(by("PA2.1.RL.9").condition.source, { kind: "gp", id: "GP 2.1.1" });
  assert.equal(by("MAN.3.RL.17").condition.crossProcess, true);
  assert.deepEqual(by("MAN.3.RL.17").condition.source, { kind: "bp", process: "MAN.5", id: "BP5" });
  assert.equal(rules.filter((r) => r.condition.kind === "rating").length, 33);
  assert.equal(rules.filter((r) => r.condition.crossProcess).length, 7);
});
test("guideline: notes", { skip: !ko }, () => {
  const n = g.notes.process["SWE.1"];
  assert.ok(n.some((x) => x.heading.startsWith("3.8.1.2") && /운영 환경/.test(x.text)));
  assert.ok(n.every((x) => x.text.length <= 1200 && !/\[SWE\.1\.RL\.\d+\]/.test(x.text)));
  assert.ok(g.notes.pa["PA 2.1"].length >= 3);
  assert.ok(g.notes.topic.TAC.length >= 1 && g.notes.topic.DEX.length >= 1);
  assert.equal(g.version, "Automotive SPICE Guidelines 3rd Edition 2026-07");
});
```

- [ ] **Step 2: 실행해 실패 확인** → 모듈 없음

- [ ] **Step 3: `guideline2026.js` 구현**

결정 사항:
- 줄 단위로 훑으며 현재 제목 스택(`#`~`######`), 현재 인쇄 쪽(`<!-- PDF page N (printed p.M) -->`의 M)을 추적한다.
- 규칙 줄: `^\[([A-Za-z]+(?:\.\d+)?(?:\.\d)?)\.(RL|RC)\.(\d+)\]\s*(.+)$`. 태그에서 `PA.3.2` → `PA3.2`로 정규화한 뒤 id는 `<prefix>.RL.<n>`.
- scope: prefix가 `[A-Z]{3}\.\d+`면 process, `PA\d\.\d`면 pa(id는 `PA 3.2`), 그 외 topic.
- 조건부/효과부 분리: 마지막 쉼표(`, `) 뒤를 효과부로, 없으면 전체를 효과부로 본다.
- targets: 효과부에서 `([A-Z]{3}\.\d+)\.BP(\d+)`, `(?:지표 )?BP(\d+)`(scope가 process일 때 그 프로세스로 보충), `GP ?(\d\.\d\.\d)`, `지표 (\d\.\d\.\d)`(GP), `PA ?(\d\.\d)`. 중복 제거. "BP5와 BP6"처럼 여러 개면 모두.
- effect: 효과부 문구 매칭 순서 — `N으로 등급 평가해야` → cap N; `P보다 높게` → cap P; `L보다 높게` → cap L; `F로 등급 평가해서는 안` → cap L; `그보다 높게` → cap-source; `하향 평가해서는 안 된다` → must-not-downrate; `하향 평가해야 한다` → must-downrate; 그 외 other. `SYS.2.RL.5`처럼 `…로 등급 평가해야 한다`로 등급이 비면 `cap N` + `inferred: true`.
- condition: 조건부에 `(N|P)(?: 또는 (N|P))?로 등급 평가된다면` → rating(when [N,P]); `하향 평가된다면` → rating(when [N,P], reasonQualified true); source는 조건부에서 targets와 같은 방식으로 찾은 첫 지표(괄호 안 `(MAN.5.BP5)` 포함). source의 프로세스가 scope 프로세스와 다르면 `crossProcess: true`. 그 외 evidence. GEN.RL.1처럼 source를 찾지 못하면 evidence로 둔다.
- `textEn`: EN 파일에서 같은 정규식으로 태그→본문 맵을 만들어 붙인다(없으면 null).
- notes: 규칙 줄·페이지 마커·`**등급 평가 규칙:**` 줄을 제외한 본문을 가장 깊은 제목 단위로 모은다. 소속: 제목 경로에 `#### 3.n <PROC>`가 있으면 process[그 ID], `#### 4.n PA 2.1`/`#### 5.n PA 3.1`이 있으면 pa, `2.3.4`→TAC, `2.3.5`→COM, `2.5.1`→MBD, `2.5.2`→AGE, `2.5.3`→DEX, `2.5.4`→APA, `1.4.2`→GEN. 빈 note는 버린다.
- `section`: 규칙이 속한 가장 깊은 제목에서 `#` 제거한 문자열.

- [ ] **Step 4: 테스트 통과 확인** → 5 pass

- [ ] **Step 5: 커밋(허용 시)** `feat(spec): 가이드라인 2026 규칙·해설 파서`

---

### Task 4: 한·영 키워드 추출과 룰 스코어러 양언어 매칭

**Files:**
- Create: `packages/harness/src/io/keywords.js`
- Modify: `packages/harness/src/io/excerpt.js` (`extractKeywords` 재export 유지)
- Modify: `packages/harness/src/evaluators/ruleScorer.js`
- Test: `packages/harness/test/keywords.test.js`, `packages/harness/test/ruleScorer.test.js`(추가)

**Interfaces:**
- Produces:
  - `extractKoreanKeywords(text: string, max = 10) → string[]`
  - `extractBilingualKeywords({ ko, en }: {ko?: string, en?: string}, max = 10) → { ko: string[], en: string[] }`
  - `bpKeywordSources(bp) → { ko: string, en: string }` (`title+description` / `titleEn+descriptionEn`, 없으면 빈 문자열)
  - 룰 스코어러 내부 `matchBilingual(kwSets, artifacts, matchIndex) → { ratio, evidence, missing, perArtifactHits }` — 언어별 가중 적중률 중 큰 쪽을 `ratio`로.
- 현재 canonical(영문만)에서도 동작: `ko` 키워드가 비면 `en`만, 그 반대도 같다.

- [ ] **Step 1: 실패하는 테스트 작성** (`test/keywords.test.js`)

```js
test("korean keywords strip particles and stopwords", () => {
  const kws = extractKoreanKeywords("소프트웨어 요구사항을 구조화하고 우선순위를 정한다. 소프트웨어 요구사항의 분석을 수행한다.");
  assert.ok(kws.includes("요구사항"));
  assert.ok(kws.includes("우선순위"));
  assert.ok(kws.includes("구조화"));
  assert.ok(!kws.includes("정한다") && !kws.includes("수행") && !kws.includes("을"));
});
test("bilingual keeps both sets", () => {
  const r = extractBilingualKeywords({ ko: "양방향 추적성을 수립한다", en: "Establish bidirectional traceability" });
  assert.ok(r.ko.includes("추적성") && r.en.includes("traceability"));
  assert.deepEqual(extractBilingualKeywords({ en: "Establish bidirectional traceability" }).ko, []);
});
```

`test/ruleScorer.test.js`에 추가:

```js
test("ruleScorer.scoreBP bilingual: korean-only artifact scores by korean keywords", async () => {
  const bp = { id: "BP5", title: "일관성을 보장하고 양방향 추적성을 수립한다", description: "소프트웨어 요구사항과 시스템 요구사항 간의 일관성을 보장하고 양방향 추적성을 수립한다.", titleEn: "Ensure consistency and establish bidirectional traceability", descriptionEn: "Ensure consistency and establish bidirectional traceability between software requirements and system requirements." };
  const r = await ruleScorer.scoreBP({ process: { id: "SWE.1" }, bp, artifacts: [{ name: "추적성매트릭스.xlsx", text: "본 문서는 소프트웨어 요구사항과 시스템 요구사항 간 양방향 추적성과 일관성을 보장하기 위한 추적성 매트릭스이다." }] });
  assert.ok(r.scorePercent >= 51, `got ${r.scorePercent}`);
});
test("ruleScorer.scoreBP bilingual: english artifact unaffected by korean keywords", async () => {
  // 같은 bp, 영문 산출물
  assert.ok(r.scorePercent >= 51);
});
```

- [ ] **Step 2: 실행해 실패 확인** → `keywords.js` 없음 / 한국어 BP가 0점

- [ ] **Step 3: 구현**

- `extractKoreanKeywords`: `[^\p{Script=Hangul}A-Za-z0-9]+`로 나누고, 한글 토큰에서 뒤 조사(`을|를|이|가|은|는|의|에|에서|과|와|로|으로|및|등|도|에게|까지|부터`)를 떼고, 2자 이상만, 불용어(`한다|있다|없다|된다|대한|위한|따라|통해|경우|수행|정의|보장|수립|식별|문서화|기반|사용|해당|관련|포함|다음|또는|그리고|예를|들어|기본|사례|비고|프로세스|작업|산출물`)를 뺀 뒤 빈도순 상위 `max`.
- `ruleScorer.scoreBP/scoreGP`: `extractBilingualKeywords` 사용, 두 언어 각각 기존 `matchKeywords`로 돌려 `weighted/total` 비율이 큰 쪽의 evidence·missing·perArtifactHits를 채택한다. 두 집합이 모두 비면 기존 `empty()`.
- `scoreWP` 이름 매칭 후보: `[...(wp.aliases ?? []), wp.nameEn, wp.name?.length >= 5 ? wp.name : null].filter(Boolean)`.
- `excerpt.js`의 `extractKeywords`는 그대로 두고 `keywords.js`에서 import해 재export한다(`llmScorer`가 쓴다).

- [ ] **Step 4: 전체 테스트** `npm test` → 기존 164 + 신규 4 모두 pass

- [ ] **Step 5: 커밋(허용 시)** `feat(harness): 룰 스코어러 한·영 양언어 키워드 매칭`

---

### Task 5: 영문 병합·추출기 조립·canonical 재생성

**Files:**
- Create: `packages/harness/spec/extract/mergeEnglish.js`
- Rewrite: `packages/harness/spec/extractor.js`
- Modify: `packages/harness/spec/canonical/ratingScale.json` (`basedOn`: `"ISO/IEC 33020:2019 (PAM v4.1 §3.2.2) 4-point ordinal scale"`)
- Regenerate: `spec/canonical/processes/*.json`, `processAttributes.json`, `workProducts.json`, `guideline.json`, `all.json`, `_summary.json`; `guidelineRules.json` 삭제
- Modify: `packages/harness/spec/canonical/index.js` (`loadGuideline()` 추가)
- Modify: `packages/harness/package.json` exports에 `"./spec/canonical/guideline.json"`은 추가하지 않음(서버 내부용) — `index.js`의 `loadGuideline`만 공개
- Modify: `packages/harness/test/extractor.test.js`
- Test: `packages/harness/test/extractorCli.test.js`

**Interfaces:**
- `mergeEnglish({ processes, processAttributes }, enDir: string) → void` (in place): 프로세스 `nameEn`, BP `titleEn/descriptionEn/notesEn`, PA `nameEn/scopeEn`, GP `titleEn/descriptionEn`.
- `mergeWorkProducts(prev: Record<string, WP>, items: Record<string, InfoItemDraft>, enNames: Record<string, string>) → Record<string, WP>`: `WP = { id, name, nameEn, aliases, characteristics?, page?, retired? }`. `prev` alias 유지, 한국어 이름 5자 이상이면 alias에 추가, 4.1에 없는 ID는 `retired: true`.
- canonical 로더: `loadGuideline() → { version, rules, notes }` (파일 없으면 `{version:"", rules:[], notes:{process:{},pa:{},topic:{}}}`).
- `all.json`: `{ version: "aspice-v4.1", sources: { pam: "Automotive SPICE PAM 4.1 (Korean) 2026-08-24", guideline: "Automotive SPICE Guidelines 3rd Edition 2026-07" }, ratingScale, processes, processAttributes(level<=3), workProducts, processGraph, guidelineRuleCounts: Record<procId, number> }`.
- 프로세스 JSON에 `pamVersion: "4.1"`; `inputWorkProducts`는 기존처럼 seed에서.

- [ ] **Step 1: `extractor.test.js` 기대값을 4.1로 고친다**

```js
test("canonical: 32 processes from PAM 4.1", ...)   // id 목록 동일
test("canonical: SWE.1 korean primary with english aid", () => {
  const p = loadProcess("SWE.1");
  assert.equal(p.pamVersion, "4.1");
  assert.equal(p.name, "소프트웨어 요구사항 분석");
  assert.equal(p.nameEn, "Software Requirements Analysis");
  assert.equal(p.basePractices.length, 6);
  assert.equal(p.basePractices[0].titleEn, "Specify the software requirements");
  assert.equal(p.basePractices[0].notes.length, 4);
  assert.equal(p.basePractices[0].pamCitation, "PAM 4.1 §4.4.1 SWE.1.BP1");
  assert.ok(p.inputWorkProducts.length > 0);
});
test("canonical: SYS.2 structure", () => { /* 기존 SYS.2 테스트의 name→"시스템 요구사항 분석", purpose 정규식→/구조화되고 분석된 시스템 요구사항/, 나머지 동일 */ });
test("canonical: SPL.2 has BP7 without english", () => {
  const bp7 = loadProcess("SPL.2").basePractices.find((b) => b.id === "BP7");
  assert.ok(bp7 && !bp7.titleEn);
});
test("canonical: PA 1.1 ~ 3.2 only in loader, GP english present", () => {
  const pas = loadProcessAttributes();
  assert.deepEqual(Object.keys(pas).sort(), ["PA 1.1","PA 2.1","PA 2.2","PA 3.1","PA 3.2"]);
  assert.equal(pas["PA 2.1"].genericPractices[0].titleEn, "Identify the objectives and define a strategy for the performance of the process");
});
test("canonical: work products keep aliases, add korean names, mark retired", () => {
  const wps = loadWorkProducts();
  assert.ok(wps["17-00"].aliases.includes("srs"));
  assert.equal(wps["17-00"].name, "요구사항");
  assert.equal(wps["17-00"].nameEn, "Requirement");
  assert.ok(wps["01-50"].characteristics.examples.length === 2);
  assert.equal(Object.values(wps).filter((w) => !w.retired).length, 112);
});
test("canonical: guideline loads", () => {
  const g = loadGuideline();
  assert.equal(g.rules.length, 254);
  assert.ok(g.notes.process["SWE.1"].length > 0);
});
test("canonical: all.json bundle excludes guideline text", () => {
  const all = JSON.parse(readFileSync(resolve(__dirname, "../spec/canonical/all.json"), "utf8"));
  assert.equal(all.version, "aspice-v4.1");
  assert.equal(all.guidelineRuleCounts["SWE.1"], 10);
  assert.equal(all.guideline, undefined);
});
```

`test/extractorCli.test.js`:

```js
test("extractor exits with message when sources missing", () => {
  const r = spawnSync(process.execPath, ["spec/extractor.js"], { cwd: HARNESS, env: { ...process.env, ASPICE_SPEC_SOURCES: join(tmpdir(), "no-such-dir") }, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /spec\/sources\/README\.md/);
});
```

- [ ] **Step 2: 실행해 실패 확인** `node --test test/extractor.test.js test/extractorCli.test.js`

- [ ] **Step 3: `mergeEnglish.js`와 새 `extractor.js` 구현** — 원문 경로는 `process.env.ASPICE_SPEC_SOURCES ?? resolve(__dirname, "sources")`. 필수 파일이 없으면 stderr에 누락 파일명과 `spec/sources/README.md` 안내를 쓰고 `process.exit(1)`. 순서: PAM 파싱 → 영문 병합 → 기존 `workProducts.json` 읽어 `mergeWorkProducts` → 가이드라인 파싱 → seed 병합(`inputWorkProducts`) → 파일 출력. `processAttributes.json`은 PA 1.1~3.2만 쓴다(4.x/5.x는 `_summary.json`에 수만 기록). 영문 이름 맵은 기존 `workProducts.json`의 `name`을 `nameEn`으로 쓴다.

- [ ] **Step 4: 재생성** `npm run extract` → `32 processes`, `254 rules` 출력. `git diff --stat spec/canonical`로 `guidelineRules.json` 삭제와 신규 `guideline.json` 확인.

- [ ] **Step 5: 전체 테스트** `npm test` → 전부 pass (ruleScorer 기존 영문 테스트는 Task 4 덕분에 유지; `qa*` 테스트가 BP 제목 영문에 의존하면 한국어 제목으로 기대값만 고친다)

- [ ] **Step 6: 커밋(허용 시)** `feat(spec): PAM 4.1·가이드라인 2026 canonical 재생성`

---

### Task 6: 지식 조회 계층

**Files:**
- Create: `packages/harness/src/knowledge/index.js`
- Create: `packages/harness/src/knowledge/select.js`
- Modify: `packages/harness/src/index.js`, `packages/harness/package.json` exports에 `"./knowledge": "./src/knowledge/index.js"`
- Test: `packages/harness/test/knowledge.test.js`

**Interfaces:**
- `getBpKnowledge(processId, bpId) → BpKnowledge | null`
  - `BpKnowledge = { process: {id, name, nameEn, purpose, outcomes}, bp: {id, title, titleEn, description, notes}, outputWorkProducts, guideline: { rules: Rule[], notes: Note[] }, references: References }`
  - `References = { pam: { citation, page, title }, guideline: Array<{ id, effect: string, section, page, summary, conditional?: string, displayOnly?: true }> }` — `effect` 문자열은 `"cap:N"`, `"cap:P"`, `"cap:L"`, `"cap-source"`, `"must-downrate"`, `"must-not-downrate"`, `"other"`. `summary`는 규칙 본문 80자 절단.
- `getGpKnowledge(paId, gpId) → { pa: {id, name, scope, achievements}, gp: {...}, guideline, references }`
- `getWpKnowledge(processId, wpId) → { wp: {id, name, nameEn, characteristics}, references: { pam: { citation: "PAM 4.1 Annex B <id>", page, title } , guideline: [] } }`
- `getProcessKnowledge(processId) → { process, guideline: { rules(최대 12, 프로세스 scope 우선), notes } }`
- `selectRulesForBp(rules, process, bp) → Rule[]`, `selectRulesForGp(rules, paId, gpId) → Rule[]` (select.js, 순수 함수)
- `formatRulesForPrompt(rules) → string` (`- [ID] (효과) 본문` 한 줄씩), `formatNotesForPrompt(notes) → string`
- 예산 상수: `MAX_RULES = 12`, `MAX_NOTES = 4`, `NOTE_CHARS = 1200`, `WP_CHARS = 1500`.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test("knowledge: SWE.1.BP2 gets its own rules and references", () => {
  const k = getBpKnowledge("SWE.1", "BP2");
  const ids = k.guideline.rules.map((r) => r.id);
  assert.ok(ids.includes("SWE.1.RL.4") && ids.includes("SWE.1.RL.5") && ids.includes("SWE.1.RL.6"));
  assert.ok(!ids.includes("SWE.1.RL.1"));
  assert.equal(k.references.pam.citation, "PAM 4.1 §4.4.1 SWE.1.BP2");
  assert.equal(k.references.pam.page, 50);
  assert.ok(k.references.guideline.find((g) => g.id === "SWE.1.RL.4").effect === "cap:N");
  assert.ok(k.bp.notes.length >= 1 && k.process.outcomes.length === 7);
});
test("knowledge: trace BP gets TAC rules, communicate BP gets COM rule", () => {
  assert.ok(getBpKnowledge("SWE.1", "BP5").guideline.rules.some((r) => r.id.startsWith("TAC.RL.")));
  assert.ok(getBpKnowledge("SWE.1", "BP6").guideline.rules.some((r) => r.id === "COM.RL.1"));
  assert.ok(!getBpKnowledge("SWE.1", "BP1").guideline.rules.some((r) => r.id.startsWith("TAC.RL.")));
});
test("knowledge: MBD rule on SWE.3.BP4 is conditional", () => {
  const g = getBpKnowledge("SWE.3", "BP4").references.guideline.find((x) => x.id === "MBD.RL.5");
  assert.equal(g.conditional, "MBD");
});
test("knowledge: cross-process rule is display only", () => {
  const g = getBpKnowledge("MAN.3", "BP4").references.guideline.find((x) => x.id === "MAN.3.RL.17");
  assert.equal(g.displayOnly, true);
});
test("knowledge: GP 2.1.1 rules and GEN on PA 1.1", () => {
  assert.ok(getGpKnowledge("PA 2.1", "GP 2.1.1").guideline.rules.some((r) => r.id === "PA2.1.RL.1"));
  assert.ok(getGpKnowledge("PA 1.1", "GP 1.1.1").guideline.rules.some((r) => r.id === "GEN.RL.1"));
  assert.equal(getGpKnowledge("PA 2.1", "GP 2.1.1").references.pam.citation, "PAM 4.1 §5.3.1 GP 2.1.1");
});
test("knowledge: WP characteristics and budget", () => {
  const w = getWpKnowledge("SWE.5", "01-50");
  assert.equal(w.references.pam.citation, "PAM 4.1 Annex B 01-50");
  assert.ok(formatNotesForPrompt(getProcessKnowledge("MAN.3").guideline.notes).length <= 4 * 1300);
  assert.ok(getProcessKnowledge("MAN.3").guideline.rules.length <= 12);
});
```

- [ ] **Step 2: 실행해 실패 확인**

- [ ] **Step 3: 구현** — 규칙 선택: BP는 `targets`에 `{bp, process, id}` 일치 + `TAC.*`(bp가 `traceBPs`) + `COM.*`(`/의사소통/.test(bp.title)`) ; topic scope(`MBD|AGE|DEX|APA`)의 규칙은 명시 target 일치 시만 포함하고 `conditional: scope.id`. `condition.crossProcess`면 `displayOnly: true`. GP는 target gp id 일치 또는 target pa id가 그 PA; `GEN.*`은 PA 1.1에. 정렬: 프로세스/PA scope 먼저, 그다음 topic; 12건 절단. notes: `notes.process[id]`(또는 `notes.pa[id]`) 앞 4건 + 선택된 규칙의 topic note 첫 1건(예산 내). 로더는 `loadGuideline`, `loadProcess`, `loadProcessAttributes`, `loadWorkProducts`를 쓰고 모듈 단위로 캐시.

- [ ] **Step 4: 테스트 통과** `node --test test/knowledge.test.js`

- [ ] **Step 5: 커밋(허용 시)** `feat(harness): PAM·가이드라인 지식 조회 계층`

---

### Task 7: 가이드라인 효과 적용기와 인용 검증 확장

**Files:**
- Create: `packages/harness/src/evaluators/guidelineEffects.js`
- Modify: `packages/harness/src/evaluators/citationGuard.js`
- Test: `packages/harness/test/guidelineEffects.test.js`, `packages/harness/test/citationGuard.test.js`(추가)

**Interfaces:**
- `RATING_CAP_PERCENT = { N: 15, P: 50, L: 85 }`
- `capForEffect(effect: {kind, maxRating?}, sourcePercent?: number) → number | null` (`cap`→표, `must-downrate`→85, `cap-source`→`sourcePercent`, 그 외 null)
- `applyAppliedRules(result: {scorePercent, gaps, appliedRules?}, rulesById: Map) → result` — `appliedRules` 중 `applied !== false`인 것의 상한을 적용. 깎이면 `gaps`에 `가이드라인 [ID] 적용: 상한 <N|P|L> (<요지 60자>)` 추가, `appliedRules[i].capped = true`.
- `normalizeGuidelineCitations(raw: unknown, knownIds: Set<string>) → Array<{ ruleId, applied: boolean, note: string }>` — 배열이 아니거나 미지 ID면 제거, `applied`는 `=== true`만 true.
- `citationGuard.js`: `CITATION_RE`가 `PAM(?:\s*4\.1)?\s*§\s*…`를 받아들이고 `Annex B \d{2}-\d{2}`도 허용. `validateLlmResult(raw, { knownRuleIds })`가 `result.appliedRules`를 채운다(옵션 없으면 빈 배열).

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test("capForEffect", () => {
  assert.equal(capForEffect({ kind: "cap", maxRating: "N" }), 15);
  assert.equal(capForEffect({ kind: "must-downrate" }), 85);
  assert.equal(capForEffect({ kind: "cap-source" }, 40), 40);
  assert.equal(capForEffect({ kind: "must-not-downrate" }), null);
});
test("applyAppliedRules caps score and annotates gap", () => {
  const rules = new Map([["SWE.1.RL.4", { id: "SWE.1.RL.4", effect: { kind: "cap", maxRating: "N" }, text: "..." }]]);
  const r = applyAppliedRules({ scorePercent: 70, gaps: [], appliedRules: [{ ruleId: "SWE.1.RL.4", applied: true, note: "" }] }, rules);
  assert.equal(r.scorePercent, 15);
  assert.match(r.gaps[0], /^가이드라인 \[SWE\.1\.RL\.4\] 적용: 상한 N/);
  assert.equal(r.appliedRules[0].capped, true);
});
test("applyAppliedRules ignores not-applied and must-not-downrate", () => { /* 70 유지 */ });
test("normalizeGuidelineCitations drops unknown ids", () => {
  const out = normalizeGuidelineCitations([{ ruleId: "SWE.1.RL.4", applied: true }, { ruleId: "SWE.1.RL.99", applied: true }, "junk"], new Set(["SWE.1.RL.4"]));
  assert.deepEqual(out, [{ ruleId: "SWE.1.RL.4", applied: true, note: "" }]);
});
// citationGuard.test.js 추가
test("hasPamCitation accepts PAM 4.1 and Annex B forms", () => {
  assert.ok(hasPamCitation("PAM 4.1 §4.4.1 SWE.1.BP2"));
  assert.ok(hasPamCitation("PAM 4.1 §5.3.1 GP 2.1.1"));
  assert.ok(hasPamCitation("PAM 4.1 Annex B 17-00"));
  assert.ok(hasPamCitation("PAM §4.3.2 BP5"));
});
test("validateLlmResult keeps known guideline citations only", () => {
  const v = validateLlmResult({ scorePercent: 50, pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", evidence: [], gaps: [], guidelineCitations: [{ ruleId: "SWE.1.RL.4", applied: true }, { ruleId: "X.RL.1", applied: true }] }, { knownRuleIds: new Set(["SWE.1.RL.4"]) });
  assert.ok(v.ok);
  assert.deepEqual(v.result.appliedRules.map((a) => a.ruleId), ["SWE.1.RL.4"]);
});
```

- [ ] **Step 2: 실패 확인** → 모듈 없음 / 정규식 불일치

- [ ] **Step 3: 구현**

- [ ] **Step 4: 테스트 통과** `node --test test/guidelineEffects.test.js test/citationGuard.test.js`

- [ ] **Step 5: 커밋(허용 시)** `feat(harness): 가이드라인 효과 적용기와 PAM 4.1 인용 검증`

---

### Task 8: LLM 프롬프트에 지식 주입, LLM·하이브리드·평균 스코어러 반영

**Files:**
- Modify: `packages/harness/src/llm/prompts/bpPrompt.js`, `gpPrompt.js`, `wpPrompt.js`
- Modify: `packages/harness/src/evaluators/llmScorer.js`, `hybridScorer.js`
- Modify: `api/_harnessService.js` (`buildAveragingScorer`에서 `applyAppliedRules` 호출, `references` 전달)
- Test: `packages/harness/test/llmScorer.test.js`(신규, 가짜 client), `packages/harness/test/hybridScorer.test.js`(추가), `packages/harness/test/prompts.test.js`(신규)

**Interfaces:**
- 프롬프트 빌더 입력에 `knowledge` 추가: `buildBpPrompt({ process, bp, artifactsExcerpt, projectFingerprint, knowledge: BpKnowledge|null })`. `knowledge`가 null이면 기존과 같은 문맥(테스트 호환).
- system 문구 시작: `You are a qualified Automotive SPICE PAM 4.1 assessor applying the VDA Automotive SPICE Guidelines 3rd Edition (2026).`
- context에 블록 순서: `## PAM 4.1 — 프로세스`(목적·성과) → `## PAM 4.1 — 평가 대상 BP`(제목·설명·비고) → `## 출력 정보 항목` → `## 가이드라인 2026 — 적용 가능한 규칙`(`formatRulesForPrompt`) → `## 가이드라인 2026 — 해설`(`formatNotesForPrompt`) → 기존 fingerprint·증적 발췌.
- task의 응답 JSON에 `"guidelineCitations": [{"ruleId": "...", "applied": true|false, "note": "..."}]` 추가. 지시문: `규칙은 조건이 증적에서 성립할 때만 applied=true. 성립하지 않으면 넣지 말거나 applied=false. 목록에 없는 규칙 ID를 만들지 말 것.`
- `pamCitation` 지시: `Cite exactly "${knowledge.references.pam.citation}"` (knowledge 없으면 기존 문구).
- `createLlmScorer({ client, knowledge? })`: `knowledge` 기본값은 `src/knowledge/index.js`의 getter 묶음(테스트에서 주입 가능). 결과: `{ scorePercent, evidence, gaps, pamCitation, contextConsistency, appliedRules, references }` — `appliedRules`에 `applyAppliedRules` 적용(컨텍스트 배수 적용 후).
- `hybridScorer`: `appliedRules`는 LLM 것, `references`는 LLM 것 없으면 rule 것, 융합 점수에 `applyAppliedRules` 재적용.
- `_harnessService.buildAveragingScorer`: 평균 후 모든 엔진의 `appliedRules`를 합쳐 재적용, `references`는 첫 번째 있는 것.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/prompts.test.js`:
```js
test("bpPrompt embeds PAM text, rules and citation", () => {
  const k = getBpKnowledge("SWE.1", "BP2");
  const p = buildBpPrompt({ process: loadProcess("SWE.1"), bp: k.bp, artifactsExcerpt: "x", projectFingerprint: "", knowledge: k });
  assert.match(p.system, /PAM 4\.1/);
  assert.match(p.context, /\[SWE\.1\.RL\.4\]/);
  assert.match(p.context, /소프트웨어 요구사항을 구조화/);
  assert.match(p.task, /PAM 4\.1 §4\.4\.1 SWE\.1\.BP2/);
  assert.match(p.task, /guidelineCitations/);
});
test("bpPrompt without knowledge still builds", () => { /* knowledge: null → system/context/task 문자열 */ });
```

`test/llmScorer.test.js` (client: `generateJson` 스텁):
```js
test("llmScorer applies cap from applied rule and returns references", async () => {
  const client = { generateJson: async () => ({ parsed: { scorePercent: 80, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", contextConsistency: { status: "consistent", note: "" }, guidelineCitations: [{ ruleId: "SWE.1.RL.4", applied: true, note: "기능/비기능만 분류" }] } }) };
  const scorer = createLlmScorer({ client });
  const r = await scorer.scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [{ name: "a.md", text: "요구사항" }] });
  assert.equal(r.scorePercent, 15);
  assert.equal(r.references.pam.citation, "PAM 4.1 §4.4.1 SWE.1.BP2");
  assert.equal(r.appliedRules[0].capped, true);
});
test("llmScorer drops unknown rule ids without rejecting", async () => { /* guidelineCitations: [{ruleId:"SWE.1.RL.99",applied:true}] → scorePercent 80, appliedRules [] */ });
```

`test/hybridScorer.test.js` 추가:
```js
test("hybrid keeps applied cap after fusion", async () => {
  const rule = { scoreBP: async () => ({ scorePercent: 90, evidence: [], gaps: [] }) };
  const llm = { scoreBP: async () => ({ scorePercent: 15, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", appliedRules: [{ ruleId: "SWE.1.RL.4", applied: true, note: "", capped: true }] }) };
  const r = await createHybridScorer({ rule, llm }).scoreBP({ process: { id: "SWE.1" }, bp: { id: "BP2" }, artifacts: [] });
  assert.equal(r.scorePercent, 15);
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현** — `hybridScorer`와 `_harnessService`의 재적용에는 `loadGuideline().rules`로 만든 `rulesById` Map을 모듈 단위 캐시로 쓴다. `llmScorer.call`은 `ctx.bp`/`ctx.gp`/`ctx.wp`에 따라 `knowledge.getBpKnowledge(process.id, bp.id)` 등을 호출하고 `knownRuleIds`는 그 knowledge의 규칙 ID 집합(없으면 전체 규칙 ID)을 쓴다.

- [ ] **Step 4: 테스트** `npm test` → 전부 pass

- [ ] **Step 5: 커밋(허용 시)** `feat(harness): LLM 프롬프트에 PAM 4.1·가이드라인 지식 주입, 상한 강제`

---

### Task 9: 룰 스코어러 근거·확인 포인트, 평가기 전달, 등급 조건 후처리

**Files:**
- Modify: `packages/harness/src/evaluators/ruleScorer.js`
- Modify: `packages/harness/src/evaluators/bpEvaluator.js`, `wpEvaluator.js`, `paEvaluator.js`
- Create: `packages/harness/src/evaluators/ratingConditions.js`
- Modify: `packages/harness/src/harness.js`
- Modify: `packages/harness/src/model/verdict.js` (typedef에 `references`, `appliedRules`)
- Test: `packages/harness/test/ruleScorer.test.js`(추가), `packages/harness/test/ratingConditions.test.js`, `packages/harness/test/e2e.test.js`(추가)

**Interfaces:**
- 룰 스코어러 결과에 `references`(knowledge에서) 추가; `scorePercent < 51`이면 `must-not-downrate` 규칙 최대 2건을 `gaps`에 `확인 포인트 [ID]: <요지 80자>`로 추가.
- `applyRatingConditionRules({ processId, bps, pas, rules }) → { bps, pas, applied: Array<{ruleId, target, sourceRating}> }` (in place 수정 후 반환)
  - 출처 지표 등급: BP는 `bps[].rating`을 `collapse`해 `when`과 비교, GP는 `pas[].gps[].rating`, PA 1.1은 `pas` 항목.
  - 대상 BP/GP의 `scorePercent`에 `capForEffect(effect, sourcePercent)` 적용, `rating`을 `percentToRating`으로 재계산, `appliedRules`에 `{ruleId, applied: true, note: "<출처> <등급>", source: "rule-engine", capped: true}` 추가, `gaps`에 `가이드라인 [ID] 적용: <출처 ID>가 <등급>이므로 상한 …`.
  - 대상이 PA 1.1이면 그 PA의 `rating/collapsed`를 깎는다(`gps[0].scorePercent`도 같이).
  - `crossProcess` 규칙은 건드리지 않는다.
- `Harness#evaluateProcess`: BP 평가 뒤 `applyRatingConditionRules`(bps만, pas 빈 배열) → WP → PA 평가 → 다시 `applyRatingConditionRules`(GP·PA 1.1 대상) → CL 계산. 적용 목록은 `verdict.meta.ratingConditionRules`에.
- 평가기 3종은 스코어러 결과의 `references`·`appliedRules`를 그대로 싣고, `pamCitation`은 `references?.pam?.citation ?? bp.pamCitation`.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// ruleScorer.test.js
test("ruleScorer attaches references and hints on low score", async () => {
  const swe1 = loadProcess("SWE.1");
  const r = await ruleScorer.scoreBP({ process: swe1, bp: swe1.basePractices[2], artifacts: [{ name: "x.md", text: "hello" }] });
  assert.equal(r.references.pam.citation, "PAM 4.1 §4.4.1 SWE.1.BP3");
  assert.ok(r.gaps.some((g) => /^확인 포인트 \[SWE\.1\.RL\.\d+\]/.test(g)));
});
// ratingConditions.test.js
test("SUP.10: BP3 cannot exceed BP2 when BP2 is P", () => {
  const bps = [{ id: "BP2", scorePercent: 40, rating: "P+", gaps: [] }, { id: "BP3", scorePercent: 90, rating: "F", gaps: [] }];
  const { applied } = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules: loadGuideline().rules });
  assert.equal(bps[1].scorePercent, 40);
  assert.equal(bps[1].rating, "P+");
  assert.ok(applied.some((a) => a.ruleId === "SUP.10.RL.5"));
});
test("no change when condition not met", () => { /* BP2 70 → BP3 90 유지, applied 빈 배열 */ });
test("SUP.1: PA 1.1 capped at L when BP3 is N", () => {
  const pas = [{ paId: "PA 1.1", level: 1, rating: "F", collapsed: "F", gps: [{ id: "GP 1.1.1", scorePercent: 95, rating: "F", gaps: [] }] }];
  applyRatingConditionRules({ processId: "SUP.1", bps: [{ id: "BP3", scorePercent: 5, rating: "N", gaps: [] }], pas, rules });
  assert.equal(pas[0].collapsed, "L");
});
test("cross-process rule never changes scores", () => {
  // MAN.3 with BP4 90, rules → 90 유지 (MAN.3.RL.17 출처 MAN.5.BP5는 없음)
});
// e2e.test.js 추가
test("evaluateProcess result carries references and meta.ratingConditionRules", async () => {
  const v = await new Harness({ scorer: ruleScorer }).evaluateProcess({ processId: "SYS.2", artifacts: fixtureArtifacts });
  assert.ok(v.bps[0].references.pam.citation.startsWith("PAM 4.1 §4.3.2 SYS.2.BP1"));
  assert.ok(Array.isArray(v.meta.ratingConditionRules));
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

- [ ] **Step 4: 테스트** `npm test` → 전부 pass

- [ ] **Step 5: 커밋(허용 시)** `feat(harness): 룰 스코어러 근거 제시와 가이드라인 등급 조건 후처리`

---

### Task 10: API 계층 — 어댑터·공급자 선택·QA 초안 문맥

**Files:**
- Modify: `api/_legacyAdapter.js`, `api/_harnessService.js`, `api/_qaDraftService.js`
- Modify: `packages/harness/src/qa/draft.js`
- Test: `packages/harness/test/qaDraft.test.js`(추가), `packages/harness/test/legacyAdapter.test.js`(신규; `api/_legacyAdapter.js`를 상대 경로로 import)

**Interfaces:**
- `toLegacyShape`의 `ratings[]`에 `references`, `appliedRules` 통과; `summary` 앞에 `기준: PAM 4.1 · Guidelines 2026 · ` 접두.
- `_harnessService.buildSingleScorer(engine, env, customRules)`: `resolveScoringLlmConfig(env)`(QA 서비스의 `resolveQaLlmConfig`와 같은 규칙, 기본 `{openai: "gpt-4o", anthropic: "claude-sonnet-4-6"}`)로 공급자·모델을 고른다. 호출부는 `apiKey` 대신 `env`를 넘긴다. 오류 문구: `engine=${engine} requires OPENAI_API_KEY or ANTHROPIC_API_KEY in server env.`
- 두 서비스가 같은 함수를 쓰도록 `api/_llmConfig.js`로 뽑는다: `resolveLlmConfig(env) → {provider, apiKey, model, concurrency} | null`, `limitConcurrency(client, max)`.
- `draft.js`: `buildWpDraftPrompt({ ..., guidelineRules = [] })`, `buildProcessDraftPrompt({ ..., guidelineRules = [] })`, `generateDrafts({ ..., knowledgeForProcess?: (processId) => { rules } })`. system 첫 줄 `당신은 Automotive SPICE PAM 4.1 품질보증(QA) 심사 전문가입니다.` 규칙이 있으면 context 끝에 `참고 규칙(VDA 가이드라인 2026):\n- [ID] 본문` 블록을 붙이고 system에 `- rationale에 참고한 규칙 ID를 괄호로 적습니다. 예: (가이드라인 SWE.1.RL.4)` 줄 추가. `bpLines`는 `bp.description` 뒤에 `titleEn`이 있으면 ` (${titleEn})`.
- `_qaDraftService.handleQaDraft`: `knowledgeForProcess: (id) => getProcessKnowledge(id)?.guideline ?? { rules: [] }` 전달.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// qaDraft.test.js
test("wp draft prompt includes guideline rules block", () => {
  const p = buildWpDraftPrompt({ workProduct: "소프트웨어 요구사항 명세서", processId: "SWE.1", bps: [], items: [{ id: "a", question: "q" }], guidelineRules: [{ id: "SWE.1.RL.4", text: "규칙 본문" }] });
  assert.match(p.system, /PAM 4\.1/);
  assert.match(p.context, /참고 규칙\(VDA 가이드라인 2026\)/);
  assert.match(p.context, /\[SWE\.1\.RL\.4\] 규칙 본문/);
});
test("process draft prompt without rules has no block", () => { assert.doesNotMatch(p.context, /참고 규칙/); });
// legacyAdapter.test.js
test("toLegacyShape passes references and prefixes basis", () => {
  const legacy = toLegacyShape({ bps: [{ id: "BP1", title: "t", rating: "F", scorePercent: 90, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP1", references: { pam: { citation: "PAM 4.1 §4.4.1 SWE.1.BP1", page: 50 }, guideline: [] }, appliedRules: [] }], pas: [], capabilityLevel: 1, capabilityLevelReason: "ok" });
  assert.equal(legacy.ratings[0].references.pam.page, 50);
  assert.match(legacy.summary, /^기준: PAM 4\.1 · Guidelines 2026 · CL1/);
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

- [ ] **Step 4: 테스트** `npm test`; 그리고 로컬 수동 확인: 루트에서 `npm run dev`(5174) 띄우고 프로세스 모드에서 `engine=rule`로 한 파일 평가 → 응답 `ratings[0].references`가 있는지 브라우저 네트워크 탭 또는 `curl`로 확인.

- [ ] **Step 5: 커밋(허용 시)** `feat(api): 근거 전달, LLM 공급자 환경변수 통일, QA 초안 가이드라인 문맥`

---

### Task 11: UI — 근거 표시, 한국어 BP, 내보내기, 버전 표기

**Files:**
- Create: `src/components/ReferenceChips.jsx`
- Modify: `src/components/VerdictCard.jsx`, `src/components/ProjectReportCard.jsx`, `src/components/ProcessCard.jsx`, `src/data/aspiceData.js`
- Modify: `src/utils/exportReport.js`, `src/utils/exportProjectReport.js`, `src/utils/exportHelpGuide.js`
- Modify: `src/components/AppHeader.jsx`, `AppFooter.jsx`, `HelpModal.jsx`, `src/auth/LandingPage.jsx`, `src/utils/analysisPrompt.js`, `src/data/ratingMeta.js`(주석), `packages/harness/src/cli.js`

**Interfaces:**
- `ReferenceChips({ references, appliedRules, compact })`: PAM 칩 `PAM 4.1 §4.4.1 SWE.1.BP2 · p.50`; 가이드라인 칩 `[ID] <효과 한글>`(효과 한글: `cap:N`→`N 상한`, `cap:P`→`P 상한`, `cap:L`→`L 상한`, `cap-source`→`출처 등급 상한`, `must-downrate`→`하향 필수`, `must-not-downrate`→`하향 금지`, `other`→`참고`). `appliedRules`에 들어 있고 `capped`면 빨간 테두리와 `적용` 표시, `displayOnly`면 회색과 `타 프로세스 조건`, `conditional`이면 `(<주제>)` 접미. 칩 클릭 시 `summary`와 `section · p.<page>`를 펼친다. `compact`는 한 줄 텍스트(`PAM 4.1 §… · [SWE.1.RL.4] N 상한 ·  …`)만 렌더.
- `aspiceData.js`의 `shape`: `name`(한국어), `nameEn`, bps에 `titleEn`, `notes`; `guidelineRuleCount: HARNESS_BUNDLE.guidelineRuleCounts?.[p.id] ?? 0`. `guideline: ""` 필드는 삭제하고 `analysisPrompt.js`의 참조도 제거(사용처 없음 확인 후 파일 삭제).
- 버전 문구(정확히): 헤더 `REF · PAM v4.1 (2026-08-24)`, `REF · Guidelines 3rd Ed. (2026-07)`; 푸터 `Automotive SPICE® VDA QMC · PAM v4.1 · Guidelines 3rd Ed. 2026-07`; 랜딩 표 `["PAM", "v4.1 · 2026-08-24"], ["Guidelines", "3rd Ed. · 2026-07"]`; 그 외 "4.0" → "4.1", "VDA 4.0 가이드라인" → "VDA 가이드라인 3판(2026)".

- [ ] **Step 1: `ReferenceChips.jsx` 작성, `VerdictCard.BpRatingRow`의 약점 문단 아래에 `<ReferenceChips references={rating.references} appliedRules={rating.appliedRules} />`**

- [ ] **Step 2: `ProjectReportCard`의 BP 표·GP 표 약점 셀 아래에 `<ReferenceChips compact …/>`** (b.references / g.references)

- [ ] **Step 3: `ProcessCard`**: 제목 `{proc.name}` 아래 `{proc.nameEn}` 작게; BP 목록에 `bp.title` 뒤 `bp.titleEn`을 회색으로, `bp.notes`는 `<details>`로; Guideline Stat을 `value={proc.guidelineRuleCount}` `label="Guideline rules"`.

- [ ] **Step 4: 내보내기** — `exportReportAsText`에 각 BP 뒤 `  근거: <PAM 인용> · p.<page> / [ID] 효과 …` 줄; `exportProjectReport`의 BP·GP 행에 compact 문자열 셀 추가; 보고서 머리 문구 `ASPICE PAM 4.1 · 프로젝트 평가 보고서`, 안내문 `PAM v4.1(2026-08-24)과 VDA 가이드라인 3판(2026-07) 기준`.

- [ ] **Step 5: 버전 문구 일괄 수정** (위 목록) 및 `cli.js` description `ASPICE PAM 4.1 harness — CL1~CL3, cross-process traceability`.

- [ ] **Step 6: 검증** 루트에서 `npm run lint`(오류 0), `npm run build`(성공). `npm run dev`로 프로세스 모드 rule 엔진 평가 후 BP 행에 PAM 칩과 가이드라인 칩이 보이고, 프로세스 카드 BP 제목이 한국어인지 확인. 프로젝트 모드도 한 번.

- [ ] **Step 7: 커밋(허용 시)** `feat(ui): 평가 근거(PAM 4.1·가이드라인 2026) 표시와 버전 표기`

---

### Task 12: 문서와 마무리 검증

**Files:**
- Modify: `README.md`(루트), `packages/harness/README.md`
- Modify: `docs/superpowers/specs/2026-11-12-pam41-guideline2026-knowledge-base-design.md`(구현 중 바뀐 결정이 있으면 10절에 추기)

- [ ] **Step 1: README 갱신** — 기준 문서 절을 PAM 4.1 한국어 + 가이드라인 2026으로, `spec/sources` 준비 방법(README 링크), `npm run extract` 절차, 인용 형식, `references`/`appliedRules` 필드 설명, 등급 조건 후처리 설명, `ASPICE_LLM_PROVIDER/MODEL`이 채점 경로에도 적용됨을 적는다. "v4.0" 표기 제거.

- [ ] **Step 2: 전체 검증**

```bash
cd packages/harness && npm test          # 전부 pass
cd ../.. && npm run lint && npm run build
git status --short                        # spec/sources/* 가 없어야 함
```

- [ ] **Step 3: 커밋(허용 시)** `docs: PAM 4.1·가이드라인 2026 반영 안내`
