-- Tabela para mapear WhatsApp do salão para organização
CREATE TABLE public.organization_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT organization_whatsapp_number_unique UNIQUE (whatsapp_number),
  CONSTRAINT organization_whatsapp_org_unique UNIQUE (organization_id)
);

-- Índice para busca rápida por número
CREATE INDEX idx_org_whatsapp_number ON public.organization_whatsapp(whatsapp_number);

-- Comentários
COMMENT ON TABLE public.organization_whatsapp IS 'Mapeia número de WhatsApp do salão para sua organização';
COMMENT ON COLUMN public.organization_whatsapp.whatsapp_number IS 'Número em formato E.164 (ex: +5511999999999)';

-- RLS
ALTER TABLE public.organization_whatsapp ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas owners podem gerenciar
CREATE POLICY "Members can view their organization whatsapp" 
ON public.organization_whatsapp 
FOR SELECT 
USING (public.is_member_of(organization_id));

CREATE POLICY "Owners can insert organization whatsapp" 
ON public.organization_whatsapp 
FOR INSERT 
WITH CHECK (public.has_role(organization_id, 'owner'));

CREATE POLICY "Owners can update organization whatsapp" 
ON public.organization_whatsapp 
FOR UPDATE 
USING (public.has_role(organization_id, 'owner'));

CREATE POLICY "Owners can delete organization whatsapp" 
ON public.organization_whatsapp 
FOR DELETE 
USING (public.has_role(organization_id, 'owner'));

-- Trigger para updated_at
CREATE TRIGGER update_organization_whatsapp_updated_at
BEFORE UPDATE ON public.organization_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migração de telefones existentes para E.164
UPDATE public.clients 
SET phone = '+55' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) <= 11;