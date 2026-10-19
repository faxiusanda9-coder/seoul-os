import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initializeBrightDataFixture } from "./helpers/brightdata-fixture.mjs";

test("fixture initializer refuses production paths and preserves real budget and status bytes", async () => {
  const files = [
    "data/usage/brightdata-tiktok.json",
    "data/status/brightdata-tiktok.json",
  ];
  const before = await Promise.all(files.map((f) => readFile(f, "utf8")));
  await assert.rejects(
    () => initializeBrightDataFixture(resolve("data")),
    /isolated temporary directory/,
  );
  assert.deepEqual(
    await Promise.all(files.map((f) => readFile(f, "utf8"))),
    before,
  );
});
