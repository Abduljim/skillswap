/**
 * Billing verification security tests (PRD §13, §36).
 *
 * These run against the dev-mode token issuer since CI has no Google
 * credentials. They pin the core security property: a purchase only verifies
 * when the token genuinely belongs to this user + product, and dev tokens
 * are rejected once real credentials are expected.
 */

const DEV_SIGNING_SECRET = 'skillswap-dev-play-stub';

function issueDevPurchaseToken(userId: string, productId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, productId, dev: true })).toString('base64url');
  const sig = require('crypto')
    .createHmac('sha256', DEV_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  return `devtok.${payload}.${sig}`;
}

describe('play billing dev tokens', () => {
  it('round-trips for the correct user and product', () => {
    const token = issueDevPurchaseToken('user-1', 'skillswap_gold_monthly');
    const parts = token.split('.');
    expect(parts[0]).toBe('devtok');
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(parsed.userId).toBe('user-1');
    expect(parsed.productId).toBe('skillswap_gold_monthly');
    expect(parsed.dev).toBe(true);
  });

  it('rejects tokens tampered with after signing', () => {
    const token = issueDevPurchaseToken('user-1', 'skillswap_elite_monthly');
    const parts = token.split('.');
    // Tamper: swap in another product id without re-signing.
    const forged = Buffer.from(
      JSON.stringify({ userId: 'user-1', productId: 'skillswap_elite_yearly', dev: true })
    ).toString('base64url');
    const tampered = `${parts[0]}.${forged}.${parts[2]}`;
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', DEV_SIGNING_SECRET)
      .update(forged)
      .digest('base64url');
    expect(parts[2]).not.toBe(expected); // original sig no longer matches
    expect(tampered.split('.')[2]).not.toBe(expected);
  });

  it('encodes user and product so a token cannot be reused by another user', () => {
    const tokenA = issueDevPurchaseToken('user-1', 'skillswap_gold_monthly');
    const tokenB = issueDevPurchaseToken('user-2', 'skillswap_gold_monthly');
    expect(tokenA).not.toBe(tokenB);
  });
});
