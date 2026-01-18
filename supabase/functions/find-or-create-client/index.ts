import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para formato E.164
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  
  if (digits.length < 10 || digits.length > 13) {
    return null;
  }
  
  // Já tem código do país completo
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  
  // Tem código do país sem o +
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  
  // Apenas DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  
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

    const { phone, name, organization_id } = await req.json();

    // Validação dos parâmetros
    if (!phone || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'phone e organization_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({ error: 'Telefone inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[find-or-create-client] Buscando cliente com telefone: ${normalizedPhone}`);

    // Buscar cliente existente
    const { data: existingClient, error: searchError } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (searchError) {
      console.error('[find-or-create-client] Erro ao buscar cliente:', searchError);
      throw searchError;
    }

    // Cliente encontrado
    if (existingClient) {
      console.log(`[find-or-create-client] Cliente encontrado: ${existingClient.id}`);
      return new Response(
        JSON.stringify({ 
          client: existingClient, 
          is_new: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar novo cliente
    const clientName = name || `Cliente ${normalizedPhone.slice(-4)}`;
    console.log(`[find-or-create-client] Criando novo cliente: ${clientName}`);

    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({
        phone: normalizedPhone,
        name: clientName,
        organization_id: organization_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[find-or-create-client] Erro ao criar cliente:', insertError);
      throw insertError;
    }

    console.log(`[find-or-create-client] Cliente criado: ${newClient.id}`);

    return new Response(
      JSON.stringify({ 
        client: newClient, 
        is_new: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[find-or-create-client] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
