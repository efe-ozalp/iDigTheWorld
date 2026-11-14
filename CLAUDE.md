# iDigTheWorld

A hackathon web app. The user spins a 3D Earth, drops an explorer on any spot, digs straight through the planet and surfaces at the exact antipode. The app teaches them about both ends of the tunnel, then offers AI-written topic cards (cuisine, culture, history, biosphere) they can keep digging into.

This file records the team's decisions. Follow them. When a decision changes, update this file in the same commit.

## Commands

- `npm run dev`: the whole app locally, including `/api`. This is the only command needed for development.
- `npm run build`: builds the client into `dist/`, then the `/api` handlers into `dist-server/`.
- `npm start`: the production server (`server.js`). Run `npm run build` first.
- `npm run typecheck`: type-checks client and server code. The build does not type-check, so run this before committing.

For local secrets, copy `.env.example` to `.env.local`.

## How we work

- Build one phase at a time (list below). Finish the phase, check that it runs, commit, then stop and report so the team can try it before the next phase starts.
- Keep the app runnable at the end of every phase.
- We have about a day. Working and demo-able beats perfect.
- Commit at the end of each phase and after each meaningful step. Write messages that describe the change ("Add layer cross-section animation", not "updates"). Do not add a Claude co-author line.
- Keep dependencies minimal, and tell the team before adding a heavy one.

## Ground rules

- Every external call needs a timeout and a fallback. The demo must never show a blank screen or a raw error.
- API keys go in `.env.local`, which is git-ignored. `.env.example` documents every variable. Never expose a key to the browser: server-side variables have no `VITE_` prefix.
- Bundled images in the repo must be public domain or CC0, with the credit shown.

## Phases

1. Done. Scaffold, shared types, mock data, globe, pin drop, antipode.
2. Done. Dig animation and its three triggers; Node server, `app.yaml` and `/api/health` for Databricks.
3. Real data: geocoding, ocean detection, photo lookup with fallbacks, surface screen, origin card.
4. AI: card endpoint, prompt, validation, caching, and recursive cards opened from the topic objects.
5. Ocean arrival screen with details about the body of water, and "Swim to nearest land".
6. Full styling pass to the design direction below.
7. Demo hardening: a "Featured digs" row with pre-cached results that work with no network (Spain to New Zealand, Argentina to China, Indonesia to Colombia, Madison to the Indian Ocean).

## User flow

1. Globe: spin the Earth, click to drop the explorer.
2. Origin card: place name, photo, three facts about the starting point.
3. Dig: an 8 to 10 second cross-section through crust, mantle, outer core, inner core and back out. Each layer shows a depth counter, temperature and a one-line fact.
4. Surface: the destination photo fills the whole screen with a slow zoom, and the photo credit sits in a corner. Three things are laid over it:
   - Top left, always visible: a "You surfaced in" line, the huge place name, and the country or region under it. The name keeps to the left 40% of the screen.
   - A rolled parchment scroll at the left edge, below the name. It unrolls sideways on hover, and a click, tap, Enter or Space pins it open; a second click or Escape closes it. Inside are the field notes: the place summary with a "Source" line, the facts, then distance travelled (about 12,742 km), live local time and coordinates as labelled rows. The notes are a list of sections built in `src/lib/fieldNotes.ts`, with a fallback when nothing has been written about the place.
   - One cut-out object per topic, scattered at fixed positions and slightly tilted, each with a handwritten label. On land: cuisine, culture, history and biosphere (a horse). On open water: only biosphere (a fish). They never cover the name or the scroll. There is no tab strip and no text printed directly on the photo.
5. Dig deeper: clicking a topic object opens that topic's AI-written card next to it. Each card offers 2 or 3 sub-topics, which open further cards. Depth is capped at 5 with a "you've hit bedrock" ending.

Interaction decisions:

- The dig has three triggers: a downward flick, the Dig! button, and the down-arrow key.
- While a pin is down and the origin card is open, globe rotation is locked, so a downward flick anywhere on screen starts the dig. It unlocks when the card closes or a new spot is picked.
- Start every destination fetch (geocode, photo, AI) the moment the dig begins, so the animation hides the latency.
- `prefers-reduced-motion` gets a shorter, simpler dig.
- Most antipodes are open ocean; treat that as a feature. Detect water with the bundled Natural Earth marine polygons (reverse geocoders return nothing for open sea), show an ocean arrival screen (which ocean or sea, approximate depth, what lives there), and offer "Swim to nearest land", which moves to the closest coastline and runs the normal place experience there.
- The demo runs on a laptop or projector. The app should work on a phone, but do not spend time polishing mobile.

## Stack

- React, Vite and TypeScript. The globe is `react-globe.gl`.
- Antipode: latitude is negated; longitude gets 180 added and is wrapped to the range -180 to 180.
- Shared data shapes live in `shared/types.ts` (`Place`, `TopicCard`, `Dig`). `Place` carries an IANA `timeZone`, and the UI renders the local clock live from it.
- Reverse geocoding: `/api/geocode` calls Nominatim with a User-Agent (contact from `NOMINATIM_CONTACT`) and caches results by rounded latitude and longitude so we stay under 1 request per second. If it fails or times out, the browser falls back to BigDataCloud's free client endpoint.
- Photos, in order: Wikimedia Commons geosearch by coordinates, then the Wikipedia page image for the place, then a small bundled set of ocean and region fallback images.
- Photo credits: photos fetched live may carry any Commons licence. Always show the credit: the author and licence name, linked to the Commons file page, in a small italic caption.
- Text may be laid over photos. Never edit or crop the image file itself; `object-fit` only changes how it is framed on screen.
- Grounding text: the Wikipedia REST summary, plus Wikivoyage when available.
- Wikipedia, Wikivoyage, Commons and BigDataCloud are called from the browser, because outbound internet from Databricks may be restricted. `/api` is for AI and geocoding only.

## AI

- `ai/provider.ts` picks the backend from `AI_PROVIDER` (`databricks` or `anthropic`).
- Databricks, the default: the Foundation Model API through OpenAI-compatible chat completions at `{DATABRICKS_HOST}/serving-endpoints`. The endpoint name comes from `DATABRICKS_MODEL_ENDPOINT` and defaults to `databricks-llama-4-maverick`, because Claude and GPT endpoints are rate-limited to zero on Free Edition. On Databricks the app's service principal authenticates; locally use `DATABRICKS_TOKEN`.
- Anthropic: the key comes from `ANTHROPIC_API_KEY`, and the model only from `ANTHROPIC_MODEL` with nothing hardcoded (`claude-haiku-5-5` in `.env.example`; `claude-sonnet-5-5` is the step up). Use the official SDK.
- The topics are `cuisine`, `culture`, `history` and `biosphere` (`TOPICS` in `shared/types.ts`); the AI writes cards for these four. Open water offers only `biosphere`.
- Every card request sends the place name, the topic path so far and the Wikipedia grounding text. Tell the model to stay consistent with the grounding text and not to invent specific names, dates or statistics it cannot support.
- Require JSON matching `TopicCard`, validate it, and retry once on bad JSON. For Llama, give a JSON-only instruction and strip code fences before parsing.
- Cache responses by place and topic path, in memory and in `localStorage`.
- If the model is slow or fails, show the Wikipedia summary as the card instead of an error.

## Deployment

- Primary: Databricks Apps (Free Edition), deployed from the public GitHub repo, for the Databricks prize track. Vercel is the backup and uses the same code.
- `server.js` serves `dist/` and mounts the `/api` handlers. It listens on `DATABRICKS_APP_PORT`, then `PORT`, then 8000. `app.yaml` runs `npm run start`.
- On deploy, Databricks runs `npm install`, then `npm run build`, then the `app.yaml` command. It may skip `devDependencies`, so anything the build needs (Vite and its React plugin) stays in `dependencies`.
- `/api` handlers stay in the format Vercel runs: one file per route directly in `api/`, exporting functions named after HTTP methods that take a `Request` and return a `Response`. `server/adapter.js` runs the same handlers under `server.js` and under the Vite dev middleware.
- In server-side TypeScript (`api/`, `ai/`, `server/`), write relative imports with a `.js` extension (`../ai/provider.js`). Vercel needs it, and Vite resolves it to the `.ts` file.
- `/api/health` reports whether the model endpoint answers and whether `nominatim.openstreetmap.org`, `en.wikipedia.org` and `api.anthropic.com` are reachable from the server. Check it after every deploy.
- To deploy to Databricks: create a custom app from the Git repository, add the serving endpoint as a Model resource with "Can query", then Deploy > From Git with branch `main`. Build and app logs are at `<app-url>/logz`.
- Free Edition stops an app 24 hours after it was last started or deployed, so restart it before a demo.
- Databricks' docs (November 2026) mark the `databricks-*` foundation model serving endpoints as Legacy in the app resource picker and steer new work to Unity Gateway model services. We use the serving endpoint because it is what Free Edition is known to answer on. If it stops answering, check `/api/health` first, then look at the Unity Gateway route.

## Design direction: Utopian Scholastic

Think 1990s DK Eyewitness books and Encarta CD-ROMs: optimistic, wonder-driven, educational.

- White or pale cream backgrounds with generous whitespace.
- Cut-out objects with soft drop shadows (globe, compass, fossil, trowel) that overlap the text slightly. Draw them as SVG, one component each, so real photos can be swapped in later.
- The topic objects on the surface view are the team's own cut-out PNGs in `public/objects/`, with transparent backgrounds. Use them exactly as supplied and never edit the files. Give them shadows with CSS `filter: drop-shadow`, which follows the outline, not `box-shadow`. Their positions are in `src/data/topicObjects.ts`.
- Classic serif for headings and body. Small italic captions joined to objects by thin leader lines.
- Saturated primary accents, with one colour per topic: cuisine red, history ochre, biosphere green, culture blue. The tokens are in `src/styles/tokens.css`.
- The dig screen is a textbook cutaway diagram with numbered callouts.
- Light CD-ROM chrome: beveled buttons and an encyclopedia-style index tab strip.
- No dark mode, no glassmorphism, no gradients-on-everything modern SaaS look.
- The little figure is called the explorer, in copy, code and commit messages alike. Its component is `Explorer`.

## Layout

```
api/        one file per /api route, in Vercel's format
ai/         provider.ts: the Databricks and Anthropic backends
server/     adapter.js (Fetch handlers on Node), routes.ts (production route table)
server.js   production server for Databricks Apps
app.yaml    Databricks Apps configuration
shared/     types.ts, imported by both the client and the server
src/        the React app: components/, lib/, data/, styles/
public/     Earth textures, bundled photos, and the topic objects (objects/)
```

## Things that have bitten us

- The Wikimedia Commons API throttles bursts: several searches within a few seconds get a plain-text "too many requests" body instead of JSON. Space requests out, parse defensively, cache, and fall back.
- globe.gl rebuilds every HTML marker when the `htmlElement` accessor changes identity, so keep those accessors at module scope (see `GlobeView.tsx`).
