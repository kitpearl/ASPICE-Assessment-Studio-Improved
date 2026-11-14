// 공식 N/P/L/F 와 제품 내부 6단계(P-/P+/L-/L+) 분리. 규칙 처리는 항상 공식 4단계만 쓴다.
import { collapse } from "../model/rating.js";
import { OFFICIAL_RATINGS } from "./constants.js";

const ORDINAL = { N: 0, P: 1, L: 2, F: 3 };

/** @param {string|null|undefined} r 제품 6단계 또는 공식 4단계 */
export function toOfficial(r) {
  if (r == null) return null;
  if (OFFICIAL_RATINGS.includes(r)) return r;
  try {
    return collapse(r);
  } catch {
    return null;
  }
}

/** 제품 내부 세분 등급(예: "L+")이면 그대로, 공식 등급이면 null — 공식 값과 섞지 않기 위해 별도 필드로 보관한다. */
export function productGradeOf(r) {
  return r != null && !OFFICIAL_RATINGS.includes(r) ? r : null;
}

export const ordinalOf = (official) => ORDINAL[official];
export const fromOrdinal = (n) => OFFICIAL_RATINGS[Math.max(0, Math.min(3, n))];
export const minRating = (a, b) => (ORDINAL[a] <= ORDINAL[b] ? a : b);
export const downBy = (r, steps) => fromOrdinal(ORDINAL[r] - Math.max(0, steps));
