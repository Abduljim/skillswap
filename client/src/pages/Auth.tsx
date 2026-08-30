import { useState, FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="font-display text-2xl font-bold mb-8">
        Skill<span className="text-coral-500">Swap</span>
      </Link>
      <div className="card w-full max-w-md p-8 animate-fade-up">
        <h1 className="font-display text-2xl font-bold mb-1">{title}</h1>
        <p className="text-sm text-ink-400 mb-6">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { me, loading, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/login', { email, password });
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!loading && me) return <Navigate to="/dashboard" replace />;
  return (
    <Shell title="Welcome back" subtitle="Log in to continue your exchanges.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-coral-600" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="mt-4 flex justify-between text-xs text-ink-400">
        <Link to="/forgot-password" className="hover:text-ink-700">Forgot password?</Link>
        <Link to="/signup" className="hover:text-ink-700">Create account</Link>
      </div>
    </Shell>
  );
}

export function Signup() {
  const { me, loading, refresh } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/signup', { displayName, email, password });
      await refresh();
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!loading && me) return <Navigate to="/onboarding" replace />;
  return (
    <Shell title="Create your account" subtitle="Two minutes to your first skill exchange.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Display name</label>
          <input id="name" required minLength={2} className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-ink-300 mt-1">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-coral-600" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-xs text-ink-400 text-center">
        Already have an account? <Link to="/login" className="hover:text-ink-700">Log in</Link>
      </p>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ resetToken?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{ resetToken?: string }>('/auth/forgot-password', { email });
      setResult(data);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Reset your password" subtitle="We'll help you get back in.">
      {result ? (
        <div className="text-sm space-y-3">
          <p className="text-ink-500">If an account exists for {email}, a reset link has been generated.</p>
          {result.resetToken && (
            <p className="text-xs text-ink-400 break-all">
              Dev mode reset token:{' '}
              <Link to={`/reset-password?token=${result.resetToken}`} className="text-coral-600 font-semibold">
                open reset page →
              </Link>
            </p>
          )}
          <Link to="/login" className="btn-outline w-full">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Choose a new password" subtitle="Make it a good one.">
      {done ? (
        <div className="text-sm space-y-4">
          <p className="text-mint-500 font-medium">Password updated!</p>
          <Link to="/login" className="btn-primary w-full">Log in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="token">Reset token</label>
            <input id="token" required className="input" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input id="password" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-coral-600" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</button>
        </form>
      )}
    </Shell>
  );
}
