import { initAccount } from './account.js';
import { initCheckout, openCheckout } from './checkout.js';
import { escapeHTML, plural, raiseToTop, usd } from './utils.js';

export const CATEGORIES = Object.freeze({
  COLLAB: 'Коллаборация',
  RETRO: 'Ретро',
});

const ALL = 'Все';
const STORAGE_KEY = 'jordan-core:v1';
const JUST_DROPPED_DAYS = 14;

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

const $ = (selector, root = document) => root.querySelector(selector);

const dom = {
  header: $('[data-header]'),
  grid: $('[data-product-grid]'),
  filters: $('[data-filters]'),
  resultCount: $('[data-result-count]'),
  ticker: $('[data-ticker]'),
  nextDrop: $('[data-next-drop]'),
  statPairs: $('[data-stat-pairs]'),
  bagToggle: $('[data-bag-toggle]'),
  bagPanel: $('[data-bag-panel]'),
  bagCount: $('[data-bag-count]'),
  bagLabel: $('[data-bag-label]'),
  toast: $('[data-toast]'),
};

let products = [];
const byId = new Map();
const state = {
  filter: ALL,
  bag: new Set(),
  reminders: new Set()
};

const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function releaseInfo(iso) {
  if (!iso) return { kind: 'released', days: 0, text: 'Уже в продаже' };
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date - today) / 86_400_000);
  if (days > 0) return { kind: 'upcoming', days, text: `Релиз через ${days} ${plural(days, ['день', 'дня', 'дней'])} · ${longDate.format(date)}` };
  if (days === 0) return { kind: 'upcoming', days, text: 'Релиз сегодня' };
  if (-days <= JUST_DROPPED_DAYS) return { kind: 'fresh', days, text: `Только что вышел · ${longDate.format(date)}` };
  return { kind: 'released', days, text: `Вышел ${longDate.format(date)}` };
}

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    const valid = (ids) => new Set((ids ?? []).filter((id) => byId.has(id)));
    return { bag: valid(raw.bag), reminders: valid(raw.reminders) };
  } catch {
    return { bag: new Set(), reminders: new Set() };
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bag: [...state.bag], reminders: [...state.reminders] }));
  } catch {}
}

let toastTimer = 0;
function toast(message) {
  dom.toast.textContent = message;
  raiseToTop(dom.toast);
  void dom.toast.offsetWidth;
  dom.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), 2600);
}

function sneakerSVG({ id, palette: c, name, nickname }) {
  if (!c) return '';
  const g = `g-${id}`;
  return `
  <svg viewBox="0 0 520 250" role="img" aria-label="${escapeHTML(`${name} «${nickname}»`)}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${g}-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".38"/>
        <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${g}-shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".22"/>
        <stop offset=".4" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".12"/>
      </linearGradient>
    </defs>
    <path d="M34 196c0 18 14 30 38 30h394c26 0 38-14 34-36H34z" fill="${c.outsole}"/>
    <path d="M70 214h380" stroke="#000" stroke-opacity=".18" stroke-width="3" stroke-dasharray="10 8" stroke-linecap="round"/>
    <path d="M36 168h462c6 10 4 20 2 24H34c-3-6-3-16 2-24z" fill="${c.midsole}"/>
    <path d="M40 180h456" stroke="#000" stroke-opacity=".08" stroke-width="2"/>
    <path d="M44 170c-6-32 0-68 16-88 12-14 36-18 58-14l32 8c20 18 46 26 72 22l36-28c12-8 28-6 34 6l20 34c38 12 98 22 140 30 34 6 50 18 48 30z" fill="${c.upper}"/>
    <path d="M392 132c38 4 78 10 96 18 10 6 14 14 12 20H380c-4-14 0-28 12-38z" fill="${c.overlay}"/>
    <path d="M44 170c-6-32 0-68 16-88 10-10 26-14 40-12-4 38 4 74 32 100z" fill="${c.overlay}"/>
    <path d="M222 98l36-28c12-8 28-6 34 6l26 42c-24 8-52 10-78 4z" fill="${c.overlay}"/>
    <g stroke="${c.laces}" stroke-width="7" stroke-linecap="round">
      <path d="M244 104l22-20"/><path d="M262 112l22-22"/><path d="M280 118l20-22"/><path d="M296 122l16-18"/>
    </g>
    <path d="M150 150c70 0 150-20 230-54-50 40-130 68-230 66z" fill="${c.accent}"/>
    <path d="M58 86l16-6 6 40-16 4z" fill="${c.accent}"/>
    <path d="M60 162h420" stroke="#000" stroke-opacity=".16" stroke-width="1.5" stroke-dasharray="4 6"/>
    <path d="M100 74c-4 38 4 74 32 96" stroke="#000" stroke-opacity=".14" stroke-width="1.5" stroke-dasharray="4 6" fill="none"/>
    <path d="M44 170c-6-32 0-68 16-88 12-14 36-18 58-14l32 8c20 18 46 26 72 22l36-28c12-8 28-6 34 6l20 34c38 12 98 22 140 30 34 6 50 18 48 30z" fill="url(#${g}-gloss)"/>
    <path d="M44 170c-6-32 0-68 16-88 12-14 36-18 58-14l32 8c20 18 46 26 72 22l36-28c12-8 28-6 34 6l20 34c38 12 98 22 140 30 34 6 50 18 48 30z" fill="url(#${g}-shade)"/>
  </svg>`;
}

function productVisual(product) {
  if (!product.image) return sneakerSVG(product);
  const [width, height] = product.imageSize ?? [900, 640];
  return `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(`${product.name} «${product.nickname}»`)}"
               width="${width}" height="${height}" loading="lazy" decoding="async" data-product-photo="${product.id}">`;
}

function handlePhotoError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.productPhoto) return;
  const product = byId.get(img.dataset.productPhoto);
  const card = img.closest('.product-card');
  if (!product || !card) return;
  card.classList.remove('has-photo');
  img.replaceWith(document.createRange().createContextualFragment(sneakerSVG(product)));
}

const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const ICON_BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/></svg>';

function actionState(product) {
  const upcoming = releaseInfo(product.releaseDate).kind === 'upcoming';
  const active = upcoming ? state.reminders.has(product.id) : state.bag.has(product.id);
  const label = upcoming ? (active ? 'Напомним' : 'Напомнить') : (active ? 'В корзине' : 'В корзину');
  const icon = active ? ICON_CHECK : (upcoming ? ICON_BELL : ICON_PLUS);
  return { upcoming, active, html: `${icon}<span>${label}</span>` };
}

function priceBlock(product) {
  const market = product.marketPrice
    ? `<dd class="text-lg font-bold text-infrared">≈ ${usd.format(product.marketPrice)}</dd>`
    : `<dd class="text-sm font-semibold text-white/50">формируется</dd>`;
  return `
    <dl class="flex gap-6">
      <div>
        <dt class="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Retail</dt>
        <dd class="text-lg font-bold">${usd.format(product.retailPrice)}</dd>
      </div>
      <div>
        <dt class="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Рынок</dt>
        ${market}
      </div>
    </dl>`;
}

function cardTemplate(product, index) {
  const rel = releaseInfo(product.releaseDate);
  const action = actionState(product);
  const isLarge = product.layout !== 'tile';
  const meta = [product.category, product.sku].filter(Boolean).map(escapeHTML).join(' · ');
  const titleSize = { feature: 'text-[1.75rem] sm:text-4xl lg:text-5xl', wide: 'text-2xl', tile: 'text-xl' }[product.layout || 'tile'];
  const badgeHtml = product.badge ? `<span class="card-badge">${escapeHTML(product.badge)}</span>` : '';

  return `
  <article class="product-card reveal${product.image ? ' has-photo' : ''}" data-layout="${product.layout}" data-id="${product.id}" style="--i:${index}" aria-labelledby="t-${product.id}">
    <header class="flex items-start justify-between gap-4 p-6 pb-0 sm:p-7 sm:pb-0">
      <div class="min-w-0">
        <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">${meta}</p>
        <h3 id="t-${product.id}" class="mt-3 font-extrabold leading-[1.02] tracking-tight ${titleSize}">
          ${escapeHTML(product.name)}
          <span class="mt-1 block font-black uppercase text-infrared">«${escapeHTML(product.nickname)}»</span>
        </h3>
      </div>
      ${badgeHtml}
    </header>
    <div class="sneaker-stage">
      <span class="card-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="sneaker">${productVisual(product)}</div>
      <div class="sneaker-shadow" aria-hidden="true"></div>
    </div>
    <footer class="flex flex-col gap-5 p-6 pt-0 sm:p-7 sm:pt-0">
      <p class="${isLarge ? 'max-w-[52ch]' : 'line-clamp-2'} text-sm leading-relaxed text-white/60">${escapeHTML(product.description)}</p>
      <p class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
        <span class="status-dot ${rel.kind === 'upcoming' ? 'is-upcoming' : ''}" aria-hidden="true"></span>${escapeHTML(rel.text)}
      </p>
      <div class="flex flex-wrap items-end justify-between gap-4">
        ${priceBlock(product)}
        <button type="button" class="card-action" data-action="toggle" data-id="${product.id}" aria-pressed="${action.active}"
                aria-label="${escapeHTML(`${action.upcoming ? 'Напомнить о релизе' : 'Добавить в корзину'}: ${product.name} «${product.nickname}»`)}">
          ${action.html}
        </button>
      </div>
    </footer>
  </article>`;
}

function visibleProducts() {
  return state.filter === ALL ? products : products.filter((p) => p.category === state.filter);
}

function renderGrid() {
  const list = visibleProducts();
  dom.grid.innerHTML = list.map(cardTemplate).join('');
  dom.resultCount.textContent = `${list.length} ${plural(list.length, ['пара', 'пары', 'пар'])}`;
  observeReveal(dom.grid.querySelectorAll('.reveal'));
}

function renderFilters() {
  const counts = products.reduce((acc, p) => acc.set(p.category, (acc.get(p.category) ?? 0) + 1), new Map());
  const options = [[ALL, products.length], ...Object.values(CATEGORIES).filter((c) => counts.has(c)).map((c) => [c, counts.get(c)])];

  dom.filters.innerHTML = options.map(([label, count]) => `
    <button type="button" class="chip" data-filter="${escapeHTML(label)}" aria-pressed="${label === state.filter}">
      ${escapeHTML(label)}<span class="chip-count">${count}</span>
    </button>`).join('');
}

function setFilter(filter) {
  if (filter === state.filter) return;
  state.filter = filter;
  dom.filters.querySelectorAll('[data-filter]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter)));
  renderGrid();
}

function renderTicker() {
  if (!products.length) return;
  const items = products.map((p) => `<span class="ticker-item">${escapeHTML(p.nickname)}</span>`).join('');
  dom.ticker.innerHTML = items.repeat(4);
}

function renderHeroMeta() {
  dom.statPairs.textContent = String(products.length).padStart(2, '0');
  const next = products
    .map((p) => ({ p, rel: releaseInfo(p.releaseDate) }))
    .filter(({ rel }) => rel.kind === 'upcoming')
    .sort((a, b) => a.rel.days - b.rel.days)[0];
  dom.nextDrop.textContent = next
    ? `Next drop: ${next.p.nickname} — ${next.rel.days > 0 ? `T-${next.rel.days}d` : 'сегодня'}`
    : 'Все релизы в продаже';
}

function renderBag() {
  const items = [...state.bag].map((id) => byId.get(id)).filter(Boolean);
  const total = items.reduce((sum, p) => sum + p.retailPrice, 0);
  const count = items.length;

  dom.bagCount.textContent = String(count);
  dom.bagLabel.textContent = `Корзина, ${count} ${plural(count, ['товар', 'товара', 'товаров'])}`;

  dom.bagPanel.innerHTML = count === 0
    ? '<p class="py-6 text-center text-sm text-white/50">Корзина пуста. Выберите пару из дропов.</p>'
    : `
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Ваш выбор</p>
      <ul>
        ${items.map((p) => `
          <li class="bag-item">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold">${escapeHTML(p.name)}</p>
              <p class="text-xs text-infrared">«${escapeHTML(p.nickname)}» · ${usd.format(p.retailPrice)}</p>
            </div>
            <button type="button" class="bag-remove" data-action="remove" data-id="${p.id}" aria-label="Убрать ${escapeHTML(p.nickname)} из корзины">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </li>`).join('')}
      </ul>
      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm text-white/60">Итого по retail</span>
        <span class="text-lg font-bold">${usd.format(total)}</span>
      </div>
      <button type="button" class="btn-primary mt-4 w-full" data-action="checkout">Оформить заказ</button>`;
}

function clearBag() {
  state.bag.clear();
  persist();
  renderBag();
  renderGrid();
}

function bumpCounter() {
  if (motion.matches) return;
  dom.bagCount.classList.remove('is-bumped');
  void dom.bagCount.offsetWidth;
  dom.bagCount.classList.add('is-bumped');
}

function toggleProduct(id) {
  const product = byId.get(id);
  if (!product) return;
  const { upcoming } = actionState(product);
  const set = upcoming ? state.reminders : state.bag;
  const added = !set.has(id);
  added ? set.add(id) : set.delete(id);
  persist();

  const button = dom.grid.querySelector(`[data-action="toggle"][data-id="${id}"]`);
  if (button) {
    const next = actionState(product);
    button.setAttribute('aria-pressed', String(next.active));
    button.innerHTML = next.html;
  }

  if (!upcoming) { renderBag(); if (added) bumpCounter(); }
  const name = `«${product.nickname}»`;
  toast(upcoming ? (added ? `Напомним о релизе ${name}` : `Напоминание о ${name} отключено`) : (added ? `${name} в корзине` : `${name} удалены из корзины`));
}

function setBagOpen(open) {
  dom.bagPanel.hidden = !open;
  dom.bagToggle.setAttribute('aria-expanded', String(open));
}

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;
        revealObserver.unobserve(target);
        target.classList.add('is-visible');
        const settle = () => target.classList.remove('reveal', 'is-visible');
        target.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform') settle(); }, { once: true });
        setTimeout(settle, 1400);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 })
  : null;

function observeReveal(nodes) {
  nodes.forEach((node) => {
    if (!revealObserver || motion.matches) node.classList.remove('reveal');
    else revealObserver.observe(node);
  });
}

function initTilt() {
  let active = null;
  let frame = 0;

  const reset = (card) => {
    if (!card) return;
    card.style.removeProperty('--mx');
    card.style.removeProperty('--my');
  };

  dom.grid.addEventListener('pointermove', (event) => {
    if (!finePointer.matches || motion.matches) return;
    const card = event.target.closest('.product-card');
    if (card !== active) { reset(active); active = card; }
    if (!card) return;

    const { clientX, clientY } = event;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--mx', x.toFixed(3));
      card.style.setProperty('--my', y.toFixed(3));
      card.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
  });

  dom.grid.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    reset(active);
    active = null;
  });
}

function bindEvents() {
  dom.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (btn) setFilter(btn.dataset.filter);
  });

  document.querySelectorAll('[data-filter-link]').forEach((link) => {
    link.addEventListener('click', () => setFilter(link.dataset.filterLink));
  });

  dom.grid.addEventListener('error', handlePhotoError, true);

  dom.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="toggle"]');
    if (btn) toggleProduct(btn.dataset.id);
  });

  dom.bagToggle.addEventListener('click', () => setBagOpen(dom.bagPanel.hidden));

  dom.bagPanel.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-action="remove"]');
    if (remove) {
      toggleProduct(remove.dataset.id);
      dom.bagToggle.focus();
      return;
    }
    if (e.target.closest('[data-action="checkout"]')) {
      setBagOpen(false);
      openCheckout();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dom.bagPanel.hidden && !e.target.closest('[data-bag-panel], [data-bag-toggle]')) setBagOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.bagPanel.hidden) { setBagOpen(false); dom.bagToggle.focus(); }
  });

  const onScroll = () => dom.header.classList.toggle('is-scrolled', window.scrollY > 16);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  motion.addEventListener('change', () => observeReveal(document.querySelectorAll('.reveal')));
}

async function init() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Ошибка сети');
    
    products = await response.json();
    
    products.forEach(p => byId.set(p.id, p));
    
    const saved = loadSaved();
    state.bag = saved.bag;
    state.reminders = saved.reminders;
    
    renderHeroMeta();
    renderTicker();
    renderFilters();
    renderGrid();
    renderBag();
    initTilt();
    bindEvents();
    initCheckout({
      toast,
      getItems: () => [...state.bag].map((id) => byId.get(id)).filter(Boolean),
      onOrderPlaced: clearBag,
    });
    initAccount({ toast });
    
  } catch (error) {
    console.error("Не удалось загрузить дропы:", error);
    dom.grid.innerHTML = '<p class="rounded-3xl bg-graphite-800 p-8 text-white/70">Каталог пуст или база данных недоступна. Добавьте товары через API.</p>';
  }
}

init();