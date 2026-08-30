import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, EmptyState, SkeletonCard } from '../components/ui';

interface Req {
  id: string;
  message: string;
  skillOffered?: string | null;
  skillWanted?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  sender?: { id: string; displayName: string; profile?: { university?: string } | null };
  recipient?: { id: string; displayName: string; profile?: { university?: string } | null };
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-coral-100 text-coral-600',
  ACCEPTED: 'bg-mint-100 text-mint-500',
  REJECTED: 'bg-ink-100 text-ink-400',
  CANCELLED: 'bg-ink-100 text-ink-400',
};

export default function Requests() {
  const { me, refresh } = useAuth();
  const [incoming, setIncoming] = useState<Req[] | null>(null);
  const [outgoing, setOutgoing] = useState<Req[] | null>(null);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    api
      .get<{ incoming: Req[]; outgoing: Req[] }>('/exchange-requests')
      .then((d) => {
        setIncoming(d.incoming);
        setOutgoing(d.outgoing);
      })
      .catch(() => {
        setIncoming([]);
        setOutgoing([]);
      });
  };

  useEffect(load, []);

  const act = async (id: string, action: 'accept' | 'reject' | 'cancel') => {
    setBusyId(id);
    try {
      await api.post(`/exchange-requests/${id}/${action}`);
      if (action === 'accept') await refresh();
      load();
    } finally {
      setBusyId(null);
    }
  };

  if (!me) return null;
  const list = tab === 'incoming' ? incoming : outgoing;

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <h1 className="font-display text-3xl font-bold mb-4">Requests</h1>
      <div className="flex rounded-full bg-ink-100 p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('incoming')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab === 'incoming' ? 'bg-white shadow-soft' : 'text-ink-400'}`}
        >
          Received {incoming?.filter((r) => r.status === 'PENDING').length ? `(${incoming.filter((r) => r.status === 'PENDING').length})` : ''}
        </button>
        <button
          onClick={() => setTab('outgoing')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab === 'outgoing' ? 'bg-white shadow-soft' : 'text-ink-400'}`}
        >
          Sent
        </button>
      </div>

      {list === null && <SkeletonCard />}
      {list && list.length === 0 && (
        <EmptyState
          title={tab === 'incoming' ? 'No requests yet.' : "You haven't sent any requests."}
          body={
            tab === 'incoming'
              ? 'When someone wants to exchange skills with you, it shows up here.'
              : 'Discover someone whose skills fit yours and send your first request.'
          }
          actionLabel="Find Someone"
          actionTo="/discover"
        />
      )}

      <div className="space-y-4">
        {(list || []).map((r) => {
          const other = tab === 'incoming' ? r.sender : r.recipient;
          return (
            <div key={r.id} className="card p-5">
              <div className="flex items-start gap-4">
                <Avatar name={other?.displayName || '?'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/profile/${other?.id}`} className="font-semibold hover:underline">
                      {other?.displayName}
                    </Link>
                    <span className={`chip ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  </div>
                  {r.skillOffered && r.skillWanted && (
                    <p className="text-xs text-ink-400 mt-0.5 mb-2">
                      {tab === 'incoming'
                        ? `${other?.displayName.split(' ')[0]} teaches ${r.skillWanted} · wants ${r.skillOffered}`
                        : `You teach ${r.skillOffered} · want ${r.skillWanted}`}
                    </p>
                  )}
                  <p className="text-sm text-ink-500 whitespace-pre-line">{r.message}</p>

                  {r.status === 'PENDING' && (
                    <div className="flex gap-2 mt-4">
                      {tab === 'incoming' ? (
                        <>
                          <button
                            onClick={() => act(r.id, 'accept')}
                            className="btn-primary !py-2 text-xs"
                            disabled={busyId === r.id}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => act(r.id, 'reject')}
                            className="btn-outline !py-2 text-xs"
                            disabled={busyId === r.id}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => act(r.id, 'cancel')}
                          className="btn-ghost !py-2 text-xs"
                          disabled={busyId === r.id}
                        >
                          Cancel request
                        </button>
                      )}
                    </div>
                  )}
                  {r.status === 'ACCEPTED' && (
                    <Link to="/exchanges" className="text-xs text-coral-600 font-semibold hover:underline mt-3 inline-block">
                      Go to exchange →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
