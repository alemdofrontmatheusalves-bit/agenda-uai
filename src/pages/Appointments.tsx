import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import { usePermissions } from '@/hooks/usePermission';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccessDenied from '@/components/AccessDenied';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, CheckCircle2, XCircle, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import PaymentModal from '@/components/PaymentModal';

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  client: { id: string; name: string };
  professional: { id: string; name: string };
  service: { id: string; name: string; price: number };
}

interface ClientBalance {
  clientId: string;
  balance: number;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  scheduled: { label: 'Agendado', variant: 'secondary', icon: Clock },
  confirmed: { label: 'Confirmado', variant: 'default', icon: CheckCircle2 },
  completed: { label: 'Concluído', variant: 'outline', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
  no_show: { label: 'Não Compareceu', variant: 'destructive', icon: AlertCircle },
};

export default function Appointments() {
  const { currentOrganization, currentRole } = useOrganization();
  const permissions = usePermissions(['appointments_view', 'appointments_create', 'appointments_edit']);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [completingAppointment, setCompletingAppointment] = useState<Appointment | null>(null);
  const [clientBalances, setClientBalances] = useState<Record<string, number>>({});
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const { toast } = useToast();

  const canView = permissions.appointments_view;
  const canCreate = permissions.appointments_create;
  const canEdit = permissions.appointments_edit;

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchAppointments = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`id, scheduled_at, duration_minutes, status, notes, client:clients(id, name), professional:professionals(id, name), service:services(id, name, price)`)
        .eq('organization_id', currentOrganization.id)
        .gte('scheduled_at', weekStart.toISOString())
        .lte('scheduled_at', weekEnd.toISOString())
        .order('scheduled_at');
      if (error) throw error;
      setAppointments((data as Appointment[]) || []);

      // Fetch client balances for all clients in this week's appointments
      const clientIds = [...new Set((data || []).map((a: any) => a.client?.id).filter(Boolean))];
      if (clientIds.length > 0) {
        const { data: transactions } = await supabase
          .from('client_transactions')
          .select('client_id, type, amount')
          .eq('organization_id', currentOrganization.id)
          .in('client_id', clientIds);

        const balances: Record<string, number> = {};
        clientIds.forEach(id => { balances[id] = 0; });
        
        (transactions || []).forEach((t: any) => {
          if (t.type === 'credit' || t.type === 'payment') {
            balances[t.client_id] = (balances[t.client_id] || 0) + Number(t.amount);
          } else if (t.type === 'debit') {
            balances[t.client_id] = (balances[t.client_id] || 0) - Number(t.amount);
          } else if (t.type === 'refund') {
            // Estorno: cliente recebeu dinheiro de volta, aumenta o saldo dele
            balances[t.client_id] = (balances[t.client_id] || 0) + Number(t.amount);
          }
        });

        setClientBalances(balances);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [currentOrganization, weekStart.toISOString()]);

  // Handle clicking "Marcar Concluído" - opens payment modal instead of directly completing
  const handleCompleteClick = (appointment: Appointment) => {
    setCompletingAppointment(appointment);
    setPaymentModalOpen(true);
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (paymentType: 'full' | 'partial' | 'none' | 'credit', amount: number, description: string) => {
    if (!completingAppointment || !currentOrganization) return;

    try {
      const servicePrice = completingAppointment.service.price;
      const clientId = completingAppointment.client.id;

      // First, mark the appointment as completed
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', completingAppointment.id);

      if (updateError) throw updateError;

      // Create financial transactions based on payment type
      const transactions: any[] = [];

      // Always create a debit for the service value (the client owes this)
      transactions.push({
        organization_id: currentOrganization.id,
        client_id: clientId,
        type: 'debit',
        amount: servicePrice,
        description: `Serviço: ${completingAppointment.service.name}`,
        appointment_id: completingAppointment.id,
      });

      // Create payment transaction if applicable
      if (paymentType === 'full') {
        transactions.push({
          organization_id: currentOrganization.id,
          client_id: clientId,
          type: 'payment',
          amount: servicePrice,
          description: description || `Pagamento: ${completingAppointment.service.name}`,
          appointment_id: completingAppointment.id,
        });
      } else if (paymentType === 'partial' && amount > 0) {
        transactions.push({
          organization_id: currentOrganization.id,
          client_id: clientId,
          type: 'payment',
          amount: amount,
          description: description || `Pagamento parcial: ${completingAppointment.service.name}`,
          appointment_id: completingAppointment.id,
        });
      } else if (paymentType === 'credit' && amount > 0) {
        // Use existing credit to pay
        transactions.push({
          organization_id: currentOrganization.id,
          client_id: clientId,
          type: 'payment',
          amount: amount,
          description: description || `Pagamento com crédito: ${completingAppointment.service.name}`,
          appointment_id: completingAppointment.id,
        });
      }

      // Insert all transactions
      if (transactions.length > 0) {
        const { error: transError } = await supabase
          .from('client_transactions')
          .insert(transactions);

        if (transError) throw transError;
      }

      // Update local state
      setAppointments(appointments.map((a) => 
        a.id === completingAppointment.id ? { ...a, status: 'completed' } : a
      ));

      // Update client balance
      let balanceChange = -servicePrice; // Debit
      if (paymentType === 'full') balanceChange += servicePrice;
      else if ((paymentType === 'partial' || paymentType === 'credit') && amount > 0) balanceChange += amount;

      setClientBalances(prev => ({
        ...prev,
        [clientId]: (prev[clientId] || 0) + balanceChange
      }));

      toast({ 
        title: 'Serviço concluído',
        description: paymentType === 'none' 
          ? 'Dívida registrada para o cliente'
          : paymentType === 'full'
          ? 'Pagamento registrado com sucesso'
          : 'Pagamento parcial registrado'
      });
    } catch (error: any) {
      toast({ title: 'Erro ao concluir serviço', description: error.message, variant: 'destructive' });
    } finally {
      setPaymentModalOpen(false);
      setCompletingAppointment(null);
    }
  };

  // Handle status change - check if cancelling a paid appointment
  const handleStatusChange = async (appointmentId: string, newStatus: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show') => {
    // If cancelling, check if there was a payment for this appointment
    if (newStatus === 'cancelled') {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment) {
        // Check if there's a payment transaction for this appointment
        const { data: payments } = await supabase
          .from('client_transactions')
          .select('id, amount')
          .eq('appointment_id', appointmentId)
          .eq('type', 'payment');

        if (payments && payments.length > 0) {
          // There was a payment, ask if user wants to refund
          setCancellingAppointment(appointment);
          setRefundDialogOpen(true);
          return;
        }
      }
    }

    // Normal status change
    try {
      const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId);
      if (error) throw error;
      setAppointments(appointments.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a)));
      toast({ title: `Agendamento marcado como ${statusConfig[newStatus]?.label || newStatus}` });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    }
  };

  // Handle cancellation with optional refund
  const handleCancelWithRefund = async (shouldRefund: boolean) => {
    if (!cancellingAppointment || !currentOrganization) return;

    try {
      // Cancel the appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', cancellingAppointment.id);

      if (updateError) throw updateError;

      if (shouldRefund) {
        // Get the payment amount for this appointment
        const { data: payments } = await supabase
          .from('client_transactions')
          .select('amount')
          .eq('appointment_id', cancellingAppointment.id)
          .eq('type', 'payment');

        const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

        if (totalPaid > 0) {
          // Create a refund transaction
          const { error: refundError } = await supabase
            .from('client_transactions')
            .insert({
              organization_id: currentOrganization.id,
              client_id: cancellingAppointment.client.id,
              type: 'refund',
              amount: totalPaid,
              description: `Estorno - Cancelamento: ${cancellingAppointment.service.name}`,
              appointment_id: cancellingAppointment.id,
            });

          if (refundError) throw refundError;

          // Update client balance
          setClientBalances(prev => ({
            ...prev,
            [cancellingAppointment.client.id]: (prev[cancellingAppointment.client.id] || 0) + totalPaid
          }));

          toast({ 
            title: 'Agendamento cancelado',
            description: `Estorno de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPaid)} registrado`
          });
        }
      } else {
        toast({ title: 'Agendamento cancelado' });
      }

      // Update local state
      setAppointments(appointments.map((a) => 
        a.id === cancellingAppointment.id ? { ...a, status: 'cancelled' } : a
      ));
    } catch (error: any) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    } finally {
      setRefundDialogOpen(false);
      setCancellingAppointment(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', deleteId);
      if (error) throw error;
      setAppointments(appointments.filter((a) => a.id !== deleteId));
      toast({ title: 'Agendamento excluído com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir agendamento', description: error.message, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => addDays(prev, direction === 'prev' ? -7 : 7));
  };
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  const getAppointmentsForDay = (day: Date) => appointments.filter((a) => isSameDay(new Date(a.scheduled_at), day));

  // Check permission after loading
  if (!loading && !canView) {
    return (
      <DashboardLayout>
        <AccessDenied message="Você não tem permissão para ver agendamentos." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
            <p className="text-muted-foreground">Gerencie sua agenda</p>
          </div>
          {canCreate && (
            <Button asChild>
              <Link to="/appointments/new">
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Link>
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>
              Hoje
            </Button>
          </div>
          <h2 className="text-lg font-semibold">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} - {format(weekEnd, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
          </h2>
        </div>
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-7">
            {weekDays.map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-7">
            {weekDays.map((day) => {
              const dayAppointments = getAppointmentsForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <Card key={day.toISOString()} className={cn('shadow-soft min-h-[300px]', isToday && 'ring-2 ring-primary')}>
                  <CardContent className="p-4">
                    <div className={cn('text-center mb-4 pb-3 border-b', isToday && 'text-primary')}>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{format(day, 'EEE', { locale: ptBR })}</div>
                      <div className={cn('text-2xl font-bold', isToday && 'text-primary')}>{format(day, 'd')}</div>
                    </div>
                    {dayAppointments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem agendamentos</p>
                    ) : (
                      <div className="space-y-2">
                        {dayAppointments.map((appointment) => {
                          const status = statusConfig[appointment.status] || statusConfig.scheduled;
                          const StatusIcon = status.icon;
                          return (
                            <div key={appointment.id} className="p-2 rounded-lg border bg-card text-xs hover:shadow-sm transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{format(new Date(appointment.scheduled_at), 'HH:mm')}</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {canEdit && (
                                      <DropdownMenuItem asChild>
                                        <Link to={`/appointments/${appointment.id}/edit`}>
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Editar
                                        </Link>
                                      </DropdownMenuItem>
                                    )}
                                    {canEdit && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleStatusChange(appointment.id, 'confirmed')}>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Marcar Confirmado
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleCompleteClick(appointment)}>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Marcar Concluído
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatusChange(appointment.id, 'cancelled')}>
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Marcar Cancelado
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatusChange(appointment.id, 'no_show')}>
                                          <AlertCircle className="h-4 w-4 mr-2" />
                                          Marcar Não Compareceu
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {currentRole === 'owner' && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setDeleteId(appointment.id)} className="text-destructive">
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="font-medium truncate">{appointment.client?.name}</div>
                              <div className="text-muted-foreground truncate">{appointment.service?.name}</div>
                              <div className="text-muted-foreground truncate">c/ {appointment.professional?.name}</div>
                              <div className="mt-1">
                                <Badge variant={status.variant} className="text-[10px] h-5">
                                  <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                                  {status.label}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza de que deseja excluir este agendamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setCompletingAppointment(null);
        }}
        onConfirm={handlePaymentConfirm}
        servicePrice={completingAppointment?.service.price || 0}
        clientName={completingAppointment?.client.name || ''}
        serviceName={completingAppointment?.service.name || ''}
        clientBalance={completingAppointment ? clientBalances[completingAppointment.client.id] : 0}
      />

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={refundDialogOpen} onOpenChange={() => {
        setRefundDialogOpen(false);
        setCancellingAppointment(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Estornar Pagamento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este agendamento possui pagamento(s) registrado(s). 
              Deseja estornar o valor ao cliente?
              {cancellingAppointment && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p><strong>Cliente:</strong> {cancellingAppointment.client.name}</p>
                  <p><strong>Serviço:</strong> {cancellingAppointment.service.name}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => {
              setRefundDialogOpen(false);
              setCancellingAppointment(null);
            }}>
              Voltar
            </AlertDialogCancel>
            <Button 
              variant="outline" 
              onClick={() => handleCancelWithRefund(false)}
            >
              Cancelar sem estorno
            </Button>
            <Button 
              onClick={() => handleCancelWithRefund(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Cancelar e estornar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
