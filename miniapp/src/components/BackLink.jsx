import { nativeBackButton } from '../lib/telegram.js';

export default function BackLink({ onBack }) {
  if (nativeBackButton || !onBack) return null;
  return (
    <button type="button" className="back-link" onClick={onBack}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      Назад
    </button>
  );
}
