import type { TimelineItem } from "../types";

// Only source-verified release milestones are shown as historical facts.
export const timeline: TimelineItem[] = [
  {
    id: "twice-story-begins-2015",
    year: 2015,
    date: "10.20",
    artistId: "twice",
    title: "THE STORY BEGINS",
    description: "TWICE 出道专辑发行。",
    sourceUrl:
      "https://twice.jype.com/discography/jqpvqq2k?AmSeq=undefined&PgIndex=undefined",
    status: "verified",
  },
  {
    id: "stray-kids-i-am-not-2018",
    year: 2018,
    date: "03.26",
    artistId: "stray-kids",
    title: "I am NOT",
    description: "Stray Kids 出道专辑发行。",
    sourceUrl: "https://straykids.jype.com/discography/vuykzg89",
    status: "verified",
  },
  {
    id: "itzy-itz-different-2019",
    year: 2019,
    date: "02.12",
    artistId: "itzy",
    title: "IT'z Different",
    description: "ITZY 首张单曲发行。",
    sourceUrl: "https://itzy.jype.com/discography/ig7wv69u",
    status: "verified",
  },
  {
    id: "nmixx-ad-mare-2022",
    year: 2022,
    date: "02.22",
    artistId: "nmixx",
    title: "AD MARE",
    description: "NMIXX 首张单曲发行。",
    sourceUrl:
      "https://nmixx.jype.com/discography/514qe3en?AmSeq=undefined&PgIndex=undefined",
    status: "verified",
  },
];
