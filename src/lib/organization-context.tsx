import { createContext, useContext, useEffect, useState, type ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';

const STORAGE_KEY = 'salon-current-organization-id';

interface Organization {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface Membership {
  id: string;
  role: 'owner' | 'staff';
  organization: Organization;
}

interface OrganizationContextType {
  memberships: Membership[];
  currentOrganization: Organization | null;
  currentRole: 'owner' | 'staff' | null;
  loading: boolean;
  initialized: boolean;
  setCurrentOrganization: (org: Organization | null) => void;
  refetchMemberships: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<'owner' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const lastUserId = useRef<string | null>(null);

  // Custom setter that also persists to localStorage
  const setCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganizationState(org);
    if (org) {
      localStorage.setItem(STORAGE_KEY, org.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const fetchMemberships = async () => {
    if (!user) {
      setMemberships([]);
      setCurrentOrganization(null);
      setCurrentRole(null);
      setLoading(false);
      setInitialized(true);
      return;
    }

    // Set loading true before fetching
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('memberships')
        .select(`
          id,
          role,
          organization:organizations(id, name, slug, phone, email, address)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const formattedMemberships: Membership[] = (data || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        organization: m.organization,
      }));

      setMemberships(formattedMemberships);

      // Try to restore from localStorage or auto-select first
      if (formattedMemberships.length > 0) {
        const savedOrgId = localStorage.getItem(STORAGE_KEY);
        const savedMembership = savedOrgId 
          ? formattedMemberships.find(m => m.organization.id === savedOrgId)
          : null;

        if (savedMembership) {
          setCurrentOrganizationState(savedMembership.organization);
          setCurrentRole(savedMembership.role);
        } else if (!currentOrganization) {
          // Auto-select first organization if none selected and no saved preference
          setCurrentOrganization(formattedMemberships[0].organization);
          setCurrentRole(formattedMemberships[0].role);
        }
      }
    } catch (error) {
      console.error('Error fetching memberships:', error);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    // Reset initialized when user changes
    if (user?.id !== lastUserId.current) {
      lastUserId.current = user?.id ?? null;
      setInitialized(false);
      setLoading(true);
      
      // Clear memberships when user changes to prevent stale data
      if (!user) {
        setMemberships([]);
        setCurrentOrganization(null);
        setCurrentRole(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    
    fetchMemberships();
  }, [user]);

  useEffect(() => {
    if (currentOrganization) {
      const membership = memberships.find(m => m.organization.id === currentOrganization.id);
      setCurrentRole(membership?.role || null);
    }
  }, [currentOrganization, memberships]);

  return (
    <OrganizationContext.Provider
      value={{
        memberships,
        currentOrganization,
        currentRole,
        loading,
        initialized,
        setCurrentOrganization,
        refetchMemberships: fetchMemberships,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}