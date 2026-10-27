#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const targets = new Set([
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'x86_64-pc-windows-msvc',
  'x86_64-unknown-linux-gnu',
]);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const target = argument('--target');
const binaryArg = argument('--binary');
const outputArg = argument('--output-dir') ?? '../release-assets';
if (!targets.has(target)) {
  throw new Error(`Unsupported target '${target}'. Use one of: ${[...targets].join(', ')}`);
}
if (!binaryArg) throw new Error('Pass --binary with the built plaid-companion executable.');

const windows = target.endsWith('-windows-msvc');
const extension = windows ? '.exe' : '';
const source = resolve(binaryArg);
const outputDir = resolve(outputArg);
const sidecar = resolve('src-tauri/binaries', `plaid-companion-${target}${extension}`);
const standalone = resolve(outputDir, `plaid-companion-${target}${extension}`);

await readFile(source); // Fail before touching outputs when the build is missing.
await mkdir(dirname(sidecar), { recursive: true });
await mkdir(outputDir, { recursive: true });
await copyFile(source, sidecar);
await copyFile(source, standalone);
if (!windows) {
  await chmod(sidecar, 0o755);
  await chmod(standalone, 0o755);
}

const digest = createHash('sha256').update(await readFile(standalone)).digest('hex');
await writeFile(`${standalone}.sha256`, `${digest}  ${basename(standalone)}\n`);
console.log(`Staged Tauri sidecar: ${sidecar}`);
console.log(`Standalone download: ${standalone}`);
