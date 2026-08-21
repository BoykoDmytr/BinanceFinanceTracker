const MONTHS_UK = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

const WEEKDAYS_UK_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function money(v: number, digits = 2): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const fixed = abs.toFixed(digits);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}$${grouped}${frac ? '.' + frac : ''}`;
}

export function moneySigned(v: number, digits = 2): string {
  return (v > 0 ? '+' : '') + money(v, digits);
}

export function num(v: number, digits = 0): string {
  const fixed = v.toFixed(digits);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return grouped + (frac ? '.' + frac : '');
}

export function pct(v: number, digits = 1): string {
  return (v * 100).toFixed(digits) + '%';
}

/** '2026-08-21' -> Date (локальний час, полудень — без сюрпризів з TZ) */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** '2026-08-21' -> '21 серпня' */
export function dateHuman(iso: string, withYear = false): string {
  const d = parseDate(iso);
  const base = `${d.getDate()} ${MONTHS_UK[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

/** '2026-08-21' -> 'Пт, 21 серпня' */
export function dateHumanWD(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAYS_UK_SHORT[d.getDay()]}, ${dateHuman(iso)}`;
}

/** '2026-08-21' -> '21.08' */
export function dateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

export function daysWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return 'днів';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дні';
  return 'днів';
}
