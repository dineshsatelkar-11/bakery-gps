/**
 * Payment webhook (UPI via Payment Gateway) — signature verification + mark paid
 *
 * IMPORTANT:
 * - Plain UPI QR (upi://pay to a VPA) does NOT send webhooks.
 * - This endpoint is for a Payment Gateway that supports UPI + webhooks
 *   (e.g. Razorpay payment.captured).
 *
 * Deploy:
 *   supabase functions deploy payment-webhook --no-verify-jwt
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   RAZORPAY_WEBHOOK_SECRET  = from Razorpay Dashboard → Webhooks
 *   SUPABASE_URL             = auto in many projects
 *   SUPABASE_SERVICE_ROLE_KEY= service role (mark paid + notify)
 *
 * Razorpay Dashboard → Webhooks → URL:
 *   https://<project>.supabase.co/functions/v1/payment-webhook
 *   Events: payment.captured
 *
 * Create order/payment with notes: { shop_id, invoice_ids: "1,2,3" }
 * so this webhook knows which customer_orders to mark paid.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
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

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!webhookSecret) {
    return new Response(
      JSON.stringify({
        error: "RAZORPAY_WEBHOOK_SECRET not configured",
        hint: "Static UPI QR has no webhook. Connect a PG and set the secret.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  // ── 1) Verify webhook signature (Razorpay HMAC SHA256) ───────────────
  let expected = "";
  try {
    expected = await hmacSha256Hex(webhookSecret, rawBody);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Signature compute failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!signature || !timingSafeEqual(expected, signature)) {
    console.warn("[payment-webhook] invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 2) Parse event ───────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventName = String(event.event || "");
  // Only treat successful capture as paid
  if (eventName !== "payment.captured" && eventName !== "order.paid") {
    return new Response(JSON.stringify({ ok: true, ignored: eventName }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = (event.payload || {}) as Record<string, unknown>;
  const paymentEntity =
    ((payload.payment as Record<string, unknown>)?.entity as Record<string, unknown>) ||
    ((payload.order as Record<string, unknown>)?.entity as Record<string, unknown>) ||
    {};

  const paymentId = String(paymentEntity.id || paymentEntity.payment_id || "");
  const amountPaise = Number(paymentEntity.amount || 0);
  const amountInr = amountPaise > 0 ? amountPaise / 100 : 0;
  const method = String(paymentEntity.method || "upi");
  const status = String(paymentEntity.status || "");
  const notes = (paymentEntity.notes || {}) as Record<string, string>;
  const shopId = String(notes.shop_id || notes.shopId || "").trim();
  const invoiceIdsRaw = String(notes.invoice_ids || notes.order_ids || "").trim();
  const invoiceIds = invoiceIdsRaw
    ? invoiceIdsRaw.split(/[, ]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  if (status && status !== "captured" && status !== "authorized" && eventName === "payment.captured") {
    // still process payment.captured
  }

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Supabase service env missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // ── 3) Find target orders ────────────────────────────────────────────
  let query = sb.from("customer_orders").select("id, shop_id, shop_name, payment_status, balance_due, invoice_total, zoho_invoice_number");
  if (invoiceIds.length) {
    query = query.in("id", invoiceIds);
  } else if (shopId) {
    query = query.eq("shop_id", shopId).neq("payment_status", "paid");
  } else {
    console.warn("[payment-webhook] no shop_id or invoice_ids in notes", paymentId);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing notes.shop_id or notes.invoice_ids on payment",
        payment_id: paymentId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: rows, error: fetchErr } = await query;
  if (fetchErr) {
    console.error(fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    return new Response(JSON.stringify({ ok: true, updated: 0, reason: "no matching orders" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 4) Mark paid (webhook-verified) ──────────────────────────────────
  const now = new Date().toISOString();
  const ids = list.map((r) => r.id);
  const { error: updErr } = await sb
    .from("customer_orders")
    .update({
      payment_status: "paid",
      balance_due: 0,
      paid_amount: amountInr || null,
      payment_mode: method || "upi",
      payment_ref: paymentId,
      paid_at: now,
      paid_by: "webhook:razorpay",
      customer_claimed_paid: false,
    })
    .in("id", ids);

  if (updErr) {
    console.error(updErr);
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 5) Notify customer (best-effort) ─────────────────────────────────
  const shop = String(list[0].shop_id || shopId);
  const shopName = String(list[0].shop_name || "");
  const invLabel = list.map((r) => r.zoho_invoice_number || r.id).join(", ");
  try {
    await sb.from("customer_notifications").insert({
      shop_id: shop,
      shop_name: shopName,
      message:
        "✅ Payment received ₹" +
        (amountInr || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }) +
        " for " +
        invLabel +
        ". Invoices marked paid (verified). Balance ₹0. Thank you!",
      is_read: false,
    });
  } catch (e) {
    console.warn("[payment-webhook] notify failed", e);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      verified: true,
      payment_id: paymentId,
      updated: ids.length,
      ids,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
