import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Users,
  UserCircle,
  Sparkles,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  totalProfessionals: number;
  totalServices: number;
  todayAppointments: number;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  client: { name: string };
  professional: { name: string };
  service: { name: string };
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  scheduled: { label: 'Agendado', variant: 'secondary', icon: Clock },
  confirmed: { label: 'Confirmado', variant: 'default', icon: CheckCircle2 },
  completed: { label: 'Concluído', variant: 'outline', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
  no_show: { label: 'Não Compareceu', variant: 'destructive', icon: AlertCircle },
};

export default function Dashboard() {
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalProfessionals: 0,
    totalServices: 0,
    todayAppointments: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization) return;

    async function fetchDashboardData() {
      setLoading(true);

      try {
        const orgId = currentOrganization!.id;
        const today = new Date();

        // Fetch counts in parallel
        const [clientsRes, professionalsRes, servicesRes, appointmentsRes, todayRes] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
          supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
          supabase.from('services').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
          supabase.from('appointments').select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('scheduled_at', startOfDay(today).toISOString())
            .lte('scheduled_at', endOfDay(today).toISOString()),
          supabase.from('appointments')
            .select(`
              id,
              scheduled_at,
              duration_minutes,
              status,
              client:clients(name),
              professional:professionals(name),
              service:services(name)
            `)
            .eq('organization_id', orgId)
            .gte('scheduled_at', startOfDay(today).toISOString())
            .lte('scheduled_at', endOfDay(today).toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(10),
        ]);

        setStats({
          totalClients: clientsRes.count || 0,
          totalProfessionals: professionalsRes.count || 0,
          totalServices: servicesRes.count || 0,
          todayAppointments: appointmentsRes.count || 0,
        });

        setTodayAppointments(todayRes.data as Appointment[] || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [currentOrganization]);

  if (orgLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!currentOrganization) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel</h1>
            <p className="text-muted-foreground">
              Bem-vindo de volta ao {currentOrganization.name}
            </p>
          </div>
          <Button asChild>
            <Link to="/appointments/new">
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Agendamentos Hoje
              </CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.todayAppointments}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Clientes
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.totalClients}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profissionais Ativos
              </CardTitle>
              <UserCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.totalProfessionals}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Serviços Oferecidos
              </CardTitle>
              <Sparkles className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.totalServices}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Agenda de Hoje</CardTitle>
              <CardDescription>
                {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/appointments">
                Ver Todos
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">Nenhum agendamento hoje</h3>
                <p className="text-muted-foreground mb-4">
                  Sua agenda está livre. Agende o primeiro atendimento!
                </p>
                <Button asChild>
                  <Link to="/appointments/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Agendamento
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => {
                  const status = statusConfig[appointment.status] || statusConfig.scheduled;
                  const StatusIcon = status.icon;
                  
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-soft transition-shadow"
                    >
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-lg font-semibold text-foreground">
                          {format(new Date(appointment.scheduled_at), 'HH:mm')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {appointment.duration_minutes} min
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {appointment.client?.name}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {appointment.service?.name} com {appointment.professional?.name}
                        </div>
                      </div>
                      
                      <Badge variant={status.variant} className="flex-shrink-0">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => window.location.href = '/clients/new'}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                <Users className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Adicionar Cliente</h3>
                <p className="text-sm text-muted-foreground">Cadastrar um novo cliente</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => window.location.href = '/professionals/new'}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Adicionar Profissional</h3>
                <p className="text-sm text-muted-foreground">Adicionar membro da equipe</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => window.location.href = '/services/new'}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Adicionar Serviço</h3>
                <p className="text-sm text-muted-foreground">Criar novos serviços</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
