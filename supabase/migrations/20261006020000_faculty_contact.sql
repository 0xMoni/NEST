-- Where to find a faculty member, for the mentor card. The mock had
-- "Cabin 214, Block B · Mon, Wed 3:30–5:00 PM" with nowhere to put it.
--
-- Free text rather than structured hours: office hours are written the way a
-- person says them, and parsing "Mon, Wed 3:30–5:00 PM" into columns would
-- lose more than it gained.

alter table public.profiles
  add column if not exists cabin        text,
  add column if not exists office_hours text;
