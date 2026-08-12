import type { Metadata } from "next";
import Generator from "../generator";
import { Ambience, Footer, TopBar } from "../chrome";
import { EVENT } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Generate a builder pass — ${EVENT.full}`,
  description: `Your name, your stack, and the dates you land in Goa, on an ${EVENT.full} builder pass. ${EVENT.hashtag}`,
};

export default function PassPage() {
  return (
    <div className="grain relative min-h-dvh overflow-hidden bg-ink">
      <Ambience />
      <TopBar back />
      <Generator format="card" />
      <Footer />
    </div>
  );
}
