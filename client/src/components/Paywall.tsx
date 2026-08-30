import { Link } from 'react-router-dom';

/**
 * Contextual upgrade screen (PRD §18, §34).
 * Shown when a Free user hits a real limit — never as an interruption.
 * Never blocks existing conversations or active exchanges.
 */
export function Paywall({
  headline,
  detail,
  onMaybeLater,
}: {
  headline: string;
  detail?: string;
  onMaybeLater?: () => void;
}) {
  return (
    <div className="card p-8 max-w-md mx-auto text-center my-8" role="dialog" aria-label="Upgrade options">
      <div className="text-3xl mb-3" aria-hidden="true">✳</div>
      <h3 className="font-display text-xl font-bold mb-2">{headline}</h3>
      {detail && <p className="text-sm text-ink-400 mb-6">{detail}</p>}
      <p className="text-xs text-ink-300 mb-5">Want to keep discovering?</p>
      <div className="space-y-2">
        <Link to="/membership" className="btn-gold w-full">
          View Gold — unlimited requests
        </Link>
        <Link to="/membership" className="btn-elite w-full">
          View Elite — highest priority
        </Link>
        <button
          className="btn-ghost text-xs w-full"
          onClick={onMaybeLater}
        >
          Maybe Later
        </button>
      </div>
      <p className="text-[10px] text-ink-300 mt-5">
        Your active exchanges and conversations always stay available.
      </p>
    </div>
  );
}

/** Shared handler for limit-reached API responses (HTTP 402). */
export function isLimitError(err: { status?: number; message?: string }): boolean {
  return err?.status === 402;
}
