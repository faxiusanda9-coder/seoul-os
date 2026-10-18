export class DiscoveryError extends Error {
  constructor(code, state = "failed") {
    super(code);
    this.code = code;
    this.state = state;
  }
}
export function safeDiscoveryError(error) {
  return error instanceof DiscoveryError
    ? error
    : new DiscoveryError("SOURCE_REQUEST_FAILED");
}
export async function apiRequest(
  url,
  init = {},
  {
    fetcher = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    timeoutMs = 10000,
    retries = 2,
    deadline = Infinity,
  } = {},
) {
  // Never forward credentials through redirects, arbitrary endpoints or errors.
  const u = new URL(url);
  if (
    !["graph.facebook.com", "open.tiktokapis.com", "api.github.com"].includes(
      u.hostname,
    ) ||
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port
  )
    throw new DiscoveryError("INVALID_API_ENDPOINT");
  for (let n = 0; n <= retries; n++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new DiscoveryError("SOURCE_TIME_BUDGET_EXCEEDED");
    let response;
    try {
      response = await fetcher(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(timeoutMs, remaining)),
        ),
      });
    } catch {
      if (n < retries) {
        await sleep(500 * 2 ** n);
        continue;
      }
      throw new DiscoveryError("NETWORK_OR_TIMEOUT");
    }
    if ([401, 403].includes(response.status))
      throw new DiscoveryError("AUTHORIZATION_REQUIRED", "auth-required");
    if (response.status === 204 && response.ok) return {};
    let body;
    try {
      body = await response.json();
    } catch {
      if (response.ok) throw new DiscoveryError("INVALID_API_RESPONSE");
      body = {};
    }
    const code = body?.error?.code ?? body?.error;
    const auth =
      [401, 403].includes(response.status) ||
      [
        190,
        10,
        200,
        "access_token_invalid",
        "scope_not_authorized",
        "scope_permission_missed",
        "invalid_grant",
        "invalid_token",
        "invalid_client",
      ].includes(code);
    if (auth)
      throw new DiscoveryError("AUTHORIZATION_REQUIRED", "auth-required");
    const rate =
      response.status === 429 ||
      [4, 17, 32, 613, 80004, "rate_limit_exceeded"].includes(code);
    if (rate || response.status >= 500) {
      if (n < retries) {
        const retry = Number(response.headers?.get("retry-after"));
        await sleep(
          Math.min(
            5000,
            Math.max(500 * 2 ** n, Number.isFinite(retry) ? retry * 1000 : 0),
          ),
        );
        continue;
      }
      throw new DiscoveryError(rate ? "RATE_LIMITED" : "API_SERVER_ERROR");
    }
    if (!response.ok || (code !== undefined && code !== "ok"))
      throw new DiscoveryError("API_REJECTED_REQUEST");
    return body;
  }
}
