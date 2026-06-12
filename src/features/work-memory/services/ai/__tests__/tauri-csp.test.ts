import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Tauri CSP', () => {
  it('keeps the webview policy explicit and does not allow arbitrary HTTP connects', () => {
    const config = JSON.parse(
      readFileSync(
        new URL('../../../../../../src-tauri/tauri.conf.json', import.meta.url),
        'utf8',
      ),
    ) as { app?: { security?: { csp?: unknown; devCsp?: unknown } } };
    const csp = config.app?.security?.csp;

    expect(typeof csp).toBe('string');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self' ipc: http://ipc.localhost");
    expect(csp).not.toContain('http://localhost');
    expect(csp).not.toContain('http://127.0.0.1');
    expect(csp).not.toContain('https:');
    expect(config.app?.security?.devCsp).toContain('ws://localhost:1420');
  });
});
