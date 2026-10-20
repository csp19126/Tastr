import { CITIES, PRICE_BRACKET_VND, type Currency } from '@shared';

import i18n from './i18n';

export function formatPrice(amount: number, currency: Currency) {
  const lang = i18n.language === 'vi' ? 'vi-VN' : 'en-GB';
  try {
    return new Intl.NumberFormat(lang, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' || currency === 'KRW' || currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/** "$$" style, plus the VND band when that's the currency in use. */
export function priceSymbol(bracket: number | null | undefined) {
  return bracket ? '₫'.repeat(bracket) : '';
}

export function priceBand(bracket: number | null | undefined) {
  if (!bracket) return '';
  return `${priceSymbol(bracket)} · ${PRICE_BRACKET_VND[bracket as 1 | 2 | 3 | 4]}`;
}

export function formatDistance(km: number | null | undefined) {
  if (km == null) return '';
  if (km < 1) return i18n.t('discover.distanceM', { m: Math.max(10, Math.round((km * 1000) / 10) * 10) });
  return i18n.t('discover.distance', { km: km < 10 ? km.toFixed(1) : Math.round(km) });
}

export function cityName(id: string | undefined) {
  const c = CITIES.find((x) => x.id === id);
  if (!c) return '';
  return i18n.language === 'vi' ? c.nameVi : c.name;
}

export function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(i18n.language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Typed price ("45k", "45.000", "45,000") to a number. */
export function parseAmount(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  const k = s.endsWith('k');
  const digits = (k ? s.slice(0, -1) : s).replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) return null;
  return k ? n * 1000 : n;
}
