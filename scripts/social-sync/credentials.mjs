import { apiRequest, DiscoveryError } from "./http.mjs";
import { isInstant } from "../../data/schemas/social.schema.ts";

export function readTikTokCredentials(env) {
  try {
    const data = JSON.parse(env.TIKTOK_CREDENTIALS_JSON || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw 0;
    return data;
  } catch {
    throw new DiscoveryError("INVALID_TIKTOK_CREDENTIALS", "auth-required");
  }
}
// Optional, explicitly configured fine-grained PAT with repository Secrets:write.
// GITHUB_TOKEN is deliberately not used for token persistence.
export function githubCredentialStore(env, options = {}) {
  if (
    !env.SOCIAL_SECRET_WRITER_TOKEN ||
    !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? "")
  )
    return null;
  return async (credentials) => {
    const { default: sodium } = await import("libsodium-wrappers");
    await sodium.ready;
    const base = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/secrets`;
    const headers = {
      Authorization: `Bearer ${env.SOCIAL_SECRET_WRITER_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    };
    const key = await apiRequest(`${base}/public-key`, { headers }, options);
    if (typeof key.key !== "string" || typeof key.key_id !== "string")
      throw new DiscoveryError(
        "CREDENTIAL_PERSISTENCE_FAILED",
        "auth-required",
      );
    const encrypted = sodium.to_base64(
      sodium.crypto_box_seal(
        sodium.from_string(JSON.stringify(credentials)),
        sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL),
      ),
      sodium.base64_variants.ORIGINAL,
    );
    await apiRequest(
      `${base}/TIKTOK_CREDENTIALS_JSON`,
      {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted_value: encrypted,
          key_id: key.key_id,
        }),
      },
      options,
    );
  };
}
export async function tikTokCredentials(artistId, map, env, options) {
  let c = map[artistId];
  if (!c)
    throw new DiscoveryError(
      "TARGET_ACCOUNT_AUTHORIZATION_MISSING",
      "not-configured",
    );
  if (
    typeof c.accessToken !== "string" ||
    !c.accessToken ||
    typeof c.openId !== "string" ||
    !/^[\w-]{5,128}$/.test(c.openId) ||
    !isInstant(c.expiresAt)
  )
    throw new DiscoveryError("INVALID_TIKTOK_CREDENTIALS", "auth-required");
  if (
    c.refreshExpiresAt !== undefined &&
    (!isInstant(c.refreshExpiresAt) ||
      Date.parse(c.refreshExpiresAt) <= Date.parse(options.now))
  )
    throw new DiscoveryError("TOKEN_RENEWAL_REQUIRED", "auth-required");
  if (Date.parse(c.expiresAt) > Date.parse(options.now) + 15 * 60000) return c;
  // No refresh call without a durable sink: a rotated refresh token must not be lost.
  if (
    options.dryRun ||
    !options.persist ||
    !c.refreshToken ||
    !env.TIKTOK_CLIENT_KEY ||
    !env.TIKTOK_CLIENT_SECRET
  )
    throw new DiscoveryError("TOKEN_RENEWAL_REQUIRED", "auth-required");
  const refreshed = await apiRequest(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        client_secret: env.TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: c.refreshToken,
      }).toString(),
    },
    { ...options, retries: 0 },
  );
  if (
    refreshed.open_id !== c.openId ||
    typeof refreshed.access_token !== "string" ||
    !refreshed.access_token ||
    typeof refreshed.refresh_token !== "string" ||
    !refreshed.refresh_token ||
    !Number.isSafeInteger(refreshed.expires_in) ||
    refreshed.expires_in <= 0 ||
    typeof refreshed.scope !== "string" ||
    !["user.info.basic", "user.info.profile", "video.list"].every((s) =>
      refreshed.scope?.split(",").includes(s),
    )
  )
    throw new DiscoveryError("TOKEN_REFRESH_INVALID", "auth-required");
  c = {
    ...c,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: new Date(
      Date.parse(options.now) + refreshed.expires_in * 1000,
    ).toISOString(),
    ...(Number.isSafeInteger(refreshed.refresh_expires_in) &&
    refreshed.refresh_expires_in > 0
      ? {
          refreshExpiresAt: new Date(
            Date.parse(options.now) + refreshed.refresh_expires_in * 1000,
          ).toISOString(),
        }
      : {}),
  };
  map[artistId] = c;
  try {
    await options.persist(map);
  } catch {
    throw new DiscoveryError("CREDENTIAL_PERSISTENCE_FAILED", "auth-required");
  }
  return c;
}
