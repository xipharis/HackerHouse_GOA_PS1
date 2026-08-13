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
import { canvasFonts, ensureFontsReady, passFonts } from "./fonts";
import { EVENT, OUT, tweetLength, tweetText, type Format } from "@/lib/brand";
import { TWEET_LIMIT } from "@/lib/tweet";
import { ImageError, loadPhoto } from "@/lib/image";
import { builderTitle } from "@/lib/titles";
import {
  ensureCoast,
  photoWindow,
  renderCard,
  renderPassShareCard,
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
  const [photoId, setPhotoId] = useState(0);
  const [status, setStatus] = useState<Status>({ k: "idle" });
  const [framing, setFraming] = useState<Framing>({ fx: 0.5, fy: 0.5, zoom: 1 });

  const [name, setName] = useState("");
  const [stack, setStack] = useState("");
  const [departure, setDeparture] = useState("");
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
    // The pass prints a photo of the coast, and a paint is synchronous — both
    // the faces and that image have to be resident before the first render.
    Promise.all([ensureFontsReady(), ensureCoast()]).finally(() =>
      setFontsReady(true),
    );
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
        fonts: passFonts,
        framing,
        fields: { name, stack, departure, title, seed },
      });
    }
  }, [photo, format, framing, name, stack, departure, title, seed]);

  // Every input change repaints synchronously — no debounce needed, a full
  // composite is a couple of milliseconds.
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
      setPhotoId((n) => n + 1);
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

  // Reading `navigator` during render would desync hydration, so the server
  // snapshot is pinned to false and the real value arrives on the client.
  const canShareFiles = useSyncExternalStore(
    noopSubscribe,
    () =>
      typeof navigator.canShare === "function" &&
      // Desktop share sheets are the OS's own and usually have no X entry, so a
      // file attachment is only offered on touch devices, where the sheet lists
      // installed apps.
      window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

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
   * The 1200×630 image posted to X and used for the link preview.
   *
   * Neither format is that shape — the pfp is square and the pass is portrait —
   * so both get composed into a landscape card first, or X would centre-crop
   * them into a strip. JPEG rather than PNG: ~6× smaller over a phone
   * connection, and the artwork is all flat fills, so the difference is
   * invisible at card size.
   */
  const buildShareImage = useCallback(async (): Promise<Blob> => {
    const canvas = canvasRef.current!;
    const sc = shareCanvasRef.current!;
    if (format === "card") {
      renderPassShareCard(sc, {
        photo,
        fonts: passFonts,
        framing,
        fields: { name, stack, departure, title, seed },
      });
    } else {
      renderPfpShareCard(sc, canvas, canvasFonts);
    }
    return toBlob(sc, "image/jpeg", 0.92);
  }, [format, photo, framing, name, stack, departure, title, seed]);

  /**
   * Identity of the artwork currently on the canvas. Used to tell whether the
   * pre-built share image is still current.
   */
  const shareKey = useMemo(
    () => JSON.stringify([format, photoId, name, stack, departure, title, seed, framing]),
    [format, photoId, name, stack, departure, title, seed, framing],
  );

  /**
   * Pre-render the share image once the artwork settles.
   *
   * Safari only honours navigator.share() while the click's transient
   * activation is alive, and awaiting a canvas encode is enough to lose it. So
   * the blob has to be ready *before* the user clicks, not after.
   */
  const prebuilt = useRef<{ key: string; blob: Blob } | null>(null);
  useEffect(() => {
    if (!photo || !fontsReady) return;
    let cancelled = false;
    const t = setTimeout(() => {
      buildShareImage()
        .then((blob) => {
          if (!cancelled) prebuilt.current = { key: shareKey, blob };
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [shareKey, photo, fontsReady, buildShareImage]);

  const captionFields = {
    format,
    name,
    stack,
    title: format === "card" ? title : undefined,
  };
  const caption = (link: string) => tweetText({ ...captionFields, link });
  const captionChars = tweetLength(captionFields);

  /** Uploads the graphic and returns the /s/<id> permalink that unfurls to it. */
  const uploadShare = async (img: Blob) => {
    const body = new FormData();
    body.append("image", img, "share.jpg");
    body.append("format", format);
    if (name) body.append("name", name);
    if (format === "card") body.append("title", title);

    const res = await fetch("/api/share", { method: "POST", body });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
    const { shareUrl: url } = (await res.json()) as { shareUrl: string };
    setShareUrl(url);
    return url;
  };

  /**
   * Share to X. Always opens an X compose window — no exceptions.
   *
   * An earlier version preferred the Web Share API here because it can carry a
   * real file. That was wrong: on desktop the native sheet is the *operating
   * system's* (AirDrop, Mail, Messages) and frequently has no X in it at all,
   * so a button labelled "Share to X" did not reliably reach X. The intent is
   * the only path that always lands in a pre-filled X composer, so it owns this
   * button; attaching the file is offered separately, where it genuinely works.
   */
  const shareToX = async () => {
    if (!photo || sharing) return;
    setSharing(true);
    setNote(null);

    // Opened synchronously so Safari doesn't treat it as a blocked popup.
    const win = window.open("about:blank", "_blank");
    const ready = prebuilt.current?.key === shareKey ? prebuilt.current.blob : null;

    try {
      const url = await uploadShare(ready ?? (await buildShareImage()));
      // The link goes inside the body, not the intent's `url` parameter, which
      // X would append after the hashtags and break the layout.
      const intent = `https://x.com/intent/post?text=${encodeURIComponent(caption(url))}`;
      if (win) win.location.href = intent;
      else window.location.href = intent;
    } catch (e) {
      win?.close();
      setNote(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't reach the server. Download the PNG and post it manually.",
      );
    } finally {
      setSharing(false);
    }
  };

  /**
   * Hands the actual image file to the share sheet, which on a phone includes
   * the X app and produces a post with a true image attachment. Only offered on
   * touch devices for the reason above.
   */
  const shareWithImage = async () => {
    if (!photo) return;
    setNote(null);
    const ready = prebuilt.current?.key === shareKey ? prebuilt.current.blob : null;
    try {
      const blob = ready ?? (await buildShareImage());
      const file = new File([blob], filename().replace(/\.png$/, ".jpg"), {
        type: "image/jpeg",
      });
      if (!navigator.canShare?.({ files: [file] })) {
        setNote("This device can't attach images — use Share to X.");
        return;
      }
      await navigator.share({
        files: [file],
        // The site itself, so no upload is needed and the sheet opens inside
        // the click's activation window.
        text: caption(`${window.location.origin}/${format === "card" ? "pass" : "pfp"}`),
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setNote("Couldn't open the share sheet — use Share to X.");
    }
  };

  /** Desktop escape hatch: caption on the clipboard, image already downloaded. */
  const copyCaption = async () => {
    if (!photo) return;
    try {
      let link = shareUrl;
      if (!link) {
        setSharing(true);
        link = await uploadShare(
          prebuilt.current?.key === shareKey
            ? prebuilt.current.blob
            : await buildShareImage(),
        );
      }
      await navigator.clipboard.writeText(caption(link));
      setNote("Caption copied. Download the image and attach it in X.");
    } catch {
      setNote("Couldn't copy the caption — select it from the link below.");
    } finally {
      setSharing(false);
    }
  };

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
            // The pass is portrait, so it's capped and centred rather than
            // stretched across the column — full width would run off-screen.
            className={`relative overflow-hidden rounded-2xl border border-cream/12 bg-forest/20 ${
              format === "card" ? "mx-auto w-full max-w-[420px] lg:max-w-[460px]" : ""
            }`}
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
                label="Departing from"
                value={departure}
                onChange={setDeparture}
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
                onClick={shareWithImage}
                className="rounded-xl border border-signal/50 px-4 py-2.5 text-[11px] font-bold tracking-wide text-signal transition-colors hover:bg-signal/10 disabled:opacity-25"
              >
                POST WITH IMAGE ATTACHED
              </button>
            )}

            <button
              disabled={!photo || sharing}
              onClick={copyCaption}
              className="rounded-xl border border-cream/15 px-4 py-2.5 text-[11px] font-bold tracking-wide text-cream/70 transition-colors hover:border-cream/30 disabled:opacity-25"
            >
              COPY CAPTION
            </button>

            <p className="flex items-center justify-between text-[10px] text-cream/30">
              <span>POST LENGTH</span>
              <span className={captionChars > TWEET_LIMIT ? "text-signal" : ""}>
                {captionChars} / {TWEET_LIMIT}
              </span>
            </p>

            <p className="text-[10px] leading-relaxed text-cream/30">
              {canShareFiles
                ? "SHARE TO X OPENS A PRE-FILLED POST WHERE YOUR GRAPHIC IS THE PREVIEW CARD. FOR A TRUE ATTACHMENT, USE POST WITH IMAGE ATTACHED."
                : "X CAN'T ATTACH A FILE FROM A LINK — YOUR POST SHOWS THE GRAPHIC AS ITS PREVIEW CARD. FOR A TRUE ATTACHMENT, DOWNLOAD THE PNG AND DRAG IT IN."}
            </p>
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

      {/* Off-screen scratch canvas for the link-preview composition. */}
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
