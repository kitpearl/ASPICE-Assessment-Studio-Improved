# spec/sources — 원문 보관 (로컬 전용)

이 폴더의 원문 파일은 `.gitignore`로 제외되며 커밋하지 않는다. 이 저장소는 공개 저장소이고 VDA 문서 원문은 재배포할 수 없기 때문이다. README.md 와 .gitkeep 만 추적한다.

## 파일

| 파일 | 내용 | 출처 |
|---|---|---|
| `AutomotiveSPICE_PAM_41_ko.txt` | PAM 4.1 한국어 PDF를 텍스트로 변환한 것 (페이지 마커 `<!-- Page N -->`) | 사용자 OneDrive 바탕 화면 `AssessmentStudio\AutomotiveSPICE_PAM_41_Korean.pdf` |
| `ASPICE_Guideline_2026_ko.md` | VDA Guideline 2026 한국어 | 같은 폴더 `ASPICE_Guideline_Edition_2026_ko.md` |
| `ASPICE_Guideline_2026_en.md` | VDA Guideline 2026 영어 | 같은 폴더 `ASPICE_Guideline_Edition_2026.md` |
| `pam41-en/processes/*.json` | PAM 4.1 영어 canonical 프로세스 | 운영 저장소 `C:\workspace\assessment-studio\backend\src\main\resources\spec\canonical\processes` |
| `pam41-en/processAttributes.json` | PAM 4.1 영어 canonical 프로세스 속성 | 운영 저장소 `...\spec\canonical\processAttributes.json` |

## 재생성 (packages/harness 에서)

```bash
D="C:/Users/LG/OneDrive - 브이웨이/바탕 화면/AssessmentStudio"
npm run pdf2txt -- "$D/AutomotiveSPICE_PAM_41_Korean.pdf" spec/sources/AutomotiveSPICE_PAM_41_ko.txt
cp "$D/ASPICE_Guideline_Edition_2026_ko.md" spec/sources/ASPICE_Guideline_2026_ko.md
cp "$D/ASPICE_Guideline_Edition_2026.md" spec/sources/ASPICE_Guideline_2026_en.md
mkdir -p spec/sources/pam41-en
cp -r C:/workspace/assessment-studio/backend/src/main/resources/spec/canonical/processes spec/sources/pam41-en/
cp C:/workspace/assessment-studio/backend/src/main/resources/spec/canonical/processAttributes.json spec/sources/pam41-en/
```
