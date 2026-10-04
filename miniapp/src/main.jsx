import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ShopProvider } from './store.jsx';
import { initTelegram } from './lib/telegram.js';
import './styles.css';

initTelegram();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ShopProvider>
      <App />
    </ShopProvider>
  </StrictMode>,
);
