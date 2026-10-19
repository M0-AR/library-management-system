create extension if not exists pg_trgm;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null,
  status text not null default 'active' check (status in ('active','trial','suspended','cancelled')),
  plan text not null default 'free' check (plan in ('free','starter','growth','enterprise')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  domain text not null unique,
  verification_token text not null,
  status text not null default 'pending' check (status in ('pending','verified','failed')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index domains_tenant_idx on domains (tenant_id);

create table branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index branches_tenant_idx on branches (tenant_id, status);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  email text not null,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('platform_admin','tenant_admin','librarian','assistant','patron')),
  branch_id uuid references branches(id) on delete set null,
  status text not null default 'active' check (status in ('active','disabled')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_tenant_idx on users (tenant_id);
create unique index users_tenant_email_uq on users (tenant_id, lower(email)) where tenant_id is not null;
create unique index users_platform_email_uq on users (lower(email)) where tenant_id is null;

create table members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  card_number text not null,
  full_name text not null,
  email text,
  phone text,
  category text not null default 'adult' check (category in ('child','student','adult','senior','teacher','staff','external')),
  status text not null default 'active' check (status in ('active','suspended','expired','closed')),
  joined_at date not null default current_date,
  expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, card_number)
);
create index members_tenant_status_idx on members (tenant_id, status);
create index members_tenant_name_idx on members (tenant_id, lower(full_name));
create index members_user_idx on members (user_id) where user_id is not null;

-- array_to_string is STABLE in PostgreSQL 18+, which makes it illegal inside a
-- generated column; this immutable wrapper is safe because text[] elements are
-- rendered by the built-in text output function.
create or replace function immutable_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
as $$ select array_to_string(arr, sep) $$;

create table books (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  isbn13 text,
  isbn10 text,
  publisher text,
  published_year integer,
  language text not null default 'en',
  pages integer,
  description text,
  cover_url text,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  dewey text,
  status text not null default 'active' check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(immutable_array_to_string(authors,' '),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(publisher,'') || ' ' || coalesce(immutable_array_to_string(categories,' '),'')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index books_tenant_status_idx on books (tenant_id, status);
create index books_search_idx on books using gin (search_vector);
create index books_title_trgm_idx on books using gin (lower(title) gin_trgm_ops);
create unique index books_tenant_isbn_uq on books (tenant_id, isbn13) where isbn13 is not null;

create table copies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete restrict,
  barcode text not null,
  status text not null default 'available' check (status in ('available','on_loan','reserved','lost','damaged','withdrawn')),
  condition text,
  location text,
  acquired_at date,
  price_cents integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, barcode)
);
create index copies_tenant_book_idx on copies (tenant_id, book_id);
create index copies_tenant_status_idx on copies (tenant_id, status);

create table loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  copy_id uuid not null references copies(id) on delete restrict,
  book_id uuid not null references books(id) on delete restrict,
  member_id uuid not null references members(id) on delete restrict,
  branch_id uuid not null references branches(id) on delete restrict,
  checked_out_by uuid references users(id) on delete set null,
  checked_in_by uuid references users(id) on delete set null,
  checked_out_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  renewed_count integer not null default 0,
  status text not null default 'active' check (status in ('active','overdue','returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index loans_tenant_status_due_idx on loans (tenant_id, status, due_at);
create index loans_tenant_member_idx on loans (tenant_id, member_id, status);
create index loans_tenant_copy_idx on loans (tenant_id, copy_id, status);
create unique index loans_active_copy_uq on loans (tenant_id, copy_id) where status in ('active','overdue');

create table holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','ready','fulfilled','cancelled','expired')),
  placed_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index holds_tenant_book_idx on holds (tenant_id, book_id, status, placed_at);
create index holds_tenant_member_idx on holds (tenant_id, member_id, status);

create table fines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  loan_id uuid references loans(id) on delete set null,
  type text not null check (type in ('overdue','lost','damaged','manual')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'outstanding' check (status in ('outstanding','paid','waived')),
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index fines_tenant_status_idx on fines (tenant_id, status);
create index fines_tenant_member_idx on fines (tenant_id, member_id, status);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email','sms','in_app')),
  template text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_tenant_idx on notifications (tenant_id, created_at);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_tenant_created_idx on audit_logs (tenant_id, created_at desc);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_id uuid,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index refresh_tokens_user_idx on refresh_tokens (user_id);

create trigger tenants_set_updated_at before update on tenants for each row execute function set_updated_at();
create trigger branches_set_updated_at before update on branches for each row execute function set_updated_at();
create trigger users_set_updated_at before update on users for each row execute function set_updated_at();
create trigger members_set_updated_at before update on members for each row execute function set_updated_at();
create trigger books_set_updated_at before update on books for each row execute function set_updated_at();
create trigger copies_set_updated_at before update on copies for each row execute function set_updated_at();
create trigger loans_set_updated_at before update on loans for each row execute function set_updated_at();
create trigger holds_set_updated_at before update on holds for each row execute function set_updated_at();

alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenants_select on tenants for select using (true);
create policy tenants_insert on tenants for insert with check (current_setting('app.is_platform_admin', true) = 'true');
create policy tenants_update on tenants for update
  using (
    current_setting('app.is_platform_admin', true) = 'true'
    or id = nullif(current_setting('app.current_tenant', true), '')::uuid
  )
  with check (
    current_setting('app.is_platform_admin', true) = 'true'
    or id = nullif(current_setting('app.current_tenant', true), '')::uuid
  );
create policy tenants_delete on tenants for delete using (current_setting('app.is_platform_admin', true) = 'true');

alter table domains enable row level security;
alter table domains force row level security;
create policy domains_isolation on domains
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
    or current_setting('app.public_lookup', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table branches enable row level security;
alter table branches force row level security;
create policy branches_isolation on branches
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table users enable row level security;
alter table users force row level security;
create policy users_isolation on users
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
    or (tenant_id is null and current_setting('app.platform_login', true) = 'true')
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table members enable row level security;
alter table members force row level security;
create policy members_isolation on members
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table books enable row level security;
alter table books force row level security;
create policy books_isolation on books
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table copies enable row level security;
alter table copies force row level security;
create policy copies_isolation on copies
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table loans enable row level security;
alter table loans force row level security;
create policy loans_isolation on loans
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table holds enable row level security;
alter table holds force row level security;
create policy holds_isolation on holds
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table fines enable row level security;
alter table fines force row level security;
create policy fines_isolation on fines
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table notifications enable row level security;
alter table notifications force row level security;
create policy notifications_isolation on notifications
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
  );

alter table audit_logs enable row level security;
alter table audit_logs force row level security;
create policy audit_logs_isolation on audit_logs
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
    or (tenant_id is null and current_setting('app.platform_login', true) = 'true')
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.is_platform_admin', true) = 'true'
    or (tenant_id is null and current_setting('app.platform_login', true) = 'true')
  );

alter table refresh_tokens enable row level security;
alter table refresh_tokens force row level security;
create policy refresh_tokens_isolation on refresh_tokens
  using (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.refresh_lookup', true) = 'true'
    or (tenant_id is null and current_setting('app.platform_login', true) = 'true')
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
    or current_setting('app.refresh_lookup', true) = 'true'
    or (tenant_id is null and current_setting('app.platform_login', true) = 'true')
  );
