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

// Converte "HH:MM" para minutos desde meia-noite
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
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

    const { 
      client_id, 
      professional_id, 
      service_id, 
      scheduled_at, 
      organization_id,
      notes 
    } = await req.json();

    // Validação
    if (!client_id || !professional_id || !service_id || !scheduled_at || !organization_id) {
      return new Response(
        JSON.stringify({ 
          error: 'client_id, professional_id, service_id, scheduled_at e organization_id são obrigatórios' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create-appointment] Criando agendamento para cliente ${client_id}`);

    // === VALIDAR HORÁRIO DA EMPRESA ===
    const scheduledDate = new Date(scheduled_at);
    const dayOfWeek = scheduledDate.getDay();
    
    // Extrair hora e minuto no timezone brasileiro
    const scheduledHour = scheduledDate.getHours();
    const scheduledMinute = scheduledDate.getMinutes();
    const scheduledTimeMinutes = scheduledHour * 60 + scheduledMinute;
    const scheduledTimeStr = `${scheduledHour.toString().padStart(2, '0')}:${scheduledMinute.toString().padStart(2, '0')}`;

    // Buscar configurações da organização
    const { data: orgSettings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('business_hours')
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (settingsError) {
      console.error('[create-appointment] Erro ao buscar configurações:', settingsError);
    }

    if (orgSettings?.business_hours) {
      const businessHours = orgSettings.business_hours as BusinessHours;
      const companyHoursToday = businessHours[dayOfWeek];

      if (!companyHoursToday) {
        console.log(`[create-appointment] Empresa fechada no dia ${dayOfWeek}`);
        return new Response(
          JSON.stringify({ 
            error: 'Estabelecimento fechado neste dia',
            code: 'CLOSED'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const companyOpenMinutes = timeToMinutes(companyHoursToday.open);
      const companyCloseMinutes = timeToMinutes(companyHoursToday.close);

      console.log(`[create-appointment] Empresa: ${companyHoursToday.open} - ${companyHoursToday.close}, agendamento: ${scheduledTimeStr}`);

      // Validar que o INÍCIO está dentro do expediente
      if (scheduledTimeMinutes < companyOpenMinutes || scheduledTimeMinutes >= companyCloseMinutes) {
        console.log(`[create-appointment] Horário ${scheduledTimeStr} fora do expediente`);
        return new Response(
          JSON.stringify({ 
            error: `Horário fora do expediente. O estabelecimento funciona das ${companyHoursToday.open} às ${companyHoursToday.close}`,
            code: 'OUT_OF_HOURS'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // === VERIFICAR EXCEÇÕES (FECHAMENTO) ===
    const dateStr = scheduledDate.toISOString().split('T')[0];
    
    const { data: exceptions, error: exceptionsError } = await supabase
      .from('organization_exceptions')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('exception_date', dateStr)
      .eq('is_closed', true)
      .or(`professional_id.eq.${professional_id},professional_id.is.null`);

    if (exceptionsError) {
      console.error('[create-appointment] Erro ao buscar exceções:', exceptionsError);
    }

    if (exceptions && exceptions.length > 0) {
      const closedException = exceptions[0];
      const reason = closedException.professional_id 
        ? `Profissional de folga${closedException.reason ? `: ${closedException.reason}` : ''}`
        : `Estabelecimento fechado${closedException.reason ? `: ${closedException.reason}` : ''}`;
      
      console.log(`[create-appointment] Exceção encontrada: ${reason}`);
      return new Response(
        JSON.stringify({ 
          error: reason,
          code: 'EXCEPTION_CLOSED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar duração do serviço
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('duration_minutes, name, price')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Serviço não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar nome do profissional
    const { data: professional } = await supabase
      .from('professionals')
      .select('name')
      .eq('id', professional_id)
      .single();

    // Verificar conflito de horário (usando o trigger do banco)
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        client_id,
        professional_id,
        service_id,
        scheduled_at,
        organization_id,
        duration_minutes: service.duration_minutes,
        notes: notes || null,
        status: 'scheduled'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[create-appointment] Erro ao criar:', insertError);
      
      // Verificar se é erro de conflito
      if (insertError.message.includes('overlaps')) {
        return new Response(
          JSON.stringify({ 
            error: 'Horário indisponível. Este profissional já tem um agendamento neste horário.',
            code: 'CONFLICT'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw insertError;
    }

    console.log(`[create-appointment] Agendamento criado: ${appointment.id}`);

    // Formatar data para resposta
    const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const formattedTime = scheduledDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        appointment: {
          ...appointment,
          service_name: service.name,
          service_price: service.price,
          professional_name: professional?.name
        },
        message: `Agendamento confirmado para ${formattedDate} às ${formattedTime}`,
        summary: {
          date: formattedDate,
          time: formattedTime,
          service: service.name,
          professional: professional?.name,
          price: `R$ ${Number(service.price).toFixed(2).replace('.', ',')}`
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-appointment] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
