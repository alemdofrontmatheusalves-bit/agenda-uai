import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarOff, Plus, Trash2, CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Exception {
  id: string;
  exception_date: string;
  reason: string | null;
}

interface Props {
  professionalId: string;
  disabled?: boolean;
}

export default function ProfessionalExceptions({ professionalId, disabled = false }: Props) {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (professionalId && currentOrganization) fetchExceptions();
  }, [professionalId, currentOrganization]);

  const fetchExceptions = async () => {
    if (!currentOrganization) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('organization_exceptions')
        .select('id, exception_date, reason')
        .eq('organization_id', currentOrganization.id)
        .eq('professional_id', professionalId)
        .gte('exception_date', today)
        .order('exception_date', { ascending: true });

      if (error) throw error;
      setExceptions(data || []);
    } catch (error) {
      console.error('Error fetching exceptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExceptions = async () => {
    if (!currentOrganization || selectedDates.length === 0) return;

    setSaving(true);
    try {
      const exceptionsToInsert = selectedDates.map(date => ({
        organization_id: currentOrganization.id,
        professional_id: professionalId,
        exception_date: format(date, 'yyyy-MM-dd'),
        is_closed: true,
        reason: reason.trim() || null,
      }));

      const { error } = await supabase
        .from('organization_exceptions')
        .insert(exceptionsToInsert);

      if (error) throw error;

      toast({ title: `${selectedDates.length} folga(s) adicionada(s) com sucesso!` });
      setDialogOpen(false);
      setSelectedDates([]);
      setReason('');
      fetchExceptions();
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('organization_exceptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Folga removida!' });
      fetchExceptions();
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return format(date, "dd/MM/yyyy (EEEE)", { locale: ptBR });
  };

  // Get dates that have exceptions for calendar highlighting
  const exceptionDates = exceptions.map(e => new Date(e.exception_date + 'T12:00:00'));

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-primary" />
            Folgas
          </CardTitle>
          <CardDescription>
            Configure dias de folga específicos para este profissional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!disabled && (
            <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Folga
            </Button>
          )}

          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma folga agendada.
            </p>
          ) : (
            <div className="space-y-2">
              {exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <CalendarOff className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium text-sm">
                        {formatDate(exception.exception_date)}
                      </span>
                      {exception.reason && (
                        <Badge variant="outline" className="ml-2">
                          {exception.reason}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(exception.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Folga</DialogTitle>
            <DialogDescription>
              Selecione uma ou mais datas para a folga
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Datas</Label>
              <div className="flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(dates) => setSelectedDates(dates || [])}
                  disabled={(date) => date < new Date()}
                  modifiers={{ exception: exceptionDates }}
                  modifiersStyles={{
                    exception: { backgroundColor: 'hsl(var(--destructive) / 0.2)' }
                  }}
                  locale={ptBR}
                  className="rounded-md border"
                />
              </div>
              {selectedDates.length > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {selectedDates.length} data(s) selecionada(s)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Férias, Consulta médica, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddExceptions} disabled={selectedDates.length === 0 || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar {selectedDates.length > 1 ? `(${selectedDates.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
