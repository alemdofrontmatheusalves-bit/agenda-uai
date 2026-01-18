import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/organization-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Scissors, Building2, MapPin, Phone, Mail, ArrowRight } from 'lucide-react';

const organizationSchema = z.object({
  name: z.string().trim().min(2, 'O nome do salão deve ter pelo menos 2 caracteres').max(100, 'O nome é muito longo'),
  phone: z.string().trim().max(20, 'O número de telefone é muito longo').optional().or(z.literal('')),
  email: z.string().trim().email('Por favor, insira um e-mail válido').max(255, 'O e-mail é muito longo').optional().or(z.literal('')),
  address: z.string().trim().max(500, 'O endereço é muito longo').optional().or(z.literal('')),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) + '-' + Math.random().toString(36).substring(2, 8);
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user } = useAuth();
  const { memberships, initialized, refetchMemberships } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect to dashboard if user already has memberships
  useEffect(() => {
    if (initialized && memberships.length > 0) {
      navigate('/dashboard');
    }
  }, [initialized, memberships, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = organizationSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para criar um salão.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create organization
      const organizationId = crypto.randomUUID();
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          id: organizationId,
          name: formData.name.trim(),
          slug: generateSlug(formData.name),
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
        });

      if (orgError) throw orgError;

      // Create membership as owner
      const { error: membershipError } = await supabase
        .from('memberships')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          role: 'owner',
        });

      if (membershipError) throw membershipError;

      await refetchMemberships();

      toast({
        title: 'Salão criado!',
        description: `Bem-vindo ao ${formData.name}. Vamos começar.`,
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao criar salão. Por favor, tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
              <Scissors className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Configure seu salão</h1>
          <p className="text-muted-foreground">
            Conte-nos sobre seu negócio para personalizarmos sua experiência.
          </p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Dados do Salão
            </CardTitle>
            <CardDescription>
              Essas informações ajudarão a identificar seu salão no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Salão *</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Studio Bella Beleza"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="contato@salao.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Endereço
                </Label>
                <Textarea
                  id="address"
                  name="address"
                  placeholder="Rua das Flores, 123, Sala 100, São Paulo, SP"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  rows={2}
                />
                {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? 'Criando...' : 'Criar Salão'}
                {!isLoading && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
