# HH Goa 2026 — Frame & Builder ID Generator

Upload a photo, get a branded HH Goa 2026 graphic, download it, post it to X.
Both formats from the brief are implemented:

- **Format A — PFP frame/overlay** (1024×1024): the photo stays front and centre
  inside a sunset gradient ring, with the event lockup set into the band itself so
  it survives X's circular avatar crop.
- **Format B — Builder ID card** (1200×675): photo + name + stack/role + a
  generated builder title, laid out as an event badge.

## How it works

Rendering happens entirely in the browser on a 2D canvas, so upload → finished
artwork is one synchronous paint. There is no server round-trip in the render
path and no loading screen.

| Path | Where |
| --- | --- |
| Photo intake (HEIC/EXIF/downscale) | [lib/image.ts](lib/image.ts) |
| Drawing primitives | [lib/render/paint.ts](lib/render/paint.ts) |
| The two renderers + link-preview card | [lib/render/index.ts](lib/render/index.ts) |
| Brand tokens & copy | [lib/brand.ts](lib/brand.ts) |
| Builder title generator | [lib/titles.ts](lib/titles.ts) |
| Share persistence | [lib/server/storage.ts](lib/server/storage.ts) |
| Share API | [app/api/share/route.ts](app/api/share/route.ts) |
| OG share page | [app/s/[id]/page.tsx](app/s/[id]/page.tsx) |
| UI | [app/generator.tsx](app/generator.tsx) |

### Share to X

X's web intent cannot attach an image, so "Share to X" uploads the generated
1200×675 graphic, then opens the compose intent pre-filled with a caption,
`#FrameInGoa`, and a link to `/s/<id>` whose `og:image` **is that graphic** —
the link preview shows the real artwork, never a default thumbnail.

On devices that support it, "Share image directly…" uses the Web Share API to
hand the actual PNG to the X app's compose sheet.

Two details that matter in practice:

- The popup is opened synchronously on click and its location set after the
  upload, so Safari doesn't swallow it as a blocked popup.
- Format A uploads a purpose-built 16:9 composition rather than the square
  avatar, so X never centre-crops the ring off.

### Photos

`jpg`, `png`, `webp` and iPhone `HEIC` are all accepted. HEIC is detected by MIME
type, extension, *and* ISO-BMFF brand sniffing (iOS often reports an empty type),
then decoded via libheif-wasm loaded on demand. EXIF orientation is honoured,
oversized camera output is downscaled to a 2048px long edge, and every photo is
`object-fit: cover` framed with drag-to-reposition and a zoom control — portrait,
landscape and off-centre crops all work without pre-cropping.

## Running it

```bash
npm install
npm run dev
```

Share links work with no configuration: without a Blob token the app stores
share images on the local filesystem under `.data/` and serves them from
`/api/image/[id]`.

### Production

Set `BLOB_READ_WRITE_TOKEN` (a linked Vercel Blob store provides it automatically)
and share images go to Blob's CDN instead. Optionally set `NEXT_PUBLIC_SITE_URL`
to pin the canonical origin used in share links and OG tags; otherwise the app
uses the project's production domain, falling back to the request host.

## Tests

```bash
npm run fixtures     # generate a test photo
npm run test:e2e -- http://localhost:3000
```

Drives a real browser through the whole required flow for both formats and five
photo shapes (portrait, landscape, square, 12 MP HEIC, 36 MP HEIC): render
correctness and timing, download, the X intent URL and caption, and that the
resulting `og:image` is a real 1200×675 image served over HTTP.

Measured on this machine: 31–80 ms from file selection to finished artwork for
ordinary photos; ~800 ms for a 12 MP iPhone HEIC (including the one-time wasm
decoder load).
