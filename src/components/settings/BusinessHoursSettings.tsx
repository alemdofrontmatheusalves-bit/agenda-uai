import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save, Loader2 } from 'lucide-react';

interface BusinessHours {
  [key: string]: { open: string; close: string } | null;
}

interface OrgSettings {
  id: string;
  business_hours: BusinessHours;
  min_booking_advance_hours: number;
  max_booking_advance_days: number;
  cancellation_deadline_hours: number;
  buffer_time_minutes: number;
  slot_interval_minutes: number;
  timezone: string;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function BusinessHoursSettings() {
  const { currentOrganization, currentRole } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrgSettings | null>(null);

  const isOwner = currentRole === 'owner';

  useEffect(() => {
    if (currentOrganization) {
      fetchSettings();
    }
  }, [currentOrganization]);

  const fetchSettings = async () => {
    if (!currentOrganization) return;
    
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings exist, create default
          const { data: newData, error: insertError } = await supabase
            .from('organization_settings')
            .insert({ organization_id: currentOrganization.id })
            .select()
            .single();
          
          if (insertError) throw insertError;
          setSettings(newData as unknown as OrgSettings);
        } else {
          throw error;
        }
      } else {
        setSettings(data as unknown as OrgSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (dayIndex: number, isOpen: boolean) => {
    if (!settings) return;
    
    const newHours = { ...settings.business_hours };
    if (isOpen) {
      newHours[dayIndex.toString()] = { open: '09:00', close: '19:00' };
    } else {
      newHours[dayIndex.toString()] = null;
    }
    
    setSettings({ ...settings, business_hours: newHours });
  };

  const handleTimeChange = (dayIndex: number, field: 'open' | 'close', value: string) => {
    if (!settings) return;
    
    const dayHours = settings.business_hours[dayIndex.toString()];
    if (!dayHours) return;
    
    const newHours = { ...settings.business_hours };
    newHours[dayIndex.toString()] = { ...dayHours, [field]: value };
    
    setSettings({ ...settings, business_hours: newHours });
  };

  const handleConfigChange = (field: keyof OrgSettings, value: number) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = async () => {
    if (!settings || !currentOrganization) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organization_settings')
        .update({
          business_hours: settings.business_hours,
          min_booking_advance_hours: settings.min_booking_advance_hours,
          max_booking_advance_days: settings.max_booking_advance_days,
          cancellation_deadline_hours: settings.cancellation_deadline_hours,
          buffer_time_minutes: settings.buffer_time_minutes,
          slot_interval_minutes: settings.slot_interval_minutes,
        })
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      toast({ title: 'Configurações salvas com sucesso!' });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Business Hours Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Horário de Funcionamento
          </CardTitle>
          <CardDescription>
            Define os dias e horários em que o salão está aberto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAY_NAMES.map((dayName, index) => {
            const dayHours = settings.business_hours[index.toString()];
            const isOpen = dayHours !== null;

            return (
              <div key={index} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                <div className="w-24">
                  <span className="font-medium text-sm">{dayName}</span>
                </div>
                
                <Switch
                  checked={isOpen}
                  onCheckedChange={(checked) => handleDayToggle(index, checked)}
                  disabled={!isOwner}
                />
                
                {isOpen ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={dayHours?.open || '09:00'}
                      onChange={(e) => handleTimeChange(index, 'open', e.target.value)}
                      className="w-32"
                      disabled={!isOwner}
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={dayHours?.close || '19:00'}
                      onChange={(e) => handleTimeChange(index, 'close', e.target.value)}
                      className="w-32"
                      disabled={!isOwner}
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Fechado</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Booking Settings Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Configurações de Agendamento</CardTitle>
          <CardDescription>
            Controle como os clientes podem agendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="min_advance">Antecedência mínima (horas)</Label>
              <Input
                id="min_advance"
                type="number"
                min={0}
                max={72}
                value={settings.min_booking_advance_hours}
                onChange={(e) => handleConfigChange('min_booking_advance_hours', parseInt(e.target.value) || 0)}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">
                Quantas horas antes o cliente pode agendar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_advance">Antecedência máxima (dias)</Label>
              <Input
                id="max_advance"
                type="number"
                min={1}
                max={365}
                value={settings.max_booking_advance_days}
                onChange={(e) => handleConfigChange('max_booking_advance_days', parseInt(e.target.value) || 30)}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">
                Quantos dias no futuro pode agendar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancel_deadline">Prazo para cancelar (horas)</Label>
              <Input
                id="cancel_deadline"
                type="number"
                min={0}
                max={72}
                value={settings.cancellation_deadline_hours}
                onChange={(e) => handleConfigChange('cancellation_deadline_hours', parseInt(e.target.value) || 24)}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">
                Horas antes que permite cancelamento
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buffer">Intervalo entre atendimentos (min)</Label>
              <Input
                id="buffer"
                type="number"
                min={0}
                max={60}
                step={5}
                value={settings.buffer_time_minutes}
                onChange={(e) => handleConfigChange('buffer_time_minutes', parseInt(e.target.value) || 0)}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">
                Tempo de limpeza/descanso entre serviços
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot_interval">Intervalo dos horários (min)</Label>
              <Input
                id="slot_interval"
                type="number"
                min={15}
                max={60}
                step={15}
                value={settings.slot_interval_minutes}
                onChange={(e) => handleConfigChange('slot_interval_minutes', parseInt(e.target.value) || 30)}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">
                Intervalo entre os horários disponíveis (15, 30, 45 ou 60 min)
              </p>
            </div>
          </div>

          {isOwner && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
