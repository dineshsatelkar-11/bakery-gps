
/* Brand admin Pay button patch — inject shop-wise Pay on Payments + Shops */
(function(){
  function escAttr(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
  function money(n){
    n = Number(n)||0;
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  // Hook renderInvoiceList if present
  var tries = 0;
  function enhance(){
    tries++;
    if (typeof window.openBrandPaySheetForShop !== 'function') {
      if (tries < 50) return setTimeout(enhance, 200);
      return;
    }
    // Re-wrap renderInvoiceList to add buttons after render
    if (typeof window.renderInvoiceList === 'function' && !window._payBtnPatched) {
      var orig = window.renderInvoiceList;
      window.renderInvoiceList = function(){
        orig.apply(this, arguments);
        try {
          var cards = document.querySelectorAll('#inv-list .inv-card');
          var rows = window._brandInvRows || [];
          cards.forEach(function(card, idx){
            if (card.querySelector('.inv-pay-btn')) return;
            var r = rows[idx];
            if (!r) return;
            var due = r.due || 0;
            if (due <= 0.009) return;
            var sid = String(r.shop_id || '').replace(/'/g,'');
            var wrap = document.createElement('div');
            wrap.style.marginTop = '12px';
            wrap.innerHTML = '<button type="button" class="inv-pay-btn" style="width:100%;padding:12px;font-size:13px" onclick="openBrandPaySheetForShop(\''+sid+'\')">💰 Pay / record · '+money(due)+'</button>';
            // Insert after dues grid if present
            var dues = card.querySelector('.shop-dues');
            if (dues && dues.nextSibling) card.insertBefore(wrap, dues.nextSibling);
            else card.appendChild(wrap);
          });
        } catch(e) { console.warn('pay btn patch', e); }
      };
      window._payBtnPatched = true;
      try { window.renderInvoiceList(); } catch(e){}
    }
    // Re-wrap renderShopList
    if (typeof window.renderShopList === 'function' && !window._shopPayBtnPatched) {
      var origS = window.renderShopList;
      window.renderShopList = function(){
        origS.apply(this, arguments);
        try {
          var cards = document.querySelectorAll('#shop-content .shop-card');
          cards.forEach(function(card){
            if (card.querySelector('.shop-action.pay')) return;
            var dueEl = card.querySelector('.shop-row-top div[style*="text-align:right"] div');
            // Find due from monospace red amount
            var actions = card.querySelector('.shop-actions');
            if (!actions) return;
            var onclickHist = actions.innerHTML;
            // Extract shop id from Edit button
            var m = onclickHist.match(/openShopEdit\('([^']+)'\)/);
            if (!m) return;
            var id = m[1];
            // Only if total due shown as red amount
            var hasDue = !!card.querySelector('.shop-row-top div[style*="color:#c8382a"]');
            if (!hasDue) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shop-action pay';
            btn.textContent = '💰 Pay';
            btn.setAttribute('onclick', "openBrandPaySheetForShop('"+id+"')");
            actions.insertBefore(btn, actions.firstChild);
          });
        } catch(e) { console.warn('shop pay patch', e); }
      };
      window._shopPayBtnPatched = true;
      try { window.renderShopList(); } catch(e){}
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
})();
