-- BOH-DEV only. Seed core reusable investor Q&A.
with seed(question, answer, topic, sort_order) as (
  values
  ($q$What stops this from becoming a feature?$q$,
   $a$We think the opportunity is larger than a feature because the workflow, evidence structure, review process, and data model are fundamentally different from resume-first hiring systems. Over time, the defensibility comes from the structured role evidence, the hiring feedback loops, and the consistency of the decision process itself.$a$,
   'Moat', 110),
  ($q$Do companies actually care about explainability?$q$,
   $a$Increasingly, yes. Hiring decisions are becoming more scrutinized legally, operationally, and reputationally. Companies may tolerate imperfect sourcing tools, but they become much more sensitive when hiring decisions are difficult to explain or defend.$a$,
   'Market', 120),
  ($q$Why hasn't this already been solved?$q$,
   $a$Historically, hiring infrastructure evolved around resumes because they were easy to store, search, and process at scale. AI is now exposing the limitations of that model by increasing volume faster than decision quality improves. We think the market is reaching the point where the hiring process itself needs to evolve.$a$,
   'Timing', 130),
  ($q$What is the biggest risk?$q$,
   $a$The biggest risk is proving repeatable behavior change inside hiring teams. The technology is not the hardest part. The challenge is becoming embedded in real hiring workflows and proving that better shortlists consistently produce better outcomes.$a$,
   'Risk', 140),
  ($q$Why are you the team to build this?$q$,
   $a$This company comes from direct experience with recruiting, workforce systems, behavioral science, operations, and enterprise environments. We have seen the hiring problem from multiple sides, including candidate evaluation, recruiter workflow, leadership hiring, and operational delivery. That combination shaped both the thesis and the product design.$a$,
   'Team', 150)
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
