-- Book categories and book-to-category relationship.
-- Run after 003_books_and_storage.sql.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categories_name_lower_idx
  on public.categories (lower(name));

alter table public.books
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'books_category_id_fkey'
      and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_category_id_fkey
      foreign key (category_id)
      references public.categories(id)
      on delete set null;
  end if;
end $$;

create index if not exists books_category_id_idx
  on public.books(category_id);

alter table public.categories enable row level security;

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read
  on public.categories
  for select
  using (true);

drop policy if exists categories_content_admin_write on public.categories;
create policy categories_content_admin_write
  on public.categories
  for all
  using (public.is_content_admin())
  with check (public.is_content_admin());

comment on table public.categories is 'Book categories managed from the Books admin page.';
comment on column public.books.category_id is 'Optional category assigned to the book.';
