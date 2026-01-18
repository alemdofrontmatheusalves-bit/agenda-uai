import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Scissors, X, AlertCircle } from 'lucide-react';
import type { PermissionType } from '@/hooks/usePermission';

interface InvitationData {
  id: string;
  organization_id: string;
  email: string;
  role: 'owner' | 'staff';
  permissions: PermissionType[];
  expires_at: string;
  token: string;
  organization: {
    name: string;
  };
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signIn, signUp } = useAuth();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Auth form state
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInvitation();
    }
  }, [token]);

  useEffect(() => {
    // If user is logged in and invitation is loaded, try to accept
    if (user && invitation && !accepting) {
      handleAcceptInvitation();
    }
  }, [user, invitation]);

  const fetchInvitation = async () => {
    if (!token) return;

    setLoading(true);
    try {
      // Search by token field instead of id
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          id,
          organization_id,
          email,
          role,
          permissions,
          expires_at,
          token,
          organization:organizations(name)
        `)
        .eq('token', token)
        .is('accepted_at', null)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Convite não encontrado ou já utilizado.');
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError('Este convite expirou.');
        return;
      }

      setInvitation({
        ...data,
        organization: data.organization as { name: string },
      } as InvitationData);
      setEmail(data.email);
    } catch (error: any) {
      console.error('Error fetching invitation:', error);
      setError('Não foi possível carregar o convite.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation || !user) return;

    // Check if email matches
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setError(`Este convite foi enviado para ${invitation.email}. Faça login com essa conta para aceitar.`);
      return;
    }

    setAccepting(true);
    try {
      // Create membership
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .insert({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
        })
        .select()
        .single();

      if (membershipError) {
        // Check if already a member
        if (membershipError.code === '23505') {
          // Update invitation as accepted anyway
          await supabase
            .from('invitations')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', invitation.id);

          toast({
            title: 'Você já é membro',
            description: 'Você já faz parte desta equipe.',
          });
          navigate('/dashboard');
          return;
        }
        throw membershipError;
      }

      // Add permissions
      if (invitation.permissions.length > 0) {
        const permissionsToInsert = invitation.permissions.map((permission) => ({
          membership_id: membership.id,
          permission,
        }));

        const { error: permError } = await supabase
          .from('member_permissions')
          .insert(permissionsToInsert);

        if (permError) {
          console.error('Error adding permissions:', permError);
        }
      }

      // Mark invitation as accepted
      await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      toast({
        title: 'Convite aceito!',
        description: `Você agora faz parte da equipe ${invitation.organization.name}.`,
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível aceitar o convite.',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-xl mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link to="/">Voltar ao Início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 animate-pulse">
              <Scissors className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle>Aceitando convite...</CardTitle>
            <CardDescription>Aguarde enquanto configuramos seu acesso.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // If user is logged in but email doesn't match
  if (user && invitation && user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Email Diferente</CardTitle>
            <CardDescription>
              Este convite foi enviado para <strong>{invitation.email}</strong>.
              Você está logado como <strong>{user.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              Sair e usar outra conta
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link to="/dashboard">Ir para o Painel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show auth form for non-logged users
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
            <Scissors className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle>Convite para {invitation?.organization.name}</CardTitle>
          <CardDescription>
            Você foi convidado para fazer parte da equipe. {isLogin ? 'Faça login' : 'Crie sua conta'} para aceitar o convite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled
              />
              <p className="text-xs text-muted-foreground">
                O email está fixado no convite
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Processando...' : isLogin ? 'Entrar' : 'Criar Conta'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin ? 'Criar conta' : 'Fazer login'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
