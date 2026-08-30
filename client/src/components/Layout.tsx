import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';
import { Avatar } from './ui';
import { MembershipBadge } from './membership';

function Bell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const data = await api.get<{ unread: number }>('/notifications');
        if (active) setUnread(data.unread);
      } catch {
        /* ignore */
      }
    };
    poll();
    const t = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);
  return (
    <NavLink
      to="/notifications"
      className="relative p-2 rounded-full hover:bg-ink-100/70"
      aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-coral-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </NavLink>
  );
}

const NAV_ITEMS: Array<[string, string, string]> = [
  ['Home', '/dashboard', '⌂'],
  ['Discover', '/discover', '✦'],
  ['Exchanges', '/exchanges', '⇄'],
  ['Requests', '/requests', '✉'],
  ['Profile', '/profile', '☺'],
];

export default function Layout() {
  const { me, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse-soft font-display text-2xl font-semibold">SkillSwap</div>
      </div>
    );
  }

  if (!me) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop top nav */}
      <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur border-b border-ink-100 hidden md:block">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
          <NavLink to="/dashboard" className="font-display text-xl font-bold tracking-tight">
            Skill<span className="text-coral-500">Swap</span>
          </NavLink>
          <nav className="flex gap-1 flex-1" aria-label="Main">
            {[
              ['Dashboard', '/dashboard'],
              ['Discover', '/discover'],
              ['Requests', '/requests'],
              ['Exchanges', '/exchanges'],
              ['Skills', '/skills'],
            ].map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-full text-sm font-medium transition ${
                    isActive ? 'bg-ink-900 text-cream-50' : 'text-ink-500 hover:bg-ink-100/70'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/membership"
              className={({ isActive }) =>
                `px-3 py-2 rounded-full text-sm font-medium transition ${
                  isActive ? 'bg-amber-100 text-amber-700' : 'text-amber-600 hover:bg-amber-50'
                }`
              }
              title="Membership"
            >
              ✦ {me.entitlement?.tier && me.entitlement.tier !== 'FREE' ? me.entitlement.tier[0] + me.entitlement.tier.slice(1).toLowerCase() : 'Upgrade'}
            </NavLink>
            {me.role === 'ADMIN' && (
              <NavLink to="/admin" className="px-3 py-2 rounded-full text-sm font-medium text-ink-500 hover:bg-ink-100/70">
                Admin
              </NavLink>
            )}
          </nav>
          <Bell />
          <NavLink to="/profile" aria-label="Your profile">
            <div className="flex items-center gap-2">
              <Avatar name={me.displayName} color={me.profile?.avatarColor} size="sm" />
              {me.entitlement?.tier && me.entitlement.tier !== 'FREE' && (
                <MembershipBadge tier={me.entitlement.tier} size="sm" />
              )}
            </div>
          </NavLink>
          <button onClick={() => logout()} className="btn-ghost text-xs">
            Log out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-ink-100 pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile"
      >
        <div className="grid grid-cols-5">
          {NAV_ITEMS.map(([label, to, icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                  isActive ? 'text-coral-500' : 'text-ink-400'
                }`
              }
            >
              <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
