import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, hasToken, setToken } from './lib/api.js';
import { inTelegram, tg } from './lib/telegram.js';

const ShopContext = createContext(null);
const CART_KEY = 'jordan-core:miniapp-cart';

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) ?? []; } catch { return []; }
}

export function ShopProvider({ children }) {
  const [products, setProducts] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [authError, setAuthError] = useState(null);
  const [cartIds, setCartIds] = useState(readCart);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      setProducts(await api('/api/products'));
    } catch (error) {
      setCatalogError(error.message);
    }
  }, []);

  const authenticate = useCallback(async () => {
    setAuthState('loading');
    setAuthError(null);
    try {
      if (inTelegram) {
        const { token, user: me } = await api('/api/auth/telegram', { method: 'POST', body: { initData: tg.initData } });
        setToken(token);
        setUser(me);
      } else if (hasToken()) {
        setUser(await api('/api/auth/me'));
      } else {
        setAuthState('guest');
        return;
      }
      setAuthState('ready');
    } catch (error) {
      if (!inTelegram && error instanceof ApiError && error.status === 401) {
        setToken(null);
        setAuthState('guest');
        return;
      }
      setAuthError(error.message);
      setAuthState('error');
    }
  }, []);

  useEffect(() => { loadCatalog(); authenticate(); }, [loadCatalog, authenticate]);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartIds)); } catch {}
  }, [cartIds]);

  const signIn = useCallback(async (email, password) => {
    const { token, user: me } = inTelegram
      ? await api('/api/auth/telegram/link', { method: 'POST', body: { initData: tg.initData, email, password } })
      : await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    setUser(me);
    setAuthState('ready');
  }, []);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setUser(null);
    setAuthState('guest');
  }, []);

  const value = useMemo(() => {
    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    const cart = products ? cartIds.map((id) => byId.get(id)).filter(Boolean) : [];
    return {
      products, catalogError, loadCatalog, productById: (id) => byId.get(id),
      user, authState, authError, authenticate, signIn, signOut,
      cart,
      cartTotal: cart.reduce((sum, p) => sum + p.retailPrice, 0),
      inCart: (id) => cartIds.includes(id),
      addToCart: (id) => setCartIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
      removeFromCart: (id) => setCartIds((ids) => ids.filter((x) => x !== id)),
      clearCart: () => setCartIds([]),
    };
  }, [products, catalogError, loadCatalog, user, authState, authError, authenticate, signIn, signOut, cartIds]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
