-- 양봉일지 데이터베이스 스키마
-- Supabase 프로젝트 > SQL Editor 에서 이 파일 내용을 전체 실행하세요.

create extension if not exists "pgcrypto";

-- 벌장(그룹)
create table if not exists apiaries (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

-- 약품
create table if not exists medicines (
  id text primary key,
  name text not null,
  type text,
  unit text,
  stock numeric default 0,
  min_stock numeric default 10,
  withdrawal_days integer default 0,
  note text,
  created_at timestamptz default now()
);

-- 벌통 (여왕벌/개체수/질병/투약/채밀/순회점검 기록은 JSON으로 저장)
create table if not exists hives (
  id text primary key,
  name text not null,
  apiary_id text references apiaries(id) on delete set null,
  location text,
  note text,
  queen jsonb default '{}'::jsonb,
  population jsonb default '{}'::jsonb,
  diseases jsonb default '[]'::jsonb,
  medications jsonb default '[]'::jsonb,
  harvests jsonb default '[]'::jsonb,
  inspections jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- (선택) 팀원 정보 및 권한 - 지금은 admin/staff 구분만 두고,
-- MVP 단계에서는 로그인한 모든 사용자가 동일한 권한을 갖습니다.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'staff', -- 'admin' | 'staff'
  created_at timestamptz default now()
);

-- 새 사용자가 가입하면 profiles 행을 자동 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security 활성화
alter table apiaries enable row level security;
alter table hives enable row level security;
alter table medicines enable row level security;
alter table profiles enable row level security;

-- MVP 정책: 로그인한 사용자(팀원)는 모두 같은 데이터를 보고 수정할 수 있습니다.
-- (한 양봉장을 여러 직원이 같이 관리하는 구조이므로 팀 내부에서는 데이터를 구분하지 않습니다.)
drop policy if exists "authenticated full access" on apiaries;
create policy "authenticated full access" on apiaries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on hives;
create policy "authenticated full access" on hives
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on medicines;
create policy "authenticated full access" on medicines
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
  for select using (auth.uid() = id);

-- 실시간 동기화(여러 명이 동시에 볼 때 자동 갱신)를 위해 Replication 활성화
alter publication supabase_realtime add table hives;
alter publication supabase_realtime add table apiaries;
alter publication supabase_realtime add table medicines;
