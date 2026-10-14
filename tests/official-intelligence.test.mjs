import test from "node:test";
import assert from "node:assert/strict";
import { officialSources, isVerifiedOfficialSourceUrl } from "../src/data/officialSources.ts";
import { officialSocialAccounts } from "../src/data/officialSocialAccounts.ts";
import { classifyOfficialNotice, isValidOfficialDateOnly, isValidOfficialEvent } from "../src/utils/officialClassifier.ts";

test("only audited official links appear; no source has automatic sync permission", () => {
  assert.equal(officialSources.length, 10);
  for (const source of officialSources) {
    assert.equal(source.automationAllowed, false);
    for (const url of [source.noticeUrl, source.scheduleUrl].filter(Boolean))
      assert.equal(isVerifiedOfficialSourceUrl(url), true);
  }
  assert.equal(isVerifiedOfficialSourceUrl("javascript:alert(1)"), false);
  assert.equal(isVerifiedOfficialSourceUrl("https://evil.example/notice"), false);
  assert.equal(isVerifiedOfficialSourceUrl("https://twice.jype.com.evil.example/notice"), false);
});

test("verified X accounts have official-site evidence and safe profile URLs", () => {
  assert.equal(officialSocialAccounts.length, 8);
  for (const account of officialSocialAccounts) {
    assert.match(account.accountUrl, /^https:\/\/(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+$/);
    assert.match(account.verifiedBy, /^https:\/\/[a-z0-9-]+\.jype\.com\/$/);
  }
});

test("notice semantics prioritize teaser, media and ticket context", () => {
  const cases = [
    ["TWICE MV Teaser Image", "teaser"],
    ["TWICE Official M/V", "media"],
    ["HAPPY BIRTHDAY DOWOON", "anniversary"],
    ["New album PRE-ORDER MARKET", "merchandise"],
    ["World tour ticketing information", "ticket"],
    ["[TOUR-LOG] EP10 LONDON", "media"],
    ["Special Clip", "media"],
    ["[공지] 공식 홈페이지 서비스 점검 안내", "official-notice"],
    ["Young K interview", "other"],
  ];
  for (const [title, expected] of cases) assert.equal(classifyOfficialNotice(title), expected, title);
});

test("calendar dates do not infer a time or roll invalid dates", () => {
  assert.equal(isValidOfficialDateOnly("2026-11-20"), true);
  assert.equal(isValidOfficialDateOnly("2026-02-30"), false);
  const base = {
    id: "event-1", artistId: "twice", title: "Confirmed event", sourceUrl: "https://twice.jype.com/schedule",
    eventCategory: "concert", startAt: null, localDate: "2026-11-20", timezone: "Asia/Seoul",
    allDay: true, timeConfirmed: false, sourceStatus: "verified", lastCheckedAt: "2026-10-15",
  };
  assert.equal(isValidOfficialEvent(base), true);
  assert.equal(isValidOfficialEvent({ ...base, timeConfirmed: true }), false);
  assert.equal(isValidOfficialEvent({ ...base, localDate: "2026-02-30" }), false);
  assert.equal(isValidOfficialEvent({ ...base, localDate: undefined }), false);
});
