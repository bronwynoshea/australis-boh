-- Update the Talent -> BOH Loft Counter record with the final Cloudflare/frontend fix.
-- Safe/idempotent: updates the existing record ticket only once per tenant.

with target as (
  select ct.id
  from public.counter_ticket ct
  join public.boh_tenant t on t.id = ct.tenant_id
  where t.slug = 'jobzcafe'
    and ct.subject = 'Record: Talent interview rooms promoted to BOH Loft production'
  order by ct.created_at desc
  limit 1
), updated as (
  update public.counter_ticket ct
  set
    description = case
      when ct.description ilike '%Final Cloudflare/frontend update:%' then ct.description
      else concat(
        coalesce(ct.description, ''),
        E'\n\nFinal Cloudflare/frontend update:\n',
        E'- BOH production frontend was still serving an older main deployment, which caused Talent recruiter Loft links to fall through to the protected BOH login screen.\n',
        E'- Staged BOH Loft wrapper changes were merged into production main and deployed through Cloudflare Pages.\n',
        E'- Production main is now commit 027dce4dcea245a21127abc1205f1f20f5bd474d.\n',
        E'- Verified https://loft.jobzcafe.com/apps/loft/interview-room/test no longer shows BOH login; it now reaches the public wrapper route and shows the expected unavailable-room message for a fake/no-payload test URL.\n',
        E'- Next user validation is a fresh Talent Open call room test that should generate a loft.jobzcafe.com/apps/loft/interview-room/<roomId>?payload=... recruiter URL.'
      )
    end,
    ai_summary = 'Talent interview rooms are promoted into BOH Loft. Production Supabase/functions/secrets are in place, loft.jobzcafe.com is configured, and the BOH production frontend was updated so the public interview wrapper route no longer sends recruiters to BOH login.',
    updated_at = now()
  from target
  where ct.id = target.id
  returning ct.id, ct.ticket_number, ct.subject, ct.updated_at
)
select * from updated;
