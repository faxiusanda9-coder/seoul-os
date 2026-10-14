import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { artists } from "../data/artists";
import { feed } from "../data/feed";
import { FeedCard } from "../components/FeedCard";
import { FeedFilters } from "../components/FeedFilters";
import { ArtistCard } from "../components/ArtistCard";
import { SectionHeading } from "../components/SectionHeading";
import type { ContentType } from "../types";

export function DiscoverPage() {
  const reducedMotion = useReducedMotion();
  const [artist, setArtist] = useState("all");
  const [type, setType] = useState<"All types" | ContentType>("All types");
  const visible = useMemo(
    () =>
      feed.filter(
        (item) =>
          (artist === "all" || item.artistId === artist) &&
          (type === "All types" || item.type === type),
      ),
    [artist, type],
  );
  return (
    <>
      <div className="page-wrap">
        <motion.section
          className="hero"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <img
            className="hero-image"
            src={`${import.meta.env.BASE_URL}hero-concept.png`}
            alt="原创概念摄影：四位匿名音乐人在排练室，非任何艺人官方照片"
          />
          <div className="hero-shade" />
          <div className="hero-top">
            <span>SEOUL.OS / ISSUE 001</span>
            <span>CONCEPT EDITION</span>
          </div>
          <div className="hero-content">
            <p className="hero-kicker">
              ONE COMPANY · EVERY ARTIST · YOUR UNIVERSE
            </p>
            <h1>
              Every era.
              <br />
              <em>All yours.</em>
            </h1>
            <p className="hero-description">
              从最新内容到珍藏舞台，让喜欢的每一份心动都有自己的位置。
            </p>
            <button
              className="hero-button"
              type="button"
              onClick={() =>
                document
                  .getElementById("daily-feed")
                  ?.scrollIntoView({
                    behavior: reducedMotion ? "auto" : "smooth",
                  })
              }
            >
              Explore the feed <ArrowDown size={17} />
            </button>
          </div>
          <p className="hero-credit">原创 AI 概念视觉 · 非官方艺人照片</p>
        </motion.section>
        <div className="intro-line">
          <span>YOUR K-POP UNIVERSE, ORGANIZED.</span>
          <span>JYP ARTIST CULTURE / PERSONAL ARCHIVE</span>
        </div>
        <section className="content-section feed-section" id="daily-feed">
          <SectionHeading
            eyebrow="01 / THE EDIT"
            title="Daily JYP Feed"
            note="跨艺人内容流。以下均为交互演示条目，尚未接入实时消息。"
            action={
              <span className="count-label">
                {visible.length.toString().padStart(2, "0")} STORIES
              </span>
            }
          />
          <FeedFilters
            artist={artist}
            type={type}
            onArtist={setArtist}
            onType={setType}
          />
          <div className="feed-list">
            {visible.length ? (
              visible.map((item) => <FeedCard key={item.id} item={item} />)
            ) : (
              <div className="empty-state">
                <Sparkles size={25} />
                <h3>暂时没有匹配内容</h3>
                <p>试试更换艺人或内容类型。</p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setArtist("all");
                    setType("All types");
                  }}
                >
                  清除筛选 <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
        <section className="content-section artists-section">
          <SectionHeading
            eyebrow="02 / THE PEOPLE"
            title="The artists"
            note="每个声音，都有自己的视觉章节。"
            action={
              <Link className="text-link" to="/artists">
                View all artists <ArrowUpRight size={17} />
              </Link>
            }
          />
          <div className="artist-grid preview-grid">
            {artists.slice(0, 4).map((item, index) => (
              <ArtistCard key={item.id} artist={item} index={index} />
            ))}
          </div>
        </section>
        <section className="universe-banner">
          <div>
            <p className="eyebrow">03 / JYP UNIVERSE</p>
            <h2>
              A timeline of
              <br />
              <em>what stays.</em>
            </h2>
            <p>沿着年份回看经官方来源确认的出道发行节点。</p>
            <Link className="light-button" to="/universe">
              Explore the timeline <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="orbit-graphic" aria-hidden="true">
            <span>2015</span>
            <span>2018</span>
            <span>2019</span>
            <span>2022</span>
          </div>
        </section>
      </div>
    </>
  );
}
