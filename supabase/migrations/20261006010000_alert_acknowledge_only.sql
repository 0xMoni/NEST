-- ============================================================
-- A student could rewrite their mentor's alert.
--
-- "student acknowledges own alert" is an UPDATE policy keyed on
-- student_id = auth.uid(), so the student the alert is about can
-- rewrite its title, message and due date — not just tick it off.
-- A student could quietly reword what their mentor asked them to
-- do.
--
-- Row-level security cannot restrict columns, and a column grant
-- would hit the mentor too, so the rule goes in a trigger: if you
-- are not the mentor, acknowledging is the only thing you may
-- change.
-- ============================================================

create or replace function public.enforce_alert_acknowledge_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.mentors(old.student_id) or public.is_admin() then
    return new;
  end if;

  if (new.mentor_id, new.student_id, new.kind, new.urgent, new.title, new.message, new.due_text, new.created_at)
     is distinct from
     (old.mentor_id, old.student_id, old.kind, old.urgent, old.title, old.message, old.due_text, old.created_at) then
    raise exception 'You can acknowledge an alert, but not change what it says.';
  end if;

  return new;
end;
$$;

drop trigger if exists mentor_alerts_acknowledge_only on public.mentor_alerts;
create trigger mentor_alerts_acknowledge_only
  before update on public.mentor_alerts
  for each row execute function public.enforce_alert_acknowledge_only();
