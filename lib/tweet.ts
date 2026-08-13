/**
 * X post-length accounting.
 *
 * A free X account is capped at 280 characters, and X does not count characters
 * naively:
 *
 *   - Any URL is counted as 23 regardless of its real length, because every link
 *     is rewritten through t.co.
 *   - Latin text counts 1 per character; almost everything else — emoji above
 *     all — counts 2. This is the "weighted length" from twitter-text.
 *
 * Getting this wrong is silent: the intent still opens, but the composer shows
 * the post already over the limit and the Post button is disabled.
 */

export const TWEET_LIMIT = 280;

/** What X charges for a link, whatever its real length. */
export const URL_COST = 23;

const URL_RE = /https?:\/\/\S+/gi;

/**
 * Character ranges twitter-text bills at 1; everything outside them costs 2.
 * Conservative on emoji: a ZWJ sequence is charged per code point here, where X
 * charges 2 for the whole cluster, so this can only over-estimate.
 */
function isLight(cp: number): boolean {
  return (
    cp <= 0x10ff ||
    (cp >= 0x2000 && cp <= 0x200d) ||
    (cp >= 0x2010 && cp <= 0x201f) ||
    (cp >= 0x2032 && cp <= 0x2037)
  );
}

export function weightedLength(text: string): number {
  let total = 0;
  for (const ch of text.replace(URL_RE, "x".repeat(URL_COST))) {
    total += isLight(ch.codePointAt(0)!) ? 1 : 2;
  }
  return total;
}

export const fitsInTweet = (text: string) => weightedLength(text) <= TWEET_LIMIT;

/** Shortens to `budget` weighted characters, with an ellipsis if it had to cut. */
export function clampWeighted(text: string, budget: number): string {
  if (weightedLength(text) <= budget) return text;
  const chars = [...text];
  while (chars.length && weightedLength(`${chars.join("")}…`) > budget) chars.pop();
  return `${chars.join("").trimEnd()}…`;
}
