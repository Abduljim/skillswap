import { useEffect, useMemo, useState } from 'react';
import { api, UserSkill } from '../api';
import { useAuth } from '../auth';
import { SkillChip } from '../components/ui';

interface Skill {
  id: string;
  name: string;
  category: string;
}

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

export default function Skills() {
  const { me, refresh } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'TEACH' | 'WANT'>('TEACH');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ skills: Skill[] }>('/skills').then((d) => setSkills(d.skills)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return skills.filter((s) => s.name.toLowerCase().includes(q));
  }, [skills, search]);

  const grouped = useMemo(() => {
    const g: Record<string, Skill[]> = {};
    for (const s of filtered) (g[s.category] = g[s.category] || []).push(s);
    return g;
  }, [filtered]);

  const has = (skillId: string, type: 'TEACH' | 'WANT') =>
    (me?.skills || []).some((s) => s.skill.id === skillId && s.type === type);

  const add = async (skill: Skill) => {
    setBusy(true);
    try {
      await api.post(`/skills/${skill.id}/add`, { type: mode, level: 'INTERMEDIATE' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (skill: Skill) => {
    setBusy(true);
    try {
      await api.del(`/skills/${skill.id}/remove?type=${mode}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const setLevel = async (us: UserSkill, level: string) => {
    await api.post(`/skills/${us.skill.id}/add`, { type: us.type, level });
    await refresh();
  };

  if (!me) return null;

  const teachSkills = (me.skills || []).filter((s) => s.type === 'TEACH');
  const wantSkills = (me.skills || []).filter((s) => s.type === 'WANT');

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <h1 className="font-display text-3xl font-bold mb-2">Your skills</h1>
      <p className="text-sm text-ink-400 mb-5">Keep this fresh — your matches depend on it.</p>

      <div className="card p-6 mb-5">
        <h2 className="label mb-3">I teach ({teachSkills.length})</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {teachSkills.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2">
              <SkillChip name={s.skill.name} type="TEACH" />
              <select
                value={s.level}
                onChange={(e) => setLevel(s, e.target.value)}
                aria-label={`Level for ${s.skill.name}`}
                className="text-[10px] rounded-full border border-ink-200 px-1.5 py-0.5 bg-white"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l[0] + l.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <button onClick={() => remove(s.skill)} className="text-ink-300 hover:text-coral-600 text-xs" aria-label={`Remove ${s.skill.name}`}>✕</button>
            </span>
          ))}
          {teachSkills.length === 0 && (
            <p className="text-sm text-ink-300">Add skills you can teach below.</p>
          )}
        </div>

        <h2 className="label mb-3">I want to learn ({wantSkills.length})</h2>
        <div className="flex flex-wrap gap-2">
          {wantSkills.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2">
              <SkillChip name={s.skill.name} type="WANT" />
              <button onClick={() => remove(s.skill)} className="text-ink-300 hover:text-coral-600 text-xs" aria-label={`Remove ${s.skill.name}`}>✕</button>
            </span>
          ))}
          {wantSkills.length === 0 && (
            <p className="text-sm text-ink-300">Add skills you want to learn below.</p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="label !mb-0">Add skills</h2>
          <div className="flex rounded-full bg-ink-100 p-1">
            <button
              onClick={() => setMode('TEACH')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${mode === 'TEACH' ? 'bg-mint-300 text-ink-900' : 'text-ink-400'}`}
            >
              I teach
            </button>
            <button
              onClick={() => setMode('WANT')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${mode === 'WANT' ? 'bg-lavender-200 text-ink-900' : 'text-ink-400'}`}
            >
              I want
            </button>
          </div>
        </div>
        <input
          className="input mb-4"
          placeholder={`Search ${skills.length} skills…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search skills"
        />
        <div className="space-y-5 max-h-[420px] overflow-y-auto">
          {Object.entries(grouped).map(([category, list]) => (
            <div key={category}>
              <p className="text-[10px] uppercase tracking-wider text-ink-300 font-bold mb-2">{category}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => (has(s.id, mode) ? remove(s) : add(s))}
                    disabled={busy}
                    aria-pressed={has(s.id, mode)}
                    className={`chip border transition-transform ${
                      has(s.id, mode)
                        ? mode === 'TEACH'
                          ? 'bg-mint-300 text-ink-900 border-mint-400 scale-105'
                          : 'bg-lavender-200 text-ink-900 border-lavender-300 scale-105'
                        : 'bg-white border-ink-200 text-ink-600 hover:border-ink-400'
                    }`}
                  >
                    {has(s.id, mode) ? '✓ ' : '+ '}{s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
