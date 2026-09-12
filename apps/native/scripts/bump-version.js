#!/usr/bin/env node
// Bumps the patch component of the store version name (app.json's expo.version).
// EAS's `autoIncrement` only increments the platform build number (versionCode /
// CFBundleVersion); the human-readable version name never changes on its own.
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
const [, major, minor, patch] = match;
const next = `${major}.${minor}.${Number(patch) + 1}`;

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

console.log(`Bumped native app version: ${current} -> ${next}`);
