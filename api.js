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

  function sbGet(table, where, order, select) {
    var url = BASE + '/' + table + '?select=' + (select || '*');
    if (where && Object.keys(where).length) url += '&' + filters(where);
    if (order) url += '&order=' + order;
    return fetch(url, { headers: hdrs() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  // Fetches ALL rows by paginating in batches of 1000.
  // Needed for large tables (Supabase default max is 1000 rows per request).
  function fetchAll(table, where, order, select) {
    var PAGE = 1000;
    var results = [];

    function nextPage(offset) {
      var url = BASE + '/' + table + '?select=' + (select || '*');
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

      case 'getShops': {
        // Single shop by shop_id (customer session refresh)
        if (p.shop_id)  return sbGet('shops', { shop_id: p.shop_id });
        if (p.brand)    return sbGet('shops', { brand: p.brand }, 'name');
        // Driver app passes driverId (preferred) or falls back to name string
        if (p.driverId) return sbGet('shops', { assigned_driver_id: p.driverId }, 'name');
        if (p.driver)   return sbGet('shops', { assigned_driver: p.driver }, 'name');
        // Admin: paginated fetch of all shops
        return fetchAll('shops', {}, 'name');
      }

      case 'getOrders': {
        var where = { date: p.date };
        if (p.driver) where.driver = p.driver;
        return sbGet('orders', where, 'shop_name');
      }

      // Queue: fetch all orders for the date, caller filters unassigned
      case 'getQueueOrders':
        return sbGet('orders', { date: p.date }, 'shop_name');

         case 'checkDcNums': {
           // Full order fields so caller can detect updates on re-import
           var inList = p.dc_nums.map(function(n){ return encodeURIComponent(n); }).join(',');
           var url = BASE + '/orders?select=order_id,dc_num,items,qty,item_ids,driver,shop_id,customer_id,shop_name,date,note&dc_num=in.(' + inList + ')';
           return fetch(url, { headers: hdrs() })
             .then(function(r){ return r.ok ? r.json() : []; })
             .catch(function(){ return []; });
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
        if (p.group_id) {
          var gidInt = parseInt(p.group_id);
          // Try junction table RPC first; fall back to direct group_id column if RPC missing
          return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/get_products_for_group', {
            method: 'POST', headers: hdrs(),
            body: JSON.stringify({ p_group_id: gidInt })
          }).then(function(r){
            if (r.ok) return r.json();
            // RPC not available — fall back to old group_id column
            return fetch(BASE + '/products?group_id=eq.' + gidInt + '&active=eq.true&order=category,name', {
              headers: hdrs()
            }).then(function(r2){ return r2.ok ? r2.json() : []; });
          }).catch(function(){
            return fetch(BASE + '/products?group_id=eq.' + gidInt + '&active=eq.true&order=category,name', {
              headers: hdrs()
            }).then(function(r2){ return r2.ok ? r2.json() : []; }).catch(function(){ return []; });
          });
        }
        return sbGet('products', {}, 'name');

      case 'getProductGroups':
        return sbGet('product_groups', {}, 'name');

      // Get product IDs belonging to a group (for admin group editor)
      case 'getGroupProductIds':
        return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/get_group_product_ids', {
          method: 'POST', headers: hdrs(),
          body: JSON.stringify({ p_group_id: parseInt(p.group_id) })
        }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });

      // Get member counts for all groups {group_id, cnt}[]
      case 'getGroupMemberCounts':
        return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/get_group_member_counts', {
          method: 'POST', headers: hdrs(), body: JSON.stringify({})
        }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });

      case 'getProductsByGroup': {
        var url = BASE + '/products?active=eq.true&order=category,name';
        if (p.group_id) url += '&group_id=eq.' + encodeURIComponent(p.group_id);
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .catch(function(){ return []; });
      }

      case 'customerLogin':
        return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/customer_login', {
          method: 'POST', headers: hdrs(),
          body: JSON.stringify({ p_username: p.username, p_password: p.password })
        }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });

      case 'getCustomerOrders': {
        var url = BASE + '/customer_orders?select=*&order=created_at.desc';
        if (p.status)         url += '&status=eq.'         + encodeURIComponent(p.status);
        if (p.shop_id)        url += '&shop_id=eq.'        + encodeURIComponent(p.shop_id);
        if (p.delivery_date)  url += '&delivery_date=eq.'  + encodeURIComponent(p.delivery_date);
        if (p.statuses && p.statuses.length)
          url += '&status=in.(' + p.statuses.map(encodeURIComponent).join(',') + ')';
        if (p.limit)          url += '&limit=' + parseInt(p.limit);
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .catch(function(){ return []; });
      }

      case 'getDrivers':
        // Uses RPC so password column is never sent over the wire
        return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/get_drivers_public', {
          method: 'POST', headers: hdrs(), body: JSON.stringify({})
        }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });

      case 'getStaff':
        // Uses RPC so password column is never sent over the wire
        return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/get_staff_public', {
          method: 'POST', headers: hdrs(), body: JSON.stringify({})
        }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });

      case 'driverLogin':
        return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/driver_login', {
          method: 'POST', headers: hdrs(),
          body: JSON.stringify({ p_name: p.name, p_password: p.password })
        }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });

      case 'staffLogin':
        return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/staff_login', {
          method: 'POST', headers: hdrs(),
          body: JSON.stringify({ p_name: p.name, p_password: p.password })
        }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });


      case 'getShopByMobile': {
        // Use LIKE *digits to match any stored format (+91, 91, ', etc.)
        var url = BASE + '/shops?mobile=like.*' + encodeURIComponent(p.digits) + '&limit=5';
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .catch(function(){ return []; });
      }

      case 'getLatestDate': {
        // Returns the most recent date that has data in a given table
        var url = BASE + '/' + p.table + '?select=date&order=date.desc&limit=1';
        if (p.driver) url += '&driver=eq.' + encodeURIComponent(p.driver);
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .then(function(rows){ return (rows && rows.length && rows[0].date) ? rows[0].date : null; })
          .catch(function(){ return null; });
      }

         case 'getShopDeliveryHistory': {
           // Last N days of deliveries for a specific shop
           var days = p.days || 7;
           var since = new Date();
           since.setDate(since.getDate() - days);
           var sinceDate = since.toISOString().slice(0, 10);
           // Higher limit for longer ranges (customer history uses days:90)
           var lim = Math.min(Math.max(days * 2, 14), 200);
           var url = BASE + '/deliveries?shop_id=eq.' + encodeURIComponent(p.shop_id) +
                     '&date=gte.' + encodeURIComponent(sinceDate) +
                     '&select=date,time,driver&order=date.desc&limit=' + lim;
           return fetch(url, { headers: hdrs() })
             .then(function(r){ return r.ok ? r.json() : []; })
             .catch(function(){ return []; });
         }

               // Past orders for one shop (items/qty) — used by customer History tab
               case 'getShopOrdersHistory': {
                 var days = p.days || 90;
                 var since = new Date();
                 since.setDate(since.getDate() - days);
                 var sinceDate = since.toISOString().slice(0, 10);
                 var lim = Math.min(Math.max(days * 2, 30), 200);
                 var url = BASE + '/orders?shop_id=eq.' + encodeURIComponent(p.shop_id) +
                           '&date=gte.' + encodeURIComponent(sinceDate) +
                           '&select=date,items,qty,driver,note,shop_name&order=date.desc&limit=' + lim;
                 return fetch(url, { headers: hdrs() })
                   .then(function(r){ return r.ok ? r.json() : []; })
                   .catch(function(){ return []; });
               }

      case 'getDeliveriesHistory': {
        // Fetch last N days of deliveries for historical route analysis
        var days = p.days || 30;
        var since = new Date();
        since.setDate(since.getDate() - days);
        var sinceDate = since.toISOString().slice(0, 10);
        var url = BASE + '/deliveries?driver=eq.' + encodeURIComponent(p.driver) +
                  '&date=gte.' + encodeURIComponent(sinceDate) +
                  '&select=shop_id,date,time&order=date.desc,time.asc&limit=2000';
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .catch(function(){ return []; });
      }

      case 'getOrdersDateRange': {
        var days = p.days || 30;
        var since = new Date();
        since.setDate(since.getDate() - days);
        var sinceDate = since.toISOString().slice(0, 10);
        var url = BASE + '/orders?select=date&date=gte.' + encodeURIComponent(sinceDate) + '&limit=10000';
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .catch(function(){ return []; });
      }

      case 'getNotifications': {
        var url = BASE + '/notifications?driver_name=eq.' + encodeURIComponent(p.driver) +
                  '&is_read=eq.false&order=created_at.desc&limit=50';
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .catch(function(){ return []; });
      }

      case 'getOrdersHistory': {
        // Last N days orders (excluding today) for spike detection
        var days = p.days || 7;
        var since = new Date();
        since.setDate(since.getDate() - days);
        var sinceDate = since.toISOString().slice(0, 10);
        var url = BASE + '/orders?select=shop_id,qty,date&date=gte.' + encodeURIComponent(sinceDate) +
                  '&order=date.desc&limit=5000';
        return fetch(url, { headers: hdrs() })
          .then(function(r){ return r.ok ? r.json() : []; })
          .catch(function(){ return []; });
      }

      case 'getSetting':
        return sbGet('settings', {key: p.key})
          .then(function(rows){ return rows&&rows.length ? rows[0] : null; });

      case 'getCustomerNotifications':
        return sbGet('customer_notifications', { shop_id: p.shop_id, is_read: false }, 'created_at.desc');

      case 'getCrateLogs': {
        var where = {};
        if (p.date)   where.date   = p.date;
        if (p.driver) where.driver = p.driver;
        return sbGet('crate_logs', where, 'date.desc,driver');
      }

      // ── 🧂 INGREDIENTS ───────────────────────────────────────────────────────
      case 'getIngredients':
        return sbGet('ingredients', {}, 'name');

      // ── 📋 RECIPES ───────────────────────────────────────────────────────────
      case 'getRecipes':
        // Returns all recipe lines; JS groups them by product_id client-side
        return sbGet('product_recipes', {}, 'product_id,ingredient_name');

      default:
        return Promise.resolve([]);
    }
  };

  // ── POST handler ─────────────────────────────────────────────────────────────
  window.apiPost = function (b) {
    switch (b.action) {

      case 'addShop':
        return sbUpsert('shops', {
          shop_id: b.shop_id, customer_id: b.customer_id || b.shop_id,
          name: b.name, address: b.address || '', area: b.area || '',
           brand: b.brand || null,
          assigned_driver: b.assigned_driver || '', mobile: b.mobile || '', flag: b.flag || '',
          lat: b.lat !== '' && b.lat != null ? parseFloat(b.lat) : null,
          lng: b.lng !== '' && b.lng != null ? parseFloat(b.lng) : null,
          drop_photo_url:        b.drop_photo_url,
              drop_photo_by:         b.drop_photo_by,
              drop_photo_updated_at: b.drop_photo_updated_at,
              drop_photo_file_id:    b.drop_photo_file_id,
          drop_note:              b.drop_note,
              drop_note_by:          b.drop_note_by,
              drop_note_updated_at:  b.drop_note_updated_at,
          last_updated_by: b.last_updated_by || '', last_updated_at: b.last_updated_at || ''
        }, 'shop_id');

      case 'updateShop':
        return sbPatch('shops', { shop_id: b.shop_id }, {
          customer_id: b.customer_id || b.shop_id,
          name: b.name, address: b.address || '', area: b.area || '',
           brand: b.brand !== undefined ? (b.brand || null) : undefined,
          assigned_driver: b.assigned_driver || '', mobile: b.mobile || '', flag: b.flag || '',
          lat: b.lat !== '' && b.lat != null ? parseFloat(b.lat) : null,
          lng: b.lng !== '' && b.lng != null ? parseFloat(b.lng) : null,
          zoho_doc_type:   b.zoho_doc_type,
          drop_photo_url:        b.drop_photo_url,
              drop_photo_by:         b.drop_photo_by,
              drop_photo_updated_at: b.drop_photo_updated_at,
              drop_photo_file_id:    b.drop_photo_file_id,
          drop_note:              b.drop_note,
              drop_note_by:          b.drop_note_by,
              drop_note_updated_at:  b.drop_note_updated_at,
          last_updated_by: b.last_updated_by || '', last_updated_at: b.last_updated_at || ''
        });

      case 'deleteShop': {
        // Cascade: remove dependent rows first, then the shop.
        // shop_id is the primary key; customer_id is often the same but not always.
        var sid = b.shop_id || b.customer_id;
        var cid = b.customer_id || b.shop_id || sid;
        if (!sid) return Promise.resolve({ ok: false, error: 'Missing shop_id' });

        function delBy(table, col, val) {
          return fetch(BASE + '/' + table + '?' + encodeURIComponent(col) + '=eq.' + encodeURIComponent(val), {
            method: 'DELETE',
            headers: hdrs({ 'Prefer': 'return=minimal' })
          }).then(function (r) {
            if (r.ok) return { ok: true };
            return r.json().then(function (e) {
              return { ok: false, error: e.message || e.hint || e.details || ('Delete failed on ' + table) };
            }).catch(function () { return { ok: false, error: 'Delete failed on ' + table + ' (HTTP ' + r.status + ')' }; });
          }).catch(function () { return { ok: false, error: 'Network error deleting from ' + table }; });
        }

        // Child tables that reference the shop (order matters for FKs)
        var steps = [
          function () { return delBy('customer_notifications', 'shop_id', sid); },
          function () { return delBy('push_subscriptions', 'shop_id', sid); },
          function () { return delBy('customer_orders', 'shop_id', sid); },
          function () { return delBy('deliveries', 'shop_id', sid); },
          function () { return delBy('orders', 'shop_id', sid); }
        ];
        // If customer_id differs, also clear orders keyed by customer_id
        if (cid && cid !== sid) {
          steps.push(function () { return delBy('orders', 'customer_id', cid); });
        }

        return steps.reduce(function (chain, fn) {
          return chain.then(function (prev) {
            if (prev && prev.ok === false) return prev;
            return fn();
          });
        }, Promise.resolve({ ok: true })).then(function (prev) {
          if (prev && prev.ok === false) return prev;
          // Delete the shop row and verify something was removed
          function delShopVerify(col, val) {
            return fetch(BASE + '/shops?' + encodeURIComponent(col) + '=eq.' + encodeURIComponent(val), {
              method: 'DELETE',
              headers: hdrs({ 'Prefer': 'return=representation' })
            }).then(function (r) {
              if (!r.ok) {
                return r.json().then(function (e) {
                  return { ok: false, error: e.message || e.hint || e.details || ('Delete failed (HTTP ' + r.status + ')') };
                }).catch(function () { return { ok: false, error: 'Delete failed (HTTP ' + r.status + ')' }; });
              }
              return r.json().then(function (rows) {
                var n = Array.isArray(rows) ? rows.length : 0;
                if (n > 0) return { ok: true, deleted: n };
                return { ok: false, error: 'No shop found with ' + col + '=' + val + ' (already deleted, or RLS blocked the delete)' };
              }).catch(function () {
                // return=representation may be empty body on some configs
                return { ok: true };
              });
            }).catch(function () { return { ok: false, error: 'Network error deleting shop' }; });
          }
          return delShopVerify('shop_id', sid).then(function (res) {
            if (res.ok) return res;
            if (cid && cid !== sid) return delShopVerify('customer_id', cid);
            return res;
          });
        });
      }

      // Delete a drop-point photo: removes the file from Drive storage first,
      // and only clears the shop's photo fields once that succeeds. If Drive
      // deletion fails, the DB row is left untouched (both still exist) so the
      // photo reference and the actual file never fall out of sync.
      case 'deleteDropPhoto': {
        return sbGet('shops', { shop_id: b.shop_id }, null, 'shop_id,drop_photo_url,drop_photo_file_id')
          .then(function (rows) {
            var row = rows && rows[0];
            if (!row || !row.drop_photo_url) {
              // Nothing to delete — treat as already clean.
              return { ok: true };
            }
            // Prefer the stored file_id (reliable); fall back to parsing the
            // thumbnail URL for older rows saved before file_id was tracked.
            return fetch(CONFIG.DRIVE_UPLOAD_URL, {
              method: 'POST',
              body: JSON.stringify({
                action: 'delete',
                shop_id: b.shop_id,
                file_id: row.drop_photo_file_id || undefined,
                fileUrl: row.drop_photo_url
              })
            })
            .then(function (r) {
              return r.json().catch(function () { return { ok: false, error: 'Bad response from storage service' }; });
            })
            .then(function (delRes) {
              if (!delRes || !delRes.ok) {
                var errMsg = (delRes && delRes.error) || 'Could not delete photo from storage';
                if (window.logError) {
                  window.logError('api.js', 'deleteDropPhoto', new Error('Drive delete failed for shop ' + b.shop_id + ': ' + errMsg));
                }
                return { ok: false, error: errMsg };
              }
              // File confirmed gone from Drive — now safe to clear the DB row.
              return sbPatch('shops', { shop_id: b.shop_id }, {
                drop_photo_url: null,
                drop_photo_by: null,
                drop_photo_updated_at: null,
                drop_photo_file_id: null,
                last_updated_by: b.driver || '',
                last_updated_at: new Date().toLocaleString('en-IN')
              });
            })
            .catch(function (err) {
              if (window.logError) window.logError('api.js', 'deleteDropPhoto', err);
              return { ok: false, error: 'Network error deleting photo' };
            });
          })
          .catch(function (err) {
            if (window.logError) window.logError('api.js', 'deleteDropPhoto', err);
            return { ok: false, error: 'Network error looking up photo' };
          });
      }

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
          items: b.items, qty: b.qty, note: b.note || '', date: b.date,
          dc_num: b.dc_num || ''
        });

      // Batch insert — single request for any number of orders
      case 'addOrders':
        return sbPost('orders', b.orders.map(function (o) {
          return {
            customer_id: o.customer_id || o.shop_id, shop_id: o.shop_id || o.customer_id,
            shop_name: o.shop_name, driver: o.driver || 'Logistics',
            items: o.items, qty: o.qty, item_ids: o.item_ids || '', note: o.note || '', date: o.date,
            dc_num: o.dc_num || ''
          };
        }));

      case 'deleteOrder':
        return sbDelete('orders', { order_id: b.order_id });

      case 'updateOrder':
        return sbPatch('orders', { order_id: b.order_id }, b.patch || {});

      case 'updateOrderDriver':
        return sbPatch('orders', { order_id: b.order_id }, { driver: b.driver });

      case 'substituteDriver':
        // Reassign all orders for a driver on a specific date to another driver (today only)
        return sbPatch('orders', { driver: b.from, date: b.date }, { driver: b.to });

      case 'cancelDelivery':
        // Undo a mistaken delivery mark — delete by driver+shop_id+date
        return sbDelete('deliveries', { driver: b.driver, shop_id: b.shop_id, date: b.date });

      // Updates all orders belonging to a customer (used after approving a new customer)
      case 'updateOrderDriverByCustomer':
        return sbPatch('orders', { customer_id: b.customer_id }, { driver: b.driver });

      // Update undelivered orders for one customer from today onwards when their driver changes
      case 'reassignOrdersForCustomer': {
        var today0 = new Date().toISOString().slice(0, 10);
        var url0 = BASE + '/orders?shop_id=eq.' + encodeURIComponent(b.shop_id) + '&date=gte.' + encodeURIComponent(today0);
        return fetch(url0, {
          method: 'PATCH',
          headers: hdrs({ 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ driver: b.driver })
        }).then(function(r) {
          return r.ok ? { ok: true } : r.json().then(function(e) { return { ok: false, error: e.message || 'Error' }; });
        }).catch(function() { return { ok: false, error: 'Network error' }; });
      }

      // Bulk: update all undelivered orders belonging to a driver from today onwards
      case 'bulkReassignOrderDriver': {
        var today1 = new Date().toISOString().slice(0, 10);
        var url1 = BASE + '/orders?driver=eq.' + encodeURIComponent(b.from) + '&date=gte.' + encodeURIComponent(today1);
        return fetch(url1, {
          method: 'PATCH',
          headers: hdrs({ 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ driver: b.to })
        }).then(function(r) {
          return r.ok ? { ok: true } : r.json().then(function(e) { return { ok: false, error: e.message || 'Error' }; });
        }).catch(function() { return { ok: false, error: 'Network error' }; });
      }

      case 'markDelivered': {
        var delRow = { driver: b.driver, shop_id: b.shop_id, shop_name: b.shop_name, date: b.date, time: b.time };
        if (b.lat != null) { delRow.lat = b.lat; delRow.lng = b.lng; }
        return sbUpsert('deliveries', delRow, 'driver,shop_id,date');
      }

      case 'saveRouteStart': {
        var rData = { driver: b.driver, date: b.date, start_time: b.startTime };
        if (b.lat != null && b.lng != null) {
          rData.start_lat = parseFloat(b.lat);
          rData.start_lng = parseFloat(b.lng);
        }
        return sbUpsert('routes', rData, 'driver,date');
      }

      case 'saveRoute': {
        var rRow = {
          driver: b.driver, date: b.date,
          shop_order: b.shop_order, total_shops: b.total_shops,
          total_km: b.total_km, est_time: b.est_time
        };
        // Always include start_time when available so it isn't lost on re-upsert
        if (b.start_time) { rRow.start_time = b.start_time; }
        return sbUpsert('routes', rRow, 'driver,date');
      }

      case 'addProduct':
        return sbPost('products', {
          product_id: b.product_id, name: b.name, category: b.category || '',
          price: b.price || '', unit: b.unit || 'Pieces', description: b.description || '',
          group_id: b.group_id || null, active: b.active !== false
        });

      // Batch insert new products only — ignore duplicates so existing category/price are never overwritten
      case 'addProducts':
        return sbPost('products', b.products.map(function (p) {
          return {
            product_id: p.product_id, name: p.name, category: p.category || '',
            price: p.price || '', unit: p.unit || 'Pieces', description: p.description || '',
            group_id: p.group_id || null, active: p.active !== false
          };
               }), 'resolution=ignore-duplicates,return=minimal');

             // Update prices only for products on NEW orders in current upload
             case 'updateProductPrices': {
               var list = b.products || [];
               if (!list.length) return Promise.resolve({ ok: true, updated: 0 });
               return Promise.all(list.map(function(p){
                 var patch = {};
                 if (p.price !== undefined && p.price !== null && p.price !== '') patch.price = String(p.price);
                 if (p.name) patch.name = p.name;
                 if (!Object.keys(patch).length) return Promise.resolve({ ok: true });
                 return sbPatch('products', { product_id: p.product_id }, patch);
               })).then(function(){ return { ok: true, updated: list.length }; })
                 .catch(function(e){ return { ok: false, error: String(e) }; });
             }

             case 'updateProduct':
        return sbPatch('products', { product_id: b.product_id }, {
          name: b.name, category: b.category || '',
          price: b.price || '', unit: b.unit || 'Pieces', description: b.description || '',
          group_id: b.group_id || null, active: b.active !== false
        });

      case 'deleteProduct':
        return sbDelete('products', { product_id: b.product_id });

      // Product Groups
      case 'addProductGroup':
        return sbPost('product_groups', { name: b.name });

      case 'updateProductGroup':
        return sbPatch('product_groups', { id: b.id }, { name: b.name });

      case 'deleteProductGroup':
        return sbDelete('product_groups', { id: b.id });

      // Bulk assign/remove products to/from a group via junction table
      case 'assignProductsToGroup': {
        var gidInt = parseInt(b.group_id);
        var ops = [];
        if (b.add_ids && b.add_ids.length) {
          // product_id is TEXT in junction table — never parseInt
          var rows = b.add_ids.map(function(pid){ return { product_id: String(pid), group_id: gidInt }; });
          ops.push(fetch(BASE + '/product_group_members', {
            method: 'POST',
            headers: hdrs({ 'Prefer': 'return=minimal,resolution=ignore-duplicates' }),
            body: JSON.stringify(rows)
          }).then(function(r){ return r.ok ? { ok: true } : { ok: false }; })
            .catch(function(){ return { ok: false }; }));
        }
        if (b.remove_ids && b.remove_ids.length) {
          var remStr = b.remove_ids.map(function(pid){ return encodeURIComponent(String(pid)); }).join(',');
          ops.push(fetch(BASE + '/product_group_members?product_id=in.(' + remStr + ')&group_id=eq.' + gidInt, {
            method: 'DELETE',
            headers: hdrs({ 'Prefer': 'return=minimal' })
          }).then(function(r){ return r.ok ? { ok: true } : { ok: false }; })
            .catch(function(){ return { ok: false }; }));
        }
        if (!ops.length) return Promise.resolve({ ok: true });
        return Promise.all(ops)
          .then(function(res){ return res.every(function(r){ return r.ok; }) ? { ok: true } : { ok: false, error: 'Some updates failed' }; })
          .catch(function(){ return { ok: false, error: 'Network error' }; });
      }

      // Get group IDs that a product belongs to (from junction table)
      case 'getProductGroupIds':
        return fetch(BASE + '/product_group_members?product_id=eq.' + encodeURIComponent(String(p.product_id)) + '&select=group_id', {
          headers: hdrs()
        }).then(function(r){ return r.ok ? r.json() : []; })
          .then(function(rows){ return rows.map(function(r){ return r.group_id; }); })
          .catch(function(){ return []; });

      // Customer portal: update shop login credentials + product group
      case 'updateShopLogin': {
        var ids = Array.isArray(b.product_group_ids) ? b.product_group_ids.map(Number).filter(Boolean) : [];
        var patch = {
          product_group_id:  ids.length ? ids[0] : null,
          product_group_ids: ids
        };
        // Only update username/password if explicitly provided — prevents clearing on group-only edits
        if (b.login_username !== undefined) patch.login_username = b.login_username || null;
        if (b.login_password !== undefined) patch.login_password = b.login_password || null;
        return sbPatch('shops', { shop_id: b.shop_id }, patch);
      }

           // Customer: change own password (verified via RPC first)
           case 'changeCustomerPassword':
             return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/change_customer_password', {
               method: 'POST', headers: hdrs(),
               body: JSON.stringify({ p_shop_id: b.shop_id, p_old_password: b.old_password, p_new_password: b.new_password })
             }).then(function(r){ return r.ok ? r.json() : false; })
               .then(function(ok){ return { ok: !!ok }; })
               .catch(function(){ return { ok: false }; });

           // Staff / brand admin: change own password
           // 1) Verify old password via staff_login RPC
           // 2) If valid, patch the password on the staff row (matched by name)
           case 'changeStaffPassword':
             return fetch(BASE.replace('/rest/v1','') + '/rest/v1/rpc/staff_login', {
               method: 'POST', headers: hdrs(),
               body: JSON.stringify({ p_name: b.name, p_password: b.old_password })
             })
             .then(function(r){ return r.ok ? r.json() : []; })
             .then(function(rows){
               var ok = Array.isArray(rows) ? rows.length > 0 : !!rows;
               if (!ok) return { ok: false, error: 'Current password is incorrect' };
               return sbPatch('staff', { name: b.name }, { password: b.new_password });
             })
             .catch(function(){ return { ok: false, error: 'Network error' }; });

           // Customer places order
           case 'placeCustomerOrder':
             return sbPost('customer_orders', {
               shop_id: b.shop_id, shop_name: b.shop_name,
               delivery_date: b.delivery_date,
               items: b.items, qty: b.qty, note: b.note || '',
               status: 'pending',
               zoho_doc_type: b.zoho_doc_type || 'invoice'
             });

      // Customer editing their own pending order (or amending an approved one)
      case 'updateCustomerOrder': {
        var upd2 = { items: b.items, qty: b.qty, note: b.note || '' };
        if (b.reset_to_pending) upd2.status = 'pending';
        return sbPatch('customer_orders', { id: b.id }, upd2);
      }

      // Admin / kitchen / packaging: update order status
      case 'updateCustomerOrderStatus': {
        var upd = { status: b.status };
        if (b.status === 'approved')   upd.approved_at     = new Date().toISOString();
        if (b.status === 'packaging')  upd.kitchen_done_at = new Date().toISOString();
        if (b.status === 'dispatched') upd.packaged_at     = new Date().toISOString();
        if (b.admin_note !== undefined)      upd.admin_note        = b.admin_note;
        if (b.items !== undefined)           upd.items             = b.items;
        if (b.qty   !== undefined)           upd.qty               = b.qty;
        if (b.note  !== undefined)           upd.note              = b.note;
        if (b.zoho_invoice_id !== undefined) upd.zoho_invoice_id   = b.zoho_invoice_id;
        if (b.zoho_invoice_number !== undefined) upd.zoho_invoice_number = b.zoho_invoice_number;
        if (b.zoho_doc_type !== undefined)   upd.zoho_doc_type     = b.zoho_doc_type;
        return sbPatch('customer_orders', { id: b.id }, upd);
      }

      // Packaging: mark dispatched + create the driver orders row in one step
      case 'dispatchCustomerOrder': {
        var now = new Date().toISOString();
        return sbPatch('customer_orders', { id: b.id }, { status: 'dispatched', packaged_at: now })
          .then(function(res) {
            if (!res.ok) return res;
            return sbPost('orders', {
              customer_id: b.shop_id, shop_id: b.shop_id,
              shop_name:   b.shop_name,
              driver:      b.driver || '',
              items:       b.items,
              qty:         b.qty,
              note:        b.note || '',
              date:        b.delivery_date,
              dc_num:      'CO-' + b.id
            });
          });
      }

      case 'addDriver':
        return sbPost('drivers', {
          name: b.name, password: b.password, mobile: b.mobile || '',
          color: b.color || 'blue', active: true,
          tracking_url: b.tracking_url || '', tracking_enabled: b.tracking_enabled || false
        });

      case 'updateDriver': {
        var upd = {
          name: b.name, mobile: b.mobile || '', color: b.color, active: b.active,
          tracking_url: b.tracking_url || '', tracking_enabled: b.tracking_enabled || false
        };
        if (b.password) upd.password = b.password;
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
          role: b.role || 'admin', brand: b.brand || null, tabs: b.tabs || '[]', active: true
        });

      case 'updateStaff': {
        var upd = { name: b.name, brand: b.brand || null, role: b.role, tabs: b.tabs || '[]', active: b.active };
        if (b.password) upd.password = b.password;
        return sbPatch('staff', { id: b.id }, upd);
      }

      case 'deleteStaff':
        return sbDelete('staff', { id: b.id });

      case 'addNotification':
        return sbPost('notifications', {
          driver_name: b.driver_name, type: b.type, message: b.message, date: b.date || ''
        });

      case 'addNotifications':
        return sbPost('notifications', b.notifications.map(function(n){
          return { driver_name: n.driver_name, type: n.type, message: n.message, date: n.date || '' };
        }));

      case 'markNotificationsRead':
        return fetch(BASE + '/notifications?driver_name=eq.' + encodeURIComponent(b.driver) + '&is_read=eq.false', {
          method: 'PATCH',
          headers: hdrs({ 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ is_read: true })
        })
        .then(function(r){ return r.ok ? { ok: true } : { ok: false }; })
        .catch(function(){ return { ok: false }; });

      case 'cleanOldData': {
        // Delete data older than N days from orders, deliveries, routes, notifications
        var days = (!isNaN(parseInt(b.days)) && parseInt(b.days) >= 0) ? parseInt(b.days) : 7;
        var cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days + 1);
        var cutoffDate = cutoff.toISOString().slice(0, 10);
        var cutoffTs   = cutoff.toISOString();

        function countHeader(r) {
          var cr = r.headers.get('Content-Range') || '';
          var m  = cr.match(/\*\/(\d+)/);
          return m ? parseInt(m[1]) : 0;
        }

        function delTable(table, filter) {
          return fetch(BASE + '/' + table + '?' + filter, {
            method: 'DELETE',
            headers: hdrs({ 'Prefer': 'count=exact,return=minimal' })
          }).then(function(r){ return r.ok ? countHeader(r) : 0; })
            .catch(function(){ return 0; });
        }

        return Promise.all([
          delTable('orders',                'date=lt.' + encodeURIComponent(cutoffDate)),
          delTable('deliveries',            'date=lt.' + encodeURIComponent(cutoffDate)),
          delTable('routes',                'date=lt.' + encodeURIComponent(cutoffDate)),
          delTable('crate_logs',            'date=lt.' + encodeURIComponent(cutoffDate)),
          delTable('notifications',         'created_at=lt.' + encodeURIComponent(cutoffTs)),
          delTable('customer_notifications','created_at=lt.' + encodeURIComponent(cutoffTs))
        ]).then(function(counts) {
          return {
            ok: true,
            orders:                 counts[0],
            deliveries:             counts[1],
            routes:                 counts[2],
            crate_logs:             counts[3],
            notifications:          counts[4],
            customer_notifications: counts[5],
            cutoff:                 cutoffDate
          };
        }).catch(function(){ return { ok: false, error: 'Network error' }; });
      }

      case 'savePushSubscription':
        return fetch(BASE + '/push_subscriptions?shop_id=eq.' + encodeURIComponent(b.shop_id), {
          method: 'DELETE', headers: hdrs({ 'Prefer': 'return=minimal' })
        }).catch(function(){}).then(function(){
          return sbPost('push_subscriptions', {
            shop_id:  b.shop_id,
            endpoint: b.endpoint,
            p256dh:   b.p256dh,
            auth:     b.auth
          });
        });

      case 'deletePushSubscription':
        return fetch(BASE + '/push_subscriptions?shop_id=eq.' + encodeURIComponent(b.shop_id), {
          method: 'DELETE', headers: hdrs({ 'Prefer': 'return=minimal' })
        }).then(function(r){ return {ok: r.ok}; }).catch(function(){ return {ok:false}; });

      case 'sendCustomerNotification':
        return sbPost('customer_notifications', {
          shop_id: b.shop_id, shop_name: b.shop_name || '', message: b.message
        }).then(function(res) {
          if (!res.ok) return res;
          return fetch(BASE + '/customer_notifications?shop_id=eq.' + encodeURIComponent(b.shop_id) +
            '&select=id&order=created_at.desc&offset=10', { headers: hdrs() })
            .then(function(r){ return r.ok ? r.json() : []; })
            .then(function(old){
              if (!old.length) return;
              var ids = old.map(function(r){ return r.id; }).join(',');
              return fetch(BASE + '/customer_notifications?id=in.(' + ids + ')', {
                method: 'DELETE', headers: hdrs({ 'Prefer': 'return=minimal' })
              }).catch(function(){});
            }).then(function(){ return res; });
        });

      case 'markCustomerNotifsRead':
        return fetch(BASE + '/customer_notifications?shop_id=eq.' + encodeURIComponent(b.shop_id) + '&is_read=eq.false', {
          method: 'PATCH',
          headers: hdrs({ 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ is_read: true })
        }).then(function(r){ return r.ok ? { ok: true } : { ok: false }; })
          .catch(function(){ return { ok: false }; });

      case 'setSetting':
        return sbUpsert('settings', {key: b.key, value: b.value}, 'key');

      case 'logCratesTaken':
        return sbUpsert('crate_logs',
          {driver: b.driver, date: b.date, crates_taken: b.crates, taken_time: b.time},
          'driver,date');

      case 'logCratesReturned':
        return sbUpsert('crate_logs',
          {driver: b.driver, date: b.date, crates_returned: b.crates, returned_time: b.time},
          'driver,date');

      // ── 🧂 INGREDIENTS ───────────────────────────────────────────────────────

      case 'saveIngredient': {
        // If id provided → update existing; otherwise → insert new
        var row = {
          name:          b.name,
          unit:          b.unit,
          cost_per_unit: parseFloat(b.cost_per_unit) || 0
        };
        if (b.id) {
          return sbPatch('ingredients', { id: b.id }, row);
        }
        return sbPost('ingredients', row, 'return=representation')
          .then(function(r){ return r.ok ? { ok: true } : r; });
      }

      case 'deleteIngredient':
        // Cascades to product_recipes via FK ON DELETE CASCADE
        return sbDelete('ingredients', { id: b.id });

      // ── 📋 RECIPES ───────────────────────────────────────────────────────────

      case 'saveRecipe': {
        // Strategy: delete all existing lines for this product, then re-insert.
        // Simpler than diffing — recipes are small and saved atomically.
        var pid = b.product_id;
        var lines = Array.isArray(b.lines) ? b.lines.filter(function(l){
          return l.ingredient_id && l.qty_per_unit > 0;
        }) : [];

        // Step 1: delete existing lines for this product
        return fetch(BASE + '/product_recipes?product_id=eq.' + encodeURIComponent(pid), {
          method: 'DELETE',
          headers: hdrs({ 'Prefer': 'return=minimal' })
        })
        .then(function(r){
          if (!r.ok) return { ok: false, error: 'Failed to clear old recipe lines' };
          // Step 2: insert new lines (skip if empty — just clearing is valid)
          if (!lines.length) return { ok: true };
          var rows = lines.map(function(l){
            return {
              product_id:      String(pid),
              ingredient_id:   parseInt(l.ingredient_id),
              ingredient_name: l.ingredient_name || '',
              qty_per_unit:    parseFloat(l.qty_per_unit),
              unit:            l.unit || ''
            };
          });
          return sbPost('product_recipes', rows);
        })
        .catch(function(){ return { ok: false, error: 'Network error' }; });
      }

      // ── ZOHO BOOKS (TESTING MODE) ─────────────────────────────────────────────
      case 'zohoSyncCustomer':
        console.log('[ZOHO TESTING] Sync customer →', { customer_id: b.customer_id, name: b.name });
        return Promise.resolve({ ok: true, zoho_contact_id: 'TEST-CUST-' + b.customer_id });

      case 'zohoSyncProduct':
        console.log('[ZOHO TESTING] Sync product →', { product_id: b.product_id, name: b.name });
        return Promise.resolve({ ok: true, zoho_item_id: 'TEST-ITEM-' + b.product_id });

      case 'zohoCreateInvoice':
        console.log('[ZOHO TESTING] Create invoice →', {
          customer_id: b.customer_id, shop_name: b.shop_name,
          date: b.date, line_items: b.line_items, order_id: b.order_id
        });
        return Promise.resolve({ ok: true, invoice_id: 'TEST-INV-' + Date.now() });

      case 'logError':
        return sbPost('error_log', {
          page:      b.page      || '',
          action:    b.action2   || '',
          message:   b.message   || '',
          stack:     b.stack     || '',
          user_role: b.user_role || '',
          user_name: b.user_name || ''
        }).catch(function(){ return { ok: false }; });

      default:
        return Promise.resolve({ ok: false, error: 'Unknown action: ' + b.action });
    }
  };

  // ── Global error logger ───────────────────────────────────────────────────────
  window.logError = function(page, action, err) {
    try {
      var role = sessionStorage.getItem('role') || localStorage.getItem('staffRole') || '';
      var name = sessionStorage.getItem('staffName') || localStorage.getItem('staffNamePersist') || '';
      apiPost({
        action:    'logError',
        page:      page || window.location.pathname,
        action2:   action || '',
        message:   err ? (err.message || String(err)) : '',
        stack:     err && err.stack ? err.stack.substring(0, 800) : '',
        user_role: role,
        user_name: name
      }).catch(function(){});
    } catch(e) {}
  };
})();