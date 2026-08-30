import { Request, Response, NextFunction } from 'express';
import { getEntitlement, Tier } from '../services/entitlements';
import type { Entitlement } from '../services/entitlements';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      entitlement?: Entitlement;
    }
  }
}

async function attachEntitlement(req: Request, res: Response, next: NextFunction) {
  try {
    req.entitlement = await getEntitlement(req.user!.id);
    next();
  } catch (err) {
    next(err);
  }
}

/** Requires at least the given tier. Use after requireAuth. */
export function requireTier(min: Tier) {
  const rank: Record<Tier, number> = { FREE: 0, GOLD: 1, ELITE: 2 };
  return (req: Request, res: Response, next: NextFunction) => {
    attachEntitlement(req, res, () => {
      const tier = req.entitlement!.tier;
      if (rank[tier] < rank[min]) {
        return res.status(403).json({
          error: `This feature requires ${min === 'ELITE' ? 'Elite' : 'Gold'}`,
          code: 'TIER_REQUIRED',
          requiredTier: min,
          currentTier: tier,
        });
      }
      next();
    });
  };
}

/** Requires any paid tier (Gold or Elite). Use after requireAuth. */
export function requireAnyPremium() {
  return (req: Request, res: Response, next: NextFunction) => {
    attachEntitlement(req, res, () => {
      if (!req.entitlement!.gold) {
        return res.status(403).json({
          error: 'This feature requires a premium plan',
          code: 'TIER_REQUIRED',
          requiredTier: 'GOLD',
          currentTier: req.entitlement!.tier,
        });
      }
      next();
    });
  };
}

/** Loads entitlements without gating (for optional premium behaviour). */
export function withEntitlement(req: Request, res: Response, next: NextFunction) {
  attachEntitlement(req, res, next);
}
