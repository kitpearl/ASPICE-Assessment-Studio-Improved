// QA Audit mode — AI criteria draft generation (checklist import phase 1).
//
// LLM provider/model selection is shared with the scoring path
// (_harnessService.js) through _llmConfig.js, and reads the explicitly-passed
// `env` object (Vercel serverless and the Vite dev middleware each hand us
// their own).
import { loadProcesses } from "aspice-harness";
import { createLlmClient } from "aspice-harness/llm";
import { generateDrafts } from "aspice-harness/qa";
import { getProcessKnowledge } from "aspice-harness/knowledge";
import { resolveLlmConfig, limitConcurrency } from "./_llmConfig.js";

export const MAX_DRAFT_ITEMS = 200;

function badRequest(message) {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
}

export async function handleQaDraft({ kind, groups } = {}, env) {
  if (kind !== "wp" && kind !== "process") throw badRequest("kind must be 'wp' or 'process'");
  if (!Array.isArray(groups) || groups.length === 0) throw badRequest("groups must be a non-empty array");
  if (groups.length > MAX_DRAFT_ITEMS) {
    throw badRequest(`groups exceeds ${MAX_DRAFT_ITEMS} items per request`);
  }

  const cfg = resolveLlmConfig(env);
  if (!cfg) {
    throw new Error("QA 초안 생성에는 LLM API 키(ANTHROPIC_API_KEY 또는 OPENAI_API_KEY)가 필요합니다.");
  }
  const { provider, apiKey, model, concurrency } = cfg;
  const client = limitConcurrency(createLlmClient({ provider, apiKey, model }), concurrency);
  const { results, failures } = await generateDrafts({
    client,
    kind,
    groups,
    processes: loadProcesses(),
    knowledgeForProcess: (id) => getProcessKnowledge(id)?.guideline ?? { rules: [] },
  });
  return { results, failures, model };
}
