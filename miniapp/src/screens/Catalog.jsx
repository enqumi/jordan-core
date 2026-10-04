import { useState } from 'react';
import { ErrorState, Spinner } from '../components/Status.jsx';
import { haptic } from '../lib/telegram.js';
import { humanDate, imageUrl, isReleased, usd } from '../lib/format.js';
import { useShop } from '../store.jsx';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'Коллаборация', label: 'Коллаборации' },
  { id: 'Ретро', label: 'Ретро' },
];

export default function Catalog({ nav }) {
  const { products, catalogError, loadCatalog, inCart } = useShop();
  const [filter, setFilter] = useState('all');

  if (catalogError) return <ErrorState message={catalogError} onRetry={loadCatalog} />;
  if (!products) return <Spinner label="Загружаем дропы…" />;

  const visible = filter === 'all' ? products : products.filter((p) => p.category === filter);

  return (
    <>
      <header className="hero">
        <p className="logo">JORDAN<span>//</span>CORE</p>
        <h1>Flight Above All</h1>
        <p className="muted">Самые горячие релизы Air Jordan — коллаборации и ретро.</p>
      </header>

      <div className="chips" role="tablist" aria-label="Категории">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id}
                  className={`chip ${filter === f.id ? 'is-active' : ''}`}
                  onClick={() => { haptic.select(); setFilter(f.id); }}>
            {f.label}
          </button>
        ))}
      </div>

      <ul className="product-grid">
        {visible.map((p) => {
          const released = isReleased(p);
          return (
            <li key={p.id}>
              <button type="button" className="product-card" onClick={() => { haptic.tap(); nav.push('product', { id: p.id }); }}
                      style={{ '--tint': p.palette?.overlay ?? '#2A2A31' }}>
                <span className="product-media">
                  <img src={imageUrl(p.image)} alt="" loading="lazy" width={p.imageSize?.[0]} height={p.imageSize?.[1]} />
                  {p.badge ? <span className="badge">{p.badge}</span> : null}
                  {inCart(p.id) ? <span className="badge badge-cart">В корзине</span> : null}
                </span>
                <span className="product-info">
                  <span className="product-name">{p.name}</span>
                  <span className="product-nick">{p.nickname}</span>
                  <span className="product-meta">
                    <strong>{usd.format(p.retailPrice)}</strong>
                    <span className={released ? 'muted' : 'soon'}>{released ? p.category : `Релиз ${humanDate(p.releaseDate)}`}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
