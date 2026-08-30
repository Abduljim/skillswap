import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

interface Stats {
  users: number;
  activeExchanges: number;
  completedExchanges: number;
  pendingReports: number;
  popularSkills: Array<{ name: string; category: string; count: number }>;
}

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  university?: string | null;
  exchanges: number;
}

interface AdminSkill {
  id: string;
  name: string;
  category: string;
  _count: { users: number };
}

interface AdminReport {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reporter: { displayName: string };
  target: { displayName: string; isActive: boolean };
}

export default function Admin() {
  const { me } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const page = path.includes('/admin/users') ? 'users'
    : path.includes('/admin/skills') ? 'skills'
    : path.includes('/admin/reports') ? 'reports' : 'dashboard';

  if (me && me.role !== 'ADMIN') {
    return (
      <div className="text-center py-16">
        <p className="text-ink-400 mb-4">Admin access required.</p>
        <Link to="/dashboard" className="btn-outline">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-3xl font-bold mb-4">Admin</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          ['Dashboard', '/admin', 'dashboard'],
          ['Users', '/admin/users', 'users'],
          ['Skills', '/admin/skills', 'skills'],
          ['Reports', '/admin/reports', 'reports'],
        ].map(([label, to, key]) => (
          <Link
            key={to}
            to={to}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
              page === key ? 'bg-ink-900 text-cream-50' : 'bg-white border border-ink-200 text-ink-500'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {page === 'dashboard' && <AdminDashboard />}
      {page === 'users' && <AdminUsers />}
      {page === 'skills' && <AdminSkills />}
      {page === 'reports' && <AdminReports />}
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    api.get<{ stats: Stats }>('/admin/stats').then((d) => setStats(d.stats)).catch(() => {});
  }, []);
  if (!stats) return <div className="skeleton h-64" />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Users', stats.users, 'text-coral-500'],
          ['Active exchanges', stats.activeExchanges, 'text-mint-500'],
          ['Completed exchanges', stats.completedExchanges, 'text-lavender-500'],
          ['Pending reports', stats.pendingReports, 'text-coral-600'],
        ].map(([label, value, color]) => (
          <div key={label as string} className="card p-5">
            <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-ink-400">{label}</p>
          </div>
        ))}
      </div>
      <div className="card p-6">
        <h2 className="label mb-3">Popular skills</h2>
        <div className="space-y-2">
          {stats.popularSkills.map((s) => (
            <div key={s.name} className="flex items-center gap-3 text-sm">
              <span className="w-32 font-medium truncate">{s.name}</span>
              <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full bg-coral-400 rounded-full"
                  style={{ width: `${(s.count / stats.popularSkills[0].count) * 100}%` }}
                />
              </div>
              <span className="text-xs text-ink-400 w-8 text-right">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const load = () => {
    api.get<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`).then((d) => setUsers(d.users)).catch(() => {});
  };
  useEffect(load, [q]);

  const toggleActive = async (u: AdminUser) => {
    await api.post(`/admin/users/${u.id}/${u.isActive ? 'deactivate' : 'reactivate'}`);
    load();
  };

  return (
    <div className="card p-5">
      <input className="input mb-4" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-ink-100">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {u.displayName}
                {u.role === 'ADMIN' && <span className="chip bg-lavender-100 text-lavender-500 ml-2">admin</span>}
              </p>
              <p className="text-xs text-ink-400 truncate">{u.email} · {u.university || '—'} · {u.exchanges} exchanges</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`chip ${u.isActive ? 'bg-mint-100 text-mint-500' : 'bg-ink-100 text-ink-400'}`}>
                {u.isActive ? 'active' : 'inactive'}
              </span>
              <button onClick={() => toggleActive(u)} className="btn-outline !py-1.5 !px-3 text-[10px]">
                {u.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSkills() {
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Technology');
  const [error, setError] = useState('');
  const load = () => {
    api.get<{ skills: AdminSkill[] }>('/admin/skills').then((d) => setSkills(d.skills)).catch(() => {});
  };
  useEffect(load, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/skills', { name, category });
      setName('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add skill');
    }
  };

  const remove = async (id: string) => {
    await api.del(`/admin/skills/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="label" htmlFor="sn">Skill name</label>
          <input id="sn" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="sc">Category</label>
          <select id="sc" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {['Technology', 'Design', 'Academic', 'Creative', 'Business', 'Languages', 'Lifestyle', 'Music', 'Communication'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Add skill</button>
      </form>
      {error && <p className="text-sm text-coral-600">{error}</p>}
      <div className="card p-5">
        <div className="grid sm:grid-cols-2 gap-2">
          {skills.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl border border-ink-100">
              <span className="text-sm">{s.name} <span className="text-xs text-ink-300">· {s.category} · {s._count.users} users</span></span>
              <button onClick={() => remove(s.id)} className="text-ink-300 hover:text-coral-600 text-xs" aria-label={`Delete ${s.name}`}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminReports() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const load = () => {
    api.get<{ reports: AdminReport[] }>('/admin/reports').then((d) => setReports(d.reports)).catch(() => {});
  };
  useEffect(load, []);

  const act = async (id: string, action: 'resolve' | 'dismiss') => {
    await api.post(`/admin/reports/${id}/${action}`);
    load();
  };

  if (reports.length === 0) {
    return <p className="text-sm text-ink-400 text-center py-10">No reports. The community is behaving. 🎉</p>;
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {r.reporter.displayName} reported {r.target.displayName}
              </p>
              <p className="text-sm text-ink-500 mt-1">
                <span className="font-medium">{r.reason}</span>
                {r.details ? ` — ${r.details}` : ''}
              </p>
              <p className="text-[10px] text-ink-300 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
            <span className={`chip ${
              r.status === 'PENDING' ? 'bg-coral-100 text-coral-600'
              : r.status === 'RESOLVED' ? 'bg-mint-100 text-mint-500'
              : 'bg-ink-100 text-ink-400'
            }`}>
              {r.status}
            </span>
          </div>
          {r.status === 'PENDING' && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => act(r.id, 'resolve')} className="btn-primary !py-2 text-xs">Resolve</button>
              <button onClick={() => act(r.id, 'dismiss')} className="btn-outline !py-2 text-xs">Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
