/**
 * Deterministic "builder title" generator.
 *
 * Same name + stack always yields the same title (so a card is reproducible and
 * a re-render never surprises the user), but the seed can be bumped to re-roll.
 * Stack keywords get first refusal so the title actually reflects what you build.
 */

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const pick = <T,>(arr: readonly T[], n: number): T => arr[n % arr.length];

/** Goa-flavoured adjectives. */
const ADJ = [
  "Sunset", "Low-Tide", "Monsoon", "Barefoot", "Midnight", "Saltwater",
  "Feni-Fuelled", "Hammock", "Offshore", "Sandy", "Palm-Shaded", "Tidal",
  "Coastline", "Sunburnt", "Beachside", "Trance-Core", "Cashew-Powered",
  "Deep-Blue", "Golden-Hour", "Shoreline",
] as const;

/** Generic builder nouns, used when the stack gives us nothing to work with. */
const NOUN = [
  "Shipper", "Architect", "Tinkerer", "Wizard", "Operator", "Craftsman",
  "Hacker", "Pathfinder", "Renegade", "Alchemist", "Sorcerer", "Machinist",
  "Voyager", "Debugger", "Builder", "Smuggler", "Cartographer", "Prototyper",
] as const;

/** Stack keyword → specific noun. First match wins, so order matters. */
const STACK_NOUNS: readonly [RegExp, readonly string[]][] = [
  [/\brust\b|cargo|tokio/i, ["Borrow-Checker Buccaneer", "Zero-Cost Zealot", "Memory-Safe Marauder"]],
  [/\bgo(lang)?\b|goroutine/i, ["Goroutine Wrangler", "Concurrency Corsair"]],
  [/solidity|web3|blockchain|onchain|crypto|ethereum|solana/i, ["Onchain Outlaw", "Block Explorer", "Gas-Golf Champion"]],
  [/\b(ai|ml|llm|agent|rag|pytorch|tensorflow|diffusion|genai)\b/i, ["Prompt Pirate", "Token Whisperer", "Latent-Space Lifeguard", "Agent Wrangler"]],
  [/react|next\.?js|svelte|vue|frontend|front-end|tailwind/i, ["Pixel Pusher", "Hydration Hero", "Interface Illusionist"]],
  [/\bios\b|swift|android|kotlin|flutter|react ?native|mobile/i, ["Pocket-Screen Pirate", "Thumb-Zone Tactician"]],
  [/devops|kubernetes|k8s|docker|infra|terraform|sre|cloud|aws/i, ["Yaml Yogi", "Uptime Uncle", "Cluster Captain"]],
  [/design|figma|ux|\bui\b|brand/i, ["Vibe Director", "Kerning Kingpin", "Grid Guardian"]],
  [/data|sql|postgres|analytics|etl|spark|warehouse/i, ["Query Corsair", "Index Islander", "Pipeline Pilot"]],
  [/game|unity|unreal|godot|shader|3d|webgl/i, ["Frame-Rate Freebooter", "Shader Shaman"]],
  [/security|pentest|infosec|hacker|ctf/i, ["Threat-Model Tactician", "Payload Pilgrim"]],
  [/embedded|hardware|iot|arduino|robot|firmware|esp32/i, ["Solder Sailor", "Firmware Fisherman"]],
  [/founder|ceo|cto|product|\bpm\b|growth/i, ["Roadmap Rover", "Deck Diver", "Scope Sailor"]],
  [/backend|back-end|api|node|python|django|rails|java|php|server/i, ["Endpoint Explorer", "Latency Lifeguard", "Payload Plumber"]],
];

export function builderTitle(name: string, stack: string, seed = 0): string {
  const base = hash(`${name.trim().toLowerCase()}|${stack.trim().toLowerCase()}|${seed}`);

  for (const [re, nouns] of STACK_NOUNS) {
    if (re.test(stack)) {
      const noun = pick(nouns, base);
      // Half the time, prefix a Goa adjective — keeps it from feeling like a lookup table.
      return base % 2 === 0 ? `${pick(ADJ, base >>> 8)} ${noun}` : noun;
    }
  }
  return `${pick(ADJ, base)} ${pick(NOUN, base >>> 9)}`;
}

/**
 * The serial printed under the barcode on the pass, e.g. "HH-GOA-873524".
 * Numeric so it reads as a real ticket number, and stable for a given builder.
 */
export function badgeId(name: string, stack: string, seed = 0): string {
  const h = hash(`badge|${name}|${stack}|${seed}`);
  return `HH-GOA-${String(h % 1_000_000).padStart(6, "0")}`;
}
