# BGB Source Documents

이 디렉터리는 **BP ↔ BGB Rating Level 매핑을 추출할 원본 문서** 보관용입니다.
자동 로더(`spec/standardRefs.js`)는 `spec/bgb/` 직속의 `*.csv` / `*.md` 만 스캔하므로,
본 서브디렉터리의 파일들은 평가 파이프라인에 영향을 주지 않습니다.

## 포함된 문서

- `ASPICE_Guideline_20240312.csv` / `.md` — VDA QMC Joint Quality Management in
  the Supply Chain Guidelines (2nd revised edition, 2023-11). BGB Rating
  Level 정의 원본.

## 추출 결과의 출력 위치

본 문서들로부터 추출한 (processId, bpId, rlId) 매핑은 상위 디렉터리의
- `bpToRatingLevels.csv`, 또는
- `bpToRatingLevels.md`

에 채워집니다.
