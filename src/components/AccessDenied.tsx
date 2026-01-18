import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

interface AccessDeniedProps {
  message?: string;
  showBackButton?: boolean;
}

export default function AccessDenied({ 
  message = 'Você não tem permissão para acessar esta página.',
  showBackButton = true 
}: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full shadow-soft">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Acesso Negado</CardTitle>
          <CardDescription className="text-base">{message}</CardDescription>
        </CardHeader>
        {showBackButton && (
          <CardContent className="flex justify-center">
            <Button asChild variant="outline">
              <Link to="/dashboard">Voltar ao Painel</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
