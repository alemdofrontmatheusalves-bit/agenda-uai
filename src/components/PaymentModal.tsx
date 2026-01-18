import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, CreditCard, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (paymentType: 'full' | 'partial' | 'none' | 'credit', amount: number, description: string) => void;
  servicePrice: number;
  clientName: string;
  serviceName: string;
  clientBalance?: number;
}

export default function PaymentModal({
  open,
  onClose,
  onConfirm,
  servicePrice,
  clientName,
  serviceName,
  clientBalance = 0,
}: PaymentModalProps) {
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'none' | 'credit'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [description, setDescription] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleConfirm = () => {
    let amount = 0;
    
    switch (paymentType) {
      case 'full':
        amount = servicePrice;
        break;
      case 'partial':
        amount = parseFloat(partialAmount) || 0;
        break;
      case 'credit':
        amount = Math.min(clientBalance, servicePrice);
        break;
      case 'none':
        amount = 0;
        break;
    }

    onConfirm(paymentType, amount, description);
    
    // Reset form
    setPaymentType('full');
    setPartialAmount('');
    setDescription('');
  };

  const hasCredit = clientBalance > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Registrar Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Service Info */}
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm font-medium">{clientName}</p>
            <p className="text-sm text-muted-foreground">{serviceName}</p>
            <p className="text-lg font-bold text-primary mt-1">{formatCurrency(servicePrice)}</p>
          </div>

          {/* Client Balance Info */}
          {clientBalance !== 0 && (
            <div className={`p-3 rounded-lg border ${clientBalance > 0 ? 'border-primary bg-primary/5' : 'border-destructive bg-destructive/5'}`}>
              <div className="flex items-center gap-2">
                {clientBalance > 0 ? (
                  <CreditCard className="h-4 w-4 text-primary" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">
                  {clientBalance > 0 
                    ? `Cliente tem ${formatCurrency(clientBalance)} de crédito`
                    : `Cliente deve ${formatCurrency(Math.abs(clientBalance))}`
                  }
                </span>
              </div>
            </div>
          )}

          {/* Payment Options */}
          <div className="space-y-3">
            <Label>O cliente pagou?</Label>
            <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as any)}>
              <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="flex-1 cursor-pointer">
                  Sim, pagou o valor total ({formatCurrency(servicePrice)})
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="flex-1 cursor-pointer">
                  Pagou parcialmente
                </Label>
              </div>

              {hasCredit && (
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted">
                  <RadioGroupItem value="credit" id="credit" />
                  <Label htmlFor="credit" className="flex-1 cursor-pointer">
                    Usar crédito existente ({formatCurrency(Math.min(clientBalance, servicePrice))})
                  </Label>
                </div>
              )}
              
              <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="flex-1 cursor-pointer">
                  Não pagou (ficará com dívida)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Partial Amount Input */}
          {paymentType === 'partial' && (
            <div className="space-y-2">
              <Label htmlFor="partial-amount">Valor pago</Label>
              <Input
                id="partial-amount"
                type="number"
                step="0.01"
                min="0"
                max={servicePrice}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="0,00"
              />
              {partialAmount && parseFloat(partialAmount) < servicePrice && (
                <p className="text-xs text-muted-foreground">
                  Restante: {formatCurrency(servicePrice - (parseFloat(partialAmount) || 0))} ficará como dívida
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Observação (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Pagou em dinheiro, Vai pagar na próxima..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
