import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { workerSource } from './workerSource';

// Model Fetch's redirect history, including preservation by Cache API clones.
function redirectedResponse(response) {
  Object.defineProperty(response, 'redirected', { value: true });
  const clone = response.clone.bind(response);
  response.clone = () => redirectedResponse(clone());
  return response;
}

function harness({ damaged = false, offline = false, varyOrigin = false, redirectedIndex = false } = {}) {
  const bodies = new Map([['index.html', '<html>poker</html>'], ['assets/app.js', 'app'], ['assets/equity-worker.js', 'worker']]);
  const resources = [...bodies].map(([url, body]) => ({ url, sha256: createHash('sha256').update(body).digest('hex') }));
  const stores = new Map();
  const requestOrigins = new Map();
  const handlers = new Map();
  let skipped = 0, claimed = 0, requests = 0;
  const scope = 'https://local.example/poker/';
  const address = (value) => typeof value === 'string' ? value : value.url || value.href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request, options = {}) {
          const response = store.get(address(request));
          if (!response) return undefined;
          const origin = request.headers?.get('Origin') ?? null;
          if (!options.ignoreVary && response.headers.get('Vary')?.toLowerCase().includes('origin') && origin !== (requestOrigins.get(name + address(request)) ?? null)) return undefined;
          return response.clone();
        },
        async put(request, response) {
          store.set(address(request), response.clone());
          requestOrigins.set(name + address(request), request.headers?.get('Origin') ?? null);
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    registration: { scope }, location: { origin: 'https://local.example' },
    addEventListener(type, handler) { handlers.set(type, handler); },
    async skipWaiting() { skipped++; }, clients: { async claim() { claimed++; } },
  };
  const context = vm.createContext({ self, caches, URL, Request, Response, Headers, crypto: webcrypto,
    async fetch(request) {
      requests++;
      if (offline) throw new Error('network unavailable');
      const relative = address(request).slice(scope.length);
      const headers = new Headers(varyOrigin ? { Vary: 'Origin' } : {});
      if (relative === 'index.html') {
        headers.set('Content-Type', 'text/html; charset=utf-8');
        headers.set('Content-Security-Policy', "script-src 'self'");
      }
      if (redirectedIndex && relative === 'index.html') {
        headers.set('Content-Encoding', 'gzip'); headers.set('Content-Length', '9999');
      }
      const response = new Response(damaged && relative === 'assets/equity-worker.js' ? 'corrupt-worker' : bodies.get(relative), { status: bodies.has(relative) ? 200 : 404, statusText: bodies.has(relative) ? 'OK' : 'Not Found', headers });
      return redirectedIndex && relative === 'index.html' ? redirectedResponse(response) : response;
    } });
  vm.runInContext(workerSource(resources, 'test-v1'), context);
  async function event(type, values = {}) {
    let task = Promise.resolve();
    let response;
    handlers.get(type)({ ...values, waitUntil(promise) { task = promise; }, respondWith(promise) { response = promise; } });
    await task;
    return response ? await response : undefined;
  }
  return { event, stores, bodies, counters: () => ({ skipped, claimed, requests }), disconnect() { offline = true; } };
}

describe('verified offline cache lifecycle', () => {
  it('precaches the worker, verifies readiness and serves all assets with the network off', async () => {
    const app = harness();
    await app.event('install');
    expect(app.counters()).toEqual({ skipped: 0, claimed: 0, requests: 3 });
    const messages = [];
    await app.event('message', { data: { type: 'VERIFY_OFFLINE' }, ports: [{ postMessage(value) { messages.push(value); } }] });
    expect(messages[0]).toMatchObject({ ready: true, version: 'test-v1' });
    await app.event('activate');
    expect(app.counters().claimed).toBe(1);
    app.disconnect();
    const page = await app.event('fetch', { request: { url: 'https://local.example/poker/', method: 'GET', mode: 'navigate' } });
    const worker = await app.event('fetch', { request: new Request('https://local.example/poker/assets/equity-worker.js') });
    expect(await page.text()).toBe('<html>poker</html>');
    expect(await worker.text()).toBe('worker');
    expect(app.counters().requests).toBe(3);
  });
  it('rejects installation when even one worker is corrupt and never reports ready', async () => {
    const app = harness({ damaged: true });
    await expect(app.event('install')).rejects.toThrow('verification failed');
    expect(app.stores.size).toBe(0);
    const messages = [];
    await app.event('message', { data: { type: 'VERIFY_OFFLINE' }, ports: [{ postMessage(value) { messages.push(value); } }] });
    expect(messages[0].ready).toBe(false);
    expect(app.counters().skipped).toBe(0);
  });
  it('strips followed redirect history on install and repair while preserving verified content and policy', async () => {
    const app = harness({ redirectedIndex: true });
    await app.event('install');
    const store = app.stores.get('holdem-lab-test-v1');
    const url = 'https://local.example/poker/index.html';
    const cached = store.get(url);
    expect(cached.redirected).toBe(false);
    expect(cached.status).toBe(200); expect(cached.statusText).toBe('OK');
    expect(cached.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(cached.headers.get('Content-Security-Policy')).toBe("script-src 'self'");
    expect(cached.headers.has('Content-Encoding')).toBe(false);
    expect(cached.headers.has('Content-Length')).toBe(false);
    store.delete(url);
    const messages = [];
    await app.event('message', { data: { type: 'VERIFY_OFFLINE', repair: true }, ports: [{ postMessage(value) { messages.push(value); } }] });
    expect(messages[0].ready).toBe(true); expect(store.get(url).redirected).toBe(false);
    await app.event('activate'); app.disconnect();
    const page = await app.event('fetch', { request: { url: 'https://local.example/poker/', method: 'GET', mode: 'navigate' } });
    expect(page.redirected).toBe(false); expect(await page.text()).toBe('<html>poker</html>');
  });
  it('normalizes legacy redirected cached documents when serving an offline navigation', async () => {
    const app = harness(); await app.event('install');
    app.stores.get('holdem-lab-test-v1').set('https://local.example/poker/index.html', redirectedResponse(new Response('<html>poker</html>', { headers: { 'Content-Type': 'text/html' } })));
    app.disconnect();
    const page = await app.event('fetch', { request: { url: 'https://local.example/poker/', method: 'GET', mode: 'navigate' } });
    expect(page.redirected).toBe(false); expect(page.headers.get('Content-Type')).toBe('text/html');
    expect(await page.text()).toBe('<html>poker</html>');
  });
  it('activates a waiting update only after user acceptance', async () => {
    const app = harness();
    await app.event('install');
    expect(app.counters().skipped).toBe(0);
    await app.event('message', { data: { type: 'ACCEPT_UPDATE' } });
    expect(app.counters().skipped).toBe(1);
  });
  it('repairs evicted resources when explicitly rechecked online', async () => {
    const app = harness();
    await app.event('install');
    app.stores.get('holdem-lab-test-v1').delete('https://local.example/poker/assets/equity-worker.js');
    const messages = [];
    await app.event('message', { data: { type: 'VERIFY_OFFLINE', repair: true }, ports: [{ postMessage(value) { messages.push(value); } }] });
    expect(messages[0].ready).toBe(true);
    expect(app.counters().requests).toBe(4);
  });
  it('serves verified cached modules offline despite Vary: Origin request differences', async () => {
    const app = harness({ varyOrigin: true });
    await app.event('install');
    await app.event('activate');
    app.disconnect();
    const module = await app.event('fetch', { request: new Request('https://local.example/poker/assets/app.js', { headers: { Origin: 'https://local.example' } }) });
    expect(await module.text()).toBe('app');
    const page = await app.event('fetch', { request: { url: 'https://local.example/poker/', method: 'GET', mode: 'navigate', headers: new Headers({ Origin: 'https://local.example' }) } });
    expect(await page.text()).toBe('<html>poker</html>');
    expect(app.counters().requests).toBe(3);
  });
  it('retains two prior caches for open tabs and serves only scoped immutable chunks from them', async () => {
    const app = harness();
    app.stores.set('holdem-lab-ancient', new Map());
    app.stores.set('holdem-lab-old-2', new Map());
    app.stores.set('holdem-lab-old-1', new Map());
    app.stores.set('holdem-lab-previous', new Map([
      ['https://local.example/poker/assets/index-oldhash123.js', new Response('previous app', { headers: { Vary: 'Origin' } })],
      ['https://local.example/poker/private.json', new Response('must not serve')],
    ]));
    app.stores.set('unrelated-cache', new Map());
    await app.event('install');
    await app.event('activate');
    expect([...app.stores.keys()]).toEqual(['holdem-lab-old-1', 'holdem-lab-previous', 'unrelated-cache', 'holdem-lab-test-v1']);
    app.disconnect();
    const oldModule = await app.event('fetch', { request: new Request('https://local.example/poker/assets/index-oldhash123.js', { headers: { Origin: 'https://local.example' } }) });
    expect(await oldModule.text()).toBe('previous app');
    expect(await app.event('fetch', { request: new Request('https://local.example/poker/private.json') })).toBeUndefined();
    expect(await app.event('fetch', { request: new Request('https://local.example/other/assets/index-oldhash123.js') })).toBeUndefined();
    expect(app.counters().requests).toBe(3);
  });
  it('leaves other origins and POST requests untouched', async () => {
    const app = harness({ offline: true });
    expect(await app.event('fetch', { request: new Request('https://other.example/track') })).toBeUndefined();
    expect(await app.event('fetch', { request: new Request('https://local.example/poker/', { method: 'POST' }) })).toBeUndefined();
    expect(app.counters().requests).toBe(0);
  });
});
