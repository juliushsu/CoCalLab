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

    // Atomic create: organization + owner membership in one DB function.
    const { data: createRows, error: createError } = await supabaseUser.rpc(
      'create_organization_with_owner',
      {
        p_slug: slug,
        p_legal_name: legal_name,
        p_display_name: display_name,
        p_tax_id: tax_id || null,
        p_country_code: country_code || 'TW',
        p_timezone: timezone || 'Asia/Taipei',
      }
    );

    if (createError) {
      console.error('create_organization_with_owner failed:', createError);
      const isConflict = String(createError.message || '').includes('duplicate key');
      return new Response(JSON.stringify({ error: createError.message }), {
        status: isConflict ? 409 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = Array.isArray(createRows) ? createRows[0] : createRows;

    if (!result?.organization_id) {
      return new Response(JSON.stringify({ error: 'Organization created but no ID returned' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      data: {
        id: result.organization_id,
        membership_id: result.membership_id,
      },
    }), {
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
