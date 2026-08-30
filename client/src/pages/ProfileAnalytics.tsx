import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { PremiumFeatureBadge } from '../components/membership';

/**
 * Profile analytics (PRD §21–22).
 * Gold: views, requests, exchanges, rating trend.
 * Elite: demand insights ("People looking for your skills"), trends, conversion.
 */

interface AnalyticsData {
  tier: 'FREE' | 'GOLD' | 'ELITE';
  gold: {
    totalViews: number;
    views30d: number;
    requestsReceived: number;
    requestsReceived30d: number;
    completedExchanges: number;
    averageRating: number | null;
    ratingTrend: Array<{ at: string; average: number }>;
    activeBoost: { type: string; expiresAt: string } | null;
  };
  elite?: {
    demand: Array<{
      skill: string;
      peopleWanting: number;
      strongMatches: number;
      nearUniversity: number;
      availableSoon: number;
    }>;
    weeklyViewsTrend: Array<{ weekStart: string; views: number }>;
    impressions7d: number;
    matchViews: number;
    requestConversionRate: number | null;
    requestAcceptanceRate: number | null;
    spotlightRunsThisMonth: number;
  };
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs text-ink-400 mt-1">{label}</p>
    </div>
  );
}

export default function ProfileAnalytics() {
  const { me } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api
      .get<AnalyticsData>('/analytics/profile')
      .then(setData)
      .catch(() => setDenied(true));
  }, []);

  if (denied) {
    return (
      <div className="max-w-xl mx-auto py-10 text-center animate-fade-up">
        <div className="card p-10">
          <p className="text-3xl mb-3" aria-hidden="true">✦</p>
          <h2 className="font-display text-xl font-bold mb-2">Profile analytics is a premium feature</h2>
          <p className="text-sm text-ink-400 mb-6">
            Gold shows who's viewing you and how your exchanges convert. Elite adds demand
            insights for everything you teach.
          </p>
          <Link to="/membership" className="btn-gold">View Gold</Link>
        </div>
      </div>
    );
  }

  if (!data || !me) return <div className="skeleton h-96" />;

  const maxWeekly = Math.max(1, ...data.elite?.weeklyViewsTrend.map((w) => w.views) ?? [1]);

  return (
    <div className="animate-fade-up max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            Analytics
            <PremiumFeatureBadge required={data.tier === 'ELITE' ? 'ELITE' : 'GOLD'} />
          </h1>
          <p className="text-sm text-ink-400">How your skills are being discovered.</p>
        </div>
        {data.gold.activeBoost && (
          <span className="chip bg-coral-50 text-coral-500 border border-coral-200">
            {data.gold.activeBoost.type.replace('_', ' ')} active
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatTile label="Profile views (all time)" value={data.gold.totalViews} />
        <StatTile label="Views last 30 days" value={data.gold.views30d} />
        <StatTile label="Requests received (30d)" value={data.gold.requestsReceived30d} />
        <StatTile label="Completed exchanges" value={data.gold.completedExchanges} />
      </div>

      {data.gold.ratingTrend.length > 0 && (
        <div className="card p-6 mb-8">
          <p className="label">Rating trend</p>
          <div className="flex items-end gap-1 h-24" role="img" aria-label={`Average rating ${data.gold.averageRating} out of 5`}>
            {data.gold.ratingTrend.map((r, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-coral-200 to-coral-400 rounded-t-lg"
                style={{ height: `${(r.average / 5) * 100}%` }}
                title={`${r.average}★`}
              />
            ))}
          </div>
          <p className="text-xs text-ink-400 mt-2">
            {data.gold.averageRating}★ average across {data.gold.ratingTrend.length} reviews
          </p>
        </div>
      )}

      {data.elite && (
        <>
          <section className="mb-8" aria-label="People looking for your skills">
            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              People looking for your skills
              <PremiumFeatureBadge required="ELITE" />
            </h2>
            <div className="space-y-3">
              {data.elite.demand.length === 0 && (
                <p className="text-sm text-ink-400">Add teaching skills to see demand.</p>
              )}
              {data.elite.demand.map((d) => (
                <div key={d.skill} className="card p-5">
                  <p className="font-semibold mb-2">{d.skill}</p>
                  <p className="text-2xl font-display font-bold text-violet-500">
                    {d.peopleWanting}
                    <span className="text-sm font-normal text-ink-400"> people currently want this</span>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3 text-xs text-ink-400">
                    <span className="chip bg-mint-50 text-mint-600">{d.strongMatches} strong potential matches</span>
                    {d.nearUniversity > 0 && (
                      <span className="chip bg-lavender-50 text-lavender-600">{d.nearUniversity} near your university</span>
                    )}
                    {d.availableSoon > 0 && (
                      <span className="chip bg-coral-50 text-coral-500">{d.availableSoon} available this weekend</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <StatTile label="Discovery impressions (7d)" value={data.elite.impressions7d} />
            <StatTile
              label="Request conversion"
              value={data.elite.requestConversionRate !== null ? `${data.elite.requestConversionRate}%` : '—'}
            />
            <StatTile
              label="Request acceptance"
              value={data.elite.requestAcceptanceRate !== null ? `${data.elite.requestAcceptanceRate}%` : '—'}
            />
          </div>

          <div className="card p-6 mb-8">
            <p className="label">Weekly views trend</p>
            <div className="flex items-end gap-2 h-24" role="img" aria-label="Weekly profile views for the last 8 weeks">
              {data.elite.weeklyViewsTrend.map((w) => (
                <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-violet-300 to-violet-500 rounded-t-lg"
                    style={{ height: `${(w.views / maxWeekly) * 100}%` }}
                  />
                  <span className="text-[9px] text-ink-300">{w.views}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
