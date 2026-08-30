import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Avatar, EmptyState, SkeletonCard } from '../components/ui';

interface ExchangeSummary {
  id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  skillYouTeach: string;
  skillYouLearn: string;
  partner: { id: string; displayName: string };
  nextSession?: { scheduledAt: string; title: string } | null;
  lastMessage?: { content: string; createdAt: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-mint-100 text-mint-500',
  COMPLETED: 'bg-lavender-100 text-lavender-500',
  CANCELLED: 'bg-ink-100 text-ink-400',
};

export default function Exchanges() {
  const [exchanges, setExchanges] = useState<ExchangeSummary[] | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  useEffect(() => {
    api.get<{ exchanges: ExchangeSummary[] }>('/exchanges').then((d) => setExchanges(d.exchanges)).catch(() => setExchanges([]));
  }, []);

  const list = (exchanges || []).filter((e) => filter === 'ALL' || e.status === filter);

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <h1 className="font-display text-3xl font-bold mb-4">Your Exchanges</h1>
      <div className="flex rounded-full bg-ink-100 p-1 mb-6 w-fit">
        {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filter === f ? 'bg-white shadow-soft' : 'text-ink-400'}`}
          >
            {f[0] + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {exchanges === null && <SkeletonCard />}
      {exchanges && exchanges.length === 0 && (
        <EmptyState
          title="Your first exchange is waiting."
          body="Find someone whose skills complement yours and send your first request."
          actionLabel="Find Someone"
          actionTo="/discover"
        />
      )}
      {exchanges && exchanges.length > 0 && list.length === 0 && (
        <p className="text-sm text-ink-400 text-center py-8">No {filter.toLowerCase()} exchanges.</p>
      )}

      <div className="space-y-4">
        {list.map((e) => (
          <Link key={e.id} to={`/exchanges/${e.id}`} className="card p-5 block hover:shadow-lift hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar name={e.partner.displayName} />
                <div>
                  <p className="font-semibold">{e.partner.displayName}</p>
                  <span className={`chip ${STATUS_STYLE[e.status]} mt-0.5`}>{e.status}</span>
                </div>
              </div>
              {e.nextSession && (
                <span className="chip bg-coral-100 text-coral-600 text-[10px]">
                  next: {new Date(e.nextSession.scheduledAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="text-sm text-ink-500">
              You teach <span className="text-lavender-500 font-medium">{e.skillYouTeach}</span>{' '}
              <span className="text-ink-300">↔</span>{' '}
              <span className="text-mint-500 font-medium">{e.skillYouLearn}</span>
            </p>
            {e.lastMessage && (
              <p className="text-xs text-ink-400 mt-2 truncate">
                “{e.lastMessage.content}”
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
