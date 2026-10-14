/** SEOUL.OS editorial taxonomy. YouTube does not supply these categories. */
export const contentCategories = [
  "music", "stage", "behind", "notice", "live", "variety", "fan", "other",
] as const;

export type ContentCategory = (typeof contentCategories)[number];
export type Classification = {
  method: "rule" | "fallback";
  /** Rule strength for audit only; this is not a calibrated probability. */
  confidence: number;
  ruleId: string;
};
export type ContentTaxonomy = {
  category: ContentCategory;
  subcategory?: string;
  classification: Classification;
};

type Rule = {
  id: string;
  category: ContentCategory;
  subcategory: string;
  confidence: number;
  title: RegExp;
  description?: RegExp;
};

// Specific intent wins over incidental words. In particular, MV Behind is
// behind, Live Stage is stage, and a vinyl named "LIVE" is not a livestream.
const rules: Rule[] = [
  { id: "making", category: "behind", subcategory: "making", confidence: 0.95,
    title: /\b(?:behind(?:\s+the\s+scenes)?|making(?:\s+film|\s+of)?|jacket\s+shoot(?:ing)?|recording\s+behind|mv\s+behind)\b|메이킹|비하인드|幕后/i,
    description: /\b(?:behind\s+the\s+scenes|making\s+film|mv\s+behind)\b|비하인드/i },
  { id: "tour-log", category: "behind", subcategory: "tour-log", confidence: 0.84,
    title: /\b(?:tour[- ]?log|backstage|tour\s+diary)\b|투어\s*로그/i },
  { id: "explicit-notice", category: "notice", subcategory: "announcement", confidence: 0.94,
    title: /\b(?:announcement|official\s+notice|schedule|ticket(?:ing)?|pre[- ]?order|release\s+(?:date|information))\b|공지|예매|发售公告/i,
    description: /\b(?:official\s+notice|ticketing\s+information|release\s+date)\b|공지/i },
  { id: "stage", category: "stage", subcategory: "live-stage", confidence: 0.94,
    title: /\b(?:live\s+stage|stage\s+video|music\s+show|concert\s+(?:stage|performance)|fancam|fan\s*cam|live\s+clip)\b|직캠|무대|现场舞台/i,
    description: /\b(?:live\s+stage|music\s+show|concert\s+performance)\b|직캠/i },
  { id: "livestream", category: "live", subcategory: "livestream", confidence: 0.92,
    title: /\b(?:live\s*stream(?:ing)?|live\s+broadcast|broadcast\s+live|live\s+now|(?:youtube|weverse)\s+live)\b|라이브\s*방송|생방송|直播/i,
    description: /\b(?:live\s*stream(?:ing)?|live\s+broadcast)\b|생방송/i },
  { id: "fan-message", category: "fan", subcategory: "fan-content", confidence: 0.86,
    title: /\b(?:season'?s\s+greetings|fan\s*meeting|anniversary|message\s+to\s+(?:fans|once|stay)|thank\s+you\s+(?:once|stay|fans))\b|팬미팅|기념일|粉丝见面会/i,
    description: /\b(?:fan\s*meeting|anniversary|message\s+to\s+(?:fans|once|stay))\b|팬미팅/i },
  { id: "variety-series", category: "variety", subcategory: "series", confidence: 0.90,
    title: /\b(?:time\s+to\s+twice|tw[- ]?day|skz[- ]?talker|skz\s*code|episode|ep\.?\s*\d+|reality|interview|challenge|vlog|tw[- ]?log|[a-z]+[- ]log)\b|냉터뷰|综艺|挑战/i,
    description: /\b(?:reality\s+show|interview|challenge|vlog|episode)\b|综艺/i },
  { id: "mv-preview", category: "music", subcategory: "music-preview", confidence: 0.88,
    title: /\b(?:m\/v|mv|music\s+video)\s+(?:teaser|trailer|preview)\b/i },
  { id: "official-mv", category: "music", subcategory: "official-mv", confidence: 0.97,
    title: /(?:\b(?:official\s+)?(?:music\s+video|m\/v|mv)\b|뮤직비디오|音乐录影带)/i,
    description: /\b(?:official\s+music\s+video|official\s+m\/v)\b/i },
  { id: "music-performance", category: "music", subcategory: "performance-video", confidence: 0.91,
    title: /\b(?:performance\s+video|dance\s+practice|choreography\s+video|special\s+clip|recording\s+video|lyric\s+video|visualizer|official\s+audio)\b|안무\s*영상|댄스\s*프랙티스/i,
    description: /\b(?:dance\s+practice|performance\s+video|official\s+audio)\b/i },
  { id: "stage-performance", category: "stage", subcategory: "performance", confidence: 0.80,
    title: /\bperformance\b|퍼포먼스/i },
  { id: "music-preview", category: "music", subcategory: "music-preview", confidence: 0.83,
    title: /\b(?:highlight\s+medley|album\s+sampler|track\s+list|tracklist)\b/i },
];

/** Descriptions often repeat channel social links. Inspect only the opening sentence. */
function openingDescription(description: string): string {
  const line = description.split(/\r?\n/).map((part) => part.trim())
    .find((part) => part && !/^(?:https?:|www\.|[\w ]+\s*:\s*https?:)/i.test(part));
  return (line ?? "").slice(0, 160);
}

export function classifyContent(title: string, description = ""): ContentTaxonomy {
  for (const rule of rules) {
    if (rule.title.test(title)) return {
      category: rule.category, subcategory: rule.subcategory,
      classification: { method: "rule", confidence: rule.confidence, ruleId: rule.id },
    };
  }
  const opening = openingDescription(description);
  for (const rule of rules) {
    if (rule.description?.test(opening)) return {
      category: rule.category, subcategory: rule.subcategory,
      classification: { method: "rule", confidence: Math.min(rule.confidence, 0.70), ruleId: `${rule.id}-description` },
    };
  }
  return { category: "other", classification: { method: "fallback", confidence: 0, ruleId: "insufficient-evidence" } };
}
