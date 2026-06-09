import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Kbd, KbdGroup } from '../kbd';

describe('Kbd', () => {
  it('renders lightweight keyboard keys', () => {
    const markup = renderToStaticMarkup(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>,
    );

    expect(markup).toContain('data-slot="kbd-group"');
    expect(markup).toContain('data-slot="kbd"');
    expect(markup).toContain('Ctrl');
    expect(markup).toContain('K');
  });
});
