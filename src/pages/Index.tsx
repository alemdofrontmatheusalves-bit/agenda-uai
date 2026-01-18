import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Scissors,
  Calendar,
  Users,
  Sparkles,
  Shield,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Agendamento Inteligente',
    description: 'Evite conflitos de horário automaticamente com detecção de sobreposição',
  },
  {
    icon: Users,
    title: 'Gestão de Clientes',
    description: 'Acompanhe histórico, preferências e informações de contato dos clientes',
  },
  {
    icon: Sparkles,
    title: 'Catálogo de Serviços',
    description: 'Gerencie seus serviços com configurações de preços e duração',
  },
  {
    icon: Shield,
    title: 'Segurança Empresarial',
    description: 'Isolamento multi-tenant com controle de acesso baseado em funções',
  },
];

const benefits = [
  'Sem cartão de crédito',
  'Grátis para pequenos salões',
  'Configure em 5 minutos',
  'Cancele quando quiser',
];

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <Scissors className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">Beleza</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 lg:py-32 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center animate-slide-up">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Gerencie seu salão
              <br />
              <span className="text-primary">com confiança</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Um sistema completo de gestão para salões de beleza e clínicas de estética. 
              Agende atendimentos, gerencie clientes e faça seu negócio crescer—tudo em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" asChild>
                <Link to="/auth">
                  Comece Grátis
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/auth">Ver Demo</Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Tudo o que você precisa para ter sucesso
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Recursos poderosos desenvolvidos especialmente para profissionais da beleza
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card rounded-xl p-6 shadow-soft hover:shadow-elevated transition-shadow"
              >
                <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-accent-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Pronto para transformar seu salão?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Junte-se a centenas de profissionais da beleza que confiam no Beleza para gerenciar suas operações diárias.
            </p>
            <Button size="xl" asChild>
              <Link to="/auth">
                Comece Hoje Mesmo
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Scissors className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">Beleza</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Beleza. Feito para profissionais da beleza.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
