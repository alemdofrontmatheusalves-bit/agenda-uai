-- Fase 1: Criar índice UNIQUE para telefone por organização
-- Permite: mesmo telefone em organizações diferentes (multi-tenant)
-- Permite: clientes sem telefone (null)
-- Bloqueia: duplicação de telefone na mesma organização
CREATE UNIQUE INDEX IF NOT EXISTS clients_organization_phone_unique 
ON public.clients (organization_id, phone) 
WHERE phone IS NOT NULL AND phone != '';

-- Fase 2: Corrigir constraint de tipos de transação para incluir 'refund'
-- Primeiro verificar se a constraint existe e removê-la
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'client_transactions_type_check' 
    AND table_name = 'client_transactions'
  ) THEN
    ALTER TABLE public.client_transactions DROP CONSTRAINT client_transactions_type_check;
  END IF;
END $$;

-- Adicionar nova constraint com todos os tipos válidos
ALTER TABLE public.client_transactions 
ADD CONSTRAINT client_transactions_type_check 
CHECK (type IN ('credit', 'debit', 'payment', 'refund'));