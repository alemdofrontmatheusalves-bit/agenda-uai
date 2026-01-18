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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';

const serviceSchema = z.object({ name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(100, 'O nome é muito longo'), description: z.string().trim().max(500, 'A descrição é muito longa').optional().or(z.literal('')), duration_minutes: z.number().min(5, 'A duração deve ser de pelo menos 5 minutos').max(480, 'A duração não pode exceder 8 horas'), price: z.number().min(0, 'O preço não pode ser negativo'), is_active: z.boolean() });

export default function ServiceForm() {
  const { id } = useParams(); const isEditing = !!id; const navigate = useNavigate(); const { currentOrganization } = useOrganization(); const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', duration_minutes: 30, price: 0, is_active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (isEditing && currentOrganization) fetchService(); }, [id, currentOrganization]);
  const fetchService = async () => { try { const { data, error } = await supabase.from('services').select('*').eq('id', id).eq('organization_id', currentOrganization!.id).single(); if (error) throw error; setFormData({ name: data.name, description: data.description || '', duration_minutes: data.duration_minutes, price: parseFloat(String(data.price)), is_active: data.is_active }); } catch (error) { console.error('Error fetching service:', error); navigate('/services'); } };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const { name, value, type } = e.target; setFormData((prev) => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value })); setErrors((prev) => ({ ...prev, [name]: '' })); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErrors({});
    const result = serviceSchema.safeParse(formData);
    if (!result.success) { const fieldErrors: Record<string, string> = {}; result.error.errors.forEach((err) => { if (err.path[0]) fieldErrors[err.path[0] as string] = err.message; }); setErrors(fieldErrors); return; }
    if (!currentOrganization) { toast({ title: 'Erro', description: 'Nenhuma organização selecionada', variant: 'destructive' }); return; }
    setIsLoading(true);
    try {
      const serviceData = { name: formData.name.trim(), description: formData.description.trim() || null, duration_minutes: formData.duration_minutes, price: formData.price, is_active: formData.is_active, organization_id: currentOrganization.id };
      if (isEditing) { const { error } = await supabase.from('services').update(serviceData).eq('id', id); if (error) throw error; toast({ title: 'Serviço atualizado com sucesso' }); }
      else { const { error } = await supabase.from('services').insert(serviceData); if (error) throw error; toast({ title: 'Serviço criado com sucesso' }); }
      navigate('/services');
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); } finally { setIsLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4"><Button variant="ghost" size="icon" asChild><Link to="/services"><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-2xl font-bold text-foreground">{isEditing ? 'Editar Serviço' : 'Adicionar Serviço'}</h1><p className="text-muted-foreground">{isEditing ? 'Atualizar detalhes do serviço' : 'Criar uma nova oferta de serviço'}</p></div></div>
        <Card className="shadow-soft"><CardHeader><CardTitle>Detalhes do Serviço</CardTitle><CardDescription>Defina o nome, duração e preço do serviço</CardDescription></CardHeader>
          <CardContent><form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="name">Nome do Serviço *</Label><Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Corte, Hidratação, Massagem, etc." disabled={isLoading} />{errors.name && <p className="text-sm text-destructive">{errors.name}</p>}</div>
            <div className="space-y-2"><Label htmlFor="description">Descrição</Label><Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Descreva o que está incluído neste serviço..." rows={3} disabled={isLoading} />{errors.description && <p className="text-sm text-destructive">{errors.description}</p>}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="duration_minutes">Duração (minutos) *</Label><Input id="duration_minutes" name="duration_minutes" type="number" min={5} max={480} step={5} value={formData.duration_minutes} onChange={handleInputChange} disabled={isLoading} />{errors.duration_minutes && <p className="text-sm text-destructive">{errors.duration_minutes}</p>}</div><div className="space-y-2"><Label htmlFor="price">Preço (R$) *</Label><Input id="price" name="price" type="number" min={0} step={0.01} value={formData.price} onChange={handleInputChange} disabled={isLoading} />{errors.price && <p className="text-sm text-destructive">{errors.price}</p>}</div></div>
            <div className="flex items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><Label htmlFor="is_active">Status Ativo</Label><p className="text-sm text-muted-foreground">Serviços inativos não aparecem nas opções de agendamento</p></div><Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))} disabled={isLoading} /></div>
            <div className="flex gap-3 pt-4"><Button type="submit" disabled={isLoading}><Save className="h-4 w-4 mr-2" />{isLoading ? 'Salvando...' : isEditing ? 'Atualizar Serviço' : 'Adicionar Serviço'}</Button><Button type="button" variant="outline" onClick={() => navigate('/services')} disabled={isLoading}>Cancelar</Button></div>
          </form></CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
