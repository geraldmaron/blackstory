/**
 * Display formatters for Data page units — currency, percent, rates, months.
 */
import type { DataValueUnit } from './types';

export function formatDataValue(value: number, unit: DataValueUnit): string {
  switch (unit) {
    case 'usd':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
    case 'per_100k':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} per 100k`;
    case 'months':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} mo`;
    default: {
      const _exhaustive: never = unit;
      return String(_exhaustive);
    }
  }
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}
