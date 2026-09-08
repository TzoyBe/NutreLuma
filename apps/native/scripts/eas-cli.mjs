import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveEasEnvironment } from './eas-environment.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitResult = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
const gitRoot = gitResult.status === 0 ? gitResult.stdout.trim() : projectRoot;
const env = resolveEasEnvironment(process.env, projectRoot, gitRoot, path);
const command = process.platform === 'win32' ? process.execPath : 'npx';
const commandArgs = process.platform === 'win32'
  ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]
  : [];
const result = spawnSync(command, [...commandArgs, 'eas-cli@latest', ...process.argv.slice(2)], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
