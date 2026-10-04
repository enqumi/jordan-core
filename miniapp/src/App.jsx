import { useCallback, useEffect, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import { launchProductId, useBackButton } from './lib/telegram.js';
import { useShop } from './store.jsx';
import Catalog from './screens/Catalog.jsx';
import Product from './screens/Product.jsx';
import Cart from './screens/Cart.jsx';
import Checkout from './screens/Checkout.jsx';
import OrderSuccess from './screens/OrderSuccess.jsx';
import Orders from './screens/Orders.jsx';
import Profile from './screens/Profile.jsx';

const TAB_SCREENS = { drops: Catalog, cart: Cart, orders: Orders, profile: Profile };
const STACK_SCREENS = { product: Product, checkout: Checkout, success: OrderSuccess };

export default function App() {
  const { cart, productById, products } = useShop();
  const [tab, setTab] = useState('drops');
  const [stack, setStack] = useState([]);

  const push = useCallback((name, params = {}) => setStack((s) => [...s, { name, params }]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const goTab = useCallback((next) => { setStack([]); setTab(next); }, []);
  const replace = useCallback((name, params = {}) => setStack([{ name, params }]), []);

  useEffect(() => {
    const id = launchProductId();
    if (products && id && productById(id)) push('product', { id });
  }, [Boolean(products)]);

  useBackButton(stack.length ? pop : null);

  useEffect(() => { window.scrollTo(0, 0); }, [tab, stack.length]);

  const top = stack.at(-1);
  const nav = { push, pop, goTab, replace };
  const Screen = top ? STACK_SCREENS[top.name] : TAB_SCREENS[tab];

  return (
    <div className={`app ${top ? '' : 'has-tabs'}`}>
      <main className="screen" key={top ? `${top.name}:${stack.length}` : tab}>
        <Screen nav={nav} {...(top?.params ?? {})} />
      </main>
      {top ? null : <TabBar active={tab} onChange={goTab} cartCount={cart.length} />}
    </div>
  );
}
