import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

const NODES = [
  { name: 'Python', x: '8%', y: '18%', delay: '0s' },
  { name: 'Photography', x: '78%', y: '12%', delay: '0.8s' },
  { name: 'Figma', x: '85%', y: '58%', delay: '1.6s' },
  { name: 'French', x: '5%', y: '62%', delay: '2.4s' },
  { name: 'Guitar', x: '15%', y: '85%', delay: '1.2s' },
  { name: 'Excel', x: '70%', y: '85%', delay: '2s' },
];

function HeroConstellation() {
  return (
    <div className="relative h-[340px] md:h-[420px]" aria-hidden="true">
      <div className="absolute left-1/2 top-[16%] bottom-[16%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-coral-300 to-transparent" />
      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 text-center">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-ink-900 text-cream-50 flex items-center justify-center font-display font-bold text-lg shadow-lift">
          YOU
        </div>
        <span className="chip-teach mt-2 animate-fade-up">teaches Python</span>
      </div>
      <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-white border-2 border-mint-300 flex items-center justify-center font-display font-bold text-lg shadow-lift">
          SARAH
        </div>
        <span className="chip-want mt-2 animate-fade-up">teaches Photoshop</span>
      </div>
      <div className="absolute right-[18%] top-[46%] hidden md:block">
        <span className="chip bg-coral-500 text-white">= SKILL EXCHANGE</span>
      </div>
      {NODES.map((n) => (
        <button
          key={n.name}
          className="absolute animate-float cursor-default"
          style={{ left: n.x, top: n.y, animationDelay: n.delay }}
          tabIndex={-1}
        >
          <span className="chip bg-white shadow-soft border border-ink-100 text-ink-700">
            {n.name}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Landing() {
  const { me, loading } = useAuth();
  if (!loading && me) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen overflow-hidden">
      <header className="max-w-6xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        <div className="font-display text-2xl font-bold tracking-tight">
          Skill<span className="text-coral-500">Swap</span>
        </div>
        <div className="flex gap-2">
          <Link to="/login" className="btn-ghost">Log in</Link>
          <Link to="/signup" className="btn-dark">Get started</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-16 md:pt-16 md:pb-24">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="animate-fade-up">
            <span className="chip bg-mint-100 text-mint-500 mb-5">No money. No courses. Just skills.</span>
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-5">
              Trade what you know for what you want to learn.
            </h1>
            <p className="text-lg text-ink-400 max-w-md mb-8">
              Find someone who has the skill you need, offer something you know,
              and learn together.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary text-base px-7 py-3">
                Find your first match
              </Link>
              <Link to="/login" className="btn-outline text-base px-7 py-3">
                I already have an account
              </Link>
            </div>
          </div>
          <HeroConstellation />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-20">
        <h2 className="font-display text-3xl font-bold mb-10 text-center">
          Two people. Two skills. One swap.
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            ['1', 'Tell us your skills', 'What you can teach, and what you want to learn. Takes two minutes.'],
            ['2', 'Meet your matches', 'We pair you with people whose skills fit yours — and explain exactly why.'],
            ['3', 'Swap & learn', 'Send a request, schedule sessions, chat, and teach each other.'],
          ].map(([n, title, body]) => (
            <div key={n} className="card p-7 hover:shadow-lift hover:-translate-y-1 transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-coral-100 text-coral-600 font-display font-bold flex items-center justify-center mb-4">
                {n}
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
              <p className="text-sm text-ink-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-24">
        <div className="card p-8 md:p-12 bg-ink-900 text-cream-50 border-0">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-8 text-center">
            Some swaps happening right now
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              ['Python', 'Graphic Design'], ['Mathematics', 'Video Editing'],
              ['Photography', 'Excel'], ['Guitar', 'Web Development'],
              ['Public Speaking', 'Photoshop'], ['French', 'Programming'],
            ].map(([a, b]) => (
              <span key={a + b} className="chip bg-ink-800 text-cream-100 text-sm py-2 px-4">
                {a} <span className="text-coral-400 mx-1">↔</span> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8 text-center text-xs text-ink-300">
        SkillSwap — learn freely, teach generously.
      </footer>
    </div>
  );
}
