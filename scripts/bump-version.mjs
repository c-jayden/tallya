// One-shot version bump: keeps package.json, src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml and src-tauri/Cargo.lock in lockstep (the release workflow
// rejects a mismatch). Usage: `pnpm bump 0.2.7`
//
// Uses targeted text replacement (not JSON re-serialization) so existing file
// formatting is preserved and the diff stays to the version line.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const nextVersion = process.argv[2];

if (!nextVersion || !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  console.error('用法: pnpm bump <version>，例如 pnpm bump 0.2.7');
  process.exit(1);
}

function replaceInFile(relativePath, pattern, replacement) {
  const path = new URL(relativePath, `file://${root}`);
  const original = readFileSync(path, 'utf8');
  const updated = original.replace(pattern, replacement);

  if (updated === original) {
    throw new Error(`未能在 ${relativePath} 中找到要替换的版本号`);
  }

  writeFileSync(path, updated);
}

// package.json + tauri.conf.json: the first (top-level) "version" field. Neither
// file has a nested "version" key, so the first match is the package version.
replaceInFile('package.json', /"version":\s*"[^"]+"/, `"version": "${nextVersion}"`);
replaceInFile('src-tauri/tauri.conf.json', /"version":\s*"[^"]+"/, `"version": "${nextVersion}"`);

// Cargo.toml: only the [package] version (line-start), never the inline
// dependency `version = "2"` strings.
replaceInFile('src-tauri/Cargo.toml', /^version = "[^"]+"/m, `version = "${nextVersion}"`);

// Cargo.lock: the tallya package entry, so the lockfile stays consistent without
// needing a network-bound `cargo update`.
replaceInFile('src-tauri/Cargo.lock', /(name = "tallya"\nversion = )"[^"]+"/, `$1"${nextVersion}"`);

console.log(`已将版本号更新为 ${nextVersion}（package.json / tauri.conf.json / Cargo.toml / Cargo.lock）。`);
console.log(`下一步：在 CHANGELOG.md 顶部加一段 ## ${nextVersion}，提交后打 tag 发版。`);
