import type { NodeData } from "../shared/schema";
import { isOriginAllowed, actionToken } from "./integrations";
import { interpolate, actionBody } from "./action-context";

function nextLink(header: string | null, current: URL): URL | undefined {
  if (!header) return;
  for (const match of header.matchAll(/<([^>]+)>\s*([^<]*)/g)) {
    const rel = match[2].match(/\brel\s*=\s*(?:"([^"]+)"|([^;,\s]+))/i);
    if ((rel?.[1] || rel?.[2] || "").split(/\s+/).includes("next")) {
      const next = new URL(match[1], current);
      next.hash = "";
      return next;
    }
  }
}
async function readResponse(
  response: Response,
): Promise<{ data: unknown; bytes: number }> {
  const reader = response.body?.getReader();
  let text = "",
    bytes = 0;
  const decoder = new TextDecoder();
  if (reader)
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1_000_000) {
          await reader.cancel();
          throw new Error("HTTP response exceeded 1 MB.");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  try {
    return { data: JSON.parse(text), bytes };
  } catch {
    return { data: text, bytes };
  }
}
export async function executeHttpAction(
  d: NodeData,
  context: unknown,
  signal: AbortSignal,
  emit: (message: string) => void = () => {},
) {
  let url: URL;
  try {
    url = new URL(interpolate(d.url, context, true));
  } catch {
    throw new Error(
      "Set a valid URL for this HTTP action and supply every referenced input field.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !isOriginAllowed(url.origin)
  )
    throw new Error(
      `Allow ${url.origin} in Settings → Websites & API access (or ACTION_ALLOWED_ORIGINS) before running this action.`,
    );
  if (d.paginate && d.method !== "GET")
    throw new Error("Pagination is available for GET requests only.");
  const origin = url.origin,
    token = actionToken(d.authEnv, origin);
  if (
    token &&
    url.protocol !== "https:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw new Error(
      "Credentials require HTTPS, except for local development endpoints.",
    );
  const items: unknown[] = [],
    seen = new Set<string>();
  let totalBytes = 0;
  const maxPages = d.paginate ? d.maxPages : 1;
  for (let page = 1; page <= maxPages; page++) {
    signal.throwIfAborted();
    if (seen.has(url.href))
      throw new Error(
        "The API returned a repeated pagination link. Stopped before requesting the same page again.",
      );
    seen.add(url.href);
    const response = await fetch(url, {
      method: d.method,
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(d.method === "POST" ? { body: actionBody(d.body, context) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok) {
      const detail =
        response.status === 401
          ? "Check the credential selected for this action."
          : response.status === 403
            ? "Check token permissions or the API rate limit."
            : response.status === 404
              ? "Check the resource path and your access to it."
              : response.status === 429
                ? `Rate limited. Retry after ${response.headers.get("retry-after") || "the provider's reset window"}.`
                : "Inspect the endpoint and retry when it is available.";
      throw new Error(
        `HTTP action returned ${response.status}${page > 1 ? ` on page ${page}` : ""}. ${detail}`,
      );
    }
    const { data, bytes } = await readResponse(response);
    totalBytes += bytes;
    if (!d.paginate) return { output: data };
    if (!Array.isArray(data))
      throw new Error(
        "Paginated actions require a JSON array on each page. Turn off pagination for this endpoint.",
      );
    if (totalBytes > 5_000_000 || items.length + data.length > 10000)
      throw new Error(
        "Paginated results exceeded the 5 MB or 10,000 item limit. Narrow the API query.",
      );
    items.push(...data);
    emit(`Read API page ${page}: ${data.length} items (${items.length} total)`);
    const next = nextLink(response.headers.get("link"), url);
    if (next && (next.origin !== origin || next.username || next.password))
      throw new Error(
        "The API's next-page link changes origin or embeds credentials. No request was sent to that link.",
      );
    if (!next || page === maxPages) {
      const truncated = !!next;
      if (truncated)
        emit(
          `Page limit reached: collected ${items.length} items; more pages are available.`,
        );
      return {
        output: {
          items,
          pagination: {
            pages: page,
            itemCount: items.length,
            truncated,
            ...(next ? { next: next.href } : {}),
          },
        },
      };
    }
    url = next;
  }
  throw new Error("Invalid pagination limit.");
}
