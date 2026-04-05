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
  HQ: { lat: 18.5734, lng: 73.9197, name: "It's Baked · Lohegaon" },

  DRIVERS: ['Bharat', 'Anand', 'Vikas', 'Yuvraj', 'Rama'],

  // Customer tracking page contacts
  LOGISTICS_NAME:             "Satelkar's Logistics",
  LOGISTICS_DELIVERY_MGR_NAME:   'Yuvraj Koli',
  LOGISTICS_DELIVERY_MGR_MOBILE: '8262900425',
  LOGISTICS_OWNER1_NAME:      'Dinesh Satelkar',
  LOGISTICS_OWNER1_MOBILE:    '8956276855',
  LOGISTICS_OWNER2_NAME:      'Siddhesh Satelkar',
  LOGISTICS_OWNER2_MOBILE:    '9886527036',

  // Ajjas live tracking token
  AJJAS_TOKEN: '054b93d4279604a1387cfe6b7452e583',

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

  VERSION: '2.0'
};
