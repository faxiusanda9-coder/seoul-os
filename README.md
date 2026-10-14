# SEOUL.OS

**Your K-pop Universe, Organized.** A responsive, local-data Phase 1 concept for following JYP artists and keeping a personal archive. This is an independent fan prototype, not a JYP product.

## Run locally

Requires Node.js 20.19+ or 22.12+ (Node 24 recommended) and npm.

```bash
npm ci
npm run dev
```

Open the Local URL printed by Vite, normally `http://localhost:5173/seoul-os/`. Vite uses `/seoul-os/` as its base in development and production.

```bash
npm run check
npm run build
npm run preview
```

The production preview is normally at `http://localhost:4173/seoul-os/`.

## Pages and interactions

| Route (after `#`)                   | Function                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `/`                                 | Editorial home, curated feed with search, artist/type filters and date sorting |
| `/artists` and `/artists/:artistId` | Nine artist files, direct follow toggle, related feed                          |
| `/calendar`                         | Month/date navigation, artist filter, detail, KST/BJT display                  |
| `/archive`                          | Saved items, four categories, move and remove                                  |
| `/my-space`                         | Followed artists and saved item totals                                         |
| `/universe`                         | Year selection and source-linked milestones                                    |
| `/search`                           | Local artist and curated-feed search with an actionable empty state            |

Bookmarks and followed artists are stored in browser `localStorage`, under `seoul-os-archive-v1` and `seoul-os-follow-v1`. They are local to a browser profile and do not sync across devices.
Saved IDs and followed artist IDs are validated on load. Obsolete bookmarks for removed Phase 1 demo cards are discarded so the Archive count cannot point to missing content. If local storage is unavailable, the interface shows a warning and state lasts only for the current page session.

## GitHub Pages deployment

The repository must be named **`seoul-os`** for the configured Vite base path `/seoul-os/` to match the project URL. `HashRouter` puts client routes after `#`, so refreshing `/seoul-os/#/artists` or another section requests only the Pages-served index file and avoids a server-side 404. Vite prefixes built JS, CSS, and `public/` assets with `/seoul-os/`.

1. Put the contents of this folder at the **root** of your `seoul-os` repository and push to `main`.
   If this local folder is the source and the GitHub repository exists, connect and push it:

   ```bash
   git remote add origin https://github.com/<OWNER>/seoul-os.git
   git push -u origin main
   ```

2. In GitHub, open **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs on pushes to `main`; you can also start it from **Actions → Deploy SEOUL.OS to GitHub Pages → Run workflow**.
4. When deployment succeeds, open `https://<GitHub-username-or-organization>.github.io/seoul-os/`. The actual URL also appears in the workflow's `github-pages` environment.

No API keys or paid services are needed. If the repository is renamed or a custom domain is introduced, update `base` in `vite.config.ts` and rebuild.

## Structure

```text
src/
  components/   navigation and reusable editorial UI
  data/         artists, curated feed, fictional calendar, verified timeline
  pages/        route pages
  store/        localStorage archive and following state
  types.ts      shared data contracts
  styles.css    design tokens, responsive rules, interaction states
public/         original concept hero image and sourced video thumbnails
.github/workflows/deploy.yml
```

## Content and imagery

- The Feed is a **curated historical sample**, not a real-time feed. Nine entries link to specific official music videos; eight have source-checked calendar dates and one shows "发布时间未核实". Five fictional UI examples are marked **DEMO**, have no real date, and link only to the JYP channel. Sort order uses the recorded ISO dates and leaves undated items last. No API or automated scraping is used.
- Calendar defaults to no events because official schedules have not been verified or connected; an empty day does not mean an artist has no activity. Fictional calendar fixtures are isolated in 2099 and only appear after the user explicitly enables the demo switch.
- Feed and directory video thumbnails are served from `public/video-thumbnails/` under Vite's `/seoul-os/` base path, preserve their 16:9 composition, show YouTube/JYP attribution, and link to their source videos. This makes image loading less dependent on mobile access to YouTube's image host. The five fictional DEMO rows use a clearly labeled official artist video still as a **reference image**, not as evidence of the fictional content. If an image fails, an original CSS concept cover appears. Source links and image handling are recorded in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md). The video imagery remains the rightsholders' material; this prototype does not claim a separate image license. A public GitHub Pages deployment is not private use, so review rights and platform terms before broader sharing.
- Artist concept artworks are CSS-created, non-official visual interpretations. Their colors and typography reference different musical moods without copying album covers. The hero is an AI-generated anonymous concept photo, not an image of JYP artists.
- The Universe milestones are limited to official-source-confirmed release facts: [TWICE](https://twice.jype.com/discography/jqpvqq2k?AmSeq=undefined&PgIndex=undefined), [Stray Kids](https://straykids.jype.com/discography/vuykzg89), [ITZY](https://itzy.jype.com/discography/ig7wv69u), and [NMIXX](https://nmixx.jype.com/discography/514qe3en?AmSeq=undefined&PgIndex=undefined).

## Next phase data connections

Keep the UI contracts in `src/types.ts`. Replace `src/data/feed.ts` with a consented or terms-compliant connection to official JYP artist video/notice pages and, if appropriate, the official YouTube Data API. Replace `src/data/events.ts` with source-verified schedules preserving each event's IANA time zone, and expand `src/data/timeline.ts` only with reviewed editorial history. Add account-backed storage only when cross-device sync is needed. This phase has no backend, API key, or account requirement.
