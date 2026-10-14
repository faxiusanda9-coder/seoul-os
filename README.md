# SEOUL.OS

**Your K-pop Universe, Organized.** A responsive JYP fan prototype with a single-channel YouTube Data API pipeline for TWICE. Other artists remain curated historical samples or labeled demos. This is an independent fan project, not a JYP product.

## Run locally

Requires Node.js 24+ and npm. The synchronization scripts import the shared TypeScript schema through Node's built-in type stripping.

```bash
npm ci
npm run dev
```

Open the Local URL printed by Vite, normally `http://localhost:5173/seoul-os/`. Vite uses `/seoul-os/` as its base in development and production.

```bash
npm run check
npm run build
npm run preview
npm run test:sync
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
Saved IDs and followed artist IDs are validated on load. YouTube bookmarks use stable `yt-<videoId>` IDs; when a saved video leaves the recent static dataset, Archive keeps a working YouTube link and a remove control. Obsolete removed demo IDs are discarded. If local storage is unavailable, the interface shows a warning and state lasts only for the current page session.

## TWICE YouTube sync (Phase 2B-1)

Only the verified [TWICE channel](https://www.youtube.com/c/twice), ID `UCzgxx_DM2Dcb9Y1spb9mUJA`, is connected. `channels.list(part=contentDetails)` confirms its uploads playlist ID; `playlistItems.list` gets the latest 50 uploads; `videos.list(part=snippet,status)` confirms channel, public status, actual publication time and metadata. `playlists.list` is unnecessary because `channels.list` already returns the uploads ID. The script never calls `search.list`, downloads videos, or writes the API key to output.

To test a real sync locally, create a YouTube Data API v3 key, copy `.env.example` to `.env`, fill in the key, then run:

```bash
node --env-file=.env scripts/youtube-sync.mjs
npm run build
```

The key is read only by the Node sync script. Never prefix it with `VITE_`; `.env` is ignored by Git. `npm run sync:youtube` also works when `YOUTUBE_API_KEY` is already set in the shell. The committed `data/youtube/twice.json` starts empty on purpose; no API call has been made until a key is configured. The sync script validates the existing snapshot, writes atomically only after all API calls and generated data pass checks, deduplicates by video ID, retains recently fetched records, and makes no commit when the content is unchanged. Failures leave the last successful file untouched. The browser also falls back to curated/demo content when the JSON is absent, empty, invalid, or over 30 days old.

GitHub Actions needs a repository secret named `YOUTUBE_API_KEY` under **Settings → Secrets and variables → Actions → New repository secret**. The scheduled workflow `.github/workflows/youtube-sync.yml` runs at 00:00 and 12:00 UTC, or **08:00 and 20:00 Beijing time**. It can also be started manually from Actions. The workflow commits changed JSON to `main` and directly invokes the reusable Pages deployment workflow. A `GITHUB_TOKEN` push does not trigger a separate push workflow, so the explicit deploy job is required. The secret never reaches Vite or the public JSON. Give Actions **read and write permissions** under **Settings → Actions → General → Workflow permissions** so the sync job can commit updated data.

Static data is published at [`/seoul-os/data/youtube/twice.json`](https://faxiusanda9-coder.github.io/seoul-os/data/youtube/twice.json). Before the first successful sync it is an explicitly empty placeholder. The frontend fetch URL is built from `import.meta.env.BASE_URL` so it works beneath `/seoul-os/`. `HashRouter` keeps client-side routes refreshable. The page labels API rows **Official YouTube Source**, static historical samples **精选官方视频**, and fictional rows **DEMO**.

Each successful scheduled run uses about **3 YouTube quota units**: one `channels.list`, one `playlistItems.list`, one `videos.list`. At two runs daily the baseline is **6 units/day**; retries or future paging would add to this. The default free quota and actual project limits should be checked in Google Cloud. GitHub Actions scheduling is best-effort, so the UI displays the last successful sync time instead of promising minute-exact updates.

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

Browsing never needs an API key or paid service. Automated TWICE synchronization needs a free YouTube Data API key in GitHub Secrets. If the repository is renamed or a custom domain is introduced, update `base` in `vite.config.ts` and rebuild.

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
data/schemas/  shared Content type and runtime snapshot validation
data/youtube/  committed TWICE metadata JSON; initially empty
scripts/       API synchronization and public-asset staging
tests/         mocked API tests
.github/workflows/youtube-sync.yml
```

## Content and imagery

- When a valid and recent TWICE snapshot exists, TWICE cards are populated from YouTube Data API metadata. Until then, the original curated TWICE sample appears. Other artists still use eight curated historical samples and five fictional **DEMO** rows. No scraping is used. Content type is inferred conservatively from video title; it is a UI classification, not an official release classification.
- Calendar defaults to no events because official schedules have not been verified or connected; an empty day does not mean an artist has no activity. Fictional calendar fixtures are isolated in 2099 and only appear after the user explicitly enables the demo switch.
- Feed and directory video thumbnails are served from `public/video-thumbnails/` under Vite's `/seoul-os/` base path, preserve their 16:9 composition, show YouTube/JYP attribution, and link to their source videos. This makes image loading less dependent on mobile access to YouTube's image host. The five fictional DEMO rows use a clearly labeled official artist video still as a **reference image**, not as evidence of the fictional content. If an image fails, an original CSS concept cover appears. Source links and image handling are recorded in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md). The video imagery remains the rightsholders' material; this prototype does not claim a separate image license. A public GitHub Pages deployment is not private use, so review rights and platform terms before broader sharing.
- Artist concept artworks are CSS-created, non-official visual interpretations. Their colors and typography reference different musical moods without copying album covers. The hero is an AI-generated anonymous concept photo, not an image of JYP artists.
- The Universe milestones are limited to official-source-confirmed release facts: [TWICE](https://twice.jype.com/discography/jqpvqq2k?AmSeq=undefined&PgIndex=undefined), [Stray Kids](https://straykids.jype.com/discography/vuykzg89), [ITZY](https://itzy.jype.com/discography/ig7wv69u), and [NMIXX](https://nmixx.jype.com/discography/514qe3en?AmSeq=undefined&PgIndex=undefined).

## Next phase data connections

After the TWICE API pipeline succeeds in GitHub Actions, validate freshness, public metadata policies and channel ownership before considering further artists. Keep the current artist-to-channel mapping in `docs/phase-2-data-plan.md` as research, not a production connection list. The calendar remains disconnected from YouTube uploads because upload time is not an event date. This phase has no database or account system.
