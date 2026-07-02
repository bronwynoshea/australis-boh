-- BOH-DEV only. Seed core reusable investor Q&A.
with seed(question, answer, topic, sort_order) as (
  values
  ($q$Why does this become a large company instead of just another recruiting tool?$q$,
   $a$Most hiring technology has been built around managing applications, resumes, and workflow. We believe the next major shift in hiring is not about moving candidates faster; it is about improving the quality and defensibility of hiring decisions themselves.

AI is increasing application volume dramatically, but employers are still struggling with confidence in who should actually move forward. At the same time, legal, operational, and financial pressure around hiring decisions is increasing.

We think this creates space for a new infrastructure layer in hiring: one focused on structured evidence, explainable review, and better shortlists before interviews begin.

If we are right, this does not become another recruiting feature. It becomes part of how hiring decisions are made across multiple industries and hiring environments.$a$,
   'Market', 160)
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
