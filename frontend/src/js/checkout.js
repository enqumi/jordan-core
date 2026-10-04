import { api } from './api.js';
import { requireAuth, onAuthChange, refreshAccountMenu, session } from './account.js';
import { detectBrand, digits, formatNumber, formatExpiry, validateCard } from './cards.js';
import { escapeHTML, plural, raiseToTop, usd } from './utils.js';

const WATCH_KEY = 'jordan-core:watch';
const DELIVERY_KEY = 'jordan-core:delivery';
const POLL_MS = 2500;

const STEPS = [
  { id: 'payment', label: 'Оплата' },
  { id: 'delivery', label: 'Доставка' },
  { id: 'review', label: 'Подтверждение' },
];

const $ = (selector, root = document) => root.querySelector(selector);

const dom = {
  dialog: $('[data-checkout-dialog]'),
  notices: $('[data-notices]'),
};

let ctx = { toast: () => {}, getItems: () => [], onOrderPlaced: () => {} };
let locations = null;
const co = {
  step: 'payment',
  items: [],
  cards: [],
  cardId: null,
  addingCard: false,
  delivery: { country: '', city: '', address: '' },
  order: null,
  busy: false,
};
const watching = new Map();

const ICON_CLOSE = '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const ICON_BOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/></svg>';
const ICON_TRASH = '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function stepper() {
  const current = STEPS.findIndex((s) => s.id === co.step);
  return `
    <ol class="stepper" aria-label="Шаги оформления">
      ${STEPS.map((s, i) => `
        <li class="stepper-item ${i < current ? 'is-done' : ''}" ${i === current ? 'aria-current="step"' : ''}>
          <span class="stepper-index">${i < current ? ICON_CHECK : String(i + 1).padStart(2, '0')}</span>
          <span>${s.label}</span>
        </li>`).join('')}
    </ol>`;
}

function summary() {
  const total = co.items.reduce((sum, p) => sum + p.retailPrice, 0);
  return `
    <aside class="checkout-summary" aria-label="Ваш заказ">
      <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">В заказе · ${co.items.length} ${plural(co.items.length, ['пара', 'пары', 'пар'])}</p>
      <ul class="mt-3">
        ${co.items.map((p) => `
          <li class="summary-item">
            ${p.image ? `<img src="${escapeHTML(p.image)}" alt="" width="64" height="46" loading="lazy">` : '<span class="summary-thumb" aria-hidden="true"></span>'}
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">${escapeHTML(p.name)}</p>
              <p class="text-xs text-infrared">«${escapeHTML(p.nickname)}»</p>
            </div>
            <span class="text-sm font-bold">${usd.format(p.retailPrice)}</span>
          </li>`).join('')}
      </ul>
      <dl class="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 text-sm">
        <div class="flex justify-between text-white/60"><dt>Доставка</dt><dd>Бесплатно</dd></div>
        <div class="flex items-baseline justify-between"><dt class="font-semibold">Итого</dt><dd class="text-2xl font-black">${usd.format(total)}</dd></div>
      </dl>
    </aside>`;
}

function cardPreview() {
  return `
    <div class="card-preview" data-card-preview data-brand="Карта" aria-hidden="true">
      <div class="flex items-start justify-between">
        <span class="card-chip"></span>
        <span class="card-brand" data-preview-brand>CARD</span>
      </div>
      <p class="card-number" data-preview-number>•••• •••• •••• ••••</p>
      <div class="flex items-end justify-between gap-4">
        <div class="min-w-0">
          <p class="card-caption">Держатель</p>
          <p class="card-value truncate" data-preview-holder>YOUR NAME</p>
        </div>
        <div class="text-right">
          <p class="card-caption">Срок</p>
          <p class="card-value" data-preview-exp>ММ/ГГ</p>
        </div>
      </div>
    </div>`;
}

function cardForm() {
  return `
    <form class="card-form" data-card-form novalidate>
      ${cardPreview()}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label class="field col-span-2 sm:col-span-4">
          <span class="field-label">Номер карты</span>
          <input class="field-input font-mono" name="number" inputmode="numeric" autocomplete="off" placeholder="4242 4242 4242 4242" required>
          <span class="field-error" data-error="number"></span>
        </label>
        <label class="field col-span-2">
          <span class="field-label">Имя на карте</span>
          <input class="field-input uppercase" name="holder" autocomplete="off" placeholder="ALI BEKOV" required>
          <span class="field-error" data-error="holder"></span>
        </label>
        <label class="field">
          <span class="field-label">Срок</span>
          <input class="field-input font-mono" name="expiry" inputmode="numeric" autocomplete="off" placeholder="ММ/ГГ" required>
          <span class="field-error" data-error="expiry"></span>
        </label>
        <label class="field">
          <span class="field-label">CVC</span>
          <input class="field-input font-mono" name="cvc" type="password" inputmode="numeric" autocomplete="off" placeholder="•••" maxlength="4" required>
          <span class="field-error" data-error="cvc"></span>
        </label>
      </div>
      <p class="demo-note">
        Демо-режим: деньги не списываются, номер карты не покидает браузер — сохраняются только последние 4 цифры.
        Тестовая карта: <button type="button" class="demo-fill" data-action="fill-demo">4242 4242 4242 4242</button>
      </p>
      <p class="form-error" data-form-error role="alert"></p>
      <div class="flex flex-wrap gap-3">
        <button type="submit" class="btn-primary flex-1">Сохранить карту</button>
        ${co.cards.length ? '<button type="button" class="btn-ghost" data-action="cancel-card">Отмена</button>' : ''}
      </div>
    </form>`;
}

function savedCards() {
  return `
    <fieldset>
      <legend class="sr-only">Сохранённые карты</legend>
      <div class="flex flex-col gap-3">
        ${co.cards.map((c) => `
          <div class="saved-card-row">
            <label class="saved-card">
              <input type="radio" name="card" value="${c.id}" ${c.id === co.cardId ? 'checked' : ''}>
              <span class="saved-card-brand" data-brand="${escapeHTML(c.brand)}">${escapeHTML(c.brand)}</span>
              <span class="min-w-0 flex-1">
                <span class="block font-mono text-sm font-semibold">•••• ${escapeHTML(c.last4)}</span>
                <span class="block truncate text-xs text-white/50">${escapeHTML(c.holder)} · до ${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)}</span>
              </span>
              <span class="radio-dot" aria-hidden="true"></span>
            </label>
            <button type="button" class="icon-button" data-action="delete-card" data-id="${c.id}" aria-label="Удалить карту •••• ${escapeHTML(c.last4)}">${ICON_TRASH}</button>
          </div>`).join('')}
      </div>
    </fieldset>
    <button type="button" class="add-card" data-action="add-card">+ Добавить карту</button>`;
}

function paymentStep() {
  return `
    <h3 class="step-title">Способ оплаты</h3>
    ${co.addingCard ? cardForm() : savedCards()}
    ${co.addingCard ? '' : `
      <div class="step-actions">
        <button type="button" class="btn-primary" data-action="next" ${co.cardId ? '' : 'disabled'}>Далее: доставка</button>
      </div>`}`;
}

function options(list, selected, placeholder) {
  return `<option value="" disabled ${selected ? '' : 'selected'}>${placeholder}</option>` +
    list.map((v) => `<option ${v === selected ? 'selected' : ''}>${escapeHTML(v)}</option>`).join('');
}

function deliveryStep() {
  const { country, city, address } = co.delivery;
  const cities = locations[country] ?? [];
  return `
    <h3 class="step-title">Куда доставить</h3>
    <form class="flex flex-col gap-4" data-delivery-form novalidate>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="field">
          <span class="field-label">Страна</span>
          <select class="field-input" name="country" required>${options(Object.keys(locations), country, 'Выберите страну')}</select>
        </label>
        <label class="field">
          <span class="field-label">Город</span>
          <select class="field-input" name="city" required ${country ? '' : 'disabled'}>${options(cities, city, country ? 'Выберите город' : 'Сначала страна')}</select>
        </label>
      </div>
      <label class="field">
        <span class="field-label">Адрес</span>
        <input class="field-input" name="address" autocomplete="street-address" placeholder="Улица, дом, квартира" value="${escapeHTML(address)}" required minlength="5" maxlength="200">
      </label>
      <p class="form-error" data-form-error role="alert"></p>
      <div class="step-actions">
        <button type="button" class="btn-ghost" data-action="back">Назад</button>
        <button type="submit" class="btn-primary">Далее: проверка</button>
      </div>
    </form>`;
}

function reviewStep() {
  const card = co.cards.find((c) => c.id === co.cardId);
  const { country, city, address } = co.delivery;
  const total = co.items.reduce((sum, p) => sum + p.retailPrice, 0);
  return `
    <h3 class="step-title">Проверьте заказ</h3>
    <div class="flex flex-col gap-3">
      <div class="review-block">
        <div>
          <p class="card-caption">Оплата</p>
          <p class="mt-1 font-semibold">${escapeHTML(card.brand)} <span class="font-mono">•••• ${escapeHTML(card.last4)}</span></p>
        </div>
        <button type="button" class="link-button" data-action="goto" data-step="payment">Изменить</button>
      </div>
      <div class="review-block">
        <div class="min-w-0">
          <p class="card-caption">Доставка</p>
          <p class="mt-1 font-semibold">${escapeHTML(country)}, ${escapeHTML(city)}</p>
          <p class="text-sm text-white/60">${escapeHTML(address)}</p>
        </div>
        <button type="button" class="link-button" data-action="goto" data-step="delivery">Изменить</button>
      </div>
    </div>
    <p class="form-error mt-4" data-form-error role="alert"></p>
    <div class="step-actions">
      <button type="button" class="btn-ghost" data-action="back">Назад</button>
      <button type="button" class="btn-primary" data-action="place" ${co.busy ? 'disabled' : ''}>
        ${co.busy ? 'Оформляем…' : `Оформить заказ · ${usd.format(total)}`}
      </button>
    </div>`;
}

function successView() {
  const o = co.order;
  const ready = o.status === 'ready';
  return `
    <div class="modal-body success-view">
      <button type="button" class="icon-button absolute right-5 top-5" data-action="close" aria-label="Закрыть">${ICON_CLOSE}</button>
      <span class="success-icon ${ready ? 'is-ready' : ''}" aria-hidden="true">${ready ? ICON_CHECK : ICON_BOX}</span>
      <p class="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-infrared">Заказ №${o.id}</p>
      <h2 id="checkout-title" class="mt-3 text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl" aria-live="polite">
        ${ready ? 'Ваш заказ готов!' : 'Заказ оформлен'}
      </h2>
      <p class="mx-auto mt-4 max-w-[42ch] text-sm leading-relaxed text-white/60">
        ${ready
          ? `Пара упакована и передана курьеру. Доставка: ${escapeHTML(o.city)}, ${escapeHTML(o.address)}.`
          : `Оплата ${escapeHTML(o.card.brand)} •••• ${escapeHTML(o.card.last4)} прошла. Собираем заказ — сообщим, как только он будет готов.`}
      </p>
      <div class="progress ${ready ? 'is-done' : ''}" role="progressbar" aria-label="Сборка заказа" ${ready ? 'aria-valuenow="100"' : ''} aria-valuemin="0" aria-valuemax="100"><span></span></div>
      <button type="button" class="btn-primary mt-8" data-action="close">Продолжить покупки</button>
    </div>`;
}

function render() {
  if (co.order) {
    dom.dialog.innerHTML = successView();
    return;
  }
  const body = { payment: paymentStep, delivery: deliveryStep, review: reviewStep }[co.step]();
  dom.dialog.innerHTML = `
    <div class="modal-body">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-infrared">/ Checkout</p>
          <h2 id="checkout-title" class="mt-3 text-3xl font-black uppercase leading-none tracking-tight">Оформление</h2>
        </div>
        <button type="button" class="icon-button" data-action="close" aria-label="Закрыть">${ICON_CLOSE}</button>
      </div>
      ${stepper()}
      <div class="checkout-grid">
        <section class="min-w-0" data-step-body>${body}</section>
        ${summary()}
      </div>
    </div>`;
}

function focusStep() {
  const target = $('[data-step-body] input:not([type="radio"]), [data-step-body] select, [data-step-body] input:checked, [data-step-body] .btn-primary', dom.dialog);
  target?.focus();
}

function goTo(step) {
  co.step = step;
  render();
  focusStep();
}

function updatePreview(form) {
  const number = digits(form.number.value);
  const brand = detectBrand(number);
  const preview = $('[data-card-preview]', form);
  preview.dataset.brand = brand.name;
  $('[data-preview-brand]', form).textContent = brand.name === 'Карта' ? 'CARD' : brand.name.toUpperCase();

  const template = brand.name === 'American Express' ? '•••• •••••• •••••' : '•••• •••• •••• ••••';
  let i = 0;
  $('[data-preview-number]', form).textContent = template.replace(/•/g, () => number[i++] ?? '•');
  $('[data-preview-holder]', form).textContent = form.holder.value.trim().toUpperCase() || 'YOUR NAME';
  $('[data-preview-exp]', form).textContent = form.expiry.value || 'ММ/ГГ';
  form.cvc.maxLength = brand.cvc;
}

function onCardInput(e) {
  const form = e.target.form;
  const input = e.target;
  if (input.name === 'number') input.value = formatNumber(input.value);
  if (input.name === 'expiry' && e.inputType !== 'deleteContentBackward') input.value = formatExpiry(input.value);
  if (input.name === 'cvc') input.value = digits(input.value);
  if (input.name === 'holder') input.value = input.value.replace(/[^A-Za-z .'-]/g, '');
  $(`[data-error="${input.name}"]`, form).textContent = '';
  input.removeAttribute('aria-invalid');
  updatePreview(form);
}

async function submitCard(form) {
  const { errors, card } = validateCard({
    number: form.number.value, holder: form.holder.value, expiry: form.expiry.value, cvc: form.cvc.value,
  });
  form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = errors[el.dataset.error] ?? ''; });
  form.querySelectorAll('input').forEach((el) => el.toggleAttribute('aria-invalid', Boolean(errors[el.name])));
  const firstInvalid = form.querySelector('[aria-invalid]');
  if (firstInvalid) { firstInvalid.focus(); return; }

  const submit = $('[type="submit"]', form);
  submit.disabled = true;
  submit.textContent = 'Сохраняем…';
  try {
    const saved = await api('/api/cards', { method: 'POST', body: card });
    co.cards.push(saved);
    co.cardId = saved.id;
    co.addingCard = false;
    ctx.toast(`Карта ${saved.brand} •••• ${saved.last4} добавлена`);
    render();
    $('.btn-primary[data-action="next"]', dom.dialog)?.focus();
  } catch (error) {
    $('[data-form-error]', form).textContent = error.message;
    submit.disabled = false;
    submit.textContent = 'Сохранить карту';
  }
}

async function deleteCard(id) {
  const card = co.cards.find((c) => c.id === id);
  if (!card) return;
  try {
    await api(`/api/cards/${id}`, { method: 'DELETE' });
    co.cards = co.cards.filter((c) => c.id !== id);
    if (co.cardId === id) co.cardId = co.cards.at(-1)?.id ?? null;
    co.addingCard = co.cards.length === 0;
    ctx.toast(`Карта •••• ${card.last4} удалена`);
    render();
    focusStep();
  } catch (error) {
    ctx.toast(error.message);
  }
}

function submitDelivery(form) {
  const error = $('[data-form-error]', form);
  const data = { country: form.country.value, city: form.city.value, address: form.address.value.trim() };
  const problem = !data.country ? ['country', 'Выберите страну']
    : !data.city ? ['city', 'Выберите город']
    : data.address.length < 5 ? ['address', 'Укажите улицу, дом и квартиру'] : null;
  if (problem) {
    error.textContent = problem[1];
    form[problem[0]].focus();
    return;
  }
  co.delivery = data;
  writeJSON(DELIVERY_KEY, data);
  goTo('review');
}

async function placeOrder() {
  if (co.busy) return;
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});

  co.busy = true;
  render();
  try {
    const order = await api('/api/orders', {
      method: 'POST',
      body: { productIds: co.items.map((p) => p.id), cardId: co.cardId, ...co.delivery },
    });
    co.order = order;
    co.busy = false;
    ctx.onOrderPlaced(order);
    watch(order.id);
    render();
    $('[data-action="close"].btn-primary', dom.dialog)?.focus();
    refreshAccountMenu();
  } catch (error) {
    co.busy = false;
    render();
    $('[data-form-error]', dom.dialog).textContent = error.message;
  }
}

function saveWatchList() {
  writeJSON(WATCH_KEY, [...watching.keys()]);
}

function watch(id) {
  if (watching.has(id)) return;
  watching.set(id, 0);
  saveWatchList();
  poll(id);
}

function unwatch(id) {
  clearTimeout(watching.get(id));
  watching.delete(id);
  saveWatchList();
}

function stopAll() {
  watching.forEach((timer) => clearTimeout(timer));
  watching.clear();
}

async function poll(id) {
  if (!watching.has(id)) return;
  try {
    const order = await api(`/api/orders/${id}`);
    if (order.status === 'ready') {
      unwatch(id);
      announceReady(order);
      return;
    }
  } catch (error) {
    if (error.status === 401 || error.status === 404) { unwatch(id); return; }
  }
  if (watching.has(id)) watching.set(id, setTimeout(() => poll(id), POLL_MS));
}

function notice({ title, text }) {
  const el = document.createElement('div');
  el.className = 'notice';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <span class="notice-icon" aria-hidden="true">${ICON_CHECK}</span>
    <div class="min-w-0 flex-1">
      <p class="font-bold">${escapeHTML(title)}</p>
      <p class="mt-1 text-sm text-white/60">${escapeHTML(text)}</p>
    </div>
    <button type="button" class="icon-button -mr-2 -mt-2" aria-label="Закрыть уведомление">${ICON_CLOSE}</button>`;
  const dismiss = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  };
  el.querySelector('button').addEventListener('click', dismiss);
  setTimeout(dismiss, 15000);
  dom.notices.prepend(el);
  raiseToTop(dom.notices);
}

function announceReady(order) {
  const title = `Ваш заказ №${order.id} готов!`;
  const names = order.items.map((i) => `«${i.nickname}»`).join(', ');
  const text = `${names} — уже едут в ${order.city}.`;

  notice({ title, text });
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(title, { body: text, tag: `order-${order.id}` }); } catch {}
  }

  if (co.order?.id === order.id) {
    co.order = order;
    if (dom.dialog.open) render();
  }
  refreshAccountMenu();
}

export async function openCheckout() {
  co.items = ctx.getItems();
  if (!co.items.length) { ctx.toast('Корзина пуста'); return; }

  const user = await requireAuth();
  if (!user) return;
  co.items = ctx.getItems();
  if (!co.items.length) return;

  try {
    const [cards, locs] = await Promise.all([api('/api/cards'), locations ?? api('/api/locations')]);
    co.cards = cards;
    locations = locs;
  } catch (error) {
    ctx.toast(error.message);
    return;
  }

  const saved = readJSON(DELIVERY_KEY, {});
  const country = locations[saved.country] ? saved.country : '';
  co.delivery = {
    country,
    city: country && locations[country].includes(saved.city) ? saved.city : '',
    address: typeof saved.address === 'string' ? saved.address : '',
  };
  co.step = 'payment';
  co.cardId = co.cards.at(-1)?.id ?? null;
  co.addingCard = co.cards.length === 0;
  co.order = null;
  co.busy = false;

  render();
  dom.dialog.setAttribute('aria-labelledby', 'checkout-title');
  dom.dialog.showModal();
  focusStep();
}

export function initCheckout(config) {
  ctx = config;

  dom.dialog.addEventListener('click', (e) => {
    if (e.target === dom.dialog) { dom.dialog.close(); return; }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'close': dom.dialog.close(); break;
      case 'next': goTo('delivery'); break;
      case 'back': goTo(co.step === 'review' ? 'delivery' : 'payment'); break;
      case 'goto': goTo(btn.dataset.step); break;
      case 'add-card': co.addingCard = true; render(); focusStep(); break;
      case 'cancel-card': co.addingCard = false; render(); focusStep(); break;
      case 'delete-card': deleteCard(Number(btn.dataset.id)); break;
      case 'place': placeOrder(); break;
      case 'fill-demo': {
        const form = $('[data-card-form]', dom.dialog);
        form.number.value = formatNumber('4242424242424242');
        form.expiry.value = '12/30';
        form.cvc.value = '123';
        if (!form.holder.value) form.holder.value = session.user?.name.match(/[A-Za-z .'-]+/)?.[0].trim() || 'DEMO USER';
        form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = ''; });
        updatePreview(form);
        break;
      }
    }
  });

  dom.dialog.addEventListener('change', (e) => {
    if (e.target.name === 'card') {
      co.cardId = Number(e.target.value);
      $('[data-action="next"]', dom.dialog)?.removeAttribute('disabled');
    }
    if (e.target.name === 'country') {
      const form = e.target.form;
      co.delivery = { ...co.delivery, country: e.target.value, city: '', address: form.address.value };
      form.city.innerHTML = options(locations[e.target.value] ?? [], '', 'Выберите город');
      form.city.disabled = false;
    }
  });

  dom.dialog.addEventListener('input', (e) => {
    if (e.target.form?.matches('[data-card-form]')) onCardInput(e);
  });

  dom.dialog.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.matches('[data-card-form]')) submitCard(e.target);
    if (e.target.matches('[data-delivery-form]')) submitDelivery(e.target);
  });

  onAuthChange((user) => {
    if (!user) {
      stopAll();
      writeJSON(WATCH_KEY, []);
      if (dom.dialog.open) dom.dialog.close();
      return;
    }
    readJSON(WATCH_KEY, []).filter(Number.isInteger).forEach(watch);
  });
}
