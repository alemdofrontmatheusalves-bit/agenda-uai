# Documentação do Banco de Dados

## Visão Geral

O banco de dados é PostgreSQL gerenciado pelo Supabase, com Row Level Security (RLS) habilitado em todas as tabelas.

## Diagrama ER

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    profiles     │       │  organizations  │       │   memberships   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK, FK auth)│       │ id (PK)         │◄──────│ organization_id │
│ email           │◄──────│ name            │       │ user_id (FK)    │──────►│ profiles │
│ full_name       │       │ slug            │       │ role            │
│ avatar_url      │       │ phone           │       │ created_at      │
│ created_at      │       │ email           │       └─────────────────┘
│ updated_at      │       │ address         │               │
└─────────────────┘       │ created_at      │               │
                          │ updated_at      │               ▼
                          └─────────────────┘       ┌─────────────────┐
                                  │                 │member_permissions│
                                  │                 ├─────────────────┤
          ┌───────────────────────┼───────────────┐ │ membership_id   │
          │                       │               │ │ permission      │
          ▼                       ▼               ▼ └─────────────────┘
┌─────────────────┐     ┌─────────────────┐  ┌─────────────────┐
│    clients      │     │  professionals  │  │    services     │
├─────────────────┤     ├─────────────────┤  ├─────────────────┤
│ id (PK)         │     │ id (PK)         │  │ id (PK)         │
│ organization_id │     │ organization_id │  │ organization_id │
│ name            │     │ name            │  │ name            │
│ email           │     │ email           │  │ description     │
│ phone           │     │ phone           │  │ duration_minutes│
│ notes           │     │ specialty       │  │ price           │
│ created_at      │     │ avatar_url      │  │ is_active       │
│ updated_at      │     │ is_active       │  │ created_at      │
└─────────────────┘     │ created_at      │  │ updated_at      │
        │               │ updated_at      │  └─────────────────┘
        │               └─────────────────┘           │
        │                       │                     │
        │                       ▼                     │
        │               ┌─────────────────┐           │
        └──────────────►│  appointments   │◄──────────┘
                        ├─────────────────┤
                        │ id (PK)         │
                        │ organization_id │
                        │ client_id (FK)  │
                        │ professional_id │
                        │ service_id (FK) │
                        │ scheduled_at    │
                        │ duration_minutes│
                        │ status          │
                        │ notes           │
                        │ created_at      │
                        │ updated_at      │
                        └─────────────────┘
                                │
                                ▼
                        ┌─────────────────────┐
                        │ client_transactions │
                        ├─────────────────────┤
                        │ id (PK)             │
                        │ organization_id     │
                        │ client_id (FK)      │
                        │ appointment_id (FK) │
                        │ type                │
                        │ amount              │
                        │ description         │
                        │ created_at          │
                        └─────────────────────┘

┌─────────────────────┐     ┌─────────────────┐
│ inventory_products  │     │   invitations   │
├─────────────────────┤     ├─────────────────┤
│ id (PK)             │     │ id (PK)         │
│ organization_id     │     │ organization_id │
│ name                │     │ email           │
│ category            │     │ role            │
│ quantity            │     │ permissions[]   │
│ min_quantity        │     │ token           │
│ unit_cost           │     │ created_by      │
│ created_at          │     │ expires_at      │
│ updated_at          │     │ accepted_at     │
└─────────────────────┘     │ created_at      │
                            └─────────────────┘
```

## Tabelas

### profiles

Perfis de usuários (extensão de `auth.users`).

| Coluna     | Tipo        | Descrição                    |
|------------|-------------|------------------------------|
| id         | uuid (PK)   | ID do usuário (FK auth.users)|
| email      | text        | E-mail do usuário            |
| full_name  | text        | Nome completo                |
| avatar_url | text        | URL da foto de perfil        |
| created_at | timestamptz | Data de criação              |
| updated_at | timestamptz | Data de atualização          |

### organizations

Organizações (salões).

| Coluna     | Tipo        | Descrição                    |
|------------|-------------|------------------------------|
| id         | uuid (PK)   | Identificador único          |
| name       | text        | Nome do salão                |
| slug       | text        | Slug único para URL          |
| phone      | text        | Telefone                     |
| email      | text        | E-mail de contato            |
| address    | text        | Endereço                     |
| created_at | timestamptz | Data de criação              |
| updated_at | timestamptz | Data de atualização          |

### memberships

Relacionamento usuário-organização.

| Coluna          | Tipo        | Descrição                    |
|-----------------|-------------|------------------------------|
| id              | uuid (PK)   | Identificador único          |
| user_id         | uuid (FK)   | ID do usuário                |
| organization_id | uuid (FK)   | ID da organização            |
| role            | app_role    | 'owner' ou 'staff'           |
| created_at      | timestamptz | Data de criação              |
| updated_at      | timestamptz | Data de atualização          |

### member_permissions

Permissões granulares para membros staff.

| Coluna        | Tipo            | Descrição                  |
|---------------|-----------------|----------------------------|
| id            | uuid (PK)       | Identificador único        |
| membership_id | uuid (FK)       | ID da membership           |
| permission    | permission_type | Tipo de permissão          |
| created_at    | timestamptz     | Data de criação            |

### clients

Clientes do salão.

| Coluna          | Tipo        | Descrição                    |
|-----------------|-------------|------------------------------|
| id              | uuid (PK)   | Identificador único          |
| organization_id | uuid (FK)   | ID da organização            |
| name            | text        | Nome do cliente              |
| email           | text        | E-mail                       |
| phone           | text        | Telefone                     |
| notes           | text        | Observações                  |
| created_at      | timestamptz | Data de criação              |
| updated_at      | timestamptz | Data de atualização          |

### professionals

Profissionais do salão.

| Coluna          | Tipo        | Descrição                    |
|-----------------|-------------|------------------------------|
| id              | uuid (PK)   | Identificador único          |
| organization_id | uuid (FK)   | ID da organização            |
| name            | text        | Nome do profissional         |
| email           | text        | E-mail                       |
| phone           | text        | Telefone                     |
| specialty       | text        | Especialidade                |
| avatar_url      | text        | URL da foto                  |
| is_active       | boolean     | Se está ativo                |
| created_at      | timestamptz | Data de criação              |
| updated_at      | timestamptz | Data de atualização          |

### services

Serviços oferecidos.

| Coluna           | Tipo        | Descrição                    |
|------------------|-------------|------------------------------|
| id               | uuid (PK)   | Identificador único          |
| organization_id  | uuid (FK)   | ID da organização            |
| name             | text        | Nome do serviço              |
| description      | text        | Descrição                    |
| duration_minutes | integer     | Duração em minutos           |
| price            | numeric     | Preço                        |
| is_active        | boolean     | Se está ativo                |
| created_at       | timestamptz | Data de criação              |
| updated_at       | timestamptz | Data de atualização          |

### appointments

Agendamentos.

| Coluna           | Tipo               | Descrição                    |
|------------------|--------------------|------------------------------|
| id               | uuid (PK)          | Identificador único          |
| organization_id  | uuid (FK)          | ID da organização            |
| client_id        | uuid (FK)          | ID do cliente                |
| professional_id  | uuid (FK)          | ID do profissional           |
| service_id       | uuid (FK)          | ID do serviço                |
| scheduled_at     | timestamptz        | Data/hora do agendamento     |
| duration_minutes | integer            | Duração em minutos           |
| status           | appointment_status | Status do agendamento        |
| notes            | text               | Observações                  |
| created_at       | timestamptz        | Data de criação              |
| updated_at       | timestamptz        | Data de atualização          |

**Status possíveis**: `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`

### client_transactions

Transações financeiras dos clientes.

| Coluna          | Tipo        | Descrição                    |
|-----------------|-------------|------------------------------|
| id              | uuid (PK)   | Identificador único          |
| organization_id | uuid (FK)   | ID da organização            |
| client_id       | uuid (FK)   | ID do cliente                |
| appointment_id  | uuid (FK)   | ID do agendamento (opcional) |
| type            | text        | 'debit', 'payment', 'credit' |
| amount          | numeric     | Valor da transação           |
| description     | text        | Descrição                    |
| created_at      | timestamptz | Data de criação              |

**Tipos de transação**:
- `debit`: Serviço prestado (dívida do cliente)
- `payment`: Pagamento recebido
- `credit`: Crédito adicionado ao cliente

### inventory_products

Produtos do estoque.

| Coluna          | Tipo        | Descrição                    |
|-----------------|-------------|------------------------------|
| id              | uuid (PK)   | Identificador único          |
| organization_id | uuid (FK)   | ID da organização            |
| name            | text        | Nome do produto              |
| category        | text        | Categoria                    |
| quantity        | integer     | Quantidade em estoque        |
| min_quantity    | integer     | Quantidade mínima (alerta)   |
| unit_cost       | numeric     | Custo unitário               |
| created_at      | timestamptz | Data de criação              |
| updated_at      | timestamptz | Data de atualização          |

### invitations

Convites para equipe.

| Coluna          | Tipo              | Descrição                    |
|-----------------|-------------------|------------------------------|
| id              | uuid (PK)         | Identificador único          |
| organization_id | uuid (FK)         | ID da organização            |
| email           | text              | E-mail do convidado          |
| role            | app_role          | Papel a ser atribuído        |
| permissions     | permission_type[] | Permissões (para staff)      |
| token           | text              | Token único do convite       |
| created_by      | uuid              | ID de quem criou             |
| expires_at      | timestamptz       | Data de expiração            |
| accepted_at     | timestamptz       | Data de aceitação            |
| created_at      | timestamptz       | Data de criação              |

## Enums

### app_role

```sql
CREATE TYPE app_role AS ENUM ('owner', 'staff');
```

### appointment_status

```sql
CREATE TYPE appointment_status AS ENUM (
  'scheduled',
  'confirmed', 
  'completed',
  'cancelled',
  'no_show'
);
```

### permission_type

```sql
CREATE TYPE permission_type AS ENUM (
  'appointments_view', 'appointments_create', 'appointments_edit',
  'clients_view', 'clients_create', 'clients_edit',
  'professionals_view', 'professionals_create', 'professionals_edit',
  'services_view', 'services_create', 'services_edit',
  'analytics_view', 'team_view',
  'inventory_view', 'inventory_create', 'inventory_edit',
  'finances_view', 'finances_create'
);
```

## Funções de Segurança

### is_member_of(org_id uuid)

Verifica se o usuário atual é membro da organização.

```sql
CREATE FUNCTION is_member_of(org_id uuid) RETURNS boolean
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
    AND organization_id = org_id
  )
$$;
```

### has_role(org_id uuid, _role app_role)

Verifica se o usuário tem um papel específico na organização.

```sql
CREATE FUNCTION has_role(org_id uuid, _role app_role) RETURNS boolean
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND role = _role
  )
$$;
```

### has_permission(org_id uuid, _permission permission_type)

Verifica se o usuário tem uma permissão específica.

```sql
CREATE FUNCTION has_permission(org_id uuid, _permission permission_type) RETURNS boolean
SECURITY DEFINER
AS $$
  SELECT 
    has_role(org_id, 'owner')
    OR EXISTS (
      SELECT 1 FROM memberships m
      JOIN member_permissions mp ON mp.membership_id = m.id
      WHERE m.user_id = auth.uid()
        AND m.organization_id = org_id
        AND mp.permission = _permission
    )
$$;
```

### get_user_organization_ids()

Retorna IDs de todas as organizações do usuário.

```sql
CREATE FUNCTION get_user_organization_ids() RETURNS SETOF uuid
SECURITY DEFINER
AS $$
  SELECT organization_id FROM memberships WHERE user_id = auth.uid()
$$;
```

## Triggers

### check_appointment_overlap

Impede agendamentos sobrepostos para o mesmo profissional.

```sql
CREATE TRIGGER check_appointment_overlap_trigger
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION check_appointment_overlap();
```

### update_updated_at_column

Atualiza automaticamente o campo `updated_at`.

```sql
CREATE TRIGGER update_<table>_updated_at
BEFORE UPDATE ON <table>
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Storage Buckets

### avatars

Bucket público para fotos de perfil.

- **Público**: Sim
- **Política de upload**: Usuários podem fazer upload em sua própria pasta (`user_id/`)
- **Limite de tamanho**: 2MB
- **Tipos permitidos**: image/*
