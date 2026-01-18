-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create permissive policy for organization creation
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);