var CACHE = 'baked-gps-v2';
var STATIC = [
  '/bakery-gps/',
  '/bakery-gps/index.html',
  '/bakery-gps/driver.html',
  '/bakery-gps/admin.html',
  '/bakery-gps/customers.html',
  '/bakery-gps/config.js',
  '/bakery-gps/api.js',
  '/bakery-gps/icon-192.png',
  '/bakery-gps/icon-512.png'
];

// Install — cache all static files
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(STATIC);
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
  // Skip non-GET and external requests (Google Sheets API etc)
  if(e.request.method !== 'GET') return;
  var url = e.request.url;
  if(url.startsWith('chrome-extension://')) return;
  if(url.indexOf('script.google.com') >= 0) return;
  if(url.indexOf('generativelanguage.googleapis.com') >= 0) return;
  if(url.indexOf('supabase.co') >= 0) return;

  e.respondWith(
    fetch(e.request)
      .then(function(res) {
        // Cache fresh response
        var clone = res.clone();
        caches.open(CACHE).then(function(cache) {
          cache.put(e.request, clone);
        });
        return res;
      })
      .catch(function() {
        // Offline — serve from cache
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/bakery-gps/index.html');
        });
      })
  );
});
