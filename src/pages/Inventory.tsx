import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '@/lib/organization-context';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccessDenied from '@/components/AccessDenied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, AlertTriangle, Edit, Trash2 } from 'lucide-react';

interface InventoryProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit_cost: number;
}

export default function Inventory() {
  const { currentOrganization } = useOrganization();
  const canView = usePermission('inventory_view');
  const canCreate = usePermission('inventory_create');
  const canEdit = usePermission('inventory_edit');
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<InventoryProduct | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    min_quantity: 5,
    unit_cost: 0,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentOrganization) {
      fetchProducts();
    }
  }, [currentOrganization]);

  const fetchProducts = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_products')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('name');

    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;

    if (editingProduct) {
      const { error } = await supabase
        .from('inventory_products')
        .update({
          name: formData.name,
          category: formData.category,
          quantity: formData.quantity,
          min_quantity: formData.min_quantity,
          unit_cost: formData.unit_cost,
        })
        .eq('id', editingProduct.id);

      if (error) {
        toast({ title: 'Erro ao atualizar produto', variant: 'destructive' });
      } else {
        toast({ title: 'Produto atualizado com sucesso' });
        fetchProducts();
      }
    } else {
      const { error } = await supabase.from('inventory_products').insert({
        organization_id: currentOrganization.id,
        name: formData.name,
        category: formData.category,
        quantity: formData.quantity,
        min_quantity: formData.min_quantity,
        unit_cost: formData.unit_cost,
      });

      if (error) {
        toast({ title: 'Erro ao criar produto', variant: 'destructive' });
      } else {
        toast({ title: 'Produto adicionado com sucesso' });
        fetchProducts();
      }
    }

    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (product: InventoryProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      quantity: product.quantity,
      min_quantity: product.min_quantity,
      unit_cost: product.unit_cost,
    });
    setDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;

    const { error } = await supabase.from('inventory_products').delete().eq('id', deletingProduct.id);

    if (error) {
      toast({ title: 'Erro ao excluir produto', variant: 'destructive' });
    } else {
      toast({ title: 'Produto excluído com sucesso' });
      fetchProducts();
    }
    setDeletingProduct(null);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: '',
      quantity: 0,
      min_quantity: 5,
      unit_cost: 0,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatus = (product: InventoryProduct) => {
    if (product.quantity <= product.min_quantity) {
      return { label: 'Baixo estoque', variant: 'destructive' as const };
    }
    return { label: 'Normal', variant: 'secondary' as const };
  };

  const totalValue = products.reduce((acc, p) => acc + p.quantity * p.unit_cost, 0);
  const lowStockCount = products.filter((p) => p.quantity <= p.min_quantity).length;

  if (!canView) {
    return (
      <DashboardLayout>
        <AccessDenied message="Você não tem permissão para visualizar o estoque." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
            <p className="text-muted-foreground">Gerencie os produtos do salão</p>
          </div>
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Produto</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">Quantidade</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="min_quantity">Quantidade Mínima</Label>
                      <Input
                        id="min_quantity"
                        type="number"
                        min="0"
                        value={formData.min_quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="unit_cost">Custo Unitário (R$)</Label>
                    <Input
                      id="unit_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_cost}
                      onChange={(e) =>
                        setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">{editingProduct ? 'Salvar' : 'Adicionar'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            </CardContent>
          </Card>
          <Card className={lowStockCount > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Estoque</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{lowStockCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum produto cadastrado ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Custo Unit.</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const status = getStatus(product);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>{product.min_quantity}</TableCell>
                        <TableCell>{formatCurrency(product.unit_cost)}</TableCell>
                        <TableCell>
                          {formatCurrency(product.quantity * product.unit_cost)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingProduct(product)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o produto "{product.name}"?
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setDeletingProduct(null)}>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDeleteConfirm}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}