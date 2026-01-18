-- Create permission type enum
CREATE TYPE public.permission_type AS ENUM (
  'appointments_view',
  'appointments_create',
  'appointments_edit',
  'clients_view',
  'clients_create',
  'clients_edit',
  'professionals_view',
  'professionals_create',
  'professionals_edit',
  'services_view',
  'services_create',
  'services_edit',
  'analytics_view',
  'team_view'
);

-- Create member permissions table
CREATE TABLE public.member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  permission public.permission_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(membership_id, permission)
);

-- Create invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'staff',
  permissions public.permission_type[] NOT NULL DEFAULT '{}',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(org_id UUID, _permission public.permission_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Owner always has all permissions
    public.has_role(org_id, 'owner')
    OR
    -- Check specific permission for staff
    EXISTS (
      SELECT 1 
      FROM public.memberships m
      JOIN public.member_permissions mp ON mp.membership_id = m.id
      WHERE m.user_id = auth.uid()
        AND m.organization_id = org_id
        AND mp.permission = _permission
    )
$$;

-- RLS Policies for member_permissions
CREATE POLICY "Members can view permissions in their orgs"
ON public.member_permissions
FOR SELECT
USING (
  membership_id IN (
    SELECT id FROM public.memberships 
    WHERE organization_id IN (SELECT public.get_user_organization_ids())
  )
);

CREATE POLICY "Owners can manage permissions"
ON public.member_permissions
FOR ALL
USING (
  membership_id IN (
    SELECT m.id FROM public.memberships m
    WHERE public.has_role(m.organization_id, 'owner')
  )
);

-- RLS Policies for invitations
CREATE POLICY "Owners can view invitations"
ON public.invitations
FOR SELECT
USING (public.has_role(organization_id, 'owner'));

CREATE POLICY "Owners can create invitations"
ON public.invitations
FOR INSERT
WITH CHECK (public.has_role(organization_id, 'owner'));

CREATE POLICY "Owners can update invitations"
ON public.invitations
FOR UPDATE
USING (public.has_role(organization_id, 'owner'));

CREATE POLICY "Owners can delete invitations"
ON public.invitations
FOR DELETE
USING (public.has_role(organization_id, 'owner'));

CREATE POLICY "Anyone can view invitation by token"
ON public.invitations
FOR SELECT
USING (true);

-- Create index for faster permission lookups
CREATE INDEX idx_member_permissions_membership ON public.member_permissions(membership_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_org ON public.invitations(organization_id);