'use strict';
// fork(0002): go links and the fork settings pattern.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const goLinks = require(path.join(root, 'src/main/fork/go-links'));
const forkSettings = require(path.join(root, 'src/main/fork/settings'));
const redirects = require(path.join(root, 'src/main/fork/request-redirects'));
const { isSuggestionEligible } = require(path.join(root, 'src/main/search-suggestions'));

const TPL = 'https://example.glean.com/go/%s';

test('typed go/<name> opens the go-link address, path and query kept unescaped', () => {
  assert.equal(goLinks.rewriteTypedGoLink('go/foo', TPL), 'https://example.glean.com/go/foo');
  assert.equal(goLinks.rewriteTypedGoLink('  go/foo/bar?x=1#y ', TPL), 'https://example.glean.com/go/foo/bar?x=1#y');
  assert.equal(goLinks.rewriteTypedGoLink('go/', TPL), 'https://example.glean.com/go/');
  assert.equal(goLinks.rewriteTypedGoLink('GO/Foo', TPL), 'https://example.glean.com/go/Foo');
  assert.equal(goLinks.rewriteTypedGoLink('go/$&$1', TPL), 'https://example.glean.com/go/$&$1');
  assert.equal(goLinks.rewriteTypedGoLink('go/x', 'https://q.example/?q=%s&src=blanc'), 'https://q.example/?q=x&src=blanc');
});

test('typed text that is not exactly go/… is left to upstream', () => {
  for (const text of ['go', 'go foo', 'go.dev/x', 'golang.org/x', 'gopher/x', 'ago/x', 'go/foo bar', 'https://go/x', '', null]) {
    assert.equal(goLinks.rewriteTypedGoLink(text, TPL), null, String(text));
  }
});

test('an empty or invalid go-link address turns go links off', () => {
  for (const tpl of ['', '   ', 'http://example.com/go/%s', 'https://example.com/go/', 'https://example.com/%s/%s', 'https://u:p@example.com/%s', undefined]) {
    assert.equal(goLinks.rewriteTypedGoLink('go/foo', tpl), null, String(tpl));
    assert.equal(goLinks.redirectGoLinkRequest('http://go/foo', tpl), null, String(tpl));
  }
  assert.equal(goLinks.rewriteTypedGoLink('go/foo', () => TPL), 'https://example.glean.com/go/foo');
});

test('requests to http(s)://go/… are redirected; nothing else is', () => {
  assert.equal(goLinks.redirectGoLinkRequest('http://go/foo', TPL), 'https://example.glean.com/go/foo');
  assert.equal(goLinks.redirectGoLinkRequest('https://GO/foo/bar?x=1#h', TPL), 'https://example.glean.com/go/foo/bar?x=1#h');
  assert.equal(goLinks.redirectGoLinkRequest('http://go/', TPL), 'https://example.glean.com/go/');
  for (const url of ['http://go.dev/foo', 'https://golang.org/x', 'http://go:8080/foo', 'http://u@go/foo', 'ftp://go/foo', 'blanc://go/foo', 'not a url']) {
    assert.equal(goLinks.redirectGoLinkRequest(url, TPL), null, url);
  }
  // Never redirect into another go/ host (no loop).
  assert.equal(goLinks.redirectGoLinkRequest('http://go/foo', 'http://go/%s'), null);
});

test('go/… text never goes to the search-suggestion provider', () => {
  assert.equal(goLinks.isGoLinkText('go/foo'), true);
  assert.equal(goLinks.isGoLinkText('go foo'), false);
  assert.equal(isSuggestionEligible('go/foo'), false);
  assert.equal(isSuggestionEligible('go/'), false);
  assert.equal(isSuggestionEligible('go fish'), true);
});

test('fork request redirects: main and sub frames only, broken rules ignored', () => {
  redirects.clearRedirectRules();
  try {
    assert.equal(redirects.redirectFor({ resourceType: 'mainFrame', url: 'http://go/a' }), null);
    redirects.addRedirectRule(() => { throw new Error('broken'); });
    redirects.addRedirectRule((d) => goLinks.redirectGoLinkRequest(d.url, TPL));
    assert.equal(redirects.redirectFor({ resourceType: 'mainFrame', url: 'http://go/a' }), 'https://example.glean.com/go/a');
    assert.equal(redirects.redirectFor({ resourceType: 'subFrame', url: 'http://go/a' }), 'https://example.glean.com/go/a');
    assert.equal(redirects.redirectFor({ resourceType: 'xhr', url: 'http://go/a' }), null);
    assert.equal(redirects.redirectFor({ resourceType: 'mainFrame', url: 'https://example.com/' }), null);
  } finally {
    redirects.clearRedirectRules();
  }
});

test('the blocking coordinator applies fork redirects before any blocker', async () => {
  const { createBlockingCoordinator } = require(path.join(root, 'src/main/blocking-coordinator'));
  redirects.clearRedirectRules();
  redirects.addRedirectRule((d) => goLinks.redirectGoLinkRequest(d.url, TPL));
  try {
    const listeners = {};
    const session = { webRequest: new Proxy({}, { get: (_t, name) => (_filter, fn) => { listeners[name] = fn; } }) };
    const coordinator = createBlockingCoordinator();
    coordinator.setProvider(session, { decide: async () => ({ cancel: true }) });
    const call = (details) => new Promise((resolve) => listeners.onBeforeRequest(details, resolve));
    assert.deepEqual(await call({ resourceType: 'mainFrame', url: 'http://go/foo' }), { redirectURL: 'https://example.glean.com/go/foo' });
    assert.deepEqual(await call({ resourceType: 'mainFrame', url: 'https://example.com/' }), { cancel: true });
  } finally {
    redirects.clearRedirectRules();
  }
});

test('fork settings: defaults, read and write validation', () => {
  assert.equal(forkSettings.FORK_DEFAULTS.goLinkTemplate, '');
  const read = forkSettings.readForkSettings({ goLinkTemplate: 'http://bad.example/%s' });
  assert.equal(read.goLinkTemplate, '');
  assert.equal(forkSettings.readForkSettings({ goLinkTemplate: TPL }).goLinkTemplate, TPL);
  assert.equal(forkSettings.readForkSettings({}).goLinkTemplate, '');
  assert.deepEqual(forkSettings.sanitizeForkSettings({ goLinkTemplate: `  ${TPL} ` }, {}), { goLinkTemplate: TPL });
  assert.deepEqual(forkSettings.sanitizeForkSettings({ goLinkTemplate: '' }, {}), { goLinkTemplate: '' });
  assert.deepEqual(forkSettings.sanitizeForkSettings({ goLinkTemplate: 'nope' }, {}), {});
  assert.deepEqual(forkSettings.sanitizeForkSettings({ other: 1 }, {}), {});
});

test('both ways the Island submits typed text reach the go-link hook', () => {
  // Enter on the panel's search row goes to tabs:search; Enter on address-
  // shaped text goes to navigateTabToAddress. go/name usually shows the search
  // row first, so missing the tabs:search hook sends go links to the engine.
  const source = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
  const search = source.slice(source.indexOf("chromeHandle('tabs:search'"), source.indexOf("chromeHandle('tabs:back'"));
  assert.ok(search.includes("rewriteTypedGoLink(query, () => settings.getSettings().goLinkTemplate)) return navigateTabToAddress(id, query); // fork(0002)"), 'tabs:search lost its go-link hook');
  assert.ok(search.indexOf('rewriteTypedGoLink(query') < search.indexOf('engine.url(query.trim())'), 'go-link hook must run before the engine search URL');
  assert.ok(search.indexOf('bangResolver.resolveTyped(query') < search.indexOf('rewriteTypedGoLink(query'), 'bangs still win');
  const typed = source.slice(source.indexOf('function navigateTabToAddress('), source.indexOf('function navigateTabToAddress(') + 4000);
  assert.match(typed, /rewriteTypedGoLink\(rawText,/);
});

test('upstream settings.js routes every fork setting through the fork module', () => {
  const source = fs.readFileSync(path.join(root, 'src/main/settings.js'), 'utf8');
  assert.match(source, /\.\.\.require\('\.\/fork\/settings'\)\.FORK_DEFAULTS, \/\/ fork\(0002\)/);
  assert.match(source, /require\('\.\/fork\/settings'\)\.readForkSettings\(data\); \/\/ fork\(0002\)/);
  assert.match(source, /require\('\.\/fork\/settings'\)\.sanitizeForkSettings\(partial, clean\); \/\/ fork\(0002\)/);
});

test('every fork setting has a UI entry, strings in every language, and a schema key', () => {
  const html = fs.readFileSync(path.join(root, 'src/renderer/pages/settings.html'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/renderer/pages/fork-settings.js'), 'utf8');
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'settings-schema/schema.json'), 'utf8'));
  const locales = fs.readdirSync(path.join(root, 'copy/messages')).filter((f) => f.endsWith('.json'));
  const catalogs = Object.fromEntries(locales.map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, 'copy/messages', f), 'utf8'))]));
  const keys = [...ui.matchAll(/'(fork\.[\w.]+)'/g)].map((m) => m[1]);
  assert.ok(keys.length >= 4);
  for (const key of keys) for (const [file, catalog] of Object.entries(catalogs)) {
    assert.equal(typeof catalog[key]?.message, 'string', `${key} missing from ${file}`);
  }
  for (const key of Object.keys(forkSettings.FORK_SETTINGS)) {
    assert.match(ui, new RegExp(`key: '${key}'`), `${key} has no entry in fork-settings.js`);
    assert.ok(schema.internalDefaults.includes(key), `${key} missing from schema.json internalDefaults`);
  }
  assert.match(html, /<section class="settings-group" id="group-fork"><\/section>/);
  assert.match(html, /<a href="#group-fork" data-group="fork" data-i18n="fork.settings.title">/);
  assert.match(html, /<script src="fork-settings.js"><\/script>/);
});

test('the fork section renders its settings and keeps a refused address with its error', async () => {
  const vm = require('node:vm');
  const elements = new Map();
  const make = (tag) => {
    const node = {
      tagName: tag, children: [], attributes: {}, listeners: {}, hidden: false, textContent: '', className: '', value: '', id: '',
      setAttribute(name, value) { this.attributes[name] = value; if (name === 'id') { this.id = value; elements.set(value, this); } },
      append(child) { this.children.push(child); },
      replaceChildren(...kids) { this.children = kids; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
    };
    return node;
  };
  const section = make('section');
  const stored = { goLinkTemplate: '' };
  const document = {
    createElement: make,
    getElementById: (id) => (id === 'group-fork' ? section : elements.get(id) ?? null),
  };
  const window = {
    blancI18n: { t: (key) => `[${key}]` },
    bowserPages: { settings: { set: async (partial) => {
      const clean = forkSettings.sanitizeForkSettings(partial, {});
      Object.assign(stored, clean);
      return { ...stored };
    } } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/renderer/pages/fork-settings.js'), 'utf8'), { window, document });
  window.blancForkSettings.render({ goLinkTemplate: TPL });
  const input = elements.get('fork-goLinkTemplate');
  const error = elements.get('fork-goLinkTemplate-error');
  assert.equal(input.value, TPL);
  assert.equal(section.children[0].textContent, '[fork.settings.title]');

  input.value = 'http://not-https.example/%s';
  await input.listeners.change();
  assert.equal(error.hidden, false);
  assert.equal(input.value, 'http://not-https.example/%s');
  assert.equal(stored.goLinkTemplate, '');

  input.value = ` ${TPL} `;
  await input.listeners.change();
  assert.equal(error.hidden, true);
  assert.equal(stored.goLinkTemplate, TPL);
});
