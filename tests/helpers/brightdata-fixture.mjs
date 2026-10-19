import { writeFile } from "node:fs/promises";
import { resolve, sep, join } from "node:path";
import { tmpdir } from "node:os";
import { loadSocialAccounts } from "../../scripts/social-sync/index.mjs";
import { emptyBrightDataStatus } from "../../scripts/brightdata-tiktok/sync.mjs";

// Controlled tests must not inherit the account fingerprint, spent budget or
// timestamps of the live run. This helper is forbidden on production paths.
export async function initializeBrightDataFixture(root) {
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep))
    throw Error("Bright Data fixtures require an isolated temporary directory");
  const accounts = await loadSocialAccounts(root);
  await writeFile(
    join(root, "usage/brightdata-tiktok.json"),
    JSON.stringify({
      schemaVersion: 1,
      accountFingerprint: null,
      reservations: [],
    }) + "\n",
  );
  await writeFile(
    join(root, "status/brightdata-tiktok.json"),
    JSON.stringify(emptyBrightDataStatus(accounts)) + "\n",
  );
}
