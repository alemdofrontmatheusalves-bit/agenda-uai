import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/organization-context';

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrganization?: boolean;
}

export default function ProtectedRoute({ children, requireOrganization = true }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { memberships, loading: orgLoading, initialized } = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to complete first
    if (authLoading) return;

    // If not authenticated, redirect to auth
    if (!user) {
      navigate('/auth');
      return;
    }

    // If we don't require organization, we're done
    if (!requireOrganization) return;

    // Wait for organization context to be initialized (not just loading=false)
    if (!initialized) return;

    // Now we can safely check memberships
    if (memberships.length === 0) {
      navigate('/onboarding');
    }
  }, [user, authLoading, memberships, orgLoading, initialized, navigate, requireOrganization]);

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show loading while organization is loading (when required)
  if (requireOrganization && !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requireOrganization && memberships.length === 0) {
    return null;
  }

  return <>{children}</>;
}
