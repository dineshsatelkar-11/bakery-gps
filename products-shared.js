// ─────────────────────────────────────────────
// Shared product helpers — product_id → category only
// Used by admin, driver, kitchen, packaging
// Depends on: api() from api.js (for loadProductMaster)
// ─────────────────────────────────────────────
(function (global) {
  'use strict';

  var _products = [];
  var _byId = {};
  var _loaded = false;
  var _loading = null;

  function rebuildIndex(list) {
    _products = Array.isArray(list) ? list : [];
    _byId = {};
    _products.forEach(function (p) {
      var pid = String(p.product_id || '').trim();
      if (pid) _byId[pid] = p;
    });
    _loaded = true;
  }

  /** Load product master once (shared across calls on same page). */
  function loadProductMaster(force) {
    if (!force && _loaded) return Promise.resolve(_products);
    if (!force && _loading) return _loading;
    if (typeof api !== 'function') {
      return Promise.resolve(_products);
    }
    _loading = api({ action: 'getProducts' })
      .then(function (data) {
        rebuildIndex(Array.isArray(data) ? data : []);
        _loading = null;
        return _products;
      })
      .catch(function () {
        _loading = null;
        rebuildIndex([]);
        return _products;
      });
    return _loading;
  }

  /** Set master from an already-fetched list (e.g. admin allProducts). */
  function setProductMaster(list) {
    rebuildIndex(list);
  }

  function getProductById(pid) {
    pid = String(pid || '').trim();
    return pid ? (_byId[pid] || null) : null;
  }

  /**
   * Category from product_id only.
   * product_id found + category filled → that category
   * else → 'Other'
   */
  function catFromProductId(pid) {
    var p = getProductById(pid);
    var c = p && String(p.category || '').trim();
    return c || 'Other';
  }

  /**
   * Parse order row items/qty/item_ids into
   * [{ name, qty, product_id }, ...]
   */
  function parseOrderLines(o) {
    var its = String((o && o.items) || '')
      .split(',')
      .map(function (s) {
        return s.replace(/\s*\(.*?\)/g, '').trim();
      });
    var qs = String((o && o.qty) || '')
      .split(',')
      .map(function (s) {
        return parseInt(s, 10) || 0;
      });
    var ids = String((o && o.item_ids) || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      });
    var lines = [];
    for (var i = 0; i < its.length; i++) {
      if (!its[i]) continue;
      lines.push({
        name: its[i],
        qty: qs[i] || 0,
        product_id: ids[i] || ''
      });
    }
    return lines;
  }

  /**
   * Group order lines or [{name,qty,product_id}] by master category.
   * Returns { [category]: { total, items: [{name, qty, product_id}] } }
   */
  function groupByCat(itemsOrOrders) {
    var arr;
    if (!itemsOrOrders) {
      arr = [];
    } else if (Array.isArray(itemsOrOrders) && itemsOrOrders.length && itemsOrOrders[0] && (itemsOrOrders[0].items !== undefined || itemsOrOrders[0].shop_name !== undefined || itemsOrOrders[0].delivery_date !== undefined)) {
      // list of order rows
      arr = [];
      itemsOrOrders.forEach(function (o) {
        parseOrderLines(o).forEach(function (line) {
          arr.push(line);
        });
      });
    } else if (Array.isArray(itemsOrOrders)) {
      arr = itemsOrOrders;
    } else {
      // map name → qty
      arr = Object.keys(itemsOrOrders).map(function (name) {
        return { name: name, qty: itemsOrOrders[name], product_id: '' };
      });
    }

    var cats = {};
    arr.forEach(function (item) {
      var pid = String(item.product_id || '').trim();
      var cat = catFromProductId(pid);
      if (!cats[cat]) cats[cat] = { total: 0, items: [] };
      var existing = cats[cat].items.find(function (x) {
        if (pid && x.product_id && String(x.product_id) === pid) return true;
        if (!pid && !x.product_id && String(x.name || '') === String(item.name || '')) return true;
        return false;
      });
      if (existing) {
        existing.qty += item.qty || 0;
      } else {
        cats[cat].items.push({
          name: item.name,
          qty: item.qty || 0,
          product_id: pid || ''
        });
      }
      cats[cat].total += item.qty || 0;
    });

    Object.keys(cats).forEach(function (c) {
      cats[c].items.sort(function (a, b) {
        return b.qty - a.qty;
      });
    });
    return cats;
  }

  /** Sorted [category, {total, items}] entries (Other last if desired by caller). */
  function groupByCatEntries(itemsOrOrders) {
    var cats = groupByCat(itemsOrOrders);
    return Object.keys(cats)
      .map(function (c) {
        return [c, cats[c]];
      })
      .sort(function (a, b) {
        return b[1].total - a[1].total;
      });
  }

  /** Category for a display name using name→pid map (kitchen/packaging). */
  function catForName(name, nameToPid) {
    var pid = (nameToPid && nameToPid[name]) || '';
    return catFromProductId(pid);
  }

  // ── Puff packet calculator (15 & 10 packs) ───────────────────────────────
  /**
   * Calculate optimal packets for Puff products.
   * Prefers maximum number of 15-packs, then fills remainder with 10-packs.
   * Example: 25 → 1×15 + 1×10
   *          50 → 2×15 + 2×10
   */
  function calcPuffPackets(qty) {
    qty = parseInt(qty, 10) || 0;
    if (qty <= 0) return { fifteen: 0, ten: 0, text: '0' };

    // Prefer as many 15-packs as possible
    for (var a = Math.floor(qty / 15); a >= 0; a--) {
      var rem = qty - 15 * a;
      if (rem % 10 === 0) {
        var b = rem / 10;
        var parts = [];
        if (a > 0) parts.push(a + '×15');
        if (b > 0) parts.push(b + '×10');
        return {
          fifteen: a,
          ten: b,
          text: parts.join(' + ') || '0'
        };
      }
    }
    // Fallback when qty is not divisible by 5
    return { fifteen: 0, ten: 0, text: qty + ' (manual)' };
  }

  function isPuffProduct(name) {
    return /puff/i.test(String(name || ''));
  }

  /** Format quantity with packet breakdown for Puff products */
  function formatQtyWithPackets(name, qty) {
    qty = parseInt(qty, 10) || 0;
    if (!isPuffProduct(name)) return String(qty);
    var p = calcPuffPackets(qty);
    return qty + (p.text && p.text !== '0' ? ' (' + p.text + ')' : '');
  }

  global.ProductsShared = {
    loadProductMaster: loadProductMaster,
    setProductMaster: setProductMaster,
    getProductById: getProductById,
    catFromProductId: catFromProductId,
    parseOrderLines: parseOrderLines,
    groupByCat: groupByCat,
    groupByCatEntries: groupByCatEntries,
    catForName: catForName,
    calcPuffPackets: calcPuffPackets,
    isPuffProduct: isPuffProduct,
    formatQtyWithPackets: formatQtyWithPackets,
    getAll: function () {
      return _products;
    },
    getByIdMap: function () {
      return _byId;
    }
  };
})(typeof window !== 'undefined' ? window : this);
