-- BOH production seed: restore guest-visible CELLAR Q&A from BOH-DEV.
-- Run after the guest Q&A read policy exists in BOH production.

with seed(question, answer, topic, sort_order) as (
  values
  ($q$Why doesn't LinkedIn or an ATS just build this?$q$, $a$Most existing hiring platforms are optimized around workflow, sourcing, and application management. Their systems were built around resumes, profiles, and applicant movement. We are approaching the problem differently by structuring evidence around the work itself before resumes dominate the decision. That changes both the workflow and the underlying data model.$a$, 'Competition', 10),
  ($q$Why now?$q$, $a$AI has changed the economics of applying for jobs. Application volume is increasing much faster than hiring teams' ability to evaluate candidates properly. At the same time, employers are under growing pressure to make hiring decisions that are explainable and defensible. We think those two forces create the opening for a new hiring layer focused on decision quality.$a$, 'Timing', 20),
  ($q$What exactly is the product?$q$, $a$JOBZ CAFE sits between applications and interviews. We structure candidate evidence against the actual role requirements before recruiters rely heavily on resumes or ranking systems. The goal is not to automate hiring decisions. It is to improve the quality and consistency of human decision-making.$a$, 'Product', 30),
  ($q$Are you replacing recruiters?$q$, $a$No. We are trying to improve recruiter confidence and decision quality, not remove human judgment. We believe the market is moving away from fully automated hiring decisions and toward systems that support human review with stronger evidence.$a$, 'Product', 40),
  ($q$Why is this venture-scale?$q$, $a$We think hiring infrastructure is shifting from workflow efficiency toward defensible decision quality. Companies already spend heavily on sourcing, ATS platforms, screening, and recruiter workflow. We believe a decision layer that improves shortlist quality can become embedded across multiple hiring environments and compound over time through role-specific evidence and hiring data.$a$, 'Market', 50),
  ($q$What stops this from becoming a feature?$q$, $a$We think the opportunity is larger than a feature because the workflow, evidence structure, review process, and data model are fundamentally different from resume-first hiring systems. Over time, the defensibility comes from the structured role evidence, the hiring feedback loops, and the consistency of the decision process itself.$a$, 'Moat', 110),
  ($q$Do companies actually care about explainability?$q$, $a$Increasingly, yes. Hiring decisions are becoming more scrutinized legally, operationally, and reputationally. Companies may tolerate imperfect sourcing tools, but they become much more sensitive when hiring decisions are difficult to explain or defend.$a$, 'Market', 120),
  ($q$Why hasn't this already been solved?$q$, $a$Historically, hiring infrastructure evolved around resumes because they were easy to store, search, and process at scale. AI is now exposing the limitations of that model by increasing volume faster than decision quality improves. We think the market is reaching the point where the hiring process itself needs to evolve.$a$, 'Timing', 130),
  ($q$What is the biggest risk?$q$, $a$The biggest risk is proving repeatable behavior change inside hiring teams. The technology is not the hardest part. The challenge is becoming embedded in real hiring workflows and proving that better shortlists consistently produce better outcomes.$a$, 'Risk', 140),
  ($q$Why are you the team to build this?$q$, $a$This company comes from direct experience with recruiting, workforce systems, behavioral science, operations, and enterprise environments. We have seen the hiring problem from multiple sides, including candidate evaluation, recruiter workflow, leadership hiring, and operational delivery. That combination shaped both the thesis and the product design.$a$, 'Team', 150),
  ($q$Why does this become a large company instead of just another recruiting tool?$q$, $a$Most hiring technology has been built around managing applications, resumes, and workflow. We believe the next major shift in hiring is not about moving candidates faster; it is about improving the quality and defensibility of hiring decisions themselves.

AI is increasing application volume dramatically, but employers are still struggling with confidence in who should actually move forward. At the same time, legal, operational, and financial pressure around hiring decisions is increasing.

We think this creates space for a new infrastructure layer in hiring: one focused on structured evidence, explainable review, and better shortlists before interviews begin.

If we are right, this does not become another recruiting feature. It becomes part of how hiring decisions are made across multiple industries and hiring environments.$a$, 'Market', 160)
)
insert into public.cellar_prepared_qa
(question, answer, topic, status, visibility, investor_kb_scope, sort_order, published_at, metadata)
select question, answer, topic, 'published', 'guest', 'investor_kb', sort_order, now(),
       jsonb_build_object('source', 'boh_prod_seed_from_boh_dev_2026_05_27')
from seed
where not exists (
  select 1
  from public.cellar_prepared_qa q
  where lower(q.question) = lower(seed.question)
);

select count(*) as guest_visible_qa_count
from public.cellar_prepared_qa
where status = 'published'
  and visibility = 'guest'
  and investor_kb_scope = 'investor_kb';
