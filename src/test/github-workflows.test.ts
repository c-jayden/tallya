import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GitHub release workflow', () => {
  const source = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');

  it('derives the release tag from package.json version', () => {
    expect(source).toContain("const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))");
    expect(source).toContain('const tagName = `v${pkg.version}`');
    expect(source).toContain('TAG_NAME=${tagName}');
  });

  it('uploads release assets directly to GitHub Release', () => {
    expect(source).toContain('gh release upload $env:TAG_NAME dist/release-assets/* --clobber');
    expect(source).toContain('"release", "create"');
  });

  it('collects NSIS, MSI, and portable zip assets', () => {
    expect(source).toContain('${prefix}_setup.exe');
    expect(source).toContain('${prefix}.msi');
    expect(source).toContain('${prefix}_portable.zip');
  });
});
