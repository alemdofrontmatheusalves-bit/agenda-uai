import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[list-available-services] Buscando serviços para org: ${organization_id}`);

    const { data: services, error } = await supabase
      .from('services')
      .select('id, name, description, price, duration_minutes')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('[list-available-services] Erro:', error);
      throw error;
    }

    console.log(`[list-available-services] ${services.length} serviços encontrados`);

    // Formatar para resposta amigável
    const formattedServices = services.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      price_formatted: `R$ ${Number(s.price).toFixed(2).replace('.', ',')}`,
      duration_minutes: s.duration_minutes,
      duration_formatted: s.duration_minutes >= 60 
        ? `${Math.floor(s.duration_minutes / 60)}h${s.duration_minutes % 60 > 0 ? ` ${s.duration_minutes % 60}min` : ''}`
        : `${s.duration_minutes}min`
    }));

    return new Response(
      JSON.stringify({ services: formattedServices }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[list-available-services] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
