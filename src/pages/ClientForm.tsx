import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { normalizePhone, formatPhoneDisplay, applyPhoneMask, isValidBrazilianPhone } from '@/lib/phone-utils';

const clientSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(100, 'O nome é muito longo'),
  email: z.string().trim().email('Por favor, insira um e-mail válido').max(255, 'O e-mail é muito longo').optional().or(z.literal('')),
  phone: z.string().trim().min(10, 'Telefone é obrigatório para automação WhatsApp'),
  notes: z.string().trim().max(1000, 'As observações são muito longas').optional().or(z.literal('')),
});

export default function ClientForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing && currentOrganization) fetchClient();
  }, [id, currentOrganization]);

  const fetchClient = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).eq('organization_id', currentOrganization!.id).single();
      if (error) throw error;
      // Exibe telefone formatado para edição
      setFormData({ 
        name: data.name, 
        email: data.email || '', 
        phone: formatPhoneDisplay(data.phone), 
        notes: data.notes || '' 
      });
    } catch (error) {
      console.error('Error fetching client:', error);
      navigate('/clients');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Aplica máscara de telefone automaticamente
    if (name === 'phone') {
      setFormData((prev) => ({ ...prev, [name]: applyPhoneMask(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const checkDuplicatePhone = async (phone: string): Promise<boolean> => {
    if (!phone || !currentOrganization) return false;
    
    const query = supabase
      .from('clients')
      .select('id, name')
      .eq('organization_id', currentOrganization.id)
      .eq('phone', phone);
    
    // Se estiver editando, excluir o cliente atual da busca
    if (isEditing && id) {
      query.neq('id', id);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error) {
      console.error('Error checking duplicate phone:', error);
      return false;
    }
    
    return !!data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validação do schema
    const result = clientSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => { if (err.path[0]) fieldErrors[err.path[0] as string] = err.message; });
      setErrors(fieldErrors);
      return;
    }
    
    // Validação de telefone brasileiro
    if (!isValidBrazilianPhone(formData.phone)) {
      setErrors({ phone: 'Telefone inválido. Use formato: (11) 99999-9999' });
      return;
    }
    
    // Normalizar telefone para E.164
    const normalizedPhone = normalizePhone(formData.phone);
    if (!normalizedPhone) {
      setErrors({ phone: 'Não foi possível processar o telefone' });
      return;
    }
    
    if (!currentOrganization) { 
      toast({ title: 'Erro', description: 'Nenhuma organização selecionada', variant: 'destructive' }); 
      return; 
    }
    
    setIsLoading(true);
    try {
      // Verificar telefone duplicado antes de salvar (usando formato E.164)
      const isDuplicate = await checkDuplicatePhone(normalizedPhone);
      if (isDuplicate) {
        setErrors({ phone: 'Já existe um cliente com este telefone' });
        toast({ 
          title: 'Telefone duplicado', 
          description: 'Já existe um cliente cadastrado com este número de telefone', 
          variant: 'destructive' 
        });
        setIsLoading(false);
        return;
      }

      const clientData = { 
        name: formData.name.trim(), 
        email: formData.email.trim() || null, 
        phone: normalizedPhone, // Salva em E.164
        notes: formData.notes.trim() || null, 
        organization_id: currentOrganization.id 
      };
      
      if (isEditing) {
        const { error } = await supabase.from('clients').update(clientData).eq('id', id);
        if (error) throw error;
        toast({ title: 'Cliente atualizado com sucesso' });
      } else {
        const { error } = await supabase.from('clients').insert(clientData);
        if (error) throw error;
        toast({ title: 'Cliente criado com sucesso' });
      }
      navigate('/clients');
    } catch (error: any) { 
      // Tratar erro de constraint do banco (fallback)
      if (error.message?.includes('clients_organization_phone_unique')) {
        setErrors({ phone: 'Já existe um cliente com este telefone' });
        toast({ title: 'Telefone duplicado', description: 'Já existe um cliente cadastrado com este número de telefone', variant: 'destructive' });
      } else {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' }); 
      }
    } finally { setIsLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link to="/clients"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isEditing ? 'Editar Cliente' : 'Adicionar Cliente'}</h1>
            <p className="text-muted-foreground">{isEditing ? 'Atualizar informações do cliente' : 'Cadastrar um novo cliente'}</p>
          </div>
        </div>
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Informações do Cliente</CardTitle><CardDescription>Preencha os dados de contato do cliente</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="name">Nome *</Label><Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Maria Silva" disabled={isLoading} />{errors.name && <p className="text-sm text-destructive">{errors.name}</p>}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="maria@exemplo.com" disabled={isLoading} />{errors.email && <p className="text-sm text-destructive">{errors.email}</p>}</div>
                <div className="space-y-2"><Label htmlFor="phone">Telefone *</Label><Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} placeholder="(11) 99999-9999" disabled={isLoading} />{errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}</div>
              </div>
              <div className="space-y-2"><Label htmlFor="notes">Observações</Label><Textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Observações adicionais sobre o cliente..." rows={3} disabled={isLoading} />{errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}</div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isLoading}><Save className="h-4 w-4 mr-2" />{isLoading ? 'Salvando...' : isEditing ? 'Atualizar Cliente' : 'Adicionar Cliente'}</Button>
                <Button type="button" variant="outline" onClick={() => navigate('/clients')} disabled={isLoading}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
