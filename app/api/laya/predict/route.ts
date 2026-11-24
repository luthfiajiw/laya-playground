import { resolveLayaEndpoints } from "@/lib/laya/url";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

interface PredictProxyBody {
  targetUrl?: unknown;
  payload?: unknown;
}

export async function POST(request: Request) {
  let body: PredictProxyBody;
  try {
    body = (await request.json()) as PredictProxyBody;
  } catch {
    return Response.json(
      {
        ok: false,
        status: 400,
        latencyMs: 0,
        data: { detail: "Invalid JSON request body." },
        rawText: "",
        resolvedUrl: "",
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const rawTargetUrl =
    typeof body.targetUrl === "string" ? body.targetUrl : "";

  let predictUrl: string;
  try {
    predictUrl = resolveLayaEndpoints(rawTargetUrl).predictUrl;
  } catch (err) {
    return Response.json(
      {
        ok: false,
        status: 400,
        latencyMs: 0,
        data: {
          detail: err instanceof Error ? err.message : "Invalid targetUrl",
        },
        rawText: "",
        resolvedUrl: "",
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (
    typeof body.payload !== "object" ||
    body.payload === null ||
    Array.isArray(body.payload)
  ) {
    return Response.json(
      {
        ok: false,
        status: 400,
        latencyMs: 0,
        data: { detail: "Request 'payload' must be a JSON object." },
        rawText: "",
        resolvedUrl: predictUrl,
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const startedAt = performance.now();
  try {
    const upstream = await fetch(predictUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body.payload),
      cache: "no-store",
      signal: request.signal,
    });

    const latencyMs = Math.round(performance.now() - startedAt);
    const rawText = await upstream.text();

    let data: unknown = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { detail: rawText };
      }
    }

    const responseStatus =
      upstream.status >= 200 && upstream.status <= 599 ? upstream.status : 502;

    return Response.json(
      {
        ok: upstream.ok,
        status: upstream.status,
        latencyMs,
        data,
        rawText,
        resolvedUrl: predictUrl,
      },
      { status: responseStatus, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError");
    const status = isAbort ? 504 : 502;
    const message =
      err instanceof Error ? err.message : "Failed to connect to Laya API";

    return Response.json(
      {
        ok: false,
        status,
        latencyMs,
        data: { detail: message },
        rawText: "",
        resolvedUrl: predictUrl,
      },
      { status, headers: NO_STORE_HEADERS }
    );
  }
}
