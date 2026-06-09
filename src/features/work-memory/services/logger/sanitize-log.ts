const PREVIEW_LIMIT = 500;
const REDACTED = '[redacted]';

const sensitiveKeyPattern = /api.?key|authorization|access.?token|token|cookie|secret/i;
const bearerPattern = /Bearer\s+[\w.+/=-]+/gi;
const skKeyPattern = /sk-[A-Za-z0-9_-]{8,}/g;
const longSecretPattern = /\b[A-Za-z0-9_-]{32,}\b/g;

export function sanitizeLogData<T>(value: T): T {
  return sanitizeValue(value, '') as T;
}

function sanitizeValue(value: unknown, key: string): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return redactByKey(key, value);
  }

  if (typeof value === 'string') {
    return sanitizeString(value, key);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey),
    ]),
  );
}

function redactByKey(key: string, value: unknown) {
  if (/authorization/i.test(key)) {
    return 'Bearer ****';
  }

  if (typeof value === 'string' && value.startsWith('sk-')) {
    return redactApiKey(value);
  }

  return REDACTED;
}

function sanitizeString(value: string, key: string) {
  const sanitized = value
    .replace(bearerPattern, 'Bearer ****')
    .replace(skKeyPattern, (match) => redactApiKey(match))
    .replace(longSecretPattern, (match) => {
      if (isLikelySafeLongString(match)) {
        return match;
      }

      return `****${match.slice(-4)}`;
    });

  return key === 'responsePreview' || key === 'bodyPreview' || key === 'outputPreview'
    ? truncate(sanitized, PREVIEW_LIMIT)
    : sanitized;
}

function redactApiKey(value: string) {
  return value.startsWith('sk-') ? `sk-****${value.slice(-4)}` : `****${value.slice(-4)}`;
}

function isLikelySafeLongString(value: string) {
  return /^\d+$/.test(value) || /^https?:/i.test(value);
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
