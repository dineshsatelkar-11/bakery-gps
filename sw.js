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
  '/brand-head.html',
  '/finance.html',
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
      return Promise.all(STATIC.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn('[SW] skip cache', url, err);
        });
      }));
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) {
        return caches.delete(k);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

// ── Share Target (PhonePe / GPay / Paytm receipt → Pay request) ───────────────
// POST multipart to static order.html fails on many hosts. Intercept, stash, redirect GET.
function openShareDb() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('ibcab-share', 1);
    req.onupgradeneeded = function() {
      var db = req.result;
      if (!db.objectStoreNames.contains('payload')) {
        db.createObjectStore('payload', { keyPath: 'id' });
      }
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

function saveSharePayload(payload) {
  return openShareDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('payload', 'readwrite');
      var store = tx.objectStore('payload');
      payload.id = 'latest';
      store.put(payload);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}

function fileToDataUrl(file) {
  return new Promise(function(resolve, reject) {
    if (!file || typeof file.arrayBuffer !== 'function') {
      resolve('');
      return;
    }
    file.arrayBuffer().then(function(buf) {
      var bytes = new Uint8Array(buf);
      var binary = '';
      var chunk = 0x8000;
      for (var i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      var mime = file.type || 'application/octet-stream';
      resolve('data:' + mime + ';base64,' + btoa(binary));
    }).catch(function() { resolve(''); });
  });
}

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  var path = '';
  try { path = new URL(url).pathname; } catch (err) { path = url; }

  // PhonePe Share receipt → POST to /order.html
  if (e.request.method === 'POST' && /\/order(\.html)?$/i.test(path)) {
    e.respondWith((async function() {
      try {
        var form = await e.request.formData();
        var title = form.get('title') || form.get('subject') || '';
        var text = form.get('text') || form.get('description') || form.get('body') || '';
        var shareUrl = form.get('url') || form.get('link') || '';
        var file = form.get('images') || form.get('image') || form.get('file') || form.get('media');
        if (!file) {
          // Some apps use different field names
          var keys = [];
          try {
            var it = form.keys();
            var step = it.next();
            while (!step.done) {
              keys.push(step.value);
              step = it.next();
            }
          } catch (kErr) {}
          for (var i = 0; i < keys.length; i++) {
            var v = form.get(keys[i]);
            if (v && typeof v === 'object' && v.name) { file = v; break; }
          }
          // Also try entries
          if (!file) {
            try {
              var ent = form.entries();
              var step = ent.next();
              while (!step.done) {
                var pair = step.value;
                if (pair && pair[1] && typeof pair[1] === 'object' && pair[1].name) {
                  file = pair[1];
                  break;
                }
                step = ent.next();
              }
            } catch (e2) {}
          }
        }

        var dataUrl = '';
        var mime = '';
        if (file && typeof file === 'object') {
          mime = file.type || '';
          dataUrl = await fileToDataUrl(file);
        }

        var combined = [title, text, shareUrl].filter(Boolean).join('\n');
        // UTR / UPI ref patterns used by PhonePe, GPay, Paytm, BHIM, banks
        var utr = '';
        var patterns = [
          /(?:UTR|UPI\s*Ref(?:erence)?|Ref(?:erence)?\s*(?:No|ID|#)?|Txn(?:\s*ID)?|Transaction\s*(?:ID|No)|RRN|Apt\s*No)[:\s#\-]*([A-Za-z0-9]{8,22})/i,
          /\b([0-9]{12})\b/,
          /\b([0-9]{10,22})\b/,
          /\b([A-Z0-9]{10,22})\b/
        ];
        for (i = 0; i < patterns.length; i++) {
          var m = String(combined).match(patterns[i]);
          if (m && m[1]) { utr = m[1]; break; }
        }

        await saveSharePayload({
          ts: Date.now(),
          title: String(title),
          text: String(text),
          url: String(shareUrl),
          combined: combined,
          utr: utr,
          imageDataUrl: dataUrl,
          mime: mime,
          fileName: file && file.name ? file.name : '',
          source: 'upi-share'
        });
      } catch (err) {
        console.warn('[SW] share target parse failed', err);
        try {
          await saveSharePayload({
            ts: Date.now(),
            text: 'Share received but could not read file. Please attach screenshot in Pay request.',
            error: String(err)
          });
        } catch (e2) {}
      }
      // Always redirect to GET so page loads normally (no 405 / blank error)
      return Response.redirect('/order.html?share=1', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;
  if (url.indexOf('supabase.co') >= 0) return;
  if (url.indexOf('ajjas.com') >= 0) return;
  if (url.indexOf('google.com') >= 0) return;
  if (url.indexOf('onesignal.com') >= 0) return;
  if (url.indexOf('script.google.com') >= 0) return;

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
          return cached || caches.match('/order.html') || caches.match('/index.html');
        });
      })
  );
});
