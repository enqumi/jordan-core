import MainButton from '../components/MainButton.jsx';
import { inTelegram } from '../lib/telegram.js';
import { usd } from '../lib/format.js';

export default function OrderSuccess({ nav, order }) {
  return (
    <div className="state success">
      <span className="success-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <p className="state-title">Заказ #{order.id} оформлен</p>
      <p>
        {usd.format(order.total)} · {order.city}, {order.country}<br />
        {inTelegram ? 'Бот пришлёт сообщение, когда посылка будет собрана.' : 'Статус можно отслеживать во вкладке «Заказы».'}
      </p>
      <button type="button" className="btn btn-ghost" onClick={() => nav.goTab('drops')}>Вернуться к дропам</button>
      <MainButton text="Мои заказы" onClick={() => nav.goTab('orders')} />
    </div>
  );
}
