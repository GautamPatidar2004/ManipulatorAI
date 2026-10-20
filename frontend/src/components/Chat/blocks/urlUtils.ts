/**
 * Safe URL validator for evidence and reference links.
 * Strictly permits only http and https protocols to prevent XSS (e.g. javascript:, data:).
 */
export function isSafeHttpUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
