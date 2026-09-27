export function contextValue(context: unknown, field: string): unknown {
  return field
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === "object" && Object.hasOwn(value, key)
          ? (value as Record<string, unknown>)[key]
          : undefined,
      context,
    );
}
export function interpolate(
  text: string,
  context: unknown,
  encode = false,
): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = contextValue(context, key);
    if (value === undefined || value === null || typeof value === "object")
      throw new Error(
        `Missing scalar input: ${key}. Review the workflow input before running.`,
      );
    return encode ? encodeURIComponent(String(value)) : String(value);
  });
}
export function actionBody(text: string, context: unknown): string {
  if (!text.trim()) return JSON.stringify(context);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "HTTP body must be valid JSON. Put input references inside strings, such as {{input.title}}.",
    );
  }
  const fill = (v: unknown): unknown => {
    if (typeof v === "string") {
      const exact = v.match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/);
      if (exact) {
        const value = contextValue(context, exact[1]);
        if (value === undefined) throw new Error(`Missing input: ${exact[1]}.`);
        return value;
      }
      return interpolate(v, context);
    }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, value]) => [k, fill(value)]),
      );
    return v;
  };
  return JSON.stringify(fill(parsed));
}
