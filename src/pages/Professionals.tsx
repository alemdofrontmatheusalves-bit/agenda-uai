import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';
import { usePermissions } from '@/hooks/usePermission';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccessDenied from '@/components/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, UserCircle } from 'lucide-react';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  is_active: boolean;
}

export default function Professionals() {
  const { currentOrganization, currentRole } = useOrganization();
  const permissions = usePermissions(['professionals_view', 'professionals_create', 'professionals_edit']);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const canView = permissions.professionals_view;
  const canCreate = permissions.professionals_create;
  const canEdit = permissions.professionals_edit;

  const fetchProfessionals = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase.from('professionals').select('*').eq('organization_id', currentOrganization.id).order('name');
      if (error) throw error;
      setProfessionals(data || []);
    } catch (error) {
      console.error('Error fetching professionals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, [currentOrganization]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('professionals').delete().eq('id', deleteId);
      if (error) throw error;
      setProfessionals(professionals.filter((p) => p.id !== deleteId));
      toast({ title: 'Profissional excluído com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir profissional', description: error.message, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const filteredProfessionals = professionals.filter((prof) => prof.name.toLowerCase().includes(searchQuery.toLowerCase()) || prof.specialty?.toLowerCase().includes(searchQuery.toLowerCase()));
  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);

  // Check permission after loading
  if (!loading && !canView) {
    return (
      <DashboardLayout>
        <AccessDenied message="Você não tem permissão para ver profissionais." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
            <p className="text-muted-foreground">Gerencie sua equipe</p>
          </div>
          {canCreate && (
            <Button asChild>
              <Link to="/professionals/new">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Profissional
              </Link>
            </Button>
          )}
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar profissionais..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredProfessionals.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="text-center py-12">
              <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">{searchQuery ? 'Nenhum profissional encontrado' : 'Nenhum profissional ainda'}</h3>
              <p className="text-muted-foreground mb-4">{searchQuery ? 'Tente ajustar sua busca' : 'Adicione o primeiro membro da equipe'}</p>
              {!searchQuery && canCreate && (
                <Button asChild>
                  <Link to="/professionals/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Profissional
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProfessionals.map((professional) => (
              <Card key={professional.id} className="shadow-soft hover:shadow-elevated transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(professional.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">{professional.name}</h3>
                        {professional.specialty && <p className="text-sm text-muted-foreground">{professional.specialty}</p>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem asChild>
                            <Link to={`/professionals/${professional.id}/edit`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {currentRole === 'owner' && (
                          <DropdownMenuItem onClick={() => setDeleteId(professional.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 space-y-2">
                    {professional.email && <p className="text-sm text-muted-foreground truncate">{professional.email}</p>}
                    {professional.phone && <p className="text-sm text-muted-foreground">{professional.phone}</p>}
                  </div>
                  <div className="mt-4">
                    <Badge variant={professional.is_active ? 'default' : 'secondary'}>{professional.is_active ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Profissional</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza de que deseja excluir este profissional? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
