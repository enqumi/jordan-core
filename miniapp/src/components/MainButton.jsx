import { nativeMainButton, useMainButton } from '../lib/telegram.js';

export default function MainButton({ text, onClick, disabled = false, loading = false }) {
  useMainButton({ text, onClick, disabled, loading });
  if (nativeMainButton) return null;

  return (
    <div className="main-button-dock">
      <button type="button" className="btn btn-primary btn-block" onClick={onClick} disabled={disabled || loading}>
        {loading ? <span className="spinner" aria-hidden="true" /> : null}
        {loading ? 'Подождите…' : text}
      </button>
    </div>
  );
}
