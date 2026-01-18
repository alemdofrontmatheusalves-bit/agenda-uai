-- Add DELETE policy for organizations (owners only)
CREATE POLICY "Owners can delete their organizations"
ON public.organizations
FOR DELETE
USING (public.has_role(id, 'owner'::app_role));