/**
 * Kanonik JSON: nesne anahtarları her seviyede sıralanır, boşluk yoktur,
 * `undefined` alanlar atlanır. Aynı veri her zaman aynı metni üretir;
 * bu sayede kayıt anında ve doğrulama anında aynı hash elde edilir.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error("Kanonik JSON: sonlu olmayan sayı desteklenmez");
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new Error(`Kanonik JSON: desteklenmeyen tür (${typeof value})`);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((v) => (v === undefined ? "null" : canonicalize(v))).join(",") + "]";
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}
