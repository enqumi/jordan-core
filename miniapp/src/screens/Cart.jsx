import MainButton from '../components/MainButton.jsx';
import { haptic } from '../lib/telegram.js';
import { imageUrl, plural, usd } from '../lib/format.js';
import { useShop } from '../store.jsx';

export default function Cart({ nav }) {
  const { cart, cartTotal, removeFromCart, authState } = useShop();

  if (!cart.length) {
    return (
      <div className="state">
        <p className="state-title">Корзина пуста</p>
        <p>Загляни в дропы — там есть что забрать.</p>
        <MainButton text="Смотреть дропы" onClick={() => nav.goTab('drops')} />
      </div>
    );
  }

  const checkout = () => {
    if (authState !== 'ready') { haptic.warning(); nav.goTab('profile'); return; }
    haptic.tap();
    nav.push('checkout');
  };

  return (
    <>
      <header className="page-head">
        <h1>Корзина</h1>
        <p className="muted">{cart.length} {plural(cart.length, ['пара', 'пары', 'пар'])}</p>
      </header>

      <ul className="cart-list">
        {cart.map((p) => (
          <li key={p.id} className="cart-item">
            <button type="button" className="cart-thumb" onClick={() => nav.push('product', { id: p.id })}
                    style={{ '--tint': p.palette?.overlay ?? '#2A2A31' }} aria-label={`Открыть ${p.nickname}`}>
              <img src={imageUrl(p.image)} alt="" />
            </button>
            <div className="cart-info">
              <p className="product-name">{p.name}</p>
              <p className="product-nick">{p.nickname}</p>
              <p><strong>{usd.format(p.retailPrice)}</strong></p>
            </div>
            <button type="button" className="icon-btn" aria-label={`Убрать ${p.nickname} из корзины`}
                    onClick={() => { haptic.tap(); removeFromCart(p.id); }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="summary">
        <span>Итого</span>
        <strong>{usd.format(cartTotal)}</strong>
      </div>
      {authState === 'guest' ? <p className="notice">Чтобы оформить заказ, войдите в профиле.</p> : null}

      <MainButton
        text={authState === 'guest' ? 'Войти и оформить' : `Оформить заказ · ${usd.format(cartTotal)}`}
        onClick={checkout}
        disabled={authState === 'loading'}
      />
    </>
  );
}
