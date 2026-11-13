/**
 * spec/extract/mergeEnglish.js — attaches English PAM 4.1 text (from the
 * production repo's English canonical, kept under spec/sources/pam41-en) to
 * the Korean drafts as auxiliary fields, and merges the work product catalog.
 *
 * Korean stays primary (`name`, `title`, `description`); English goes into
 * `nameEn`, `titleEn`, `descriptionEn`, `notesEn`, `scopeEn`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Mutates processes / processAttributes in place.
 * @param {{ processes: object[], processAttributes: Record<string, object> }} drafts
 * @param {string} enDir directory holding processes/<ID>.json and processAttributes.json
 */
export function mergeEnglish({ processes, processAttributes }, enDir) {
  for (const p of processes) {
    const en = readJsonIfExists(resolve(enDir, "processes", `${p.id}.json`));
    if (!en) continue;
    if (en.name) p.nameEn = en.name;
    const enBps = new Map((en.basePractices ?? []).map((b) => [b.id, b]));
    for (const bp of p.basePractices) {
      const e = enBps.get(bp.id);
      if (!e) continue;
      if (e.title) bp.titleEn = e.title;
      if (e.description) bp.descriptionEn = e.description;
      if (Array.isArray(e.notes) && e.notes.length) bp.notesEn = e.notes;
    }
  }

  const enPas = readJsonIfExists(resolve(enDir, "processAttributes.json")) ?? {};
  for (const [id, pa] of Object.entries(processAttributes)) {
    const e = enPas[id];
    if (!e) continue;
    if (e.name) pa.nameEn = e.name;
    if (e.scope) pa.scopeEn = e.scope;
    const enGps = new Map((e.genericPractices ?? []).map((g) => [g.id, g]));
    for (const gp of pa.genericPractices) {
      const g = enGps.get(gp.id);
      if (!g) continue;
      if (g.title) gp.titleEn = g.title;
      if (g.description) gp.descriptionEn = g.description;
    }
  }
}

/**
 * @param {Record<string, {id:string,name:string,aliases?:string[]}>} prev previous catalog
 * @param {Record<string, {id:string,name:string,page?:number,characteristics?:object}>} items PAM 4.1 Annex B items
 * @param {Record<string, string>} enNames id → English name
 * @returns {Record<string, object>} catalog sorted by id
 */
export function mergeWorkProducts(prev, items, enNames) {
  const out = {};
  const ids = [...new Set([...Object.keys(items), ...Object.keys(prev)])].sort();
  for (const id of ids) {
    const item = items[id];
    const old = prev[id];
    const aliases = [...(old?.aliases ?? [])];
    if (!item) {
      out[id] = { id, name: old.name, nameEn: enNames[id] ?? old.name, aliases, retired: true };
      continue;
    }
    if (item.name.length >= 5 && !aliases.includes(item.name)) aliases.push(item.name);
    const wp = { id, name: item.name };
    if (enNames[id]) wp.nameEn = enNames[id];
    wp.aliases = aliases;
    if (item.characteristics) wp.characteristics = item.characteristics;
    if (item.page != null) wp.page = item.page;
    out[id] = wp;
  }
  return out;
}
