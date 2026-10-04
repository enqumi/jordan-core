import { useCallback, useEffect, useState } from 'react';
import MainButton from '../components/MainButton.jsx';
import { ErrorState, OrderStatus, Spinner } from '../components/Status.jsx';
import { api } from '../lib/api.js';
import { usd } from '../lib/format.js';
import { useShop } from '../store.jsx';

const POLL_MS = 4000;
const dateTime = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Orders({ nav }) {
  const { authState } = useShop();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setOrders(await api('/api/orders'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { if (authState === 'ready') load(); }, [authState, load]);

  const processing = orders?.some((o) => o.status === 'processing');
  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [processing, load]);

  if (authState === 'loading') return <Spinner />;
  if (authState !== 'ready') {
    return (
      <div className="state">
        <p className="state-title">Заказы появятся после входа</p>
        <MainButton text="Войти" onClick={() => nav.goTab('profile')} />
      </div>
    );
  }
  if (error && !orders) return <ErrorState message={error} onRetry={load} />;
  if (!orders) return <Spinner label="Загружаем заказы…" />;
  if (!orders.length) {
    return (
      <div className="state">
        <p className="state-title">Заказов пока нет</p>
        <p>Первая пара ждёт тебя в дропах.</p>
        <MainButton text="Смотреть дропы" onClick={() => nav.goTab('drops')} />
      </div>
    );
  }

  return (
    <>
      <header className="page-head">
        <h1>Заказы</h1>
        <p className="muted">{processing ? 'Статусы обновляются автоматически' : 'Все заказы собраны'}</p>
      </header>
      <ul className="order-list">
        {orders.map((o) => (
          <li key={o.id} className="panel order">
            <div className="order-head">
              <strong>Заказ #{o.id}</strong>
              <OrderStatus status={o.status} />
            </div>
            <ul className="order-items">
              {o.items.map((i) => (
                <li key={i.id}><span>{i.name} «{i.nickname}»</span><span>{usd.format(i.price)}</span></li>
              ))}
            </ul>
            <div className="order-foot">
              <span className="muted">{dateTime.format(new Date(o.createdAt))} · {o.city} · {o.card.brand} •• {o.card.last4}</span>
              <strong>{usd.format(o.total)}</strong>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
