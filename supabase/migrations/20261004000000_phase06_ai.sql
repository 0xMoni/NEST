create table public.ai_roadmaps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  career_goal text not null,
  roadmap_data jsonb not null, 
  created_at timestamptz not null default now()
);

alter table public.ai_roadmaps enable row level security;

create policy "student manages own roadmaps" 
  on public.ai_roadmaps for all 
  using (student_id = auth.uid()) 
  with check (student_id = auth.uid());

create policy "admin/faculty reads ai data" 
  on public.ai_roadmaps for select 
  using (public.is_admin() or public.current_role_is('faculty'));