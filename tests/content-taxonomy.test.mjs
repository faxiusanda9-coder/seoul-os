import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifyContent, contentCategories } from "../src/utils/contentClassifier.ts";
import { parseChannelSnapshot, parseChannelsConfig } from "../data/schemas/content.schema.ts";

const cases = [
  ["TWICE MV Behind The Scenes", "behind", "making"],
  ["TWICE Official M/V", "music", "official-mv"],
  ["Stray Kids M/V Teaser", "music", "music-preview"],
  ["Stray Kids Stage Video", "stage", "live-stage"],
  ["TWICE Live Stage @ World Tour", "stage", "live-stage"],
  ["TWICE Special Vinyl WORLD TOUR - LIVE : D-2", "other", undefined],
  ["TWICE Special Vinyl WORLD TOUR - LIVE TEASER VIDEO", "other", undefined],
  ["ITZY TOUR-LOG EP10", "behind", "tour-log"],
  ["ITZY YouTube Live Stream", "live", "livestream"],
  ["[Stray Kids : SKZ-TALKER] Ep.87", "variety", "series"],
  ["TWICE Season's Greetings Teaser", "fan", "fan-content"],
  ["TWICE 2027 Season's Greetings Behind", "behind", "making"],
  ["Official notice: ticketing schedule", "notice", "announcement"],
  ["🪽🖤 #TWICE #NAYEON", "other", undefined],
];

test("specific K-pop rules resolve conflicts and leave ambiguous shorts unclassified", () => {
  for (const [title, category, subcategory] of cases) {
    const result = classifyContent(title);
    assert.equal(result.category, category, title);
    assert.equal(result.subcategory, subcategory, title);
    assert.equal(result.classification.method, category === "other" ? "fallback" : "rule");
  }
});

test("description can provide direct evidence but boilerplate links cannot", () => {
  assert.equal(classifyContent("A new film", "Behind the scenes of the new video\n\nOfficial Shop: https://example.com").category, "behind");
  assert.equal(classifyContent("Mystery clip", "Official Shop: https://example.com/live\nYouTube Official: https://example.com").category, "other");
});

test("published channel snapshots contain validated taxonomy without changing source IDs", async () => {
  const config = parseChannelsConfig(JSON.parse(await readFile(new URL("../data/youtube/channels.json", import.meta.url))));
  assert.ok(config);
  let total = 0;
  for (const channel of config.channels.filter((item) => item.enabled)) {
    const file = new URL(`../data/youtube/${channel.artistId}.json`, import.meta.url);
    const parsed = parseChannelSnapshot(JSON.parse(await readFile(file)), channel);
    assert.ok(parsed, channel.artistId);
    assert.equal(parsed.schemaVersion, 3);
    for (const item of parsed.items) {
      assert.ok(contentCategories.includes(item.category), `${channel.artistId}: ${item.id}`);
      assert.equal(item.id, `yt-${item.source.videoId}`);
      assert.deepEqual(classifyContent(item.title, item.description), {
        category: item.category,
        ...(item.subcategory ? { subcategory: item.subcategory } : {}),
        classification: item.classification,
      });
    }
    if (channel.artistId === "twice") assert.equal(parsed.items.length, 50);
    total += parsed.items.length;
  }
  assert.equal(total, 700);
});

test("v3 rejects missing taxonomy while v2 still accepts existing metadata", async () => {
  const config = parseChannelsConfig(JSON.parse(await readFile(new URL("../data/youtube/channels.json", import.meta.url))));
  const channel = config.channels.find((item) => item.artistId === "twice");
  const snapshot = JSON.parse(await readFile(new URL("../data/youtube/twice.json", import.meta.url)));
  delete snapshot.items[0].category;
  assert.equal(parseChannelSnapshot(snapshot, channel), null);
  snapshot.schemaVersion = 2;
  assert.ok(parseChannelSnapshot(snapshot, channel));
});
