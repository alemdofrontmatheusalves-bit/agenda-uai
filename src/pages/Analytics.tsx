import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccessDenied from '@/components/AccessDenied';
import { useOrganization } from '@/lib/organization-context';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  UserPlus,
  RefreshCw,
  Award,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialKPIs {
  currentRevenue: number;
  previousRevenue: number;
  avgTicket: number;
  previousAvgTicket: number;
  growthPercent: number;
}

interface OperationalKPIs {
  totalAppointments: number;
  completedAppointments: number;
  noShowCount: number;
  noShowRate: number;
  occupancyRate: number;
}

interface ClientKPIs {
  totalClients: number;
  newClients: number;
  returningClients: number;
  retentionRate: number;
  avgVisitsPerClient: number;
}

interface ProfessionalRanking {
  id: string;
  name: string;
  totalAppointments: number;
  revenue: number;
  noShowRate: number;
}

interface ServiceRanking {
  id: string;
  name: string;
  totalAppointments: number;
  revenue: number;
  avgPrice: number;
}

export default function Analytics() {
  const { currentOrganization } = useOrganization();
  const canViewAnalytics = usePermission('analytics_view');
  const [loading, setLoading] = useState(true);
  const [financial, setFinancial] = useState<FinancialKPIs | null>(null);
  const [operational, setOperational] = useState<OperationalKPIs | null>(null);
  const [clientKPIs, setClientKPIs] = useState<ClientKPIs | null>(null);
  const [professionalRanking, setProfessionalRanking] = useState<ProfessionalRanking[]>([]);
  const [serviceRanking, setServiceRanking] = useState<ServiceRanking[]>([]);

  useEffect(() => {
    if (currentOrganization) {
      fetchAnalytics();
    }
  }, [currentOrganization]);

  const fetchAnalytics = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));

      // Fetch all appointments with related data
      const { data: appointments, error: appError } = await supabase
        .from('appointments')
        .select(`
          id,
          scheduled_at,
          status,
          duration_minutes,
          professional_id,
          service_id,
          client_id,
          professionals!inner(id, name),
          services!inner(id, name, price),
          clients!inner(id, name)
        `)
        .eq('organization_id', currentOrganization.id);

      if (appError) throw appError;

      const allAppointments = appointments || [];

      // Current month appointments
      const currentMonthApps = allAppointments.filter((a) => {
        const date = new Date(a.scheduled_at);
        return date >= currentMonthStart && date <= currentMonthEnd;
      });

      // Previous month appointments
      const previousMonthApps = allAppointments.filter((a) => {
        const date = new Date(a.scheduled_at);
        return date >= previousMonthStart && date <= previousMonthEnd;
      });

      // Financial KPIs
      const currentRevenue = currentMonthApps
        .filter((a) => a.status === 'completed')
        .reduce((sum, a) => sum + Number((a.services as any)?.price || 0), 0);

      const previousRevenue = previousMonthApps
        .filter((a) => a.status === 'completed')
        .reduce((sum, a) => sum + Number((a.services as any)?.price || 0), 0);

      const currentCompleted = currentMonthApps.filter((a) => a.status === 'completed').length;
      const previousCompleted = previousMonthApps.filter((a) => a.status === 'completed').length;

      const avgTicket = currentCompleted > 0 ? currentRevenue / currentCompleted : 0;
      const previousAvgTicket = previousCompleted > 0 ? previousRevenue / previousCompleted : 0;

      const growthPercent =
        previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      setFinancial({
        currentRevenue,
        previousRevenue,
        avgTicket,
        previousAvgTicket,
        growthPercent,
      });

      // Operational KPIs
      const totalApps = currentMonthApps.length;
      const completed = currentMonthApps.filter((a) => a.status === 'completed').length;
      const noShows = currentMonthApps.filter((a) => a.status === 'no_show').length;
      const noShowRate = totalApps > 0 ? (noShows / totalApps) * 100 : 0;

      // Calculate occupancy (assuming 8 hours/day, 22 days/month)
      const { data: professionals } = await supabase
        .from('professionals')
        .select('id')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true);

      const totalProfessionals = professionals?.length || 1;
      const totalAvailableMinutes = totalProfessionals * 8 * 60 * 22;
      const usedMinutes = currentMonthApps
        .filter((a) => a.status !== 'cancelled')
        .reduce((sum, a) => sum + a.duration_minutes, 0);
      const occupancyRate = totalAvailableMinutes > 0 ? (usedMinutes / totalAvailableMinutes) * 100 : 0;

      setOperational({
        totalAppointments: totalApps,
        completedAppointments: completed,
        noShowCount: noShows,
        noShowRate,
        occupancyRate,
      });

      // Client KPIs
      const { data: clients } = await supabase
        .from('clients')
        .select('id, created_at')
        .eq('organization_id', currentOrganization.id);

      const totalClients = clients?.length || 0;
      const newClients =
        clients?.filter((c) => {
          const date = new Date(c.created_at);
          return date >= currentMonthStart && date <= currentMonthEnd;
        }).length || 0;

      // Unique clients with appointments this month
      const clientsWithApps = new Set(currentMonthApps.map((a) => a.client_id));
      const returningClients = [...clientsWithApps].filter((clientId) => {
        const clientApps = allAppointments.filter(
          (a) => a.client_id === clientId && new Date(a.scheduled_at) < currentMonthStart
        );
        return clientApps.length > 0;
      }).length;

      const retentionRate = clientsWithApps.size > 0 ? (returningClients / clientsWithApps.size) * 100 : 0;

      const avgVisitsPerClient =
        totalClients > 0
          ? allAppointments.filter((a) => a.status === 'completed').length / totalClients
          : 0;

      setClientKPIs({
        totalClients,
        newClients,
        returningClients,
        retentionRate,
        avgVisitsPerClient,
      });

      // Professional Ranking
      const professionalMap = new Map<string, ProfessionalRanking>();
      currentMonthApps.forEach((a) => {
        const profId = a.professional_id;
        const profName = (a.professionals as any)?.name || 'Desconhecido';
        const existing = professionalMap.get(profId) || {
          id: profId,
          name: profName,
          totalAppointments: 0,
          revenue: 0,
          noShowRate: 0,
        };
        existing.totalAppointments++;
        if (a.status === 'completed') {
          existing.revenue += Number((a.services as any)?.price || 0);
        }
        professionalMap.set(profId, existing);
      });

      const profRanking = Array.from(professionalMap.values())
        .map((p) => {
          const noShows = currentMonthApps.filter(
            (a) => a.professional_id === p.id && a.status === 'no_show'
          ).length;
          return {
            ...p,
            noShowRate: p.totalAppointments > 0 ? (noShows / p.totalAppointments) * 100 : 0,
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setProfessionalRanking(profRanking);

      // Service Ranking
      const serviceMap = new Map<string, ServiceRanking>();
      currentMonthApps.forEach((a) => {
        const serviceId = a.service_id;
        const serviceName = (a.services as any)?.name || 'Desconhecido';
        const servicePrice = Number((a.services as any)?.price || 0);
        const existing = serviceMap.get(serviceId) || {
          id: serviceId,
          name: serviceName,
          totalAppointments: 0,
          revenue: 0,
          avgPrice: servicePrice,
        };
        existing.totalAppointments++;
        if (a.status === 'completed') {
          existing.revenue += servicePrice;
        }
        serviceMap.set(serviceId, existing);
      });

      const svcRanking = Array.from(serviceMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setServiceRanking(svcRanking);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR });

  // Check permission after loading
  if (!loading && !canViewAnalytics) {
    return (
      <DashboardLayout>
        <AccessDenied message="Você não tem permissão para ver as análises." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise do Salão</h1>
          <p className="text-muted-foreground">
            Visão analítica completa • {currentMonth}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            {/* Financial KPIs */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                KPIs Financeiros
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Faturamento do Mês</CardDescription>
                    <CardTitle className="text-2xl">
                      {formatCurrency(financial?.currentRevenue || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Mês anterior: {formatCurrency(financial?.previousRevenue || 0)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Ticket Médio</CardDescription>
                    <CardTitle className="text-2xl">
                      {formatCurrency(financial?.avgTicket || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Mês anterior: {formatCurrency(financial?.previousAvgTicket || 0)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Crescimento</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      {financial?.growthPercent !== undefined && (
                        <>
                          {financial.growthPercent >= 0 ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-destructive" />
                          )}
                          <span
                            className={
                              financial.growthPercent >= 0 ? 'text-green-500' : 'text-destructive'
                            }
                          >
                            {financial.growthPercent.toFixed(1)}%
                          </span>
                        </>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">vs. mês anterior</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Operational KPIs */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                KPIs Operacionais
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Taxa de Ocupação</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Percent className="h-5 w-5 text-primary" />
                      {(operational?.occupancyRate || 0).toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {operational?.completedAppointments || 0} atendimentos realizados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Taxa de No-Show</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <AlertCircle
                        className={`h-5 w-5 ${
                          (operational?.noShowRate || 0) > 10 ? 'text-destructive' : 'text-muted-foreground'
                        }`}
                      />
                      <span
                        className={
                          (operational?.noShowRate || 0) > 10 ? 'text-destructive' : ''
                        }
                      >
                        {(operational?.noShowRate || 0).toFixed(1)}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {operational?.noShowCount || 0} faltas este mês
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total de Agendamentos</CardDescription>
                    <CardTitle className="text-2xl">
                      {operational?.totalAppointments || 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      No mês atual
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Client KPIs */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                KPIs de Clientes
              </h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total de Clientes</CardDescription>
                    <CardTitle className="text-2xl">{clientKPIs?.totalClients || 0}</CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Novos Clientes</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-green-500" />
                      {clientKPIs?.newClients || 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Este mês</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Taxa de Retenção</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <RefreshCw className="h-5 w-5 text-primary" />
                      {(clientKPIs?.retentionRate || 0).toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {clientKPIs?.returningClients || 0} clientes recorrentes
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Média de Visitas</CardDescription>
                    <CardTitle className="text-2xl">
                      {(clientKPIs?.avgVisitsPerClient || 0).toFixed(1)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Por cliente
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Rankings */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Professional Ranking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Ranking de Profissionais
                  </CardTitle>
                  <CardDescription>Top 5 por faturamento</CardDescription>
                </CardHeader>
                <CardContent>
                  {professionalRanking.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Profissional</TableHead>
                          <TableHead className="text-right">Atend.</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {professionalRanking.map((prof, index) => (
                          <TableRow key={prof.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant={index === 0 ? 'default' : 'secondary'} className="w-6 h-6 p-0 flex items-center justify-center">
                                  {index + 1}
                                </Badge>
                                {prof.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{prof.totalAppointments}</TableCell>
                            <TableCell className="text-right">{formatCurrency(prof.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Service Ranking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Ranking de Serviços
                  </CardTitle>
                  <CardDescription>Top 5 por faturamento</CardDescription>
                </CardHeader>
                <CardContent>
                  {serviceRanking.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Serviço</TableHead>
                          <TableHead className="text-right">Qtd.</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceRanking.map((svc, index) => (
                          <TableRow key={svc.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant={index === 0 ? 'default' : 'secondary'} className="w-6 h-6 p-0 flex items-center justify-center">
                                  {index + 1}
                                </Badge>
                                {svc.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{svc.totalAppointments}</TableCell>
                            <TableCell className="text-right">{formatCurrency(svc.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
