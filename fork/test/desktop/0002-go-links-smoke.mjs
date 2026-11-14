// fork(0002): go links, end to end in the real (dev) app.
//
//   node fork/test/desktop/run.mjs        (every fork end-to-end test)
//   node fork/test/desktop/0002-go-links-smoke.mjs
//
// Launches `electron .` with BLANC_TEST=1 and a throwaway profile (never the
// real one; safe while the installed Blanc is open). Typing goes through the
// real Island input and Enter key handling; main records where Enter would
// navigate (upstream's captureSearchNavigation) instead of loading it. The
// clicked-link check loads a page from a local server whose link points at
// http://go/…, and checks the tab lands on the local stand-in for the go-link
// address. Nothing leaves this machine.
//
// Agents can't run this from their sandbox (it blocks Chromium's startup);
// the person runs it and the agent reads the result file it prints.
import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { callTestHook } = require('../../../test/desktop/support/test-hook-call.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'blanc-fork-0002-'));
const userData = path.join(work, 'profile');
const resultFile = path.join(os.tmpdir(), 'blanc-fork-0002-go-links-smoke.json');

// Local stand-in for the go-link service, and a page with go/ links on it.
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/golink/')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><title>golink ${req.url}</title><p>golink</p>`);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><title>links</title><a id="go" href="http://go/engine/x?y=1">go</a>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const template = `${base}/golink/%s`;
// An unpackaged run uses <userData>-Dev. Seed it: first run done, and go links
// on, so the go-link checks don't depend on the Settings UI (checked
// separately below).
fs.mkdirSync(`${userData}-Dev`, { recursive: true });
fs.writeFileSync(path.join(`${userData}-Dev`, 'settings.json'),
  JSON.stringify({ onboardingVersion: 1, usagePing: false, searchSuggestions: false, searchEngine: 'duckduckgo', goLinkTemplate: template }));

const checks = [];
const check = async (name, fn) => {
  try { await fn(); checks.push({ name, ok: true }); console.log(`ok   ${name}`); }
  catch (error) { checks.push({ name, ok: false, error: String(error?.message || error) }); console.log(`FAIL ${name}\n     ${error?.message || error}`); }
};

const waitFor = async (read, predicate, label, timeout = 8000) => {
  const start = Date.now();
  let value;
  while (Date.now() - start < timeout) {
    value = await read();
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${label}; last value: ${JSON.stringify(value)}`);
};

const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
let app;
let logs = '';
try {
  app = await _electron.launch({
    chromiumSandbox: true,
    args: [root, `--user-data-dir=${userData}`],
    env: { ...env, BLANC_TEST: '1' },
    cwd: root,
  });
  app.process().stdout?.on('data', (d) => { logs = (logs + d).slice(-20000); });
  app.process().stderr?.on('data', (d) => { logs = (logs + d).slice(-20000); });
  await app.firstWindow();
  // Like upstream's acceptance harness: wait until startup has finished
  // (test hook installed, blocker-gated restore done) before driving the app.
  await app.evaluate(() => new Promise((resolve) => {
    const t = setInterval(() => {
      if (globalThis.__blancCall && globalThis.__blanc?.startupReady?.()) { clearInterval(t); resolve(); }
    }, 50);
  }));
  const call = (method, ...args) => callTestHook(app, method, args);
  const evaluate = (fn, arg) => app.evaluate(fn, arg);

  // Set the go-link address the way a person does: in Settings → Personal
  // fork, through the real field and its change event. Returns what main
  // stored and whether the field shows its error.
  const inSettings = async (script) => {
    const id = await call('utilitySheetContentsId');
    return evaluate(({ webContents }, { id: wcId, js }) => webContents.fromId(wcId).executeJavaScript(js), { id, js: script });
  };
  const setGoLinks = async (value) => {
    await call('closeOverlay');
    await call('openSettings');
    await waitFor(() => call('utilitySurface'), (s) => s?.visible && s.ready && s.url === 'blanc://settings/', 'the Settings sheet', 15000);
    await waitFor(() => inSettings('!!document.getElementById("fork-goLinkTemplate")'), Boolean, 'the Personal fork section');
    await inSettings(`(() => {
      const input = document.getElementById("fork-goLinkTemplate");
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 400));
    const shown = await inSettings('({ error: !document.getElementById("fork-goLinkTemplate-error").hidden, sidebar: !!document.querySelector(\'.settings-nav a[data-group="fork"]\'), before: document.getElementById("fork-goLinkTemplate").defaultValue })');
    await call('closeUtilitySurface');
    return shown;
  };

  // Type into the Island, press Enter, return where main recorded Enter going.
  const submit = async (text) => {
    await call('captureSearchNavigation', true);
    await call('openPalette');
    await waitFor(() => call('overlayMode'), (m) => m === 'palette', 'the command bar');
    assert.equal(await call('editAddressInput', text, 'insertText'), true, 'typed into the Island');
    // Let the panel draw its rows for the typed text, as a person would see them.
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(await call('pressAddressKey', 'Enter'), true, 'pressed Enter');
    return waitFor(() => call('capturedSearchSubmission'), (v) => v && v.url, `a submission for ${text}`);
  };

  await check('typed go/engine opens the go-link address (not the search engine)', async () => {
    const sub = await submit('go/engine');
    assert.equal(sub.url, `${base}/golink/engine`);
  });

  await check('typed go/foo/bar?x=1 keeps its path and query', async () => {
    const sub = await submit('go/foo/bar?x=1');
    assert.equal(sub.url, `${base}/golink/foo/bar?x=1`);
  });

  await check('go.dev/x is still an ordinary address', async () => {
    const sub = await submit('go.dev/x');
    assert.equal(sub.url, 'https://go.dev/x');
  });

  await check('a bang still wins over a go link (!yt go/x)', async () => {
    const sub = await submit('!yt go/x');
    assert.equal(sub.engine, 'bang');
    assert.match(sub.url, /youtube\.com/);
  });

  await check('a clicked http://go/… link is redirected to the go-link address', async () => {
    await call('captureSearchNavigation', false);
    await call('closeOverlay');
    const tabId = await call('openTab', `${base}/links`);
    await waitFor(() => call('tabUrl', tabId), (u) => u === `${base}/links`, 'the link page');
    await evaluate(({ webContents }, url) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL() === url);
      return wc.executeJavaScript('document.getElementById("go").click(); true');
    }, `${base}/links`);
    await waitFor(() => call('tabUrl', tabId), (u) => u === `${base}/golink/engine/x?y=1`, 'the go-link page');
  });

  await check('Settings → Personal fork shows the address and refuses an invalid one', async () => {
    await call('captureSearchNavigation', false);
    const bad = await setGoLinks('http://not-local.example/%s');
    assert.equal(bad.sidebar, true, 'the Personal fork sidebar link is shown');
    assert.equal(bad.error, true, 'the field shows its error for an invalid address');
    // The refused address must not replace the working one.
    const sub = await submit('go/engine');
    assert.equal(sub.url, `${base}/golink/engine`, 'go links still use the previous address');
  });

  await check('with the address cleared, go/engine is an ordinary search again', async () => {
    const cleared = await setGoLinks('');
    assert.equal(cleared.error, false, 'clearing is accepted');
    const sub = await submit('go/engine');
    assert.notEqual(sub.url, `${base}/golink/engine`);
    assert.match(sub.url, /duckduckgo\.com\/.*go%2Fengine/);
  });
} catch (error) {
  checks.push({ name: 'launch', ok: false, error: String(error?.stack || error) });
  console.log(`FAIL launch\n     ${error?.message || error}`);
} finally {
  await app?.close().catch(() => {});
  server.closeAllConnections?.();
  server.close();
  fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(resultFile, `${JSON.stringify({ test: '0002-go-links', ok: failed.length === 0, checks, logs: failed.length ? logs : '' }, null, 2)}\n`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed. Result: ${resultFile}`);
process.exitCode = failed.length ? 1 : 0;
