
-- Tabela de produtos em estoque
CREATE TABLE public.inventory_products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 5,
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações financeiras de clientes
CREATE TABLE public.client_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'payment')),
    amount NUMERIC NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_products
CREATE POLICY "Members can view inventory" ON public.inventory_products
    FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Members can create inventory" ON public.inventory_products
    FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Members can update inventory" ON public.inventory_products
    FOR UPDATE USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Owners can delete inventory" ON public.inventory_products
    FOR DELETE USING (has_role(organization_id, 'owner'));

-- RLS policies for client_transactions
CREATE POLICY "Members can view transactions" ON public.client_transactions
    FOR SELECT USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Members can create transactions" ON public.client_transactions
    FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Owners can delete transactions" ON public.client_transactions
    FOR DELETE USING (has_role(organization_id, 'owner'));

-- Triggers for updated_at
CREATE TRIGGER update_inventory_products_updated_at
    BEFORE UPDATE ON public.inventory_products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add permissions to enum
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'inventory_view';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'inventory_create';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'inventory_edit';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'finances_view';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'finances_create';
