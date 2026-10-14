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

| Route (after `#`)                   | Function                                                             |
| ----------------------------------- | -------------------------------------------------------------------- |
| `/`                                 | Editorial home, filterable demo feed, artist preview, timeline entry |
| `/artists` and `/artists/:artistId` | Nine artist files, follow toggle, related demo feed                  |
| `/calendar`                         | Month/date navigation, artist filter, detail, KST/BJT display        |
| `/archive`                          | Saved items, four categories, move and remove                        |
| `/my-space`                         | Followed artists and saved item totals                               |
| `/universe`                         | Year selection and source-linked milestones                          |
| `/search`                           | Local artist and demo-feed search                                    |

Bookmarks and followed artists are stored in browser `localStorage`, under `seoul-os-archive-v1` and `seoul-os-follow-v1`. They are local to a browser profile and do not sync across devices.

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
  data/         artists, demo feed, fictional calendar, verified timeline
  pages/        route pages
  store/        localStorage archive and following state
  types.ts      shared data contracts
  styles.css    design tokens, responsive rules, interaction states
public/         original concept hero image
.github/workflows/deploy.yml
```

## Content and imagery

- Feed and calendar entries are **fictional demo scenarios**. They have no real publication timestamp or event claim. The external icon opens JYP Entertainment's official YouTube channel, not a matching video.
- Artist artworks are CSS-created, non-official visual interpretations. Their colors and typography reference different musical moods without copying album covers. The hero is an AI-generated anonymous concept photo, not an image of JYP artists.
- The hero generation method and final prompt are recorded in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md).
- The Universe milestones are limited to official-source-confirmed release facts: [TWICE](https://twice.jype.com/discography/jqpvqq2k?AmSeq=undefined&PgIndex=undefined), [Stray Kids](https://straykids.jype.com/discography/vuykzg89), [ITZY](https://itzy.jype.com/notice?PgIndex=161), and [NMIXX](https://nmixx.jype.com/discography/514qe3en?AmSeq=undefined&PgIndex=undefined).

## Next phase data connections

Keep the UI contracts in `src/types.ts`. Replace `src/data/feed.ts` with fetched items from official JYP artist notice/discography pages and official YouTube channel APIs, `src/data/events.ts` with source-verified schedules preserving each event's IANA time zone, and `src/data/timeline.ts` with a reviewed editorial history dataset. Add account-backed storage only when needed for cross-device sync. Respect each source's terms and image rights; this phase has no backend.
