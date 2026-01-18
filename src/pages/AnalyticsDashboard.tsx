import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrganization } from '@/lib/organization-context';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccessDenied from '@/components/AccessDenied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  AlertTriangle,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DateRange {
  from: Date;
  to: Date;
}

interface FinancialKPIs {
  revenue: number;
  received: number;
  refunded: number;
  pending: number;
  cashBalance: number; // Caixa líquido real (dinheiro em caixa)
  receivables: number; // A receber (dívidas dos clientes)
}

interface ClientKPIs {
  inDebt: number;
  withCredit: number;
  upToDate: number;
  totalDebt: number;
}

interface InventoryKPIs {
  totalValue: number;
  lowStockCount: number;
  categories: { name: string; value: number }[];
}

export default function AnalyticsDashboard() {
  const { currentOrganization } = useOrganization();
  const canView = usePermission('analytics_view');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [financialKPIs, setFinancialKPIs] = useState<FinancialKPIs>({
    revenue: 0,
    received: 0,
    refunded: 0,
    pending: 0,
    cashBalance: 0,
    receivables: 0,
  });
  const [clientKPIs, setClientKPIs] = useState<ClientKPIs>({
    inDebt: 0,
    withCredit: 0,
    upToDate: 0,
    totalDebt: 0,
  });
  const [inventoryKPIs, setInventoryKPIs] = useState<InventoryKPIs>({
    totalValue: 0,
    lowStockCount: 0,
    categories: [],
  });
  const [monthlyData, setMonthlyData] = useState<
    { month: string; received: number; pending: number }[]
  >([]);
  const [clientStatusData, setClientStatusData] = useState<
    { name: string; value: number }[]
  >([]);

  useEffect(() => {
    if (currentOrganization) {
      fetchAnalytics();
    }
  }, [currentOrganization, dateRange]);


  const fetchAnalytics = async () => {
    if (!currentOrganization) return;

    setLoading(true);

    // Fetch appointments for revenue
    const { data: appointments } = await supabase
      .from('appointments')
      .select('scheduled_at, status, service_id, services(price)')
      .eq('organization_id', currentOrganization.id)
      .gte('scheduled_at', dateRange.from.toISOString())
      .lte('scheduled_at', dateRange.to.toISOString());

    // Calculate financial KPIs from appointments
    // REVENUE = total value of ALL appointments in the period
    // PENDING = value of scheduled/confirmed appointments (future work)
    // COMPLETED = value of completed services (work done, may or may not be paid)
    let revenue = 0;
    let pending = 0;
    let completedValue = 0;

    (appointments || []).forEach((apt: any) => {
      const price = Number(apt.services?.price || 0);
      revenue += price;
      if (apt.status === 'completed') {
        completedValue += price;
      } else if (apt.status === 'scheduled' || apt.status === 'confirmed') {
        pending += price;
      }
    });

    // Fetch client transactions for the period
    // RECEIVED = actual payments received (money in)
    // This is the ONLY source of truth for money received
    const { data: transactions } = await supabase
      .from('client_transactions')
      .select('type, amount, created_at')
      .eq('organization_id', currentOrganization.id)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    // Calculate received ONLY from actual payment transactions
    // Subtract refunds from received amount
    let received = 0;
    let refunded = 0;
    (transactions || []).forEach((t: any) => {
      if (t.type === 'payment' || t.type === 'credit') {
        received += Number(t.amount);
      } else if (t.type === 'refund') {
        refunded += Number(t.amount);
      }
    });

    // Caixa líquido = dinheiro real que entrou menos estornos
    // NÃO subtrai dívidas de clientes - isso é apenas expectativa de recebimento
    const cashBalance = received - refunded;

    // Buscar saldo de todos os clientes para calcular o total a receber (inadimplência)
    // Isso será feito após calcular os saldos dos clientes

    setFinancialKPIs({
      revenue,
      received,
      refunded,
      pending,
      cashBalance, // Dinheiro real no caixa
      receivables: 0, // Será atualizado após calcular saldos dos clientes
    });

    // Fetch clients and their balances
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('organization_id', currentOrganization.id);

    const { data: allTransactions } = await supabase
      .from('client_transactions')
      .select('client_id, type, amount')
      .eq('organization_id', currentOrganization.id);

    // Calculate client balances
    const clientBalances: Record<string, number> = {};
    (clients || []).forEach((c) => {
      clientBalances[c.id] = 0;
    });

    (allTransactions || []).forEach((t: any) => {
      if (clientBalances[t.client_id] !== undefined) {
        if (t.type === 'credit' || t.type === 'payment') {
          clientBalances[t.client_id] += Number(t.amount);
        } else if (t.type === 'debit') {
          clientBalances[t.client_id] -= Number(t.amount);
        } else if (t.type === 'refund') {
          // Estorno: cliente recebeu dinheiro de volta, aumenta o saldo dele
          clientBalances[t.client_id] += Number(t.amount);
        }
      }
    });

    let inDebt = 0;
    let withCredit = 0;
    let upToDate = 0;
    let totalDebt = 0;

    Object.values(clientBalances).forEach((balance) => {
      if (balance < 0) {
        inDebt++;
        totalDebt += Math.abs(balance);
      } else if (balance > 0) {
        withCredit++;
      } else {
        upToDate++;
      }
    });

    setClientKPIs({ inDebt, withCredit, upToDate, totalDebt });
    
    // Atualizar o receivables (A Receber) nos KPIs financeiros
    // totalDebt = soma dos saldos negativos dos clientes (dívidas)
    setFinancialKPIs(prev => ({
      ...prev,
      receivables: totalDebt,
    }));
    setClientStatusData([
      { name: 'Em dia', value: upToDate },
      { name: 'Com crédito', value: withCredit },
      { name: 'Em dívida', value: inDebt },
    ]);

    // Fetch inventory
    const { data: inventory } = await supabase
      .from('inventory_products')
      .select('*')
      .eq('organization_id', currentOrganization.id);

    const totalValue = (inventory || []).reduce(
      (acc, p) => acc + p.quantity * Number(p.unit_cost),
      0
    );
    const lowStockCount = (inventory || []).filter(
      (p) => p.quantity <= p.min_quantity
    ).length;

    // Group by category
    const categoryMap: Record<string, number> = {};
    (inventory || []).forEach((p) => {
      const value = p.quantity * Number(p.unit_cost);
      categoryMap[p.category] = (categoryMap[p.category] || 0) + value;
    });

    const categories = Object.entries(categoryMap).map(([name, value]) => ({
      name,
      value,
    }));

    setInventoryKPIs({ totalValue, lowStockCount, categories });

    // Generate monthly evolution data (last 6 months)
    // We need to fetch ALL transactions for the last 6 months
    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    const { data: allPeriodTransactions } = await supabase
      .from('client_transactions')
      .select('type, amount, created_at')
      .eq('organization_id', currentOrganization.id)
      .gte('created_at', sixMonthsAgo.toISOString());

    const monthlyEvolution: { month: string; received: number; pending: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(subMonths(new Date(), i));

      // Calculate payments received in this month (from transactions)
      // Subtract refunds from the received amount
      const monthTransactions = (allPeriodTransactions || []).filter((t: any) => {
        const date = parseISO(t.created_at);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      let monthReceived = 0;
      let monthRefunded = 0;
      monthTransactions.forEach((t: any) => {
        if (t.type === 'payment' || t.type === 'credit') {
          monthReceived += Number(t.amount);
        } else if (t.type === 'refund') {
          monthRefunded += Number(t.amount);
        }
      });

      // Calculate pending (scheduled/confirmed appointments) for this month
      const monthAppointments = (appointments || []).filter((apt: any) => {
        const date = parseISO(apt.scheduled_at);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      let monthPending = 0;
      monthAppointments.forEach((apt: any) => {
        const price = Number(apt.services?.price || 0);
        if (apt.status === 'scheduled' || apt.status === 'confirmed') {
          monthPending += price;
        }
      });

      monthlyEvolution.push({
        month: format(monthStart, 'MMM', { locale: ptBR }),
        received: monthReceived - monthRefunded, // Net received after refunds
        pending: monthPending,
      });
    }

    setMonthlyData(monthlyEvolution);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--destructive))'];

  if (!canView) {
    return (
      <DashboardLayout>
        <AccessDenied message="Você não tem permissão para visualizar análises." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Analítico</h1>
            <p className="text-muted-foreground">Análise completa do período selecionado</p>
          </div>

          {/* Period Filter */}
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.from, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => {
                    if (date) {
                      setDateRange(prev => ({
                        ...prev,
                        from: date,
                        // Adjust end date if it's before start date
                        to: date > prev.to ? date : prev.to
                      }));
                    }
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground">até</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.to, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => {
                    if (date) {
                      setDateRange(prev => ({
                        ...prev,
                        to: date,
                        // Adjust start date if it's after end date
                        from: date < prev.from ? date : prev.from
                      }));
                    }
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            {/* Financial KPIs */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Indicadores Financeiros
              </h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(financialKPIs.revenue)}</div>
                    <p className="text-xs text-muted-foreground">Total do período</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Recebido</CardTitle>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(financialKPIs.received)}
                    </div>
                    <p className="text-xs text-muted-foreground">Pagamentos brutos</p>
                  </CardContent>
                </Card>
                <Card className={financialKPIs.refunded > 0 ? 'border-amber-500' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Estornos</CardTitle>
                    <RotateCcw className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">
                      {formatCurrency(financialKPIs.refunded)}
                    </div>
                    <p className="text-xs text-muted-foreground">Devoluções ao cliente</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(financialKPIs.pending)}
                    </div>
                    <p className="text-xs text-muted-foreground">Agendamentos pendentes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Caixa Líquido</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={cn(
                        'text-2xl font-bold',
                        financialKPIs.cashBalance >= 0 ? 'text-primary' : 'text-destructive'
                      )}
                    >
                      {formatCurrency(financialKPIs.cashBalance)}
                    </div>
                    <p className="text-xs text-muted-foreground">Dinheiro real em caixa</p>
                  </CardContent>
                </Card>
                <Card className={financialKPIs.receivables > 0 ? 'border-orange-500' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">A Receber</CardTitle>
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-500">
                      {formatCurrency(financialKPIs.receivables)}
                    </div>
                    <p className="text-xs text-muted-foreground">Dívidas de clientes</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Client KPIs */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Indicadores de Clientes
              </h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Em Dia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{clientKPIs.upToDate}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Com Crédito</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{clientKPIs.withCredit}</div>
                  </CardContent>
                </Card>
                <Card className={clientKPIs.inDebt > 0 ? 'border-destructive' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Em Dívida</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{clientKPIs.inDebt}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total em Dívida</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(clientKPIs.totalDebt)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Inventory KPIs */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Indicadores de Estoque
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(inventoryKPIs.totalValue)}</div>
                    <p className="text-xs text-muted-foreground">Capital imobilizado</p>
                  </CardContent>
                </Card>
                <Card className={inventoryKPIs.lowStockCount > 0 ? 'border-destructive' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Alertas de Estoque</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {inventoryKPIs.lowStockCount}
                    </div>
                    <p className="text-xs text-muted-foreground">Produtos com baixo estoque</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Categorias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{inventoryKPIs.categories.length}</div>
                    <p className="text-xs text-muted-foreground">Categorias cadastradas</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Financial Evolution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Evolução Financeira (últimos 6 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `R$${value / 1000}k`} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `Mês: ${label}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="received"
                          name="Recebido"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="pending"
                          name="Pendente"
                          stroke="hsl(var(--destructive))"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Client Status Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Status dos Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={clientStatusData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" name="Clientes">
                          {clientStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Inventory by Category Chart */}
              {inventoryKPIs.categories.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Valor de Estoque por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={inventoryKPIs.categories}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => `R$${value}`} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="value" name="Valor" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
