import type { Metadata, Viewport } from "next";
import { display, mono } from "./fonts";
import { EVENT } from "@/lib/brand";
import { siteUrl } from "@/lib/server/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: `${EVENT.full} — Frame & Builder ID Generator`,
  description: `Drop a photo, get an on-brand ${EVENT.full} profile picture or builder ID card. Download it, share it. ${EVENT.hashtag}`,
  openGraph: {
    type: "website",
    title: `${EVENT.full} — ${EVENT.tagline}`,
    description: `Make your ${EVENT.hashtag} graphic in one pass.`,
    siteName: EVENT.full,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#05061A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
