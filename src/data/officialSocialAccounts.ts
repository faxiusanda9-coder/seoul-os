import type { OfficialSocialAccount } from "../types/official";

const checked = "2026-10-15";
const account = (artistId: string, handle: string, verifiedBy: string): OfficialSocialAccount => ({
  artistId, platform: "x", accountUrl: `https://twitter.com/${handle}`,
  accountHandle: handle, verifiedBy, verifiedAt: checked, enabled: true,
});

/** Account URLs were read from the matching official site's outgoing social links. */
export const officialSocialAccounts: OfficialSocialAccount[] = [
  account("twice", "JYPETWICE", "https://twice.jype.com/"),
  account("stray-kids", "Stray_Kids", "https://straykids.jype.com/"),
  account("itzy", "ITZYOfficial", "https://itzy.jype.com/"),
  account("nmixx", "NMIXX_official", "https://nmixx.jype.com/"),
  account("day6", "DAY6Official", "https://day6.jype.com/"),
  account("xdinary-heroes", "XH_official", "https://xdinaryheroes.jype.com/"),
  { artistId: "kickflip", platform: "x", accountUrl: "https://x.com/kickflip_jype", accountHandle: "kickflip_jype", verifiedBy: "https://kickflip.jype.com/", verifiedAt: checked, enabled: true },
  { artistId: "nexz", platform: "x", accountUrl: "https://x.com/NEXZ_official", accountHandle: "NEXZ_official", verifiedBy: "https://nexz.jype.com/", verifiedAt: checked, enabled: true },
];

export const socialForArtist = (artistId: string) =>
  officialSocialAccounts.find((account) => account.artistId === artistId);
