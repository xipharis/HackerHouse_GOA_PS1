# HH Goa 2026 — Frame & Builder Pass Generator

### **[hh-goa-frame-mu.vercel.app](https://hh-goa-frame-mu.vercel.app)**

Upload a photo, get a branded HH Goa 2026 graphic, download it, post it to X.

Styled to the organiser's identity: the deep green (`#0B6839`), signal yellow
(`#FEE101`) and cream (`#FFFBE8`) from hhgoa.com, set in the same two faces the
event site uses — **Imbue** for display and **Victor Mono** for everything else.

The builder pass is its own printed artefact and runs a warmer palette of its
own — forest `#004838`, pink `#F02878`, yellow `#F8D028` on `#F0E8D0` stock —
set in **Playfair Display**, **Cabinet Grotesk** and **JetBrains Mono**.

## Flow

| Route | What it is |
| --- | --- |
| [`/`](https://hh-goa-frame-mu.vercel.app) | Landing page with the two entry points |
| [`/pfp`](https://hh-goa-frame-mu.vercel.app/pfp) | **Format A** — 1024×1024 profile picture in a signal-yellow ring |
| [`/pass`](https://hh-goa-frame-mu.vercel.app/pass) | **Format B** — 1080×1350 builder pass (name, stack, base camp, builder title, dates) |
| `/s/[id]` | The link you tweet; its `og:image` *is* the generated graphic |

The pass carries the event's dates: **28–31 Oct 2026**.

## How it works

Rendering happens entirely in the browser on a 2D canvas, so upload → finished
artwork is one synchronous paint. No server round-trip in the render path, no
loading screen.

| Path | Where |
| --- | --- |
| Photo intake (HEIC/EXIF/downscale) | [lib/image.ts](lib/image.ts) |
| Drawing primitives | [lib/render/paint.ts](lib/render/paint.ts) |
| Format A + its link-preview card | [lib/render/index.ts](lib/render/index.ts) |
| Format B, the builder pass | [lib/render/pass.ts](lib/render/pass.ts) |
| Brand tokens, copy, captions | [lib/brand.ts](lib/brand.ts) |
| Builder title generator | [lib/titles.ts](lib/titles.ts) |
| Share persistence | [lib/server/storage.ts](lib/server/storage.ts) |
| Share API | [app/api/share/route.ts](app/api/share/route.ts) |
| Generator UI | [app/generator.tsx](app/generator.tsx) |
| Landing + shared chrome | [app/page.tsx](app/page.tsx), [app/chrome.tsx](app/chrome.tsx) |

### Share to X

Two buttons, because no single mechanism does both jobs:

- **Share to X** always opens the X compose intent, pre-filled. It uploads the
  1200×630 link card first and puts the resulting `/s/<id>` link in the body —
  that link's `og:image` *is* the graphic, so the post shows the real artwork as
  its preview card rather than a default thumbnail.
- **Post with image attached** appears only on touch devices and hands the
  actual JPEG to the share sheet via the Web Share API, producing a post with a
  true image attachment.

The split matters: the Web Share API can carry a file but on desktop it opens
the *operating system's* sheet (AirDrop, Mail, Messages), which frequently has no
X entry at all. A button labelled "Share to X" must never depend on it.

Four details that matter in practice:

- The share image is pre-rendered ~400 ms after the artwork settles. Safari only
  honours `navigator.share()` while the click's transient activation is alive,
  and awaiting a canvas encode is enough to lose it.
- The intent popup opens synchronously on click and its location is set after
  the upload, so Safari doesn't swallow it as a blocked popup.
- The link goes in the caption body, not the intent's `url` parameter — X
  appends that parameter last and would push it below the hashtags.
- Format A uploads a purpose-built 16:9 composition rather than the square
  avatar, so X never centre-crops the ring off.

### Post length

Captions must fit **280 characters** — X Premium is not a fair assumption, and an
over-long pre-fill lands in the composer with Post already greyed out.

X does not count naively: any URL costs 23 whatever its real length, and emoji
cost 2 each. [lib/tweet.ts](lib/tweet.ts) implements that weighting; `tweetText`
in [lib/brand.ts](lib/brand.ts) composes within it and, if a caption would still
overflow, shaves the longest user field one character at a time so the loss is
spread rather than always gutting the last entry. The hashtags and the link are
never sacrificed.

Measured: PFP 172, pass with typical fields 249, pass with three maxed-out
40-character fields 279. The generator shows a live count next to the share
buttons. `npm run test:caption` asserts the ceiling with an independently
implemented counter, so a bug copied into both would not pass.

### Uploading

The `<input type="file">` is stretched invisibly across the drop zone and the
"Choose photo" button, so the element under the cursor *is* the input. Hiding it
and triggering it with a scripted `.click()` — or a `<label for>` pointing at an
`sr-only` input — is refused by Safari, which won't open a picker for an input it
doesn't consider visible. This approach also keeps native keyboard activation and
drag-and-drop, and works even if the page hasn't hydrated.

### Photos

`jpg`, `png`, `webp` and iPhone `HEIC` are accepted. HEIC is detected by MIME
type, extension, *and* ISO-BMFF brand sniffing (iOS often reports an empty type),
then decoded via libheif-wasm loaded on demand, straight to a bitmap to skip a
JPEG round-trip. EXIF orientation is honoured, oversized camera output is
downscaled to a 2048px long edge, and every photo is `object-fit: cover` framed
with drag-to-reposition and a zoom control — portrait, landscape and off-centre
crops all work without pre-cropping.

### Icons

The favicon set is generated from the sunrise mark in `images/`:

```bash
npm run icons    # -> app/favicon.ico (64), app/icon.png (256), app/apple-icon.png (180)
```

It crops a square around the sun rather than centre-cropping the source, which
would leave the sun too small to read at 16px. Next.js emits the `<link>` tags
from those filenames automatically.

## Running it

```bash
npm install
npm run dev
```

Share links work with no configuration: without a Blob token the app stores share
images on the local filesystem under `.data/` and serves them from
`/api/image/[id]`.

### Production

Deployed on Vercel — one project, no separate backend. The `/api/*` and `/s/[id]`
routes run as functions alongside the static pages:

```bash
vercel deploy --prod
```

Set `BLOB_READ_WRITE_TOKEN` (a linked Vercel Blob store provides it
automatically) and share images go to Blob's CDN instead of the filesystem.
Optionally set `NEXT_PUBLIC_SITE_URL` to pin the canonical origin used in share
links and OG tags; otherwise the app uses the project's production domain,
falling back to the request host.

**Deployment Protection must be off.** With Vercel SSO enabled every URL 302s to
a login page, which breaks `POST /api/share` and stops X's crawler from fetching
the OG image — the site appears to work for the logged-in owner and for nobody
else:

```bash
vercel project protection disable --sso
```

## Tests

```bash
npm run fixtures                                    # generate a test photo
npm run test:e2e -- http://localhost:3000           # full flow, both formats
npm run test:share -- http://localhost:3000         # both share paths
npm run test:caption -- http://localhost:3000      # every caption fits 280
npm run test:upload -- http://localhost:3000/pfp webkit
```

All three accept a base URL, so the same suites run against the live site:

```bash
npm run test:e2e -- https://hh-goa-frame-mu.vercel.app
```

`e2e.mjs` drives a real browser through the whole required flow for both formats
and six photo shapes (portrait, landscape, square, 12 MP HEIC, 36 MP HEIC):
render correctness and timing, long-name overflow, download, the X intent URL,
the caption's opening block and both hashtags landing last, and that the
resulting `og:image` is a real 1200×630 image served over HTTP.

`check-share.mjs` covers both share paths: it stubs a file-capable share sheet
and asserts a real JPEG is handed over, then stubs a desktop sheet with no X
entry and asserts Share to X ignores it and reaches the intent anyway.

`check-upload.mjs` exists separately because the e2e suite calls `setInputFiles`
directly on the input, which bypasses the click path — the exact path that once
broke. It drives a real mouse press across Chromium and WebKit, and with
JavaScript disabled.

Measured on this machine: 31–80 ms from file selection to finished artwork for
ordinary photos; ~800 ms for a 12 MP iPhone HEIC (including the one-time wasm
decoder load).
