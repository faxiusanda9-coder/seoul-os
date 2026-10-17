import raw from "../../data/social/accounts.json";
import channels from "../../data/youtube/channels.json";
import { parseSocialAccounts } from "../../data/schemas/social.schema";
const parsed = parseSocialAccounts(
  raw,
  new Set(channels.channels.filter((c) => c.enabled).map((c) => c.artistId)),
);
if (!parsed) throw new Error("Invalid published social account registry");
export const verifiedMediaAccounts = parsed;
