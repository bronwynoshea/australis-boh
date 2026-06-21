-- Counter tickets represent bug fixes/minor changes, so they must attach to
-- minor releases. Minor releases roll up to major releases through
-- boh_release_version.parent_major_release_id.

create or replace function public.validate_counter_ticket_release_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_release public.boh_release_version%rowtype;
begin
  if new.release_version_id is null then
    return new;
  end if;

  select *
  into selected_release
  from public.boh_release_version
  where id = new.release_version_id
  limit 1;

  if selected_release.id is null then
    raise exception 'Counter ticket release_version_id % does not exist', new.release_version_id;
  end if;

  if selected_release.release_tier <> 'minor' then
    raise exception 'Counter tickets can only be assigned to minor releases. Release % is %.',
      selected_release.version_label,
      selected_release.release_tier;
  end if;

  if selected_release.parent_major_release_id is null then
    raise exception 'Minor release % must be linked to a major release before tickets can be assigned.',
      selected_release.version_label;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_counter_ticket_release_assignment on public.counter_ticket;

create trigger trg_counter_ticket_release_assignment
before insert or update of release_version_id
on public.counter_ticket
for each row
execute function public.validate_counter_ticket_release_assignment();
