/**
 * SkillSwap deterministic matching engine.
 *
 * Pure, unit-testable, and fully explainable. No AI, no LLM — just rules:
 *   +50  user B teaches something user A wants to learn
 *   +30  user A teaches something user B wants to learn
 *   +10  same university
 *   +5   compatible availability (shared day AND day-part)
 *   +5   compatible learning format
 * Max score: 100.
 *
 * Match categories:
 *   80-100  Perfect Match
 *   60-79   Strong Match
 *   40-59   Potential Match
 *   <40     not recommended
 */

export const MIN_MATCH_SCORE = 40;

export interface SkillRef {
  id: string;
  name: string;
  type: 'TEACH' | 'WANT';
  level?: string;
}

export interface MatcherProfile {
  id: string;
  displayName: string;
  skills: SkillRef[];
  university?: string | null;
  days?: string[];
  dayParts?: string[];
  format?: 'ONLINE' | 'IN_PERSON' | 'EITHER';
}

export interface MatchBreakdown {
  reciprocalTeach: number;
  reverseTeach: number;
  sameUniversity: number;
  availability: number;
  format: number;
}

export interface MatchExplanation {
  /** Names of skills they teach that you want. */
  youWantTheyTeach: string[];
  /** Names of skills you teach that they want. */
  theyWantYouTeach: string[];
  sameUniversity: boolean;
  sharedDays: string[];
  sharedDayParts: string[];
  formatCompatible: boolean;
}

export interface MatchResult {
  score: number;
  breakdown: MatchBreakdown;
  explanation: MatchExplanation;
  category: 'PERFECT' | 'STRONG' | 'POTENTIAL' | 'LOW';
  /** Concrete exchange proposal: you teach these, they teach those. */
  youTeach: string[];
  theyTeach: string[];
}

function byType(user: MatcherProfile, type: 'TEACH' | 'WANT'): SkillRef[] {
  return user.skills.filter((s) => s.type === type);
}

export function calculateMatchScore(userA: MatcherProfile, userB: MatcherProfile): MatchResult {
  const aTeaches = byType(userA, 'TEACH');
  const aWants = byType(userA, 'WANT');
  const bTeaches = byType(userB, 'TEACH');
  const bWants = byType(userB, 'WANT');

  const bTeachNames = new Set(bTeaches.map((s) => s.name));
  const aTeachNames = new Set(aTeaches.map((s) => s.name));

  // They teach what you want (50)
  const youWantTheyTeach = aWants.filter((s) => bTeachNames.has(s.name)).map((s) => s.name);
  // You teach what they want (30)
  const theyWantYouTeach = bWants.filter((s) => aTeachNames.has(s.name)).map((s) => s.name);

  const reciprocalTeach = youWantTheyTeach.length > 0 ? 50 : 0;
  const reverseTeach = theyWantYouTeach.length > 0 ? 30 : 0;

  const sameUniversity =
    !!userA.university && !!userB.university && userA.university === userB.university;
  const universityPoints = sameUniversity ? 10 : 0;

  const daysA = new Set(userA.days || []);
  const daysB = new Set(userB.days || []);
  const partsA = new Set(userA.dayParts || []);
  const partsB = new Set(userB.dayParts || []);
  const sharedDays = [...daysA].filter((d) => daysB.has(d));
  const sharedDayParts = [...partsA].filter((p) => partsB.has(p));
  const availabilityPoints =
    sharedDays.length > 0 && sharedDayParts.length > 0 ? 5 : 0;

  const formatCompatible =
    !userA.format ||
    !userB.format ||
    userA.format === 'EITHER' ||
    userB.format === 'EITHER' ||
    userA.format === userB.format;
  const formatPoints = formatCompatible ? 5 : 0;

  const score = reciprocalTeach + reverseTeach + universityPoints + availabilityPoints + formatPoints;

  const category =
    score >= 80 ? 'PERFECT' : score >= 60 ? 'STRONG' : score >= 40 ? 'POTENTIAL' : 'LOW';

  return {
    score,
    breakdown: {
      reciprocalTeach,
      reverseTeach,
      sameUniversity: universityPoints,
      availability: availabilityPoints,
      format: formatPoints,
    },
    explanation: {
      youWantTheyTeach,
      theyWantYouTeach,
      sameUniversity,
      sharedDays,
      sharedDayParts,
      formatCompatible,
    },
    category,
    // Exchange proposal: they teach what you want; you teach what they want.
    youTeach: theyWantYouTeach,
    theyTeach: youWantTheyTeach,
  };
}

/** Only recommend matches above the minimum threshold. */
export function isRecommended(match: MatchResult): boolean {
  return match.score >= MIN_MATCH_SCORE;
}

export function rankMatches(matches: MatchResult[]): MatchResult[] {
  return [...matches].sort((a, b) => b.score - a.score);
}
