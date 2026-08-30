import { prisma } from '../lib/prisma';

/**
 * Product analytics events (PRD §28). No unnecessary personal information —
 * payloads are small, structured, and never contain message content.
 */
export type EventName =
  | 'signup_completed'
  | 'onboarding_completed'
  | 'skill_added'
  | 'match_viewed'
  | 'match_request_sent'
  | 'exchange_started'
  | 'exchange_completed'
  | 'subscription_viewed'
  | 'gold_purchase_started'
  | 'gold_purchase_completed'
  | 'elite_purchase_started'
  | 'elite_purchase_completed'
  | 'subscription_cancelled'
  | 'boost_purchase_started'
  | 'boost_purchase_completed'
  | 'spotlight_activated';

export async function trackEvent(userId: string | null, name: EventName, data?: unknown) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId,
        name,
        data: (data ?? undefined) as never,
      },
    });
  } catch {
    // Analytics must never break the request path.
  }
}
