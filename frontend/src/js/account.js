import { api, getToken, setToken } from './api.js';
import { escapeHTML, plural, usd } from './utils.js';

const $ = (selector, root = document) => root.querySelector(selector);

const dom = {
  toggle: $('[data-account-toggle]'),
  panel: $('[data-account-panel]'),
  dialog: $('[data-auth-dialog]'),
};

const listeners = new Set();
export const session = { user: null };

let toast = () => {};
let mode = 'login';
let pendingAuth = null;

const ICON_CLOSE = '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export function onAuthChange(fn) {
  listeners.add(fn);
}

function setUser(user, token) {
  if (token !== undefined) setToken(token);
  session.user = user;
  renderToggle();
  listeners.forEach((fn) => fn(user));
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function renderToggle() {
  const { user } = session;
  dom.toggle.classList.toggle('is-signed-in', Boolean(user));
  dom.toggle.innerHTML = user
    ? `<span class="avatar" aria-hidden="true">${escapeHTML(initials(user.name))}</span>
       <span class="hidden max-w-[10ch] truncate sm:inline">${escapeHTML(user.name.split(' ')[0])}</span>`
    : `<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
       <span class="hidden sm:inline">Войти</span>`;
  dom.toggle.setAttribute('aria-label', user ? `Аккаунт: ${user.name}` : 'Войти в аккаунт');
  dom.toggle.setAttribute('aria-haspopup', user ? 'true' : 'dialog');
  if (!user) setMenuOpen(false);
}

const STATUS = {
  processing: '<span class="order-status">Собираем</span>',
  ready: '<span class="order-status is-ready">Готов</span>',
};

function orderRow(order) {
  const names = order.items.map((i) => `«${i.nickname}»`).join(', ');
  return `
    <li class="bag-item">
      <div class="min-w-0">
        <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Заказ №${order.id} · ${escapeHTML(order.city)}</p>
        <p class="mt-1 truncate text-sm font-semibold">${escapeHTML(names)}</p>
        <p class="text-xs text-white/50">${usd.format(order.total)} · ${escapeHTML(order.card.brand)} •••• ${escapeHTML(order.card.last4)}</p>
      </div>
      ${STATUS[order.status] ?? ''}
    </li>`;
}

async function renderMenu() {
  const { user } = session;
  dom.panel.innerHTML = `
    <div class="flex items-center gap-3 border-b border-white/10 pb-4">
      <span class="avatar avatar--lg" aria-hidden="true">${escapeHTML(initials(user.name))}</span>
      <div class="min-w-0">
        <p class="truncate font-semibold">${escapeHTML(user.name)}</p>
        <p class="truncate text-xs text-white/50">${escapeHTML(user.email)}</p>
      </div>
    </div>
    <p class="mb-1 mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Мои заказы</p>
    <div data-orders><p class="py-4 text-sm text-white/40">Загружаем…</p></div>
    <button type="button" class="btn-ghost mt-4 w-full" data-action="logout">Выйти</button>`;

  try {
    const orders = await api('/api/orders');
    const box = $('[data-orders]', dom.panel);
    if (!box) return;
    box.innerHTML = orders.length
      ? `<ul class="max-h-[40vh] overflow-y-auto">${orders.slice(0, 8).map(orderRow).join('')}</ul>
         ${orders.length > 8 ? `<p class="pt-2 text-xs text-white/40">и ещё ${orders.length - 8} ${plural(orders.length - 8, ['заказ', 'заказа', 'заказов'])}</p>` : ''}`
      : '<p class="py-4 text-sm text-white/50">Пока пусто. Самое время выбрать пару.</p>';
  } catch (error) {
    const box = $('[data-orders]', dom.panel);
    if (box) box.innerHTML = `<p class="py-4 text-sm text-white/50">${escapeHTML(error.message)}</p>`;
  }
}

function setMenuOpen(open) {
  dom.panel.hidden = !open;
  dom.toggle.setAttribute('aria-expanded', String(open));
  if (open) renderMenu();
}

export function refreshAccountMenu() {
  if (!dom.panel.hidden && session.user) renderMenu();
}

async function logout() {
  setMenuOpen(false);
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  setUser(null, null);
  toast('Вы вышли из аккаунта');
  dom.toggle.focus();
}

function field({ name, label, type = 'text', autocomplete, hint = '' }) {
  return `
    <label class="field">
      <span class="field-label">${label}</span>
      <input class="field-input" name="${name}" type="${type}" autocomplete="${autocomplete}" required
             ${type === 'password' ? 'minlength="6"' : ''} ${name === 'name' ? 'minlength="2" maxlength="60"' : ''}>
      ${hint ? `<span class="field-hint">${hint}</span>` : ''}
    </label>`;
}

function renderDialog() {
  const isLogin = mode === 'login';
  dom.dialog.innerHTML = `
    <div class="modal-body">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-infrared">/ Аккаунт</p>
          <h2 id="auth-title" class="mt-3 text-3xl font-black uppercase leading-none tracking-tight">${isLogin ? 'С возвращением' : 'Новый профиль'}</h2>
        </div>
        <button type="button" class="icon-button" data-action="close" aria-label="Закрыть">${ICON_CLOSE}</button>
      </div>

      <div class="segmented mt-6" role="tablist" aria-label="Способ входа">
        <button type="button" role="tab" aria-selected="${isLogin}" data-mode="login">Вход</button>
        <button type="button" role="tab" aria-selected="${!isLogin}" data-mode="register">Регистрация</button>
      </div>

      <form class="mt-6 flex flex-col gap-4" data-auth-form novalidate>
        ${isLogin ? '' : field({ name: 'name', label: 'Имя', autocomplete: 'name' })}
        ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
        ${field({ name: 'password', label: 'Пароль', type: 'password', autocomplete: isLogin ? 'current-password' : 'new-password', hint: isLogin ? '' : 'Минимум 6 символов' })}
        <p class="form-error" data-form-error role="alert"></p>
        <button type="submit" class="btn-primary mt-2 w-full">${isLogin ? 'Войти' : 'Создать аккаунт'}</button>
      </form>
    </div>`;
  dom.dialog.setAttribute('aria-labelledby', 'auth-title');
}

function openDialog(nextMode = 'login') {
  mode = nextMode;
  renderDialog();
  if (!dom.dialog.open) dom.dialog.showModal();
  $('input', dom.dialog)?.focus();
}

async function submitAuth(form) {
  const error = $('[data-form-error]', form);
  const submit = $('[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));

  if (!form.checkValidity()) {
    const invalid = form.querySelector(':invalid');
    error.textContent = invalid?.name === 'email' ? 'Введите корректный email'
      : invalid?.name === 'password' ? 'Пароль — минимум 6 символов'
      : invalid?.name === 'name' ? 'Введите имя' : 'Заполните все поля';
    invalid?.focus();
    return;
  }

  error.textContent = '';
  submit.disabled = true;
  submit.textContent = 'Секунду…';
  try {
    const { token, user } = await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', { method: 'POST', body: data });
    setUser(user, token);
    dom.dialog.close('success');
    toast(mode === 'login' ? `Привет, ${user.name.split(' ')[0]}!` : 'Аккаунт создан');
  } catch (err) {
    error.textContent = err.message;
    submit.disabled = false;
    submit.textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
  }
}

export function requireAuth() {
  if (session.user) return Promise.resolve(session.user);
  openDialog('login');
  return new Promise((resolve) => { pendingAuth = resolve; });
}

export async function initAccount(options) {
  toast = options.toast;
  renderToggle();

  dom.toggle.addEventListener('click', () => {
    if (session.user) setMenuOpen(dom.panel.hidden);
    else openDialog('login');
  });

  dom.panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="logout"]')) logout();
  });

  dom.dialog.addEventListener('click', (e) => {
    if (e.target === dom.dialog || e.target.closest('[data-action="close"]')) { dom.dialog.close(); return; }
    const tab = e.target.closest('[data-mode]');
    if (tab && tab.dataset.mode !== mode) openDialog(tab.dataset.mode);
  });

  dom.dialog.addEventListener('submit', (e) => {
    e.preventDefault();
    submitAuth(e.target);
  });

  dom.dialog.addEventListener('close', () => {
    const resolve = pendingAuth;
    pendingAuth = null;
    resolve?.(session.user);
  });

  document.addEventListener('click', (e) => {
    if (!dom.panel.hidden && !e.target.closest('[data-account-panel], [data-account-toggle]')) setMenuOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.panel.hidden) { setMenuOpen(false); dom.toggle.focus(); }
  });

  if (!getToken()) return;
  try {
    setUser(await api('/api/auth/me'));
  } catch (error) {
    if (error.status === 401) setToken(null);
  }
}
