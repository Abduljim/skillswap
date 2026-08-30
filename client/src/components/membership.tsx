import type { ReactNode } from 'react';

/**
 * Membership identity components (PRD §6, §30).
 *
 * FREE: clean + neutral. GOLD: warm gold, restrained. ELITE: deep ink with a
 * refined violet/iridescent accent. Paid badges never obscure the user's
 * actual identity, and all motion respects prefers-reduced-motion.
 */

export type Tier = 'FREE' | 'GOLD' | 'ELITE';

export function MembershipBadge({ tier, size = 'md' }: { tier: Tier; size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]';
  if (tier === 'GOLD') {
    return (
      <span
        className={`${pad} inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-300 text-amber-700 font-bold tracking-wider`}
        title="Gold Skill Partner"
      >
        ✦ GOLD
      </span>
    );
  }
  if (tier === 'ELITE') {
    return (
      <span
        className={`${pad} inline-flex items-center gap-1 rounded-full bg-ink-900 border border-violet-400/60 text-violet-200 font-bold tracking-wider`}
        title="Elite Skill Partner"
      >
        ◈ ELITE
      </span>
    );
  }
  return null; // Free is the neutral default — no badge clutter.
}

/** Wraps an avatar with the tier's frame treatment. */
export function MembershipFrame({
  tier,
  children,
}: {
  tier: Tier;
  children: ReactNode;
}) {
  if (tier === 'GOLD') {
    return (
      <div className="rounded-[1.15rem] p-[2.5px] bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-400 shadow-soft-gold">
        {children}
      </div>
    );
  }
  if (tier === 'ELITE') {
    return (
      <div className="rounded-[1.15rem] p-[2.5px] bg-gradient-to-br from-violet-500 via-indigo-400 to-ink-900 shadow-soft-elite elite-shimmer">
        {children}
      </div>
    );
  }
  return <>{children}</>;
}

/** Small tag marking a perk as premium. */
export function PremiumFeatureBadge({ required = 'GOLD' }: { required?: 'GOLD' | 'ELITE' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${
        required === 'ELITE'
          ? 'bg-ink-900 text-violet-200 border border-violet-400/60'
          : 'bg-amber-50 text-amber-700 border border-amber-300'
      }`}
    >
      {required === 'ELITE' ? '◈ ELITE' : '✦ GOLD'}
    </span>
  );
}

/** Clearly-labeled SPOTLIGHT tag for premium discovery placement (PRD §23). */
export function SpotlightTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider bg-gradient-to-r from-ink-900 to-ink-800 text-amber-200 border border-amber-400/40">
      SPOTLIGHT
    </span>
  );
}

/** Boosted tag — visible placement signal, never on the compatibility score. */
export function BoostedTag() {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider bg-coral-50 text-coral-500 border border-coral-200">
      BOOSTED
    </span>
  );
}

/** The % match shown on cards is always the GENUINE compatibility score. */
export function GenuineMatchNote() {
  return (
    <p className="text-[10px] text-ink-300">
      Match % reflects genuine skill compatibility. Spotlight & boost affect
      visibility only.
    </p>
  );
}
