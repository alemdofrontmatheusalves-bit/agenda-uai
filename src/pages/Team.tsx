import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccessDenied from '@/components/AccessDenied';
import { useOrganization } from '@/lib/organization-context';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Clock, Trash2, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PermissionType } from '@/hooks/usePermission';

interface Member {
  id: string;
  role: 'owner' | 'staff';
  user_id: string;
  profile: {
    email: string;
    full_name: string | null;
  };
  permissions: PermissionType[];
}

interface Invitation {
  id: string;
  email: string;
  role: 'owner' | 'staff';
  permissions: PermissionType[];
  expires_at: string;
  created_at: string;
  token: string;
}

const PERMISSION_GROUPS = [
  {
    label: 'Agendamentos',
    permissions: [
      { key: 'appointments_view' as PermissionType, label: 'Ver agendamentos' },
      { key: 'appointments_create' as PermissionType, label: 'Criar agendamentos' },
      { key: 'appointments_edit' as PermissionType, label: 'Editar agendamentos' },
    ],
  },
  {
    label: 'Clientes',
    permissions: [
      { key: 'clients_view' as PermissionType, label: 'Ver clientes' },
      { key: 'clients_create' as PermissionType, label: 'Cadastrar clientes' },
      { key: 'clients_edit' as PermissionType, label: 'Editar clientes' },
    ],
  },
  {
    label: 'Profissionais',
    permissions: [
      { key: 'professionals_view' as PermissionType, label: 'Ver profissionais' },
      { key: 'professionals_create' as PermissionType, label: 'Cadastrar profissionais' },
      { key: 'professionals_edit' as PermissionType, label: 'Editar profissionais' },
    ],
  },
  {
    label: 'Serviços',
    permissions: [
      { key: 'services_view' as PermissionType, label: 'Ver serviços' },
      { key: 'services_create' as PermissionType, label: 'Cadastrar serviços' },
      { key: 'services_edit' as PermissionType, label: 'Editar serviços' },
    ],
  },
  {
    label: 'Outros',
    permissions: [
      { key: 'analytics_view' as PermissionType, label: 'Ver análises' },
      { key: 'team_view' as PermissionType, label: 'Ver equipe' },
    ],
  },
];

export default function Team() {
  const { toast } = useToast();
  const { currentOrganization, currentRole } = useOrganization();
  const canViewTeam = usePermission('team_view');

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<PermissionType[]>([]);
  const [inviting, setInviting] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'member' | 'invitation'; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentRole === 'owner';

  useEffect(() => {
    if (currentOrganization) {
      fetchData();
    }
  }, [currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      // Fetch members with their profiles
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('memberships')
        .select(`
          id,
          role,
          user_id
        `)
        .eq('organization_id', currentOrganization.id);

      if (membershipsError) throw membershipsError;

      // Fetch permissions and profiles for each member
      const membersWithPermissions: Member[] = await Promise.all(
        (membershipsData || []).map(async (m: any) => {
          // Fetch permissions
          const { data: perms } = await supabase
            .from('member_permissions')
            .select('permission')
            .eq('membership_id', m.id);

          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', m.user_id)
            .single();

          return {
            id: m.id,
            role: m.role,
            user_id: m.user_id,
            profile: profile || { email: '', full_name: null },
            permissions: (perms || []).map((p: any) => p.permission as PermissionType),
          };
        })
      );

      setMembers(membersWithPermissions);

      // Fetch pending invitations
      if (isOwner) {
        const { data: invitationsData, error: invitationsError } = await supabase
          .from('invitations')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString());

        if (invitationsError) throw invitationsError;

        setInvitations(
          (invitationsData || []).map((inv: any) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            permissions: inv.permissions || [],
            expires_at: inv.expires_at,
            created_at: inv.created_at,
            token: inv.token,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados da equipe.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!currentOrganization || !inviteEmail.trim()) return;

    setInviting(true);
    try {
      // Generate a unique token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('invitations').insert({
        organization_id: currentOrganization.id,
        email: inviteEmail.trim().toLowerCase(),
        role: 'staff',
        permissions: invitePermissions,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: user.user.id,
      });

      if (error) throw error;

      toast({
        title: 'Convite enviado',
        description: `Um convite foi criado para ${inviteEmail}. Compartilhe o link de convite com o funcionário.`,
      });

      // Reset form and close modal
      setInviteEmail('');
      setInvitePermissions([]);
      setInviteOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar o convite.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      if (deleteTarget.type === 'member') {
        const { error } = await supabase
          .from('memberships')
          .delete()
          .eq('id', deleteTarget.id);

        if (error) throw error;

        toast({ title: 'Membro removido', description: 'O membro foi removido da equipe.' });
      } else {
        const { error } = await supabase
          .from('invitations')
          .delete()
          .eq('id', deleteTarget.id);

        if (error) throw error;

        toast({ title: 'Convite cancelado', description: 'O convite foi cancelado.' });
      }

      setDeleteTarget(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível realizar a operação.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const togglePermission = (permission: PermissionType) => {
    setInvitePermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const getInviteLink = (token: string) => {
    return `${window.location.origin}/invite/${token}`;
  };

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(getInviteLink(token));
    toast({ title: 'Link copiado', description: 'O link de convite foi copiado para a área de transferência.' });
  };

  if (!currentOrganization) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Check permission after loading
  if (!loading && !canViewTeam) {
    return (
      <DashboardLayout>
        <AccessDenied message="Você não tem permissão para ver a equipe." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipe</h1>
            <p className="text-muted-foreground">
              Gerencie os membros e permissões do seu salão
            </p>
          </div>
          {isOwner && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar Membro
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Convidar Novo Membro</DialogTitle>
                  <DialogDescription>
                    Envie um convite para adicionar um novo funcionário à sua equipe.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="funcionario@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Permissões</Label>
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.label} className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
                        <div className="space-y-2 pl-2">
                          {group.permissions.map((perm) => (
                            <div key={perm.key} className="flex items-center space-x-2">
                              <Checkbox
                                id={perm.key}
                                checked={invitePermissions.includes(perm.key)}
                                onCheckedChange={() => togglePermission(perm.key)}
                              />
                              <Label htmlFor={perm.key} className="text-sm font-normal cursor-pointer">
                                {perm.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? 'Enviando...' : 'Enviar Convite'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Members Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Membros da Equipe
            </CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? 'membro' : 'membros'} na equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Permissões</TableHead>
                    {isOwner && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.profile.full_name || 'Sem nome'}
                      </TableCell>
                      <TableCell>{member.profile.email}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                          {member.role === 'owner' ? 'Proprietário' : 'Funcionário'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.role === 'owner' ? (
                          <span className="text-sm text-muted-foreground">Todas</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {member.permissions.length} permissões
                          </span>
                        )}
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          {member.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget({ type: 'member', id: member.id })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations Card */}
        {isOwner && invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Convites Pendentes
              </CardTitle>
              <CardDescription>
                {invitations.length} {invitations.length === 1 ? 'convite pendente' : 'convites pendentes'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {invitation.permissions.length} permissões
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(invitation.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invitation.token)}
                          >
                            Copiar Link
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget({ type: 'invitation', id: invitation.id })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'member' ? 'Remover Membro' : 'Cancelar Convite'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'member'
                ? 'Tem certeza que deseja remover este membro da equipe? Esta ação não pode ser desfeita.'
                : 'Tem certeza que deseja cancelar este convite?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Processando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
