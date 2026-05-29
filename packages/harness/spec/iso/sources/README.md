# ISO Source Documents

이 디렉터리는 **BP ↔ ISO clause 매핑을 추출할 원본 문서** 보관용입니다.
자동 로더(`spec/standardRefs.js`)는 `spec/iso/` 직속의 `*.csv` / `*.md` 만 스캔하므로,
본 서브디렉터리의 파일들은 평가 파이프라인에 영향을 주지 않습니다.

## 포함된 문서

- `Automotive_SPICE_PAM_v40.md` — Automotive SPICE PAM v4.0 (VDA WG13, 2023-11).
  ISO 26262 / IEC 33020 등 외부 표준 인용이 포함된 원본.
- `ISO_IEC_33002_en.csv` / `.md` — ISO/IEC 33002:2015 (Process assessment —
  Requirements for performing process assessment). 평가 프로세스 자체에 대한
  표준.

## 추출 결과의 출력 위치

본 문서들로부터 추출한 (processId, bpId, clause) 매핑은 상위 디렉터리의
- `bpToClauses.csv`, 또는
- `bpToClauses.md`

에 채워집니다.
