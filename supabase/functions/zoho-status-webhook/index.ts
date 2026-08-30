/**
 * Zoho Books → app: invoice status changes (Draft → Sent → Paid)
 *
 * Invoice is CREATED from our app (Send to Zoho). This webhook is only for
 * later changes made inside Zoho (or payment recorded there).
 *
 * Deploy (no JWT — Zoho cannot send Supabase auth):
 *   supabase functions deploy zoho-status-webhook --no-verify-jwt --project-ref lprcdmwlrrukuhqdekah
 *
 * URL for Zoho Workflow Webhook:
 *   https://lprcdmwlrrukuhqdekah.supabase.co/functions/v1/zoho-status-webhook
 *
 * Zoho setup (minimal):
 *   Settings → Automation → Workflow Rules
 *   Module: Invoices
 *   When: Edited (and/or Created if you want draft link-back)
 *   Criteria: optional (Status is Sent / Paid) or fire on all edits
 *   Action: Webhook POST to URL above
 *   Entity parameters to send (names flexible — we read many aliases):
 *     invoice_id     = ${Invoice.Invoice ID}
 *     invoice_number = ${Invoice.Invoice Number}
 *     status         = ${Invoice.Status}
 *     balance        = ${Invoice.Balance}
 *     total          = ${Invoice.Total}
 *     reference_number = ${Invoice.Reference Number}
 *
 * Optional secret (Supabase Edge secret ZOHO_WEBHOOK_SECRET):
 *   Send header X-Webhook-Secret: <same value> from Zoho custom header,
 *   or body field secret / webhook_secret.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pick(
  obj: Record<string, unknown>,
  keys: string[],
): string {
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim() !== "") {
      return String(obj[k]).trim();
    }
    // case-insensitive
    const found = Object.keys(obj).find(
      (x) => x.toLowerCase() === k.toLowerCase(),
    );
    if (found && obj[found] != null && String(obj[found]).trim() !== "") {
      return String(obj[found]).trim();
    }
  }
  return "";
}

function normalizeStatus(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

/** Map Zoho status → our payment_status + zoho_invoice_status */
function mapStatuses(zStatus: string): {
  zoho_invoice_status: string;
  payment_status: string | null;
  markPaid: boolean;
} {
  const s = normalizeStatus(zStatus);
  if (
    s === "paid" ||
    s === "closed" ||
    s.indexOf("paid") >= 0 && s.indexOf("partial") < 0
  ) {
    return {
      zoho_invoice_status: "paid",
      payment_status: "paid",
      markPaid: true,
    };
  }
  if (s === "partially_paid" || s.indexOf("partial") >= 0) {
    return {
      zoho_invoice_status: "partially_paid",
      payment_status: "partial",
      markPaid: false,
    };
  }
  if (s === "void" || s === "cancelled" || s === "canceled") {
    return {
      zoho_invoice_status: "void",
      payment_status: "void",
      markPaid: false,
    };
  }
  if (s === "draft" || s === "pending_approval" || s === "pending") {
    return {
      zoho_invoice_status: s === "pending_approval" ? "pending_approval" : "draft",
      payment_status: "unpaid",
      markPaid: false,
    };
  }
  // sent, overdue, open, viewed, etc.
  if (
    s === "sent" ||
    s === "overdue" ||
    s === "open" ||
    s === "viewed" ||
    s === "unpaid"
  ) {
    return {
      zoho_invoice_status: s === "overdue" ? "overdue" : "sent",
      payment_status: "unpaid",
      markPaid: false,
    };
  }
  return {
    zoho_invoice_status: s || "sent",
    payment_status: "unpaid",
    markPaid: false,
  };
}

function parseBody(raw: string, contentType: string): Record<string, unknown> {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("application/json") || raw.trim().startsWith("{")) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  // form-urlencoded or query-style
  const out: Record<string, unknown> = {};
  try {
    const params = new URLSearchParams(raw);
    params.forEach((v, k) => {
      out[k] = v;
    });
    if (Object.keys(out).length) return out;
  } catch {
    /* ignore */
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

/** Flatten nested invoice object if Zoho wraps payload */
function flattenPayload(data: Record<string, unknown>): Record<string, unknown> {
  const inv =
    (data.invoice as Record<string, unknown>) ||
    (data.Invoice as Record<string, unknown>) ||
    (data.data as Record<string, unknown>) ||
    null;
  if (inv && typeof inv === "object") {
    return { ...data, ...inv };
  }
  return data;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const webhookSecret = Deno.env.get("ZOHO_WEBHOOK_SECRET") || "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL / SERVICE_ROLE_KEY missing" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") || "";
  let data = flattenPayload(parseBody(rawBody, contentType));

  // Optional shared secret
  if (webhookSecret) {
    const hdr = req.headers.get("x-webhook-secret") || "";
    const bodySecret = pick(data, ["secret", "webhook_secret", "ZOHO_WEBHOOK_SECRET"]);
    if (hdr !== webhookSecret && bodySecret !== webhookSecret) {
      console.warn("[zoho-status-webhook] bad secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const invoiceId = pick(data, [
    "invoice_id",
    "invoiceId",
    "Invoice ID",
    "invoice_id_formatted",
    "zoho_invoice_id",
  ]);
  const invoiceNumber = pick(data, [
    "invoice_number",
    "invoiceNumber",
    "Invoice Number",
    "invoice_number_formatted",
    "zoho_invoice_number",
  ]);
  const statusRaw = pick(data, [
    "status",
    "Status",
    "invoice_status",
    "Invoice Status",
    "status_formatted",
  ]);
  const balanceRaw = pick(data, [
    "balance",
    "Balance",
    "balance_due",
    "Balance Due",
    "total_outstanding_formatted",
  ]);
  const totalRaw = pick(data, [
    "total",
    "Total",
    "invoice_total",
    "Total Amount",
  ]);
  const reference = pick(data, [
    "reference_number",
    "reference",
    "Reference Number",
    "cf_reference",
  ]);

  if (!invoiceId && !invoiceNumber && !reference) {
    console.warn("[zoho-status-webhook] no invoice id/number/ref", Object.keys(data));
    return new Response(
      JSON.stringify({
        code: 1,
        error: "Missing invoice_id, invoice_number, or reference_number",
        keys: Object.keys(data),
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!statusRaw) {
    return new Response(
      JSON.stringify({
        code: 1,
        error: "Missing status — map Zoho ${Invoice.Status} in webhook params",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const mapped = mapStatuses(statusRaw);
  const balance =
    balanceRaw !== "" && !isNaN(Number(String(balanceRaw).replace(/,/g, "")))
      ? Number(String(balanceRaw).replace(/,/g, ""))
      : mapped.markPaid
      ? 0
      : null;
  const total =
    totalRaw !== "" && !isNaN(Number(String(totalRaw).replace(/,/g, "")))
      ? Number(String(totalRaw).replace(/,/g, ""))
      : null;

  const supabase = createClient(supabaseUrl, serviceKey);

  // Find order: id → number → IBCAB-reference
  let order: Record<string, unknown> | null = null;

  if (invoiceId) {
    const { data: rows } = await supabase
      .from("customer_orders")
      .select(
        "id,shop_id,shop_name,payment_status,zoho_invoice_id,zoho_invoice_number,balance_due,invoice_total",
      )
      .eq("zoho_invoice_id", invoiceId)
      .limit(5);
    if (rows && rows.length) order = rows[0] as Record<string, unknown>;
  }
  if (!order && invoiceNumber) {
    const { data: rows } = await supabase
      .from("customer_orders")
      .select(
        "id,shop_id,shop_name,payment_status,zoho_invoice_id,zoho_invoice_number,balance_due,invoice_total",
      )
      .eq("zoho_invoice_number", invoiceNumber)
      .limit(5);
    if (rows && rows.length) order = rows[0] as Record<string, unknown>;
  }
  if (!order && reference) {
    const m = String(reference).match(/IBCAB-(\d+)/i);
    if (m) {
      const oid = parseInt(m[1], 10);
      if (oid > 0) {
        const { data: rows } = await supabase
          .from("customer_orders")
          .select(
            "id,shop_id,shop_name,payment_status,zoho_invoice_id,zoho_invoice_number,balance_due,invoice_total",
          )
          .eq("id", oid)
          .limit(1);
        if (rows && rows.length) order = rows[0] as Record<string, unknown>;
      }
    }
  }

  if (!order) {
    console.warn(
      "[zoho-status-webhook] no matching order",
      invoiceId,
      invoiceNumber,
      reference,
    );
    return new Response(
      JSON.stringify({
        code: 0,
        ok: true,
        matched: false,
        note: "No customer_orders row for this Zoho invoice (create from app first)",
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const wasPaid =
    String(order.payment_status || "").toLowerCase() === "paid";

  const patch: Record<string, unknown> = {
    zoho_invoice_status: mapped.zoho_invoice_status,
  };
  if (mapped.payment_status) patch.payment_status = mapped.payment_status;
  if (invoiceId && !order.zoho_invoice_id) patch.zoho_invoice_id = invoiceId;
  if (invoiceNumber) patch.zoho_invoice_number = invoiceNumber;
  if (balance != null) patch.balance_due = balance;
  if (total != null) patch.invoice_total = total;
  if (mapped.markPaid) {
    patch.balance_due = 0;
    patch.payment_status = "paid";
    if (total != null) patch.paid_amount = total;
    else if (order.invoice_total != null) {
      patch.paid_amount = order.invoice_total;
    }
  }

  const { error: upErr } = await supabase
    .from("customer_orders")
    .update(patch)
    .eq("id", order.id);

  if (upErr) {
    console.error("[zoho-status-webhook] update failed", upErr);
    return new Response(
      JSON.stringify({ code: 1, error: upErr.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Notify customer once when newly paid
  if (mapped.markPaid && !wasPaid && order.shop_id) {
    const amt =
      total != null
        ? total
        : order.invoice_total != null
        ? Number(order.invoice_total)
        : 0;
    const msg =
      "✅ Payment confirmed ₹" +
      Number(amt).toLocaleString("en-IN", { maximumFractionDigits: 2 }) +
      " for " +
      (invoiceNumber || order.zoho_invoice_number || "invoice") +
      ". Invoice marked paid. Balance ₹0. Thank you!";
    try {
      await fetch(supabaseUrl + "/functions/v1/send-customer-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + serviceKey,
        },
        body: JSON.stringify({
          shop_ids: [String(order.shop_id)],
          message: msg,
        }),
      });
    } catch (e) {
      console.warn("[zoho-status-webhook] push failed", e);
    }
  }

  console.log(
    "[zoho-status-webhook] updated order",
    order.id,
    "→",
    mapped.zoho_invoice_status,
    mapped.payment_status,
  );

  return new Response(
    JSON.stringify({
      code: 0,
      ok: true,
      matched: true,
      order_id: order.id,
      zoho_invoice_status: mapped.zoho_invoice_status,
      payment_status: mapped.payment_status,
      mark_paid: mapped.markPaid,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
