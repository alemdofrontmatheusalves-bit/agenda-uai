import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeSlot {
  time: string;
  datetime: string;
}

interface BusinessHours {
  [key: number]: {
    open: string;
    close: string;
  } | null;
}

// Função auxiliar para obter data no timezone brasileiro
function getBrazilDate(dateStr: string): Date {
  // Criar data ao meio-dia no Brasil para evitar problemas de DST
  return new Date(`${dateStr}T12:00:00-03:00`);
}

// Função para obter "agora" no Brasil
function getNowInBrazil(): Date {
  // Ajustar para timezone de Brasília (UTC-3)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 60 * 60000)); // UTC-3
}

// Converte "HH:MM" ou "HH:MM:SS" para minutos desde meia-noite
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Converte minutos desde meia-noite para "HH:MM"
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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

    const { professional_id, date, service_id, organization_id } = await req.json();

    // Validação
    if (!professional_id || !date || !service_id || !organization_id) {
      return new Response(
        JSON.stringify({ 
          error: 'professional_id, date, service_id e organization_id são obrigatórios' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-available-slots] Buscando slots para profissional ${professional_id} em ${date}`);

    // Calcular dia da semana usando timezone brasileiro (0=domingo, 6=sábado)
    const targetDate = getBrazilDate(date);
    const dayOfWeek = targetDate.getDay();

    // === BUSCAR HORÁRIO DE FUNCIONAMENTO DA EMPRESA ===
    const { data: orgSettings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('business_hours, slot_interval_minutes')
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (settingsError) {
      console.error('[get-available-slots] Erro ao buscar configurações:', settingsError);
    }

    const businessHours = (orgSettings?.business_hours as BusinessHours) || {};
    const slotInterval = orgSettings?.slot_interval_minutes || 30;
    const companyHoursToday = businessHours[dayOfWeek];

    // Verificar se a empresa trabalha neste dia
    if (!companyHoursToday) {
      console.log('[get-available-slots] Empresa fechada neste dia da semana');
      return new Response(
        JSON.stringify({ 
          slots: [], 
          message: 'Estabelecimento fechado neste dia',
          closed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyOpenMinutes = timeToMinutes(companyHoursToday.open);
    const companyCloseMinutes = timeToMinutes(companyHoursToday.close);

    console.log(`[get-available-slots] Empresa: ${companyHoursToday.open} - ${companyHoursToday.close}`);

    // === VERIFICAR EXCEÇÕES (FERIADOS/FOLGAS) ===
    const { data: exceptions, error: exceptionsError } = await supabase
      .from('organization_exceptions')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('exception_date', date)
      .or(`professional_id.eq.${professional_id},professional_id.is.null`);

    if (exceptionsError) {
      console.error('[get-available-slots] Erro ao buscar exceções:', exceptionsError);
    }

    // Verificar se há exceção que fecha o dia
    const closedException = exceptions?.find(ex => ex.is_closed);
    if (closedException) {
      const reason = closedException.professional_id 
        ? `Profissional de folga${closedException.reason ? `: ${closedException.reason}` : ''}`
        : `Fechado${closedException.reason ? `: ${closedException.reason}` : ''}`;
      
      console.log(`[get-available-slots] Exceção encontrada: ${reason}`);
      return new Response(
        JSON.stringify({ 
          slots: [], 
          message: reason,
          closed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se há horário especial para este dia
    const specialHoursException = exceptions?.find(ex => !ex.is_closed && (ex.special_open || ex.special_close));

    // Buscar duração do serviço
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Serviço não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const durationMinutes = service.duration_minutes;

    console.log(`[get-available-slots] Dia da semana: ${dayOfWeek}, duração: ${durationMinutes}min`);

    // Buscar disponibilidade do profissional para este dia
    const { data: availability, error: availError } = await supabase
      .from('professional_availability')
      .select('start_time, end_time')
      .eq('professional_id', professional_id)
      .eq('organization_id', organization_id)
      .eq('day_of_week', dayOfWeek)
      .order('start_time');

    if (availError) {
      console.error('[get-available-slots] Erro ao buscar disponibilidade:', availError);
      throw availError;
    }

    if (!availability || availability.length === 0) {
      console.log('[get-available-slots] Profissional não trabalha neste dia');
      return new Response(
        JSON.stringify({ 
          slots: [], 
          message: 'Profissional não trabalha neste dia' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ajustar disponibilidade se houver horário especial
    let effectiveAvailability = availability;
    if (specialHoursException) {
      console.log(`[get-available-slots] Horário especial: ${specialHoursException.special_open} - ${specialHoursException.special_close}`);
      effectiveAvailability = availability.map(period => ({
        start_time: specialHoursException.special_open || period.start_time,
        end_time: specialHoursException.special_close || period.end_time,
      }));
    }

    // === CALCULAR INTERSEÇÃO: horário do profissional ∩ horário da empresa ===
    const intersectedAvailability = effectiveAvailability.map(period => {
      const profStartMinutes = timeToMinutes(period.start_time);
      const profEndMinutes = timeToMinutes(period.end_time);
      
      // Interseção: max(início) e min(fim)
      const effectiveStart = Math.max(profStartMinutes, companyOpenMinutes);
      const effectiveEnd = Math.min(profEndMinutes, companyCloseMinutes);
      
      // Se não houver interseção válida, retornar null
      if (effectiveStart >= effectiveEnd) {
        return null;
      }
      
      return {
        start_time: minutesToTime(effectiveStart),
        end_time: minutesToTime(effectiveEnd),
      };
    }).filter(Boolean) as { start_time: string; end_time: string }[];

    if (intersectedAvailability.length === 0) {
      console.log('[get-available-slots] Nenhum horário efetivo após interseção com empresa');
      return new Response(
        JSON.stringify({ 
          slots: [], 
          message: 'Sem horários disponíveis neste dia' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-available-slots] Horários efetivos após interseção:`, intersectedAvailability);

    // Buscar agendamentos existentes para este dia
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('scheduled_at, duration_minutes')
      .eq('professional_id', professional_id)
      .gte('scheduled_at', startOfDay)
      .lte('scheduled_at', endOfDay)
      .not('status', 'in', '("cancelled","no_show")');

    if (apptError) {
      console.error('[get-available-slots] Erro ao buscar agendamentos:', apptError);
      throw apptError;
    }

    console.log(`[get-available-slots] ${appointments?.length || 0} agendamentos existentes`);

    // Converter agendamentos para intervalos ocupados
    const busySlots = (appointments || []).map(apt => {
      const start = new Date(apt.scheduled_at);
      const end = new Date(start.getTime() + apt.duration_minutes * 60000);
      return { start, end };
    });

    // Gerar slots disponíveis
    const slots: TimeSlot[] = [];
    const nowBrazil = getNowInBrazil();
    const todayBrazil = nowBrazil.toISOString().split('T')[0];
    const isToday = date === todayBrazil;

    for (const period of intersectedAvailability) {
      // Parse horários (formato HH:MM ou HH:MM:SS)
      const [startHour, startMin] = period.start_time.split(':').map(Number);
      const [endHour, endMin] = period.end_time.split(':').map(Number);

      let currentSlot = new Date(targetDate);
      currentSlot.setHours(startHour, startMin, 0, 0);

      const periodEnd = new Date(targetDate);
      periodEnd.setHours(endHour, endMin, 0, 0);

      // Gerar slots usando o intervalo configurado
      while (currentSlot.getTime() < periodEnd.getTime()) {
        const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60000);
        
        // Verificar se não é horário passado (para hoje)
        const slotHourMinute = currentSlot.getHours() * 60 + currentSlot.getMinutes();
        const nowHourMinute = nowBrazil.getHours() * 60 + nowBrazil.getMinutes();
        const isInPast = isToday && slotHourMinute <= nowHourMinute;
        
        // Verificar se não conflita com agendamentos existentes
        const hasConflict = busySlots.some(busy => {
          return (currentSlot < busy.end && slotEnd > busy.start);
        });

        if (!isInPast && !hasConflict) {
          slots.push({
            time: currentSlot.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            }),
            datetime: currentSlot.toISOString()
          });
        }

        // Próximo slot usando o intervalo configurado
        currentSlot = new Date(currentSlot.getTime() + slotInterval * 60000);
      }
    }

    console.log(`[get-available-slots] ${slots.length} slots disponíveis`);

    return new Response(
      JSON.stringify({ 
        slots,
        date,
        professional_id,
        service_duration: durationMinutes,
        special_hours: specialHoursException ? true : false,
        company_hours: companyHoursToday
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-available-slots] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
