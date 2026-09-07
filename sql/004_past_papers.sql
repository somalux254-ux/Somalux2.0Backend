-- Past papers schema for the university library features.
-- Creates the university dependency before the past papers table.

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  website_url text not null default '',
  cover_image_url text,
  location text not null default '',
  established integer,
  student_count bigint not null default 0,
  views bigint not null default 0,
  likes_count bigint not null default 0,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.universities add column if not exists description text not null default '';
alter table public.universities add column if not exists website_url text not null default '';
alter table public.universities add column if not exists cover_image_url text;
alter table public.universities add column if not exists location text not null default '';
alter table public.universities add column if not exists established integer;
alter table public.universities add column if not exists student_count bigint not null default 0;
alter table public.universities add column if not exists views bigint not null default 0;
alter table public.universities add column if not exists likes_count bigint not null default 0;
alter table public.universities add column if not exists status text not null default 'approved';
alter table public.universities add column if not exists uploaded_by uuid references auth.users(id) on delete set null;
alter table public.universities add column if not exists created_at timestamptz not null default now();
alter table public.universities add column if not exists updated_at timestamptz not null default now();

create index if not exists universities_name_idx on public.universities(name);
create index if not exists universities_status_idx on public.universities(status);
create index if not exists universities_created_at_idx on public.universities(created_at desc);

alter table public.universities enable row level security;

drop policy if exists universities_public_read on public.universities;
drop policy if exists universities_owner_or_admin_insert on public.universities;
drop policy if exists universities_owner_or_admin_update on public.universities;
drop policy if exists universities_admin_delete on public.universities;

create policy universities_public_read on public.universities
for select using (status = 'approved' or public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy universities_owner_or_admin_insert on public.universities
for insert with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy universities_owner_or_admin_update on public.universities
for update using (public.is_content_admin() or uploaded_by::text = auth.uid()::text)
with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy universities_admin_delete on public.universities
for delete using (public.is_content_admin() or uploaded_by::text = auth.uid()::text);

create table if not exists public.university_images (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  image_url text not null,
  caption text,
  is_primary boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists university_images_university_id_idx
  on public.university_images(university_id, display_order);

alter table public.university_images enable row level security;
drop policy if exists university_images_public_read on public.university_images;
drop policy if exists university_images_admin_insert on public.university_images;
drop policy if exists university_images_admin_update on public.university_images;
drop policy if exists university_images_admin_delete on public.university_images;

create policy university_images_public_read on public.university_images
for select using (true);
create policy university_images_admin_insert on public.university_images
for insert with check (public.is_content_admin());
create policy university_images_admin_update on public.university_images
for update using (public.is_content_admin())
with check (public.is_content_admin());
create policy university_images_admin_delete on public.university_images
for delete using (public.is_content_admin());

create table if not exists public.past_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  unit_code text not null default '',
  unit_name text not null default '',
  faculty text not null default '',
  university_id uuid references public.universities(id) on delete set null,
  file_url text,
  file_path text,
  year integer,
  semester text,
  exam_type text,
  downloads_count bigint not null default 0,
  views_count bigint not null default 0,
  views bigint not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.past_papers add column if not exists title text not null default '';
alter table public.past_papers add column if not exists unit_code text not null default '';
alter table public.past_papers add column if not exists unit_name text not null default '';
alter table public.past_papers add column if not exists faculty text not null default '';
alter table public.past_papers add column if not exists university_id uuid references public.universities(id) on delete set null;
alter table public.past_papers add column if not exists file_url text;
alter table public.past_papers add column if not exists file_path text;
alter table public.past_papers add column if not exists year integer;
alter table public.past_papers add column if not exists semester text;
alter table public.past_papers add column if not exists exam_type text;
alter table public.past_papers add column if not exists downloads_count bigint not null default 0;
alter table public.past_papers add column if not exists views_count bigint not null default 0;
alter table public.past_papers add column if not exists views bigint not null default 0;
alter table public.past_papers add column if not exists uploaded_by uuid references auth.users(id) on delete set null;
alter table public.past_papers add column if not exists created_at timestamptz not null default now();
alter table public.past_papers add column if not exists updated_at timestamptz not null default now();

create index if not exists past_papers_university_id_idx on public.past_papers(university_id);
create index if not exists past_papers_faculty_idx on public.past_papers(faculty);
create index if not exists past_papers_created_at_idx on public.past_papers(created_at desc);
create index if not exists past_papers_uploaded_by_idx on public.past_papers(uploaded_by);

create table if not exists public.past_paper_views (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.past_papers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (paper_id, user_id)
);

create table if not exists public.past_paper_downloads (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.past_papers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  downloaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists past_paper_views_paper_id_idx on public.past_paper_views(paper_id, viewed_at desc);
create index if not exists past_paper_downloads_paper_id_idx on public.past_paper_downloads(paper_id, downloaded_at desc);

alter table public.past_paper_views enable row level security;
alter table public.past_paper_downloads enable row level security;

drop policy if exists past_paper_views_public_read on public.past_paper_views;
drop policy if exists past_paper_views_own_insert on public.past_paper_views;
drop policy if exists past_paper_downloads_public_read on public.past_paper_downloads;
drop policy if exists past_paper_downloads_own_insert on public.past_paper_downloads;

create policy past_paper_views_public_read on public.past_paper_views for select using (true);
create policy past_paper_views_own_insert on public.past_paper_views for insert with check (auth.uid()::text = user_id::text);
create policy past_paper_downloads_public_read on public.past_paper_downloads for select using (true);
create policy past_paper_downloads_own_insert on public.past_paper_downloads for insert with check (auth.uid()::text = user_id::text);

create or replace function public.increment_past_paper_views_v2(p_paper_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_count bigint;
begin
  update public.past_papers set views_count = views_count + 1, views = views + 1, updated_at = now()
  where id = p_paper_id returning views_count into new_count;
  return coalesce(new_count, 0);
end;
$$;

create or replace function public.increment_past_paper_views(p_paper_id uuid)
returns bigint language sql security definer set search_path = public as $$
  select public.increment_past_paper_views_v2(p_paper_id);
$$;

create or replace function public.increment_past_paper_downloads(p_paper_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_count bigint;
begin
  update public.past_papers set downloads_count = downloads_count + 1, updated_at = now()
  where id = p_paper_id returning downloads_count into new_count;
  insert into public.past_paper_downloads (paper_id, user_id) values (p_paper_id, auth.uid());
  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.increment_past_paper_views(uuid) to anon, authenticated;
grant execute on function public.increment_past_paper_views_v2(uuid) to anon, authenticated;
grant execute on function public.increment_past_paper_downloads(uuid) to anon, authenticated;

alter table public.past_papers enable row level security;

drop policy if exists past_papers_public_read on public.past_papers;
drop policy if exists past_papers_owner_or_admin_insert on public.past_papers;
drop policy if exists past_papers_owner_or_admin_update on public.past_papers;
drop policy if exists past_papers_admin_delete on public.past_papers;

create policy past_papers_public_read on public.past_papers
for select using (true);
create policy past_papers_owner_or_admin_insert on public.past_papers
for insert with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy past_papers_owner_or_admin_update on public.past_papers
for update using (public.is_content_admin() or uploaded_by::text = auth.uid()::text)
with check (public.is_content_admin() or uploaded_by::text = auth.uid()::text);
create policy past_papers_admin_delete on public.past_papers
for delete using (public.is_content_admin());

-- Storage policies for the public past-papers bucket. The bucket's public flag
-- controls downloads; uploads still require an authenticated content admin.
drop policy if exists past_papers_storage_insert on storage.objects;
drop policy if exists past_papers_storage_select on storage.objects;
drop policy if exists past_papers_storage_update on storage.objects;
drop policy if exists past_papers_storage_delete on storage.objects;

create policy past_papers_storage_insert on storage.objects
for insert with check (
  bucket_id = 'past-papers'
  and public.is_content_admin()
);
create policy past_papers_storage_select on storage.objects
for select using (bucket_id = 'past-papers');
create policy past_papers_storage_update on storage.objects
for update using (
  bucket_id = 'past-papers'
  and public.is_content_admin()
)
with check (
  bucket_id = 'past-papers'
  and public.is_content_admin()
);
create policy past_papers_storage_delete on storage.objects
for delete using (
  bucket_id = 'past-papers'
  and public.is_content_admin()
);

-- Storage policies for university cover images used by the admin university grid.
drop policy if exists universities_storage_insert on storage.objects;
drop policy if exists universities_storage_select on storage.objects;
drop policy if exists universities_storage_update on storage.objects;
drop policy if exists universities_storage_delete on storage.objects;

create policy universities_storage_insert on storage.objects
for insert with check (
  bucket_id = 'university-covers'
  and public.is_content_admin()
);
create policy universities_storage_select on storage.objects
for select using (bucket_id = 'university-covers');
create policy universities_storage_update on storage.objects
for update using (
  bucket_id = 'university-covers'
  and public.is_content_admin()
)
with check (
  bucket_id = 'university-covers'
  and public.is_content_admin()
);
create policy universities_storage_delete on storage.objects
for delete using (
  bucket_id = 'university-covers'
  and public.is_content_admin()
);

create table if not exists public.past_papers_upload_history (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status text not null check (status in ('success', 'failed', 'duplicate')),
  paper_title text not null default '',
  university_id uuid references public.universities(id) on delete set null,
  faculty text not null default '',
  unit_code text not null default '',
  unit_name text not null default '',
  year integer,
  uploaded_by uuid references auth.users(id) on delete set null,
  error_message text,
  is_duplicate boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists past_papers_upload_history_created_at_idx
  on public.past_papers_upload_history(created_at desc);
create index if not exists past_papers_upload_history_status_idx
  on public.past_papers_upload_history(status);

alter table public.past_papers_upload_history enable row level security;
drop policy if exists past_papers_upload_history_admin_read on public.past_papers_upload_history;
drop policy if exists past_papers_upload_history_admin_insert on public.past_papers_upload_history;
create policy past_papers_upload_history_admin_read on public.past_papers_upload_history
for select using (public.is_content_admin());
create policy past_papers_upload_history_admin_insert on public.past_papers_upload_history
for insert with check (public.is_content_admin());

-- Past paper metrics and social interactions are intentionally not part of the
-- public Past Papers feature. Remove legacy columns, tables, and RPCs when this
-- migration is applied to an existing database.
drop function if exists public.increment_past_paper_views(uuid);
drop function if exists public.increment_past_paper_views_v2(uuid);
drop function if exists public.increment_past_paper_downloads(uuid);
drop function if exists public.toggle_past_paper_like(uuid, uuid);
drop function if exists public.toggle_past_paper_bookmark(uuid, uuid);

drop table if exists public.past_paper_views cascade;
drop table if exists public.past_paper_downloads cascade;
drop table if exists public.past_paper_likes cascade;
drop table if exists public.past_paper_bookmarks cascade;

alter table if exists public.past_papers drop column if exists downloads_count;
alter table if exists public.past_papers drop column if exists views_count;
alter table if exists public.past_papers drop column if exists views;
alter table if exists public.past_papers drop column if exists likes_count;
alter table if exists public.past_papers drop column if exists bookmarks_count;

notify pgrst, 'reload schema';
