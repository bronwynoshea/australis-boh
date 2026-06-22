-- BOH-DEV only. Seed core reusable investor Q&A.
with seed(question, answer, topic, sort_order) as (
  values
  ($q$Why doesn't LinkedIn or an ATS just build this?$q$,
   $a$Most existing hiring platforms are optimized around workflow, sourcing, and application management. Their systems were built around resumes, profiles, and applicant movement. We are approaching the problem differently by structuring evidence around the work itself before resumes dominate the decision. That changes both the workflow and the underlying data model.$a$,
   'Competition', 10),
  ($q$Why now?$q$,
   $a$AI has changed the economics of applying for jobs. Application volume is increasing much faster than hiring teams' ability to evaluate candidates properly. At the same time, employers are under growing pressure to make hiring decisions that are explainable and defensible. We think those two forces create the opening for a new hiring layer focused on decision quality.$a$,
   'Timing', 20),
  ($q$What exactly is the product?$q$,
   $a$JOBZ CAFE® sits between applications and interviews. We structure candidate evidence against the actual role requirements before recruiters rely heavily on resumes or ranking systems. The goal is not to automate hiring decisions. It is to improve the quality and consistency of human decision-making.$a$,
   'Product', 30),
  ($q$Are you replacing recruiters?$q$,
   $a$No. We are trying to improve recruiter confidence and decision quality, not remove human judgment. We believe the market is moving away from fully automated hiring decisions and toward systems that support human review with stronger evidence.$a$,
   'Product', 40),
  ($q$Why is this venture-scale?$q$,
   $a$We think hiring infrastructure is shifting from workflow efficiency toward defensible decision quality. Companies already spend heavily on sourcing, ATS platforms, screening, and recruiter workflow. We believe a decision layer that improves shortlist quality can become embedded across multiple hiring environments and compound over time through role-specific evidence and hiring data.$a$,
   'Market', 50)
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
