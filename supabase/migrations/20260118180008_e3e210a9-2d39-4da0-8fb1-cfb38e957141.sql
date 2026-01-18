-- =====================================================
-- 1. ORGANIZATION SETTINGS - Horário de funcionamento + Configs
-- =====================================================
CREATE TABLE public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Horário de funcionamento por dia (0=domingo, 6=sábado)
  -- NULL = fechado, objeto = {open: "09:00", close: "19:00"}
  business_hours JSONB NOT NULL DEFAULT '{
    "0": null,
    "1": {"open": "09:00", "close": "19:00"},
    "2": {"open": "09:00", "close": "19:00"},
    "3": {"open": "09:00", "close": "19:00"},
    "4": {"open": "09:00", "close": "19:00"},
    "5": {"open": "09:00", "close": "19:00"},
    "6": {"open": "09:00", "close": "18:00"}
  }'::jsonb,
  
  -- Configurações de agendamento
  min_booking_advance_hours INTEGER NOT NULL DEFAULT 2,
  max_booking_advance_days INTEGER NOT NULL DEFAULT 30,
  cancellation_deadline_hours INTEGER NOT NULL DEFAULT 24,
  buffer_time_minutes INTEGER NOT NULL DEFAULT 0,
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
  
  -- Timezone
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT organization_settings_organization_id_key UNIQUE (organization_id)
);

-- RLS para organization_settings
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org settings"
ON public.organization_settings FOR SELECT
USING (is_member_of(organization_id));

CREATE POLICY "Owners can insert org settings"
ON public.organization_settings FOR INSERT
WITH CHECK (has_role(organization_id, 'owner'));

CREATE POLICY "Owners can update org settings"
ON public.organization_settings FOR UPDATE
USING (has_role(organization_id, 'owner'));

CREATE POLICY "Owners can delete org settings"
ON public.organization_settings FOR DELETE
USING (has_role(organization_id, 'owner'));

-- Trigger para updated_at
CREATE TRIGGER update_organization_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. PROFESSIONAL SERVICES - Relação Profissional ↔ Serviço
-- =====================================================
CREATE TABLE public.professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Comissão específica para este profissional/serviço (NULL = usa padrão)
  commission_percentage DECIMAL(5,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT professional_services_unique UNIQUE (professional_id, service_id)
);

-- RLS para professional_services
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view professional services"
ON public.professional_services FOR SELECT
USING (is_member_of(organization_id));

CREATE POLICY "Users with professionals_create can insert"
ON public.professional_services FOR INSERT
WITH CHECK (has_permission(organization_id, 'professionals_create'));

CREATE POLICY "Users with professionals_edit can update"
ON public.professional_services FOR UPDATE
USING (has_permission(organization_id, 'professionals_edit'));

CREATE POLICY "Users with professionals_edit can delete"
ON public.professional_services FOR DELETE
USING (has_permission(organization_id, 'professionals_edit'));

-- Índices para performance
CREATE INDEX idx_professional_services_professional ON public.professional_services(professional_id);
CREATE INDEX idx_professional_services_service ON public.professional_services(service_id);

-- =====================================================
-- 3. ORGANIZATION EXCEPTIONS - Feriados e Folgas
-- =====================================================
CREATE TABLE public.organization_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE, -- NULL = toda org
  
  exception_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT true, -- true = fechado, false = horário especial
  special_open TIME, -- horário especial de abertura (se is_closed = false)
  special_close TIME, -- horário especial de fechamento (se is_closed = false)
  reason TEXT, -- motivo (ex: "Feriado - Natal", "Férias da Maria")
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Permite apenas uma exceção por data por profissional (ou org inteira)
  CONSTRAINT organization_exceptions_unique UNIQUE (organization_id, professional_id, exception_date)
);

-- RLS para organization_exceptions
ALTER TABLE public.organization_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view exceptions"
ON public.organization_exceptions FOR SELECT
USING (is_member_of(organization_id));

CREATE POLICY "Owners can insert exceptions"
ON public.organization_exceptions FOR INSERT
WITH CHECK (has_role(organization_id, 'owner'));

CREATE POLICY "Owners can update exceptions"
ON public.organization_exceptions FOR UPDATE
USING (has_role(organization_id, 'owner'));

CREATE POLICY "Owners can delete exceptions"
ON public.organization_exceptions FOR DELETE
USING (has_role(organization_id, 'owner'));

-- Índice para busca por data
CREATE INDEX idx_organization_exceptions_date ON public.organization_exceptions(organization_id, exception_date);

-- =====================================================
-- 4. ADICIONAR COMISSÃO PADRÃO EM SERVICES E PROFESSIONALS
-- =====================================================
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS default_commission_percentage DECIMAL(5,2) DEFAULT 50.00;

ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS base_commission_percentage DECIMAL(5,2) DEFAULT 50.00;

-- =====================================================
-- 5. CRIAR SETTINGS PADRÃO PARA ORGS EXISTENTES
-- =====================================================
INSERT INTO public.organization_settings (organization_id)
SELECT id FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.organization_settings)
ON CONFLICT (organization_id) DO NOTHING;