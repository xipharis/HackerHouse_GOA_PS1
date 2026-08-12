import type { Metadata } from "next";
import Generator from "../generator";
import { Ambience, Footer, TopBar } from "../chrome";
import { EVENT } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Create the PFP — ${EVENT.full}`,
  description: `Wrap your photo in an ${EVENT.full} frame, sized for X. ${EVENT.hashtag}`,
};

export default function PfpPage() {
  return (
    <div className="grain relative min-h-dvh overflow-hidden bg-ink">
      <Ambience />
      <TopBar back />
      <Generator format="pfp" />
      <Footer />
    </div>
  );
}
