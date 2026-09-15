import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const backdropSource = readFileSync(new URL('./backdrop.tsx', import.meta.url), 'utf8');

describe('NutreLuma v4 mobile backdrop', () => {
  it('renders the supplied portrait artwork as a subtle non-interactive theme layer', () => {
    expect(backdropSource).toContain("require('../assets/liquid-glass-bg.png')");
    expect(backdropSource).toContain('opacity: 0.12');
    expect(backdropSource).toContain('pointerEvents="none"');
  });
});
