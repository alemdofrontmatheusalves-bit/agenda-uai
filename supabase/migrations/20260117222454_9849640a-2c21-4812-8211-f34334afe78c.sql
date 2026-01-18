-- Drop existing restrictive INSERT policy on memberships
DROP POLICY IF EXISTS "Users can create their own membership" ON public.memberships;

-- Create permissive INSERT policy allowing users to create their own membership
CREATE POLICY "Users can create their own membership"
ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());