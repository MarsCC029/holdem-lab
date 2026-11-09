/** Pure service-worker source generator, shared by packaging and lifecycle tests. */
export function workerSource(resources, version) {
  return `/* Generated from the exact built files. Do not edit. */
'use strict';
const VERSION = ${JSON.stringify(version)};
const CACHE = 'holdem-lab-' + VERSION;
const PREFIX = 'holdem-lab-';
const RESOURCES = ${JSON.stringify(resources)};
const resourceURLs = new Map(RESOURCES.map(item => [new URL(item.url, self.registration.scope).href, item]));
const scopePath = new URL(self.registration.scope).pathname;
// Only immutable Vite JS/CSS chunks may be looked up in a retained version cache.
const retiredAsset = url => url.search === '' && url.pathname.startsWith(scopePath) &&
  /^assets\\/[A-Za-z0-9._-]+-[A-Za-z0-9_-]{6,}\\.(js|css)$/.test(url.pathname.slice(scopePath.length));
const hex = buffer => Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join('');
// Pretty-URL hosts may redirect index.html to ./ . WebKit rejects a followed
// redirect as a navigation response, even when its verified body is cached.
// Reconstructing the response clears its URL/redirect history. Fetch has
// already decoded the body, so transport encoding and length no longer apply.
function cleanResponse(response) {
  const headers = new Headers(response.headers);
  for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) headers.delete(name);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
async function verified(response, item) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  return hex(await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer())) === item.sha256;
}
async function completeCache() {
  const cache = await caches.open(CACHE);
  for (const item of RESOURCES) {
    const url = new URL(item.url, self.registration.scope).href;
    if (!await verified(await cache.match(url, { ignoreVary: true }), item)) return false;
  }
  return true;
}
async function repairCache() {
  const cache = await caches.open(CACHE);
  for (const item of RESOURCES) {
    const url = new URL(item.url, self.registration.scope).href;
    if (await verified(await cache.match(url, { ignoreVary: true }), item)) continue;
    const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
    if (!await verified(response, item)) throw new Error('Offline resource repair failed');
    await cache.put(url, cleanResponse(response));
  }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      for (let i = 0; i < RESOURCES.length; i += 6) {
        await Promise.all(RESOURCES.slice(i, i + 6).map(async item => {
          const url = new URL(item.url, self.registration.scope).href;
          const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
          if (!await verified(response, item)) throw new Error('Resource verification failed: ' + item.url);
          await cache.put(url, cleanResponse(response));
        }));
      }
      if (!await completeCache()) throw new Error('Incomplete offline cache');
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // Updates stay waiting until the user's between-hands acceptance.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (!await completeCache()) throw new Error('Cannot activate an incomplete cache');
    // Two prior versions keep already-open pages' old immutable chunks available.
    // CacheStorage keys are in creation order; the current cache is never removed.
    const prior = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    for (const key of prior.slice(0, -2)) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACCEPT_UPDATE') {
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === 'VERIFY_OFFLINE') {
    event.waitUntil((async () => {
      try {
        if (event.data.repair && !await completeCache()) await repairCache();
        event.ports[0]?.postMessage({ type: 'OFFLINE_STATUS', version: VERSION, ready: await completeCache() });
      }
      catch { event.ports[0]?.postMessage({ type: 'OFFLINE_STATUS', version: VERSION, ready: false, error: '离线资源不完整，请联网后重新加载。' }); }
    })());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const indexURL = new URL('index.html', self.registration.scope).href;
      const cached = await caches.open(CACHE).then(cache => cache.match(indexURL, { ignoreVary: true }));
      // Also normalize entries left by an older worker. Do not reconstruct an
      // opaque-redirect network response: navigations may legitimately follow it.
      if (cached) return cleanResponse(cached);
      const response = await fetch(request);
      return response.redirected && response.ok ? cleanResponse(response) : response;
    })());
  } else if (resourceURLs.has(url.href)) {
    event.respondWith((async () => {
      // Precaching and module requests can send different Origin headers. These
      // exact, verified same-origin files are invariant under Vary: Origin.
      const cached = await caches.open(CACHE).then(cache => cache.match(url.href, { ignoreVary: true }));
      return cached || fetch(request);
    })());
  } else if (retiredAsset(url)) {
    event.respondWith((async () => {
      const previous = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE).reverse();
      for (const key of previous) {
        const cached = await caches.open(key).then(cache => cache.match(url.href, { ignoreVary: true }));
        if (cached) return cached;
      }
      return fetch(request);
    })());
  }
});
`;
}
