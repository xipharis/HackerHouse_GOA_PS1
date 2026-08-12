# HH Goa 2026 — Frame & Builder Pass Generator

Upload a photo, get a branded HH Goa 2026 graphic, download it, post it to X.

Styled to the organiser's identity: the deep green (`#0B6839`), signal yellow
(`#FEE101`) and cream (`#FFFBE8`) from hhgoa.com, set in the same two faces the
event site uses — **Imbue** for display and **Victor Mono** for everything else.

## Flow

| Route | What it is |
| --- | --- |
| `/` | Landing page with the two entry points |
| `/pfp` | **Format A** — 1024×1024 profile picture in a signal-yellow ring |
| `/pass` | **Format B** — 1200×675 builder pass (name, stack, origin, builder title, travel dates) |
| `/s/[id]` | The link you tweet; its `og:image` *is* the generated graphic |

The pass carries the event's travel window: **arrives 28 Oct 2026 → departs
31 Oct 2026**.

## How it works

Rendering happens entirely in the browser on a 2D canvas, so upload → finished
artwork is one synchronous paint. No server round-trip in the render path, no
loading screen.

| Path | Where |
| --- | --- |
| Photo intake (HEIC/EXIF/downscale) | [lib/image.ts](lib/image.ts) |
| Drawing primitives | [lib/render/paint.ts](lib/render/paint.ts) |
| Both renderers + link-preview card | [lib/render/index.ts](lib/render/index.ts) |
| Brand tokens, copy, captions | [lib/brand.ts](lib/brand.ts) |
| Builder title generator | [lib/titles.ts](lib/titles.ts) |
| Share persistence | [lib/server/storage.ts](lib/server/storage.ts) |
| Share API | [app/api/share/route.ts](app/api/share/route.ts) |
| Generator UI | [app/generator.tsx](app/generator.tsx) |
| Landing + shared chrome | [app/page.tsx](app/page.tsx), [app/chrome.tsx](app/chrome.tsx) |

### Share to X

X's web intent cannot attach an image, so "Share to X" uploads the generated
1200×675 graphic, then opens the compose intent pre-filled with a caption,
`#FrameInGoa`, a tag for [@247pmstudio](https://x.com/247pmstudio), and a link to
`/s/<id>` whose `og:image` is that graphic — the preview shows the real artwork,
never a default thumbnail.

Two details that matter in practice:

- The popup opens synchronously on click and its location is set after the
  upload, so Safari doesn't swallow it as a blocked popup.
- Format A uploads a purpose-built 16:9 composition rather than the square
  avatar, so X never centre-crops the ring off.

On devices that support it, "Share image directly…" hands the actual file to the
X app's compose sheet via the Web Share API.

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

## Running it

```bash
npm install
npm run dev
```

Share links work with no configuration: without a Blob token the app stores share
images on the local filesystem under `.data/` and serves them from
`/api/image/[id]`.

### Production

Set `BLOB_READ_WRITE_TOKEN` (a linked Vercel Blob store provides it
automatically) and share images go to Blob's CDN instead. Optionally set
`NEXT_PUBLIC_SITE_URL` to pin the canonical origin used in share links and OG
tags; otherwise the app uses the project's production domain, falling back to the
request host.

## Tests

```bash
npm run fixtures                                    # generate a test photo
npm run test:e2e -- http://localhost:3000           # full flow, both formats
node scripts/check-upload.mjs http://localhost:3000/pfp webkit
```

`e2e.mjs` drives a real browser through the whole required flow for both formats
and six photo shapes (portrait, landscape, square, 12 MP HEIC, 36 MP HEIC):
render correctness and timing, long-name overflow, download, the X intent URL,
the caption's hashtag and studio tag, and that the resulting `og:image` is a real
1200×675 image served over HTTP.

`check-upload.mjs` exists separately because the e2e suite calls `setInputFiles`
directly on the input, which bypasses the click path — the exact path that once
broke. It drives a real mouse press across Chromium and WebKit, and with
JavaScript disabled.

Measured on this machine: 31–80 ms from file selection to finished artwork for
ordinary photos; ~800 ms for a 12 MP iPhone HEIC (including the one-time wasm
decoder load).
