import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/organization-context';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BusinessHoursSettings from '@/components/settings/BusinessHoursSettings';
import ExceptionsCalendar from '@/components/settings/ExceptionsCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Save, Building2, User, LogOut, Camera, Loader2, Shield, Trash2, AlertTriangle } from 'lucide-react';

const organizationSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(100, 'O nome é muito longo'),
  phone: z.string().trim().max(20, 'O número de telefone é muito longo').optional().or(z.literal('')),
  email: z.string().trim().email('Por favor, insira um e-mail válido').max(255, 'O e-mail é muito longo').optional().or(z.literal('')),
  address: z.string().trim().max(500, 'O endereço é muito longo').optional().or(z.literal('')),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function Settings() {
  const { user, signOut } = useAuth();
  const { currentOrganization, currentRole, memberships, refetchMemberships, setCurrentOrganization } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [orgData, setOrgData] = useState({
    name: currentOrganization?.name || '',
    phone: currentOrganization?.phone || '',
    email: currentOrganization?.email || '',
    address: currentOrganization?.address || '',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Update orgData when currentOrganization changes
  useEffect(() => {
    if (currentOrganization) {
      setOrgData({
        name: currentOrganization.name || '',
        phone: currentOrganization.phone || '',
        email: currentOrganization.email || '',
        address: currentOrganization.address || '',
      });
    }
  }, [currentOrganization]);

  const handleOrgInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setOrgData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: newAvatarUrl },
      });

      if (authError) throw authError;

      setAvatarUrl(newAvatarUrl);
      toast({ title: 'Avatar atualizado com sucesso!' });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Erro ao atualizar avatar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSavingProfile(true);

    try {
      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (authError) throw authError;

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast({ title: 'Perfil atualizado com sucesso!' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});

    const result = passwordSchema.safeParse(passwordData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setPasswordErrors(fieldErrors);
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      setPasswordData({ newPassword: '', confirmPassword: '' });
      toast({ title: 'Senha alterada com sucesso!' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (currentRole !== 'owner') {
      toast({
        title: 'Permissão negada',
        description: 'Apenas proprietários podem atualizar as configurações da organização',
        variant: 'destructive',
      });
      return;
    }

    const result = organizationSchema.safeParse(orgData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!currentOrganization) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgData.name.trim(),
          phone: orgData.phone.trim() || null,
          email: orgData.email.trim() || null,
          address: orgData.address.trim() || null,
        })
        .eq('id', currentOrganization.id);

      if (error) throw error;

      await refetchMemberships();
      toast({ title: 'Configurações da organização salvas' });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!currentOrganization || currentRole !== 'owner') return;

    if (deleteConfirmName !== currentOrganization.name) {
      toast({
        title: 'Nome incorreto',
        description: 'Digite o nome exato do salão para confirmar a exclusão.',
        variant: 'destructive',
      });
      return;
    }

    // Check if user has other organizations
    const otherOrgs = memberships.filter(m => m.organization.id !== currentOrganization.id);
    
    setIsDeletingOrg(true);

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', currentOrganization.id);

      if (error) throw error;

      toast({ title: 'Salão excluído com sucesso' });

      // Switch to another org or redirect to onboarding
      if (otherOrgs.length > 0) {
        setCurrentOrganization(otherOrgs[0].organization);
        await refetchMemberships();
        navigate('/dashboard');
      } else {
        await refetchMemberships();
        navigate('/onboarding');
      }
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'Erro ao excluir salão',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeletingOrg(false);
      setDeleteConfirmName('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getUserInitials = () => {
    if (fullName) {
      return fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta e organização</p>
        </div>

        {/* Account Section */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Conta
            </CardTitle>
            <CardDescription>Suas informações pessoais da conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div>
                <p className="font-medium text-foreground">Foto de Perfil</p>
                <p className="text-sm text-muted-foreground">
                  Clique na foto para alterar. PNG, JPG até 2MB.
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email || ''} disabled />
              <p className="text-xs text-muted-foreground">
                Entre em contato com o suporte para alterar seu endereço de e-mail
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <Button 
              onClick={handleSaveProfile} 
              disabled={isSavingProfile}
              variant="outline"
            >
              {isSavingProfile ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Perfil
            </Button>

            <Separator />

            <Button variant="outline" onClick={handleSignOut} className="w-full sm:w-auto">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Segurança
            </CardTitle>
            <CardDescription>Altere sua senha de acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Digite a senha novamente"
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Alterar Senha
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Organization Section */}
        {currentOrganization && (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Organização
              </CardTitle>
              <CardDescription>
                {currentRole === 'owner'
                  ? 'Gerencie as configurações do seu salão'
                  : 'Veja as informações do seu salão (somente leitura)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveOrganization} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Salão</Label>
                  <Input
                    id="name"
                    name="name"
                    value={orgData.name}
                    onChange={handleOrgInputChange}
                    disabled={isLoading || currentRole !== 'owner'}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={orgData.phone}
                      onChange={handleOrgInputChange}
                      disabled={isLoading || currentRole !== 'owner'}
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={orgData.email}
                      onChange={handleOrgInputChange}
                      disabled={isLoading || currentRole !== 'owner'}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={orgData.address}
                    onChange={handleOrgInputChange}
                    rows={2}
                    disabled={isLoading || currentRole !== 'owner'}
                  />
                  {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                </div>

                {currentRole === 'owner' && (
                  <Button type="submit" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Business Hours & Booking Settings - Only for Owners */}
        {currentOrganization && currentRole === 'owner' && (
          <BusinessHoursSettings />
        )}

        {/* Exceptions Calendar - Only for Owners */}
        {currentOrganization && currentRole === 'owner' && (
          <ExceptionsCalendar />
        )}

        {/* Danger Zone */}
        {currentOrganization && currentRole === 'owner' && (
          <Card className="shadow-soft border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Zona de Perigo
              </CardTitle>
              <CardDescription>
                Ações irreversíveis para sua organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-foreground">Excluir Salão</h4>
                  <p className="text-sm text-muted-foreground">
                    Uma vez excluído, todos os dados do salão serão permanentemente removidos.
                    Esta ação não pode ser desfeita.
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Salão
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p>
                          Esta ação não pode ser desfeita. Isso irá excluir permanentemente o salão
                          <strong> {currentOrganization.name}</strong> e todos os dados associados:
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          <li>Todos os clientes</li>
                          <li>Todos os agendamentos</li>
                          <li>Todos os serviços</li>
                          <li>Todos os profissionais</li>
                          <li>Todo o histórico financeiro</li>
                          <li>Todo o estoque</li>
                        </ul>
                        <div className="pt-2">
                          <Label htmlFor="confirmDelete">
                            Digite <strong>{currentOrganization.name}</strong> para confirmar:
                          </Label>
                          <Input
                            id="confirmDelete"
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            placeholder="Nome do salão"
                            className="mt-2"
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmName('')}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteOrganization}
                        disabled={isDeletingOrg || deleteConfirmName !== currentOrganization.name}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeletingOrg ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Excluir Permanentemente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}