import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para E.164
function normalizePhone(input: string): string | null {
  if (!input) return null;
  
  // Remove tudo que não é número
  let digits = input.replace(/\D/g, '');
  
  // Se começa com 55 e tem 12-13 dígitos, já está normalizado
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return '+' + digits;
  }
  
  // Se tem 10-11 dígitos (DDD + número), adiciona +55
  if (digits.length >= 10 && digits.length <= 11) {
    return '+55' + digits;
  }
  
  // Formato inválido
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { whatsapp_number } = await req.json();

    // Validação
    if (!whatsapp_number) {
      return new Response(
        JSON.stringify({ error: 'whatsapp_number é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar número para E.164
    const normalizedNumber = normalizePhone(whatsapp_number);
    
    if (!normalizedNumber) {
      return new Response(
        JSON.stringify({ error: 'Número de WhatsApp inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-organization-by-whatsapp] Buscando org para WhatsApp ${normalizedNumber}`);

    // Buscar organização pelo número de WhatsApp
    const { data: orgWhatsapp, error: orgError } = await supabase
      .from('organization_whatsapp')
      .select(`
        organization_id,
        organizations (
          id,
          name,
          slug
        )
      `)
      .eq('whatsapp_number', normalizedNumber)
      .single();

    if (orgError && orgError.code !== 'PGRST116') {
      console.error('[get-organization-by-whatsapp] Erro ao buscar:', orgError);
      throw orgError;
    }

    if (!orgWhatsapp) {
      console.log('[get-organization-by-whatsapp] Nenhuma organização encontrada');
      return new Response(
        JSON.stringify({ 
          found: false,
          error: 'Nenhuma organização cadastrada para este número de WhatsApp'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // O Supabase retorna organizations como objeto quando é relação single
    const org = orgWhatsapp.organizations as unknown as { id: string; name: string; slug: string } | null;

    if (!org) {
      return new Response(
        JSON.stringify({ 
          found: false,
          error: 'Organização não encontrada'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-organization-by-whatsapp] Encontrado: ${org.name} (${org.id})`);

    return new Response(
      JSON.stringify({ 
        found: true,
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-organization-by-whatsapp] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
