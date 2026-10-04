import { haptic } from '../lib/telegram.js';

const ICONS = {
  drops: <path d="M3 15.5c3.2 0 4.6-1.6 6.2-4.6l1.3-2.4c.4.9 1.2 1.6 2.3 1.6h1.4l6.3 3.2c.9.5 1.5 1.4 1.5 2.4v.8H3z M3 18.5h19" />,
  cart: <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9zM9 8V6.5a3 3 0 0 1 6 0V8" />,
  orders: <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />,
};

const TABS = [
  { id: 'drops', label: 'Дропы' },
  { id: 'cart', label: 'Корзина' },
  { id: 'orders', label: 'Заказы' },
  { id: 'profile', label: 'Профиль' },
];

export default function TabBar({ active, onChange, cartCount }) {
  return (
    <nav className="tab-bar" aria-label="Разделы">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab ${active === tab.id ? 'is-active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => { if (active !== tab.id) { haptic.select(); onChange(tab.id); } }}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[tab.id]}</svg>
            {tab.id === 'cart' && cartCount > 0 ? <span className="tab-badge">{cartCount}</span> : null}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
