import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';

import { resolveEasEnvironment } from './eas-environment.mjs';

test('disables VCS when the project and Git roots use different Windows volumes', () => {
  const projectRoot = 'S:\\nutreluma\\apps\\native';
  const gitRoot = '\\\\tzoybe-nas\\Container\\nutreluma';

  const env = resolveEasEnvironment({}, projectRoot, gitRoot, path.win32);

  assert.equal(env.EAS_NO_VCS, '1');
  assert.equal(env.EAS_PROJECT_ROOT, projectRoot);
});

test('keeps the default EAS VCS behavior when Git can represent the app as a relative path', () => {
  const env = resolveEasEnvironment(
    { EXISTING: 'value' },
    'C:\\src\\nutreluma\\apps\\native',
    'C:\\src\\nutreluma',
    path.win32,
  );

  assert.deepEqual(env, { EXISTING: 'value' });
});
