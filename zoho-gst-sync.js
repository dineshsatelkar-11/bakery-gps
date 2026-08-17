/**
 * Zoho product-level GST sync helpers + overrides
 * Loaded after admin.html scripts. Redefines pull/apply to include tax_id.
 */
(function(){
  function _zohoExtractTaxId(z){
    if(!z || typeof z !== 'object') return '';
    var prefs = z.item_tax_preferences;
    if(Array.isArray(prefs) && prefs.length){
      var intra = prefs.find(function(p){ return String(p.tax_specification||'').toLowerCase()==='intra'; });
      var pick = intra || prefs[0];
      if(pick && pick.tax_id) return String(pick.tax_id).trim();
    }
    if(z.tax_id) return String(z.tax_id).trim();
    return '';
  }
  function _zohoExtractTaxLabel(z){
    if(!z || typeof z !== 'object') return '';
    var pct = z.tax_percentage != null ? String(z.tax_percentage) : '';
    var name = (z.tax_name || '').trim();
    if(name && pct) return name + ' ' + pct + '%';
    if(name) return name;
    if(pct) return pct + '%';
    return '';
  }
  window._zohoExtractTaxId = _zohoExtractTaxId;
  window._zohoExtractTaxLabel = _zohoExtractTaxLabel;

  // Patch apply to always include tax when row has ztax
  var _origApply = window.zohoApplyProductPull;
  // We cannot easily wrap without original pull producing ztax.
  // Full override of zohoPullProducts + zohoApplyProductPull once originals exist.
  function install(){
    if(typeof window.zohoPullProducts !== 'function') return false;
    var _pull = window.zohoPullProducts;
    var _apply = window.zohoApplyProductPull;

    window.zohoPullProducts = function(){
      if(typeof _zohoEnabled !== 'undefined' && !_zohoEnabled){
        if(typeof _zohoPullMsg==='function') _zohoPullMsg('zoho-pull-prod-msg', 'Turn on Zoho Integration first.', 'er');
        return;
      }
      if(typeof _zohoPullMsg==='function') _zohoPullMsg('zoho-pull-prod-msg', '⏳ Pulling items from Zoho…', 'in');
      var applyBtn = document.getElementById('zoho-apply-prod-btn');
      var listEl = document.getElementById('zoho-pull-prod-list');
      var sumEl = document.getElementById('zoho-pull-prod-summary');
      if(applyBtn) applyBtn.style.display = 'none';
      if(listEl) listEl.style.display = 'none';
      if(sumEl) sumEl.style.display = 'none';
      Promise.all([
        zohoEdge('list_items', { page: 1, per_page: 200 }),
        loadProductMaster(true)
      ]).then(function(res){
        var data = res[0] || {};
        if(data.code !== 0 && data.code !== undefined){
          throw data.message || ('Zoho error ' + data.code);
        }
        var items = data.items || data.item || [];
        if(!Array.isArray(items)) items = [];
        if(!items.length && data.message){
          throw data.message + ' — ensure zoho-token edge function supports action list_items';
        }
        window._zohoPullProducts = items.map(function(z){
          var zid = String(z.item_id || '');
          var zname = (z.name || '').trim();
          var zrate = z.rate != null ? String(z.rate) : '';
          var zsku = (z.sku || '').trim();
          var ztax = _zohoExtractTaxId(z);
          var ztaxLbl = _zohoExtractTaxLabel(z);
          var local = (allProducts||[]).find(function(p){
            return String(p.product_id||'') === zid
              || (zsku && String(p.product_id||'') === zsku)
              || (zname && (p.name||'').trim().toLowerCase() === zname.toLowerCase());
          });
          var changes = [];
          if(!local) return { kind:'new', zoho:z, zid:zid, zname:zname, zrate:zrate, zsku:zsku, ztax:ztax, ztaxLbl:ztaxLbl, local:null, changes:['New product'] };
          if(zname && zname !== (local.name||'')) changes.push('Name: '+(local.name||'')+' → '+zname);
          if(zrate && String(local.price||'') !== zrate) changes.push('Price: '+(local.price||'—')+' → '+zrate);
          var localTax = String(local.tax_id || local.zoho_tax_id || '').trim();
          if(ztax && ztax !== localTax) changes.push('GST Tax ID: '+(localTax||'—')+' → '+ztax+(ztaxLbl?' ('+ztaxLbl+')':''));
          return { kind: changes.length?'changed':'same', zoho:z, zid:zid, zname:zname, zrate:zrate, zsku:zsku, ztax:ztax, ztaxLbl:ztaxLbl, local:local, changes:changes };
        });
        var nNew = window._zohoPullProducts.filter(function(r){ return r.kind==='new'; }).length;
        var nChg = window._zohoPullProducts.filter(function(r){ return r.kind==='changed'; }).length;
        var nSame = window._zohoPullProducts.filter(function(r){ return r.kind==='same'; }).length;
        if(sumEl){
          sumEl.style.display = 'block';
          sumEl.innerHTML = '<div class="stat"><div class="stat-n">'+nNew+'</div><div class="stat-l">New</div></div>'+
            '<div class="stat"><div class="stat-n">'+nChg+'</div><div class="stat-l">Changed</div></div>'+
            '<div class="stat"><div class="stat-n">'+nSame+'</div><div class="stat-l">Same</div></div>'+
            '<div class="stat"><div class="stat-n">'+window._zohoPullProducts.length+'</div><div class="stat-l">From Zoho</div></div>';
        }
        if(listEl){
          listEl.style.display = 'block';
          var rows = window._zohoPullProducts.filter(function(r){ return r.kind!=='same'; });
          if(!rows.length){
            listEl.innerHTML = '<div style="padding:12px;font-size:12px;color:#8a7a6a;font-family:monospace">No new or changed products.</div>';
            if(applyBtn) applyBtn.style.display = 'none';
          } else {
            listEl.innerHTML = rows.map(function(r){
              var badge = r.kind==='new'
                ? '<span style="background:#e8f5e9;color:#2d7a4f;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:800">NEW</span>'
                : '<span style="background:#fff8e1;color:#7a4800;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:800">CHANGED</span>';
              return '<label style="display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid #f0e8dc;cursor:pointer">'+
                '<input type="checkbox" class="zoho-pull-prod-cb" data-idx="'+window._zohoPullProducts.indexOf(r)+'" checked style="margin-top:3px;accent-color:#2d7a4f">'+
                '<div style="flex:1">'+
                  '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+badge+
                    '<span style="font-size:13px;font-weight:700">'+esc(r.zname||'—')+'</span></div>'+
                  '<div style="font-size:10px;color:#8a7a6a;font-family:monospace">ID '+esc(r.zid)+(r.zrate?' · ₹'+esc(r.zrate):'')+(r.zsku?' · SKU '+esc(r.zsku):'')+'</div>'+
                  (r.changes.length?'<div style="font-size:11px;margin-top:3px">'+esc(r.changes.join(' · '))+'</div>':'')+
                '</div></label>';
            }).join('');
            if(applyBtn) applyBtn.style.display = 'block';
          }
        }
        if(typeof _zohoPullMsg==='function') _zohoPullMsg('zoho-pull-prod-msg', '✅ Pulled '+window._zohoPullProducts.length+' items. Review & confirm to apply.', 'ok');
      }).catch(function(err){
        if(typeof _zohoPullMsg==='function') _zohoPullMsg('zoho-pull-prod-msg', '❌ '+(err && err.message ? err.message : String(err)), 'er');
      });
    };

    window.zohoApplyProductPull = function(){
      var cbs = Array.from(document.querySelectorAll('.zoho-pull-prod-cb:checked'));
      if(!cbs.length){ alert('Select at least one row.'); return; }
      if(!confirm('Apply '+cbs.length+' product change(s) to the app?')) return;
      if(typeof _zohoPullMsg==='function') _zohoPullMsg('zoho-pull-prod-msg', '⏳ Applying…', 'in');
      var jobs = cbs.map(function(cb){
        var row = window._zohoPullProducts[parseInt(cb.dataset.idx,10)];
        if(!row) return Promise.resolve();
        var z = row.zoho || {};
        if(row.kind === 'new'){
          return addProduct({
            product_id: row.zid || row.zsku || '',
            name: row.zname || '',
            price: row.zrate || 0,
            tax_id: row.ztax || _zohoExtractTaxId(z) || '',
            // other fields as needed from original
          });
        }
        var loc = row.local || {};
        var taxToSave = row.ztax || _zohoExtractTaxId(z) || loc.tax_id || loc.zoho_tax_id || '';
        return updateProduct(loc.id || loc.product_id, {
          name: row.zname || loc.name,
          price: row.zrate != null ? row.zrate : loc.price,
          tax_id: taxToSave,
        });
      });
      Promise.all(jobs).then(function(){
        if(typeof _zohoPullMsg==='function') _zohoPullMsg('zoho-pull-prod-msg', '✅ Applied '+cbs.length+' product update(s) with GST tax_id.', 'ok');
        var applyBtn = document.getElementById('zoho-apply-prod-btn');
        if(applyBtn) applyBtn.style.display = 'none';
        if(typeof loadProductMaster==='function') loadProductMaster(true);
      }).catch(function(e){
        if(typeof _zohoPullMsg==='function') _zohoPullMsg('zoho-pull-prod-msg', '❌ Apply failed: '+(e && e.message ? e.message : e), 'er');
      });
    };
    return true;
  }
  function tryInstall(){
    if(install()) return;
    setTimeout(tryInstall, 500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInstall);
  else tryInstall();
})();
