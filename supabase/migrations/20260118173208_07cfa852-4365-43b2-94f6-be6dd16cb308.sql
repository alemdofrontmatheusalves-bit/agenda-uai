-- =====================================================
-- TABELA: DISPONIBILIDADE DOS PROFISSIONAIS
-- Define os horários de trabalho por dia da semana
-- =====================================================

-- Criar tabela de disponibilidade
CREATE TABLE public.professional_availability (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo, 6=sábado
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Impedir horários duplicados para mesmo profissional/dia
    CONSTRAINT unique_professional_day_time UNIQUE (professional_id, day_of_week, start_time),
    
    -- Garantir que horário de fim é depois do início
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Índices para performance
CREATE INDEX idx_availability_professional ON public.professional_availability(professional_id);
CREATE INDEX idx_availability_organization ON public.professional_availability(organization_id);
CREATE INDEX idx_availability_day ON public.professional_availability(day_of_week);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_professional_availability_updated_at
    BEFORE UPDATE ON public.professional_availability
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Members can view availability of their organization"
    ON public.professional_availability
    FOR SELECT
    USING (public.is_member_of(organization_id));

CREATE POLICY "Users with professionals_create can insert availability"
    ON public.professional_availability
    FOR INSERT
    WITH CHECK (public.has_permission(organization_id, 'professionals_create'));

CREATE POLICY "Users with professionals_edit can update availability"
    ON public.professional_availability
    FOR UPDATE
    USING (public.has_permission(organization_id, 'professionals_edit'));

CREATE POLICY "Users with professionals_edit can delete availability"
    ON public.professional_availability
    FOR DELETE
    USING (public.has_permission(organization_id, 'professionals_edit'));

-- =====================================================
-- FUNÇÃO: Obter horários disponíveis
-- Calcula slots livres para um profissional em uma data
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_available_time_slots(
    p_professional_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER,
    p_organization_id UUID
)
RETURNS TABLE(slot_time TIME) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day_of_week INTEGER;
    v_slot_interval INTERVAL;
    v_current_slot TIME;
    v_availability RECORD;
BEGIN
    -- Obter dia da semana (0=domingo)
    v_day_of_week := EXTRACT(DOW FROM p_date)::INTEGER;
    v_slot_interval := (p_duration_minutes || ' minutes')::INTERVAL;
    
    -- Para cada período de disponibilidade do profissional neste dia
    FOR v_availability IN 
        SELECT start_time, end_time 
        FROM professional_availability
        WHERE professional_id = p_professional_id
          AND organization_id = p_organization_id
          AND day_of_week = v_day_of_week
        ORDER BY start_time
    LOOP
        v_current_slot := v_availability.start_time;
        
        -- Gerar slots de 30 em 30 minutos dentro do período
        WHILE v_current_slot + v_slot_interval <= v_availability.end_time LOOP
            -- Verificar se não há conflito com agendamentos existentes
            IF NOT EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.professional_id = p_professional_id
                  AND a.scheduled_at::DATE = p_date
                  AND a.status NOT IN ('cancelled', 'no_show')
                  AND (
                      -- Novo slot começa durante agendamento existente
                      (v_current_slot >= a.scheduled_at::TIME 
                       AND v_current_slot < (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL)::TIME)
                      OR
                      -- Novo slot termina durante agendamento existente
                      ((v_current_slot + v_slot_interval) > a.scheduled_at::TIME 
                       AND (v_current_slot + v_slot_interval) <= (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL)::TIME)
                      OR
                      -- Novo slot engloba agendamento existente
                      (v_current_slot <= a.scheduled_at::TIME 
                       AND (v_current_slot + v_slot_interval) >= (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL)::TIME)
                  )
            ) THEN
                slot_time := v_current_slot;
                RETURN NEXT;
            END IF;
            
            -- Próximo slot (intervalos de 30 minutos)
            v_current_slot := v_current_slot + INTERVAL '30 minutes';
        END LOOP;
    END LOOP;
    
    RETURN;
END;
$$;