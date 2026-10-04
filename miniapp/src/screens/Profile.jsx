import { useEffect, useState } from 'react';
import CardForm from '../components/CardForm.jsx';
import { ErrorState, Spinner } from '../components/Status.jsx';
import { api } from '../lib/api.js';
import { confirmDialog, haptic, inTelegram, tg } from '../lib/telegram.js';
import { useShop } from '../store.jsx';

function SignInForm({ title, hint, submitText }) {
  const { signIn } = useShop();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      haptic.success();
    } catch (err) {
      haptic.error();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>{title}</h2>
      <p className="hint">{hint}</p>
      <label className="field">
        <span>Email</span>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>Пароль</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>{busy ? 'Проверяем…' : submitText}</button>
    </form>
  );
}

function Cards() {
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => api('/api/cards').then(setCards, (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (card) => {
    if (!(await confirmDialog(`Удалить карту ${card.brand} •• ${card.last4}?`))) return;
    try {
      await api(`/api/cards/${card.id}`, { method: 'DELETE' });
      haptic.success();
      setCards((cs) => cs.filter((c) => c.id !== card.id));
    } catch (e) {
      haptic.error();
      setError(e.message);
    }
  };

  if (error && !cards) return <ErrorState message={error} onRetry={load} />;
  if (!cards) return null;

  return (
    <section className="panel">
      <h2>Карты</h2>
      {cards.length ? (
        <ul className="saved-cards">
          {cards.map((c) => (
            <li key={c.id}>
              <span className="card-brand">{c.brand}</span>
              <span className="mono">•• {c.last4}</span>
              <span className="muted">{String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}</span>
              <button type="button" className="link-danger" onClick={() => remove(c)}>Удалить</button>
            </li>
          ))}
        </ul>
      ) : <p className="hint">Сохранённых карт нет.</p>}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {adding
        ? <CardForm onAdded={(card) => { setCards((cs) => [...cs, card]); setAdding(false); }} onCancel={() => setAdding(false)} />
        : <button type="button" className="btn btn-ghost btn-block" onClick={() => setAdding(true)}>+ Добавить карту</button>}
    </section>
  );
}

export default function Profile() {
  const { user, authState, authError, authenticate, signOut } = useShop();

  if (authState === 'loading') return <Spinner label="Входим…" />;
  if (authState === 'error') return <ErrorState message={authError} onRetry={authenticate} />;

  if (authState === 'guest') {
    return (
      <>
        <header className="page-head"><h1>Профиль</h1></header>
        <SignInForm
          title="Вход"
          hint="Откройте магазин через Telegram-бота — вход произойдёт автоматически. Или войдите аккаунтом сайта."
          submitText="Войти"
        />
      </>
    );
  }

  const photo = inTelegram ? tg.initDataUnsafe?.user?.photo_url : null;

  return (
    <>
      <header className="profile-head">
        <span className="avatar">{photo ? <img src={photo} alt="" /> : user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h1>{user.name}</h1>
          <p className="muted">{user.telegramOnly ? 'Вход через Telegram' : user.email}</p>
        </div>
      </header>

      <Cards key={user.id} />

      {inTelegram && user.telegramOnly ? (
        <SignInForm
          title="Есть аккаунт на сайте?"
          hint="Привяжите его, чтобы видеть здесь свои карты и заказы с сайта."
          submitText="Привязать аккаунт"
        />
      ) : null}

      {!inTelegram ? <button type="button" className="btn btn-ghost btn-block" onClick={signOut}>Выйти</button> : null}
    </>
  );
}
