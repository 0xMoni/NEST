-- Refuses to run once a later migration is applied: running an old
-- file again puts back what later ones fixed. See 20261119000000.
do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is not null then
    execute 'select exists (select 1 from private.applied_migrations where version > $1)'
       into later using '20261006020000';
    if later then
      raise exception 'A later migration is already applied; running 20261006020000 again would undo it.';
    end if;
  end if;
end $$;

-- Where to find a faculty member, for the mentor card. The mock had
-- "Cabin 214, Block B · Mon, Wed 3:30–5:00 PM" with nowhere to put it.
--
-- Free text rather than structured hours: office hours are written the way a
-- person says them, and parsing "Mon, Wed 3:30–5:00 PM" into columns would
-- lose more than it gained.

alter table public.profiles
  add column if not exists cabin        text,
  add column if not exists office_hours text;
