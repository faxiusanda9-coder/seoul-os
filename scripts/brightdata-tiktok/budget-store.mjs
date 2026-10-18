import { execFileSync } from "node:child_process";
import { parseLedger, BrightDataError } from "./budget.mjs";

export const BUDGET_BRANCH = "automation/brightdata-budget";
// One authoritative ledger across PR probes and the future main scheduler.
// Git's fast-forward update rejects a competing reservation before its POST.
// This branch has no site code and never triggers the Pages workflow.
export function gitBudgetStore({
  cwd = process.cwd(),
  allowCreate = false,
  run = (args, input) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
    }),
} = {}) {
  let expected,
    loaded = false,
    priorText = null;
  const ref = `refs/heads/${BUDGET_BRANCH}`;
  return {
    async load(seed) {
      try {
        const output = run(["ls-remote", "--heads", "origin", ref]).trim();
        expected = output ? output.split(/\s/)[0] : null;
        if (expected && !/^[a-f0-9]{40}$/.test(expected))
          throw Error("Invalid remote head");
        if (!expected) {
          if (
            !allowCreate ||
            seed.reservations.length ||
            seed.accountFingerprint
          )
            throw new BrightDataError("CENTRAL_BUDGET_NOT_INITIALIZED");
          loaded = true;
          return parseLedger(structuredClone(seed));
        }
        run(["fetch", "--no-tags", "origin", ref]);
        priorText = run(["show", `${expected}:ledger.json`]);
        const value = parseLedger(JSON.parse(priorText));
        loaded = true;
        return value;
      } catch (e) {
        if (e instanceof BrightDataError) throw e;
        throw new BrightDataError("CENTRAL_BUDGET_READ_FAILED");
      }
    },
    async save(ledger) {
      if (!loaded) throw new BrightDataError("CENTRAL_BUDGET_NOT_LOADED");
      parseLedger(ledger);
      const text = JSON.stringify(ledger, null, 2) + "\n";
      if (text === priorText) return;
      try {
        const blob = run(["hash-object", "-w", "--stdin"], text).trim();
        const tree = run(
          ["mktree"],
          `100644 blob ${blob}\tledger.json\n`,
        ).trim();
        const commit = run([
          "commit-tree",
          tree,
          ...(expected ? ["-p", expected] : []),
          "-m",
          "budget: persist TikTok free-record reservation",
        ]).trim();
        // No force, no automatic rebase/retry: a race is a hard stop.
        run(["push", "origin", `${commit}:${ref}`]);
        expected = commit;
        priorText = text;
      } catch {
        throw new BrightDataError("CENTRAL_BUDGET_PERSIST_OR_CONFLICT");
      }
    },
  };
}
