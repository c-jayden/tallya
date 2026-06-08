import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

runNodeScript('node_modules/typescript/bin/tsc');
runNodeScript('node_modules/vite/bin/vite.js', ['build']);

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [join(rootDir, scriptPath), ...args], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
