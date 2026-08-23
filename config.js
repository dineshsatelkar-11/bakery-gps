// ─────────────────────────────────────────────
// BAKED GPS — Central Config
// 1. Create project at https://supabase.com
// 2. Go to Project Settings → API
// 3. Paste your Project URL and anon/public key below
// ─────────────────────────────────────────────

const CONFIG = {
  SUPABASE_URL:      'https://lprcdmwlrrukuhqdekah.supabase.co', // ← paste Project URL
  SUPABASE_ANON_KEY: 'sb_publishable_Tkemd93FwHu4Cg6BcgjLNA_w4cTxqea',                // ← paste anon/public key

  // Bakery HQ location (used for route optimisation in driver app)
  HQ: { lat: 18.60718624307306, lng: 73.92742696886077, name: "IBCAB · Lohegaon" },

  DRIVERS: ['Bharat', 'Anand', 'Vikas', 'Yuvraj', 'Rama'],

  // Customer tracking page contacts
  LOGISTICS_NAME:             "Satelkar's Logistics",
  LOGISTICS_OWNER1_NAME:      'Dinesh Satelkar',
  LOGISTICS_OWNER1_MOBILE:    '8956276855',
  LOGISTICS_OWNER2_NAME:      'Siddhesh Satelkar',
  LOGISTICS_OWNER2_MOBILE:    '9886527036',

  // WhatsApp group link — opened when driver completes all deliveries
  WHATSAPP_GROUP: 'https://chat.whatsapp.com/Bjta1D8WDKe38qPCJGVigp',

  // Customer support WhatsApp number (with country code, digits only e.g. 918956276855)
  BAKERY_WHATSAPP: '918956276855',

  // Driver app translations
  LANG: {
    en: {
      myRoute: 'My Route', myOrders: 'My Orders',
      startRoute: '🚀 Start Route', markDelivered: '✅ Mark Delivered',
      delivered: 'Delivered', pending: 'Pending', loading: 'Loading…',
      captureLocation: 'Capture My Location', confirmSave: 'Confirm & Save',
      noOrders: 'No orders for today.', routeStart: 'Open Route in Google Maps'
    },
    mr: {
      myRoute: 'माझा मार्ग', myOrders: 'माझे ऑर्डर',
      startRoute: '🚀 मार्ग सुरू करा', markDelivered: '✅ डिलिव्हरी केली',
      delivered: 'डिलिव्हर झाले', pending: 'बाकी आहे', loading: 'लोड होत आहे…',
      captureLocation: 'माझे स्थान घ्या', confirmSave: 'जतन करा',
      noOrders: 'आजचे ऑर्डर नाहीत.', routeStart: 'Google Maps मध्ये मार्ग उघडा'
    }
  },

  VERSION: '3.2',

  // ── Web Push (VAPID) ───────────────────────────────────────────────────────
  // 1. Open generate-vapid.html in your browser → click Generate → copy Public Key here
  // 2. Private Key goes into Supabase Edge Function secrets (never here)
  VAPID_PUBLIC_KEY: 'BPvVh1WI7_D4I7nzBYap6Psnys82iFG7ekPyZkwIHX2PltC5cAlK7t3XvcKdUJ00_U5ygtzem5OJ0Z8-vEQynu4'   // ← paste public key from generate-vapid.html

};
CONFIG.DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxVF8UuOIgL-r9BsNG_FmdcdgqFO1MpZMiNImsPQtHjH3i-QLRctU047Y7RazLpK9z9Ug/exec';
// Smart redirect — uses clean URLs on Vercel, .html locally (IntelliJ / file server)
function goto(page) {
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  window.location.href = isLocal ? (page ? page + '.html' : 'index.html') : (page ? '/' + page : '/');
}
