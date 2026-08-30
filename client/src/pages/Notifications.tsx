import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { EmptyState } from '../components/ui';
import { connectSocket } from '../socket';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export default function Notifications() {
  const [items, setItems] = useState<Notif[] | null>(null);

  const load = () => {
    api.get<{ notifications: Notif[] }>('/notifications').then((d) => setItems(d.notifications)).catch(() => setItems([]));
  };
  useEffect(() => {
    load();
    connectSocket().catch(() => {});
  }, []);

  const markAll = async () => {
    await api.post('/notifications/read-all');
    load();
  };

  const markOne = async (n: Notif) => {
    if (n.readAt) return;
    await api.post(`/notifications/${n.id}/read`);
    load();
  };

  if (items === null) return <div className="skeleton h-64 max-w-2xl mx-auto" />;

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-3xl font-bold">Notifications</h1>
        <button onClick={markAll} className="btn-ghost !py-2 text-xs">Mark all read</button>
      </div>

      {items.length === 0 && (
        <EmptyState
          title="All quiet for now."
          body="New matches, requests, messages and session updates will appear here."
          actionLabel="Find Someone"
          actionTo="/discover"
        />
      )}

      <div className="space-y-3">
        {items.map((n) => {
          const inner = (
            <div
              className={`card p-4 flex items-start gap-3 transition ${!n.readAt ? 'border-coral-200 bg-coral-50/40' : ''}`}
              onClick={() => markOne(n)}
            >
              <span className="text-lg mt-0.5" aria-hidden="true">
                {n.type === 'EXCHANGE_REQUEST' ? '✉' : n.type === 'REQUEST_ACCEPTED' ? '🤝' : n.type === 'REQUEST_REJECTED' ? '✕' :
                 n.type === 'NEW_MESSAGE' ? '💬' : n.type === 'SESSION_SCHEDULED' ? '📅' : n.type === 'SESSION_COMPLETED' ? '✅' :
                 n.type === 'EXCHANGE_COMPLETED' ? '🎉' : n.type === 'NEW_REVIEW' ? '★' : n.type === 'REPORT' ? '🚩' : '🔔'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-xs text-ink-400">{n.body}</p>
                <p className="text-[10px] text-ink-300 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.readAt && <span className="w-2 h-2 rounded-full bg-coral-500 mt-2 shrink-0" aria-label="unread" />}
            </div>
          );
          return n.link ? (
            <Link key={n.id} to={n.link} className="block">{inner}</Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
