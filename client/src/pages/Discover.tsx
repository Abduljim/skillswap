import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, MatchEntry, MatchesResponse, Quota } from '../api';
import { Avatar, ScoreBadge, SkillChip, EmptyState, SkeletonCard } from '../components/ui';
import { MembershipBadge, SpotlightTag, BoostedTag, GenuineMatchNote } from '../components/membership';
import { Paywall } from '../components/Paywall';
import { useAuth } from '../auth';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PARTS = ['Morning', 'Afternoon', 'Evening'];

export default function Discover() {
  const { me } = useAuth();
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [view, setView] = useState<'cards' | 'connections'>('cards');
  const [filter, setFilter] = useState('');

  // Gold/Elite advanced filters (PRD §19)
  const [advOpen, setAdvOpen] = useState(false);
  const [advUniversity, setAdvUniversity] = useState('');
  const [advFormat, setAdvFormat] = useState('');
  const [advDay, setAdvDay] = useState('');
  const [advDayPart, setAdvDayPart] = useState('');

  const advancedFilters = data?.filtersAvailable ?? false;

  function load() {
    const params = new URLSearchParams();
    if (advUniversity) params.set('university', advUniversity);
    if (advFormat) params.set('format', advFormat);
    if (advDay) params.set('day', advDay);
    if (advDayPart) params.set('dayPart', advDayPart);
    setData(null);
    api
      .get<MatchesResponse>(`/matches${params.size ? `?${params}` : ''}`)
      .then(setData)
      .catch(() =>
        setData({
          matches: [],
          totalFound: 0,
          lockedCount: 0,
          unlockQuota: null,
          requestQuota: { usage: 0, limit: null, remaining: null },
          filtersAvailable: false,
          tier: 'FREE',
        })
      );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advUniversity, advFormat, advDay, advDayPart]);

  const matches = data?.matches ?? null;

  const filtered = useMemo(() => {
    if (!matches) return [];
    const q = filter.toLowerCase();
    return matches.filter(
      ({ user, match }) =>
        !q ||
        user.displayName.toLowerCase().includes(q) ||
        match.theyTeach.some((s) => s.toLowerCase().includes(q)) ||
        match.youTeach.some((s) => s.toLowerCase().includes(q))
    );
  }, [matches, filter]);

  const unlockQuota = data?.unlockQuota ?? null;
  const requestQuota = data?.requestQuota ?? null;
  const lockedCount = data?.lockedCount ?? 0;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Discover</h1>
          <p className="text-sm text-ink-400">People whose skills fit yours.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="input max-w-[200px]"
            placeholder="Search skills or people…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter matches"
          />
          {advancedFilters && (
            <button
              className={`btn text-xs ${advOpen ? 'btn-dark' : 'btn-outline'}`}
              onClick={() => setAdvOpen(!advOpen)}
              aria-expanded={advOpen}
            >
              Filters
            </button>
          )}
          <div className="flex rounded-full bg-ink-100 p-1">
            <button
              onClick={() => setView('cards')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${view === 'cards' ? 'bg-white shadow-soft' : 'text-ink-400'}`}
            >
              Cards
            </button>
            <button
              onClick={() => setView('connections')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${view === 'connections' ? 'bg-white shadow-soft' : 'text-ink-400'}`}
            >
              Connections
            </button>
          </div>
        </div>
      </div>

      {/* Gold/Elite advanced filters */}
      {advancedFilters && advOpen && (
        <div className="card p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Advanced filters">
          <div>
            <label className="label" htmlFor="f-university">University</label>
            <input
              id="f-university"
              className="input !py-2 text-xs"
              placeholder="e.g. University of Lagos"
              value={advUniversity}
              onChange={(e) => setAdvUniversity(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="f-format">Format</label>
            <select
              id="f-format"
              className="input !py-2 text-xs"
              value={advFormat}
              onChange={(e) => setAdvFormat(e.target.value)}
            >
              <option value="">Any</option>
              <option value="ONLINE">Online</option>
              <option value="IN_PERSON">In person</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-day">Day</label>
            <select
              id="f-day"
              className="input !py-2 text-xs"
              value={advDay}
              onChange={(e) => setAdvDay(e.target.value)}
            >
              <option value="">Any</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-part">Time of day</label>
            <select
              id="f-part"
              className="input !py-2 text-xs"
              value={advDayPart}
              onChange={(e) => setAdvDayPart(e.target.value)}
            >
              <option value="">Any</option>
              {PARTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Free-tier quota context — informational, never blocking existing chats */}
      {unlockQuota?.limit !== null && unlockQuota && (
        <div className="flex items-center justify-between gap-3 mb-4 text-xs text-ink-400 flex-wrap">
          <span>
            {unlockQuota.remaining} of {unlockQuota.limit} expanded unlocks left this month
          </span>
          {lockedCount > 0 && (
            <span className="flex items-center gap-2">
              {lockedCount} more match{lockedCount === 1 ? '' : 'es'} waiting
              <Link to="/membership" className="chip bg-amber-50 text-amber-700 border border-amber-200 hover:scale-105 transition-transform">
                ✦ Unlock all with Gold
              </Link>
            </span>
          )}
        </div>
      )}

      {matches === null && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {matches && matches.length === 0 && (
        <EmptyState
          title="Your skill circle is still forming."
          body="Add another skill you can teach or want to learn to discover more people."
          actionLabel="Add a Skill"
          actionTo="/skills"
        />
      )}

      {matches && matches.length > 0 && view === 'cards' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ user, match, premium }) => (
            <Link
              key={user.id}
              to={`/matches/${user.id}`}
              className="card p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all flex flex-col relative"
            >
              {premium?.spotlighted && (
                <div className="absolute -top-2.5 left-4 z-10">
                  <SpotlightTag />
                </div>
              )}
              {premium?.boosted && (
                <div className={`absolute -top-2.5 ${premium?.spotlighted ? 'left-32' : 'left-4'} z-10`}>
                  <BoostedTag />
                </div>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={user.displayName} color={user.avatarColor} />
                  <div>
                    <p className="font-semibold flex items-center gap-1.5">
                      {user.displayName}
                      {premium?.tier && premium.tier !== 'FREE' && (
                        <MembershipBadge tier={premium.tier} size="sm" />
                      )}
                    </p>
                    <p className="text-xs text-ink-400">{user.university || 'SkillSwap member'}</p>
                  </div>
                </div>
                <ScoreBadge score={match.score} category={match.category} />
              </div>
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-300 mb-1.5">THEY TEACH</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.theyTeach.map((s) => (
                    <SkillChip key={s} name={s} type="TEACH" />
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-ink-300 mb-1.5">YOU TEACH</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.youTeach.map((s) => (
                    <SkillChip key={s} name={s} type="WANT" />
                  ))}
                </div>
              </div>
              <div className="mt-auto pt-3 border-t border-ink-100 text-xs text-ink-400">
                {match.explanation.sameUniversity && '🏛 Same university · '}
                {match.explanation.sharedDays.length > 0 && `🕐 ${match.explanation.sharedDays.length} shared day${match.explanation.sharedDays.length === 1 ? '' : 's'}`}
              </div>
            </Link>
          ))}
        </div>
      )}

      {matches && matches.length > 0 && view === 'connections' && (
        <ConnectionsView matches={filtered} />
      )}

      {matches && matches.length > 0 && (
        <div className="mt-8">
          <GenuineMatchNote />
        </div>
      )}
    </div>
  );
}

function ConnectionsView({ matches }: { matches: MatchEntry[] }) {
  return (
    <div className="card p-6 md:p-10">
      <div className="flex flex-col items-center">
        <div className="w-24 h-24 rounded-3xl bg-ink-900 text-cream-50 flex items-center justify-center font-display font-bold text-xl shadow-lift mb-2">
          YOU
        </div>
        <p className="text-xs text-ink-400 mb-6">your skills</p>

        <div className="w-px h-10 bg-gradient-to-b from-ink-300 to-transparent mb-6" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
          {matches.slice(0, 12).map(({ user, match, premium }) => (
            <Link
              key={user.id}
              to={`/matches/${user.id}`}
              className="rounded-2xl border border-ink-100 p-3 text-center hover:border-coral-300 hover:shadow-soft transition-all"
            >
              <Avatar name={user.displayName} color={user.avatarColor} size="sm" className="mx-auto mb-2" />
              <p className="text-xs font-semibold truncate flex items-center justify-center gap-1">
                {user.displayName}
                {premium?.tier && premium.tier !== 'FREE' && <MembershipBadge tier={premium.tier} size="sm" />}
              </p>
              <p className="text-[10px] text-ink-400 truncate">{match.theyTeach[0]}</p>
              <ScoreBadge score={match.score} category={match.category} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
