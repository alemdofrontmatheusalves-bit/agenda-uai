import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProfessionalAvailability from '@/components/professionals/ProfessionalAvailability';
import ProfessionalServices from '@/components/professionals/ProfessionalServices';
import ProfessionalExceptions from '@/components/professionals/ProfessionalExceptions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, User, Clock, Sparkles, CalendarOff } from 'lucide-react';

const professionalSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(100, 'O nome é muito longo'),
  email: z.string().trim().email('Por favor, insira um e-mail válido').max(255, 'O e-mail é muito longo').optional().or(z.literal('')),
  phone: z.string().trim().max(20, 'O número de telefone é muito longo').optional().or(z.literal('')),
  specialty: z.string().trim().max(100, 'A especialidade é muito longa').optional().or(z.literal('')),
  is_active: z.boolean(),
  base_commission_percentage: z.number().min(0).max(100).optional(),
});

export default function ProfessionalForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    is_active: true,
    base_commission_percentage: 50,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedProfessionalId, setSavedProfessionalId] = useState<string | null>(id || null);

  useEffect(() => {
    if (isEditing && currentOrganization) fetchProfessional();
  }, [id, currentOrganization]);

  const fetchProfessional = async () => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('id', id)
        .eq('organization_id', currentOrganization!.id)
        .single();
      
      if (error) throw error;
      
      setFormData({
        name: data.name,
        email: data.email || '',
        phone: data.phone || '',
        specialty: data.specialty || '',
        is_active: data.is_active,
        base_commission_percentage: data.base_commission_percentage || 50,
      });
      setSavedProfessionalId(data.id);
    } catch (error) {
      console.error('Error fetching professional:', error);
      navigate('/professionals');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = professionalSchema.safeParse({
      ...formData,
      base_commission_percentage: parseFloat(formData.base_commission_percentage.toString()) || 50,
    });
    
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
      const professionalData = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        specialty: formData.specialty.trim() || null,
        is_active: formData.is_active,
        base_commission_percentage: formData.base_commission_percentage,
        organization_id: currentOrganization.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('professionals')
          .update(professionalData)
          .eq('id', id);
        
        if (error) throw error;
        toast({ title: 'Profissional atualizado com sucesso' });
      } else {
        const { data, error } = await supabase
          .from('professionals')
          .insert(professionalData)
          .select()
          .single();
        
        if (error) throw error;
        
        setSavedProfessionalId(data.id);
        toast({ title: 'Profissional criado com sucesso! Configure os horários e serviços.' });
        
        // Don't navigate away - let user configure availability and services
        return;
      }
      
      navigate('/professionals');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/professionals"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? 'Editar Profissional' : 'Adicionar Profissional'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Atualizar informações do profissional' : 'Adicionar novo membro da equipe'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="availability" disabled={!savedProfessionalId} className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horários
            </TabsTrigger>
            <TabsTrigger value="services" disabled={!savedProfessionalId} className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="exceptions" disabled={!savedProfessionalId} className="flex items-center gap-2">
              <CalendarOff className="h-4 w-4" />
              Folgas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Informações do Profissional</CardTitle>
                <CardDescription>Preencha os dados do profissional</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Maria Silva"
                      disabled={isLoading}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialty">Especialidade</Label>
                    <Input
                      id="specialty"
                      name="specialty"
                      value={formData.specialty}
                      onChange={handleInputChange}
                      placeholder="Cabeleireira, Esteticista, etc."
                      disabled={isLoading}
                    />
                    {errors.specialty && <p className="text-sm text-destructive">{errors.specialty}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="maria@salao.com"
                        disabled={isLoading}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="(11) 99999-9999"
                        disabled={isLoading}
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="base_commission_percentage">Comissão Padrão (%)</Label>
                    <Input
                      id="base_commission_percentage"
                      name="base_commission_percentage"
                      type="number"
                      min={0}
                      max={100}
                      value={formData.base_commission_percentage}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_commission_percentage: parseFloat(e.target.value) || 0 }))}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">Porcentagem do serviço que vai para o profissional</p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_active">Status Ativo</Label>
                      <p className="text-sm text-muted-foreground">
                        Profissionais inativos não aparecem nas opções de agendamento
                      </p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" disabled={isLoading}>
                      <Save className="h-4 w-4 mr-2" />
                      {isLoading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Salvar e Continuar'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate('/professionals')} disabled={isLoading}>
                      {savedProfessionalId && !isEditing ? 'Concluir' : 'Cancelar'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="availability">
            {savedProfessionalId ? (
              <ProfessionalAvailability professionalId={savedProfessionalId} />
            ) : (
              <Card className="shadow-soft">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Salve as informações do profissional primeiro para configurar os horários.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="services">
            {savedProfessionalId ? (
              <ProfessionalServices professionalId={savedProfessionalId} />
            ) : (
              <Card className="shadow-soft">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Salve as informações do profissional primeiro para configurar os serviços.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="exceptions">
            {savedProfessionalId ? (
              <ProfessionalExceptions professionalId={savedProfessionalId} />
            ) : (
              <Card className="shadow-soft">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Salve as informações do profissional primeiro para configurar as folgas.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
