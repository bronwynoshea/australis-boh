-- BOH-DEV only. Seed core reusable investor Q&A.
with seed(question, answer, topic, sort_order) as (
  values
  ($q$What is the wedge?$q$,
   $a$We are starting in high-volume, role-specific hiring environments where poor shortlists are expensive and measurable. Our first focus is employer-side hiring pain, particularly where founder relationships and operational credibility can open early doors quickly.$a$,
   'Wedge', 60),
  ($q$Why will recruiters pay for this?$q$,
   $a$Because hiring mistakes are expensive, and volume alone is not solving the problem. Recruiters already pay for sourcing, workflow, advertising, and applicant management. We believe there is willingness to pay for stronger hiring confidence, especially in roles where turnover and bad hires have measurable operational costs.$a$,
   'Business Model', 70),
  ($q$How is this different from AI screening?$q$,
   $a$Most AI screening tools focus on automation, filtering, or ranking. We focus on structured evidence and human review. Our approach is designed to support explainable decision-making rather than autonomous rejection.$a$,
   'Differentiation', 80),
  ($q$What happens if application volume drops?$q$,
   $a$Even without AI-driven volume increases, employers still struggle with inconsistent hiring decisions and resume-first evaluation. AI is accelerating the problem, but the underlying issue already existed. We believe the need for better decision quality remains regardless of application volume trends.$a$,
   'Risk', 90),
  ($q$Why is the candidate side important if recruiters pay?$q$,
   $a$The candidate side matters because the current system hides capability behind resume optimization and referral networks. Long term, we believe improving visibility for capable candidates strengthens the quality of the employer-side decision process as well. But commercially, we are leading with employer pain first.$a$,
   'Market', 100)
)
insert into public.cellar_prepared_qa
(question, answer, topic, status, visibility, investor_kb_scope, sort_order, published_at, metadata)
select question, answer, topic, 'published', 'guest', 'investor_kb', sort_order, now(),
       jsonb_build_object('source', 'boh_dev_core_qa_seed')
from seed
where not exists (
  select 1 from public.cellar_prepared_qa q
  where lower(q.question) = lower(seed.question)
);
