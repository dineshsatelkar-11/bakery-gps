// Copy to config.js and fill in your real values. Do NOT commit config.js.
const CONFIG = {
  SUPABASE_URL:      'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

  HQ: { lat: 18.60718624307306, lng: 73.92742696886077, name: "IBCAB · Lohegaon" },

  DRIVERS: ['Bharat', 'Anand', 'Vikas', 'Yuvraj', 'Rama'],

  LOGISTICS_NAME:          "Satelkar's Logistics",
  LOGISTICS_OWNER1_NAME:   'Dinesh Satelkar',
  LOGISTICS_OWNER1_MOBILE: '8956276855',
  LOGISTICS_OWNER2_NAME:   'Siddhesh Satelkar',
  LOGISTICS_OWNER2_MOBILE: '9886527036',

  WHATSAPP_GROUP: 'https://chat.whatsapp.com/YOUR_GROUP',
  BAKERY_WHATSAPP: '91XXXXXXXXXX',

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
      startRoute: '🚀 मार्ग सुरू करा', markDelivered: '✅ डिलिव्हर केले',
      delivered: 'डिलिव्हर', pending: 'बाकी', loading: 'लोड होत आहे…',
      captureLocation: 'माझे स्थान कॅप्चर करा', confirmSave: 'पुष्टी करा आणि सेव्ह',
      noOrders: 'आज ऑर्डर नाहीत.', routeStart: 'Google Maps मध्ये मार्ग उघडा'
    }
  },

  ONESIGNAL_APP_ID:       'YOUR_ONESIGNAL_APP_ID',
  ONESIGNAL_REST_API_KEY: 'YOUR_ONESIGNAL_REST_API_KEY',
  VAPID_PUBLIC_KEY:       'YOUR_VAPID_PUBLIC_KEY',

  // Zoho Books — deposit-to account for customer payments (Mark Paid)
  // Chart of Accounts → open the bank/cash account → copy ID from URL
  ZOHO_PAYMENT_ACCOUNT_ID: 'YOUR_ZOHO_BANK_ACCOUNT_ID'
};
