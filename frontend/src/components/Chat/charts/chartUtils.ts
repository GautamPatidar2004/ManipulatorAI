import type { ChartDataPoint } from '../../../types/blocks';

export const ACCESSIBLE_PALETTE = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#e11d48', // Rose
  '#475569', // Slate
  '#4f46e5', // Indigo
];

export function getSeriesColor(index: number, customColor?: string): string {
  if (customColor && customColor.trim()) return customColor;
  return ACCESSIBLE_PALETTE[index % ACCESSIBLE_PALETTE.length];
}

export function formatChartValue(
  value: number | null | undefined,
  format: 'number' | 'currency' | 'percentage' = 'number',
  unit?: string
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'Unavailable';
  }

  let formatted = '';
  switch (format) {
    case 'percentage':
      formatted = `${value}%`;
      break;
    case 'currency':
      if (unit && (unit.includes('LPA') || unit.includes('Lakh'))) {
        formatted = `₹${value} ${unit}`;
      } else if (unit) {
        formatted = `${value} ${unit}`;
      } else {
        formatted = `₹${value.toLocaleString()}`;
      }
      break;
    case 'number':
    default:
      formatted = unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString();
      break;
  }

  return formatted;
}

export function validatePoints(points: unknown): { isValid: boolean; reason?: string } {
  if (!Array.isArray(points) || points.length === 0) {
    return { isValid: false, reason: 'Dataset contains no points.' };
  }

  if (points.length > 50) {
    return { isValid: false, reason: 'Dataset exceeds maximum allowed data points (50).' };
  }

  for (let i = 0; i < points.length; i++) {
    const pt = points[i] as ChartDataPoint;
    if (!pt || typeof pt !== 'object') {
      return { isValid: false, reason: `Invalid point structure at index ${i}.` };
    }
    if (!pt.label || typeof pt.label !== 'string' || pt.label.trim().length === 0) {
      return { isValid: false, reason: `Missing label for point at index ${i}.` };
    }
    if (pt.value !== null && pt.value !== undefined) {
      if (typeof pt.value !== 'number' || isNaN(pt.value) || !isFinite(pt.value)) {
        return { isValid: false, reason: `Invalid non-finite number for label '${pt.label}'.` };
      }
    }
  }

  return { isValid: true };
}
