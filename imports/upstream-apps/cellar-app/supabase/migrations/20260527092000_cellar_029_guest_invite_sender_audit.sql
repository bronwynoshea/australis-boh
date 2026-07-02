-- CELLAR guest-code invite sender audit fields.

alter table public.cellar_investor_access
  add column if not exists guest_code_sent_by_boh_user_id text,
  add column if not exists guest_code_sent_from_boh_user_id text,
  add column if not exists guest_code_sent_at timestamptz;

comment on column public.cellar_investor_access.guest_code_sent_by_boh_user_id is
  'BOH user who performed the latest CELLAR guest-code invite action.';

comment on column public.cellar_investor_access.guest_code_sent_from_boh_user_id is
  'BOH user presented as the sender for the latest CELLAR guest-code invite.';

comment on column public.cellar_investor_access.guest_code_sent_at is
  'Timestamp of the latest CELLAR guest-code invite prepared for this investor access record.';

create index if not exists cellar_investor_access_guest_code_sent_by_idx
  on public.cellar_investor_access (guest_code_sent_by_boh_user_id);

create index if not exists cellar_investor_access_guest_code_sent_from_idx
  on public.cellar_investor_access (guest_code_sent_from_boh_user_id);
