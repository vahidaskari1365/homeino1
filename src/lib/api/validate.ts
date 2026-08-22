import { ApiError } from "./errors";

/**
 * Minimal, dependency-free validation primitives with shared schemas.
 * Async route handlers validate payloads against plain rules and throw ApiError
 * with a uniform shape on failure.
 */

export type Rule = (v: unknown) => unknown;

export const isString = (max = 5000): Rule => (v) => {
  if (typeof v !== "string") throw ApiError.badRequest("مقدار باید متن باشد");
  const s = v.trim();
  if (s.length > max) throw ApiError.badRequest(`حداکثر ${max} کاراکتر مجاز است`);
  return s;
};

export const isOptionalString = (max = 5000): Rule => (v) =>
  v === undefined || v === null || v === "" ? undefined : isString(max)(v);

export const isEmail: Rule = (v) => {
  const s = isString(320)(v) as string;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw ApiError.badRequest("ایمیل نامعتبر است");
  return s.toLowerCase();
};

export const isPassword: Rule = (v) => {
  const s = isString(200)(v) as string;
  if (s.length < 8) throw ApiError.badRequest("رمز عبور باید حداقل ۸ کاراکتر باشد");
  return s;
};

export const isInt = (min?: number, max?: number): Rule => (v) => {
  if (!Number.isInteger(v)) throw ApiError.badRequest("مقدار باید عدد صحیح باشد");
  const n = v as number;
  if (min !== undefined && n < min) throw ApiError.badRequest(`حداقل ${min} مجاز است`);
  if (max !== undefined && n > max) throw ApiError.badRequest(`حداکثر ${max} مجاز است`);
  return n;
};

export const isOptionalInt = (min?: number, max?: number): Rule => (v) =>
  v === undefined || v === null ? undefined : isInt(min, max)(v);

export const isBoolean: Rule = (v) => {
  if (typeof v !== "boolean") throw ApiError.badRequest("مقدار باید boolean باشد");
  return v;
};

export const isOptionalBoolean: Rule = (v) =>
  v === undefined ? undefined : isBoolean(v);

export const isArrayOfStrings: Rule = (v) => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
    throw ApiError.badRequest("انتظار آرایه‌ای از متن می‌رود");
  return v;
};

export const isOptionalArrayOfStrings: Rule = (v) =>
  v === undefined || v === null ? [] : isArrayOfStrings(v);

export const isEnum =
  <T extends string>(values: readonly T[]): Rule =>
  (v) => {
    if (!values.includes(v as T))
      throw ApiError.badRequest(`مقدار باید یکی از: ${values.join(", ")} باشد`);
    return v as T;
  };

export const isOptionalEnum =
  <T extends string>(values: readonly T[]): Rule =>
  (v) =>
    v === undefined || v === null ? undefined : isEnum(values)(v);

export const isObject: Rule = (v) => {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw ApiError.badRequest("مقدار باید شیء باشد");
  return v as Record<string, unknown>;
};

export const isOptionalObject: Rule = (v) =>
  v === undefined || v === null ? undefined : isObject(v);

export const isUuid: Rule = (v) => {
  const s = isString(64)(v) as string;
  if (!/^[0-9a-fA-F-]{36}$/.test(s)) throw ApiError.badRequest("شناسه نامعتبر است");
  return s;
};

export const isOptionalUuid: Rule = (v) =>
  v === undefined || v === null ? undefined : isUuid(v);

export const isSlug: Rule = (v) => {
  const s = isString(200)(v) as string;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))
    throw ApiError.badRequest("اسلاگ فقط شامل حروف کوچک لاتین و خط تیره است");
  return s;
};

export const isOptionalSlug: Rule = (v) =>
  v === undefined || v === null ? undefined : isSlug(v);

export type Schema = Record<string, Rule>;

/**
 * Validate an unknown payload against a schema. Returns a typed object of only
 * the declared keys (unknown keys are dropped). All rules run; first throw wins.
 */
export function validate(body: unknown, schema: Schema): Record<string, any> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw ApiError.badRequest("پرداخت نامعتبر است");
  }
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(schema)) {
    out[key] = rule(src[key]);
  }
  return out;
}
