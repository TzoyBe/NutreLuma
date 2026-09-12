#!/usr/bin/env node
// Sets the store version name (app.json's expo.version) so it changes on every
// production build, whether triggered locally, from the EAS dashboard, or via
// GitHub — not just when someone remembers to run `npm run build:android:production`.
//
// EAS's `autoIncrement` only bumps the platform build number (versionCode /
// CFBundleVersion), which is tracked remotely by EAS itself (appVersionSource:
// "remote" in eas.json) and therefore advances no matter who/what triggers the
// build. We piggyback on that same remote counter for the human-readable
// version instead of maintaining our own local one, which only advanced when
// this script happened to run.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const raw = fs.readFileSync(appJsonPath, 'utf8');
const config = JSON.parse(raw);

const current = config.expo.version;
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
if (!match) {
  throw new Error(`Cannot bump non-semver version "${current}" in app.json`);
}
const [, major, minor] = match;

function nextPatchFromRemoteBuildNumber() {
  const result = spawnSync(
    'npx',
    ['eas-cli', 'build:version:get', '--platform', 'android', '--non-interactive', '--json'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8', shell: process.platform === 'win32' },
  );
  if (result.status !== 0) {
    throw new Error(`eas build:version:get failed: ${result.stderr || result.stdout}`);
  }
  // Some CLI versions print informational lines before the (pretty-printed,
  // multi-line) JSON payload, so slice from the first `{` to the last `}`.
  const start = result.stdout.indexOf('{');
  const end = result.stdout.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find JSON output in: ${result.stdout}`);
  }
  const { versionCode } = JSON.parse(result.stdout.slice(start, end + 1));
  const currentCode = Number.parseInt(versionCode, 10);
  if (!Number.isFinite(currentCode)) {
    throw new Error(`Unexpected versionCode from EAS: ${versionCode}`);
  }
  // This build will consume currentCode + 1 (EAS increments it during the build).
  return currentCode + 1;
}

let patch;
try {
  patch = nextPatchFromRemoteBuildNumber();
} catch (error) {
  console.warn(`Falling back to local patch bump (${error.message})`);
  patch = Number(match[3]) + 1;
}

const next = `${major}.${minor}.${patch}`;
const updatedRaw = raw.replace(`"version": "${current}"`, `"version": "${next}"`);
if (updatedRaw === raw) {
  throw new Error('Failed to update version string in app.json (pattern not found)');
}
fs.writeFileSync(appJsonPath, updatedRaw);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageRaw = fs.readFileSync(packageJsonPath, 'utf8');
const packageConfig = JSON.parse(packageRaw);
if (packageConfig.version === current) {
  fs.writeFileSync(packageJsonPath, packageRaw.replace(`"version": "${current}"`, `"version": "${next}"`));
}

console.log(`Set native app version: ${current} -> ${next}`);
