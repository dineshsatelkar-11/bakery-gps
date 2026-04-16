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
  LOGISTICS_DELIVERY_MGR_NAME:   'Yuvraj Koli',
  LOGISTICS_DELIVERY_MGR_MOBILE: '8262900425',
  LOGISTICS_OWNER1_NAME:      'Dinesh Satelkar',
  LOGISTICS_OWNER1_MOBILE:    '8956276855',
  LOGISTICS_OWNER2_NAME:      'Siddhesh Satelkar',
  LOGISTICS_OWNER2_MOBILE:    '9886527036',

  // WhatsApp group link — opened when driver completes all deliveries
  WHATSAPP_GROUP: 'https://chat.whatsapp.com/Bjta1D8WDKe38qPCJGVigp',

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

  VERSION: '2.0',

  // ── OneSignal Push Notifications ──────────────────────────────────────────
  // 1. Go to https://onesignal.com → Create account → New App
  // 2. Platform: Web Push → set your site URL (https://bakery-gps.vercel.app)
  // 3. Paste App ID and REST API Key below
  ONESIGNAL_APP_ID:       '675e2f16-661e-41f8-bace-d6353765d29e',       // ← Settings → Keys & IDs
  ONESIGNAL_REST_API_KEY: 'os_v2_app_m5pc6ftgdza7rowo2y2tozost2ahrdphowcu2dv2qcgxaecybbe6rtk6a5kcon3bcafvmydg7qtahikdedcpwirfzpur3v3qm4ackja'  // ← Settings → Keys & IDs
};

// Smart redirect — uses clean URLs on Vercel, .html locally (IntelliJ / file server)
function goto(page) {
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  window.location.href = isLocal ? (page ? page + '.html' : 'index.html') : (page ? '/' + page : '/');
}
