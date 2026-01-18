-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('owner', 'staff');

-- Create enum for appointment status
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- Organizations table (tenants)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Memberships table (user-organization relationship with role)
CREATE TABLE public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, organization_id)
);

-- Professionals table
CREATE TABLE public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialty TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Services table
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Appointments table
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status appointment_status DEFAULT 'scheduled' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_organization_id ON public.memberships(organization_id);
CREATE INDEX idx_professionals_organization_id ON public.professionals(organization_id);
CREATE INDEX idx_services_organization_id ON public.services(organization_id);
CREATE INDEX idx_clients_organization_id ON public.clients(organization_id);
CREATE INDEX idx_appointments_organization_id ON public.appointments(organization_id);
CREATE INDEX idx_appointments_professional_id ON public.appointments(professional_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check membership (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.is_member_of(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
    AND organization_id = org_id
  )
$$;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND role = _role
  )
$$;

-- Get user's organization IDs
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Organizations policies
CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Owners can update their organizations"
ON public.organizations FOR UPDATE
TO authenticated
USING (public.has_role(id, 'owner'));

-- Memberships policies
CREATE POLICY "Users can view memberships in their orgs"
ON public.memberships FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Users can create their own membership"
ON public.memberships FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can manage memberships"
ON public.memberships FOR UPDATE
TO authenticated
USING (public.has_role(organization_id, 'owner'));

CREATE POLICY "Owners can delete memberships"
ON public.memberships FOR DELETE
TO authenticated
USING (public.has_role(organization_id, 'owner'));

-- Professionals policies
CREATE POLICY "Members can view professionals"
ON public.professionals FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can create professionals"
ON public.professionals FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can update professionals"
ON public.professionals FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Owners can delete professionals"
ON public.professionals FOR DELETE
TO authenticated
USING (public.has_role(organization_id, 'owner'));

-- Services policies
CREATE POLICY "Members can view services"
ON public.services FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can create services"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can update services"
ON public.services FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Owners can delete services"
ON public.services FOR DELETE
TO authenticated
USING (public.has_role(organization_id, 'owner'));

-- Clients policies
CREATE POLICY "Members can view clients"
ON public.clients FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can create clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Owners can delete clients"
ON public.clients FOR DELETE
TO authenticated
USING (public.has_role(organization_id, 'owner'));

-- Appointments policies
CREATE POLICY "Members can view appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can create appointments"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can update appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Owners can delete appointments"
ON public.appointments FOR DELETE
TO authenticated
USING (public.has_role(organization_id, 'owner'));

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_professionals_updated_at BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check for appointment overlaps
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS TRIGGER AS $$
DECLARE
    new_end_time TIMESTAMP WITH TIME ZONE;
    overlap_count INTEGER;
BEGIN
    new_end_time := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::INTERVAL;
    
    SELECT COUNT(*) INTO overlap_count
    FROM public.appointments
    WHERE professional_id = NEW.professional_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND status NOT IN ('cancelled', 'no_show')
    AND (
        (scheduled_at < new_end_time AND scheduled_at + (duration_minutes || ' minutes')::INTERVAL > NEW.scheduled_at)
    );
    
    IF overlap_count > 0 THEN
        RAISE EXCEPTION 'Appointment overlaps with an existing appointment for this professional';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER check_appointment_overlap_trigger
    BEFORE INSERT OR UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.check_appointment_overlap();