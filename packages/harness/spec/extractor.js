#!/usr/bin/env node
/**
 * spec/extractor.js — builds spec/canonical/ from the local sources in
 * spec/sources/ (see spec/sources/README.md):
 *
 *   AutomotiveSPICE_PAM_41_ko.txt   PAM 4.1 Korean (primary text)
 *   pam41-en/                       PAM 4.1 English canonical (auxiliary *En fields)
 *   ASPICE_Guideline_2026_ko.md     Guideline 2026 Korean
 *   ASPICE_Guideline_2026_en.md     Guideline 2026 English (optional, textEn)
 *
 * Outputs:
 *   canonical/processes/<ID>.json   one per PAM process (Korean + English aid)
 *   canonical/processAttributes.json PA 1.1 .. PA 3.2 + GPs
 *   canonical/workProducts.json     Annex B catalog (aliases preserved, retired IDs kept)
 *   canonical/guideline.json        Guideline 2026 rules + notes (server-side only)
 *   canonical/processGraph.json     V-model seed edges
 *   canonical/all.json              browser bundle (no guideline text)
 *   canonical/_summary.json         counts
 *
 * Usage:  node spec/extractor.js   (ASPICE_SPEC_SOURCES overrides the sources dir)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePam41 } from "./extract/pam41.js";
import { parseGuideline2026 } from "./extract/guideline2026.js";
import { mergeEnglish, mergeWorkProducts } from "./extract/mergeEnglish.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = process.env.ASPICE_SPEC_SOURCES ?? resolve(__dirname, "sources");
const SEED_PATH = resolve(__dirname, "processGraph.seed.json");
const OUT_DIR = resolve(__dirname, "canonical");
const PROCESSES_DIR = resolve(OUT_DIR, "processes");

const PAM_FILE = "AutomotiveSPICE_PAM_41_ko.txt";
const GUIDELINE_KO_FILE = "ASPICE_Guideline_2026_ko.md";
const GUIDELINE_EN_FILE = "ASPICE_Guideline_2026_en.md";
const PAM_EN_DIR = "pam41-en";
const REQUIRED = [PAM_FILE, GUIDELINE_KO_FILE, `${PAM_EN_DIR}/processes`, `${PAM_EN_DIR}/processAttributes.json`];

const SOURCES = {
  pam: "Automotive SPICE PAM 4.1 (Korean) 2026-08-24",
  guideline: "Automotive SPICE Guidelines 3rd Edition 2026-07",
};

/** Corrections to Annex B names (source typos). */
const WP_NAME_FIXES = { "03-03": "벤치마킹 데이터" };

function src(name) {
  return resolve(SOURCES_DIR, name);
}

function checkSources() {
  const missing = REQUIRED.filter((f) => !existsSync(src(f)));
  if (!missing.length) return;
  console.error(`Missing spec sources in ${SOURCES_DIR}:`);
  for (const f of missing) console.error(`  - ${f}`);
  console.error("See spec/sources/README.md for how to obtain/regenerate them.");
  process.exit(1);
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

/** Reads JSON that must parse; exits 1 on a parse error, or when missing unless `optional`. */
function readJsonStrict(path, { optional = false, missingWarning } = {}) {
  if (!existsSync(path)) {
    if (optional) {
      if (missingWarning) console.warn(`WARNING: ${path} not found — ${missingWarning}`);
      return null;
    }
    console.error(`Required file missing: ${path}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`Cannot parse ${path}: ${e.message}`);
    process.exit(1);
  }
}

function writeJson(path, data, pretty = true) {
  writeFileSync(path, pretty ? JSON.stringify(data, null, 2) + "\n" : JSON.stringify(data));
}

/** Attach inputWorkProducts to each process from seed edges where to===process.id. */
function mergeSeedInputs(processes, seedEdges, wpCatalog) {
  const inputsByProcess = new Map();
  for (const edge of seedEdges) {
    if (!edge?.to || !Array.isArray(edge.wps)) continue;
    const set = inputsByProcess.get(edge.to) ?? new Map();
    for (const wpId of edge.wps) {
      if (set.has(wpId)) continue;
      const wp = wpCatalog[wpId];
      const entry = { id: wpId, name: wp?.name ?? "Unknown" };
      if (wp?.nameEn) entry.nameEn = wp.nameEn;
      entry.fromProcess = edge.from;
      set.set(wpId, entry);
    }
    inputsByProcess.set(edge.to, set);
  }
  for (const p of processes) {
    const inputs = inputsByProcess.get(p.id);
    p.inputWorkProducts = inputs ? [...inputs.values()].sort((a, b) => a.id.localeCompare(b.id)) : [];
  }
}

/** Fixed key order for process JSON (Korean primary, English aid next to it). */
function shapeProcess(p, enNames) {
  return {
    id: p.id,
    name: p.name,
    ...(p.nameEn ? { nameEn: p.nameEn } : {}),
    pamVersion: "4.1",
    category: p.category,
    pamSection: p.pamSection,
    page: p.page,
    purpose: p.purpose,
    outcomes: p.outcomes,
    basePractices: p.basePractices,
    outputWorkProducts: p.outputWorkProducts.map((w) => ({
      id: w.id,
      name: w.name,
      ...(enNames[w.id] ? { nameEn: enNames[w.id] } : {}),
    })),
    inputWorkProducts: p.inputWorkProducts ?? [],
    traceBPs: p.traceBPs,
  };
}

function main() {
  checkSources();
  const ratingScale = readJsonStrict(resolve(OUT_DIR, "ratingScale.json"));

  console.log("Parsing PAM 4.1 (Korean)...");
  const pamText = readFileSync(src(PAM_FILE), "utf8");
  const pam = parsePam41(pamText);
  console.log(`  → ${pam.processes.length} processes`);
  console.log(`  → ${Object.keys(pam.processAttributes).length} PAs (PA 1.1 .. 5.2)`);
  console.log(`  → ${Object.keys(pam.informationItems).length} information items`);

  console.log("Merging PAM 4.1 English...");
  mergeEnglish(pam, src(PAM_EN_DIR));

  console.log("Merging work product catalog...");
  const prevWps =
    readJsonStrict(resolve(OUT_DIR, "workProducts.json"), {
      optional: true,
      missingWarning: "work product aliases and nameEn will be empty",
    }) ?? {};
  const enNames = Object.fromEntries(Object.entries(prevWps).map(([id, w]) => [id, w.nameEn ?? w.name]));
  const items = {};
  for (const [id, item] of Object.entries(pam.informationItems)) {
    items[id] = WP_NAME_FIXES[id] ? { ...item, name: WP_NAME_FIXES[id] } : item;
  }
  const wps = mergeWorkProducts(prevWps, items, enNames);
  const retired = Object.values(wps).filter((w) => w.retired).length;
  console.log(`  → ${Object.keys(wps).length} work products (${retired} retired)`);

  console.log("Parsing Guideline 2026...");
  const koGuide = readFileSync(src(GUIDELINE_KO_FILE), "utf8");
  const enGuide = existsSync(src(GUIDELINE_EN_FILE)) ? readFileSync(src(GUIDELINE_EN_FILE), "utf8") : null;
  const guideline = parseGuideline2026(koGuide, enGuide);
  console.log(`  → ${guideline.rules.length} rules`);

  console.log("Merging V-model seed edges into inputWorkProducts...");
  const seedEdges = readJson(SEED_PATH, {}).edges ?? [];
  mergeSeedInputs(pam.processes, seedEdges, wps);
  const processes = pam.processes
    .map((p) => shapeProcess(p, enNames))
    .sort((a, b) => a.id.localeCompare(b.id));
  const withInputs = processes.filter((p) => p.inputWorkProducts.length).length;
  console.log(`  → ${seedEdges.length} edges, ${withInputs}/${processes.length} processes receive inputs`);

  const pas = Object.fromEntries(Object.entries(pam.processAttributes).filter(([, pa]) => pa.level <= 3));

  const guidelineRuleCounts = {};
  for (const p of processes) guidelineRuleCounts[p.id] = 0;
  for (const r of guideline.rules) {
    if (r.scope?.kind === "process" && r.scope.id in guidelineRuleCounts) guidelineRuleCounts[r.scope.id]++;
  }

  mkdirSync(PROCESSES_DIR, { recursive: true });
  for (const p of processes) writeJson(resolve(PROCESSES_DIR, `${p.id}.json`), p);
  writeJson(resolve(OUT_DIR, "processAttributes.json"), pas);
  writeJson(resolve(OUT_DIR, "workProducts.json"), wps);
  writeJson(resolve(OUT_DIR, "guideline.json"), guideline);
  writeJson(resolve(OUT_DIR, "processGraph.json"), { edges: seedEdges });

  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    sources: SOURCES,
    pamBytes: pamText.length,
    guidelineBytes: koGuide.length,
    processCount: processes.length,
    processesById: processes.map((p) => ({
      id: p.id,
      bps: p.basePractices.length,
      bpsWithoutEnglish: p.basePractices.filter((b) => !b.titleEn).map((b) => b.id),
      outcomes: p.outcomes.length,
      outputWPs: p.outputWorkProducts.length,
      inputWPs: p.inputWorkProducts.length,
      traceBPs: p.traceBPs,
      guidelineRules: guidelineRuleCounts[p.id],
    })),
    paCount: Object.keys(pam.processAttributes).length,
    paWritten: Object.keys(pas).length,
    pasById: Object.fromEntries(
      Object.entries(pam.processAttributes).map(([k, v]) => [k, { level: v.level, gps: v.genericPractices.length }])
    ),
    wpCount: Object.keys(wps).length,
    wpRetired: retired,
    guidelineVersion: guideline.version,
    guidelineRuleCount: guideline.rules.length,
  };
  writeJson(resolve(OUT_DIR, "_summary.json"), summary);

  // Single-file bundle for the browser (ESM JSON import, e.g. from Vite).
  // Guideline text stays server-side; only per-process rule counts go here.
  const bundle = {
    version: "aspice-v4.1",
    generatedAt,
    sources: SOURCES,
    ratingScale,
    processes,
    processAttributes: pas,
    workProducts: wps,
    processGraph: { edges: seedEdges },
    guidelineRuleCounts,
  };
  writeJson(resolve(OUT_DIR, "all.json"), bundle, false);

  console.log(`  → wrote all.json (${Math.round(JSON.stringify(bundle).length / 1024)} KB)`);
  console.log(`Extraction complete: ${processes.length} processes, ${guideline.rules.length} rules.`);
}

main();
