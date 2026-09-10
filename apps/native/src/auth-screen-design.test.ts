import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

describe('native auth design', () => {
  it('uses the Personal Universe visual language instead of the legacy scan preview', () => {
    expect(appSource).toContain('PersonalUniverseStage');
    expect(appSource).toContain('Built around your patterns.');
    expect(appSource).toContain('Learning with you');
    expect(appSource).not.toContain('Lunch scan');
  });
});
