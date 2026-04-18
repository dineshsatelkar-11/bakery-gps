import { createClient } from 'jsr:@supabase/supabase-js@2';
// @ts-ignore
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { shop_ids, message } = await req.json();
    console.log('[push] shop_ids:', shop_ids, 'message:', message);

    if (!shop_ids || !shop_ids.length || !message) {
      console.log('[push] missing params');
      return new Response(JSON.stringify({ error: 'Missing shop_ids or message' }), { status: 400 });
    }

    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidEmail   = Deno.env.get('VAPID_EMAIL') || 'admin@bakery.com';
    console.log('[push] vapid public present:', !!vapidPublic, 'private present:', !!vapidPrivate);
    console.log('[push] private key length:', vapidPrivate ? vapidPrivate.length : 0);

    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic!, vapidPrivate!);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('shop_id', shop_ids.map(String));

    console.log('[push] subscriptions found:', subs ? subs.length : 0, 'error:', error);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'No subscriptions found' }), {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const payload = JSON.stringify({ title: '🥖 Message from bakery', body: message });

    const staleEndpoints: string[] = [];
    const results = await Promise.allSettled(
      subs.map((sub: { endpoint: string; p256dh: string; auth: string; shop_id: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch((err: { statusCode?: number; message?: string }) => {
          console.log('[push] send failed for shop', sub.shop_id, 'status:', err.statusCode, 'msg:', err.message);
          if (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
          throw err;
        })
      )
    );

    if (staleEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    console.log('[push] sent:', sent, 'of', subs.length);
    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    console.error('[push] error:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
});
