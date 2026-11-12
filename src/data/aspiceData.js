// Single source of truth: harness canonical bundle (spec/canonical/all.json).
// Shapes each process to the UI-expected interface so existing components
// (ProcessCard, VerdictCard) keep working.
//
// UI shape per process:
//   { id, name(한국어), nameEn, category, purpose, outcomes: [string],
//     bps: [{id,title,titleEn,description,notes,pamCitation}], guidelineRuleCount }

import HARNESS_BUNDLE from "aspice-harness/spec/all";

const HARNESS_PROCS = HARNESS_BUNDLE.processes || [];

const shape = (p) => ({
  id: p.id,
  name: p.name,
  nameEn: p.nameEn ?? "",
  category: p.category,
  purpose: p.purpose,
  pamSection: p.pamSection,
  outcomes: (p.outcomes || []).map((o) => o.text),
  bps: (p.basePractices || []).map((b) => ({
    id: b.id,
    title: b.title,
    titleEn: b.titleEn ?? "",
    description: b.description ?? "",
    notes: b.notes || [],
    pamCitation: b.pamCitation,
  })),
  outputWorkProducts: p.outputWorkProducts || [],
  inputWorkProducts: p.inputWorkProducts || [],
  traceBPs: p.traceBPs || [],
  guidelineRuleCount: HARNESS_BUNDLE.guidelineRuleCounts?.[p.id] ?? 0,
});

export const ASPICE_DATA = Object.fromEntries(
  HARNESS_PROCS.map((p) => [p.id, shape(p)])
);

export const PROCESS_IDS = HARNESS_PROCS.map((p) => p.id);

export const PROCESS_CATEGORIES = [
  ...new Set(HARNESS_PROCS.map((p) => p.category)),
];
