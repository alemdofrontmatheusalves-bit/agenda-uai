# Arquitetura do Projeto - Sistema de Gestão de Salão

## Visão Geral

Este é um sistema SaaS multi-tenant para gestão de salões de beleza, construído com:

- **Frontend**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS + shadcn/ui
- **Estado**: React Context + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Roteamento**: React Router v6

## Estrutura de Diretórios

```
src/
├── components/          # Componentes React reutilizáveis
│   ├── layout/          # Componentes de layout (DashboardLayout, etc.)
│   ├── ui/              # Componentes shadcn/ui
│   ├── AccessDenied.tsx # Componente de acesso negado
│   ├── NavLink.tsx      # Link de navegação ativo
│   ├── PaymentModal.tsx # Modal de pagamento ao concluir serviço
│   └── ProtectedRoute.tsx # HOC para rotas protegidas
├── hooks/               # Custom hooks
│   ├── use-mobile.tsx   # Detecção de dispositivo móvel
│   ├── use-toast.ts     # Toast notifications
│   └── usePermission.ts # Verificação de permissões
├── integrations/        # Integrações externas
│   └── supabase/        # Cliente e tipos do Supabase
├── lib/                 # Utilitários e contextos
│   ├── auth-context.tsx # Contexto de autenticação
│   ├── organization-context.tsx # Contexto de organização
│   └── utils.ts         # Funções utilitárias
├── pages/               # Páginas/rotas da aplicação
└── test/                # Configuração de testes
```

## Fluxo de Autenticação

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Página Auth   │────▶│  Supabase Auth   │────▶│   AuthContext   │
│  (login/signup) │     │  (email/senha)   │     │   (user/session)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────────┐
                                               │ OrganizationContext │
                                               │  (memberships/org)  │
                                               └─────────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────────┐
                                               │   ProtectedRoute    │
                                               │   (verifica auth)   │
                                               └─────────────────────┘
```

### AuthContext (`src/lib/auth-context.tsx`)

Gerencia o estado de autenticação:
- `user`: Usuário atual do Supabase
- `session`: Sessão ativa
- `loading`: Estado de carregamento
- `signUp/signIn/signOut/resetPassword`: Métodos de autenticação

### OrganizationContext (`src/lib/organization-context.tsx`)

Gerencia organizações do usuário:
- `memberships`: Lista de organizações do usuário
- `currentOrganization`: Organização selecionada
- `currentRole`: Papel na organização ('owner' | 'staff')
- Persiste seleção no `localStorage`

## Sistema de Permissões

### Papéis (Roles)

| Role   | Descrição                          |
|--------|-----------------------------------|
| owner  | Proprietário - acesso total       |
| staff  | Funcionário - permissões granulares|

### Permissões Granulares

```typescript
type PermissionType =
  | 'appointments_view' | 'appointments_create' | 'appointments_edit'
  | 'clients_view' | 'clients_create' | 'clients_edit'
  | 'professionals_view' | 'professionals_create' | 'professionals_edit'
  | 'services_view' | 'services_create' | 'services_edit'
  | 'analytics_view' | 'team_view'
  | 'inventory_view' | 'inventory_create' | 'inventory_edit'
  | 'finances_view' | 'finances_create';
```

### Hook usePermission (`src/hooks/usePermission.ts`)

```typescript
// Uso
const canView = usePermission('appointments_view');
const canEdit = usePermission('appointments_edit');

if (!canView) {
  return <AccessDenied />;
}
```

## Fluxo de Dados Financeiros

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Agendamento    │────▶│  Concluir        │────▶│  PaymentModal   │
│  (appointments) │     │  Serviço         │     │  (pergunta pgto)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        ▼                                ▼                                ▼
               ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
               │  Pagamento      │              │  Pagamento      │              │  Não Pagou      │
               │  Total          │              │  Parcial        │              │  (dívida)       │
               └─────────────────┘              └─────────────────┘              └─────────────────┘
                        │                                │                                │
                        ▼                                ▼                                ▼
               ┌─────────────────────────────────────────────────────────────────────────────────┐
               │                        client_transactions                                       │
               │  - type: 'debit' (serviço prestado)                                             │
               │  - type: 'payment' (pagamento recebido)                                         │
               │  - type: 'credit' (crédito do cliente)                                          │
               └─────────────────────────────────────────────────────────────────────────────────┘
```

### Cálculos Financeiros

| Métrica      | Fórmula                                              |
|--------------|------------------------------------------------------|
| Faturamento  | Soma do preço de todos os agendamentos do período    |
| Recebido     | Soma das transações tipo 'payment' + 'credit'        |
| Em Aberto    | Valor de serviços concluídos - Recebido              |
| Saldo Cliente| Soma de payments - Soma de debits                    |

## Segurança (RLS)

Todas as tabelas utilizam Row Level Security (RLS) baseado em:

1. **Funções de segurança** (`SECURITY DEFINER`):
   - `is_member_of(org_id)`: Verifica se usuário é membro
   - `has_role(org_id, role)`: Verifica papel do usuário
   - `has_permission(org_id, permission)`: Verifica permissão específica
   - `get_user_organization_ids()`: Retorna IDs das organizações do usuário

2. **Políticas típicas**:
   - SELECT: Membros podem ver dados de suas organizações
   - INSERT: Membros podem criar dados
   - UPDATE: Membros podem atualizar dados
   - DELETE: Apenas owners podem excluir

## Componentes Principais

### DashboardLayout

Layout principal do dashboard com:
- Sidebar de navegação
- Header com seletor de organização
- Área de conteúdo principal
- Responsivo (drawer em mobile)

### ProtectedRoute

HOC que:
- Verifica autenticação
- Redireciona para login se não autenticado
- Redireciona para onboarding se sem organização

### PaymentModal

Modal exibido ao concluir um agendamento:
- Pergunta sobre pagamento
- Cria transações financeiras apropriadas
- Atualiza saldo do cliente

## Convenções de Código

### Nomenclatura

- Componentes: PascalCase (`DashboardLayout.tsx`)
- Hooks: camelCase com prefixo 'use' (`usePermission.ts`)
- Contextos: sufixo '-context' (`auth-context.tsx`)
- Páginas: PascalCase (`Dashboard.tsx`)

### Estilização

- Usar tokens semânticos do design system
- Evitar cores hardcoded nos componentes
- Preferir classes Tailwind sobre CSS customizado
- Componentes shadcn/ui para UI consistente

### Estado

- Context para estado global (auth, organização)
- useState para estado local
- TanStack Query para cache de dados remotos
