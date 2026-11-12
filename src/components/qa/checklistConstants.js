// QA 체크리스트 화면들이 공유하는 상수·함수.
// ChecklistImportPanel.jsx 에서 분리(react-refresh/only-export-components: 컴포넌트 파일은 컴포넌트만 내보낸다).
import { processes } from "aspice-harness/spec/all";

export const PROCESS_OPTIONS = [...processes.map((p) => ({ id: p.id, name: p.name })), { id: "VWAY.PR", name: "산출물 동료 검토" }];

export const STATUSES = ["pending", "drafted", "confirmed", "stale"];
export const STATUS_LABEL = { pending: "대기", drafted: "초안", confirmed: "확정", stale: "재확정 필요" };

export const confirmRate = (v) => {
  const all = [...v.wpItems, ...v.processItems];
  if (!all.length) return 0;
  return Math.round((all.filter((i) => i.status === "confirmed").length / all.length) * 100);
};
