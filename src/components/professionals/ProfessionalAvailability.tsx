import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save, Loader2 } from 'lucide-react';

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Props {
  professionalId: string;
  disabled?: boolean;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function ProfessionalAvailability({ professionalId, disabled = false }: Props) {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<Record<number, AvailabilitySlot | null>>({
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  });

  useEffect(() => {
    if (professionalId && currentOrganization) {
      fetchAvailability();
    }
  }, [professionalId, currentOrganization]);

  const fetchAvailability = async () => {
    if (!currentOrganization) return;
    
    try {
      const { data, error } = await supabase
        .from('professional_availability')
        .select('*')
        .eq('professional_id', professionalId)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      const availMap: Record<number, AvailabilitySlot | null> = {
        0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
      };

      (data || []).forEach((slot: any) => {
        availMap[slot.day_of_week] = {
          id: slot.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        };
      });

      setAvailability(availMap);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (dayIndex: number, isWorking: boolean) => {
    if (isWorking) {
      setAvailability({
        ...availability,
        [dayIndex]: {
          day_of_week: dayIndex,
          start_time: '09:00',
          end_time: '18:00',
        },
      });
    } else {
      setAvailability({
        ...availability,
        [dayIndex]: null,
      });
    }
  };

  const handleTimeChange = (dayIndex: number, field: 'start_time' | 'end_time', value: string) => {
    const slot = availability[dayIndex];
    if (!slot) return;
    
    setAvailability({
      ...availability,
      [dayIndex]: { ...slot, [field]: value },
    });
  };

  const handleSave = async () => {
    if (!currentOrganization) return;
    
    setSaving(true);
    try {
      // Delete all existing availability
      await supabase
        .from('professional_availability')
        .delete()
        .eq('professional_id', professionalId)
        .eq('organization_id', currentOrganization.id);

      // Insert new availability
      const slotsToInsert = Object.values(availability)
        .filter((slot): slot is AvailabilitySlot => slot !== null)
        .map((slot) => ({
          professional_id: professionalId,
          organization_id: currentOrganization.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }));

      if (slotsToInsert.length > 0) {
        const { error } = await supabase
          .from('professional_availability')
          .insert(slotsToInsert);

        if (error) throw error;
      }

      toast({ title: 'Disponibilidade salva com sucesso!' });
    } catch (error: any) {
      console.error('Error saving availability:', error);
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
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Horários de Trabalho
        </CardTitle>
        <CardDescription>
          Define os dias e horários em que este profissional atende
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {DAY_NAMES.map((dayName, index) => {
          const slot = availability[index];
          const isWorking = slot !== null;

          return (
            <div key={index} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
              <div className="w-24">
                <span className="font-medium text-sm">{dayName}</span>
              </div>
              
              <Switch
                checked={isWorking}
                onCheckedChange={(checked) => handleDayToggle(index, checked)}
                disabled={disabled}
              />
              
              {isWorking ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={slot?.start_time || '09:00'}
                    onChange={(e) => handleTimeChange(index, 'start_time', e.target.value)}
                    className="w-32"
                    disabled={disabled}
                  />
                  <span className="text-muted-foreground">às</span>
                  <Input
                    type="time"
                    value={slot?.end_time || '18:00'}
                    onChange={(e) => handleTimeChange(index, 'end_time', e.target.value)}
                    className="w-32"
                    disabled={disabled}
                  />
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Folga</span>
              )}
            </div>
          );
        })}

        {!disabled && (
          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Horários
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
