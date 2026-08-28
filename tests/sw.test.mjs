import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function createWorker({ offline = false, externalFails = false } = {}) {
  const listeners = new Map();
  const stores = new Map();
  const scope = 'https://example.test/arena/';
  const key = value => new URL(typeof value === 'string' ? value : value.url, scope).href;
  async function fetch(request) {
    if (offline || (externalFails && new URL(key(request)).origin !== 'https://example.test')) throw new Error('Offline');
    return new Response('fresh content', { status: 200 });
  }
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(requests) {
          const responses = await Promise.all(requests.map(fetch));
          requests.forEach((request, index) => entries.set(key(request), responses[index]));
        },
        async put(request, response) { entries.set(key(request), response.clone()); },
        async match(request) { return entries.get(key(request))?.clone(); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request) {
      for (const entries of stores.values()) if (entries.has(key(request))) return entries.get(key(request)).clone();
    },
  };
  const context = vm.createContext({
    self: {
      location: { origin: 'https://example.test' }, registration: { scope },
      clients: { claim: async () => {} }, skipWaiting: async () => {},
      addEventListener(name, handler) { listeners.set(name, handler); },
    },
    URL, Response, Request, caches, fetch, console: { warn() {} },
  });
  vm.runInContext(script, context);
  async function dispatch(name, request) {
    const pending = [];
    let response;
    listeners.get(name)({ request, waitUntil: promise => pending.push(promise), respondWith: promise => { response = promise; } });
    const result = await response;
    await Promise.all(pending);
    return result;
  }
  return {
    caches, stores, dispatch,
    request(path, navigate = false) {
      return { url: new URL(path, scope).href, method: 'GET', mode: navigate ? 'navigate' : 'cors', headers: new Headers({accept: navigate ? 'text/html' : '*/*'}) };
    },
    setOffline(value) { offline = value; },
  };
}

test('external CDN outage does not prevent app-shell installation', async () => {
  const worker = createWorker({ externalFails: true });
  await worker.dispatch('install');
  assert.ok(await worker.caches.match('index.html'));
  assert.ok(await worker.caches.match('favicon.svg'));
});

test('activation preserves caches belonging to other applications', async () => {
  const worker = createWorker();
  await worker.caches.open('unrelated-app-v3');
  await worker.caches.open('n-arena-v1');
  await worker.dispatch('activate');
  assert.equal(worker.stores.has('unrelated-app-v3'), true);
  assert.equal(worker.stores.has('n-arena-v1'), false);
});

test('navigation receives the latest HTML rather than stale cache content', async () => {
  const worker = createWorker();
  await worker.dispatch('install');
  const cache = await worker.caches.open((await worker.caches.keys())[0]);
  await cache.put('index.html', new Response('old content'));
  const response = await worker.dispatch('fetch', worker.request('index.html', true));
  assert.equal(await response.text(), 'fresh content');
});

test('offline navigation falls back to the cached app shell', async () => {
  const worker = createWorker();
  await worker.dispatch('install');
  worker.setOffline(true);
  const response = await worker.dispatch('fetch', worker.request('index.html?launch=1', true));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 200);
});

test('uncached offline resources return a Response instead of undefined', async () => {
  const worker = createWorker({ offline: true });
  const response = await worker.dispatch('fetch', worker.request('favicon.svg'));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 504);
});

test('non-app cross-origin requests are not intercepted or cached', async () => {
  const worker = createWorker();
  assert.equal(await worker.dispatch('fetch', worker.request('https://unrelated.test/data')), undefined);
});
