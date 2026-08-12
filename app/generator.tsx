"use client";

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

const ACCEPT = "image/*,.heic,.heif,.HEIC,.HEIF";

export default function Generator() {
  const [format, setFormat] = useState<Format>("pfp");
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [status, setStatus] = useState<Status>({ k: "idle" });
  const [framing, setFraming] = useState<Framing>({ fx: 0.5, fy: 0.5, zoom: 1 });

  const [name, setName] = useState("");
  const [stack, setStack] = useState("");
  const [seed, setSeed] = useState(0);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);

  const [fontsReady, setFontsReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        fields: { name, stack, title, seed },
      });
    }
  }, [photo, format, framing, name, stack, title, seed]);

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
        msg: e instanceof ImageError ? e.message : "Something went wrong reading that file.",
      });
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    void accept(e.dataTransfer.files?.[0]);
  };

  /* ------------------------------------------------- drag to reposition */

  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

  const slack = useMemo(() => {
    if (!photo) return { x: 0, y: 0 };
    const win = photoWindow(format);
    const scale =
      Math.max(win.w / photo.width, win.h / photo.height) * Math.max(framing.zoom, 1);
    return {
      x: photo.width * scale - win.w,
      y: photo.height * scale - win.h,
    };
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

  /* ------------------------------------------------------------- outputs */

  const filename = () => {
    const slug = (name || "builder").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return format === "pfp" ? "hh-goa-2026-pfp.png" : `hh-goa-2026-id-${slug || "builder"}.png`;
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
   * JPEG here rather than PNG: it's ~6× smaller over a phone connection and the
   * artwork is all gradients, so the difference is invisible at card size.
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

  /** Mobile path: hands the actual PNG to the X app's compose sheet. */
  const shareNative = async () => {
    if (!photo) return;
    try {
      const img = await buildShareImage();
      const file = new File([img], filename().replace(/\.png$/, ".jpg"), {
        type: "image/jpeg",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: tweetText({ format, name, title }) });
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
    () => () => {},
    () => typeof navigator.canShare === "function",
    () => false,
  );

  /* ------------------------------------------------------------------ UI */

  const ratio = format === "pfp" ? 1 : OUT.cardW / OUT.cardH;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <p className="font-mono text-xs tracking-[0.3em] text-teal">
          {EVENT.hashtag.toUpperCase()}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          {EVENT.full} Frame Generator
        </h1>
        <p className="mt-2 max-w-xl text-sand/60">
          Drop a photo. Get an on-brand profile picture or builder ID. Download it,
          post it. No login, no waiting.
        </p>
      </header>

      {/* Format switch */}
      <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
        {(
          [
            ["pfp", "A · PFP Frame"],
            ["card", "B · Builder ID"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFormat(k)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              format === k ? "bg-sand text-ink" : "text-sand/60 hover:text-sand"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------------------------------------------- preview */}
        <section>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
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
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
              >
                <span className="rounded-full bg-gradient-to-r from-teal via-magenta to-amber px-6 py-3 font-bold text-ink">
                  {status.k === "reading" ? "Reading photo…" : "Upload a photo"}
                </span>
                <span className="text-sm text-sand/50">
                  or drop it here · JPG, PNG, WebP, HEIC
                </span>
              </button>
            )}

            {status.k === "reading" && photo && (
              <div className="absolute inset-0 grid place-items-center bg-ink/60 text-sm">
                Reading photo…
              </div>
            )}
          </div>

          {photo && (
            <p className="mt-2 text-center text-xs text-sand/40">
              Drag the photo to reposition
            </p>
          )}

          {status.k === "error" && (
            <p className="mt-3 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral">
              {status.msg}
            </p>
          )}

          {/* How X will actually crop it */}
          {photo && format === "pfp" && (
            <div className="mt-4 flex items-center gap-4">
              <span className="font-mono text-xs text-sand/40">AS X SHOWS IT</span>
              {[96, 48].map((s) => (
                <CirclePreview key={s} size={s} source={canvasRef} tick={`${framing.fx},${framing.fy},${framing.zoom}`} />
              ))}
            </div>
          )}
        </section>

        {/* ----------------------------------------------------- controls */}
        <aside className="flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => void accept(e.target.files?.[0])}
          />

          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold hover:bg-white/10"
          >
            {photo ? "Change photo" : "Choose photo"}
          </button>

          {photo && (
            <label className="text-xs text-sand/50">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={framing.zoom}
                onChange={(e) =>
                  setFraming((f) => ({ ...f, zoom: Number(e.target.value) }))
                }
                className="mt-1 w-full"
              />
            </label>
          )}

          {format === "card" && (
            <>
              <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" maxLength={40} />
              <Field label="Stack / role" value={stack} onChange={setStack} placeholder="Rust · systems" maxLength={40} />

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs tracking-widest text-sand/50">
                    BUILDER TITLE
                  </span>
                  <button
                    onClick={() => {
                      setTitleOverride(null);
                      setSeed((s) => s + 1);
                    }}
                    className="text-xs font-bold text-teal hover:underline"
                  >
                    re-roll ↻
                  </button>
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitleOverride(e.target.value.slice(0, 40))}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-teal"
                />
              </div>
            </>
          )}

          <div className="mt-2 flex flex-col gap-2">
            <button
              disabled={!photo}
              onClick={download}
              className="rounded-xl bg-sand px-4 py-3 font-black text-ink disabled:opacity-30"
            >
              Download PNG
            </button>

            <button
              disabled={!photo || sharing}
              onClick={shareToX}
              className="rounded-xl bg-gradient-to-r from-teal via-magenta to-amber px-4 py-3 font-black text-ink disabled:opacity-30"
            >
              {sharing ? "Preparing…" : "Share to X"}
            </button>

            {canShareFiles && (
              <button
                disabled={!photo}
                onClick={shareNative}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-sand/80 disabled:opacity-30"
              >
                Share image directly…
              </button>
            )}
          </div>

          {shareUrl && (
            <button
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
                setNote("Link copied.");
              }}
              className="truncate rounded-lg border border-white/10 px-3 py-2 text-left font-mono text-xs text-sand/50"
            >
              {shareUrl}
            </button>
          )}

          {note && <p className="text-xs text-amber">{note}</p>}
        </aside>
      </div>

      {/* Off-screen scratch canvas for the Format A link-preview composition. */}
      <canvas ref={shareCanvasRef} className="hidden" aria-hidden />
    </main>
  );
}

/* ------------------------------------------------------------ small parts */

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-xs tracking-widest text-sand/50">
        {label.toUpperCase()}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-teal"
      />
    </label>
  );
}

/** Mirrors the live canvas into a circle at true X display sizes. */
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
  return <canvas ref={ref} style={{ width: size, height: size }} className="rounded-full" />;
}
