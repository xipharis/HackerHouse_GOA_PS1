"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { canvasFonts, ensureFontsReady } from "./fonts";
import { EVENT, OUT, tweetText, type Format } from "@/lib/brand";
import { ImageError, loadPhoto } from "@/lib/image";
import { builderTitle } from "@/lib/titles";
import {
  photoWindow,
  renderCard,
  renderPfp,
  renderPfpShareCard,
  toBlob,
} from "@/lib/render";
import type { Framing } from "@/lib/render/paint";

type Status =
  | { k: "idle" }
  | { k: "reading" }
  | { k: "ready" }
  | { k: "error"; msg: string };

// Extension hints alongside image/* because iOS/Android pickers sometimes grey
// out HEIC files when only the wildcard is given. Matching is case-insensitive.
const ACCEPT = "image/*,.heic,.heif";

/** Hoisted: an inline subscribe would re-subscribe on every single render. */
const noopSubscribe = () => () => {};

const COPY = {
  pfp: {
    kicker: "FORMAT A",
    title: "Create the PFP",
    blurb:
      "Drop a photo. The frame wraps it in HH Goa yellow and keeps your face front and centre — check the circles to see exactly what X will show.",
    other: { href: "/pass", label: "Need a builder pass instead?" },
  },
  card: {
    kicker: "FORMAT B",
    title: "Generate a builder pass",
    blurb:
      "Your photo, your name, your stack — plus a builder title you don't get to choose and the dates you land in Goa.",
    other: { href: "/pfp", label: "Just want the profile picture?" },
  },
} as const;

export default function Generator({ format }: { format: Format }) {
  const copy = COPY[format];

  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [status, setStatus] = useState<Status>({ k: "idle" });
  const [framing, setFraming] = useState<Framing>({ fx: 0.5, fy: 0.5, zoom: 1 });

  const [name, setName] = useState("");
  const [stack, setStack] = useState("");
  const [from, setFrom] = useState("");
  const [seed, setSeed] = useState(0);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);

  const [fontsReady, setFontsReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);

  const title = titleOverride ?? builderTitle(name || "builder", stack, seed);

  useEffect(() => {
    ensureFontsReady().finally(() => setFontsReady(true));
  }, []);

  /* ------------------------------------------------------------ rendering */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    if (format === "pfp") {
      renderPfp(canvas, { photo, fonts: canvasFonts, framing });
    } else {
      renderCard(canvas, {
        photo,
        fonts: canvasFonts,
        framing,
        fields: { name, stack, from, title, seed },
      });
    }
  }, [photo, format, framing, name, stack, from, title, seed]);

  // Every input change repaints synchronously — no debounce needed, a full
  // 1200×675 composite is a couple of milliseconds.
  useEffect(() => {
    if (fontsReady) draw();
  }, [draw, fontsReady]);

  /* --------------------------------------------------------------- upload */

  const accept = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setStatus({ k: "reading" });
    setShareUrl(null);
    setNote(null);
    try {
      const bmp = await loadPhoto(file);
      setPhoto((prev) => {
        prev?.close();
        return bmp;
      });
      setFraming({ fx: 0.5, fy: 0.5, zoom: 1 });
      setStatus({ k: "ready" });
    } catch (e) {
      setStatus({
        k: "error",
        msg:
          e instanceof ImageError
            ? e.message
            : "Something went wrong reading that file.",
      });
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    void accept(e.dataTransfer.files?.[0]);
  };

  /* --------------------------------------------------- drag to reposition */

  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

  const slack = useMemo(() => {
    if (!photo) return { x: 0, y: 0 };
    const win = photoWindow(format);
    const scale =
      Math.max(win.w / photo.width, win.h / photo.height) * Math.max(framing.zoom, 1);
    return { x: photo.width * scale - win.w, y: photo.height * scale - win.h };
  }, [photo, format, framing.zoom]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: framing.fx, fy: framing.fy };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    // Screen pixels → output pixels → focal-point delta.
    const k = canvas.width / canvas.getBoundingClientRect().width;
    const nx = slack.x > 1 ? d.fx - ((e.clientX - d.x) * k) / slack.x : 0.5;
    const ny = slack.y > 1 ? d.fy - ((e.clientY - d.y) * k) / slack.y : 0.5;
    setFraming((f) => ({
      ...f,
      fx: Math.min(1, Math.max(0, nx)),
      fy: Math.min(1, Math.max(0, ny)),
    }));
  };

  const endDrag = () => {
    drag.current = null;
  };

  /* -------------------------------------------------------------- outputs */

  const filename = () => {
    const slug = (name || "builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return format === "pfp"
      ? "hh-goa-2026-pfp.png"
      : `hh-goa-2026-pass-${slug || "builder"}.png`;
  };

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    const blob = await toBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  /**
   * The 1200×675 image used for the link preview and the native share sheet.
   * JPEG rather than PNG: ~6× smaller over a phone connection, and the artwork
   * is all flat fills, so the difference is invisible at card size.
   */
  const buildShareImage = async (): Promise<Blob> => {
    const canvas = canvasRef.current!;
    if (format === "card") return toBlob(canvas, "image/jpeg", 0.92);
    const sc = shareCanvasRef.current!;
    renderPfpShareCard(sc, canvas, canvasFonts);
    return toBlob(sc, "image/jpeg", 0.92);
  };

  const shareToX = async () => {
    if (!photo || sharing) return;
    setSharing(true);
    setNote(null);

    // Opened synchronously so Safari doesn't treat it as a blocked popup.
    const win = window.open("about:blank", "_blank");
    const text = tweetText({ format, name, title });

    try {
      const img = await buildShareImage();
      const body = new FormData();
      body.append("image", img, "share.jpg");
      body.append("format", format);
      if (name) body.append("name", name);
      if (format === "card") body.append("title", title);

      const res = await fetch("/api/share", { method: "POST", body });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      const { shareUrl: url } = (await res.json()) as { shareUrl: string };
      setShareUrl(url);

      const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      if (win) win.location.href = intent;
      else window.location.href = intent;
    } catch (e) {
      win?.close();
      setNote(
        e instanceof Error && e.message
          ? e.message
          : "Share link failed — you can still download and post it manually.",
      );
    } finally {
      setSharing(false);
    }
  };

  /** Mobile path: hands the actual image to the X app's compose sheet. */
  const shareNative = async () => {
    if (!photo) return;
    try {
      const img = await buildShareImage();
      const file = new File([img], filename().replace(/\.png$/, ".jpg"), {
        type: "image/jpeg",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: tweetText({ format, name, title }),
        });
      } else {
        setNote("Your browser can't attach images directly — use Share to X.");
      }
    } catch {
      /* user dismissed the sheet */
    }
  };

  // Reading `navigator` during render would desync hydration, so the server
  // snapshot is pinned to false and the real value arrives on the client.
  const canShareFiles = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.canShare === "function",
    () => false,
  );

  /* ------------------------------------------------------------------- UI */

  const ratio = format === "pfp" ? 1 : OUT.cardW / OUT.cardH;

  return (
    <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-4 sm:px-8">
      <div className="mb-8 sm:mb-12">
        <span className="text-[10px] tracking-[0.24em] text-signal/80">
          {copy.kicker}
        </span>
        <h1 className="font-display mt-2 text-4xl text-cream sm:text-6xl">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-lg text-xs leading-relaxed text-cream/55 sm:text-sm">
          {copy.blurb}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ------------------------------------------------------- preview */}
        <section>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative overflow-hidden rounded-2xl border border-cream/12 bg-forest/20"
            style={{ aspectRatio: ratio }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={`h-full w-full touch-none select-none ${
                photo ? "cursor-grab active:cursor-grabbing" : "invisible"
              }`}
            />

            {!photo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                <span className="rounded-full bg-signal px-6 py-3 text-sm font-bold text-forest">
                  {status.k === "reading" ? "Reading photo…" : "Upload a photo"}
                </span>
                <span className="text-[11px] tracking-[0.14em] text-cream/40">
                  OR DROP IT HERE · JPG · PNG · WEBP · HEIC
                </span>
                <FileInput onPick={accept} label="Upload a photo" />
              </div>
            )}

            {status.k === "reading" && photo && (
              <div className="absolute inset-0 grid place-items-center bg-ink/70 text-xs tracking-[0.2em]">
                READING PHOTO…
              </div>
            )}
          </div>

          {photo && (
            <p className="mt-3 text-center text-[10px] tracking-[0.16em] text-cream/35">
              DRAG THE PHOTO TO REPOSITION
            </p>
          )}

          {status.k === "error" && (
            <p className="mt-4 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-xs text-signal">
              {status.msg}
            </p>
          )}

          {/* How X will actually crop it */}
          {photo && format === "pfp" && (
            <div className="mt-6 flex items-center gap-5 rounded-xl border border-cream/10 bg-forest/15 px-5 py-4">
              <span className="text-[10px] leading-tight tracking-[0.16em] text-cream/40">
                AS X<br />SHOWS IT
              </span>
              {[96, 48].map((s) => (
                <CirclePreview
                  key={s}
                  size={s}
                  source={canvasRef}
                  tick={`${framing.fx},${framing.fy},${framing.zoom}`}
                />
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------ controls */}
        <aside className="flex flex-col gap-4">
          <div className="relative rounded-xl border border-cream/15 bg-forest/25 px-4 py-3 text-center text-xs font-bold tracking-wide transition-colors hover:bg-forest/40 focus-within:border-signal">
            {photo ? "CHANGE PHOTO" : "CHOOSE PHOTO"}
            <FileInput
              onPick={accept}
              label={photo ? "Change photo" : "Choose photo"}
            />
          </div>

          {photo && (
            <label className="block">
              <span className="text-[10px] tracking-[0.2em] text-cream/45">ZOOM</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={framing.zoom}
                onChange={(e) =>
                  setFraming((f) => ({ ...f, zoom: Number(e.target.value) }))
                }
                className="mt-2 w-full"
              />
            </label>
          )}

          {format === "card" && (
            <>
              <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />
              <Field
                label="Stack / role"
                value={stack}
                onChange={setStack}
                placeholder="Rust · distributed systems"
              />
              <Field
                label="Travelling from"
                value={from}
                onChange={setFrom}
                placeholder="Bengaluru, IN"
              />

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] tracking-[0.2em] text-cream/45">
                    BUILDER TITLE
                  </span>
                  <button
                    onClick={() => {
                      setTitleOverride(null);
                      setSeed((s) => s + 1);
                    }}
                    className="text-[10px] font-bold tracking-wide text-signal hover:underline"
                  >
                    RE-ROLL ↻
                  </button>
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitleOverride(e.target.value.slice(0, 40))}
                  className="mt-2 w-full rounded-xl border border-cream/15 bg-forest/25 px-3 py-2.5 text-xs text-cream outline-none transition-colors placeholder:text-cream/25 focus:border-signal"
                />
              </div>

              <p className="text-[10px] leading-relaxed tracking-wide text-cream/30">
                PASS SHOWS {EVENT.arrival} → {EVENT.departure}
              </p>
            </>
          )}

          <div className="mt-2 flex flex-col gap-2.5">
            <button
              disabled={!photo}
              onClick={download}
              className="rounded-xl bg-cream px-4 py-3.5 text-xs font-bold tracking-wide text-forest transition-opacity hover:opacity-90 disabled:opacity-25"
            >
              DOWNLOAD PNG
            </button>

            <button
              disabled={!photo || sharing}
              onClick={shareToX}
              className="rounded-xl bg-signal px-4 py-3.5 text-xs font-bold tracking-wide text-forest transition-opacity hover:opacity-90 disabled:opacity-25"
            >
              {sharing ? "PREPARING…" : "SHARE TO X"}
            </button>

            {canShareFiles && (
              <button
                disabled={!photo}
                onClick={shareNative}
                className="rounded-xl border border-cream/15 px-4 py-2.5 text-[11px] font-bold tracking-wide text-cream/70 transition-colors hover:border-cream/30 disabled:opacity-25"
              >
                SHARE IMAGE DIRECTLY…
              </button>
            )}
          </div>

          {shareUrl && (
            <button
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
                setNote("Link copied.");
              }}
              className="truncate rounded-lg border border-cream/10 px-3 py-2 text-left text-[10px] text-cream/45 hover:border-cream/25"
            >
              {shareUrl}
            </button>
          )}

          {note && <p className="text-[11px] text-signal">{note}</p>}

          <Link
            href={copy.other.href}
            className="mt-2 text-[11px] text-cream/40 underline-offset-4 transition-colors hover:text-signal hover:underline"
          >
            {copy.other.label}
          </Link>
        </aside>
      </div>

      {/* Off-screen scratch canvas for the Format A link-preview composition. */}
      <canvas ref={shareCanvasRef} className="hidden" aria-hidden />
    </main>
  );
}

/* ------------------------------------------------------------ small parts */

/**
 * The real file input, stretched invisibly over its trigger.
 *
 * Every indirection — `display:none` + a scripted `.click()`, or a `<label for>`
 * pointing at an `sr-only` input — is refused by at least one browser: Safari
 * declines to open a picker for an input it doesn't consider visible. Making the
 * input itself the click target is the one approach with no such caveat, and it
 * keeps native keyboard activation and drag-and-drop for free.
 */
function FileInput({
  onPick,
  label,
}: {
  onPick: (file: File | undefined) => void;
  label: string;
}) {
  return (
    <input
      type="file"
      accept={ACCEPT}
      aria-label={label}
      onChange={(e) => {
        onPick(e.target.files?.[0]);
        // Clear it so re-picking the same file still fires a change event.
        e.target.value = "";
      }}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 outline-none"
    />
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.2em] text-cream/45">
        {label.toUpperCase()}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={40}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-cream/15 bg-forest/25 px-3 py-2.5 text-xs text-cream outline-none transition-colors placeholder:text-cream/25 focus:border-signal"
      />
    </label>
  );
}

/** Mirrors the live canvas into a circle at the sizes X actually renders. */
function CirclePreview({
  size,
  source,
  tick,
}: {
  size: number;
  source: React.RefObject<HTMLCanvasElement | null>;
  tick: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const dst = ref.current;
    const src = source.current;
    if (!dst || !src) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    dst.width = dst.height = size * dpr;
    const ctx = dst.getContext("2d")!;
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(dst.width / 2, dst.height / 2, dst.width / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, dst.width, dst.height);
    ctx.restore();
  });
  // `tick` is only here to re-run the effect when the main canvas repaints.
  void tick;
  return (
    <canvas ref={ref} style={{ width: size, height: size }} className="rounded-full" />
  );
}
