export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: unknown) {
    super(message);
  }
}

/**
 * API origin. On the web this is empty (same-origin + Vite proxy); inside the
 * Android app (Capacitor) it must point at the deployed server, configured at
 * build time via VITE_API_URL.
 */
export const API_BASE = (import.meta as unknown as { env?: { VITE_API_URL?: string } })
  .env?.VITE_API_URL || '';

const TOKEN_KEY = 'skillswap_token';

/** Persist the session token for native-app (Bearer) usage. */
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Is this failure a "server waking up" transient rather than a real error? */
function isTransient(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

async function fetchOnce(path: string, options: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${API_BASE}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    credentials: 'include',
    ...options,
  });
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  // Free-host cold starts return 502/503 or drop the connection for ~30-60s.
  // Retry automatically so wake-ups are invisible to the user.
  const MAX_ATTEMPTS = 4;
  let lastError: ApiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetchOnce(path, options, token);
    } catch {
      lastError = new ApiError(
        0,
        attempt < MAX_ATTEMPTS
          ? 'Waking up SkillSwap…'
          : 'Cannot reach SkillSwap right now. The server may be waking up — try again in about a minute.'
      );
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await new Promise((r) => setTimeout(r, attempt * 8000)); // 8s, 16s, 24s
      continue;
    }
    if (isTransient(res.status)) {
      lastError = new ApiError(res.status, 'Waking up SkillSwap…');
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await new Promise((r) => setTimeout(r, attempt * 8000));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        res.status,
        (data as { error?: string }).error || 'Request failed',
        (data as { issues?: unknown }).issues
      );
    }
    return data as T;
  }
  throw (
    lastError ??
    new ApiError(0, 'Cannot reach SkillSwap right now. The server may be waking up — try again in about a minute.')
  );
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
