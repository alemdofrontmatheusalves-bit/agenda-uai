-- Add appointment_id to client_transactions to link transactions to appointments
ALTER TABLE public.client_transactions 
ADD COLUMN appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_client_transactions_appointment_id ON public.client_transactions(appointment_id);

-- Add RLS policy for members to update transactions
CREATE POLICY "Members can update transactions" 
ON public.client_transactions 
FOR UPDATE 
USING (organization_id IN ( SELECT get_user_organization_ids() AS get_user_organization_ids));