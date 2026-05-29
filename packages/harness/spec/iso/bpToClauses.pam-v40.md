# PAM v4.0 BP-level 외부 표준 인용 (수동 큐레이션)

본 파일은 Automotive SPICE PAM v4.0 본문에서 **개별 BP 의 Note** 형태로 명시된
외부 표준 인용을 수동으로 추출한 결과입니다. 출처: `sources/Automotive_SPICE_PAM_v40.md`.

## 커버리지에 대한 안내

PAM v4.0 은 외부 표준에 대한 매핑을 의도적으로 제한합니다. 본문 전체에서 BP 단위로
명시적으로 ISO/IEC/IATF 표준을 인용한 Note 는 다음 3 건만 확인됩니다 (PAM 본문에서
직접 확인 가능). 추가 인용은 WP 정의 (예: 17-57 Special Characteristics) 또는 PRM/PAM
프레임워크 자체 표준 (ISO/IEC 33xxx) 에 한정되어 BP 매핑 대상이 아닙니다.

따라서 본 파일은 **PoC 수준의 데이터**이며, 사용자가 회사 내부의 PAM↔ISO 매핑을 갖고
있다면 별도 행을 추가하여 보강할 수 있습니다. 추가 형식은 본 파일과 동일하게 GFM
pipe table 만 사용하면 됩니다.

## 매핑 표

| processId | bpId | clause                            |
|-----------|------|-----------------------------------|
| SWE.3     | BP3  | ISO 26262-6 clause 8.4.5          |
| HWE.1     | BP1  | ISO 26262-8:2018                  |
| HWE.2     | BP2  | IATF 16949:2016 clause 8.4.1.2    |

## 출처 (PAM v4.0 본문 위치)

- **SWE.3.BP3 — ISO 26262-6 clause 8.4.5**
  Note 7 (`sources/Automotive_SPICE_PAM_v40.md:2675`):
  > Examples for coding principles at capability level 1 are not to use implicit type
  > conversions, only one entry and one exit point in subroutines, and range checks
  > (design-by-contract, defensive programming). Further examples see e.g, ISO 26262-6
  > clause 8.4.5 together with table 6.

- **HWE.1.BP1 — ISO 26262-8:2018**
  Note 1 (`sources/Automotive_SPICE_PAM_v40.md:3680`):
  > Characteristics of requirements are defined in standards such as ISO IEEE 29148,
  > ISO/IEC IEEE 24765, ISO 26262-8:2018, or the INCOSE Guide For Writing Requirements.

- **HWE.2.BP2 — IATF 16949:2016 clause 8.4.1.2**
  Note 3 (`sources/Automotive_SPICE_PAM_v40.md:3834`):
  > The identification of hardware parts and their suppliers in the hardware bill of
  > materials may be subject to a pre-defined repository (see also IATF 16949:2016,
  > clause 8.4.1.2.).

## 형식 규칙 재확인

- 각 행의 `clause` 컬럼은 `citationGuard.hasIsoClause` 정규식을 통과해야 합니다.
  정규식: `^(?:ISO(\/(?:IEC|SAE))?|IEC|IATF)\s+\d+(?:-\d+)?(?::\d{4})?(?:\s+(?:§[\d.]+|clause\s+[\d.]+))?$`
- `clause N.N.N` 표기와 `§N.N.N` 표기 둘 다 인정됩니다 (P5-ter 확장).
- 형식 위반 행은 silently drop 되므로 잘못된 행이 UI 에 노출되지 않습니다.
