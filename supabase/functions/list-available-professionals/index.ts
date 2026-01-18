import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessHours {
  [key: number]: {
    open: string;
    close: string;
  } | null;
}

// Função auxiliar para obter data no timezone brasileiro
function getBrazilDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00-03:00`);
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  avatar_url: string | null;
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

    const { organization_id, date, service_id } = await req.json();

    // Validação
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[list-available-professionals] Buscando profissionais para org ${organization_id}${date ? ` em ${date}` : ''}${service_id ? ` para serviço ${service_id}` : ''}`);

    // === VERIFICAR HORÁRIO DE FUNCIONAMENTO DA EMPRESA ===
    if (date) {
      const { data: orgSettings, error: settingsError } = await supabase
        .from('organization_settings')
        .select('business_hours')
        .eq('organization_id', organization_id)
        .maybeSingle();

      if (settingsError) {
        console.error('[list-available-professionals] Erro ao buscar configurações:', settingsError);
      }

      if (orgSettings?.business_hours) {
        const businessHours = orgSettings.business_hours as BusinessHours;
        const targetDate = getBrazilDate(date);
        const dayOfWeek = targetDate.getDay();
        
        if (!businessHours[dayOfWeek]) {
          console.log(`[list-available-professionals] Empresa fechada no dia ${dayOfWeek}`);
          return new Response(
            JSON.stringify({ 
              professionals: [],
              message: 'Estabelecimento fechado neste dia',
              closed: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // === VERIFICAR SE A ORGANIZAÇÃO ESTÁ FECHADA NESTA DATA (EXCEÇÃO) ===
    if (date) {
      const { data: orgException, error: orgExError } = await supabase
        .from('organization_exceptions')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('exception_date', date)
        .is('professional_id', null)
        .eq('is_closed', true)
        .maybeSingle();

      if (orgExError) {
        console.error('[list-available-professionals] Erro ao verificar exceções da org:', orgExError);
      }

      if (orgException) {
        console.log(`[list-available-professionals] Organização fechada: ${orgException.reason || 'Sem motivo'}`);
        return new Response(
          JSON.stringify({ 
            professionals: [],
            message: orgException.reason || 'Estabelecimento fechado nesta data',
            closed: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar profissionais ativos da organização
    const { data: professionals, error: profError } = await supabase
      .from('professionals')
      .select('id, name, specialty, avatar_url')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .order('name');

    if (profError) {
      console.error('[list-available-professionals] Erro ao buscar profissionais:', profError);
      throw profError;
    }

    if (!professionals || professionals.length === 0) {
      console.log('[list-available-professionals] Nenhum profissional ativo encontrado');
      return new Response(
        JSON.stringify({ 
          professionals: [],
          message: 'Nenhum profissional disponível'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let filteredProfessionals: Professional[] = professionals;

    // === FILTRAR POR SERVIÇO (se fornecido) ===
    if (service_id) {
      const { data: serviceAssignments, error: serviceError } = await supabase
        .from('professional_services')
        .select('professional_id')
        .eq('service_id', service_id)
        .eq('organization_id', organization_id);

      if (serviceError) {
        console.error('[list-available-professionals] Erro ao buscar vínculos de serviço:', serviceError);
      }

      if (serviceAssignments && serviceAssignments.length > 0) {
        const assignedIds = new Set(serviceAssignments.map(a => a.professional_id));
        filteredProfessionals = filteredProfessionals.filter(p => assignedIds.has(p.id));
        console.log(`[list-available-professionals] ${filteredProfessionals.length} profissionais vinculados ao serviço`);
      } else {
        // Nenhum profissional vinculado = retornar lista vazia (não fazer fallback)
        console.log('[list-available-professionals] Nenhum profissional vinculado a este serviço');
        return new Response(
          JSON.stringify({ 
            professionals: [],
            message: 'Nenhum profissional configurado para este serviço',
            no_assignment: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se data fornecida, filtrar apenas quem trabalha naquele dia E não está de folga
    if (date) {
      const targetDate = getBrazilDate(date);
      const dayOfWeek = targetDate.getDay();

      console.log(`[list-available-professionals] Filtrando por dia da semana: ${dayOfWeek}`);

      // Buscar disponibilidade para esse dia
      const { data: availability, error: availError } = await supabase
        .from('professional_availability')
        .select('professional_id')
        .eq('organization_id', organization_id)
        .eq('day_of_week', dayOfWeek);

      if (availError) {
        console.error('[list-available-professionals] Erro ao buscar disponibilidade:', availError);
        throw availError;
      }

      // IDs dos profissionais que trabalham neste dia
      const availableProfIds = new Set(availability?.map(a => a.professional_id) || []);
      
      // === VERIFICAR FOLGAS INDIVIDUAIS ===
      const { data: professionalExceptions, error: profExError } = await supabase
        .from('organization_exceptions')
        .select('professional_id')
        .eq('organization_id', organization_id)
        .eq('exception_date', date)
        .eq('is_closed', true)
        .not('professional_id', 'is', null);

      if (profExError) {
        console.error('[list-available-professionals] Erro ao buscar folgas:', profExError);
      }

      // IDs dos profissionais de folga
      const onLeaveIds = new Set(professionalExceptions?.map(ex => ex.professional_id) || []);

      console.log(`[list-available-professionals] ${onLeaveIds.size} profissionais de folga`);

      // Filtrar: deve trabalhar neste dia E não estar de folga
      filteredProfessionals = filteredProfessionals.filter(p => 
        availableProfIds.has(p.id) && !onLeaveIds.has(p.id)
      );

      console.log(`[list-available-professionals] ${filteredProfessionals.length} profissionais disponíveis após filtros`);
    }

    // Formatar resposta
    const result = filteredProfessionals.map(p => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty || 'Geral',
      avatar_url: p.avatar_url
    }));

    return new Response(
      JSON.stringify({ 
        professionals: result,
        count: result.length,
        date: date || null,
        service_id: service_id || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[list-available-professionals] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
