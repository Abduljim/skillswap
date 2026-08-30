import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, MatchEntry } from '../api';
import { useAuth } from '../auth';
import { Avatar, ScoreBadge } from '../components/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PARTS = ['Morning', 'Afternoon', 'Evening'];
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

interface Skill {
  id: string;
  name: string;
  category: string;
}

export default function Onboarding() {
  const { me, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');

  const [displayName, setDisplayName] = useState(me?.displayName || '');
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [teach, setTeach] = useState<Array<{ skill: Skill; level: string }>>([]);
  const [want, setWant] = useState<Skill[]>([]);
  const [format, setFormat] = useState<'ONLINE' | 'IN_PERSON' | 'EITHER'>('EITHER');
  const [days, setDays] = useState<string[]>([]);
  const [dayParts, setDayParts] = useState<string[]>([]);
  const [matches, setMatches] = useState<MatchEntry[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ skills: Skill[] }>('/skills').then((d) => setSkills(d.skills)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return skills.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 24);
  }, [skills, search]);

  const toggleSkill = (skill: Skill) => {
    if (step === 2) {
      setTeach((t) =>
        t.some((x) => x.skill.id === skill.id)
          ? t.filter((x) => x.skill.id !== skill.id)
          : [...t, { skill, level: 'INTERMEDIATE' }]
      );
    } else {
      setWant((w) =>
        w.some((x) => x.id === skill.id) ? w.filter((x) => x.id !== skill.id) : [...w, skill]
      );
    }
  };

  const selectedIds = (step === 2 ? teach.map((t) => t.skill.id) : want.map((w) => w.id)) as string[];

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put('/profile', {
        displayName,
        university: university || null,
        department: department || null,
        year: year || null,
        format,
        days,
        dayParts,
      });
      for (const t of teach) {
        await api.post(`/skills/${t.skill.id}/add`, { type: 'TEACH', level: t.level });
      }
      for (const w of want) {
        await api.post(`/skills/${w.id}/add`, { type: 'WANT' });
      }
      await refresh();
      const data = await api.get<{ matches: MatchEntry[] }>('/matches');
      setMatches(data.matches.slice(0, 4));
      setStep(7);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong finding your matches. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!me) return null;

  const canNext =
    (step === 1 && displayName.trim().length >= 2) ||
    (step === 2 && teach.length > 0) ||
    (step === 3 && teach.every((t) => t.level)) ||
    (step === 4 && want.length > 0) ||
    step === 5 ||
    (step === 6 && days.length > 0 && dayParts.length > 0);

  const progress = (Math.min(step, 7) / 7) * 100;

  if (step === 7) {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-fade-up">
        <h1 className="font-display text-3xl font-bold mb-2">We found your first matches.</h1>
        <p className="text-ink-400 mb-8">
          Based on what you teach and what you want to learn, here's who fits best.
        </p>
        {matches === null && <div className="skeleton h-40" />}
        {matches && matches.length === 0 && (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">✳</div>
            <h2 className="font-display text-xl font-bold mb-2">Your skill circle is still forming.</h2>
            <p className="text-sm text-ink-400 mb-5">
              Nobody matches those exact skills yet. As people join and add skills,
              you'll show up in each other's discovery automatically.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/skills')} className="btn-primary">
                Add more skills
              </button>
              <button onClick={() => navigate('/dashboard')} className="btn-outline">
                Go to dashboard
              </button>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {(matches || []).map(({ user, match }) => (
            <div key={user.id} className="card p-5 flex items-center gap-4">
              <Avatar name={user.displayName} color={user.avatarColor} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-xs text-ink-400">
                  can teach you {match.theyTeach.join(', ') || '—'}
                </p>
              </div>
              <ScoreBadge score={match.score} category={match.category} />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={() => navigate('/discover')} className="btn-primary flex-1">
            Explore all matches
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-outline">
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="h-1.5 bg-ink-100 rounded-full mb-8 overflow-hidden" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={7}>
        <div className="h-full bg-coral-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="animate-fade-up" key={step}>
        {step === 1 && (
          <>
            <h1 className="font-display text-3xl font-bold mb-2">Let's introduce you.</h1>
            <p className="text-sm text-ink-400 mb-6">This helps people find you nearby.</p>
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="dn">Display name</label>
                <input id="dn" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="uni">University</label>
                <input id="uni" className="input" placeholder="e.g. University of Lagos" value={university} onChange={(e) => setUniversity(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="dept">Department</label>
                  <input id="dept" className="input" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="yr">Year</label>
                  <input id="yr" className="input" placeholder="e.g. 300" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
              </div>
            </div>
          </>
        )}

        {(step === 2 || step === 4) && (
          <>
            <h1 className="font-display text-3xl font-bold mb-2">
              {step === 2 ? 'What can you teach?' : 'What do you want to learn?'}
            </h1>
            <p className="text-sm text-ink-400 mb-6">Pick at least one. You can always add more later.</p>
            <input
              className="input mb-4"
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search skills"
            />
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSkill(s)}
                  aria-pressed={selectedIds.includes(s.id)}
                  className={`chip border transition-transform ${
                    selectedIds.includes(s.id)
                      ? step === 2
                        ? 'bg-mint-300 text-ink-900 border-mint-400 scale-105'
                        : 'bg-lavender-200 text-ink-900 border-lavender-300 scale-105'
                      : 'bg-white border-ink-200 text-ink-600 hover:border-ink-400'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-3xl font-bold mb-2">How good are you?</h1>
            <p className="text-sm text-ink-400 mb-6">Be honest — learners appreciate it.</p>
            <div className="space-y-4">
              {teach.map((t, i) => (
                <div key={t.skill.id} className="card p-4">
                  <p className="font-semibold mb-2">{t.skill.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((lv) => (
                      <button
                        key={lv}
                        onClick={() => setTeach((ts) => ts.map((x, j) => (i === j ? { ...x, level: lv } : x)))}
                        aria-pressed={t.level === lv}
                        className={`chip border ${
                          t.level === lv
                            ? 'bg-coral-500 text-white border-coral-500'
                            : 'bg-white border-ink-200 text-ink-500'
                        }`}
                      >
                        {lv[0] + lv.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="font-display text-3xl font-bold mb-2">How do you want to learn?</h1>
            <p className="text-sm text-ink-400 mb-6">Either is perfectly fine.</p>
            <div className="grid grid-cols-3 gap-3">
              {(['ONLINE', 'IN_PERSON', 'EITHER'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  aria-pressed={format === f}
                  className={`card p-4 text-sm font-semibold transition ${
                    format === f ? 'border-coral-400 ring-2 ring-coral-200' : ''
                  }`}
                >
                  {f === 'ONLINE' ? '💻 Online' : f === 'IN_PERSON' ? '🤝 In person' : '✨ Either'}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <h1 className="font-display text-3xl font-bold mb-2">When are you available?</h1>
            <p className="text-sm text-ink-400 mb-6">We use this to match schedules.</p>
            <p className="label">Days</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}
                  aria-pressed={days.includes(d)}
                  className={`chip border ${
                    days.includes(d) ? 'bg-ink-900 text-cream-50 border-ink-900' : 'bg-white border-ink-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="label">Time of day</p>
            <div className="flex flex-wrap gap-2">
              {PARTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDayParts((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}
                  aria-pressed={dayParts.includes(p)}
                  className={`chip border ${
                    dayParts.includes(p) ? 'bg-ink-900 text-cream-50 border-ink-900' : 'bg-white border-ink-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between mt-10">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} className="btn-ghost" disabled={step === 1}>
          Back
        </button>
        {step < 6 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="btn-primary disabled:opacity-40"
            disabled={!canNext}
            title={!canNext ? 'Please complete this step first' : undefined}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={finish}
            className="btn-primary disabled:opacity-40"
            disabled={!canNext || saving}
            title={!canNext ? 'Pick at least one day and one time of day' : undefined}
          >
            {saving ? 'Finding your matches…' : 'Find my matches ✨'}
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm text-coral-600 mt-4 text-center" role="alert">{error}</p>
      )}
    </div>
  );
}
