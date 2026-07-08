-- Sync missing JOBZCAFE Counter tickets T-0320..T-0326 from BOH-DEV to BOH production.
-- Idempotent: existing ticket_number rows are left unchanged.

with payload as (
  select $json$[{"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "talent", "app_context": "boh", "app_slug": "talent", "category": "feature", "code_freeze_date": null, "created_at": "2026-06-25 00:25:17.983678+00", "description": "Status: SOURCE COMPLETE - release allocation needed.\r\n\r\nUnique marker: T-0320 Talent v1 50-role archetype library source capture 2026-06-25.\r\n\r\nSummary:\r\n- Seeded Talent dev with a 50-role Contribution Architect archetype library.\r\n- Added draft archetypes across accounting/finance, HR/people, software/IT/product, operations/admin/support, sales/marketing/success, and adjacent business roles.\r\n- Each seeded role includes deliverables, indirect evidence questions, dimensions, weights, and deliverable mappings.\r\n- Review workbooks were generated under outputs/archetype-review.\r\n- Source branch: codex-ai-readiness-matrix. Commit: d01a487.\r\n- Talent dev Supabase was updated; production was not touched.\r\n\r\nRelease allocation: not allocated.", "initial_user_message": "Capture Talent archetype library expansion and optional AI readiness matrix scoring in BOH-dev Counter tickets.", "priority_key": "high", "requester_email": "boshea@jobzcafe.com", "requester_name": "Dr. Bron OShea", "source": "codex", "status_key": "new", "subject": "Expand Talent Contribution Architect archetype library to v1 50 roles", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0320", "updated_at": "2026-06-25 00:25:17.983678+00"}, {"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "talent", "app_context": "boh", "app_slug": "talent", "category": "feature", "code_freeze_date": null, "created_at": "2026-06-25 00:25:17.983678+00", "description": "Status: SOURCE COMPLETE - release allocation needed.\r\n\r\nUnique marker: T-0321 Talent optional AI readiness matrix scoring source capture 2026-06-25.\r\n\r\nSummary:\r\n- Added AI readiness overlay with five AI dimensions, per-archetype AI profiles, and indirect AI evidence questions.\r\n- Added recruiter opt-in fields on talent_role.\r\n- Added matrix behavior to insert/remove an editable AI readiness deliverable and editable AI dimensions.\r\n- AI readiness is optional, scored, and recruiter-modifiable like other matrix components.\r\n- Source branch: codex-ai-readiness-matrix. Commit: d01a487.\r\n- Talent dev Supabase was updated; production was not touched.\r\n\r\nRelease allocation: not allocated.", "initial_user_message": "Capture Talent archetype library expansion and optional AI readiness matrix scoring in BOH-dev Counter tickets.", "priority_key": "high", "requester_email": "boshea@jobzcafe.com", "requester_name": "Dr. Bron OShea", "source": "codex", "status_key": "new", "subject": "Add optional AI readiness scoring to Talent role matrices", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0321", "updated_at": "2026-06-25 00:25:17.983678+00"}, {"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "talent", "app_context": "boh", "app_slug": "talent", "category": "content", "code_freeze_date": null, "created_at": "2026-06-25 00:26:21.638953+00", "description": "Status: OPEN - content validation required before promotion.\r\n\r\nUnique marker: T-0322 Talent archetype content review follow-up 2026-06-25.\r\n\r\nScope:\r\n- Review each role family workbook for duplicate wording, weak differentiation, and recruiter usefulness.\r\n- Refine HR leadership and Talent Acquisition content where deliverables/questions may feel repetitive.\r\n- Review AI readiness overlays so role-specific language is not overly generic.\r\n- Confirm questions remain indirect and do not give away deliverables.\r\n- Confirm O*NET/BLS/current-market evidence is sufficient for recruiter-facing substantiation.\r\n\r\nAcceptance criteria:\r\n- Each archetype family has reviewed deliverables, questions, dimensions, and AI guidance.\r\n- Reviewer decisions/notes are captured.\r\n- Only approved archetypes are marked ready for publish or production promotion.\r\n\r\nRelease allocation: not allocated.", "initial_user_message": "Create follow-up ticket for archetype content validation after 50-role library and AI readiness seed work.", "priority_key": "medium", "requester_email": "boshea@jobzcafe.com", "requester_name": "Dr. Bron OShea", "source": "codex", "status_key": "new", "subject": "Review and refine Talent archetype content before publish", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0322", "updated_at": "2026-06-25 00:26:21.638953+00"}, {"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "jobzcafe", "app_context": "jobzcafe", "app_slug": null, "category": "feature", "code_freeze_date": null, "created_at": "2026-06-25 00:54:48.62206+00", "description": "Status: SOURCE COMPLETE - release allocation needed.\r\n\r\nUnique marker: T-0323 JOBZ CAFE DNA module v1 source capture 2026-06-25.\r\n\r\nSummary:\r\n- Added DNA module screens for Culture Fit, Work Style, DNA Profile, and Results.\r\n- Built Culture Fit using a Competing Values Framework style point-allocation flow, result chart, local result storage, and PDF report.\r\n- Built Work Style using IPIP-derived public-domain item language, 120-question flow, trait and sub-trait scoring, local result storage, and PDF report.\r\n- Added create-dna-profile Edge Function for server-side DNA profile logic using score summaries only.\r\n- Added DNA Profile screen and PDF report combining Culture Fit and Work Style into a JOBZ CAFE DNA signature.\r\n- Source branch: codex-staging. Commits: bfac3cc through 83ba4ad.\r\n\r\nRelease allocation: not allocated.", "initial_user_message": "DNA module build completed in jobzcafe-app and needs Counter coverage before release allocation.", "priority_key": "high", "requester_email": "boshea@jobzcafe.com", "requester_name": "Bronwyn OShea", "source": "manual", "status_key": "new", "subject": "Ship JOBZ CAFE DNA module v1", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0323", "updated_at": "2026-06-25 00:54:48.62206+00"}, {"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "jobzcafe", "app_context": "jobzcafe", "app_slug": null, "category": "ui_polish", "code_freeze_date": null, "created_at": "2026-06-25 00:54:48.62206+00", "description": "Status: SOURCE COMPLETE - release allocation needed.\r\n\r\nUnique marker: T-0324 JOBZ CAFE cross-app mobile polish source capture 2026-06-25.\r\n\r\nSummary:\r\n- Reviewed and corrected mobile layout across Cafe, Journey, Coach, Mentor, DNA, Settings, bottom navigation, and bottom sheets.\r\n- Reduced horizontal overflow, clipped labels, full-width mobile controls, visible mobile scrollbars, and oversized mobile report controls.\r\n- Aligned module cards, bottom nav active states, app-themed controls, touch targets, and mobile detail/report navigation.\r\n- Removed unsupported floating puzzle background visuals from module welcome screens while preserving logo icons.\r\n- Source branch: codex-staging. Commits: 761ebc9 through 83ba4ad.\r\n\r\nRelease allocation: not allocated.", "initial_user_message": "Cross-app mobile UX polish completed during DNA release preparation.", "priority_key": "medium", "requester_email": "boshea@jobzcafe.com", "requester_name": "Bronwyn OShea", "source": "manual", "status_key": "new", "subject": "Polish JOBZ CAFE cross-app mobile experience", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0324", "updated_at": "2026-06-25 00:54:48.62206+00"}, {"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "jobzcafe", "app_context": "jobzcafe", "app_slug": null, "category": "qa", "code_freeze_date": null, "created_at": "2026-06-25 00:54:58.634468+00", "description": "Status: OPEN - staging and production-readiness validation required.\r\n\r\nUnique marker: T-0325 JOBZ CAFE DNA mobile release validation follow-up 2026-06-25.\r\n\r\nScope:\r\n- Push the final responsive breadcrumb/header fix after review.\r\n- Verify DNA, Culture Fit, Work Style, Results, Settings, Cafe, Journey, Coach, and Mentor at phone, tablet portrait, desktop, light, and dark modes.\r\n- Confirm create-dna-profile Edge Function is deployed in dev and production only after approval.\r\n- Confirm report downloads work on desktop and mobile for Culture Fit, Work Style, and DNA Profile.\r\n- Confirm no production DB writes are required for this release unless separately approved.\r\n\r\nRelease allocation: not allocated.", "initial_user_message": "Follow-up validation needed before promoting the DNA and mobile UX release to production.", "priority_key": "high", "requester_email": "boshea@jobzcafe.com", "requester_name": "Bronwyn OShea", "source": "manual", "status_key": "new", "subject": "Validate JOBZ CAFE DNA and mobile release in staging before production", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0325", "updated_at": "2026-06-25 00:54:58.634468+00"}, {"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "jobzcafe", "app_context": "jobzcafe", "app_slug": null, "category": "backend", "code_freeze_date": null, "created_at": "2026-06-25 06:14:59.190222+00", "description": "Status: OPEN - implementation required.\r\n\r\nUnique marker: T-0326 JOBZ CAFE Coach Mentor AI plan generation gateway 2026-06-25.\r\n\r\nProblem:\r\n- Dev QA confirmed Coach and Mentor onboarding questions can be completed, but plan generation fails with gemini_api_key_missing.\r\n- Current frontend code still attempts client-side Gemini access for Coach and Mentor plan generation.\r\n- This conflicts with the documented JOBZ CAFE AI architecture: new AI work should use server-side Edge Functions with server-only AI secrets.\r\n\r\nScope:\r\n- Create or extend a Supabase Edge Function for Coach and Mentor plan generation.\r\n- Use OpenAI server-side by default, with structured JSON output validation.\r\n- Keep frontend free of OpenAI, Gemini, or local model secrets.\r\n- Preserve NO FALLBACKS EVER: no fake plans, no silent provider switching, no placeholder generation.\r\n- Return clear error categories for auth, missing secret, provider failure, schema failure, and validation failure.\r\n- Update Coach and Mentor onboarding to call the gateway instead of getGeminiApiKey/client Gemini.\r\n- Add prompt/version metadata and test cases.\r\n- Evaluate local model support only as a separately configured server-side provider, never as hidden fallback behavior.\r\n\r\nQA requirement:\r\n- Complete Coach onboarding end-to-end and confirm a saved active plan.\r\n- Complete Mentor onboarding end-to-end and confirm a saved active plan.\r\n- Verify dev console has no gemini_api_key_missing error.\r\n- Verify provider secrets are not present in frontend bundle or localStorage.\r\n\r\nRelease allocation: not allocated.", "initial_user_message": "Dev QA found Coach and Mentor plan generation blocked by missing client-side Gemini key; migrate to server-side AI gateway.", "priority_key": "high", "requester_email": "boshea@jobzcafe.com", "requester_name": "Bronwyn OShea", "source": "manual", "status_key": "new", "subject": "Move Coach and Mentor plan generation behind server-side AI gateway", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0326", "updated_at": "2026-06-25 06:14:59.190222+00"}]$json$::jsonb as data
), source_rows as (
  select value as row_data
  from payload, jsonb_array_elements(payload.data) as value
), mapped as (
  select
    tenant.id as tenant_id,
    status.id as status_id,
    priority.id as priority_id,
    app.id as app_id,
    row_data
  from source_rows
  join public.boh_tenant tenant on tenant.slug = row_data->>'tenant_slug'
  join public.counter_ticket_status status on status.tenant_id = tenant.id and status.key = row_data->>'status_key'
  join public.counter_ticket_priority priority on priority.tenant_id = tenant.id and priority.key = row_data->>'priority_key'
  left join public.boh_app app on app.slug = nullif(row_data->>'app_slug', '')
), inserted as (
  insert into public.counter_ticket (
    ticket_number,
    subject,
    description,
    category,
    app,
    requester_email,
    source,
    ai_session_id,
    initial_user_message,
    created_at,
    updated_at,
    ai_summary,
    ai_category,
    ai_similarity_checked,
    status_id,
    priority_id,
    requester_name,
    app_id,
    app_context,
    testing_start_date,
    testing_end_date,
    code_freeze_date,
    tenant_id
  )
  select
    row_data->>'ticket_number',
    row_data->>'subject',
    row_data->>'description',
    row_data->>'category',
    row_data->>'app',
    row_data->>'requester_email',
    coalesce(row_data->>'source', 'manual'),
    nullif(row_data->>'ai_session_id', ''),
    row_data->>'initial_user_message',
    (row_data->>'created_at')::timestamptz,
    (row_data->>'updated_at')::timestamptz,
    nullif(row_data->>'ai_summary', ''),
    nullif(row_data->>'ai_category', ''),
    coalesce((row_data->>'ai_similarity_checked')::boolean, false),
    status_id,
    priority_id,
    row_data->>'requester_name',
    app_id,
    row_data->>'app_context',
    nullif(row_data->>'testing_start_date', '')::date,
    nullif(row_data->>'testing_end_date', '')::date,
    nullif(row_data->>'code_freeze_date', '')::date,
    tenant_id
  from mapped
  where not exists (
    select 1 from public.counter_ticket existing
    where existing.ticket_number = row_data->>'ticket_number'
  )
  returning ticket_number, subject, created_at
)
select 'inserted' as result, * from inserted
union all
select 'already_exists' as result, ct.ticket_number, ct.subject, ct.created_at
from public.counter_ticket ct
where ct.ticket_number in ('T-0320','T-0321','T-0322','T-0323','T-0324','T-0325','T-0326')
  and not exists (select 1 from inserted i where i.ticket_number = ct.ticket_number)
order by ticket_number;
