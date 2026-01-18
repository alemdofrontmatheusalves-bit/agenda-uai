-- Drop the overly permissive policy and create a more restrictive one
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Users can only create organizations if they're authenticated (the trigger will handle creating membership)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);