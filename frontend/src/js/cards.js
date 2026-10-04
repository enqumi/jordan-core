const BRANDS = [
  { name: 'Мир', test: /^220[0-4]/, lengths: [16, 17, 18, 19], cvc: 3 },
  { name: 'Visa', test: /^4/, lengths: [13, 16, 19], cvc: 3 },
  { name: 'Mastercard', test: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/, lengths: [16], cvc: 3 },
  { name: 'American Express', test: /^3[47]/, lengths: [15], cvc: 4 },
  { name: 'UnionPay', test: /^62/, lengths: [16, 17, 18, 19], cvc: 3 },
];
const FALLBACK = { name: 'Карта', lengths: [16], cvc: 3 };

export const digits = (value) => String(value).replace(/\D/g, '');

export function detectBrand(number) {
  const n = digits(number);
  return BRANDS.find((b) => b.test.test(n)) ?? FALLBACK;
}

export function luhn(number) {
  const n = digits(number);
  let sum = 0;
  for (let i = 0; i < n.length; i += 1) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return n.length > 0 && sum % 10 === 0;
}

export function formatNumber(value) {
  const n = digits(value);
  const brand = detectBrand(n);
  const max = Math.max(...brand.lengths);
  const clipped = n.slice(0, max);
  if (brand.name === 'American Express') {
    return [clipped.slice(0, 4), clipped.slice(4, 10), clipped.slice(10)].filter(Boolean).join(' ');
  }
  return clipped.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatExpiry(value) {
  const n = digits(value).slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
}

export function validateCard({ number, holder, expiry, cvc }) {
  const errors = {};
  const n = digits(number);
  const brand = detectBrand(n);

  if (!brand.lengths.includes(n.length) || !luhn(n)) errors.number = 'Проверьте номер карты';
  if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(holder.trim())) errors.holder = 'Имя латиницей, как на карте';

  const [mm, yy] = expiry.split('/');
  const month = Number(mm), year = 2000 + Number(yy);
  const now = new Date();
  if (!/^\d{2}\/\d{2}$/.test(expiry) || month < 1 || month > 12) errors.expiry = 'Формат ММ/ГГ';
  else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = 'Срок действия истёк';

  if (digits(cvc).length !== brand.cvc) errors.cvc = `${brand.cvc} цифры`;

  return {
    errors,
    card: { brand: brand.name, last4: n.slice(-4), holder: holder.trim(), expMonth: month, expYear: year },
  };
}
