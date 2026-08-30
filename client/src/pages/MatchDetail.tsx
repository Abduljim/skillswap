import { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, MatchResult, ApiError, Quota } from '../api';
import { useAuth } from '../auth';
import { Avatar, ScoreBadge, SkillChip, MatchSummary } from '../components/ui';
import { Paywall, isLimitError } from '../components/Paywall';

interface MatchUser {
  id: string;
  displayName: string;
  university?: string | null;
  avatarColor?: string;
  skills: Array<{ id: string; name: string; type: 'TEACH' | 'WANT'; level: string }>;
}

export default function MatchDetail() {
  const { userId } = useParams();
  const { me } = useAuth();
  const [data, setData] = useState<{ user: MatchUser; match: MatchResult; unlockQuota: Quota | null } | null>(null);
  const [error, setError] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!userId) return;
    api
      .get<{ user: MatchUser; match: MatchResult; unlockQuota: Quota | null }>(`/matches/${userId}`)
      .then((d) => {
        setData(d);
        setMessage(
          `Hi ${d.user.displayName.split(' ')[0]},\n\nI noticed you can teach ${d.match.theyTeach.join(', ')}, and I'm currently learning it.\n\nI can teach you ${d.match.youTeach.join(', ')} in return.\n\nWould you like to exchange skills?`
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load match'));
  }, [userId]);

  if (error && !limitHit) {
    return (
      <div className="max-w-xl mx-auto py-10 text-center">
        <p className="text-coral-600 mb-4">{error}</p>
        <Link to="/discover" className="btn-outline">Back to Discover</Link>
      </div>
    );
  }

  if (!data) return <div className="skeleton h-96" />;

  const { user, match } = data;
  const theyTeachSkills = user.skills.filter((s) => s.type === 'TEACH');
  const theyWantSkills = user.skills.filter((s) => s.type === 'WANT');

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/exchange-requests', {
        recipientId: user.id,
        message,
        skillOffered: match.youTeach[0],
        skillWanted: match.theyTeach[0],
      });
      setSent(true);
    } catch (err) {
      if (isLimitError(err as ApiError)) {
        setLimitHit(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send request');
      }
    } finally {
      setBusy(false);
    }
  };

  if (limitHit) {
    return (
      <div className="max-w-3xl mx-auto py-6 animate-fade-up">
        <Link to="/discover" className="text-xs text-ink-400 hover:text-ink-700 mb-4 inline-block">
          ← Back to Discover
        </Link>
        <Paywall
          headline="You've used your 5 free exchange requests this month."
          detail="Gold removes the limit entirely. Elite adds the highest discovery priority."
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 animate-fade-up">
      <Link to="/discover" className="text-xs text-ink-400 hover:text-ink-700 mb-4 inline-block">
        ← Back to Discover
      </Link>

      <div className="card p-6 md:p-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold mb-1">You two have something to trade.</h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Avatar name={me?.displayName || 'You'} color={me?.profile?.avatarColor} size="lg" />
            <div className="w-16 h-px bg-ink-200 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-coral-500 text-lg">⇄</span>
            </div>
            <Avatar name={user.displayName} color={user.avatarColor} size="lg" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="font-semibold">{me?.displayName || 'You'}</span>
            <ScoreBadge score={match.score} category={match.category} />
            <span className="font-semibold">{user.displayName}</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl bg-mint-50 p-5">
            <p className="text-[10px] uppercase tracking-wider text-mint-500 font-bold mb-3">
              {user.displayName.split(' ')[0]} TEACHES YOU
            </p>
            <div className="flex flex-wrap gap-2">
              {match.theyTeach.map((s) => (
                <SkillChip key={s} name={s} type="TEACH" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-lavender-50 p-5">
            <p className="text-[10px] uppercase tracking-wider text-lavender-500 font-bold mb-3">
              YOU TEACH {user.displayName.split(' ')[0].toUpperCase()}
            </p>
            <div className="flex flex-wrap gap-2">
              {match.youTeach.map((s) => (
                <SkillChip key={s} name={s} type="WANT" />
              ))}
            </div>
          </div>
        </div>

        <div className="card !bg-cream-50 p-5 mb-8">
          <p className="label mb-3">Why you match</p>
          <MatchSummary match={match} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <p className="label">They teach</p>
            <div className="flex flex-wrap gap-1.5">
              {theyTeachSkills.map((s) => (
                <SkillChip key={s.id} name={s.name} type="TEACH" level={s.level} />
              ))}
            </div>
          </div>
          <div>
            <p className="label">They want</p>
            <div className="flex flex-wrap gap-1.5">
              {theyWantSkills.map((s) => (
                <SkillChip key={s.id} name={s.name} type="WANT" />
              ))}
            </div>
          </div>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-mint-500 font-semibold mb-2">Request sent! ✨</p>
            <p className="text-sm text-ink-400 mb-4">
              We'll let you know when {user.displayName.split(' ')[0]} responds.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/requests" className="btn-outline">View requests</Link>
              <Link to="/discover" className="btn-primary">Find more matches</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <div>
              <label className="label" htmlFor="msg">Your message</label>
              <textarea
                id="msg"
                className="input min-h-[140px] resize-y"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={5}
              />
            </div>
            {error && <p className="text-sm text-coral-600" role="alert">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
                {busy ? 'Sending…' : 'Send Exchange Request'}
              </button>
              <Link to={`/profile/${user.id}`} className="btn-outline">
                View Full Profile
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
