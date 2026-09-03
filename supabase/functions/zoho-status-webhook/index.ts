/**
 * Zoho Books → app automation
 *
 * Fires when invoice OR delivery challan is created/edited in Zoho:
 *  - status change (draft → sent → paid / void / partial)
 *  - quantity / line-item change (we re-fetch full document from Zoho API)
 *  - total / balance change
 *
 * Deploy:
 *   supabase functions deploy zoho-status-webhook --no-verify-jwt --project-ref lprcdmwlrrukuhqdekah
 *
 * URL:
 *   https://lprcdmwlrrukuhqdekah.supabase.co/functions/v1/zoho-status-webhook
 *
 * Zoho Workflow Rules (do both modules):
 *   1) Invoices → When: Created or Edited → Webhook POST to URL
 *   2) Delivery Challans (or Sales Orders if you use SO as challan)
 *      → When: Created or Edited → same Webhook
 *
 * Body params (entity parameters):
 *   invoice_id / salesorder_id / deliverychallan_id = ${….ID}
 *   invoice_number / salesorder_number               = ${….Number}
 *   status                                          = ${….Status}
 *   balance                                         = ${….Balance}   (invoices)
 *   total                                           = ${….Total}
 *   reference_number                                = ${….Reference Number}
 *   doc_type                                        = invoice | challan  (optional)
 *
 * Optional secret: header X-Webhook-Secret = ZOHO_WEBHOOK_SECRET
 *
 * Quantity sync: reads zoho_* credentials from settings table, refreshes
 * token, GET full document, writes items/qty/item_ids + totals to customer_orders.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim() !== "") {
      return String(obj[k]).trim();
    }
    const found = Object.keys(obj).find((x) => x.toLowerCase() === k.toLowerCase());
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

function mapStatuses(zStatus: string): {
  zoho_invoice_status: string;
  payment_status: string | null;
  markPaid: boolean;
} {
  const s = normalizeStatus(zStatus);
  if ((s === "paid" || s === "closed" || s.indexOf("paid") >= 0) && s.indexOf("partial") < 0) {
    return { zoho_invoice_status: "paid", payment_status: "paid", markPaid: true };
  }
  if (s === "partially_paid" || s.indexOf("partial") >= 0) {
    return { zoho_invoice_status: "partially_paid", payment_status: "partial", markPaid: false };
  }
  if (s === "void" || s === "cancelled" || s === "canceled") {
    return { zoho_invoice_status: "void", payment_status: "void", markPaid: false };
  }
  if (s === "draft" || s === "pending_approval" || s === "pending") {
    return {
      zoho_invoice_status: s === "pending_approval" ? "pending_approval" : "draft",
      payment_status: "unpaid",
      markPaid: false,
    };
  }
  if (s === "sent" || s === "overdue" || s === "open" || s === "viewed" || s === "unpaid" || s === "fulfilled" || s === "invoiced") {
    return {
      zoho_invoice_status: s === "overdue" ? "overdue" : s === "fulfilled" ? "fulfilled" : "sent",
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
  let out: Record<string, unknown> = {};

  // 1) JSON body
  if (ct.includes("application/json") || raw.trim().startsWith("{")) {
    try {
      out = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }

  // 2) form-urlencoded (Zoho default for many webhooks)
  if (!Object.keys(out).length || ct.includes("application/x-www-form-urlencoded")) {
    try {
      const params = new URLSearchParams(raw);
      const form: Record<string, unknown> = {};
      params.forEach((v, k) => {
        form[k] = v;
      });
      if (Object.keys(form).length) {
        out = { ...out, ...form };
      }
    } catch {
      /* ignore */
    }
  }

  // 3) Zoho often wraps payload in JSONString=...
  const js = out.JSONString || out.jsonstring || out.JSON || out.payload;
  if (typeof js === "string" && js.trim()) {
    try {
      const inner = JSON.parse(js) as Record<string, unknown>;
      out = { ...out, ...inner };
    } catch {
      /* ignore */
    }
  }

  // 4) last try: raw JSON
  if (!Object.keys(out).length) {
    try {
      out = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      out = { raw: raw.slice(0, 500) };
    }
  }

  return out;
}

function flattenPayload(data: Record<string, unknown>): Record<string, unknown> {
  const inv =
    (data.invoice as Record<string, unknown>) ||
    (data.Invoice as Record<string, unknown>) ||
    (data.salesorder as Record<string, unknown>) ||
    (data.deliverychallan as Record<string, unknown>) ||
    (data.data as Record<string, unknown>) ||
    null;
  if (inv && typeof inv === "object") {
    return { ...data, ...inv };
  }
  return data;
}

function booksBase(dc: string): string {
  const d = (dc || "in").toLowerCase();
  if (d === "com" || d === "us") return "https://www.zohoapis.com/books/v3";
  if (d === "eu") return "https://www.zohoapis.eu/books/v3";
  if (d === "au") return "https://www.zohoapis.com.au/books/v3";
  return "https://www.zohoapis.in/books/v3";
}

function accountsBase(dc: string): string {
  const d = (dc || "in").toLowerCase();
  if (d === "com" || d === "us") return "https://accounts.zoho.com";
  if (d === "eu") return "https://accounts.zoho.eu";
  if (d === "au") return "https://accounts.zoho.com.au";
  return "https://accounts.zoho.in";
}

function num(raw: string): number | null {
  if (raw === "" || raw == null) return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

/** Extract line items → items / qty / item_ids CSV (same shape as app) */
function extractLines(doc: Record<string, unknown>): {
  items: string;
  qty: string;
  item_ids: string;
} | null {
  const lines = (doc.line_items || doc.lineitems || []) as Record<string, unknown>[];
  if (!Array.isArray(lines) || !lines.length) return null;
  const names: string[] = [];
  const qtys: string[] = [];
  const ids: string[] = [];
  for (const li of lines) {
    if (!li) continue;
    const name = String(li.name || li.item_name || li.description || "").trim();
    const q = parseFloat(String(li.quantity != null ? li.quantity : li.qty ?? ""));
    if (isNaN(q) || q <= 0) continue;
    const nlow = name.toLowerCase();
    if (/shipping|delivery\s*charge|freight/.test(nlow) && !li.item_id) continue;
    const zItemId = li.item_id ? String(li.item_id) : "";
    names.push(name || (zItemId ? "Item " + zItemId : "Item"));
    qtys.push(String(q % 1 === 0 ? Math.round(q) : q));
    ids.push(zItemId);
  }
  if (!names.length) return null;
  return { items: names.join(","), qty: qtys.join(","), item_ids: ids.join(",") };
}

async function loadZohoCreds(
  supabase: ReturnType<typeof createClient>,
): Promise<{
  client_id: string;
  client_secret: string;
  refresh_token: string;
  org_id: string;
  dc: string;
} | null> {
  const keys = [
    "zoho_client_id",
    "zoho_client_secret",
    "zoho_refresh_token",
    "zoho_org_id",
    "zoho_dc",
  ];
  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .in("key", keys);
  if (error || !data) return null;
  const map: Record<string, string> = {};
  for (const row of data as { key: string; value: string }[]) {
    map[row.key] = String(row.value || "").trim();
  }
  if (!map.zoho_client_id || !map.zoho_client_secret || !map.zoho_refresh_token || !map.zoho_org_id) {
    return null;
  }
  return {
    client_id: map.zoho_client_id,
    client_secret: map.zoho_client_secret,
    refresh_token: map.zoho_refresh_token,
    org_id: map.zoho_org_id,
    dc: map.zoho_dc || "in",
  };
}

async function refreshAccessToken(creds: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  dc: string;
}): Promise<string | null> {
  const url = accountsBase(creds.dc) + "/oauth/v2/token";
  const body = new URLSearchParams({
    refresh_token: creds.refresh_token,
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    grant_type: "refresh_token",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.warn("[zoho-status-webhook] token refresh failed", json);
    return null;
  }
  return String(json.access_token);
}

async function fetchZohoDoc(
  creds: { org_id: string; dc: string },
  token: string,
  docId: string,
  preferChallan: boolean,
): Promise<Record<string, unknown> | null> {
  const base = booksBase(creds.dc);
  const orgQ = "organization_id=" + encodeURIComponent(creds.org_id);
  const headers = { Authorization: "Zoho-oauthtoken " + token };

  const paths = preferChallan
    ? [
        "/deliverychallans/" + encodeURIComponent(docId),
        "/salesorders/" + encodeURIComponent(docId),
        "/invoices/" + encodeURIComponent(docId),
      ]
    : [
        "/invoices/" + encodeURIComponent(docId),
        "/deliverychallans/" + encodeURIComponent(docId),
        "/salesorders/" + encodeURIComponent(docId),
      ];

  for (const path of paths) {
    try {
      const res = await fetch(base + path + "?" + orgQ, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      const doc =
        (json.invoice as Record<string, unknown>) ||
        (json.deliverychallan as Record<string, unknown>) ||
        (json.salesorder as Record<string, unknown>) ||
        (json.data as Record<string, unknown>) ||
        null;
      if (doc && typeof doc === "object") return doc;
    } catch (e) {
      console.warn("[zoho-status-webhook] fetch doc path failed", path, e);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "zoho-status-webhook",
        features: ["status", "balance", "total", "line_items/qty via Zoho API re-fetch"],
        usage: "POST from Zoho Workflow on Invoice/Challan Created or Edited",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") || "";
  let data = flattenPayload(parseBody(rawBody, contentType));

  if (webhookSecret) {
    const hdr = req.headers.get("x-webhook-secret") || "";
    const bodySecret = pick(data, ["secret", "webhook_secret", "ZOHO_WEBHOOK_SECRET"]);
    if (hdr !== webhookSecret && bodySecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Also scan any key that looks like an id/number from Zoho field labels
  function pickLoose(keys: string[], extraTest?: (k: string, v: string) => boolean): string {
    const direct = pick(data, keys);
    if (direct) return direct;
    for (const [k, v] of Object.entries(data)) {
      if (v == null) continue;
      const vs = String(v).trim();
      if (!vs || vs.startsWith("{")) continue;
      const kl = k.toLowerCase().replace(/[\s.]+/g, "_");
      for (const want of keys) {
        const wl = want.toLowerCase().replace(/[\s.]+/g, "_");
        if (kl === wl || kl.endsWith("_" + wl) || kl.includes(wl)) {
          if (!extraTest || extraTest(kl, vs)) return vs;
        }
      }
    }
    return "";
  }

  const invoiceId = pickLoose(
    [
      "invoice_id",
      "invoiceId",
      "Invoice ID",
      "salesorder_id",
      "deliverychallan_id",
      "delivery_challan_id",
      "zoho_invoice_id",
      "id",
    ],
    (k, v) => {
      // Prefer long numeric Zoho ids; avoid short status words
      if (k === "id" || k.endsWith("_id")) return /^\d{10,}$/.test(v);
      return true;
    },
  );
  const invoiceNumber = pickLoose([
    "invoice_number",
    "invoiceNumber",
    "Invoice Number",
    "salesorder_number",
    "deliverychallan_number",
    "Delivery Challan Number",
    "zoho_invoice_number",
    "invoice_number_formatted",
  ]);
  let statusRaw = pick(data, [
    "status",
    "Status",
    "invoice_status",
    "Invoice Status",
    "status_formatted",
  ]);
  let balanceRaw = pick(data, [
    "balance",
    "Balance",
    "balance_due",
    "Balance Due",
  ]);
  let totalRaw = pick(data, ["total", "Total", "invoice_total", "Total Amount"]);
  const reference = pick(data, [
    "reference_number",
    "reference",
    "Reference Number",
    "cf_reference",
  ]);
  const docTypeHint = pick(data, ["doc_type", "document_type", "module"]).toLowerCase();
  const preferChallan =
    docTypeHint.includes("challan") ||
    docTypeHint.includes("salesorder") ||
    !!pick(data, ["salesorder_id", "deliverychallan_id", "delivery_challan_id"]);

  if (!invoiceId && !invoiceNumber && !reference) {
    console.error("[zoho-status-webhook] missing identifiers", {
      keys: Object.keys(data),
      sample: Object.fromEntries(
        Object.entries(data).slice(0, 12).map(([k, v]) => [k, String(v).slice(0, 80)]),
      ),
    });
    return new Response(
      JSON.stringify({
        code: 1,
        error: "Missing invoice_id / number / reference_number — check Zoho webhook Entity Parameters",
        keys: Object.keys(data),
        hint:
          "In Zoho Workflow → Webhook → add parameters: invoice_id = ${Invoice.Invoice ID}, invoice_number = ${Invoice.Invoice Number}, status = ${Invoice.Status}, reference_number = ${Invoice.Reference Number}",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Match order
  let order: Record<string, unknown> | null = null;
  const selectCols =
    "id,shop_id,shop_name,payment_status,zoho_invoice_id,zoho_invoice_number,balance_due,invoice_total,items,qty,item_ids,zoho_doc_type";

  if (invoiceId) {
    const { data: rows } = await supabase
      .from("customer_orders")
      .select(selectCols)
      .eq("zoho_invoice_id", invoiceId)
      .limit(5);
    if (rows && rows.length) order = rows[0] as Record<string, unknown>;
  }
  if (!order && invoiceNumber) {
    const { data: rows } = await supabase
      .from("customer_orders")
      .select(selectCols)
      .eq("zoho_invoice_number", invoiceNumber)
      .limit(5);
    if (rows && rows.length) order = rows[0] as Record<string, unknown>;
  }
  if (!order && reference) {
    const ref = reference.trim();
    let orderId: string | null = null;
    const m = ref.match(/IBCAB-(\d+)/i);
    if (m) orderId = m[1];
    if (orderId) {
      const { data: rows } = await supabase
        .from("customer_orders")
        .select(selectCols)
        .eq("id", orderId)
        .limit(1);
      if (rows && rows.length) order = rows[0] as Record<string, unknown>;
    }
  }

  if (!order) {
    console.warn("[zoho-status-webhook] no matching order", { invoiceId, invoiceNumber, reference });
    return new Response(
      JSON.stringify({
        code: 0,
        ok: true,
        matched: false,
        message: "No customer_orders row for this Zoho document",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Re-fetch full document from Zoho so qty / lines / totals stay accurate
  let linesUpdated = false;
  let fetchedDoc: Record<string, unknown> | null = null;
  const creds = await loadZohoCreds(supabase);
  const docIdForFetch = invoiceId || String(order.zoho_invoice_id || "");
  if (creds && docIdForFetch) {
    const token = await refreshAccessToken(creds);
    if (token) {
      fetchedDoc = await fetchZohoDoc(creds, token, docIdForFetch, preferChallan);
    }
  }

  if (fetchedDoc) {
    if (!statusRaw && fetchedDoc.status != null) {
      statusRaw = String(fetchedDoc.status);
    }
    if (!balanceRaw && fetchedDoc.balance != null) {
      balanceRaw = String(fetchedDoc.balance);
    }
    if (!totalRaw && (fetchedDoc.total != null || fetchedDoc.total_formatted != null)) {
      totalRaw = String(fetchedDoc.total != null ? fetchedDoc.total : fetchedDoc.total_formatted);
    }
    if (!invoiceNumber && fetchedDoc.invoice_number) {
      // keep local
    }
  }

  // Status optional if we at least got balance/total/lines from fetch
  if (!statusRaw && !fetchedDoc) {
    return new Response(
      JSON.stringify({
        code: 1,
        error: "Missing status and could not re-fetch Zoho document",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const mapped = mapStatuses(statusRaw || String(fetchedDoc?.status || "sent"));
  let balance = num(balanceRaw);
  let total = num(totalRaw);
  if (balance != null && balance <= 0.01 && !mapped.markPaid && mapped.payment_status !== "void") {
    mapped.markPaid = true;
    mapped.payment_status = "paid";
    mapped.zoho_invoice_status = mapped.zoho_invoice_status === "void" ? "void" : "paid";
  }

  const wasPaid = String(order.payment_status || "").toLowerCase() === "paid";

  const patch: Record<string, unknown> = {
    zoho_invoice_status: mapped.zoho_invoice_status,
  };
  if (mapped.payment_status) patch.payment_status = mapped.payment_status;
  if (invoiceId && !order.zoho_invoice_id) patch.zoho_invoice_id = invoiceId;
  if (invoiceNumber) patch.zoho_invoice_number = invoiceNumber;
  if (balance != null) patch.balance_due = balance;
  if (total != null) {
    patch.invoice_total = total;
  }
  if (mapped.markPaid) {
    patch.balance_due = 0;
    patch.payment_status = "paid";
    if (total != null) patch.paid_amount = total;
    else if (order.invoice_total != null) patch.paid_amount = order.invoice_total;
  }

  // Line items / quantity from Zoho full document
  if (fetchedDoc) {
    const extracted = extractLines(fetchedDoc);
    if (extracted) {
      patch.items = extracted.items;
      patch.qty = extracted.qty;
      patch.item_ids = extracted.item_ids;
      linesUpdated = true;
    }
    if (fetchedDoc.sub_total != null) {
      const st = Number(fetchedDoc.sub_total);
      if (!isNaN(st)) patch.invoice_subtotal = st;
    }
    // tax fields if present
    if (fetchedDoc.tax_total != null) {
      const tax = Number(fetchedDoc.tax_total);
      if (!isNaN(tax)) patch.tax_amount = tax;
    }
    if (total == null && fetchedDoc.total != null) {
      const t = Number(fetchedDoc.total);
      if (!isNaN(t)) {
        patch.invoice_total = t;
        total = t;
      }
    }
    if (balance == null && fetchedDoc.balance != null) {
      const b = Number(fetchedDoc.balance);
      if (!isNaN(b)) {
        patch.balance_due = mapped.markPaid ? 0 : b;
        balance = b;
      }
    }
  }

  const { error: upErr } = await supabase
    .from("customer_orders")
    .update(patch)
    .eq("id", order.id);

  if (upErr) {
    console.error("[zoho-status-webhook] update failed", upErr);
    return new Response(JSON.stringify({ code: 1, error: upErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    "[zoho-status-webhook] order",
    order.id,
    "status=",
    mapped.zoho_invoice_status,
    "lines=",
    linesUpdated,
    "fetched=",
    !!fetchedDoc,
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
      lines_updated: linesUpdated,
      zoho_doc_fetched: !!fetchedDoc,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
