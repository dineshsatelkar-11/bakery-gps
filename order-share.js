/**
 * UPI Share Target helper — loaded by order.html
 * PhonePe / GPay / Paytm / BHIM "Share receipt" → Pay request sheet
 */
(function () {
  function applySharedPayToUi(opts) {
    opts = opts || {};
    try { if (typeof showTab === 'function') showTab('payments'); } catch (e0) {}
    setTimeout(function () {
      try {
        if (typeof openPayRequestSheet === 'function') openPayRequestSheet();
        else if (typeof payOpenRequestSheet === 'function') payOpenRequestSheet();
      } catch (e1) {}
      var prev = document.getElementById('paySheetPhotoPreview');
      var img = opts.imageDataUrl || window._sharedPayImage || '';
      if (prev && img && String(img).indexOf('data:image') === 0) {
        prev.innerHTML =
          '<img src="' +
          String(img).replace(/"/g, '') +
          '" style="max-width:100%;max-height:140px;border-radius:10px;border:1px solid #e2e8f0" alt="Receipt">' +
          '<div style="font-size:11px;color:#166534;margin-top:6px">From UPI share — check UTR, then Send request</div>';
        prev.style.display = 'block';
      } else if (prev && opts.pdfOnly) {
        prev.innerHTML =
          '<div style="font-size:12px;color:#9a3412;padding:8px;background:#fff7ed;border-radius:8px">PDF receipt received. UTR filled if found. For photo proof, attach a <b>screenshot</b> below.</div>';
        prev.style.display = 'block';
      }
      var r = document.getElementById('paySheetUtr') || document.getElementById('payClaimUtr') || document.getElementById('paySheetRef');
      var n = document.getElementById('paySheetNote') || document.getElementById('payClaimNote');
      if (r && opts.utr) r.value = opts.utr;
      if (n && opts.text && !opts.utr) n.value = String(opts.text).slice(0, 200);
      if (opts.msg) {
        try { alert(opts.msg); } catch (e2) {}
      }
    }, 500);
  }

  function loadShareFromIndexedDb() {
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open('ibcab-share', 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('incoming')) db.createObjectStore('incoming');
        };
        req.onerror = function () { resolve(null); };
        req.onsuccess = function () {
          try {
            var db = req.result;
            var tx = db.transaction('incoming', 'readonly');
            var g = tx.objectStore('incoming').get('latest');
            g.onsuccess = function () { resolve(g.result || null); };
            g.onerror = function () { resolve(null); };
          } catch (e) { resolve(null); }
        };
      } catch (e) { resolve(null); }
    });
  }

  function clearShareFromIndexedDb() {
    try {
      var req = indexedDB.open('ibcab-share', 1);
      req.onsuccess = function () {
        try {
          var db = req.result;
          var tx = db.transaction('incoming', 'readwrite');
          tx.objectStore('incoming').delete('latest');
        } catch (e) {}
      };
    } catch (e) {}
  }

  function extractUtr(text) {
    var combined = String(text || '');
    var patterns = [
      /(?:UTR|UPI\s*Ref(?:erence)?|Ref(?:erence)?\s*(?:No|ID|#)?|Txn(?:\s*ID)?|Transaction\s*(?:ID|No)|RRN)[:\s#\-]*([A-Za-z0-9]{8,22})/i,
      /\b([0-9]{12})\b/,
      /\b([0-9]{10,22})\b/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = combined.match(patterns[i]);
      if (m && m[1]) return m[1];
    }
    return '';
  }

  function handleIncomingShare() {
    var params = new URLSearchParams(location.search || '');
    var fromShare = params.get('share') === '1' || params.get('share') === 'true';

    try {
      var sharedText = params.get('text') || params.get('title') || '';
      var sharedUrl = params.get('url') || '';
      if (sharedText || sharedUrl) {
        window._sharedPayText = [sharedText, sharedUrl].filter(Boolean).join('\n');
        var utrQ = extractUtr(window._sharedPayText);
        sessionStorage.setItem('sharedPayText', window._sharedPayText);
        if (utrQ) sessionStorage.setItem('sharedPayUtr', utrQ);
        fromShare = true;
      }
    } catch (e) {}

    loadShareFromIndexedDb().then(function (payload) {
      if (!payload) {
        if (fromShare) {
          applySharedPayToUi({
            msg: 'Share opened IBCAB. If screenshot is missing, attach it below, then Send request.'
          });
        }
        return;
      }
      var combined =
        payload.combined ||
        [payload.title, payload.text, payload.url].filter(Boolean).join('\n');
      var utr = payload.utr || extractUtr(combined);
      window._sharedPayText = combined;
      try {
        sessionStorage.setItem('sharedPayText', combined || '');
        if (utr) sessionStorage.setItem('sharedPayUtr', utr);
      } catch (e3) {}

      var dataUrl = payload.imageDataUrl || '';
      var mime = (payload.mime || '').toLowerCase();
      var isImage = dataUrl.indexOf('data:image') === 0 || mime.indexOf('image/') === 0;
      var isPdf =
        dataUrl.indexOf('data:application/pdf') === 0 ||
        mime.indexOf('pdf') >= 0 ||
        /\.pdf$/i.test(payload.fileName || '');

      if (isImage && dataUrl) {
        var b64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
        if (b64) {
          window._payProofBase64 = b64;
          window._sharedPayImage = dataUrl;
          try { sessionStorage.setItem('sharedPayImage', dataUrl); } catch (e4) {}
        }
        applySharedPayToUi({
          imageDataUrl: dataUrl,
          utr: utr,
          text: combined,
          msg: 'Payment receipt received (PhonePe / GPay / Paytm / etc.). Check UTR, then Send request to admin.'
        });
      } else if (isPdf) {
        applySharedPayToUi({
          pdfOnly: true,
          utr: utr,
          text: combined,
          msg: 'UPI app shared a PDF receipt. UTR filled if found. Please also attach a screenshot for proof, then Send request.'
        });
      } else {
        applySharedPayToUi({
          utr: utr,
          text: combined,
          msg: combined
            ? 'Share text received. Add screenshot if needed, then Send request.'
            : 'Share opened IBCAB. Attach payment screenshot and UTR, then Send request.'
        });
      }
      clearShareFromIndexedDb();
      try {
        if (location.search && window.history && history.replaceState) {
          history.replaceState({}, '', location.pathname + (location.hash || ''));
        }
      } catch (e5) {}
    });
  }

  // Launch Queue (some Chrome file shares)
  if (
    'launchQueue' in window &&
    typeof LaunchParams !== 'undefined' &&
    LaunchParams.prototype &&
    'files' in LaunchParams.prototype
  ) {
    try {
      window.launchQueue.setConsumer(function (launchParams) {
        if (!launchParams.files || !launchParams.files.length) return;
        var file = launchParams.files[0];
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = reader.result || '';
          var isImage = String(dataUrl).indexOf('data:image') === 0;
          if (isImage) {
            var b64 = String(dataUrl).indexOf(',') >= 0 ? String(dataUrl).split(',')[1] : '';
            if (b64) {
              window._payProofBase64 = b64;
              window._sharedPayImage = dataUrl;
              try { sessionStorage.setItem('sharedPayImage', dataUrl); } catch (e6) {}
            }
            applySharedPayToUi({
              imageDataUrl: dataUrl,
              msg: 'Payment screenshot received from share. Add UTR if needed, then Send request.'
            });
          } else {
            applySharedPayToUi({
              pdfOnly: true,
              msg: 'Shared file is not an image. Please attach a screenshot of the receipt, then Send request.'
            });
          }
        };
        reader.readAsDataURL(file);
      });
    } catch (e) {}
  }

  window.handleIncomingShare = handleIncomingShare;
  window.applySharedPayToUi = applySharedPayToUi;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      handleIncomingShare();
    });
  } else {
    handleIncomingShare();
  }
})();
