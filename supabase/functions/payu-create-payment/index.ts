/**
 * PayU Hosted Checkout — create payment (hash + form params)
 *
 * TEST ONLY for demo customer (xyz111). Salt never leaves this function.
 *
 * Deploy:
 *   supabase functions deploy payu-create-payment --no-verify-jwt
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   PAYU_KEY   = p3geOd          (test key)
 *   PAYU_SALT  = tziVfn9F4ahPyAhCUSYKkv87iaOw5XkX
 *   PAYU_MODE  = test            (or "live")
 *
 * Client calls this, receives form fields, then auto-POSTs to PayU.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Demo customer usernames allowed to use PayU (lowercase). Expand later. */
const DEMO_USERNAMES = new Set(["xyz111"]);

function sha512Hex(input: string): string {
  // Deno has Web Crypto
  // We need sync-like for simplicity — use SubtleCrypto via async wrapper in caller
  return input; // placeholder, real impl below
}

async function sha512(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeTxnId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `IBCAB${t}${r}`.toUpperCase().slice(0, 28);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("PAYU_KEY") || "p3geOd";
  const salt = Deno.env.get("PAYU_SALT") || "tziVfn9F4ahPyAhCUSYKkv87iaOw5XkX";
  const mode = (Deno.env.get("PAYU_MODE") || "test").toLowerCase();
  const payuUrl =
    mode === "live"
      ? "https://secure.payu.in/_payment"
      : "https://test.payu.in/_payment";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const loginUsername = String(body.login_username || body.username || "")
    .trim()
    .toLowerCase();
  const shopId = String(body.shop_id || "").trim();
  const amountRaw = body.amount;
  const amountNum = Number(amountRaw);
  if (!shopId || !Number.isFinite(amountNum) || amountNum < 1) {
    return new Response(
      JSON.stringify({ error: "shop_id and amount (>=1) required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Restrict to demo customer only
  if (!DEMO_USERNAMES.has(loginUsername)) {
    return new Response(
      JSON.stringify({
        error: "PayU test is enabled only for demo customer",
        hint: "login_username must be xyz111",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Amount must be string with 2 decimals for PayU
  const amount = amountNum.toFixed(2);
  const productinfo = String(body.productinfo || "Bakery invoices").slice(0, 100);
  const firstname = String(body.firstname || body.shop_name || "Customer").slice(
    0,
    60,
  );
  const email = String(body.email || "demo@ibcab.test").slice(0, 50);
  const phone = String(body.phone || body.mobile || "9999999999").replace(
    /\D/g,
    "",
  ).slice(-10) || "9999999999";

  const invoiceIds = Array.isArray(body.invoice_ids)
    ? (body.invoice_ids as unknown[]).map(String).join(",")
    : String(body.invoice_ids || "").trim();

  const udf1 = shopId.slice(0, 255);
  const udf2 = invoiceIds.slice(0, 255);
  const udf3 = loginUsername.slice(0, 255);
  const udf4 = "";
  const udf5 = "";

  const txnid = makeTxnId();

  // Origin for surl/furl — prefer explicit, else referer
  const origin =
    String(body.origin || "").replace(/\/$/, "") ||
    (req.headers.get("origin") || "").replace(/\/$/, "") ||
    "https://bakery-gps.vercel.app";

  const surl = `${origin}/order.html?payu=success`;
  const furl = `${origin}/order.html?payu=failure`;

  // Hash: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
  // (exactly 5 empty fields between udf5 and salt → 6 pipes)
  const hashString =
    key +
    "|" +
    txnid +
    "|" +
    amount +
    "|" +
    productinfo +
    "|" +
    firstname +
    "|" +
    email +
    "|" +
    udf1 +
    "|" +
    udf2 +
    "|" +
    udf3 +
    "|" +
    udf4 +
    "|" +
    udf5 +
    "||||||" +
    salt;

  const hash = await sha512(hashString);

  // Optional: log intent in a simple table later; for now just return form
  const form = {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    phone,
    surl,
    furl,
    hash,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    service_provider: "payu_paisa",
  };

  return new Response(
    JSON.stringify({
      ok: true,
      mode,
      payu_url: payuUrl,
      form,
      txnid,
      amount,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
