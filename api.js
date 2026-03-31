// ─────────────────────────────────────────────
// BAKED GPS — Supabase API wrapper
// Maintains the same api(params) / apiPost(body) interface
// that all HTML files already use, so no logic changes needed there.
// ─────────────────────────────────────────────

(function () {
  var BASE = CONFIG.SUPABASE_URL + '/rest/v1';
  var KEY  = CONFIG.SUPABASE_ANON_KEY;

  function hdrs(extra) {
    var h = {
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY,
      'Content-Type': 'application/json'
    };
    if (extra) Object.assign(h, extra);
    return h;
  }

  // Build a Supabase filter query string from a plain object.
  // { driver: 'Bharat', date: '2024-01-01' }  →  "driver=eq.Bharat&date=eq.2024-01-01"
  function filters(obj) {
    return Object.entries(obj).map(function (kv) {
      return encodeURIComponent(kv[0]) + '=eq.' + encodeURIComponent(kv[1]);
    }).join('&');
  }

  function sbGet(table, where, order) {
    var url = BASE + '/' + table + '?select=*';
    if (where && Object.keys(where).length) url += '&' + filters(where);
    if (order) url += '&order=' + order;
    return fetch(url, { headers: hdrs() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  // Fetches ALL rows by paginating in batches of 1000.
  // Needed for large tables (Supabase default max is 1000 rows per request).
  function fetchAll(table, where, order) {
    var PAGE = 1000;
    var results = [];

    function nextPage(offset) {
      var url = BASE + '/' + table + '?select=*';
      if (where && Object.keys(where).length) url += '&' + filters(where);
      if (order) url += '&order=' + order;
      url += '&limit=' + PAGE + '&offset=' + offset;
      return fetch(url, { headers: hdrs() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (page) {
          results = results.concat(page);
          // If a full page came back there may be more
          if (page.length === PAGE) return nextPage(offset + PAGE);
          return results;
        })
        .catch(function () { return results; });
    }

    return nextPage(0);
  }

  function sbPost(table, body, prefer) {
    return fetch(BASE + '/' + table, {
      method: 'POST',
      headers: hdrs({ 'Prefer': prefer || 'return=minimal' }),
      body: JSON.stringify(body)
    })
    .then(function (r) {
      return r.ok ? { ok: true } : r.json().then(function (e) { return { ok: false, error: e.message || 'Error' }; });
    })
    .catch(function () { return { ok: false, error: 'Network error' }; });
  }

  function sbPatch(table, where, body) {
    var url = BASE + '/' + table + '?' + filters(where);
    return fetch(url, {
      method: 'PATCH',
      headers: hdrs({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(body)
    })
    .then(function (r) {
      return r.ok ? { ok: true } : r.json().then(function (e) { return { ok: false, error: e.message || 'Error' }; });
    })
    .catch(function () { return { ok: false, error: 'Network error' }; });
  }

  function sbDelete(table, where) {
    return fetch(BASE + '/' + table + '?' + filters(where), {
      method: 'DELETE',
      headers: hdrs({ 'Prefer': 'return=minimal' })
    })
    .then(function (r) {
      if (r.ok) return { ok: true };
      return r.json()
        .then(function (e) { return { ok: false, error: e.message || e.hint || e.details || 'Delete failed' }; })
        .catch(function () { return { ok: false, error: 'Delete failed (HTTP ' + r.status + ')' }; });
    })
    .catch(function () { return { ok: false, error: 'Network error' }; });
  }

  // Upsert: insert or update on unique conflict columns (comma-separated string).
  function sbUpsert(table, body, onConflict) {
    return fetch(BASE + '/' + table + '?on_conflict=' + onConflict, {
      method: 'POST',
      headers: hdrs({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(body)
    })
    .then(function (r) {
      return r.ok ? { ok: true } : r.json().then(function (e) { return { ok: false, error: e.message || 'Error' }; });
    })
    .catch(function () { return { ok: false, error: 'Network error' }; });
  }

  // ── GET handler ──────────────────────────────────────────────────────────────
  window.api = function (p) {
    switch (p.action) {

      case 'getShops':
        // Driver passes their name → single filtered request (~50–200 rows).
        // Admin passes nothing → paginated fetch of all shops.
        if (p.driver) return sbGet('shops', { assigned_driver: p.driver }, 'name');
        return fetchAll('shops', {}, 'name');

      case 'getOrders': {
        var where = { date: p.date };
        if (p.driver) where.driver = p.driver;
        return sbGet('orders', where, 'shop_name');
      }

      case 'getDeliveries': {
        var where = { date: p.date };
        if (p.driver) where.driver = p.driver;
        return sbGet('deliveries', where);
      }

      case 'getRoutes': {
        var where = { date: p.date };
        if (p.driver) where.driver = p.driver;
        return sbGet('routes', where);
      }

      case 'getProducts':
        return sbGet('products', {}, 'name');

      case 'getDrivers':
        return sbGet('drivers', {}, 'name');

      case 'getStaff':
        return sbGet('staff', {}, 'name');

      default:
        return Promise.resolve([]);
    }
  };

  // ── POST handler ─────────────────────────────────────────────────────────────
  window.apiPost = function (b) {
    switch (b.action) {

      case 'addShop':
        return sbPost('shops', {
          shop_id: b.shop_id, customer_id: b.customer_id || b.shop_id,
          name: b.name, address: b.address || '', area: b.area || '',
          assigned_driver: b.assigned_driver || '', mobile: b.mobile || '', flag: b.flag || '',
          lat: b.lat !== '' && b.lat != null ? parseFloat(b.lat) : null,
          lng: b.lng !== '' && b.lng != null ? parseFloat(b.lng) : null,
          last_updated_by: b.last_updated_by || '', last_updated_at: b.last_updated_at || ''
        });

      case 'updateShop':
        return sbPatch('shops', { shop_id: b.shop_id }, {
          customer_id: b.customer_id || b.shop_id,
          name: b.name, address: b.address || '', area: b.area || '',
          assigned_driver: b.assigned_driver || '', mobile: b.mobile || '', flag: b.flag || '',
          lat: b.lat !== '' && b.lat != null ? parseFloat(b.lat) : null,
          lng: b.lng !== '' && b.lng != null ? parseFloat(b.lng) : null,
          last_updated_by: b.last_updated_by || '', last_updated_at: b.last_updated_at || ''
        });

      case 'deleteShop':
        return sbDelete('shops', { shop_id: b.shop_id });

      case 'saveGPS':
        return sbPatch('shops', { shop_id: b.shop_id }, {
          lat: parseFloat(b.lat), lng: parseFloat(b.lng),
          last_updated_by: b.driver || '',
          last_updated_at: new Date().toLocaleString('en-IN')
        });

      case 'addOrder':
        return sbPost('orders', {
          customer_id: b.customer_id || b.shop_id, shop_id: b.shop_id || b.customer_id,
          shop_name: b.shop_name, driver: b.driver || 'Logistics',
          items: b.items, qty: b.qty, note: b.note || '', date: b.date
        });

      // Batch insert — single request for any number of orders
      case 'addOrders':
        return sbPost('orders', b.orders.map(function (o) {
          return {
            customer_id: o.customer_id || o.shop_id, shop_id: o.shop_id || o.customer_id,
            shop_name: o.shop_name, driver: o.driver || 'Logistics',
            items: o.items, qty: o.qty, note: o.note || '', date: o.date
          };
        }));

      case 'deleteOrder':
        return sbDelete('orders', { order_id: b.order_id });

      case 'updateOrderDriver':
        return sbPatch('orders', { order_id: b.order_id }, { driver: b.driver });

      // Updates all orders belonging to a customer (used after approving a new customer)
      case 'updateOrderDriverByCustomer':
        return sbPatch('orders', { customer_id: b.customer_id }, { driver: b.driver });

      case 'markDelivered':
        return sbUpsert('deliveries', {
          driver: b.driver, shop_id: b.shop_id, shop_name: b.shop_name,
          date: b.date, time: b.time
        }, 'driver,shop_id,date');

      case 'saveRouteStart': {
        var rData = { driver: b.driver, date: b.date, start_time: b.startTime };
        if (b.lat != null && b.lng != null) {
          rData.start_lat = parseFloat(b.lat);
          rData.start_lng = parseFloat(b.lng);
        }
        return sbUpsert('routes', rData, 'driver,date');
      }

      case 'saveRoute':
        return sbUpsert('routes', {
          driver: b.driver, date: b.date,
          shop_order: b.shop_order, total_shops: b.total_shops,
          total_km: b.total_km, est_time: b.est_time
        }, 'driver,date');

      case 'addProduct':
        return sbPost('products', {
          product_id: b.product_id, name: b.name, category: b.category || '',
          price: b.price || '', unit: b.unit || 'Pieces', description: b.description || ''
        });

      // Batch upsert — single request for any number of products
      case 'addProducts':
        return sbUpsert('products', b.products.map(function (p) {
          return {
            product_id: p.product_id, name: p.name, category: p.category || '',
            price: p.price || '', unit: p.unit || 'Pieces', description: p.description || ''
          };
        }), 'product_id');

      case 'updateProduct':
        return sbPatch('products', { product_id: b.product_id }, {
          name: b.name, category: b.category || '',
          price: b.price || '', unit: b.unit || 'Pieces', description: b.description || ''
        });

      case 'deleteProduct':
        return sbDelete('products', { product_id: b.product_id });

      case 'addDriver':
        return sbPost('drivers', { name: b.name, password: b.password, mobile: b.mobile || '', color: b.color || 'blue', active: true });

      case 'updateDriver': {
        var upd = { name: b.name, mobile: b.mobile || '', color: b.color, active: b.active };
        if (b.password) upd.password = b.password; // only update password if provided
        return sbPatch('drivers', { id: b.id }, upd);
      }

      case 'deleteDriver':
        return sbDelete('drivers', { id: b.id });

      // Single PATCH — updates all matching rows in one request
      // b.from = source driver (or '' for any), b.to = destination driver
      case 'bulkReassignDriver': {
        var now = new Date().toLocaleString('en-IN');
        var body = { assigned_driver: b.to, last_updated_by: 'Admin (Bulk)', last_updated_at: now };
        var filterStr = b.from
          ? 'assigned_driver=eq.' + encodeURIComponent(b.from)
          : 'assigned_driver=neq.' + encodeURIComponent(b.to);
        return fetch(BASE + '/shops?' + filterStr, {
          method: 'PATCH',
          headers: hdrs({ 'Prefer': 'return=minimal' }),
          body: JSON.stringify(body)
        })
        .then(function (r) { return r.ok ? { ok: true } : { ok: false, error: 'Bulk reassign failed' }; })
        .catch(function () { return { ok: false, error: 'Network error' }; });
      }

      case 'addStaff':
        return sbPost('staff', {
          name: b.name, password: b.password,
          role: b.role || 'admin', tabs: b.tabs || '[]', active: true
        });

      case 'updateStaff': {
        var upd = { name: b.name, role: b.role, tabs: b.tabs || '[]', active: b.active };
        if (b.password) upd.password = b.password;
        return sbPatch('staff', { id: b.id }, upd);
      }

      case 'deleteStaff':
        return sbDelete('staff', { id: b.id });

      default:
        return Promise.resolve({ ok: false, error: 'Unknown action: ' + b.action });
    }
  };
})();
