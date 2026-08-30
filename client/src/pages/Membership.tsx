import { useEffect, useState } from 'react';
import { api, BillingCatalog, Tier, EntitlementInfo } from '../api';
import { useAuth } from '../auth';
import { isPlayBillingAvailable, purchaseSubscription, purchaseBoost, openSubscriptionManagement } from '../billing';
import { MembershipFrame } from '../components/membership';

/**
 * Subscription screen (PRD §16–17, §34).
 * Headline, three tiers, honest comparison, contextual upgrades.
 * No fake scarcity, no countdowns, easy cancellation.
 */

interface CatalogState {
  catalog: BillingCatalog | null;
  error: string | null;
  purchasing: string | null;
}

const COMPARISON_ROWS: Array<{ label: string; free: string; gold: string; elite: string }> = [
  { label: 'Create profile & add skills', free: '✓', gold: '✓', elite: '✓' },
  { label: 'Discover matches', free: '✓', gold: '✓', elite: '✓' },
  { label: 'Exchange requests', free: '5 / month', gold: 'Unlimited', elite: 'Unlimited' },
  { label: 'Expanded match unlocks', free: '10 / month', gold: 'Unlimited', elite: 'Unlimited' },
  { label: 'Saved matches', free: '10 / month', gold: 'Unlimited', elite: 'Unlimited' },
  { label: 'Messaging & sessions', free: '✓', gold: '✓', elite: '✓' },
  { label: 'Reviews & reputation', free: '✓', gold: '✓', elite: '✓' },
  { label: 'Advanced discovery filters', free: '—', gold: '✓', elite: '✓' },
  { label: 'Discovery priority', free: 'Standard', gold: 'Higher', elite: 'Highest' },
  { label: 'Profile badge & accent', free: '—', gold: '✦ Gold', elite: '◈ Elite' },
  { label: 'Profile analytics', free: '—', gold: '✓', elite: '✓' },
  { label: '"People looking for your skills"', free: '—', gold: '—', elite: '✓' },
  { label: 'Profile spotlight credits', free: '—', gold: '—', elite: '2 / month' },
  { label: 'Priority support', free: '—', gold: '—', elite: '✓' },
  { label: 'Early features', free: '—', gold: '—', elite: '✓' },
];

export default function Membership() {
  const { me, refresh } = useAuth();
  const [state, setState] = useState<CatalogState>({ catalog: null, error: null, purchasing: null });
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BillingCatalog>('/billing/catalog')
      .then((catalog) => setState((s) => ({ ...s, catalog })))
      .catch(() => setState((s) => ({ ...s, error: 'Could not load plans.' })));
  }, []);

  const currentTier: Tier = me?.entitlement?.tier ?? me?.tier ?? 'FREE';

  async function onSubscribe(planBillingPeriod: 'MONTHLY' | 'YEARLY', tier: 'GOLD' | 'ELITE') {
    const { catalog } = state;
    if (!catalog) return;
    const plan = catalog.plans.find((p) => p.tier === tier && p.billingPeriod === planBillingPeriod);
    if (!plan) return;
    setState((s) => ({ ...s, error: null, purchasing: plan.googleProductId }));

    try {
      if (!isPlayBillingAvailable()) {
        setNote(
          'Subscriptions are purchased inside the Android app via Google Play. Your web account carries over.'
        );
        return;
      }
      const purchase = await purchaseSubscription(plan.googleProductId);
      await api.post('/billing/subscriptions', {
        productId: plan.googleProductId,
        purchaseToken: purchase.purchaseToken,
        basePlanId: purchase.basePlanId ?? null,
      });
      await refresh();
      setNote(`You're now on ${tier === 'GOLD' ? 'Gold' : 'Elite'}. Welcome aboard!`);
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Purchase failed.' }));
    } finally {
      setState((s) => ({ ...s, purchasing: null }));
    }
  }

  async function onBuyBoost(googleProductId: string) {
    setState((s) => ({ ...s, error: null, purchasing: googleProductId }));
    try {
      if (!isPlayBillingAvailable()) {
        setNote('Boosts are purchased inside the Android app via Google Play.');
        return;
      }
      const purchase = await purchaseBoost(googleProductId);
      await api.post('/billing/boosts', {
        productId: googleProductId,
        purchaseToken: purchase.purchaseToken,
      });
      await refresh();
      setNote('Boost activated!');
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Purchase failed.' }));
    } finally {
      setState((s) => ({ ...s, purchasing: null }));
    }
  }

  const { catalog } = state;
  const goldMonthly = catalog?.plans.find((p) => p.tier === 'GOLD' && p.billingPeriod === 'MONTHLY');
  const goldYearly = catalog?.plans.find((p) => p.tier === 'GOLD' && p.billingPeriod === 'YEARLY');
  const eliteMonthly = catalog?.plans.find((p) => p.tier === 'ELITE' && p.billingPeriod === 'MONTHLY');
  const eliteYearly = catalog?.plans.find((p) => p.tier === 'ELITE' && p.billingPeriod === 'YEARLY');

  return (
    <div className="animate-fade-up max-w-5xl mx-auto">
      <header className="text-center mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
          Your skills are worth more when people can find them.
        </h1>
        <p className="text-ink-400 text-sm md:text-base">
          Choose the level of discovery and visibility that fits you.
        </p>
      </header>

      {state.error && (
        <div role="alert" className="card p-4 mb-6 border-coral-200 bg-coral-50 text-coral-600 text-sm">
          {state.error}
        </div>
      )}
      {note && (
        <div role="status" className="card p-4 mb-6 border-mint-200 bg-mint-50 text-mint-600 text-sm">
          {note}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {/* FREE */}
        <div className="card p-6 flex flex-col">
          <p className="text-xs font-bold tracking-wider text-ink-400 mb-1">FREE</p>
          <p className="font-display text-xl font-bold mb-1">Start swapping.</p>
          <p className="text-xs text-ink-400 mb-5">Everything you need to start exchanging skills.</p>
          <p className="font-display text-2xl font-bold mb-1">₦0</p>
          <p className="text-xs text-ink-300 mb-6">forever</p>
          {currentTier === 'FREE' ? (
            <button className="btn-outline w-full mt-auto" disabled>
              Your current plan
            </button>
          ) : (
            <button className="btn-ghost text-xs mt-auto w-full" onClick={() => openSubscriptionManagement()}>
              Manage Subscription
            </button>
          )}
        </div>

        {/* GOLD */}
        <div className="card-gold p-6 flex flex-col relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-500 text-ink-900 text-[10px] font-bold tracking-wider rounded-full px-3 py-1">
            MOST POPULAR
          </span>
          <p className="text-xs font-bold tracking-wider text-amber-600 mb-1">✦ GOLD</p>
          <p className="font-display text-xl font-bold mb-1">Get discovered.</p>
          <p className="text-xs text-ink-400 mb-5">Unlimited requests, advanced filters, analytics.</p>
          <div className="mb-6">
            <p className="font-display text-2xl font-bold">{goldMonthly?.displayPrice ?? '₦1,500'}</p>
            <p className="text-xs text-ink-300">per month</p>
            {goldYearly && <p className="text-xs text-amber-600 mt-1">or {goldYearly.displayPrice}/year</p>}
          </div>
          {currentTier === 'GOLD' ? (
            <button className="btn-outline w-full mt-auto" disabled>
              Your current plan
            </button>
          ) : currentTier === 'FREE' ? (
            <div className="mt-auto space-y-2">
              <button
                className="btn-gold w-full"
                disabled={state.purchasing !== null}
                onClick={() => onSubscribe('MONTHLY', 'GOLD')}
              >
                {state.purchasing === goldMonthly?.googleProductId ? 'Opening Google Play…' : 'View Gold (monthly)'}
              </button>
              <button
                className="btn-outline w-full text-xs"
                disabled={state.purchasing !== null}
                onClick={() => onSubscribe('YEARLY', 'GOLD')}
              >
                Go yearly and save
              </button>
            </div>
          ) : (
            <button
              className="btn-outline w-full mt-auto text-xs"
              onClick={() => openSubscriptionManagement()}
            >
              Manage Subscription
            </button>
          )}
        </div>

        {/* ELITE */}
        <div className="card-elite p-6 flex flex-col relative">
          <p className="text-xs font-bold tracking-wider text-violet-300 mb-1">◈ ELITE</p>
          <p className="font-display text-xl font-bold mb-1">Become a top skill partner.</p>
          <p className="text-xs text-ink-200/70 mb-5">Highest priority, demand insights, spotlight.</p>
          <div className="mb-6">
            <p className="font-display text-2xl font-bold">{eliteMonthly?.displayPrice ?? '₦3,500'}</p>
            <p className="text-xs text-ink-200/50">per month</p>
            {eliteYearly && <p className="text-xs text-violet-300 mt-1">or {eliteYearly.displayPrice}/year</p>}
          </div>
          {currentTier === 'ELITE' ? (
            <button className="btn-outline w-full mt-auto" disabled>
              Your current plan
            </button>
          ) : (
            <div className="mt-auto space-y-2">
              <button
                className="btn-elite w-full"
                disabled={state.purchasing !== null}
                onClick={() => onSubscribe('MONTHLY', 'ELITE')}
              >
                {state.purchasing === eliteMonthly?.googleProductId ? 'Opening Google Play…' : 'View Elite (monthly)'}
              </button>
              <button
                className="btn-outline w-full text-xs !border-violet-400/40 !bg-transparent !text-violet-200"
                disabled={state.purchasing !== null}
                onClick={() => onSubscribe('YEARLY', 'ELITE')}
              >
                Go yearly and save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comparison (PRD §17) */}
      <section className="card p-6 md:p-8 mb-10" aria-label="Plan comparison">
        <h2 className="font-display text-xl font-bold mb-5">Compare plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-300">
                <th className="py-2 pr-4 font-semibold">Feature</th>
                <th className="py-2 px-3 font-semibold">Free</th>
                <th className="py-2 px-3 font-semibold text-amber-600">✦ Gold</th>
                <th className="py-2 px-3 font-semibold text-violet-500">◈ Elite</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-ink-100">
                  <td className="py-2.5 pr-4 text-ink-600">{row.label}</td>
                  <td className="py-2.5 px-3 text-ink-500">{row.free}</td>
                  <td className="py-2.5 px-3 font-medium text-amber-700">{row.gold}</td>
                  <td className="py-2.5 px-3 font-medium text-violet-600">{row.elite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-ink-300 mt-4">
          Match percentages always reflect genuine skill compatibility — paid plans never
          change your score. Existing exchanges and conversations always stay available.
        </p>
      </section>

      {/* Boosts (PRD §9) */}
      {catalog && catalog.flags.boostsEnabled && catalog.boosts.length > 0 && (
        <section aria-label="Boosts" className="mb-10">
          <h2 className="font-display text-xl font-bold mb-4">Boost your visibility</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {catalog.boosts.map((boost) => (
              <div key={boost.id} className="card p-5 flex flex-col">
                <p className="font-semibold mb-1">{boost.name}</p>
                <p className="text-xs text-ink-400 mb-3 flex-1">{boost.description}</p>
                <p className="text-xs text-ink-300 mb-3">
                  {boost.durationHours >= 24 ? `${boost.durationHours / 24} day${boost.durationHours > 24 ? 's' : ''}` : `${boost.durationHours} hours`}
                </p>
                <p className="font-display text-lg font-bold mb-3">₦{(boost.price / 100).toLocaleString()}</p>
                <button
                  className="btn-outline text-xs"
                  disabled={state.purchasing !== null}
                  onClick={() => onBuyBoost(boost.googleProductId)}
                >
                  {state.purchasing === boost.googleProductId ? 'Opening Google Play…' : 'Boost me'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Referral (PRD §25) */}
      {catalog?.flags.referralsEnabled && (
        <section className="card p-6 mb-10" aria-label="Invite friends">
          <h2 className="font-display text-lg font-bold mb-2">Invite a friend</h2>
          <p className="text-sm text-ink-400 mb-4">
            You both receive a free Match Boost when they finish setting up their profile.
          </p>
          <ReferralWidget />
        </section>
      )}

      <p className="text-center text-xs text-ink-300 mb-6">
        Cancel anytime from Google Play — no dark patterns, no phone calls, no retention games.
      </p>
    </div>
  );
}

function ReferralWidget() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api
      .get<{ enabled: boolean; referralCode?: string }>('/referrals')
      .then((d) => setCode(d.referralCode ?? null))
      .catch(() => setCode(null));
  }, []);
  if (!code) return <p className="text-xs text-ink-300">Referrals loading…</p>;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <code className="chip bg-ink-100 text-ink-700 font-mono">{code}</code>
      <button
        className="btn-outline text-xs"
        onClick={async () => {
          const url = `${window.location.origin}/signup?ref=${code}`;
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied!' : 'Copy invite link'}
      </button>
    </div>
  );
}
