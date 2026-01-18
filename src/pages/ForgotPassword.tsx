import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Scissors, ArrowLeft, Mail } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().trim().email('Por favor, insira um e-mail válido'),
});

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    const { error: resetError } = await resetPassword(email);
    setIsLoading(false);

    if (resetError) {
      toast({
        title: 'Erro',
        description: resetError.message,
        variant: 'destructive',
      });
    } else {
      setIsSuccess(true);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-8">
      <Card className="w-full max-w-md shadow-elevated border-0">
        <CardHeader className="space-y-1 text-center">
          <Link to="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
              <Scissors className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-semibold">Beleza</span>
          </Link>
          <CardTitle className="text-2xl">Redefinir sua senha</CardTitle>
          <CardDescription>
            {isSuccess
              ? 'Verifique seu e-mail para o link de redefinição'
              : 'Digite seu e-mail e enviaremos um link de redefinição'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <Mail className="h-6 w-6 text-accent-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de redefinição de senha para <strong>{email}</strong>. 
                Por favor, verifique sua caixa de entrada e siga as instruções.
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link to="/auth">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link to="/auth">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
