// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  // Compact keys: t=title, m=message/body, u=url, g=tag (also accepts full names)
  var title = data.t || data.title || 'IBCAB';
  var body  = data.m || data.body || data.message || '';
  var tag   = data.g || data.tag || 'ibcab';
  var url   = data.u || data.url || '';
  var blob  = (title + ' ' + body + ' ' + tag).toLowerCase();
  if (!url) {
    if (tag === 'ibcab-admin' || tag === 'a' || /new order|re-approval|waiting for approval/.test(blob))
      url = '/admin';
    else
      url = '/order';
  }
  if (url === '/admin') tag = 'ibcab-admin';
  e.waitUntil(
    self.registration.showNotification(String(title).slice(0, 48), {
      body:  String(body).slice(0, 120),
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { u: url },
      tag:   tag,
      renotify: true,
      silent: false
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var d = e.notification.data || {};
  var url = d.u || d.url || '/order';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.indexOf(url) >= 0 && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
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
  '/admin-payments.html',
  '/driver.html',
  '/order.html',
  '/kitchen.html',
  '/packaging.html',
  // '/tracking.html',  // not needed now — role-based dashboards via index.html
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
