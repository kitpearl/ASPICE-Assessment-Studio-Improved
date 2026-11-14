// 참조 판정표의 증거 quote 가 원문 docx 에 실제로 있는지 확인한다.
// 사용: node scripts/verifyReferenceQuotes.js <processId> <docx 경로>
import mammoth from "mammoth";
import { loadReferenceTable } from "../src/assessment/referenceTable.js";

const [processId, docx] = process.argv.slice(2);
if (!processId || !docx) {
  console.error("usage: node scripts/verifyReferenceQuotes.js <processId> <docx>");
  process.exit(2);
}
const html = (await mammoth.convertToHtml({ path: docx })).value;
const flat = html
  .replace(/<\/(p|h\d|li|tr)>/g, "\n")
  .replace(/<\/t[dh]>/g, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const norm = (s) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const hay = norm(flat);
const table = await loadReferenceTable(processId);
let bad = 0;
for (const e of table.evidence ?? []) {
  const ok = hay.includes(norm(e.quote));
  if (!ok) { bad++; console.log(`MISMATCH ${e.evidenceId}: ${e.quote}`); }
}
console.log(`${(table.evidence ?? []).length - bad}/${(table.evidence ?? []).length} quotes matched`);
process.exit(bad ? 1 : 0);
