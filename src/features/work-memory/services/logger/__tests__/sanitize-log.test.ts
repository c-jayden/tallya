import { describe, expect, it } from 'vitest';
import { sanitizeLogData } from '../sanitize-log';

describe('sanitizeLogData', () => {
  it('redacts API keys, Authorization headers, bearer tokens, and token fields', () => {
    const sanitized = sanitizeLogData({
      apiKey: 'sk-1234567890abcdef',
      headers: {
        Authorization: 'Bearer very-secret-token-value',
      },
      nested: {
        access_token: 'access-token-value',
        token: 'plain-token-value',
      },
      responsePreview:
        'service said Bearer hidden-token and echoed sk-abcdef1234567890 in the body',
    });
    const text = JSON.stringify(sanitized);

    expect(text).not.toContain('sk-1234567890abcdef');
    expect(text).not.toContain('very-secret-token-value');
    expect(text).not.toContain('access-token-value');
    expect(text).not.toContain('plain-token-value');
    expect(text).not.toContain('sk-abcdef1234567890');
    expect(text).toContain('Bearer ****');
  });

  it('truncates long previews after redaction', () => {
    const sanitized = sanitizeLogData({
      responsePreview: `${'x'.repeat(700)} sk-1234567890abcdef`,
    }) as { responsePreview: string };

    expect(sanitized.responsePreview.length).toBeLessThanOrEqual(500);
    expect(sanitized.responsePreview).not.toContain('sk-1234567890abcdef');
  });
});
