# zoho-status-webhook

Zoho Books invoice status → `customer_orders` (no polling).

## Deploy

```bash
supabase functions deploy zoho-status-webhook --no-verify-jwt --project-ref lprcdmwlrrukuhqdekah
```

Optional secret:

```bash
supabase secrets set ZOHO_WEBHOOK_SECRET=your-long-random-string --project-ref lprcdmwlrrukuhqdekah
```

## URL

```
https://lprcdmwlrrukuhqdekah.supabase.co/functions/v1/zoho-status-webhook
```

## Zoho Workflow

1. **Settings → Automation → Workflow Rules**
2. Module: **Invoices**
3. When: **Edited** (status / payment changes)
4. Action: **Webhook** → URL above, method **POST**
5. Body parameters (entity params):

| Param | Zoho field |
|-------|------------|
| `invoice_id` | `${Invoice.Invoice ID}` |
| `invoice_number` | `${Invoice.Invoice Number}` |
| `status` | `${Invoice.Status}` |
| `balance` | `${Invoice.Balance}` |
| `total` | `${Invoice.Total}` |
| `reference_number` | `${Invoice.Reference Number}` |

If `ZOHO_WEBHOOK_SECRET` is set, add header:

```
X-Webhook-Secret: your-long-random-string
```

## Behaviour

| Zoho status / balance | App update |
|----------------------|------------|
| paid / balance ≈ 0 | `payment_status=paid`, `balance_due=0`, push to customer |
| sent / overdue / open | `payment_status=unpaid`, status stored |
| void / cancelled | `payment_status=void` |
| partial | `payment_status=partial` |

Match order by: `zoho_invoice_id` → `zoho_invoice_number` → `IBCAB-{id}` reference.

## Test

```bash
curl -X POST 'https://lprcdmwlrrukuhqdekah.supabase.co/functions/v1/zoho-status-webhook' \
  -H 'Content-Type: application/json' \
  -d '{"invoice_id":"YOUR_ZOHO_ID","status":"paid","balance":0,"total":1000,"reference_number":"IBCAB-123"}'
```
