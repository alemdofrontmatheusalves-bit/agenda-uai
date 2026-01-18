import { useState, useEffect } from 'react';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { DollarSign, TrendingUp, TrendingDown, MinusCircle, Plus, History, RotateCcw } from 'lucide-react';

interface ClientWithBalance {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function ClientFinances() {
  const { currentOrganization } = useOrganization();
  const canView = usePermission('finances_view');
  const canCreate = usePermission('finances_create');
  const [clients, setClients] = useState<ClientWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionForm, setTransactionForm] = useState({
    type: 'payment' as 'credit' | 'debit' | 'payment' | 'refund',
    amount: 0,
    description: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    if (currentOrganization) {
      fetchClientsWithBalances();
    }
  }, [currentOrganization]);

  const fetchClientsWithBalances = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    // Fetch clients
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, phone')
      .eq('organization_id', currentOrganization.id)
      .order('name');

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      setLoading(false);
      return;
    }

    // Fetch all transactions
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('client_transactions')
      .select('client_id, type, amount')
      .eq('organization_id', currentOrganization.id);

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
    }

    // Calculate balances
    // refund = devolução de dinheiro ao cliente (aumenta saldo porque cliente recebeu de volta)
    const clientsWithBalances = (clientsData || []).map((client) => {
      const clientTransactions = (transactionsData || []).filter(
        (t) => t.client_id === client.id
      );
      const balance = clientTransactions.reduce((acc, t) => {
        if (t.type === 'credit' || t.type === 'payment') {
          return acc + Number(t.amount);
        } else if (t.type === 'debit') {
          return acc - Number(t.amount);
        } else if (t.type === 'refund') {
          // Estorno: cliente recebeu dinheiro de volta, então aumenta o saldo dele
          return acc + Number(t.amount);
        }
        return acc;
      }, 0);
      return { ...client, balance };
    });

    setClients(clientsWithBalances);
    setLoading(false);
  };

  const fetchClientTransactions = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_transactions')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTransactions(data || []);
    }
  };

  const handleOpenTransactionDialog = (client: ClientWithBalance) => {
    setSelectedClient(client);
    setTransactionForm({ type: 'payment', amount: 0, description: '' });
    setTransactionDialogOpen(true);
  };

  const handleOpenHistory = async (client: ClientWithBalance) => {
    setSelectedClient(client);
    await fetchClientTransactions(client.id);
    setHistoryDialogOpen(true);
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !selectedClient) return;

    // Validação: estorno requer descrição
    if (transactionForm.type === 'refund' && !transactionForm.description.trim()) {
      toast({ title: 'Descrição obrigatória para estornos', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('client_transactions').insert({
      organization_id: currentOrganization.id,
      client_id: selectedClient.id,
      type: transactionForm.type,
      amount: transactionForm.amount,
      description: transactionForm.description || null,
    });

    if (error) {
      toast({ title: 'Erro ao registrar transação', variant: 'destructive' });
    } else {
      const message = transactionForm.type === 'refund' 
        ? 'Estorno registrado com sucesso' 
        : 'Transação registrada com sucesso';
      toast({ title: message });
      fetchClientsWithBalances();
      setTransactionDialogOpen(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatus = (balance: number) => {
    if (balance > 0) {
      return { label: 'Com crédito', variant: 'default' as const, icon: TrendingUp };
    } else if (balance < 0) {
      return { label: 'Em dívida', variant: 'destructive' as const, icon: TrendingDown };
    }
    return { label: 'Em dia', variant: 'secondary' as const, icon: MinusCircle };
  };

  const totalCredit = clients.filter((c) => c.balance > 0).reduce((acc, c) => acc + c.balance, 0);
  const totalDebt = clients.filter((c) => c.balance < 0).reduce((acc, c) => acc + Math.abs(c.balance), 0);
  const clientsInDebt = clients.filter((c) => c.balance < 0).length;
  const clientsWithCredit = clients.filter((c) => c.balance > 0).length;

  if (!canView) {
    return (
      <DashboardLayout>
        <AccessDenied message="Você não tem permissão para visualizar o financeiro." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro de Clientes</h1>
          <p className="text-muted-foreground">Controle de saldos e pagamentos</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Clientes em Dia</CardTitle>
              <MinusCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter((c) => c.balance === 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Com Crédito</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientsWithCredit}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalCredit)}</p>
            </CardContent>
          </Card>
          <Card className={clientsInDebt > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Dívida</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{clientsInDebt}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalDebt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCredit - totalDebt)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum cliente cadastrado ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const status = getStatus(client.balance);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {client.email && <div>{client.email}</div>}
                            {client.phone && (
                              <div className="text-muted-foreground">{client.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className={
                            client.balance > 0
                              ? 'text-primary'
                              : client.balance < 0
                              ? 'text-destructive'
                              : ''
                          }
                        >
                          {formatCurrency(client.balance)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canCreate && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenTransactionDialog(client)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Transação
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenHistory(client)}
                            >
                              <History className="h-4 w-4 mr-1" />
                              Histórico
                            </Button>
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

        {/* Transaction Dialog */}
        <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Transação - {selectedClient?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitTransaction} className="space-y-4">
              <div>
                <Label>Tipo de Transação</Label>
                <Select
                  value={transactionForm.type}
                  onValueChange={(value: 'credit' | 'debit' | 'payment' | 'refund') =>
                    setTransactionForm({ ...transactionForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Pagamento (adiciona crédito)</SelectItem>
                    <SelectItem value="credit">Crédito manual</SelectItem>
                    <SelectItem value="debit">Débito (adiciona dívida)</SelectItem>
                    <SelectItem value="refund">
                      <span className="flex items-center gap-2">
                        <RotateCcw className="h-3 w-3" />
                        Estorno/Reembolso (devolução ao cliente)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {transactionForm.type === 'refund' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estorno registra uma devolução de valor ao cliente. O valor será subtraído do "Recebido" nas análises.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={transactionForm.amount}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">
                  Descrição {transactionForm.type === 'refund' ? '(obrigatório)' : '(opcional)'}
                </Label>
                <Input
                  id="description"
                  value={transactionForm.description}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, description: e.target.value })
                  }
                  required={transactionForm.type === 'refund'}
                  placeholder={transactionForm.type === 'refund' ? 'Motivo do estorno...' : ''}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransactionDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Registrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Histórico - {selectedClient?.name}</DialogTitle>
            </DialogHeader>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma transação registrada.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const isRefund = t.type === 'refund';
                    const isDebit = t.type === 'debit';
                    return (
                      <TableRow key={t.id} className={isRefund ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                        <TableCell>
                          {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isDebit ? 'destructive' : isRefund ? 'outline' : 'default'}
                            className={isRefund ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''}
                          >
                            {isRefund && <RotateCcw className="h-3 w-3 mr-1" />}
                            {t.type === 'payment'
                              ? 'Pagamento'
                              : t.type === 'credit'
                              ? 'Crédito'
                              : isRefund
                              ? 'Estorno'
                              : 'Débito'}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={isDebit ? 'text-destructive' : isRefund ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}
                        >
                          {isDebit ? '-' : '+'}
                          {formatCurrency(Number(t.amount))}
                        </TableCell>
                        <TableCell>{t.description || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
