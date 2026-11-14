// 독립 평가자를 N회 호출하고 과반 합의까지 만든다.
//
// 사용:
//   node scripts/runIndependentReview.js --doc <문서.docx|.txt|.md> --process SUP.10 [--runs 3] [--intermediate verdict.json]
//        [--out ./review-out] [--model gpt-5.5] [--concurrency 1] [--env ../../aspice.env] --confirm-send
//
// 주의: 문서 본문과 중간 결과가 외부 LLM 서비스(OpenAI)로 전송된다. --confirm-send 가 없으면 전송하지 않고
// 전송될 내용의 크기만 출력한다(dry run). API 키는 env 파일(ASPICE_LLM_*/OPENAI_API_KEY)에서 읽으며 출력하지 않는다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import OpenAI from "openai";
import { runIndependentReview, buildReviewMessages, renderConsensusMarkdown } from "../src/assessment/independentReviewRunner.js";

function parseArgs(argv) {
  const a = { runs: 3, concurrency: 1, scope: "DOCUMENT_ADEQUACY", env: resolve("../../aspice.env"), out: resolve("./review-out") };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--confirm-send") a.confirm = true;
    else if (k.startsWith("--")) a[k.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  a.runs = Number(a.runs);
  a.concurrency = Number(a.concurrency);
  return a;
}

function loadEnv(file) {
  const env = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env 파일이 없으면 process.env 만 사용 */
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(OPENAI_API_KEY|ASPICE_LLM_MODEL)$/.test(k))) };
}

async function readDocument(file) {
  if (extname(file).toLowerCase() === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const html = (await mammoth.convertToHtml({ path: file })).value;
    return html
      .replace(/<\/(p|h\d|li|tr)>/g, "\n").replace(/<\/t[dh]>/g, " | ").replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  }
  return readFileSync(file, "utf8");
}

/** verdict.json({bps:[...]}) → 프롬프트에 싣는 중간 결과 요약. 형식이 맞지 않으면 null. */
function summarizeIntermediate(file, processId) {
  if (!file) return null;
  const v = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(v.bps)) return null;
  return v.bps.map((b) => ({
    bp: `${processId}.${b.id}`,
    rating: b.rating,
    scorePercent: b.scorePercent,
    scoreBeforeGuidelineCaps: b.scoreBeforeGuidelineCaps ?? null,
    appliedRules: (b.appliedRules ?? []).map((r) => ({ ruleId: r.ruleId, applied: r.applied, capped: r.capped ?? false, note: String(r.note ?? "").slice(0, 160) })),
    findings: (b.findings ?? []).map((f) => ({
      id: f.id, type: f.type, source: String(f.id).includes("rule") ? "RULE" : "LLM", expectationIds: f.expectationIds,
      claim: `${f.situation ?? ""} ${f.gap ?? ""}`.trim().slice(0, 420), absenceClaim: f.absenceClaim?.target ?? null,
    })),
  }));
}

const args = parseArgs(process.argv.slice(2));
if (!args.doc || !args.process || !Number.isInteger(args.runs) || args.runs < 1) {
  console.error("usage: node scripts/runIndependentReview.js --doc <file> --process <ID> [--runs 3] [--intermediate verdict.json] [--out dir] [--model name] [--concurrency 1] --confirm-send");
  process.exit(2);
}

const env = loadEnv(args.env);
const model = args.model || env.ASPICE_LLM_MODEL || "gpt-5.5";
const documentName = basename(args.doc);
const documentText = await readDocument(resolve(args.doc));
const promptInput = {
  pam: args.pam ?? "Automotive SPICE PAM 4.1 (한국어 본문)",
  guideline: args.guideline ?? "VDA Automotive SPICE Guidelines 3rd Edition 2026-07",
  processId: args.process,
  documents: [{ fileName: documentName, documentVersion: args.docVersion ?? null }],
  scope: args.scope,
  intermediate: summarizeIntermediate(args.intermediate, args.process),
};
const { system, user } = buildReviewMessages({ promptInput, documentName, documentText });

console.log(`모델 ${model} · ${args.runs}회 · 문서 ${documentName} (${documentText.length}자) · 시스템 ${system.length}자 + 사용자 ${user.length}자 × ${args.runs}회`);
if (!args.confirmSend) {
  console.log("전송하지 않았습니다(dry run). 위 내용이 외부 LLM 서비스(OpenAI)로 전송됩니다. 진행하려면 --confirm-send 를 추가하십시오.");
  process.exit(0);
}
if (!env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY 가 없습니다(env 파일 또는 환경변수).");
  process.exit(2);
}

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const reasoning = /^(gpt-5|o[1-9])/i.test(model);
const callModel = async ({ system: s, user: u }) => {
  const params = { model, messages: [{ role: "system", content: s }, { role: "user", content: u }] };
  if (reasoning) params.max_completion_tokens = 24000;
  else params.max_tokens = 16000;
  const res = await client.chat.completions.create(params);
  const choice = res.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("응답이 토큰 한도에서 잘렸다");
  return { text: choice?.message?.content ?? "", usage: res.usage };
};

mkdirSync(args.out, { recursive: true });
const result = await runIndependentReview({
  promptInput, documentName, documentText, runs: args.runs, callModel, concurrency: args.concurrency,
  onProgress: (e) => console.log(`  회차 ${e.index}: ${e.status} (${(e.ms / 1000).toFixed(0)}s)`),
});
for (const r of result.runs) writeFileSync(resolve(args.out, `review_run${r.index}.md`), r.markdown, "utf8");
writeFileSync(resolve(args.out, "consensus.json"), JSON.stringify({ promptVersion: result.promptVersion, model, failures: result.failures, warnings: result.warnings, consensus: result.consensus }, null, 2), "utf8");
const md = renderConsensusMarkdown(result);
writeFileSync(resolve(args.out, "consensus.md"), md, "utf8");
console.log(`\n${md}\n\n저장: ${args.out} (review_run*.md, consensus.json, consensus.md)`);
