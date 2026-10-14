import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const zh = JSON.parse(
  await readFile(new URL("../src/locales/zh-CN.json", import.meta.url), "utf8"),
);
const en = JSON.parse(
  await readFile(new URL("../src/locales/en.json", import.meta.url), "utf8"),
);

test("Chinese and English UI dictionaries have identical keys and parameters", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const key of Object.keys(zh)) {
    assert.ok(zh[key].trim(), `${key} has empty Chinese copy`);
    assert.ok(en[key].trim(), `${key} has empty English copy`);
    const placeholders = (value) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(
      placeholders(en[key]),
      placeholders(zh[key]),
      `${key} has mismatched parameters`,
    );
  }
});
