export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error || 'Request failed', (data as { issues?: unknown }).issues);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface Profile {
  id: string;
  bio?: string | null;
  university?: string | null;
  department?: string | null;
  year?: string | null;
  avatarColor?: string;
  format?: 'ONLINE' | 'IN_PERSON' | 'EITHER';
  days?: string[];
  dayParts?: string[];
}

export interface UserSkill {
  id: string;
  type: 'TEACH' | 'WANT';
  level: string;
  skill: { id: string; name: string; category: string };
}

export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  profile?: Profile;
  skills?: UserSkill[];
  tier?: Tier;
  entitlement?: EntitlementInfo;
}

export interface MatchResult {
  score: number;
  category: 'PERFECT' | 'STRONG' | 'POTENTIAL' | 'LOW';
  youTeach: string[];
  theyTeach: string[];
  explanation: {
    youWantTheyTeach: string[];
    theyWantYouTeach: string[];
    sameUniversity: boolean;
    sharedDays: string[];
    sharedDayParts: string[];
    formatCompatible: boolean;
  };
  breakdown: Record<string, number>;
}

export interface MatchEntry {
  user: {
    id: string;
    displayName: string;
    university?: string | null;
    avatarColor?: string;
    skills: UserSkill[];
  };
  match: MatchResult;
  premium?: {
    visibilityBonus: number;
    boosted: boolean;
    spotlighted: boolean;
    tier: 'FREE' | 'GOLD' | 'ELITE';
  } | null;
}

// ---------------------------------------------------------------------------
// Monetization types
// ---------------------------------------------------------------------------

export type Tier = 'FREE' | 'GOLD' | 'ELITE';

export interface EntitlementInfo {
  tier: Tier;
  gold: boolean;
  elite: boolean;
  spotlightCredits: number;
  activeBoost: { type: string; expiresAt: string } | null;
  activeSpotlight: { expiresAt: string } | null;
  limits: Record<string, number | null>;
  usage: Record<string, number>;
  advancedFilters: boolean;
  profileAnalytics: boolean;
  demandAnalytics: boolean;
}

export interface Quota {
  usage: number;
  limit: number | null;
  remaining: number | null;
}

export interface BillingCatalog {
  plans: Array<{
    id: string;
    tier: Tier;
    billingPeriod: 'MONTHLY' | 'YEARLY';
    googleProductId: string;
    displayPrice: string;
  }>;
  boosts: Array<{
    id: string;
    name: string;
    description: string;
    type: 'MATCH_BOOST' | 'SPOTLIGHT' | 'WEEKLY_SPOTLIGHT';
    durationHours: number;
    price: number;
    googleProductId: string;
  }>;
  tiers: Record<
    Tier,
    { label: string; tagline: string; visibilityBonus: number }
  >;
  currentTier: Tier;
  flags: {
    goldEnabled: boolean;
    eliteEnabled: boolean;
    boostsEnabled: boolean;
    adsEnabled: boolean;
    referralsEnabled: boolean;
  };
}

export interface MatchesResponse {
  matches: MatchEntry[];
  totalFound: number;
  lockedCount: number;
  unlockQuota: Quota | null;
  requestQuota: Quota;
  filtersAvailable: boolean;
  tier: Tier;
}
