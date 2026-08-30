import { Link } from 'react-router-dom';
import { Me, MatchResult } from '../api';

const AVATAR_COLORS: Record<string, string> = {
  coral: 'bg-coral-500',
  mint: 'bg-mint-400',
  lavender: 'bg-lavender-400',
  ink: 'bg-ink-800',
};

export function Avatar({
  name,
  color = 'coral',
  size = 'md',
  className = '',
}: {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-xl' };
  return (
    <div
      className={`${sizes[size]} ${AVATAR_COLORS[color] || AVATAR_COLORS.coral} rounded-2xl flex items-center justify-center text-white font-bold shrink-0 ${className}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function SkillChip({ name, type, level }: { name: string; type?: 'TEACH' | 'WANT'; level?: string }) {
  return (
    <span className={type === 'WANT' ? 'chip-want' : 'chip-teach'}>
      {name}
      {level && type === 'TEACH' && <span className="opacity-60 font-normal">· {level.toLowerCase()}</span>}
    </span>
  );
}

export function ScoreBadge({ score, category }: { score: number; category: string }) {
  const color =
    category === 'PERFECT'
      ? 'bg-coral-500 text-white'
      : category === 'STRONG'
        ? 'bg-mint-400 text-white'
        : 'bg-lavender-300 text-ink-900';
  return (
    <span className={`${color} rounded-full px-3 py-1 text-xs font-bold tracking-wide`}>
      {score}% MATCH
    </span>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="card p-10 text-center max-w-md mx-auto my-10">
      <div className="text-4xl mb-3" aria-hidden="true">✳</div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-ink-400 mb-5">{body}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-primary">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return <div className="skeleton h-64 w-full" aria-hidden="true" />;
}

export function MatchSummary({ match }: { match: MatchResult }) {
  return (
    <div className="text-sm space-y-1.5">
      {match.theyTeach.length > 0 && (
        <p>
          <span className="text-ink-400">They teach you:</span>{' '}
          <span className="font-semibold text-mint-500">{match.theyTeach.join(', ')}</span>
        </p>
      )}
      {match.youTeach.length > 0 && (
        <p>
          <span className="text-ink-400">You teach them:</span>{' '}
          <span className="font-semibold text-lavender-500">{match.youTeach.join(', ')}</span>
        </p>
      )}
      {match.explanation.sameUniversity && (
        <p className="text-ink-400">🏛 Same university</p>
      )}
      {match.explanation.sharedDays.length > 0 && match.explanation.sharedDayParts.length > 0 && (
        <p className="text-ink-400">
          🕐 Compatible {match.explanation.sharedDayParts.join(', ').toLowerCase()}s
        </p>
      )}
    </div>
  );
}

export function UserProfileLine({ me }: { me: Me | null }) {
  if (!me) return null;
  return (
    <span className="text-sm text-ink-400">
      {me.displayName}
      {me.profile?.university ? ` · ${me.profile.university}` : ''}
    </span>
  );
}
