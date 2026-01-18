import { ReactNode, useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/organization-context';
import { usePermissions, PermissionType } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Scissors,
  LayoutDashboard,
  Calendar,
  Users,
  UserCircle,
  Sparkles,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  BarChart3,
  UsersRound,
  Package,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionType;
}

const allNavigation: NavigationItem[] = [
  { name: 'Painel', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Análise', href: '/analytics', icon: BarChart3, permission: 'analytics_view' },
  { name: 'Agendamentos', href: '/appointments', icon: Calendar, permission: 'appointments_view' },
  { name: 'Clientes', href: '/clients', icon: Users, permission: 'clients_view' },
  { name: 'Profissionais', href: '/professionals', icon: UserCircle, permission: 'professionals_view' },
  { name: 'Serviços', href: '/services', icon: Sparkles, permission: 'services_view' },
  { name: 'Estoque', href: '/inventory', icon: Package, permission: 'inventory_view' },
  { name: 'Financeiro', href: '/finances', icon: Wallet, permission: 'finances_view' },
  { name: 'Equipe', href: '/team', icon: UsersRound, permission: 'team_view' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentOrganization, currentRole, memberships, setCurrentOrganization } = useOrganization();

  // Fetch avatar URL from profile
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;
      
      // First check user metadata
      if (user.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
        return;
      }

      // Otherwise fetch from profiles table
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };

    fetchAvatar();
  }, [user]);

  // Get all permissions for navigation filtering
  const permissionsList = allNavigation
    .map((item) => item.permission)
    .filter((p): p is PermissionType => !!p);
  const permissions = usePermissions(permissionsList);

  // Filter navigation based on permissions
  const navigation = useMemo(() => {
    return allNavigation.filter((item) => {
      // Dashboard is always visible
      if (!item.permission) return true;
      // Check permission
      return permissions[item.permission];
    });
  }, [permissions]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  const getRoleLabel = (role: string) => {
    return role === 'owner' ? 'Proprietário' : 'Funcionário';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-sidebar px-6 py-6">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <Scissors className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-sidebar-foreground">Beleza</span>
          </Link>

          {/* Organization Switcher */}
          {currentOrganization && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">{currentOrganization.name}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Seus Salões</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setCurrentOrganization(m.organization)}
                    className={cn(
                      m.organization.id === currentOrganization.id && 'bg-accent'
                    )}
                  >
                    <span className="truncate">{m.organization.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {getRoleLabel(m.role)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Settings at bottom */}
            <Link
              to="/settings"
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                location.pathname === '/settings'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <Settings className="h-5 w-5" />
              Configurações
            </Link>
          </nav>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-4 border-b border-border bg-background px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="text-foreground"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <Scissors className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Beleza</span>
        </Link>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-foreground/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-sidebar p-6 animate-slide-in-right">
            <div className="flex items-center justify-between mb-6">
              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
                  <Scissors className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-semibold">Beleza</span>
              </Link>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 hidden lg:flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-8 py-4">
          <div>
            {currentRole && (
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {getRoleLabel(currentRole)}
              </span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline-block">{user?.user_metadata?.full_name || user?.email}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
