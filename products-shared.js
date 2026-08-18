// ─────────────────────────────────────────────
// Shared product helpers — product_id → category
// Fallback: exact product name match when item_ids missing
// Used by admin, driver, kitchen, packaging
// Depends on: api() from api.js (for loadProductMaster)
// ─────────────────────────────────────────────
(function (global) {
  'use strict';

  var _products = [];
  var _byId = {};
  var _byName = {}; // lowercased trimmed name → product (first wins)
  var _loaded = false;
  var _loading = null;

  function rebuildIndex(list) {
    _products = Array.isArray(list) ? list : [];
    _byId = {};
    _byName = {};
    _products.forEach(function (p) {
      var pid = String(p.product_id || '').trim();
      if (pid) _byId[pid] = p;
      var n = String(p.name || '').trim().toLowerCase();
      if (n && !_byName[n]) _byName[n] = p;
    });
    _loaded = true;
  }

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

  function setProductMaster(list) {
    rebuildIndex(list);
  }

  function getProductById(pid) {
    pid = String(pid || '').trim();
    return pid ? (_byId[pid] || null) : null;
  }

  function getProductByName(name) {
    var n = String(name || '').trim().toLowerCase();
    return n ? (_byName[n] || null) : null;
  }

  function catFromProductId(pid) {
    var p = getProductById(pid);
    var c = p && String(p.category || '').trim();
    return c || 'Other';
  }

  /**
   * Resolve category for an order line.
   * 1) product_id → master.category
   * 2) if no id / not found → exact name match → master.category
   * 3) else Other
   * No fuzzy / keyword matching.
   */
  function catFromLine(item) {
    var pid = String((item && item.product_id) || '').trim();
    if (pid) {
      var byId = getProductById(pid);
      if (byId) {
        var c1 = String(byId.category || '').trim();
        if (c1) return c1;
      }
    }
    var byName = getProductByName(item && item.name);
    if (byName) {
      var c2 = String(byName.category || '').trim();
      if (c2) return c2;
      return 'Other';
    }
    return 'Other';
  }

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
    if (ids.length === 1 && !ids[0]) ids = [];

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

  function groupByCat(itemsOrOrders) {
    var arr;
    if (!itemsOrOrders) {
      arr = [];
    } else if (
      Array.isArray(itemsOrOrders) &&
      itemsOrOrders.length &&
      itemsOrOrders[0] &&
      (itemsOrOrders[0].items !== undefined ||
        itemsOrOrders[0].shop_name !== undefined ||
        itemsOrOrders[0].delivery_date !== undefined)
    ) {
      arr = [];
      itemsOrOrders.forEach(function (o) {
        parseOrderLines(o).forEach(function (line) {
          arr.push(line);
        });
      });
    } else if (Array.isArray(itemsOrOrders)) {
      arr = itemsOrOrders;
    } else {
      arr = Object.keys(itemsOrOrders).map(function (name) {
        return { name: name, qty: itemsOrOrders[name], product_id: '' };
      });
    }

    var cats = {};
    arr.forEach(function (item) {
      var pid = String(item.product_id || '').trim();
      if (!pid) {
        var matched = getProductByName(item.name);
        if (matched && matched.product_id) pid = String(matched.product_id).trim();
      }
      var cat = catFromLine({ name: item.name, product_id: pid || item.product_id });
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

  function catForName(name, nameToPid) {
    var pid = (nameToPid && nameToPid[name]) || '';
    if (pid) return catFromProductId(pid);
    return catFromLine({ name: name, product_id: '' });
  }

  /**
   * Pack pieces into ×15 and ×10 packets (prefer as many ×15 as possible, then ×10).
   * Example: 25 → 1×15 + 1×10 ; 35 → 1×15 + 2×10 ; 15 → 1×15
   *
   * IMPORTANT: Always call this per shop/order line, then SUM the packet counts.
   * Do NOT pack the grand-total qty (shop 25 + shop 35 ≠ pack(60)).
   */
  function calcPackPackets(qty) {
    qty = parseInt(qty, 10) || 0;
    if (qty <= 0) return { fifteen: 0, ten: 0, loose: 0, twentyFive: 0, text: '0' };
    // Exact pack: maximize 15s with remainder divisible by 10
    for (var a = Math.floor(qty / 15); a >= 0; a--) {
      var rem = qty - 15 * a;
      if (rem % 10 === 0) {
        var b = rem / 10;
        var parts = [];
        if (a > 0) parts.push(a + '×15');
        if (b > 0) parts.push(b + '×10');
        return { fifteen: a, ten: b, loose: 0, twentyFive: 0, text: parts.join(' + ') || '0' };
      }
    }
    // Not evenly packable — max 15s + max 10s + loose pieces
    var a2 = Math.floor(qty / 15);
    var rem2 = qty - 15 * a2;
    var b2 = Math.floor(rem2 / 10);
    var loose = rem2 - 10 * b2;
    var parts2 = [];
    if (a2 > 0) parts2.push(a2 + '×15');
    if (b2 > 0) parts2.push(b2 + '×10');
    if (loose > 0) parts2.push(loose + ' loose');
    return { fifteen: a2, ten: b2, loose: loose, twentyFive: 0, text: parts2.join(' + ') || '0' };
  }

  // Back-compat alias
  function calcPuffPackets(qty) {
    return calcPackPackets(qty);
  }

  /**
   * Any product with "puff" in the name: veg / chicken / paneer / egg / etc.
   */
  function isPuffProduct(name) {
    return /puff/i.test(String(name || ''));
  }

  function usesPacketPacking(name) {
    return isPuffProduct(name);
  }

  /** Veg / chicken / paneer (or other) label for grouping. */
  function puffKind(name) {
    var n = String(name || '').toLowerCase();
    if (/paneer/.test(n)) return 'Paneer';
    if (/chicken|chk|non.?veg/.test(n)) return 'Chicken';
    if (/veg|vegetable/.test(n)) return 'Veg';
    return 'Other puff';
  }

  /** Plain qty — packets shown only in the end summary block. */
  function formatQtyWithPackets(name, qty) {
    qty = parseInt(qty, 10) || 0;
    return String(qty);
  }

  /**
   * Sum packet counts across shops/orders.
   * Packs each shop line separately, then adds packet counts.
   * Includes all puff types: veg, chicken, paneer, …
   * Example: shop A 25 + shop B 35 → 2×15 + 3×10 (not pack(60)=4×15).
   */
  function sumPackPackets(itemsOrOrders) {
    var lines = [];
    if (!itemsOrOrders) {
      /* empty */
    } else if (Array.isArray(itemsOrOrders) && itemsOrOrders.length &&
        (itemsOrOrders[0].items !== undefined || itemsOrOrders[0].shop_name !== undefined)) {
      itemsOrOrders.forEach(function (o) {
        parseOrderLines(o).forEach(function (line) { lines.push(line); });
      });
    } else if (Array.isArray(itemsOrOrders)) {
      lines = itemsOrOrders;
    }
    var t15 = 0, t10 = 0, tLoose = 0, pieces = 0;
    var byKind = {}; // Veg / Chicken / Paneer / Other → { pieces, fifteen, ten, loose }
    lines.forEach(function (line) {
      if (!usesPacketPacking(line.name)) return;
      var q = parseInt(line.qty, 10) || 0;
      if (q <= 0) return;
      pieces += q;
      var p = calcPackPackets(q);
      t15 += p.fifteen || 0;
      t10 += p.ten || 0;
      tLoose += p.loose || 0;
      var kind = puffKind(line.name);
      if (!byKind[kind]) byKind[kind] = { pieces: 0, fifteen: 0, ten: 0, loose: 0 };
      byKind[kind].pieces += q;
      byKind[kind].fifteen += p.fifteen || 0;
      byKind[kind].ten += p.ten || 0;
      byKind[kind].loose += p.loose || 0;
    });
    var parts = [];
    if (t15 > 0) parts.push(t15 + '×15');
    if (t10 > 0) parts.push(t10 + '×10');
    if (tLoose > 0) parts.push(tLoose + ' loose');
    var packPcs = t15 * 15 + t10 * 10 + tLoose;
    return {
      fifteen: t15,
      ten: t10,
      loose: tLoose,
      twentyFive: 0,
      pieces: pieces,
      packPieces: packPcs,
      byKind: byKind,
      text: parts.join(' + ') || '0',
      label: (t15 || t10 || tLoose) ? ('📦 Packets: ' + (parts.join(' · ') || '0')) : ''
    };
  }

  /** Packet totals at the end — all puff types (veg + chicken + paneer). */
  function packPacketsHtml(itemsOrOrders, opts) {
    opts = opts || {};
    var s = sumPackPackets(itemsOrOrders);
    if (!s.fifteen && !s.ten && !s.loose && !s.pieces) return '';
    var bg = opts.bg || '#e8f5e9';
    var fg = opts.fg || '#1a5a38';
    var border = opts.border || '#a5d6a7';
    var kindOrder = ['Veg', 'Chicken', 'Paneer', 'Other puff'];
    var kindHtml = '';
    kindOrder.forEach(function (k) {
      var g = s.byKind && s.byKind[k];
      if (!g || !g.pieces) return;
      var kp = [];
      if (g.fifteen) kp.push(g.fifteen + '×15');
      if (g.ten) kp.push(g.ten + '×10');
      if (g.loose) kp.push(g.loose + ' loose');
      kindHtml +=
        '<div style="font-size:11px;font-family:monospace;color:#5a4a3a;margin-top:3px">' +
        '<b style="color:#4a2f14">' + k + '</b> ' + g.pieces + ' pcs' +
        (kp.length ? ' → ' + kp.join(' + ') : '') +
        '</div>';
    });
    return '<div style="margin-top:10px;padding-top:8px;border-top:2px dashed #e8dfd2">' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
      '<span style="font-size:10px;font-weight:800;color:#8a7a6a;font-family:monospace;text-transform:uppercase">Puff packets (all types · per shop)</span>' +
      (s.fifteen ? '<span style="background:' + bg + ';color:' + fg + ';border:1px solid ' + border + ';border-radius:20px;padding:4px 12px;font-size:13px;font-weight:900;font-family:monospace">' + s.fifteen + ' ×15</span>' : '') +
      (s.ten ? '<span style="background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:900;font-family:monospace">' + s.ten + ' ×10</span>' : '') +
      (s.loose ? '<span style="background:#fff8e1;color:#7a4800;border:1px solid #ffe082;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:800;font-family:monospace">' + s.loose + ' loose</span>' : '') +
      '<span style="font-size:11px;font-weight:700;color:#6a5040;font-family:monospace">= ' + s.pieces + ' pcs</span>' +
      '</div>' +
      kindHtml +
      '</div>';
  }

  global.ProductsShared = {
    loadProductMaster: loadProductMaster,
    setProductMaster: setProductMaster,
    getProductById: getProductById,
    getProductByName: getProductByName,
    catFromProductId: catFromProductId,
    catFromLine: catFromLine,
    parseOrderLines: parseOrderLines,
    groupByCat: groupByCat,
    groupByCatEntries: groupByCatEntries,
    catForName: catForName,
    calcPackPackets: calcPackPackets,
    calcPuffPackets: calcPuffPackets,
    isPuffProduct: isPuffProduct,
    usesPacketPacking: usesPacketPacking,
    formatQtyWithPackets: formatQtyWithPackets,
    sumPackPackets: sumPackPackets,
    packPacketsHtml: packPacketsHtml,
    getAll: function () { return _products; },
    getByIdMap: function () { return _byId; }
  };
})(typeof window !== 'undefined' ? window : this);
