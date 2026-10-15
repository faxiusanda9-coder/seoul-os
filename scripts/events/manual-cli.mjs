import { readFile } from "node:fs/promises";
import { addDraft, reviewDraft } from "./manual-events.mjs";
const channels = JSON.parse(
  await readFile(
    new URL("../../data/youtube/channels.json", import.meta.url),
    "utf8",
  ),
);
const artistIds = new Set(
  channels.channels.filter((c) => c.enabled).map((c) => c.artistId),
);
const params = Object.fromEntries(
  process.argv.slice(3).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);
if (process.argv[2] === "add")
  console.log(
    `已创建待审核事件 ${await addDraft(params, artistIds)}；请核对官方来源并运行 review。`,
  );
else if (process.argv[2] === "review") {
  await reviewDraft(params.id, params.reviewer, artistIds);
  console.log("审核通过；运行 npm run sync:calendar 发布。");
} else
  throw new Error(
    "Usage: npm run event:manual -- add --artistId=... --title=... --eventType=concert --localDate=YYYY-MM-DD --sourceUrl=https://...; or review --id=... --reviewer=...",
  );
