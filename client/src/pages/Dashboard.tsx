import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, MatchEntry } from '../api';
import { useAuth } from '../auth';
import { Avatar, ScoreBadge, SkillChip, EmptyState, SkeletonCard } from '../components/ui';
import { connectSocket } from '../socket';

interface ExchangeSummary {
  id: string;
  status: string;
  skillYouTeach: string;
  skillYouLearn: string;
  partner: { id: string; displayName: string };
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { me } = useAuth();
  const [matches, setMatches] = useState<MatchEntry[] | null>(null);
  const [exchanges, setExchanges] = useState<ExchangeSummary[] | null>(null);

  useEffect(() => {
    connectSocket().catch(() => {});
    api.get<{ matches: MatchEntry[] }>('/matches').then((d) => setMatches(d.matches.slice(0, 6))).catch(() => setMatches([]));
    api.get<{ exchanges: ExchangeSummary[] }>('/exchanges').then((d) => setExchanges(d.exchanges.filter((e) => e.status === 'ACTIVE'))).catch(() => setExchanges([]));
  }, []);

  if (!me) return null;
  const best = matches?.[0];

  return (
    <div className="space-y-10 animate-fade-up">
      <section>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          {greeting()}, {me.displayName.split(' ')[0]}
        </h1>
        <p className="text-ink-400 mt-1">
          {matches === null
            ? 'Finding your matches…'
            : matches.length > 0
              ? `You have ${matches.length} potential skill exchange${matches.length === 1 ? '' : 's'} waiting.`
              : 'Your skill circle is still forming — add a skill to discover more people.'}
        </p>
      </section>

      {best && (
        <section>
          <h2 className="label">Your strongest match</h2>
          <Link to={`/matches/${best.user.id}`} className="card block p-6 md:p-8 hover:shadow-lift hover:-translate-y-0.5 transition-all">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={best.user.displayName} color={best.user.avatarColor} size="lg" />
                <div>
                  <h3 className="font-display text-2xl font-bold">{best.user.displayName}</h3>
                  <p className="text-sm text-ink-400">{best.user.university || 'SkillSwap member'}</p>
                  <p className="text-sm mt-2 text-ink-500">
                    <span className="font-semibold text-mint-500">{best.user.displayName.split(' ')[0]}</span> can teach
                    you <span className="font-semibold">{best.match.theyTeach.join(', ')}</span> — you can teach{' '}
                    <span className="font-semibold text-lavender-500">{best.match.youTeach.join(', ')}</span>.
                  </p>
                </div>
              </div>
              <ScoreBadge score={best.match.score} category={best.match.category} />
            </div>
          </Link>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="label !mb-0">People who can teach you</h2>
          <Link to="/discover" className="text-xs font-semibold text-coral-600 hover:underline">
            See all
          </Link>
        </div>
        {matches === null ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <EmptyState
            title="Your skill circle is still forming."
            body="Add another skill you can teach or want to learn to discover more people."
            actionLabel="Add a Skill"
            actionTo="/skills"
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {matches.slice(1).map(({ user, match }) => (
              <Link
                key={user.id}
                to={`/matches/${user.id}`}
                className="card p-5 min-w-[260px] snap-start hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={user.displayName} color={user.avatarColor} />
                  <div>
                    <p className="font-semibold text-sm">{user.displayName}</p>
                    <ScoreBadge score={match.score} category={match.category} />
                  </div>
                </div>
                <p className="text-xs text-ink-400 mb-2">CAN TEACH</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {match.theyTeach.slice(0, 3).map((s) => (
                    <SkillChip key={s} name={s} type="TEACH" />
                  ))}
                </div>
                <p className="text-xs text-ink-400 mb-1">WANTS FROM YOU</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.youTeach.slice(0, 3).map((s) => (
                    <SkillChip key={s} name={s} type="WANT" />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="label !mb-0">Your active exchanges</h2>
          <Link to="/exchanges" className="text-xs font-semibold text-coral-600 hover:underline">
            See all
          </Link>
        </div>
        {exchanges === null ? (
          <SkeletonCard />
        ) : exchanges.length === 0 ? (
          <EmptyState
            title="Your first exchange is waiting."
            body="Find someone whose skills complement yours and send your first request."
            actionLabel="Find Someone"
            actionTo="/discover"
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {exchanges.map((e) => (
              <Link key={e.id} to={`/exchanges/${e.id}`} className="card p-5 hover:shadow-lift transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="chip bg-mint-100 text-mint-500">ACTIVE EXCHANGE</span>
                  <Avatar name={e.partner.displayName} size="sm" />
                </div>
                <p className="font-semibold">{e.partner.displayName}</p>
                <p className="text-sm text-ink-400 mt-1">
                  You teach <span className="text-lavender-500 font-medium">{e.skillYouTeach}</span> ↔ they teach{' '}
                  <span className="text-mint-500 font-medium">{e.skillYouLearn}</span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="label mb-3">Your learning activity</h2>
        <div className="card p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-display text-3xl font-bold text-coral-500">{me.skills?.filter((s) => s.type === 'TEACH').length ?? 0}</p>
              <p className="text-xs text-ink-400">skills you teach</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-lavender-500">{me.skills?.filter((s) => s.type === 'WANT').length ?? 0}</p>
              <p className="text-xs text-ink-400">skills you want</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-mint-500">{exchanges?.length ?? 0}</p>
              <p className="text-xs text-ink-400">active exchanges</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
