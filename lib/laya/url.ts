export interface ResolvedLayaEndpoints {
  baseUrl: string;
  predictUrl: string;
  healthUrl: string;
}

/**
 * Normalizes a user-provided Laya base URL or full `/predict` endpoint into
 * `{ baseUrl, predictUrl, healthUrl }`. Strictly allows `http:` and `https:`.
 */
export function resolveLayaEndpoints(rawUrl: string): ResolvedLayaEndpoints {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("API URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL. Provide a full URL starting with http:// or https://.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported protocol. Only http:// and https:// URLs are allowed.");
  }

  // Strip trailing slashes first
  let pathname = parsed.pathname.replace(/\/+$/, "");

  // If user pasted full /predict or /health endpoint, strip that suffix to get the base path
  if (pathname.endsWith("/predict")) {
    pathname = pathname.slice(0, -"/predict".length);
  } else if (pathname.endsWith("/health")) {
    pathname = pathname.slice(0, -"/health".length);
  }

  const basePath = pathname === "/" ? "" : pathname;
  const baseUrl = `${parsed.origin}${basePath}`;

  return {
    baseUrl,
    predictUrl: `${baseUrl}/predict`,
    healthUrl: `${baseUrl}/health`,
  };
}
