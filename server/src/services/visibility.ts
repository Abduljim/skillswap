/**
 * Pure discovery-ranking helpers (PRD §7–9).
 *
 * The compatibility score shown to users is GENUINE and never modified by
 * payment. Paid tiers and boosts only influence ORDER via a separate
 * visibility score, and a genuinely strong match always dominates a paid
 * weak one.
 */

export interface VisibilityInfo {
  visibilityBonus: number;
  boosted: boolean;
  spotlighted: boolean;
}

export interface ScoredEntry {
  user: { id: string };
  match: { score: number };
}

/** True when a genuinely strong match outranks a paid weak match. */
export function strongMatchDominates(
  strong: { score: number; visibilityBonus: number },
  weak: { score: number; visibilityBonus: number }
): boolean {
  const strongIsStrong = strong.score >= 60;
  const weakIsStrong = weak.score >= 60;
  if (strongIsStrong !== weakIsStrong) return strongIsStrong;
  return (
    strong.score + strong.visibilityBonus >= weak.score + weak.visibilityBonus ||
    strongIsStrong
  );
}

/**
 * Balanced final ordering (PRD §8):
 *  1. A strong genuine match (>=60) always outranks a paid weak match (<40
 *     can't even enter discovery; a 40-59 paid match cannot jump the 60+ tier).
 *  2. Within the same quality band, compatibility + visibility decides.
 *  3. Spotlighted profiles surface first among exact equals.
 */
export function rankByVisibility<
  T extends { user: { id: string }; match: { score: number } }
>(entries: T[], layer: Map<string, VisibilityInfo>): T[] {
  return [...entries].sort((a, b) => {
    const va = layer.get(a.user.id)?.visibilityBonus ?? 0;
    const vb = layer.get(b.user.id)?.visibilityBonus ?? 0;
    const aStrong = a.match.score >= 60;
    const bStrong = b.match.score >= 60;
    if (aStrong !== bStrong) return aStrong ? -1 : 1;
    const aScore = a.match.score + va;
    const bScore = b.match.score + vb;
    if (bScore !== aScore) return bScore - aScore;
    const sa = layer.get(a.user.id)?.spotlighted ? 1 : 0;
    const sb = layer.get(b.user.id)?.spotlighted ? 1 : 0;
    return sb - sa;
  });
}

/** Compute the visibility score for one candidate (compatibility excluded). */
export function calculateVisibilityScore(tier: 'FREE' | 'GOLD' | 'ELITE', boosted: boolean, tierBonus: number, boostBonus: number): number {
  const base = tier === 'ELITE' ? tierBonus : tier === 'GOLD' ? tierBonus : 0;
  return base + (boosted ? boostBonus : 0);
}
