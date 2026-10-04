import { useEffect, useState } from 'react';
import BackLink from '../components/BackLink.jsx';
import CardForm from '../components/CardForm.jsx';
import MainButton from '../components/MainButton.jsx';
import { ErrorState, Spinner } from '../components/Status.jsx';
import { api } from '../lib/api.js';
import { haptic } from '../lib/telegram.js';
import { usd } from '../lib/format.js';
import { useShop } from '../store.jsx';

export default function Checkout({ nav }) {
  const { cart, cartTotal, clearCart } = useShop();
  const [locations, setLocations] = useState(null);
  const [cards, setCards] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [cardId, setCardId] = useState(null);
  const [addingCard, setAddingCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoadError(null);
    try {
      const [locs, myCards] = await Promise.all([api('/api/locations'), api('/api/cards')]);
      setLocations(locs);
      setCards(myCards);
      setCardId(myCards.at(-1)?.id ?? null);
      setAddingCard(myCards.length === 0);
      const first = Object.keys(locs)[0];
      setCountry(first);
      setCity(locs[first][0]);
    } catch (e) {
      setLoadError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  if (loadError) return <><BackLink onBack={nav.pop} /><ErrorState message={loadError} onRetry={load} /></>;
  if (!locations || !cards) return <Spinner label="Готовим оформление…" />;

  const ready = cart.length > 0 && cardId && address.trim().length >= 5 && city;

  const pay = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await api('/api/orders', {
        method: 'POST',
        body: { productIds: cart.map((p) => p.id), cardId, country, city, address: address.trim() },
      });
      haptic.success();
      clearCart();
      nav.replace('success', { order });
    } catch (e) {
      haptic.error();
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <BackLink onBack={nav.pop} />
      <header className="page-head">
        <h1>Оформление</h1>
        <p className="muted">{cart.map((p) => p.nickname).join(' · ')}</p>
      </header>

      <section className="panel">
        <h2>Доставка</h2>
        <label className="field">
          <span>Страна</span>
          <select value={country} onChange={(e) => { setCountry(e.target.value); setCity(locations[e.target.value][0]); }}>
            {Object.keys(locations).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Город</span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {locations[country].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Адрес</span>
          <textarea rows={2} placeholder="Улица, дом, квартира" value={address} maxLength={200}
                    onChange={(e) => setAddress(e.target.value)} />
          {address && address.trim().length < 5 ? <small className="error">Укажите адрес полностью</small> : null}
        </label>
      </section>

      <section className="panel">
        <h2>Оплата</h2>
        {cards.length ? (
          <div className="card-options" role="radiogroup" aria-label="Карта для оплаты">
            {cards.map((c) => (
              <label key={c.id} className={`card-option ${cardId === c.id ? 'is-active' : ''}`}>
                <input type="radio" name="card" checked={cardId === c.id} onChange={() => { haptic.select(); setCardId(c.id); }} />
                <span className="card-brand">{c.brand}</span>
                <span className="mono">•• {c.last4}</span>
                <span className="muted">{String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}</span>
              </label>
            ))}
          </div>
        ) : null}
        {addingCard ? (
          <CardForm
            onAdded={(card) => { setCards((cs) => [...cs, card]); setCardId(card.id); setAddingCard(false); }}
            onCancel={cards.length ? () => setAddingCard(false) : null}
          />
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setAddingCard(true)}>+ Новая карта</button>
        )}
      </section>

      <div className="summary">
        <span>К оплате</span>
        <strong>{usd.format(cartTotal)}</strong>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}

      <MainButton
        text={ready ? `Оплатить ${usd.format(cartTotal)}` : !cardId ? 'Добавьте карту' : 'Укажите адрес'}
        onClick={pay}
        disabled={!ready}
        loading={submitting}
      />
    </>
  );
}
