import { useEffect, useRef, useState, FormEvent } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api, Profile } from '../api';
import { useAuth } from '../auth';
import { Avatar, EmptyState } from '../components/ui';
import { connectSocket, getSocket } from '../socket';

interface ExchangeDetail {
  id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  you: { teaching: string; learning: string; completeConfirmed: boolean };
  partner: {
    teaching: string;
    learning: string;
    completeConfirmed: boolean;
    id: string;
    displayName: string;
    profile?: Profile | null;
  };
  nextSession?: { id: string; title: string; scheduledAt: string; mode: string; meetingLink?: string | null } | null;
  completedSessions: number;
  messageCount: number;
  reviews: Array<{ id: string; rating: number; comment?: string | null; reviewerId: string }>;
}

interface Msg {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { displayName: string };
}

interface Sess {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: string;
  status: string;
  meetingLink?: string | null;
  location?: string | null;
  notes?: string | null;
}

type Tab = 'overview' | 'chat' | 'sessions' | 'progress';

export default function ExchangeWorkspace() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { me, refresh } = useAuth();
  const [exchange, setExchange] = useState<ExchangeDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const tab: Tab = location.pathname.endsWith('/chat')
    ? 'chat'
    : location.pathname.endsWith('/sessions')
      ? 'sessions'
      : location.pathname.endsWith('/progress')
        ? 'progress'
        : 'overview';

  const load = () => {
    if (!id) return;
    api.get<{ exchange: ExchangeDetail }>(`/exchanges/${id}`)
      .then((d) => setExchange(d.exchange))
      .catch(() => setNotFound(true));
  };

  useEffect(load, [id]);

  if (notFound) {
    return (
      <EmptyState
        title="Exchange not found"
        body="This exchange doesn't exist or you're not part of it."
        actionLabel="Back to Exchanges"
        actionTo="/exchanges"
      />
    );
  }

  if (!exchange || !me) return <div className="skeleton h-96" />;

  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      {/* header */}
      <div className="card p-6 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <Avatar name={me.displayName} color={me.profile?.avatarColor} />
              <p className="text-[10px] font-semibold mt-1 text-ink-400">YOU</p>
            </div>
            <div className="text-center">
              <span className="text-coral-500 text-xl">⇄</span>
              <p className="text-[10px] mt-0.5">
                <span className={`chip ${exchange.status === 'ACTIVE' ? 'bg-mint-100 text-mint-500' : 'bg-lavender-100 text-lavender-500'}`}>
                  {exchange.status} EXCHANGE
                </span>
              </p>
            </div>
            <div className="text-center">
              <Avatar name={exchange.partner.displayName} color={exchange.partner.profile?.avatarColor} />
              <p className="text-[10px] font-semibold mt-1 text-ink-400">
                {exchange.partner.displayName.split(' ')[0].toUpperCase()}
              </p>
            </div>
          </div>
          <Link to={`/profile/${exchange.partner.id}`} className="btn-outline !py-2 text-xs">
            View profile
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-sm">
          <span className="chip bg-lavender-100 text-lavender-500">You teach {exchange.you.teaching}</span>
          <span className="text-ink-300">↔</span>
          <span className="chip bg-mint-100 text-mint-500">{exchange.partner.displayName.split(' ')[0]} teaches {exchange.you.learning}</span>
        </div>
      </div>

      {/* tabs */}
      <div className="flex rounded-full bg-ink-100 p-1 mb-5">
        {(['overview', 'chat', 'sessions', 'progress'] as Tab[]).map((t) => (
          <Link
            key={t}
            to={t === 'overview' ? `/exchanges/${id}` : `/exchanges/${id}/${t}`}
            className={`flex-1 text-center px-3 py-2 rounded-full text-xs font-semibold capitalize transition ${
              tab === t ? 'bg-white shadow-soft' : 'text-ink-400'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {tab === 'overview' && <Overview exchange={exchange} onChanged={load} />}
      {tab === 'chat' && <Chat exchange={exchange} meId={me.id} />}
      {tab === 'sessions' && <Sessions exchange={exchange} onChanged={load} />}
      {tab === 'progress' && <Progress exchange={exchange} meId={me.id} onChanged={async () => { load(); await refresh(); }} />}
    </div>
  );
}

function Overview({ exchange, onChanged }: { exchange: ExchangeDetail; onChanged: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="label">Your side</p>
          <p className="text-sm mb-2"><span className="text-ink-400">Teaching:</span> <span className="font-semibold text-lavender-500">{exchange.you.teaching}</span></p>
          <p className="text-sm"><span className="text-ink-400">Learning:</span> <span className="font-semibold text-mint-500">{exchange.you.learning}</span></p>
        </div>
        <div className="card p-5">
          <p className="label">{exchange.partner.displayName.split(' ')[0]}'s side</p>
          <p className="text-sm mb-2"><span className="text-ink-400">Teaching:</span> <span className="font-semibold text-mint-500">{exchange.partner.teaching}</span></p>
          <p className="text-sm"><span className="text-ink-400">Learning:</span> <span className="font-semibold text-lavender-500">{exchange.partner.learning}</span></p>
        </div>
      </div>

      <div className="card p-5">
        <p className="label mb-3">Status</p>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="font-display text-2xl font-bold">{exchange.completedSessions}</p>
            <p className="text-xs text-ink-400">completed sessions</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold">{exchange.messageCount}</p>
            <p className="text-xs text-ink-400">messages</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold">
              {exchange.nextSession ? new Date(exchange.nextSession.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
            </p>
            <p className="text-xs text-ink-400">next session</p>
          </div>
        </div>
        {exchange.nextSession && (
          <div className="mt-4 rounded-2xl bg-cream-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{exchange.nextSession.title}</p>
              <p className="text-xs text-ink-400">
                {new Date(exchange.nextSession.scheduledAt).toLocaleString()} · {exchange.nextSession.mode === 'ONLINE' ? 'Online' : 'In person'}
              </p>
            </div>
            {exchange.nextSession.meetingLink && (
              <a href={exchange.nextSession.meetingLink} target="_blank" rel="noreferrer" className="btn-primary !py-2 text-xs">
                Join
              </a>
            )}
          </div>
        )}
      </div>

      {exchange.status === 'ACTIVE' && (
        <CompletionControls exchange={exchange} onChanged={onChanged} />
      )}
    </div>
  );
}

function CompletionControls({ exchange, onChanged }: { exchange: ExchangeDetail; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const complete = async () => {
    setBusy(true);
    try {
      await api.post(`/exchanges/${exchange.id}/complete`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-5">
      <p className="label mb-2">Complete the exchange</p>
      <p className="text-sm text-ink-400 mb-4">
        When both of you confirm, the exchange is marked complete and reviews unlock.
      </p>
      <div className="flex items-center gap-3">
        <button onClick={complete} className="btn-dark" disabled={busy || exchange.you.completeConfirmed}>
          {exchange.you.completeConfirmed ? '✓ You confirmed' : busy ? 'Confirming…' : 'Complete exchange'}
        </button>
        <span className={`chip ${exchange.partner.completeConfirmed ? 'bg-mint-100 text-mint-500' : 'bg-ink-100 text-ink-400'}`}>
          {exchange.partner.completeConfirmed
            ? `${exchange.partner.displayName.split(' ')[0]} confirmed ✓`
            : `${exchange.partner.displayName.split(' ')[0]} hasn't confirmed yet`}
        </span>
      </div>
    </div>
  );
}

function Chat({ exchange, meId }: { exchange: ExchangeDetail; meId: string }) {
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api.get<{ messages: Msg[] }>(`/exchanges/${exchange.id}/messages`).then((d) => {
      if (active) setMessages(d.messages);
    }).catch(() => setMessages([]));

    connectSocket().then((sock) => {
      sock.emit('join-exchange', exchange.id);
      const onMsg = (m: Msg) => {
        setMessages((prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev || []), m]));
      };
      const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
        if (userId !== meId) setTyping(isTyping);
      };
      sock.on('message', onMsg);
      sock.on('typing', onTyping);
    }).catch(() => {});

    return () => {
      active = false;
      const sock = getSocket();
      sock?.emit('leave-exchange', exchange.id);
      sock?.off('message');
      sock?.off('typing');
    };
  }, [exchange.id, meId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    try {
      const d = await api.post<{ message: Msg }>(`/exchanges/${exchange.id}/messages`, { content });
      setMessages((prev) => (prev?.some((x) => x.id === d.message.id) ? prev : [...(prev || []), d.message]));
    } catch {
      /* ignore */
    }
  };

  const onType = () => {
    const sock = getSocket();
    sock?.emit('typing', { exchangeId: exchange.id, isTyping: true });
    window.clearTimeout((onType as unknown as { t?: number }).t);
    (onType as unknown as { t?: number }).t = window.setTimeout(() => {
      sock?.emit('typing', { exchangeId: exchange.id, isTyping: false });
    }, 1500);
  };

  if (messages === null) return <div className="skeleton h-96" />;

  return (
    <div className="card flex flex-col h-[540px]">
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-300 text-center mt-16">
            Say hello to {exchange.partner.displayName.split(' ')[0]} 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? 'bg-ink-900 text-cream-50 rounded-br-md' : 'bg-cream-100 text-ink-900 rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-line">{m.content}</p>
                <p className={`text-[10px] mt-1 ${mine ? 'text-cream-200/60' : 'text-ink-300'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="text-xs text-ink-300 animate-pulse-soft">
            {exchange.partner.displayName.split(' ')[0]} is typing…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="border-t border-ink-100 p-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={onType}
          aria-label="Message"
          maxLength={2000}
        />
        <button className="btn-primary" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}

function Sessions({ exchange, onChanged }: { exchange: ExchangeDetail; onChanged: () => void }) {
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    durationMinutes: 60,
    mode: 'ONLINE',
    meetingLink: '',
    location: '',
    notes: '',
  });

  const load = () => {
    api.get<{ sessions: Sess[] }>(`/exchanges/${exchange.id}/sessions`).then((d) => setSessions(d.sessions)).catch(() => setSessions([]));
  };
  useEffect(load, [exchange.id]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await api.post(`/exchanges/${exchange.id}/sessions`, {
      title: form.title,
      scheduledAt: new Date(`${form.date}T${form.time}`).toISOString(),
      durationMinutes: Number(form.durationMinutes),
      mode: form.mode,
      meetingLink: form.meetingLink || null,
      location: form.location || null,
      notes: form.notes || null,
    });
    setShowForm(false);
    setForm({ title: '', date: '', time: '', durationMinutes: 60, mode: 'ONLINE', meetingLink: '', location: '', notes: '' });
    load();
    onChanged();
  };

  const complete = async (sid: string) => {
    await api.post(`/sessions/${sid}/complete`);
    load();
    onChanged();
  };

  const cancel = async (sid: string) => {
    await api.put(`/sessions/${sid}`, { status: 'CANCELLED' });
    load();
    onChanged();
  };

  if (sessions === null) return <div className="skeleton h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-xl font-bold">Sessions</h2>
        {exchange.status === 'ACTIVE' && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary !py-2 text-xs">
            {showForm ? 'Close' : '+ Schedule session'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-5 space-y-3">
          <div>
            <label className="label" htmlFor="st">Session title</label>
            <input id="st" required className="input" placeholder="e.g. Python basics — loops" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="sd">Date</label>
              <input id="sd" required type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="stm">Time</label>
              <input id="stm" required type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="sdur">Minutes</label>
              <input id="sdur" required type="number" min={15} max={480} className="input" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="smode">Format</label>
              <select id="smode" className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="ONLINE">Online</option>
                <option value="IN_PERSON">In person</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="slink">Meeting link (optional)</label>
              <input id="slink" type="url" className="input" value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sloc">Location (for in person)</label>
            <input id="sloc" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="snotes">Notes</label>
            <textarea id="snotes" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn-primary w-full">Schedule session</button>
        </form>
      )}

      {sessions.length === 0 && (
        <p className="text-sm text-ink-300 text-center py-8">No sessions scheduled yet.</p>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="card p-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">{s.title}</p>
              <p className="text-xs text-ink-400">
                {new Date(s.scheduledAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}{s.durationMinutes} min · {s.mode === 'ONLINE' ? 'Online' : 'In person'}
              </p>
              {s.location && <p className="text-xs text-ink-400">📍 {s.location}</p>}
              {s.notes && <p className="text-xs text-ink-400 mt-1">{s.notes}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`chip ${
                s.status === 'SCHEDULED' ? 'bg-coral-100 text-coral-600'
                : s.status === 'COMPLETED' ? 'bg-mint-100 text-mint-500'
                : 'bg-ink-100 text-ink-400'
              }`}>
                {s.status}
              </span>
              <div className="flex gap-1.5">
                {s.status === 'SCHEDULED' && (
                  <>
                    {s.meetingLink && (
                      <a href={s.meetingLink} target="_blank" rel="noreferrer" className="btn-primary !py-1.5 !px-3 text-[10px]">
                        Join
                      </a>
                    )}
                    <button onClick={() => complete(s.id)} className="btn-outline !py-1.5 !px-3 text-[10px]">Done</button>
                    <button onClick={() => cancel(s.id)} className="btn-ghost !py-1.5 !px-3 text-[10px]">Cancel</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Progress({ exchange, meId, onChanged }: { exchange: ExchangeDetail; meId: string; onChanged: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const myReview = exchange.reviews.find((r) => r.reviewerId === meId);
  const theirReview = exchange.reviews.find((r) => r.reviewerId !== meId);
  const canReview = exchange.status === 'COMPLETED';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/exchanges/${exchange.id}/review`, { rating, comment: comment || undefined });
      setDone(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <p className="label mb-3">Exchange progress</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Exchange status</span>
            <span className={`chip ${exchange.status === 'COMPLETED' ? 'bg-mint-100 text-mint-500' : 'bg-coral-100 text-coral-600'}`}>{exchange.status}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Sessions completed</span>
            <span className="font-semibold">{exchange.completedSessions}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Your confirmation</span>
            <span>{exchange.you.completeConfirmed ? '✓' : '—'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{exchange.partner.displayName.split(' ')[0]}'s confirmation</span>
            <span>{exchange.partner.completeConfirmed ? '✓' : '—'}</span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <p className="label mb-3">Review {exchange.partner.displayName.split(' ')[0]}</p>
        {myReview || done ? (
          <p className="text-sm text-mint-500 font-medium">You already left a review. Thank you! ✨</p>
        ) : !canReview ? (
          <p className="text-sm text-ink-400">Reviews unlock once the exchange is completed by both of you.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-checked={rating === n}
                  role="radio"
                  className={`text-2xl transition ${n <= rating ? 'text-coral-500' : 'text-ink-200'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="input"
              placeholder={`How was learning ${exchange.you.learning} from ${exchange.partner.displayName.split(' ')[0]}?`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
            {error && <p className="text-sm text-coral-600" role="alert">{error}</p>}
            <button className="btn-primary">Submit review</button>
          </form>
        )}

        {theirReview && (
          <div className="mt-5 pt-5 border-t border-ink-100">
            <p className="label">Their review of you</p>
            <p className="text-coral-500 text-sm font-bold mb-1">{theirReview.rating}.0 ★</p>
            {theirReview.comment && <p className="text-sm text-ink-500">“{theirReview.comment}”</p>}
          </div>
        )}
      </div>
    </div>
  );
}
