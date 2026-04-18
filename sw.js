// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  var title = data.title || '🥖 Message from bakery';
  var body  = data.body  || data.message || '';
  e.waitUntil(
    self.registration.showNotification(title, {
      body:  body,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url: '/order' }
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/order';
  e.waitUntil(clients.openWindow(url));
});

// ── App Cache ─────────────────────────────────────────────────────────────────
// Cache version is tied to CONFIG.VERSION in config.js.
// To force all clients to re-download, bump VERSION in config.js.
try { importScripts('/config.js'); } catch(e) {}
var CACHE = 'baked-gps-v' + (typeof CONFIG !== 'undefined' ? CONFIG.VERSION : '6');
var STATIC = [
  '/',
  '/index.html',
  '/admin.html',
  '/driver.html',
  '/order.html',
  '/kitchen.html',
  '/packaging.html',
  '/tracking.html',
  '/superadmin.html',
  '/teapost-head.html',
  '/config.js',
  '/api.js',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  '/manifest-driver.json'
];

// Install — cache files individually so one failure doesn't break the SW
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return Promise.all(
        STATIC.map(function(url) {
          return cache.add(url).catch(function() {
            console.warn('[SW] Failed to cache:', url);
          });
        })
      );
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', function(e) {
  if(e.request.method !== 'GET') return;
  var url = e.request.url;
  if(url.startsWith('chrome-extension://')) return;
  if(url.indexOf('supabase.co') >= 0) return;
  if(url.indexOf('ajjas.com') >= 0) return;
  if(url.indexOf('google.com') >= 0) return;
  if(url.indexOf('onesignal.com') >= 0) return;

  e.respondWith(
    fetch(e.request)
      .then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(cache) {
          cache.put(e.request, clone);
        });
        return res;
      })
      .catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
  );
});
