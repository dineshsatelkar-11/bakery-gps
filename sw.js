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
// POST multipart → stash Blob in IndexedDB → 303 redirect to /order?share=1
var SHARE_DB = 'ibcab-share';
var SHARE_DB_VER = 3;

function openShareDb() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open(SHARE_DB, SHARE_DB_VER);
    req.onupgradeneeded = function() {
      var db = req.result;
      if (!db.objectStoreNames.contains('incoming')) {
        db.createObjectStore('incoming', { keyPath: 'id' });
      }
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() {
      console.warn('[SW] IDB open failed', req.error);
      reject(req.error || new Error('IDB open failed'));
    };
    req.onblocked = function() {
      console.warn('[SW] IDB open blocked');
    };
  });
}

function stashSharePayload(payload) {
  return openShareDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      try {
        var tx = db.transaction('incoming', 'readwrite');
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() {
          console.warn('[SW] IDB tx error', tx.error);
          reject(tx.error || new Error('IDB write failed'));
        };
        tx.onabort = function() {
          console.warn('[SW] IDB tx abort', tx.error);
          reject(tx.error || new Error('IDB write aborted'));
        };
        tx.objectStore('incoming').put({ id: 'latest', ts: Date.now(), data: payload });
      } catch (e) {
        reject(e);
      }
    });
  });
}

function isShareTargetPost(req) {
  if (req.method !== 'POST') return false;
  var u = req.url || '';
  // Manifest action is /order?share=1 — also accept /order.html?share=1
  if (u.indexOf('share=1') >= 0) return true;
  // PhonePe / Android sometimes POST to /order without query (still multipart)
  try {
    var ct = (req.headers && req.headers.get) ? (req.headers.get('content-type') || '') : '';
    if (/multipart\/form-data/i.test(ct) && /\/order(\.html)?([?#]|$)/i.test(u)) return true;
  } catch (eCt) {}
  if (/\/order(\.html)?([?#]|$)/i.test(u)) return true;
  return false;
}

function pickShareFile(form) {
  var keys = ['media', 'file', 'files', 'image', 'screenshot', 'photo', 'receipt', 'shared_image'];
  var i, f;
  for (i = 0; i < keys.length; i++) {
    f = form.get(keys[i]);
    if (f && typeof f.arrayBuffer === 'function' && (f.size == null || f.size > 0)) return f;
  }
  // Some apps send multiple under the same name
  try {
    for (i = 0; i < keys.length; i++) {
      var all = form.getAll(keys[i]);
      if (all && all.length) {
        for (var j = 0; j < all.length; j++) {
          f = all[j];
          if (f && typeof f.arrayBuffer === 'function' && (f.size == null || f.size > 0)) return f;
        }
      }
    }
  } catch (eAll) {}
  // Last resort: any File/Blob in the form
  try {
    var entries = form.entries();
    var pair = entries.next();
    while (!pair.done) {
      var v = pair.value && pair.value[1];
      if (v && typeof v.arrayBuffer === 'function' && (v.size == null || v.size > 0)) return v;
      pair = entries.next();
    }
  } catch (eIter) {}
  return null;
}

function shareRedirectUrl() {
  try {
    return new URL('/order?share=1', self.registration.scope).href;
  } catch (e) {
    return '/order?share=1';
  }
}

// Fetch — share POST first, then network-first for GET
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (url.startsWith('chrome-extension://')) return;

  // Share Target POST (multipart from PhonePe / GPay / etc.)
  if (isShareTargetPost(e.request)) {
    e.respondWith((async function() {
      var hasFile = false;
      var stashErr = '';
      var fileSize = 0;
      try {
        var form = await e.request.formData();
        var title = form.get('title') || '';
        var text  = form.get('text') || '';
        var shareUrl = form.get('url') || '';
        var file = pickShareFile(form);

        var fileBlob = null;
        var fileName = '';
        var fileType = '';
        if (file && typeof file.arrayBuffer === 'function') {
          var buf = await file.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            fileType = file.type || 'image/jpeg';
            // PhonePe sometimes sends empty type — sniff from name
            if (!fileType || fileType === 'application/octet-stream') {
              var nm = String(file.name || '').toLowerCase();
              if (nm.indexOf('.png') >= 0) fileType = 'image/png';
              else if (nm.indexOf('.webp') >= 0) fileType = 'image/webp';
              else if (nm.indexOf('.pdf') >= 0) fileType = 'application/pdf';
              else fileType = 'image/jpeg';
            }
            fileName = file.name || 'phonepe-receipt.jpg';
            fileSize = buf.byteLength;
            fileBlob = new Blob([buf], { type: fileType });
            hasFile = true;
          }
        }

        var payload = {
          title: String(title || ''),
          text: String(text || ''),
          url: String(shareUrl || ''),
          fileBlob: fileBlob,
          fileName: fileName,
          fileType: fileType,
          fileSize: fileSize,
          hasFile: hasFile,
          ts: Date.now()
        };

        try {
          await stashSharePayload(payload);
          console.log('[SW] share stashed', { hasFile: hasFile, fileSize: fileSize, fileType: fileType, fileName: fileName });
        } catch (idbErr) {
          stashErr = (idbErr && idbErr.name ? idbErr.name + ': ' : '') + String(idbErr && idbErr.message ? idbErr.message : idbErr);
          console.warn('[SW] share IDB write failed', stashErr);
          try {
            await stashSharePayload({
              title: payload.title,
              text: payload.text,
              url: payload.url,
              fileBlob: null,
              hasFile: false,
              err: stashErr,
              ts: Date.now()
            });
          } catch (e2) {
            console.warn('[SW] share text-only stash also failed', e2);
          }
          hasFile = false;
        }

        try {
          var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          list.forEach(function(c) {
            try {
              c.postMessage({
                type: 'ibcab-share-ready',
                hasFile: hasFile,
                fileSize: fileSize,
                err: stashErr || ''
              });
            } catch (eMsg) {}
          });
        } catch (eCl) {}
      } catch (err) {
        console.warn('[SW] share stash failed', err);
        try {
          await stashSharePayload({
            title: '', text: '', url: '', fileBlob: null, hasFile: false,
            err: String(err && err.message ? err.message : err),
            ts: Date.now()
          });
        } catch (e2) {}
      }
      // Absolute URL — relative redirects break on some Android WebView / Chrome builds
      return Response.redirect(shareRedirectUrl(), 303);
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
