import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verify caller via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { legal_name, display_name, slug, tax_id, country_code, timezone, status, is_test, env } = body;

    if (!legal_name || !display_name || !slug) {
      return new Response(JSON.stringify({ error: 'Missing required fields: legal_name, display_name, slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for slug uniqueness before insert to give a clearer error
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'slug already taken' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert organization using service role (bypasses RLS)
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        legal_name,
        display_name,
        slug,
        tax_id: tax_id || null,
        country_code: country_code || 'TW',
        timezone: timezone || 'Asia/Taipei',
        status: status || 'active',
        is_test: is_test ?? true,
        env: env ?? 'staging',
      })
      .select('id')
      .maybeSingle();

    if (orgError) {
      console.error('Org insert error:', orgError);
      return new Response(JSON.stringify({ error: orgError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!org?.id) {
      return new Response(JSON.stringify({ error: 'Organization created but no ID returned' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert owner membership (trigger uses auth.uid() which is null for service role, so we do it manually)
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
        env: env ?? 'staging',
        is_test: is_test ?? true,
      });

    if (memberError) {
      // ON CONFLICT is not available on insert without upsert — log and continue
      console.warn('Member insert warning:', memberError.message);
    }

    return new Response(JSON.stringify({ data: org }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Unexpected error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
