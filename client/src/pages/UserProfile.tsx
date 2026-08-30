import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, MatchResult, Profile } from '../api';
import { useAuth } from '../auth';
import { Avatar, ScoreBadge, SkillChip, MatchSummary } from '../components/ui';

interface UserData {
  user: {
    id: string;
    displayName: string;
    profile?: Profile | null;
    skills: Array<{ id: string; type: 'TEACH' | 'WANT'; level: string; skill: { name: string } }>;
    rating: number | null;
    reviewCount: number;
    completedCount: number;
    reviews: Array<{ id: string; rating: number; comment?: string | null; reviewer: { displayName: string } }>;
  };
  match: MatchResult | null;
  blocked: boolean;
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const [data, setData] = useState<UserData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<UserData>(`/users/${id}`).then(setData).catch(() => setNotFound(true));
    // Record an anonymous profile view for Gold/Elite analytics (aggregated only).
    api.post('/analytics/profile-view', { targetId: id }).catch(() => {});
  }, [id]);

  if (notFound) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-400 mb-4">User not found.</p>
        <Link to="/discover" className="btn-outline">Back to Discover</Link>
      </div>
    );
  }
  if (!data) return <div className="skeleton h-96" />;

  const { user, match, blocked } = data;
  const teaching = user.skills.filter((s) => s.type === 'TEACH');
  const wanting = user.skills.filter((s) => s.type === 'WANT');

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <div className="card p-6 md:p-8 mb-5">
        <div className="flex items-start gap-5">
          <Avatar name={user.displayName} color={user.profile?.avatarColor} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold">{user.displayName}</h1>
            <p className="text-sm text-ink-400">
              {user.profile?.university || 'SkillSwap member'}
              {user.profile?.department ? ` · ${user.profile.department}` : ''}
              {user.profile?.year ? ` · Year ${user.profile.year}` : ''}
            </p>
            <div className="flex gap-4 mt-2 text-xs text-ink-400">
              <span><span className="font-bold text-ink-800">{user.rating ? user.rating.toFixed(1) : '—'}</span> rating</span>
              <span><span className="font-bold text-ink-800">{user.completedCount}</span> completed exchanges</span>
              <span><span className="font-bold text-ink-800">{user.reviewCount}</span> reviews</span>
            </div>
          </div>
        </div>
        {user.profile?.bio && <p className="text-sm text-ink-500 mt-4">{user.profile.bio}</p>}

        {match && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ScoreBadge score={match.score} category={match.category} />
            <Link to={`/matches/${user.id}`} className="btn-primary !py-2 text-xs">
              Start an Exchange
            </Link>
          </div>
        )}
        {match && (
          <div className="card !bg-cream-50 p-4 mt-4">
            <MatchSummary match={match} />
          </div>
        )}
      </div>

      <div className="card p-6 mb-5">
        <h2 className="label mb-3">Skills they teach</h2>
        {teaching.length === 0 ? <p className="text-sm text-ink-300">None listed.</p> : (
          <div className="flex flex-wrap gap-2">
            {teaching.map((s) => (
              <SkillChip key={s.id} name={s.skill.name} type="TEACH" level={s.level} />
            ))}
          </div>
        )}
        <h2 className="label mt-6 mb-3">They want to learn</h2>
        {wanting.length === 0 ? <p className="text-sm text-ink-300">None listed.</p> : (
          <div className="flex flex-wrap gap-2">
            {wanting.map((s) => (
              <SkillChip key={s.id} name={s.skill.name} type="WANT" />
            ))}
          </div>
        )}
        {user.profile?.days && user.profile.days.length > 0 && (
          <>
            <h2 className="label mt-6 mb-3">Available</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {user.profile.days.map((d) => (
                <span key={d} className="chip bg-ink-900 text-cream-50">{d}</span>
              ))}
              {user.profile.dayParts?.map((p) => (
                <span key={p} className="chip bg-cream-200 text-ink-700">{p}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {user.reviews.length > 0 && (
        <div className="card p-6 mb-5">
          <h2 className="label mb-3">Reviews</h2>
          <div className="space-y-4">
            {user.reviews.map((r) => (
              <div key={r.id} className="text-sm">
                <p className="text-coral-500 font-bold">{r.rating}.0 ★ · {r.reviewer.displayName}</p>
                {r.comment && <p className="text-ink-500 mt-1">“{r.comment}”</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {me && me.id !== user.id && (
        <div className="card p-6">
          <h2 className="label mb-3">Safety</h2>
          <BlockToggle userId={user.id} blocked={blocked} />
        </div>
      )}
    </div>
  );
}

function BlockToggle({ userId, blocked: initial }: { userId: string; blocked: boolean }) {
  const [blocked, setBlocked] = useState(initial);
  const toggle = async () => {
    if (blocked) {
      await api.del(`/users/${userId}/block`);
      setBlocked(false);
    } else {
      await api.post(`/users/${userId}/block`);
      setBlocked(true);
    }
  };
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-ink-400">
        {blocked ? 'You have blocked this user. They cannot contact you or appear in your matches.' : 'Blocking prevents this person from contacting you or appearing in your matches.'}
      </p>
      <button onClick={toggle} className={blocked ? 'btn-outline !py-2 text-xs' : 'btn-ghost !py-2 text-xs text-coral-600'}>
        {blocked ? 'Unblock' : 'Block user'}
      </button>
    </div>
  );
}

