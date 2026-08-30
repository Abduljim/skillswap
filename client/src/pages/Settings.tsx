import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PARTS = ['Morning', 'Afternoon', 'Evening'];

export default function Settings() {
  const { me, refresh } = useAuth();
  const [format, setFormat] = useState<'ONLINE' | 'IN_PERSON' | 'EITHER'>('EITHER');
  const [days, setDays] = useState<string[]>([]);
  const [dayParts, setDayParts] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!me?.profile) return;
    setFormat(me.profile.format || 'EITHER');
    setDays(me.profile.days || []);
    setDayParts(me.profile.dayParts || []);
  }, [me]);

  if (!me) return null;

  const save = async () => {
    await api.put('/profile', { format, days, dayParts });
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggle = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="max-w-xl mx-auto animate-fade-up space-y-5">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <div className="card p-6">
        <h2 className="label mb-3">Learning format</h2>
        <div className="grid grid-cols-3 gap-3">
          {(['ONLINE', 'IN_PERSON', 'EITHER'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`card p-4 text-sm font-semibold transition ${format === f ? 'border-coral-400 ring-2 ring-coral-200' : ''}`}
            >
              {f === 'ONLINE' ? '💻 Online' : f === 'IN_PERSON' ? '🤝 In person' : '✨ Either'}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="label mb-3">Availability</h2>
        <p className="text-xs text-ink-400 mb-2">Days</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => toggle(days, setDays, d)}
              aria-pressed={days.includes(d)}
              className={`chip border ${days.includes(d) ? 'bg-ink-900 text-cream-50 border-ink-900' : 'bg-white border-ink-200'}`}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-400 mb-2">Time of day</p>
        <div className="flex flex-wrap gap-2">
          {PARTS.map((p) => (
            <button
              key={p}
              onClick={() => toggle(dayParts, setDayParts, p)}
              aria-pressed={dayParts.includes(p)}
              className={`chip border ${dayParts.includes(p) ? 'bg-ink-900 text-cream-50 border-ink-900' : 'bg-white border-ink-200'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="btn-primary">Save settings</button>
        {saved && <span className="text-sm text-mint-500 font-medium">Saved ✓</span>}
      </div>

      <div className="card p-6">
        <h2 className="label mb-3">Community guidelines</h2>
        <ul className="text-sm text-ink-500 space-y-2 list-disc list-inside">
          <li>Be generous — share what you know honestly and patiently.</li>
          <li>Be reliable — show up to sessions or cancel ahead of time.</li>
          <li>Be respectful — no harassment, spam, or solicitation.</li>
          <li>Be safe — meet in public places for in-person sessions.</li>
          <li>Report anyone who violates these guidelines.</li>
        </ul>
      </div>
    </div>
  );
}
