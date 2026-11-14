// fork: run every fork end-to-end test (fork/test/desktop/*-smoke.mjs) in
// order and summarize. Each test launches the dev app with a throwaway
// profile and writes its own result JSON under the system temp folder.
//   node fork/test/desktop/run.mjs        all of them
//   node fork/test/desktop/run.mjs 0002   only files whose name contains 0002
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const filter = process.argv[2] || '';
const tests = fs.readdirSync(dir).filter((f) => f.endsWith('-smoke.mjs') && f.includes(filter)).sort();
const summary = [];
for (const test of tests) {
  console.log(`\n==> ${test}`);
  const run = spawnSync(process.execPath, [path.join(dir, test)], { stdio: 'inherit' });
  summary.push({ test, ok: run.status === 0 });
}
const file = path.join(os.tmpdir(), 'blanc-fork-desktop-tests.json');
fs.writeFileSync(file, `${JSON.stringify({ when: new Date().toISOString(), summary }, null, 2)}\n`);
console.log(`\n${summary.filter((s) => s.ok).length}/${summary.length} fork desktop tests passed. Summary: ${file}`);
process.exitCode = summary.every((s) => s.ok) ? 0 : 1;
