import { resolveLayaEndpoints } from "@/lib/laya/url";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function extractUpstreamError(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    return JSON.stringify(detail);
  }
  if (typeof data === "string" && data.trim()) {
    return data;
  }
  return fallback || "Health check failed";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url") ?? "";

  let healthUrl: string;
  try {
    healthUrl = resolveLayaEndpoints(rawUrl).healthUrl;
  } catch (err) {
    return Response.json(
      {
        ok: false,
        status: 400,
        latencyMs: 0,
        data: null,
        error: err instanceof Error ? err.message : "Invalid URL",
        resolvedUrl: "",
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const startedAt = performance.now();
  try {
    const upstream = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const rawText = await upstream.text();

    let data: unknown = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    }

    return Response.json(
      {
        ok: upstream.ok,
        status: upstream.status,
        latencyMs,
        data,
        error: upstream.ok
          ? undefined
          : extractUpstreamError(data, upstream.statusText),
        resolvedUrl: healthUrl,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const errorMessage =
      err instanceof Error
        ? err.name === "TimeoutError" || err.name === "AbortError"
          ? "Health check timed out after 5s"
          : err.message
        : "Unable to reach Laya API";

    return Response.json(
      {
        ok: false,
        status: 502,
        latencyMs,
        data: null,
        error: errorMessage,
        resolvedUrl: healthUrl,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }
}
