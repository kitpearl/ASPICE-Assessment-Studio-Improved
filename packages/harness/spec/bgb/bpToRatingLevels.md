# BGB Rating Level → BP 매핑 (Markdown 표 예시)

본 파일은 동일 디렉터리의 `bpToRatingLevels.csv` 와 동등하게 처리됩니다.
CSV 와 MD 가 같은 (processId, bpId, rlId) 행을 가지면 자동으로 중복 제거됩니다.

## 매핑 표

| processId | bpId | rlId  |
|-----------|------|-------|
| SWE.3     | BP1  | RL3   |
| SWE.3     | BP1  | RL3.2 |
| SWE.3     | BP2  | RL3   |

## 형식 규칙

- `processId` 는 PAM 프로세스 ID (예: SWE.3).
- `bpId` 는 spec/canonical/processes/<process>.json 안의 basePractices[i].id (예: BP1).
- `rlId` 표기 정규식: `^RL\d+(\.\d+)?$`. 위반된 행은 자동 무시됩니다.
- 표 외부의 텍스트 (제목/문장) 는 모두 무시되므로 자유롭게 주석으로 작성해도 됩니다.
- 한 BP 가 여러 RL 에 매핑되면 행을 여러 개로 나눕니다.

## 사용자 안내

- 위 데모 행은 형식 예시이며 실제 BGB 매핑이 아닙니다.
- 운영용 매핑으로 교체하거나, 동일 디렉터리에 새 `.md` / `.csv` 파일을 추가하세요.
- 어떤 형식이든 헤더가 `processId`, `bpId`, `rlId` 세 컬럼을 포함하기만 하면 자동 인식됩니다.
