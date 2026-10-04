import BackLink from '../components/BackLink.jsx';
import MainButton from '../components/MainButton.jsx';
import { haptic } from '../lib/telegram.js';
import { humanDate, imageUrl, isReleased, usd } from '../lib/format.js';
import { useShop } from '../store.jsx';

export default function Product({ nav, id }) {
  const { productById, inCart, addToCart, removeFromCart } = useShop();
  const p = productById(id);
  if (!p) return <p className="state">Товар не найден</p>;

  const released = isReleased(p);
  const added = inCart(p.id);

  let action;
  if (!released) action = { text: `Релиз ${humanDate(p.releaseDate)}`, disabled: true };
  else if (added) action = { text: 'Перейти в корзину', onClick: () => nav.goTab('cart') };
  else action = { text: `Добавить в корзину · ${usd.format(p.retailPrice)}`, onClick: () => { haptic.success(); addToCart(p.id); } };

  return (
    <article className="product-page">
      <BackLink onBack={nav.pop} />
      <div className="product-hero" style={{ '--tint': p.palette?.overlay ?? '#2A2A31', '--accent': p.palette?.accent ?? '#FF2D3D' }}>
        <img src={imageUrl(p.image)} alt={`${p.name} «${p.nickname}»`} width={p.imageSize?.[0]} height={p.imageSize?.[1]} />
      </div>

      <div className="product-body">
        <p className="eyebrow">{p.category}{p.badge ? ` · ${p.badge}` : ''}</p>
        <h1>{p.name}</h1>
        <p className="product-nick-lg">«{p.nickname}»</p>

        <dl className="specs">
          <div><dt>Ретейл</dt><dd>{usd.format(p.retailPrice)}</dd></div>
          {p.marketPrice ? <div><dt>Ресейл</dt><dd className="accent">{usd.format(p.marketPrice)}</dd></div> : null}
          <div><dt>{released ? 'Вышел' : 'Релиз'}</dt><dd>{humanDate(p.releaseDate)}</dd></div>
          {p.sku ? <div><dt>Артикул</dt><dd className="mono">{p.sku}</dd></div> : null}
        </dl>

        <p className="description">{p.description}</p>

        {!released ? <p className="notice">Покупка откроется в день релиза.</p> : null}
        {added ? (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => { haptic.tap(); removeFromCart(p.id); }}>
            Убрать из корзины
          </button>
        ) : null}
      </div>

      <MainButton {...action} />
    </article>
  );
}
