# ISO clause → BP 매핑 (Markdown 표 예시)

본 파일은 동일 디렉터리의 `bpToClauses.csv` 와 동등하게 처리됩니다.
CSV 와 MD 가 같은 (processId, bpId, clause) 행을 가지면 자동으로 중복 제거됩니다.

## 매핑 표

| processId | bpId | clause                    |
|-----------|------|---------------------------|
| SWE.3     | BP1  | ISO 26262-6:2018 §9.4.3   |
| SWE.3     | BP1  | ISO/IEC 25010:2011 §4.2   |
| SWE.3     | BP2  | ISO 26262-6:2018 §9.4.4   |

## 형식 규칙

- `processId` 는 PAM 프로세스 ID (예: SWE.3).
- `bpId` 는 spec/canonical/processes/<process>.json 안의 basePractices[i].id (예: BP1).
- `clause` 표기 정규식: `^ISO(\/IEC)?\s+\d+(-\d+)?(:\d{4})?(\s+§[\d.]+)?$`. 위반 행은 자동 무시됩니다.
- 표 본문에 콤마 (,) 가 포함되어도 무방합니다 (CSV 와 달리 구분자가 `|` 이므로).
- 표 외부의 텍스트 (제목/문장) 는 모두 무시됩니다.

## 사용자 안내

- 위 데모 행은 형식 예시이며 실제 ISO 매핑이 아닙니다.
- 운영용 매핑으로 교체하거나, 동일 디렉터리에 새 `.md` / `.csv` 파일을 추가하세요.
- 어떤 형식이든 헤더가 `processId`, `bpId`, `clause` 세 컬럼을 포함하기만 하면 자동 인식됩니다.
