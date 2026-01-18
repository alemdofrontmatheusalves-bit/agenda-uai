import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Save, Loader2 } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

interface Props {
  professionalId: string;
  disabled?: boolean;
}

export default function ProfessionalServices({ professionalId, disabled = false }: Props) {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (professionalId && currentOrganization) {
      fetchData();
    }
  }, [professionalId, currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;
    
    try {
      // Fetch all services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, is_active')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Fetch professional's assigned services
      const { data: assignedData, error: assignedError } = await supabase
        .from('professional_services')
        .select('service_id')
        .eq('professional_id', professionalId)
        .eq('organization_id', currentOrganization.id);

      if (assignedError) throw assignedError;

      const assignedSet = new Set((assignedData || []).map((a: any) => a.service_id));
      setSelectedServices(assignedSet);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedServices.size === services.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(services.map(s => s.id)));
    }
  };

  const handleSave = async () => {
    if (!currentOrganization) return;
    
    setSaving(true);
    try {
      // Delete all existing assignments
      await supabase
        .from('professional_services')
        .delete()
        .eq('professional_id', professionalId)
        .eq('organization_id', currentOrganization.id);

      // Insert new assignments
      if (selectedServices.size > 0) {
        const assignmentsToInsert = Array.from(selectedServices).map((serviceId) => ({
          professional_id: professionalId,
          service_id: serviceId,
          organization_id: currentOrganization.id,
        }));

        const { error } = await supabase
          .from('professional_services')
          .insert(assignmentsToInsert);

        if (error) throw error;
      }

      toast({ title: 'Serviços salvos com sucesso!' });
    } catch (error: any) {
      console.error('Error saving services:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
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
          <Sparkles className="h-5 w-5 text-primary" />
          Serviços Realizados
        </CardTitle>
        <CardDescription>
          Selecione quais serviços este profissional pode realizar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum serviço cadastrado. Cadastre serviços primeiro.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between pb-2 border-b">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSelectAll}
                disabled={disabled}
              >
                {selectedServices.size === services.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedServices.size} de {services.length} selecionados
              </span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedServices.has(service.id)}
                    onCheckedChange={() => handleToggleService(service.id)}
                    disabled={disabled}
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{service.name}</span>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{service.duration_minutes} min</span>
                      <span>{formatPrice(service.price)}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {!disabled && services.length > 0 && (
          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Serviços
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
