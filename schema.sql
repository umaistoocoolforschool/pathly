begin;

create table if not exists public.pathly_saved_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null check (char_length(activity_id) between 1 and 128),
  kind text not null,
  status text,
  primary key (user_id, activity_id, kind),
  constraint pathly_valid_activity_kind check (
    (kind = 'bookmark' and status is null)
    or (kind = 'plan' and status is not null and status in ('To explore', 'In progress', 'Completed'))
  )
);

alter table public.pathly_saved_activities enable row level security;
revoke all on table public.pathly_saved_activities from public, anon, authenticated;
grant select, insert, update, delete on table public.pathly_saved_activities to authenticated;

drop policy if exists "Read own activities" on public.pathly_saved_activities;
create policy "Read own activities" on public.pathly_saved_activities
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own activities" on public.pathly_saved_activities;
create policy "Add own activities" on public.pathly_saved_activities
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own activities" on public.pathly_saved_activities;
create policy "Update own activities" on public.pathly_saved_activities
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Remove own activities" on public.pathly_saved_activities;
create policy "Remove own activities" on public.pathly_saved_activities
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
