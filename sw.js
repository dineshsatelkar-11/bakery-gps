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

// ── Share Target (PhonePe / GPay / Paytm / WhatsApp → payment proof) ──────────
// POST multipart → stash in IndexedDB → 303 redirect to order?share=1
// Do NOT rely on network for POST (Vercel cleanUrls can drop body on redirect).
function openShareDb() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('ibcab-share', 1);
    req.onupgradeneeded = function() {
      var db = req.result;
      if (!db.objectStoreNames.contains('incoming')) {
        db.createObjectStore('incoming', { keyPath: 'id' });
      }
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

function stashSharePayload(payload) {
  return openShareDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('incoming', 'readwrite');
      tx.objectStore('incoming').put({ id: 'latest', ts: Date.now(), data: payload });
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}

function isShareTargetPost(req) {
  if (req.method !== 'POST') return false;
  var u = req.url || '';
  // /order.html, /order, ?share=1, or path ending with order
  if (u.indexOf('share=1') >= 0) return true;
  if (/\/order(\.html)?([?#]|$)/i.test(u)) return true;
  return false;
}

// Fetch — share POST first, then network-first for GET
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (url.startsWith('chrome-extension://')) return;

  // Share Target POST (multipart from PhonePe / GPay / etc.)
  if (isShareTargetPost(e.request)) {
    e.respondWith((async function() {
      var hasFile = false;
      try {
        var form = await e.request.formData();
        var title = form.get('title') || '';
        var text  = form.get('text') || '';
        var shareUrl = form.get('url') || '';
        // PhonePe / GPay / system share use various field names
        var file = form.get('media') || form.get('file') || form.get('files') || form.get('image') || form.get('screenshot');
        if (!file || typeof file.arrayBuffer !== 'function') {
          try {
            var entries = form.entries();
            var pair = entries.next();
            while (!pair.done) {
              var v = pair.value && pair.value[1];
              if (v && typeof v.arrayBuffer === 'function' && (v.size == null || v.size > 0)) {
                file = v;
                break;
              }
              pair = entries.next();
            }
          } catch (eIter) {}
        }
        var fileB64 = '';
        var fileName = '';
        var fileType = '';
        if (file && typeof file.arrayBuffer === 'function') {
          var buf = await file.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            var bytes = new Uint8Array(buf);
            var chunk = 0x8000;
            var binary = '';
            for (var i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
            }
            fileB64 = btoa(binary);
            fileName = file.name || 'share.jpg';
            fileType = file.type || 'image/jpeg';
            hasFile = !!fileB64;
          }
        }
        await stashSharePayload({
          title: String(title || ''),
          text: String(text || ''),
          url: String(shareUrl || ''),
          fileB64: fileB64,
          fileName: fileName,
          fileType: fileType,
          hasFile: hasFile,
          ts: Date.now()
        });
        // Notify any open order clients
        try {
          var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          list.forEach(function(c) {
            try {
              c.postMessage({ type: 'ibcab-share-ready', hasFile: hasFile });
            } catch (eMsg) {}
          });
        } catch (eCl) {}
      } catch (err) {
        console.warn('[SW] share stash failed', err);
        try {
          await stashSharePayload({ title: '', text: '', url: '', fileB64: '', hasFile: false, err: String(err) });
        } catch (e2) {}
      }
      // Prefer clean /order?share=1 (matches vercel cleanUrls); keep order.html as fallback path
      return Response.redirect('/order?share=1', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;
  if (url.indexOf('supabase.co') >= 0) return;
  if (url.indexOf('ajjas.com') >= 0) return;
  if (url.indexOf('google.com') >= 0) return;
  if (url.indexOf('onesignal.com') >= 0) return;

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
