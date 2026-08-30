import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, SkillChip } from '../components/ui';

export default function Profile() {
  const { me, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: '', university: '', department: '', year: '' });
  const [stats, setStats] = useState<{ rating: number | null; reviewCount: number; completedCount: number } | null>(null);

  useEffect(() => {
    if (!me) return;
    setForm({
      bio: me.profile?.bio || '',
      university: me.profile?.university || '',
      department: me.profile?.department || '',
      year: me.profile?.year || '',
    });
    api
      .get<{ user: { rating: number | null; reviewCount: number; completedCount: number } }>(`/users/${me.id}`)
      .then((d) => setStats(d.user))
      .catch(() => {});
  }, [me]);

  if (!me) return null;
  const teaching = (me.skills || []).filter((s) => s.type === 'TEACH');
  const wanting = (me.skills || []).filter((s) => s.type === 'WANT');

  const save = async () => {
    await api.put('/profile', {
      bio: form.bio || null,
      university: form.university || null,
      department: form.department || null,
      year: form.year || null,
    });
    await refresh();
    setEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <div className="card p-6 md:p-8 mb-5">
        <div className="flex items-start gap-5">
          <Avatar name={me.displayName} color={me.profile?.avatarColor} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold">{me.displayName}</h1>
            <p className="text-sm text-ink-400">
              {me.profile?.university || 'No university set'}
              {me.profile?.department ? ` · ${me.profile.department}` : ''}
              {me.profile?.year ? ` · Year ${me.profile.year}` : ''}
            </p>
            {stats && (
              <div className="flex gap-4 mt-2 text-xs text-ink-400">
                <span><span className="font-bold text-ink-800">{stats.rating ? stats.rating.toFixed(1) : '—'}</span> rating</span>
                <span><span className="font-bold text-ink-800">{stats.completedCount}</span> completed exchanges</span>
                <span><span className="font-bold text-ink-800">{stats.reviewCount}</span> reviews</span>
              </div>
            )}
          </div>
          <button onClick={() => setEditing((e) => !e)} className="btn-outline !py-2 text-xs shrink-0">
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <div className="mt-5 space-y-3">
            <div>
              <label className="label" htmlFor="bio">Bio</label>
              <textarea id="bio" className="input" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="pu">University</label>
                <input id="pu" className="input" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="pd">Department</label>
                <input id="pd" className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="py">Year</label>
                <input id="py" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
            </div>
            <button onClick={save} className="btn-primary">Save changes</button>
          </div>
        ) : (
          me.profile?.bio && <p className="text-sm text-ink-500 mt-4">{me.profile.bio}</p>
        )}
      </div>

      <div className="card p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="label !mb-0">I teach</h2>
          <Link to="/skills" className="text-xs font-semibold text-coral-600 hover:underline">Manage skills</Link>
        </div>
        {teaching.length === 0 ? (
          <p className="text-sm text-ink-300">No teaching skills yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teaching.map((s) => (
              <SkillChip key={s.id} name={s.skill.name} type="TEACH" level={s.level} />
            ))}
          </div>
        )}
        <h2 className="label mt-6">I want to learn</h2>
        {wanting.length === 0 ? (
          <p className="text-sm text-ink-300">Nothing yet — what are you curious about?</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {wanting.map((s) => (
              <SkillChip key={s.id} name={s.skill.name} type="WANT" />
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="label mb-3">Availability & format</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {(me.profile?.days || []).map((d) => (
            <span key={d} className="chip bg-ink-900 text-cream-50">{d}</span>
          ))}
          {(me.profile?.dayParts || []).map((p) => (
            <span key={p} className="chip bg-cream-200 text-ink-700">{p}</span>
          ))}
          <span className="chip bg-mint-100 text-mint-500">
            {me.profile?.format === 'ONLINE' ? '💻 Online' : me.profile?.format === 'IN_PERSON' ? '🤝 In person' : '✨ Either'}
          </span>
        </div>
        {(!me.profile?.days || me.profile.days.length === 0) && (
          <Link to="/settings" className="text-xs text-coral-600 hover:underline">Set your availability →</Link>
        )}
      </div>
    </div>
  );
}
