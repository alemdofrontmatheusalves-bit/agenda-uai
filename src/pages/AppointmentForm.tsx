import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, CalendarIcon, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  id: string;
  name: string;
  duration_minutes?: number;
}

interface BusinessHours {
  [key: number]: {
    open: string;
    close: string;
  } | null;
}

interface OrgSettings {
  business_hours: BusinessHours;
  slot_interval_minutes: number;
}

const appointmentSchema = z.object({
  client_id: z.string().min(1, 'Por favor, selecione um cliente'),
  professional_id: z.string().min(1, 'Por favor, selecione um profissional'),
  service_id: z.string().min(1, 'Por favor, selecione um serviço'),
  date: z.date({ required_error: 'Por favor, selecione uma data' }),
  time: z.string().min(1, 'Por favor, selecione um horário'),
  notes: z.string().max(500, 'As observações são muito longas').optional(),
});

export default function AppointmentForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [professionals, setProfessionals] = useState<SelectOption[]>([]);
  const [services, setServices] = useState<SelectOption[]>([]);
  const [filteredProfessionals, setFilteredProfessionals] = useState<SelectOption[]>([]);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  
  const [formData, setFormData] = useState({
    client_id: '',
    professional_id: '',
    service_id: '',
    date: undefined as Date | undefined,
    time: '',
    notes: '',
    status: 'scheduled',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentOrganization) {
      fetchOptions();
      fetchOrgSettings();
      if (isEditing) fetchAppointment();
    }
  }, [currentOrganization, id]);

  // Filter professionals when service changes
  useEffect(() => {
    if (formData.service_id && currentOrganization) {
      filterProfessionalsByService(formData.service_id);
    } else {
      setFilteredProfessionals(professionals);
    }
  }, [formData.service_id, professionals]);

  // Reset time when date changes (since available slots may differ)
  useEffect(() => {
    if (!isEditing) {
      setFormData(prev => ({ ...prev, time: '' }));
    }
  }, [formData.date]);

  const fetchOrgSettings = async () => {
    if (!currentOrganization) return;
    
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('business_hours, slot_interval_minutes')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOrgSettings({
          business_hours: (data.business_hours as unknown as BusinessHours) || {},
          slot_interval_minutes: data.slot_interval_minutes || 30,
        });
      }
    } catch (error) {
      console.error('Error fetching org settings:', error);
    }
  };

  const fetchOptions = async () => {
    if (!currentOrganization) return;
    
    try {
      const [clientsRes, professionalsRes, servicesRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('organization_id', currentOrganization.id)
          .order('name'),
        supabase
          .from('professionals')
          .select('id, name')
          .eq('organization_id', currentOrganization.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('services')
          .select('id, name, duration_minutes')
          .eq('organization_id', currentOrganization.id)
          .eq('is_active', true)
          .order('name'),
      ]);

      setClients(clientsRes.data || []);
      setProfessionals(professionalsRes.data || []);
      setServices(servicesRes.data || []);
      setFilteredProfessionals(professionalsRes.data || []);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const filterProfessionalsByService = async (serviceId: string) => {
    if (!currentOrganization) return;
    
    setLoadingProfessionals(true);
    
    try {
      // Check if there are any professional_services records
      const { data: assignments, error } = await supabase
        .from('professional_services')
        .select('professional_id')
        .eq('service_id', serviceId)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      if (assignments && assignments.length > 0) {
        // Filter professionals to only those assigned to this service
        const assignedIds = new Set(assignments.map(a => a.professional_id));
        const filtered = professionals.filter(p => assignedIds.has(p.id));
        setFilteredProfessionals(filtered);
        
        // Clear professional selection if current one is not in filtered list
        if (formData.professional_id && !assignedIds.has(formData.professional_id)) {
          setFormData(prev => ({ ...prev, professional_id: '' }));
        }
      } else {
        // No assignments - show empty list (strict mode)
        setFilteredProfessionals([]);
      }
    } catch (error) {
      console.error('Error filtering professionals:', error);
      setFilteredProfessionals([]);
    } finally {
      setLoadingProfessionals(false);
    }
  };

  const fetchAppointment = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .eq('organization_id', currentOrganization!.id)
        .single();

      if (error) throw error;

      const scheduledAt = new Date(data.scheduled_at);
      setFormData({
        client_id: data.client_id,
        professional_id: data.professional_id,
        service_id: data.service_id,
        date: scheduledAt,
        time: format(scheduledAt, 'HH:mm'),
        notes: data.notes || '',
        status: data.status,
      });
    } catch (error) {
      console.error('Error fetching appointment:', error);
      navigate('/appointments');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = appointmentSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!currentOrganization) {
      toast({ title: 'Erro', description: 'Nenhuma organização selecionada', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const [hours, minutes] = formData.time.split(':').map(Number);
      const scheduledAt = new Date(formData.date!);
      scheduledAt.setHours(hours, minutes, 0, 0);

      const selectedService = services.find(s => s.id === formData.service_id);
      const duration = selectedService?.duration_minutes || 30;

      const appointmentData = {
        client_id: formData.client_id,
        professional_id: formData.professional_id,
        service_id: formData.service_id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: duration,
        notes: formData.notes.trim() || null,
        status: formData.status as 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
        organization_id: currentOrganization.id,
      };

      if (isEditing) {
        const { error } = await supabase.from('appointments').update(appointmentData).eq('id', id);
        if (error) throw error;
        toast({ title: 'Agendamento atualizado com sucesso' });
      } else {
        const { error } = await supabase.from('appointments').insert(appointmentData);
        if (error) {
          if (error.message.includes('overlaps')) {
            toast({
              title: 'Conflito de horário',
              description: 'Este profissional já tem um agendamento neste horário. Por favor, escolha outro horário.',
              variant: 'destructive',
            });
            return;
          }
          throw error;
        }
        toast({ title: 'Agendamento criado com sucesso' });
      }
      navigate('/appointments');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate time slots dynamically based on business hours
  const timeSlots = useMemo(() => {
    if (!formData.date) return [];
    
    const dayOfWeek = formData.date.getDay();
    const interval = orgSettings?.slot_interval_minutes || 30;
    
    // If we have business hours configured, use them
    if (orgSettings?.business_hours) {
      const hoursToday = orgSettings.business_hours[dayOfWeek];
      
      if (!hoursToday) {
        // Company closed on this day
        return [];
      }
      
      const slots: string[] = [];
      const [openH, openM] = hoursToday.open.split(':').map(Number);
      const [closeH, closeM] = hoursToday.close.split(':').map(Number);
      
      let currentH = openH;
      let currentM = openM;
      const closeMinutes = closeH * 60 + closeM;
      
      while (currentH * 60 + currentM < closeMinutes) {
        slots.push(`${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`);
        currentM += interval;
        if (currentM >= 60) {
          currentH += Math.floor(currentM / 60);
          currentM = currentM % 60;
        }
      }
      
      return slots;
    }
    
    // Fallback: 08:00 to 22:00 if no settings (shouldn't happen in production)
    return Array.from({ length: Math.floor(14 * 60 / interval) }, (_, i) => {
      const totalMinutes = 8 * 60 + i * interval;
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    });
  }, [formData.date, orgSettings]);

  // Check if selected date is a closed day
  const isClosedDay = useMemo(() => {
    if (!formData.date || !orgSettings?.business_hours) return false;
    const dayOfWeek = formData.date.getDay();
    return !orgSettings.business_hours[dayOfWeek];
  }, [formData.date, orgSettings]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/appointments"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? 'Editar Agendamento' : 'Novo Agendamento'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Atualizar detalhes do agendamento' : 'Agendar um novo atendimento'}
            </p>
          </div>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Detalhes do Agendamento</CardTitle>
            <CardDescription>Preencha as informações do agendamento</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Client */}
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, client_id: value }));
                    setErrors((prev) => ({ ...prev, client_id: '' }));
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.client_id && <p className="text-sm text-destructive">{errors.client_id}</p>}
              </div>

              {/* Service - Now comes BEFORE professional */}
              <div className="space-y-2">
                <Label>Serviço *</Label>
                <Select
                  value={formData.service_id}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, service_id: value }));
                    setErrors((prev) => ({ ...prev, service_id: '' }));
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.duration_minutes} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.service_id && <p className="text-sm text-destructive">{errors.service_id}</p>}
              </div>

              {/* Professional - Now comes AFTER service and is filtered */}
              <div className="space-y-2">
                <Label>Profissional *</Label>
                {loadingProfessionals ? (
                  <Skeleton className="h-10 w-full" />
                ) : filteredProfessionals.length === 0 && formData.service_id ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">
                      Nenhum profissional configurado para este serviço. Configure os profissionais primeiro.
                    </span>
                  </div>
                ) : (
                  <Select
                    value={formData.professional_id}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, professional_id: value }));
                      setErrors((prev) => ({ ...prev, professional_id: '' }));
                    }}
                    disabled={isLoading || !formData.service_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.service_id ? "Selecione um profissional" : "Selecione um serviço primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProfessionals.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.professional_id && <p className="text-sm text-destructive">{errors.professional_id}</p>}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal', !formData.date && 'text-muted-foreground')}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date
                          ? format(formData.date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : 'Selecione uma data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={(date) => {
                          setFormData((prev) => ({ ...prev, date }));
                          setErrors((prev) => ({ ...prev, date: '' }));
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Horário *</Label>
                  {isClosedDay ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/50 bg-amber-500/10">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-700">
                        Estabelecimento fechado neste dia
                      </span>
                    </div>
                  ) : (
                    <Select
                      value={formData.time}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, time: value }));
                        setErrors((prev) => ({ ...prev, time: '' }));
                      }}
                      disabled={isLoading || !formData.date || timeSlots.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.date ? "Selecione o horário" : "Selecione uma data primeiro"}>
                          {formData.time && (
                            <span className="flex items-center">
                              <Clock className="mr-2 h-4 w-4" />
                              {formData.time}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.time && <p className="text-sm text-destructive">{errors.time}</p>}
                </div>
              </div>

              {/* Status (only when editing) */}
              {isEditing && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Agendado</SelectItem>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="no_show">Não Compareceu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Algum pedido especial ou observação..."
                  rows={3}
                  disabled={isLoading}
                />
                {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isLoading || isClosedDay}>
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Salvando...' : isEditing ? 'Atualizar Agendamento' : 'Criar Agendamento'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/appointments')} disabled={isLoading}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
