import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const rawBody = await req.text();
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  const svixId = req.headers.get('svix-id') ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp') ?? '';
  const svixSignature = req.headers.get('svix-signature') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Webhook handler is missing Supabase service configuration');
    return new Response('Webhook handler unavailable', { status: 500 });
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing webhook signature headers', { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.rpc('process_resend_receipt_webhook', {
    _event: event,
    _raw_body: rawBody,
    _svix_id: svixId,
    _svix_timestamp: svixTimestamp,
    _svix_signature: svixSignature,
  });

  if (error) {
    const message = error.message ?? 'Webhook processing failed';
    console.error('Receipt webhook rejected or failed:', message);
    const unauthorized = /signature verification|timestamp is invalid|signature headers|verification secret/i.test(message);
    return new Response(unauthorized ? 'Invalid webhook signature' : 'Webhook processing failed', {
      status: unauthorized ? 401 : 500,
    });
  }

  return Response.json(data ?? { ok: true });
});
