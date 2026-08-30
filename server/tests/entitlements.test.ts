import {
  calculateVisibilityScore,
  rankByVisibility,
  strongMatchDominates,
} from '../src/services/visibility';
import { TIER_CONFIG, ACTIVE_BOOST_BONUS } from '../src/services/entitlements';
import type { Tier } from '../src/services/entitlements';

describe('tier configuration', () => {
  it('free limits match the PRD (5 requests, 10 unlocks, 10 saved)', () => {
    expect(TIER_CONFIG.FREE.limits.requestSent).toBe(5);
    expect(TIER_CONFIG.FREE.limits.matchUnlock).toBe(10);
    expect(TIER_CONFIG.FREE.limits.savedMatch).toBe(10);
  });

  it('gold and elite have no usage limits', () => {
    expect(TIER_CONFIG.GOLD.limits.requestSent).toBeNull();
    expect(TIER_CONFIG.ELITE.limits.requestSent).toBeNull();
    expect(TIER_CONFIG.GOLD.limits.matchUnlock).toBeNull();
    expect(TIER_CONFIG.ELITE.limits.savedMatch).toBeNull();
  });

  it('visibility bonuses are GOLD 10, ELITE 20, boost 15', () => {
    expect(TIER_CONFIG.GOLD.visibilityBonus).toBe(10);
    expect(TIER_CONFIG.ELITE.visibilityBonus).toBe(20);
    expect(ACTIVE_BOOST_BONUS).toBe(15);
  });

  it('elite grants monthly spotlight credits, gold does not', () => {
    expect(TIER_CONFIG.ELITE.monthlySpotlightCredits).toBeGreaterThan(0);
    expect(TIER_CONFIG.GOLD.monthlySpotlightCredits).toBe(0);
    expect(TIER_CONFIG.FREE.monthlySpotlightCredits).toBe(0);
  });

  it('tier taglines match PRD positioning', () => {
    expect(TIER_CONFIG.FREE.tagline).toBe('Start swapping.');
    expect(TIER_CONFIG.GOLD.tagline).toBe('Get discovered.');
    expect(TIER_CONFIG.ELITE.tagline).toBe('Become a top skill partner.');
  });
});

describe('discovery ranking fairness (PRD §8)', () => {
  it('never lets a paid low match outrank a highly compatible free user', () => {
    const result = strongMatchDominates(
      { score: 85, visibilityBonus: 0 }, // free, highly compatible
      { score: 25, visibilityBonus: 20 + ACTIVE_BOOST_BONUS } // elite + boosted, poor match
    );
    expect(result).toBe(true);
  });

  it('visibility bonus lifts a candidate among similar compatibility', () => {
    const entries = [
      { user: { id: 'free' }, match: { score: 80 } },
      { user: { id: 'gold' }, match: { score: 80 } },
    ] as Parameters<typeof rankByVisibility>[0];
    const layer = new Map([
      ['free', { visibilityBonus: 0, boosted: false, spotlighted: false }],
      ['gold', { visibilityBonus: 10, boosted: false, spotlighted: false }],
    ]);
    const ranked = rankByVisibility(entries, layer);
    expect(ranked[0].user.id).toBe('gold');
  });

  it('spotlight breaks ties without changing the compatibility score', () => {
    const entries = [
      { user: { id: 'plain' }, match: { score: 80 } },
      { user: { id: 'lit' }, match: { score: 80 } },
    ] as Parameters<typeof rankByVisibility>[0];
    const layer = new Map([
      ['plain', { visibilityBonus: 0, boosted: false, spotlighted: false }],
      ['lit', { visibilityBonus: 0, boosted: false, spotlighted: true }],
    ]);
    const ranked = rankByVisibility(entries, layer);
    expect(ranked[0].user.id).toBe('lit');
    // the genuine score is untouched
    expect(ranked[0].match.score).toBe(80);
  });
});
