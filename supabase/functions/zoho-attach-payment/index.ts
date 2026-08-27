/**
 * Attach a payment screenshot to a Zoho Books customer payment.
 *
 * Prefer adding action `attach_customer_payment` inside existing `zoho-token`.
 * This standalone function is a fallback:
 *   POST /functions/v1/zoho-attach-payment
 *   body: {
 *     access_token, org_id, dc?,
 *     payment_id,
 *     attachment_url,   // Drive download URL or public image URL
 *     file_name?
 *   }
 *
 * Zoho API:
 *   POST /books/v3/customerpayments/{payment_id}/attachment?organization_id=
 *   multipart field: attachment
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function booksBase(dc: string) {
  const d = (dc || "in").toLowerCase();
  if (d === "com" || d === "us") return "https://www.zohoapis.com/books/v3";
  if (d === "eu") return "https://www.zohoapis.eu/books/v3";
  if (d === "au") return "https://www.zohoapis.com.au/books/v3";
  return "https://www.zohoapis.in/books/v3";
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

  try {
    const body = await req.json();
    const token = String(body.access_token || "").trim();
    const orgId = String(body.org_id || "").trim();
    const paymentId = String(body.payment_id || "").trim();
    const attachmentUrl = String(body.attachment_url || "").trim();
    const fileName = String(body.file_name || "payment-proof.jpg").trim() || "payment-proof.jpg";
    const dc = String(body.dc || "in").trim();

    if (!token || !orgId || !paymentId || !attachmentUrl) {
      return new Response(
        JSON.stringify({
          code: 1,
          error: "Missing access_token, org_id, payment_id, or attachment_url",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Download proof image (server-side — avoids browser CORS)
    const imgRes = await fetch(attachmentUrl, {
      redirect: "follow",
      headers: { "User-Agent": "IBCAB-ZohoAttach/1.0" },
    });
    if (!imgRes.ok) {
      return new Response(
        JSON.stringify({
          code: 1,
          error: "Could not download attachment_url (" + imgRes.status + ")",
          attachment_url: attachmentUrl,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    if (!buf.length) {
      return new Response(JSON.stringify({ code: 1, error: "Empty attachment file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const form = new FormData();
    form.append(
      "attachment",
      new Blob([buf], { type: contentType }),
      fileName,
    );

    const url =
      booksBase(dc) +
      "/customerpayments/" +
      encodeURIComponent(paymentId) +
      "/attachment?organization_id=" +
      encodeURIComponent(orgId);

    const zohoRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Zoho-oauthtoken " + token,
      },
      body: form,
    });
    const text = await zohoRes.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!zohoRes.ok) {
      return new Response(
        JSON.stringify({
          code: (data as { code?: number }).code ?? zohoRes.status,
          error: (data as { message?: string }).message || "Zoho attach failed",
          data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ code: 0, ok: true, success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ code: 1, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
