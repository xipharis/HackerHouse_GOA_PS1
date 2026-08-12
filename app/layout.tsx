import type { Metadata, Viewport } from "next";
import { display, mono } from "./fonts";
import { EVENT } from "@/lib/brand";
import { siteUrl } from "@/lib/server/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: `${EVENT.full} — Frame Generator`,
  description: `Drop a photo, walk away with an ${EVENT.full} profile picture or builder pass. No login, no waiting. ${EVENT.hashtag}`,
  openGraph: {
    type: "website",
    title: `${EVENT.full} — ${EVENT.motto}`,
    description: `Make your ${EVENT.hashtag} graphic in one pass.`,
    siteName: EVENT.full,
  },
  twitter: { card: "summary_large_image", creator: EVENT.hostHandle },
};

export const viewport: Viewport = {
  themeColor: "#03190D",
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
