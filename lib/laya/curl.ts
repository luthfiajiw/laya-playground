function escapePosixSingleQuotes(value: string): string {
  return value.replace(/'/g, "'\\''");
}

/**
 * Generates a shell-escaped multi-line `curl -X POST` command for `/predict`.
 */
export function buildCurlCommand(
  predictUrl: string,
  payload: Record<string, unknown>
): string {
  const escapedUrl = escapePosixSingleQuotes(predictUrl);
  const escapedBody = escapePosixSingleQuotes(JSON.stringify(payload, null, 2));

  return [
    `curl -X POST '${escapedUrl}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${escapedBody}'`,
  ].join("\n");
}
