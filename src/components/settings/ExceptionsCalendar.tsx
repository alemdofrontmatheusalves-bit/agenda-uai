import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { CalendarOff, Plus, Trash2, CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Exception {
  id: string;
  exception_date: string;
  is_closed: boolean;
  reason: string | null;
  special_open: string | null;
  special_close: string | null;
  professional_id: string | null;
}

export default function ExceptionsCalendar() {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    is_closed: true,
    reason: '',
    special_open: '09:00',
    special_close: '18:00',
  });

  useEffect(() => {
    if (currentOrganization) fetchExceptions();
  }, [currentOrganization]);

  const fetchExceptions = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('organization_exceptions')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .is('professional_id', null)
        .order('exception_date', { ascending: true });

      if (error) throw error;
      setExceptions(data || []);
    } catch (error) {
      console.error('Error fetching exceptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddException = async () => {
    if (!currentOrganization || !selectedDate) return;

    setSaving(true);
    try {
      const exceptionData = {
        organization_id: currentOrganization.id,
        exception_date: format(selectedDate, 'yyyy-MM-dd'),
        is_closed: formData.is_closed,
        reason: formData.reason.trim() || null,
        special_open: formData.is_closed ? null : formData.special_open,
        special_close: formData.is_closed ? null : formData.special_close,
        professional_id: null,
      };

      const { error } = await supabase
        .from('organization_exceptions')
        .insert(exceptionData);

      if (error) throw error;

      toast({ title: 'Exceção adicionada com sucesso!' });
      setDialogOpen(false);
      setSelectedDate(undefined);
      setFormData({ is_closed: true, reason: '', special_open: '09:00', special_close: '18:00' });
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
      toast({ title: 'Exceção removida!' });
      fetchExceptions();
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
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
            <Skeleton key={i} className="h-12 w-full" />
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
            Feriados e Exceções
          </CardTitle>
          <CardDescription>
            Configure datas em que o estabelecimento estará fechado ou com horário especial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Exceção
          </Button>

          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma exceção cadastrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exception) => (
                  <TableRow key={exception.id}>
                    <TableCell className="font-medium">
                      {formatDate(exception.exception_date)}
                    </TableCell>
                    <TableCell>
                      {exception.is_closed ? (
                        <span className="text-destructive">Fechado</span>
                      ) : (
                        <span className="text-primary">
                          {exception.special_open} - {exception.special_close}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {exception.reason || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(exception.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Exceção</DialogTitle>
            <DialogDescription>
              Configure uma data especial ou feriado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    modifiers={{ exception: exceptionDates }}
                    modifiersStyles={{
                      exception: { backgroundColor: 'hsl(var(--destructive) / 0.2)' }
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Fechado</Label>
                <p className="text-sm text-muted-foreground">
                  Marque se o estabelecimento estará completamente fechado
                </p>
              </div>
              <Switch
                checked={formData.is_closed}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_closed: checked }))}
              />
            </div>

            {!formData.is_closed && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Abre às</Label>
                  <Input
                    type="time"
                    value={formData.special_open}
                    onChange={(e) => setFormData(prev => ({ ...prev, special_open: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha às</Label>
                  <Input
                    type="time"
                    value={formData.special_close}
                    onChange={(e) => setFormData(prev => ({ ...prev, special_close: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Ex: Natal, Reforma, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddException} disabled={!selectedDate || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
