/**
 * Google Play purchase verification (PRD §13).
 *
 * The backend is the only authority on entitlements. A frontend claim of
 * "I paid for Gold" is meaningless — every purchase token must be verified
 * against Google Play before any entitlement is granted.
 *
 * Uses the Google Play Developer API v1 REST endpoints with a service
 * account (GOOGLE_SERVICE_ACCOUNT_JSON) that has been granted "View app
 * information and download bulk reports" permissions in Play Console.
 *
 * When credentials are not configured (local dev), the service falls back to
 * a signed-token dev mode so the flow is testable end-to-end without Google.
 * Dev mode is DISABLED in production: NODE_ENV=production requires real
 * credentials or verification always fails closed.
 */

import { google } from 'googleapis';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';

export interface VerifiedSubscriptionPurchase {
  ok: boolean;
  productId: string | null;
  purchaseToken: string | null;
  expiryTimeMillis: string | null;
  autoRenewing: boolean;
  paymentState: number | null;
  linkedPurchaseToken?: string | null;
  reason?: string;
}

export interface VerifiedProductPurchase {
  ok: boolean;
  productId: string | null;
  purchaseToken: string | null;
  purchaseState: number | null;
  acknowledgementState: number | null;
  orderId: string | null;
  reason?: string;
}

function getServiceAccountCredentials(): { email: string; key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { client_email: string; private_key: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return { email: parsed.client_email, key: parsed.private_key };
  } catch {
    return null;
  }
}

let cachedAuth: { package: string; client: ReturnType<typeof getPlayClient> } | null = null;

function getPlayClient() {
  const creds = getServiceAccountCredentials();
  if (!creds) return null;
  const auth = new google.auth.JWT({
    email: creds.email,
    key: creds.key,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  return google.androidpublisher({ version: 'v3', auth });
}

function packageName(): string {
  return process.env.ANDROID_PACKAGE_NAME || 'app.skillswap.mobile';
}

function isDevMode(): boolean {
  return !getServiceAccountCredentials() && env.nodeEnv !== 'production';
}

async function recordPurchase(
  userId: string,
  kind: 'subscription' | 'boost',
  productId: string,
  purchaseToken: string,
  purchaseState: string,
  extra: {
    acknowledged?: boolean;
    orderId?: string | null;
    rawPayload?: unknown;
  } = {}
) {
  await prisma.purchaseRecord.upsert({
    where: { purchaseToken },
    create: {
      userId,
      kind,
      googleProductId: productId,
      purchaseToken,
      purchaseState,
      acknowledged: extra.acknowledged ?? false,
      orderId: extra.orderId ?? null,
      rawPayload: (extra.rawPayload ?? undefined) as never,
    },
    update: {
      purchaseState,
      acknowledged: extra.acknowledged ?? false,
      orderId: extra.orderId ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Dev mode: deterministic signed stub so the full flow is testable locally.
// ---------------------------------------------------------------------------

import crypto from 'crypto';

const DEV_SIGNING_SECRET = 'skillswap-dev-play-stub';

export function issueDevPurchaseToken(userId: string, productId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, productId, dev: true })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', DEV_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  return `devtok.${payload}.${sig}`;
}

function readDevPurchaseToken(token: string): { userId: string; productId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'devtok') return null;
  const [payload, sig] = [parts[1], parts[2]];
  const expected = crypto
    .createHmac('sha256', DEV_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      userId: string;
      productId: string;
      dev?: boolean;
    };
    if (!parsed.dev) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Subscription verification (purchases.subscriptionsv2)
// ---------------------------------------------------------------------------

export async function verifySubscriptionPurchase(
  userId: string,
  productId: string,
  purchaseToken: string
): Promise<VerifiedSubscriptionPurchase> {
  if (isDevMode()) {
    const dev = readDevPurchaseToken(purchaseToken);
    if (!dev || dev.userId !== userId || dev.productId !== productId) {
      return { ok: false, productId: null, purchaseToken: null, expiryTimeMillis: null, autoRenewing: false, paymentState: null, reason: 'invalid dev token' };
    }
    const expiry = Date.now() + 30 * 24 * 3600 * 1000;
    await recordPurchase(userId, 'subscription', productId, purchaseToken, 'PURCHASED', {
      acknowledged: true,
      rawPayload: { dev: true, expiry },
    });
    return {
      ok: true,
      productId,
      purchaseToken,
      expiryTimeMillis: String(expiry),
      autoRenewing: true,
      paymentState: 1,
    };
  }

  const client = getPlayClient();
  if (!client) {
    return { ok: false, productId: null, purchaseToken: null, expiryTimeMillis: null, autoRenewing: false, paymentState: null, reason: 'billing credentials not configured' };
  }
  try {
    const res = await client.purchases.subscriptionsv2.get({
      packageName: packageName(),
      token: purchaseToken,
    });
    const sub = res.data;
    const active = sub.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
      sub.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
    const lineItem = sub.lineItems?.[0];
    const expiry = lineItem?.expiryTime ?? null;
    const pending = sub.subscriptionState === 'SUBSCRIPTION_STATE_PENDING';
    if (!active && !pending) {
      await recordPurchase(userId, 'subscription', productId, purchaseToken, sub.subscriptionState ?? 'UNKNOWN', { rawPayload: sub as object });
      return { ok: false, productId, purchaseToken, expiryTimeMillis: null, autoRenewing: false, paymentState: null, reason: `subscription state ${sub.subscriptionState}` };
    }
    await recordPurchase(userId, 'subscription', productId, purchaseToken, sub.subscriptionState ?? 'UNKNOWN', {
      rawPayload: sub as object,
    });
    return {
      ok: true,
      productId,
      purchaseToken,
      expiryTimeMillis: expiry,
      autoRenewing: true,
      paymentState: 1,
      linkedPurchaseToken: sub.linkedPurchaseToken,
    };
  } catch (err) {
    return { ok: false, productId: null, purchaseToken: null, expiryTimeMillis: null, autoRenewing: false, paymentState: null, reason: String(err) };
  }
}

// ---------------------------------------------------------------------------
// One-time product (boost) verification (purchases.products.get)
// ---------------------------------------------------------------------------

export async function verifyProductPurchase(
  userId: string,
  productId: string,
  purchaseToken: string
): Promise<VerifiedProductPurchase> {
  if (isDevMode()) {
    const dev = readDevPurchaseToken(purchaseToken);
    if (!dev || dev.userId !== userId || dev.productId !== productId) {
      return { ok: false, productId: null, purchaseToken: null, purchaseState: null, acknowledgementState: null, orderId: null, reason: 'invalid dev token' };
    }
    await recordPurchase(userId, 'boost', productId, purchaseToken, 'PURCHASED', {
      acknowledged: true,
      rawPayload: { dev: true },
    });
    return { ok: true, productId, purchaseToken, purchaseState: 0, acknowledgementState: 1, orderId: null };
  }

  const client = getPlayClient();
  if (!client) {
    return { ok: false, productId: null, purchaseToken: null, purchaseState: null, acknowledgementState: null, orderId: null, reason: 'billing credentials not configured' };
  }
  try {
    const res = await client.purchases.products.get({
      packageName: packageName(),
      productId,
      token: purchaseToken,
    });
    const p = res.data;
    // purchaseState 0 = PURCHASED, 1 = CANCELED, 2 = PENDING
    if (p.purchaseState !== 0 && p.purchaseState !== undefined && p.purchaseState !== null) {
      await recordPurchase(userId, 'boost', productId, purchaseToken, String(p.purchaseState), { rawPayload: p as object });
      return { ok: false, productId, purchaseToken, purchaseState: p.purchaseState, acknowledgementState: p.acknowledgementState ?? null, orderId: p.orderId ?? null, reason: `purchase state ${p.purchaseState}` };
    }
    await recordPurchase(userId, 'boost', productId, purchaseToken, String(p.purchaseState ?? 0), {
      acknowledged: (p.acknowledgementState ?? 0) >= 1,
      orderId: p.orderId ?? null,
      rawPayload: p as object,
    });
    return {
      ok: true,
      productId,
      purchaseToken,
      purchaseState: p.purchaseState ?? 0,
      acknowledgementState: p.acknowledgementState ?? 0,
      orderId: p.orderId ?? null,
    };
  } catch (err) {
    return { ok: false, productId: null, purchaseToken: null, purchaseState: null, acknowledgementState: null, orderId: null, reason: String(err) };
  }
}

/** Issues a Play Billing dev-mode token (dev only — never in production). */
export function devIssueToken(userId: string, productId: string): string | null {
  if (!isDevMode()) return null;
  return issueDevPurchaseToken(userId, productId);
}

export function billingConfigured(): boolean {
  return getServiceAccountCredentials() !== null || isDevMode();
}
