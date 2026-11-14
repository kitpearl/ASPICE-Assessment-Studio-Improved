// 최소 JSON Schema 검증기. 저장소가 직접 의존하는 검증 라이브러리(zod/ajv)가 없어 추가하지 않고,
// assessment.schema.json 이 사용하는 부분집합만 구현한다:
//  type(배열 허용) · enum · required · properties · additionalProperties(false) · items · minLength · minimum · maximum · $ref(#/$defs/…)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const assessmentSchema = JSON.parse(readFileSync(resolve(here, "schema/assessment.schema.json"), "utf8"));

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
const matchesType = (v, t) => (t === "number" ? typeof v === "number" : t === "integer" ? Number.isInteger(v) : typeOf(v) === t);

/**
 * @returns {Array<{path: string, message: string}>}
 */
export function validateAgainstSchema(data, schema = assessmentSchema, root = schema, path = "$") {
  const errors = [];
  const err = (message) => errors.push({ path, message });
  if (schema.$ref) {
    const name = schema.$ref.replace("#/$defs/", "");
    const target = root.$defs?.[name];
    if (!target) return [{ path, message: `unknown $ref ${schema.$ref}` }];
    return validateAgainstSchema(data, target, root, path);
  }
  if (schema.enum && !schema.enum.some((e) => e === data)) {
    err(`값 ${JSON.stringify(data)} 은(는) 허용 목록 ${JSON.stringify(schema.enum)} 에 없음`);
    return errors;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(data, t))) {
      err(`형식 ${typeOf(data)} 은(는) 허용 형식 ${types.join("|")} 이(가) 아님`);
      return errors;
    }
  }
  if (typeof data === "string" && schema.minLength != null && data.length < schema.minLength) err(`문자열 길이 ${data.length} < ${schema.minLength}`);
  if (typeof data === "number") {
    if (schema.minimum != null && data < schema.minimum) err(`${data} < 최소 ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) err(`${data} > 최대 ${schema.maximum}`);
  }
  if (Array.isArray(data) && schema.items) data.forEach((item, i) => errors.push(...validateAgainstSchema(item, schema.items, root, `${path}[${i}]`)));
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const k of schema.required ?? []) if (!(k in data)) errors.push({ path: `${path}.${k}`, message: "필수 필드 누락" });
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(data)) {
      if (props[k]) errors.push(...validateAgainstSchema(v, props[k], root, `${path}.${k}`));
      else if (schema.additionalProperties === false) errors.push({ path: `${path}.${k}`, message: "정의되지 않은 필드" });
    }
  }
  return errors;
}
