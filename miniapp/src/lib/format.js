export const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const humanDate = (iso) => dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00`)).replace(/\s?г\.$/, '');

export function isReleased(product) {
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return product.releaseDate <= local;
}

export const imageUrl = (path) => (path ? `/${path.replace(/^\.?\//, '')}` : '');

export function plural(n, [one, few, many]) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
