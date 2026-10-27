#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const targetResult = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
if (targetResult.error || targetResult.status !== 0) {
  throw new Error('Install Rust (rustc) before building the Plaid companion sidecar.');
}
const target = targetResult.stdout.match(/^host: (.+)$/m)?.[1];
if (!target) throw new Error('Could not determine the Rust host target.');

const root = resolve('..');
run('cargo', ['build', '--manifest-path', join(root, 'plaid-companion/Cargo.toml'), '--bin', 'plaid-companion'], { cwd: root });

const executable = join(root, 'plaid-companion/target/debug', `plaid-companion${target.includes('windows') ? '.exe' : ''}`);
run(process.execPath, [
  'scripts/package-plaid-companion.mjs', '--target', target,
  '--binary', executable,
  '--output-dir', '../plaid-companion/target/artifacts',
]);
