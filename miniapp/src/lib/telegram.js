import { useEffect, useRef } from 'react';

export const tg = window.Telegram?.WebApp;
export const inTelegram = Boolean(tg?.initData);
const supports = (version) => inTelegram && tg.isVersionAtLeast?.(version);

const BRAND_BG = '#0A0A0C';
const BRAND_RED = '#E0142A';

export function initTelegram() {
  if (!inTelegram) return;
  tg.ready();
  tg.expand();
  if (supports('6.1')) {
    tg.setHeaderColor(BRAND_BG);
    tg.setBackgroundColor(BRAND_BG);
  }
  if (supports('7.10')) tg.setBottomBarColor(BRAND_BG);
  if (supports('7.7')) tg.disableVerticalSwipes();
}

export function launchProductId() {
  return new URLSearchParams(window.location.search).get('product') || tg?.initDataUnsafe?.start_param || null;
}

export const haptic = {
  tap: () => supports('6.1') && tg.HapticFeedback.impactOccurred('light'),
  select: () => supports('6.1') && tg.HapticFeedback.selectionChanged(),
  success: () => supports('6.1') && tg.HapticFeedback.notificationOccurred('success'),
  error: () => supports('6.1') && tg.HapticFeedback.notificationOccurred('error'),
  warning: () => supports('6.1') && tg.HapticFeedback.notificationOccurred('warning'),
};

export function confirmDialog(message) {
  if (supports('6.2')) return new Promise((resolve) => tg.showConfirm(message, resolve));
  return Promise.resolve(window.confirm(message));
}

function useLatest(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return ref;
}

export const nativeBackButton = supports('6.1');

export function useBackButton(onBack) {
  const handler = useLatest(onBack);
  const visible = Boolean(onBack);
  useEffect(() => {
    if (!nativeBackButton || !visible) return undefined;
    const click = () => handler.current?.();
    tg.BackButton.onClick(click);
    tg.BackButton.show();
    return () => {
      tg.BackButton.offClick(click);
      tg.BackButton.hide();
    };
  }, [visible, handler]);
}

export const nativeMainButton = inTelegram;

export function useMainButton({ text, onClick, disabled = false, loading = false }) {
  const handler = useLatest(onClick);

  useEffect(() => {
    if (!nativeMainButton) return undefined;
    const click = () => {
      if (tg.MainButton.isActive && !tg.MainButton.isProgressVisible) handler.current?.();
    };
    tg.MainButton.onClick(click);
    return () => {
      tg.MainButton.offClick(click);
      tg.MainButton.hideProgress();
      tg.MainButton.hide();
    };
  }, [handler]);

  useEffect(() => {
    if (!nativeMainButton) return;
    tg.MainButton.setParams({
      text,
      is_visible: true,
      is_active: !disabled,
      color: disabled ? '#2A2A31' : BRAND_RED,
      text_color: disabled ? '#8A8A93' : '#FFFFFF',
    });
    if (loading) tg.MainButton.showProgress(false);
    else tg.MainButton.hideProgress();
  }, [text, disabled, loading]);
}
