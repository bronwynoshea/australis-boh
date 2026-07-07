-- Consolidate permissive RLS policies flagged by Supabase Performance Advisor.
-- Each consolidated policy ORs existing permissive policy expressions while preserving role guards.

-- public.boh_app
drop policy if exists "boh_app_delete_admin" on "public"."boh_app";
drop policy if exists "boh_app_insert_admin" on "public"."boh_app";
drop policy if exists "boh_app_insert_internal" on "public"."boh_app";
drop policy if exists "boh_app_read_internal" on "public"."boh_app";
drop policy if exists "boh_app_select_active_bootstrap" on "public"."boh_app";
drop policy if exists "boh_app_update_admin" on "public"."boh_app";
drop policy if exists "boh_app_update_internal" on "public"."boh_app";
drop policy if exists "boh_users_full_access_boh_app" on "public"."boh_app";
create policy "advisor_consolidated_select" on "public"."boh_app" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (((is_active = true) AND (COALESCE(app_context, 'boh'::text) = 'boh'::text))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_app" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_app" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_app" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_change_request
drop policy if exists "Users can manage change requests they made" on "public"."boh_change_request";
drop policy if exists "Users can review change requests assigned to them" on "public"."boh_change_request";
drop policy if exists "Users can view change requests" on "public"."boh_change_request";
create policy "advisor_consolidated_select" on "public"."boh_change_request" as permissive for select to public using ((true and ((requested_by = ( SELECT auth.uid() AS uid))))
    or (true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_insert" on "public"."boh_change_request" as permissive for insert to public with check ((true and ((requested_by = ( SELECT auth.uid() AS uid)))));
create policy "advisor_consolidated_update" on "public"."boh_change_request" as permissive for update to public using ((true and ((requested_by = ( SELECT auth.uid() AS uid))))
    or (true and ((reviewed_by = ( SELECT auth.uid() AS uid))))) with check ((true and ((requested_by = ( SELECT auth.uid() AS uid))))
    or (true and ((reviewed_by = ( SELECT auth.uid() AS uid)))));
create policy "advisor_consolidated_delete" on "public"."boh_change_request" as permissive for delete to public using ((true and ((requested_by = ( SELECT auth.uid() AS uid)))));

-- public.boh_conversation
drop policy if exists "boh_conversation_delete_admin" on "public"."boh_conversation";
drop policy if exists "boh_conversation_insert_internal" on "public"."boh_conversation";
drop policy if exists "boh_conversation_read_internal" on "public"."boh_conversation";
drop policy if exists "boh_conversation_update_internal" on "public"."boh_conversation";
drop policy if exists "boh_users_full_access_boh_conversation" on "public"."boh_conversation";
create policy "advisor_consolidated_select" on "public"."boh_conversation" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_conversation" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_conversation" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_conversation" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_conversation_member
drop policy if exists "boh_conversation_member_delete_admin" on "public"."boh_conversation_member";
drop policy if exists "boh_conversation_member_insert_internal" on "public"."boh_conversation_member";
drop policy if exists "boh_conversation_member_read_internal" on "public"."boh_conversation_member";
drop policy if exists "boh_conversation_member_update_internal" on "public"."boh_conversation_member";
drop policy if exists "boh_users_full_access_boh_conversation_member" on "public"."boh_conversation_member";
create policy "advisor_consolidated_select" on "public"."boh_conversation_member" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_conversation_member" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_conversation_member" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_conversation_member" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_initiative
drop policy if exists "Users can delete their own initiatives or any if super admin" on "public"."boh_initiative";
drop policy if exists "Users can insert initiatives" on "public"."boh_initiative";
drop policy if exists "Users can update their own initiatives or any if super admin" on "public"."boh_initiative";
drop policy if exists "Users can view initiatives they own or all if super admin" on "public"."boh_initiative";
drop policy if exists "boh_initiative_delete" on "public"."boh_initiative";
drop policy if exists "boh_initiative_insert" on "public"."boh_initiative";
drop policy if exists "boh_initiative_select" on "public"."boh_initiative";
drop policy if exists "boh_initiative_update" on "public"."boh_initiative";
create policy "advisor_consolidated_select" on "public"."boh_initiative" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (((owner_user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = ( SELECT auth.uid() AS uid)) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin())))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_insert" on "public"."boh_initiative" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = boh_initiative.owner_user_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)))))))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_update" on "public"."boh_initiative" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (((owner_user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = ( SELECT auth.uid() AS uid)) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin())))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))) with check (((((select auth.role()) = any (array['authenticated']))) and (((owner_user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = ( SELECT auth.uid() AS uid)) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin())))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_delete" on "public"."boh_initiative" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (((owner_user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = ( SELECT auth.uid() AS uid)) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin())))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));

-- public.boh_initiative_planning_stage
drop policy if exists "Admin can manage planning stages" on "public"."boh_initiative_planning_stage";
drop policy if exists "Allow read access to planning stages" on "public"."boh_initiative_planning_stage";
create policy "advisor_consolidated_select" on "public"."boh_initiative_planning_stage" as permissive for select to public using ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role ur
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (r.code = 'admin'::text))))))
    or (true and (true)));
create policy "advisor_consolidated_insert" on "public"."boh_initiative_planning_stage" as permissive for insert to public with check ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role ur
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (r.code = 'admin'::text)))))));
create policy "advisor_consolidated_update" on "public"."boh_initiative_planning_stage" as permissive for update to public using ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role ur
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (r.code = 'admin'::text))))))) with check ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role ur
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (r.code = 'admin'::text)))))));
create policy "advisor_consolidated_delete" on "public"."boh_initiative_planning_stage" as permissive for delete to public using ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role ur
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (r.code = 'admin'::text)))))));

-- public.boh_initiative_release
drop policy if exists "Users can manage initiative-release relationships" on "public"."boh_initiative_release";
drop policy if exists "Users can view initiative-release relationships" on "public"."boh_initiative_release";
create policy "advisor_consolidated_select" on "public"."boh_initiative_release" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or (true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_insert" on "public"."boh_initiative_release" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_update" on "public"."boh_initiative_release" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))) with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_delete" on "public"."boh_initiative_release" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));

-- public.boh_invite
drop policy if exists "boh_invite_delete_admin" on "public"."boh_invite";
drop policy if exists "boh_invite_insert_internal" on "public"."boh_invite";
drop policy if exists "boh_invite_invitee_can_select" on "public"."boh_invite";
drop policy if exists "boh_invite_read_internal" on "public"."boh_invite";
drop policy if exists "boh_invite_super_admin_all" on "public"."boh_invite";
drop policy if exists "boh_invite_update_internal" on "public"."boh_invite";
drop policy if exists "boh_users_full_access_boh_invite" on "public"."boh_invite";
create policy "advisor_consolidated_select" on "public"."boh_invite" as permissive for select to public using ((true and (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (email = ( SELECT auth.email() AS email)))))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_invite" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_invite" as permissive for update to public using ((true and (is_boh_super_admin()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (is_boh_super_admin()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_invite" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_message
drop policy if exists "boh_message_delete_admin" on "public"."boh_message";
drop policy if exists "boh_message_insert_internal" on "public"."boh_message";
drop policy if exists "boh_message_read_internal" on "public"."boh_message";
drop policy if exists "boh_message_update_internal" on "public"."boh_message";
drop policy if exists "boh_users_full_access_boh_message" on "public"."boh_message";
create policy "advisor_consolidated_select" on "public"."boh_message" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_message" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_message" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_message" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_release_version
drop policy if exists "authenticated_select_release_versions" on "public"."boh_release_version";
drop policy if exists "boh admins can delete release versions" on "public"."boh_release_version";
drop policy if exists "boh admins can insert release versions" on "public"."boh_release_version";
drop policy if exists "boh admins can update release versions" on "public"."boh_release_version";
drop policy if exists "boh users can delete release versions" on "public"."boh_release_version";
drop policy if exists "boh users can insert release versions" on "public"."boh_release_version";
drop policy if exists "boh users can read release versions" on "public"."boh_release_version";
drop policy if exists "boh users can update release versions" on "public"."boh_release_version";
drop policy if exists "boh_users_full_access_boh_release_version" on "public"."boh_release_version";
create policy "advisor_consolidated_select" on "public"."boh_release_version" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_release_version" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text) AND (r.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_release_version" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text) AND (r.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text) AND (r.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_release_version" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text) AND (r.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (u.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_role
drop policy if exists "boh_role_delete_admin" on "public"."boh_role";
drop policy if exists "boh_role_insert_internal" on "public"."boh_role";
drop policy if exists "boh_role_read_internal" on "public"."boh_role";
drop policy if exists "boh_role_select_authenticated" on "public"."boh_role";
drop policy if exists "boh_role_update_internal" on "public"."boh_role";
drop policy if exists "boh_users_full_access_boh_role" on "public"."boh_role";
create policy "advisor_consolidated_select" on "public"."boh_role" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_role" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_role" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_role" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_task
drop policy if exists "Allow authenticated users to read tasks" on "public"."boh_task";
drop policy if exists "Tasks are viewable by all authenticated users" on "public"."boh_task";
drop policy if exists "Tasks can be created by authenticated users" on "public"."boh_task";
drop policy if exists "Tasks can be deleted by creator" on "public"."boh_task";
drop policy if exists "Tasks can be updated by assigned user or creator" on "public"."boh_task";
create policy "advisor_consolidated_select" on "public"."boh_task" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and (true)));
create policy "advisor_consolidated_insert" on "public"."boh_task" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and ((( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))))));
create policy "advisor_consolidated_update" on "public"."boh_task" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (((assigned_to IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (created_by IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))))))) with check (((((select auth.role()) = any (array['authenticated']))) and (((assigned_to IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (created_by IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))))));
create policy "advisor_consolidated_delete" on "public"."boh_task" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (((created_by IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))))));

-- public.boh_user
drop policy if exists "boh_user_delete_admin" on "public"."boh_user";
drop policy if exists "boh_user_insert_internal" on "public"."boh_user";
drop policy if exists "boh_user_link_invited_auth_user" on "public"."boh_user";
drop policy if exists "boh_user_read_internal" on "public"."boh_user";
drop policy if exists "boh_user_select_all" on "public"."boh_user";
drop policy if exists "boh_user_select_login_bootstrap" on "public"."boh_user";
drop policy if exists "boh_user_super_admin_all" on "public"."boh_user";
drop policy if exists "boh_user_update_internal" on "public"."boh_user";
drop policy if exists "boh_users_full_access_boh_user" on "public"."boh_user";
create policy "advisor_consolidated_select" on "public"."boh_user" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and (((app_context = 'boh'::text) AND ((auth_user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR (lower(email) = lower(( SELECT (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))) OR private.is_boh_super_admin()))))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_user" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_user" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (((app_context = 'boh'::text) AND (auth_user_id IS NULL) AND (lower(email) = lower(( SELECT (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))))))
    or (true and (is_boh_super_admin()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check (((((select auth.role()) = any (array['authenticated']))) and (((app_context = 'boh'::text) AND (auth_user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (lower(email) = lower(( SELECT (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))))))
    or (true and (is_boh_super_admin()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_user" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_user_app
drop policy if exists "boh_user_app_delete_admin" on "public"."boh_user_app";
drop policy if exists "boh_user_app_insert_internal" on "public"."boh_user_app";
drop policy if exists "boh_user_app_read_internal" on "public"."boh_user_app";
drop policy if exists "boh_user_app_select_bootstrap" on "public"."boh_user_app";
drop policy if exists "boh_user_app_select_own" on "public"."boh_user_app";
drop policy if exists "boh_user_app_super_admin_all" on "public"."boh_user_app";
drop policy if exists "boh_user_app_update_internal" on "public"."boh_user_app";
drop policy if exists "boh_users_full_access_boh_user_app" on "public"."boh_user_app";
create policy "advisor_consolidated_select" on "public"."boh_user_app" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (((app_context = 'boh'::text) AND (((user_id = current_boh_user_id()) AND (tenant_id = current_boh_tenant_id())) OR is_boh_super_admin()))))
    or (true and (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (user_id = current_boh_user_id()))))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_user_app" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_user_app" as permissive for update to public using ((true and (is_boh_super_admin()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (is_boh_super_admin()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_user_app" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_user_role
drop policy if exists "boh_user_role_delete_admin" on "public"."boh_user_role";
drop policy if exists "boh_user_role_insert_internal" on "public"."boh_user_role";
drop policy if exists "boh_user_role_read_internal" on "public"."boh_user_role";
drop policy if exists "boh_user_role_select_bootstrap" on "public"."boh_user_role";
drop policy if exists "boh_user_role_update_internal" on "public"."boh_user_role";
drop policy if exists "boh_users_full_access_boh_user_role" on "public"."boh_user_role";
create policy "advisor_consolidated_select" on "public"."boh_user_role" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (((app_context = 'boh'::text) AND (((user_id = current_boh_user_id()) AND (tenant_id = current_boh_tenant_id())) OR is_boh_super_admin()))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."boh_user_role" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."boh_user_role" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."boh_user_role" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_user())));

-- public.boh_user_story
drop policy if exists "Allow authenticated users to read stories" on "public"."boh_user_story";
drop policy if exists "Stories are viewable by all authenticated users" on "public"."boh_user_story";
drop policy if exists "Stories can be created by authenticated users" on "public"."boh_user_story";
drop policy if exists "Stories can be deleted by owner or admins" on "public"."boh_user_story";
drop policy if exists "Stories can be updated by owner or admins" on "public"."boh_user_story";
create policy "advisor_consolidated_select" on "public"."boh_user_story" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and (true)));
create policy "advisor_consolidated_insert" on "public"."boh_user_story" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and ((( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))))));
create policy "advisor_consolidated_update" on "public"."boh_user_story" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (((owner_user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))))))) with check (((((select auth.role()) = any (array['authenticated']))) and (((owner_user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))))));
create policy "advisor_consolidated_delete" on "public"."boh_user_story" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (((owner_user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (( SELECT auth.uid() AS uid) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))))));

-- public.boh_workstream
drop policy if exists "Users can create workstreams" on "public"."boh_workstream";
drop policy if exists "Users can update workstreams assigned to them" on "public"."boh_workstream";
drop policy if exists "Users can update workstreams they created" on "public"."boh_workstream";
drop policy if exists "Users can view workstreams" on "public"."boh_workstream";
create policy "advisor_consolidated_select" on "public"."boh_workstream" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_insert" on "public"."boh_workstream" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_update" on "public"."boh_workstream" as permissive for update to public using ((true and ((assigned_to = ( SELECT auth.uid() AS uid))))
    or (true and ((created_by = ( SELECT auth.uid() AS uid))))) with check ((true and ((assigned_to = ( SELECT auth.uid() AS uid))))
    or (true and ((created_by = ( SELECT auth.uid() AS uid)))));

-- public.boh_workstream_approval
drop policy if exists "Users can manage approvals they requested" on "public"."boh_workstream_approval";
drop policy if exists "Users can review approvals assigned to them" on "public"."boh_workstream_approval";
drop policy if exists "Users can view approvals" on "public"."boh_workstream_approval";
create policy "advisor_consolidated_select" on "public"."boh_workstream_approval" as permissive for select to public using ((true and ((requested_by = ( SELECT auth.uid() AS uid))))
    or (true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_insert" on "public"."boh_workstream_approval" as permissive for insert to public with check ((true and ((requested_by = ( SELECT auth.uid() AS uid)))));
create policy "advisor_consolidated_update" on "public"."boh_workstream_approval" as permissive for update to public using ((true and ((requested_by = ( SELECT auth.uid() AS uid))))
    or (true and ((reviewed_by = ( SELECT auth.uid() AS uid))))) with check ((true and ((requested_by = ( SELECT auth.uid() AS uid))))
    or (true and ((reviewed_by = ( SELECT auth.uid() AS uid)))));
create policy "advisor_consolidated_delete" on "public"."boh_workstream_approval" as permissive for delete to public using ((true and ((requested_by = ( SELECT auth.uid() AS uid)))));

-- public.cellar_activity_events
drop policy if exists "cellar_activity_events_staff_insert" on "public"."cellar_activity_events";
drop policy if exists "cellar_activity_events_staff_read" on "public"."cellar_activity_events";
drop policy if exists "cellar_activity_events_verified_self_read" on "public"."cellar_activity_events";
create policy "advisor_consolidated_select" on "public"."cellar_activity_events" as permissive for select to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (((investor_access_id IS NOT NULL) AND cellar_private.is_verified_investor(investor_access_id)))));
create policy "advisor_consolidated_insert" on "public"."cellar_activity_events" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL) AND (actor_kind = 'staff'::text) AND (actor_boh_user_id = cellar_private.current_boh_user_id())))));

-- public.cellar_asset_access_requests
drop policy if exists "cellar_asset_access_requests_staff_all" on "public"."cellar_asset_access_requests";
drop policy if exists "cellar_asset_access_requests_verified_self_read" on "public"."cellar_asset_access_requests";
create policy "advisor_consolidated_select" on "public"."cellar_asset_access_requests" as permissive for select to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (cellar_private.is_verified_investor(investor_access_id))));
create policy "advisor_consolidated_insert" on "public"."cellar_asset_access_requests" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_update" on "public"."cellar_asset_access_requests" as permissive for update to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))) with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_delete" on "public"."cellar_asset_access_requests" as permissive for delete to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));

-- public.cellar_assets
drop policy if exists "cellar_assets_staff_all" on "public"."cellar_assets";
drop policy if exists "cellar_assets_verified_read_published" on "public"."cellar_assets";
create policy "advisor_consolidated_select" on "public"."cellar_assets" as permissive for select to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (((tenant_id = cellar_private.current_investor_access_tenant_id()) AND (status = 'published'::text) AND (investor_kb_scope = 'investor_kb'::text) AND (((visibility = ANY (ARRAY['guest'::text, 'verified'::text])) AND cellar_private.has_verified_investor_access()) OR ((visibility = 'appendix_granted'::text) AND (cellar_private.current_investor_access_status() = 'appendix_granted'::text)))))));
create policy "advisor_consolidated_insert" on "public"."cellar_assets" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_update" on "public"."cellar_assets" as permissive for update to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))) with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_delete" on "public"."cellar_assets" as permissive for delete to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));

-- public.cellar_booking_link_audits
drop policy if exists "cellar_booking_link_audits_staff_read" on "public"."cellar_booking_link_audits";
drop policy if exists "cellar_booking_link_audits_verified_self_read" on "public"."cellar_booking_link_audits";
create policy "advisor_consolidated_select" on "public"."cellar_booking_link_audits" as permissive for select to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (((investor_access_id IS NOT NULL) AND cellar_private.is_verified_investor(investor_access_id)))));

-- public.cellar_investor_access
drop policy if exists "cellar_investor_access_staff_all" on "public"."cellar_investor_access";
drop policy if exists "cellar_investor_access_verified_self_read" on "public"."cellar_investor_access";
create policy "advisor_consolidated_select" on "public"."cellar_investor_access" as permissive for select to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (auth_user_id = ( SELECT auth.uid() AS uid))))));
create policy "advisor_consolidated_insert" on "public"."cellar_investor_access" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_update" on "public"."cellar_investor_access" as permissive for update to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))) with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_delete" on "public"."cellar_investor_access" as permissive for delete to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));

-- public.cellar_investor_notes
drop policy if exists "cellar_investor_notes_staff_shared_read" on "public"."cellar_investor_notes";
drop policy if exists "cellar_investor_notes_verified_self_all" on "public"."cellar_investor_notes";
create policy "advisor_consolidated_select" on "public"."cellar_investor_notes" as permissive for select to public using ((true and (((visibility = 'shared_with_staff'::text) AND cellar_private.staff_can_access_investor(investor_access_id))))
    or (true and (cellar_private.is_verified_investor(investor_access_id))));
create policy "advisor_consolidated_insert" on "public"."cellar_investor_notes" as permissive for insert to public with check ((true and (cellar_private.is_verified_investor(investor_access_id))));
create policy "advisor_consolidated_update" on "public"."cellar_investor_notes" as permissive for update to public using ((true and (cellar_private.is_verified_investor(investor_access_id)))) with check ((true and (cellar_private.is_verified_investor(investor_access_id))));
create policy "advisor_consolidated_delete" on "public"."cellar_investor_notes" as permissive for delete to public using ((true and (cellar_private.is_verified_investor(investor_access_id))));

-- public.cellar_investor_profiles
drop policy if exists "cellar_investor_profiles_self_read" on "public"."cellar_investor_profiles";
drop policy if exists "cellar_investor_profiles_staff_all" on "public"."cellar_investor_profiles";
create policy "advisor_consolidated_select" on "public"."cellar_investor_profiles" as permissive for select to public using ((true and (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (auth_user_id = ( SELECT auth.uid() AS uid)))))
    or (true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_insert" on "public"."cellar_investor_profiles" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_update" on "public"."cellar_investor_profiles" as permissive for update to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))) with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_delete" on "public"."cellar_investor_profiles" as permissive for delete to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));

-- public.cellar_investor_questions
drop policy if exists "cellar_investor_questions_staff_all" on "public"."cellar_investor_questions";
drop policy if exists "cellar_investor_questions_verified_self_read" on "public"."cellar_investor_questions";
create policy "advisor_consolidated_select" on "public"."cellar_investor_questions" as permissive for select to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (((investor_access_id IS NOT NULL) AND cellar_private.is_verified_investor(investor_access_id)))));
create policy "advisor_consolidated_insert" on "public"."cellar_investor_questions" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_update" on "public"."cellar_investor_questions" as permissive for update to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))) with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_delete" on "public"."cellar_investor_questions" as permissive for delete to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));

-- public.cellar_message_threads
drop policy if exists "cellar_message_threads_staff_all" on "public"."cellar_message_threads";
drop policy if exists "cellar_message_threads_verified_self_read" on "public"."cellar_message_threads";
create policy "advisor_consolidated_select" on "public"."cellar_message_threads" as permissive for select to public using ((true and (cellar_private.staff_can_access_investor(investor_access_id)))
    or (true and (cellar_private.is_verified_investor(investor_access_id))));
create policy "advisor_consolidated_insert" on "public"."cellar_message_threads" as permissive for insert to public with check ((true and (cellar_private.staff_can_access_investor(investor_access_id))));
create policy "advisor_consolidated_update" on "public"."cellar_message_threads" as permissive for update to public using ((true and (cellar_private.staff_can_access_investor(investor_access_id)))) with check ((true and (cellar_private.staff_can_access_investor(investor_access_id))));
create policy "advisor_consolidated_delete" on "public"."cellar_message_threads" as permissive for delete to public using ((true and (cellar_private.staff_can_access_investor(investor_access_id))));

-- public.cellar_messages
drop policy if exists "cellar_messages_staff_all" on "public"."cellar_messages";
drop policy if exists "cellar_messages_verified_self_read" on "public"."cellar_messages";
create policy "advisor_consolidated_select" on "public"."cellar_messages" as permissive for select to public using ((true and (cellar_private.staff_can_access_investor(investor_access_id)))
    or (true and (cellar_private.is_verified_investor(investor_access_id))));
create policy "advisor_consolidated_insert" on "public"."cellar_messages" as permissive for insert to public with check ((true and (cellar_private.staff_can_access_investor(investor_access_id))));
create policy "advisor_consolidated_update" on "public"."cellar_messages" as permissive for update to public using ((true and (cellar_private.staff_can_access_investor(investor_access_id)))) with check ((true and (cellar_private.staff_can_access_investor(investor_access_id))));
create policy "advisor_consolidated_delete" on "public"."cellar_messages" as permissive for delete to public using ((true and (cellar_private.staff_can_access_investor(investor_access_id))));

-- public.cellar_prepared_qa
drop policy if exists "cellar_prepared_qa_guest_read_published" on "public"."cellar_prepared_qa";
drop policy if exists "cellar_prepared_qa_staff_all" on "public"."cellar_prepared_qa";
drop policy if exists "cellar_prepared_qa_verified_read_published" on "public"."cellar_prepared_qa";
create policy "advisor_consolidated_select" on "public"."cellar_prepared_qa" as permissive for select to public using ((true and (((status = 'published'::text) AND (visibility = 'guest'::text) AND (investor_kb_scope = 'investor_kb'::text))))
    or (true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (((tenant_id = cellar_private.current_investor_access_tenant_id()) AND (status = 'published'::text) AND (investor_kb_scope = 'investor_kb'::text) AND (((visibility = ANY (ARRAY['guest'::text, 'verified'::text])) AND cellar_private.has_verified_investor_access()) OR ((visibility = 'appendix_granted'::text) AND (cellar_private.current_investor_access_status() = 'appendix_granted'::text)))))));
create policy "advisor_consolidated_insert" on "public"."cellar_prepared_qa" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_update" on "public"."cellar_prepared_qa" as permissive for update to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))) with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_delete" on "public"."cellar_prepared_qa" as permissive for delete to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));

-- public.cellar_presentations
drop policy if exists "cellar_presentations_staff_all" on "public"."cellar_presentations";
drop policy if exists "cellar_presentations_verified_read_published" on "public"."cellar_presentations";
create policy "advisor_consolidated_select" on "public"."cellar_presentations" as permissive for select to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))
    or (true and (((tenant_id = cellar_private.current_investor_access_tenant_id()) AND (status = 'published'::text) AND cellar_private.has_verified_investor_access()))));
create policy "advisor_consolidated_insert" on "public"."cellar_presentations" as permissive for insert to public with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_update" on "public"."cellar_presentations" as permissive for update to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL))))) with check ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));
create policy "advisor_consolidated_delete" on "public"."cellar_presentations" as permissive for delete to public using ((true and (((tenant_id = cellar_private.current_staff_tenant_id()) AND (cellar_private.current_boh_user_id() IS NOT NULL)))));

-- public.central_agent_capability_bindings
drop policy if exists "Allow authenticated read agent capability bindings" on "public"."central_agent_capability_bindings";
drop policy if exists "Allow authenticated write agent capability bindings" on "public"."central_agent_capability_bindings";
create policy "advisor_consolidated_select" on "public"."central_agent_capability_bindings" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or (true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_insert" on "public"."central_agent_capability_bindings" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_update" on "public"."central_agent_capability_bindings" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))) with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_delete" on "public"."central_agent_capability_bindings" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));

-- public.central_agents
drop policy if exists "central_agents_admin_approve" on "public"."central_agents";
drop policy if exists "central_agents_create_draft" on "public"."central_agents";
drop policy if exists "central_agents_no_delete" on "public"."central_agents";
drop policy if exists "central_agents_no_insert" on "public"."central_agents";
drop policy if exists "central_agents_no_select" on "public"."central_agents";
drop policy if exists "central_agents_no_update" on "public"."central_agents";
drop policy if exists "central_agents_update_own_draft" on "public"."central_agents";
drop policy if exists "central_agents_view_active" on "public"."central_agents";
create policy "advisor_consolidated_select" on "public"."central_agents" as permissive for select to public using (((((select auth.role()) = any (array['anon', 'authenticated']))) and (false))
    or (true and (((agent_status = 'active'::text) OR ((agent_status = ANY (ARRAY['draft'::text, 'pending_approval'::text])) AND (created_by = ( SELECT auth.uid() AS uid)))))));
create policy "advisor_consolidated_insert" on "public"."central_agents" as permissive for insert to public with check ((true and (((agent_status = 'draft'::text) AND (created_by = ( SELECT auth.uid() AS uid)))))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false)));
create policy "advisor_consolidated_update" on "public"."central_agents" as permissive for update to public using ((true and ((agent_status = ANY (ARRAY['draft'::text, 'pending_approval'::text]))))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false))
    or (true and (((created_by = ( SELECT auth.uid() AS uid)) AND (agent_status = ANY (ARRAY['draft'::text, 'pending_approval'::text])))))) with check ((true and ((agent_status = ANY (ARRAY['draft'::text, 'pending_approval'::text]))))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false))
    or (true and (((created_by = ( SELECT auth.uid() AS uid)) AND (agent_status = ANY (ARRAY['draft'::text, 'pending_approval'::text]))))));
create policy "advisor_consolidated_delete" on "public"."central_agents" as permissive for delete to public using (((((select auth.role()) = any (array['anon', 'authenticated']))) and (false)));

-- public.central_capabilities
drop policy if exists "Allow authenticated read central capabilities" on "public"."central_capabilities";
drop policy if exists "Allow authenticated write central capabilities" on "public"."central_capabilities";
create policy "advisor_consolidated_select" on "public"."central_capabilities" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or (true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_insert" on "public"."central_capabilities" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_update" on "public"."central_capabilities" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))) with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));
create policy "advisor_consolidated_delete" on "public"."central_capabilities" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text))));

-- public.central_task
drop policy if exists "Allow authenticated delete to tasks" on "public"."central_task";
drop policy if exists "Allow authenticated insert to tasks" on "public"."central_task";
drop policy if exists "Allow authenticated read access to tasks" on "public"."central_task";
drop policy if exists "Allow authenticated update to tasks" on "public"."central_task";
drop policy if exists "central_task_no_delete" on "public"."central_task";
drop policy if exists "central_task_no_insert" on "public"."central_task";
drop policy if exists "central_task_no_select" on "public"."central_task";
drop policy if exists "central_task_no_update" on "public"."central_task";
create policy "advisor_consolidated_select" on "public"."central_task" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false)));
create policy "advisor_consolidated_insert" on "public"."central_task" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false)));
create policy "advisor_consolidated_update" on "public"."central_task" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false))) with check ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false)));
create policy "advisor_consolidated_delete" on "public"."central_task" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'authenticated'::text)))
    or ((((select auth.role()) = any (array['anon', 'authenticated']))) and (false)));

-- public.keep_quick_link
drop policy if exists "keep_quick_link_delete_user" on "public"."keep_quick_link";
drop policy if exists "keep_quick_link_insert_user" on "public"."keep_quick_link";
drop policy if exists "keep_quick_link_select_crew" on "public"."keep_quick_link";
drop policy if exists "keep_quick_link_select_user" on "public"."keep_quick_link";
drop policy if exists "keep_quick_link_update_user" on "public"."keep_quick_link";
create policy "advisor_consolidated_select" on "public"."keep_quick_link" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (((link_scope = 'crew'::text) AND (is_active = true))))
    or ((((select auth.role()) = any (array['authenticated']))) and (((link_scope = 'user'::text) AND (is_active = true) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_quick_link.user_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)))))))));
create policy "advisor_consolidated_insert" on "public"."keep_quick_link" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and (((link_scope = 'user'::text) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_quick_link.user_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_quick_link.created_by) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)))))))));
create policy "advisor_consolidated_update" on "public"."keep_quick_link" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (((link_scope = 'user'::text) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_quick_link.user_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid))))))))) with check (((((select auth.role()) = any (array['authenticated']))) and (((link_scope = 'user'::text) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_quick_link.user_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)))))))));
create policy "advisor_consolidated_delete" on "public"."keep_quick_link" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (((link_scope = 'user'::text) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_quick_link.user_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)))))))));

-- public.keep_user_access
drop policy if exists "Super admins can manage keep_user_access" on "public"."keep_user_access";
drop policy if exists "Users can view their own keep_user_access" on "public"."keep_user_access";
create policy "advisor_consolidated_select" on "public"."keep_user_access" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_super_admin()))
    or ((((select auth.role()) = any (array['authenticated']))) and ((user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = ( SELECT auth.uid() AS uid)) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)))));
create policy "advisor_consolidated_insert" on "public"."keep_user_access" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and (is_boh_super_admin())));
create policy "advisor_consolidated_update" on "public"."keep_user_access" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_super_admin()))) with check (((((select auth.role()) = any (array['authenticated']))) and (is_boh_super_admin())));
create policy "advisor_consolidated_delete" on "public"."keep_user_access" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_super_admin())));

-- public.loft_room_member
drop policy if exists "loft_room_member_mutate_authenticated_self_or_host" on "public"."loft_room_member";
drop policy if exists "loft_room_member_select_authenticated_accessible" on "public"."loft_room_member";
create policy "advisor_consolidated_select" on "public"."loft_room_member" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (((boh_user_id = private.current_boh_user_id()) OR (EXISTS ( SELECT 1
   FROM loft_room lr
  WHERE ((lr.id = loft_room_member.loft_room_id) AND (lr.host_boh_user_id = private.current_boh_user_id())))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (((boh_user_id = private.current_boh_user_id()) OR private.loft_room_is_accessible(loft_room_id)))));
create policy "advisor_consolidated_insert" on "public"."loft_room_member" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and (((boh_user_id = private.current_boh_user_id()) OR (EXISTS ( SELECT 1
   FROM loft_room lr
  WHERE ((lr.id = loft_room_member.loft_room_id) AND (lr.host_boh_user_id = private.current_boh_user_id()))))))));
create policy "advisor_consolidated_update" on "public"."loft_room_member" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (((boh_user_id = private.current_boh_user_id()) OR (EXISTS ( SELECT 1
   FROM loft_room lr
  WHERE ((lr.id = loft_room_member.loft_room_id) AND (lr.host_boh_user_id = private.current_boh_user_id())))))))) with check (((((select auth.role()) = any (array['authenticated']))) and (((boh_user_id = private.current_boh_user_id()) OR (EXISTS ( SELECT 1
   FROM loft_room lr
  WHERE ((lr.id = loft_room_member.loft_room_id) AND (lr.host_boh_user_id = private.current_boh_user_id()))))))));
create policy "advisor_consolidated_delete" on "public"."loft_room_member" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (((boh_user_id = private.current_boh_user_id()) OR (EXISTS ( SELECT 1
   FROM loft_room lr
  WHERE ((lr.id = loft_room_member.loft_room_id) AND (lr.host_boh_user_id = private.current_boh_user_id()))))))));

-- public.loft_room_rsvp
drop policy if exists "loft_room_rsvp_mutate_authenticated_self" on "public"."loft_room_rsvp";
drop policy if exists "loft_room_rsvp_select_authenticated_self_or_room" on "public"."loft_room_rsvp";
create policy "advisor_consolidated_select" on "public"."loft_room_rsvp" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and ((boh_user_id = private.current_boh_user_id())))
    or ((((select auth.role()) = any (array['authenticated']))) and (((boh_user_id = private.current_boh_user_id()) OR private.loft_room_is_accessible(loft_room_id)))));
create policy "advisor_consolidated_insert" on "public"."loft_room_rsvp" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and ((boh_user_id = private.current_boh_user_id()))));
create policy "advisor_consolidated_update" on "public"."loft_room_rsvp" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and ((boh_user_id = private.current_boh_user_id())))) with check (((((select auth.role()) = any (array['authenticated']))) and ((boh_user_id = private.current_boh_user_id()))));
create policy "advisor_consolidated_delete" on "public"."loft_room_rsvp" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and ((boh_user_id = private.current_boh_user_id()))));

-- public.outlook_calendar_sync
drop policy if exists "Users can manage own calendar sync" on "public"."outlook_calendar_sync";
drop policy if exists "Users can view own calendar sync" on "public"."outlook_calendar_sync";
create policy "advisor_consolidated_select" on "public"."outlook_calendar_sync" as permissive for select to public using ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id)))))
    or (true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id))))));
create policy "advisor_consolidated_insert" on "public"."outlook_calendar_sync" as permissive for insert to public with check ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id))))));
create policy "advisor_consolidated_update" on "public"."outlook_calendar_sync" as permissive for update to public using ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id)))))) with check ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id))))));
create policy "advisor_consolidated_delete" on "public"."outlook_calendar_sync" as permissive for delete to public using ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id))))));

-- public.outlook_synced_events
drop policy if exists "Public can read outlook events for booking" on "public"."outlook_synced_events";
drop policy if exists "Users can manage own synced events" on "public"."outlook_synced_events";
drop policy if exists "Users can view own synced events" on "public"."outlook_synced_events";
create policy "advisor_consolidated_select" on "public"."outlook_synced_events" as permissive for select to public using ((true and (true))
    or (true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id)))))
    or (true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id))))));
create policy "advisor_consolidated_insert" on "public"."outlook_synced_events" as permissive for insert to public with check ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id))))));
create policy "advisor_consolidated_update" on "public"."outlook_synced_events" as permissive for update to public using ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id)))))) with check ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id))))));
create policy "advisor_consolidated_delete" on "public"."outlook_synced_events" as permissive for delete to public using ((true and ((( SELECT auth.uid() AS uid) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id))))));

-- public.patron_activity
drop policy if exists "patron_activity_bohrw" on "public"."patron_activity";
drop policy if exists "patron_activity_delete_admin" on "public"."patron_activity";
drop policy if exists "patron_activity_insert_internal" on "public"."patron_activity";
drop policy if exists "patron_activity_read_internal" on "public"."patron_activity";
drop policy if exists "patron_activity_staff_full_access" on "public"."patron_activity";
drop policy if exists "patron_activity_update_internal" on "public"."patron_activity";
create policy "advisor_consolidated_select" on "public"."patron_activity" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_activity" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_activity" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_activity" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_custom_field
drop policy if exists "patron_custom_field_bohrw" on "public"."patron_custom_field";
drop policy if exists "patron_custom_field_delete_admin" on "public"."patron_custom_field";
drop policy if exists "patron_custom_field_insert_internal" on "public"."patron_custom_field";
drop policy if exists "patron_custom_field_read_internal" on "public"."patron_custom_field";
drop policy if exists "patron_custom_field_staff_full_access" on "public"."patron_custom_field";
drop policy if exists "patron_custom_field_update_internal" on "public"."patron_custom_field";
create policy "advisor_consolidated_select" on "public"."patron_custom_field" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_custom_field" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_custom_field" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_custom_field" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_organisation
drop policy if exists "patron_organisation_bohrw" on "public"."patron_organisation";
drop policy if exists "patron_organisation_delete_admin" on "public"."patron_organisation";
drop policy if exists "patron_organisation_insert_internal" on "public"."patron_organisation";
drop policy if exists "patron_organisation_read_internal" on "public"."patron_organisation";
drop policy if exists "patron_organisation_staff_full_access" on "public"."patron_organisation";
drop policy if exists "patron_organisation_update_internal" on "public"."patron_organisation";
create policy "advisor_consolidated_select" on "public"."patron_organisation" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_organisation" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_organisation" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_organisation" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_organisation_field_value
drop policy if exists "patron_organisation_field_value_bohrw" on "public"."patron_organisation_field_value";
drop policy if exists "patron_organisation_field_value_delete_admin" on "public"."patron_organisation_field_value";
drop policy if exists "patron_organisation_field_value_insert_internal" on "public"."patron_organisation_field_value";
drop policy if exists "patron_organisation_field_value_read_internal" on "public"."patron_organisation_field_value";
drop policy if exists "patron_organisation_field_value_staff_full_access" on "public"."patron_organisation_field_value";
drop policy if exists "patron_organisation_field_value_update_internal" on "public"."patron_organisation_field_value";
create policy "advisor_consolidated_select" on "public"."patron_organisation_field_value" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_organisation_field_value" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_organisation_field_value" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_organisation_field_value" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_organisation_tag
drop policy if exists "patron_organisation_tag_bohrw" on "public"."patron_organisation_tag";
drop policy if exists "patron_organisation_tag_delete_admin" on "public"."patron_organisation_tag";
drop policy if exists "patron_organisation_tag_insert_internal" on "public"."patron_organisation_tag";
drop policy if exists "patron_organisation_tag_read_internal" on "public"."patron_organisation_tag";
drop policy if exists "patron_organisation_tag_staff_full_access" on "public"."patron_organisation_tag";
drop policy if exists "patron_organisation_tag_update_internal" on "public"."patron_organisation_tag";
create policy "advisor_consolidated_select" on "public"."patron_organisation_tag" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_organisation_tag" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_organisation_tag" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_organisation_tag" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_person
drop policy if exists "patron_person_bohrw" on "public"."patron_person";
drop policy if exists "patron_person_delete_admin" on "public"."patron_person";
drop policy if exists "patron_person_insert_internal" on "public"."patron_person";
drop policy if exists "patron_person_read_internal" on "public"."patron_person";
drop policy if exists "patron_person_staff_full_access" on "public"."patron_person";
drop policy if exists "patron_person_update_internal" on "public"."patron_person";
create policy "advisor_consolidated_select" on "public"."patron_person" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_person" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_person" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_person" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_person_field_value
drop policy if exists "patron_person_field_value_bohrw" on "public"."patron_person_field_value";
drop policy if exists "patron_person_field_value_delete_admin" on "public"."patron_person_field_value";
drop policy if exists "patron_person_field_value_insert_internal" on "public"."patron_person_field_value";
drop policy if exists "patron_person_field_value_read_internal" on "public"."patron_person_field_value";
drop policy if exists "patron_person_field_value_staff_full_access" on "public"."patron_person_field_value";
drop policy if exists "patron_person_field_value_update_internal" on "public"."patron_person_field_value";
create policy "advisor_consolidated_select" on "public"."patron_person_field_value" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_person_field_value" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_person_field_value" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_person_field_value" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_person_organisation
drop policy if exists "patron_person_organisation_bohrw" on "public"."patron_person_organisation";
drop policy if exists "patron_person_organisation_delete_admin" on "public"."patron_person_organisation";
drop policy if exists "patron_person_organisation_insert_internal" on "public"."patron_person_organisation";
drop policy if exists "patron_person_organisation_read_internal" on "public"."patron_person_organisation";
drop policy if exists "patron_person_organisation_staff_full_access" on "public"."patron_person_organisation";
drop policy if exists "patron_person_organisation_update_internal" on "public"."patron_person_organisation";
create policy "advisor_consolidated_select" on "public"."patron_person_organisation" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_person_organisation" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_person_organisation" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_person_organisation" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_person_persona
drop policy if exists "patron_person_persona_delete_boh_staff" on "public"."patron_person_persona";
drop policy if exists "patron_person_persona_insert_boh_staff" on "public"."patron_person_persona";
drop policy if exists "patron_person_persona_select_boh_staff" on "public"."patron_person_persona";
drop policy if exists "patron_person_persona_staff_full_access" on "public"."patron_person_persona";
drop policy if exists "patron_person_persona_update_boh_staff" on "public"."patron_person_persona";
create policy "advisor_consolidated_select" on "public"."patron_person_persona" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_person_persona" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_person_persona" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))) with check (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or ((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_delete" on "public"."patron_person_persona" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_person_tag
drop policy if exists "patron_person_tag_bohrw" on "public"."patron_person_tag";
drop policy if exists "patron_person_tag_delete_admin" on "public"."patron_person_tag";
drop policy if exists "patron_person_tag_insert_internal" on "public"."patron_person_tag";
drop policy if exists "patron_person_tag_read_internal" on "public"."patron_person_tag";
drop policy if exists "patron_person_tag_staff_full_access" on "public"."patron_person_tag";
drop policy if exists "patron_person_tag_update_internal" on "public"."patron_person_tag";
create policy "advisor_consolidated_select" on "public"."patron_person_tag" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_person_tag" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_person_tag" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_person_tag" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_person_type
drop policy if exists "patron_person_type_select_boh_staff" on "public"."patron_person_type";
drop policy if exists "patron_person_type_staff_full_access" on "public"."patron_person_type";
create policy "advisor_consolidated_select" on "public"."patron_person_type" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_person_type" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_person_type" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))) with check (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_delete" on "public"."patron_person_type" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_persona
drop policy if exists "patron_persona_select_boh_staff" on "public"."patron_persona";
drop policy if exists "patron_persona_staff_full_access" on "public"."patron_persona";
create policy "advisor_consolidated_select" on "public"."patron_persona" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_persona" as permissive for insert to public with check (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_persona" as permissive for update to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))) with check (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_delete" on "public"."patron_persona" as permissive for delete to public using (((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_pipeline_stage
drop policy if exists "Allow admin full access to pipeline stages" on "public"."patron_pipeline_stage";
drop policy if exists "Allow read access to pipeline stages" on "public"."patron_pipeline_stage";
drop policy if exists "patron_pipeline_stage_staff_full_access" on "public"."patron_pipeline_stage";
create policy "advisor_consolidated_select" on "public"."patron_pipeline_stage" as permissive for select to public using ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role bur
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bur.user_id = ( SELECT auth.uid() AS uid)) AND (br.code = 'admin'::text))))))
    or (true and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_pipeline_stage" as permissive for insert to public with check ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role bur
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bur.user_id = ( SELECT auth.uid() AS uid)) AND (br.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_pipeline_stage" as permissive for update to public using ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role bur
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bur.user_id = ( SELECT auth.uid() AS uid)) AND (br.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))) with check ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role bur
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bur.user_id = ( SELECT auth.uid() AS uid)) AND (br.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_delete" on "public"."patron_pipeline_stage" as permissive for delete to public using ((true and ((EXISTS ( SELECT 1
   FROM (boh_user_role bur
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bur.user_id = ( SELECT auth.uid() AS uid)) AND (br.code = 'admin'::text))))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.patron_tag
drop policy if exists "patron_tag_bohrw" on "public"."patron_tag";
drop policy if exists "patron_tag_delete_admin" on "public"."patron_tag";
drop policy if exists "patron_tag_insert_internal" on "public"."patron_tag";
drop policy if exists "patron_tag_read_internal" on "public"."patron_tag";
drop policy if exists "patron_tag_staff_full_access" on "public"."patron_tag";
drop policy if exists "patron_tag_update_internal" on "public"."patron_tag";
create policy "advisor_consolidated_select" on "public"."patron_tag" as permissive for select to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_insert" on "public"."patron_tag" as permissive for insert to public with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));
create policy "advisor_consolidated_update" on "public"."patron_tag" as permissive for update to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))) with check ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff()))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])))));
create policy "advisor_consolidated_delete" on "public"."patron_tag" as permissive for delete to public using ((true and ((( SELECT auth.role() AS role) = 'boh'::text)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or ((((select auth.role()) = any (array['authenticated']))) and (is_boh_staff())));

-- public.scheduling_availability_rules
drop policy if exists "Public read availability (for slot calculation)" on "public"."scheduling_availability_rules";
drop policy if exists "Staff manage their rules" on "public"."scheduling_availability_rules";
create policy "advisor_consolidated_select" on "public"."scheduling_availability_rules" as permissive for select to public using ((true and (true))
    or (true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_availability_rules.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_insert" on "public"."scheduling_availability_rules" as permissive for insert to public with check ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_availability_rules.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_update" on "public"."scheduling_availability_rules" as permissive for update to public using ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_availability_rules.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))) with check ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_availability_rules.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_delete" on "public"."scheduling_availability_rules" as permissive for delete to public using ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_availability_rules.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));

-- public.scheduling_blackout_dates
drop policy if exists "Public read blackout dates" on "public"."scheduling_blackout_dates";
drop policy if exists "Staff manage their blackout dates" on "public"."scheduling_blackout_dates";
create policy "advisor_consolidated_select" on "public"."scheduling_blackout_dates" as permissive for select to public using ((true and (true))
    or (true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_blackout_dates.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_insert" on "public"."scheduling_blackout_dates" as permissive for insert to public with check ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_blackout_dates.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_update" on "public"."scheduling_blackout_dates" as permissive for update to public using ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_blackout_dates.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))) with check ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_blackout_dates.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_delete" on "public"."scheduling_blackout_dates" as permissive for delete to public using ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_blackout_dates.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));

-- public.scheduling_bookings
drop policy if exists "Public can insert bookings" on "public"."scheduling_bookings";
drop policy if exists "Public can view bookings" on "public"."scheduling_bookings";
drop policy if exists "Staff update their own bookings" on "public"."scheduling_bookings";
drop policy if exists "Staff view their own bookings" on "public"."scheduling_bookings";
drop policy if exists "Users can delete their own bookings" on "public"."scheduling_bookings";
drop policy if exists "Users can insert bookings" on "public"."scheduling_bookings";
drop policy if exists "Users can insert their own bookings" on "public"."scheduling_bookings";
drop policy if exists "Users can update their own bookings" on "public"."scheduling_bookings";
drop policy if exists "Users can view their own bookings" on "public"."scheduling_bookings";
drop policy if exists "guests_can_create_bookings_limited" on "public"."scheduling_bookings";
create policy "advisor_consolidated_select" on "public"."scheduling_bookings" as permissive for select to public using ((true and (true))
    or (true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_bookings.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))
    or (true and ((( SELECT auth.uid() AS uid) IS NOT NULL))));
create policy "advisor_consolidated_insert" on "public"."scheduling_bookings" as permissive for insert to public with check ((true and (((guest_email IS NOT NULL) AND (guest_name IS NOT NULL) AND (meeting_type_id IS NOT NULL) AND (staff_id IS NOT NULL))))
    or (true and ((( SELECT auth.uid() AS uid) IS NOT NULL)))
    or (true and ((( SELECT auth.uid() AS uid) IS NOT NULL)))
    or ((((select auth.role()) = any (array['anon']))) and (((guest_email IS NOT NULL) AND (guest_name IS NOT NULL) AND (start_time > now()) AND (end_time > start_time)))));
create policy "advisor_consolidated_update" on "public"."scheduling_bookings" as permissive for update to public using ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_bookings.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))
    or (true and ((( SELECT auth.uid() AS uid) IS NOT NULL)))) with check ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_bookings.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))
    or (true and ((( SELECT auth.uid() AS uid) IS NOT NULL))));
create policy "advisor_consolidated_delete" on "public"."scheduling_bookings" as permissive for delete to public using ((true and ((( SELECT auth.uid() AS uid) IS NOT NULL))));

-- public.scheduling_meeting_types
drop policy if exists "Public read meeting types" on "public"."scheduling_meeting_types";
drop policy if exists "Staff manage their own meeting types" on "public"."scheduling_meeting_types";
create policy "advisor_consolidated_select" on "public"."scheduling_meeting_types" as permissive for select to public using ((true and (true))
    or (true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_meeting_types.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_insert" on "public"."scheduling_meeting_types" as permissive for insert to public with check ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_meeting_types.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_update" on "public"."scheduling_meeting_types" as permissive for update to public using ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_meeting_types.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid)))))))) with check ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_meeting_types.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "advisor_consolidated_delete" on "public"."scheduling_meeting_types" as permissive for delete to public using ((true and ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_meeting_types.staff_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))));

-- public.soundbyte_profile_audiences
drop policy if exists "soundbyte_audiences_owner_write" on "public"."soundbyte_profile_audiences";
drop policy if exists "soundbyte_audiences_read_all_boh" on "public"."soundbyte_profile_audiences";
create policy "advisor_consolidated_select" on "public"."soundbyte_profile_audiences" as permissive for select to public using ((true and ((EXISTS ( SELECT 1
   FROM (soundbyte_profiles sp
     JOIN boh_user bu ON ((sp.owner_user_id = bu.id)))
  WHERE ((sp.id = soundbyte_profile_audiences.soundbyte_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))
    or (true and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_insert" on "public"."soundbyte_profile_audiences" as permissive for insert to public with check ((true and ((EXISTS ( SELECT 1
   FROM (soundbyte_profiles sp
     JOIN boh_user bu ON ((sp.owner_user_id = bu.id)))
  WHERE ((sp.id = soundbyte_profile_audiences.soundbyte_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_update" on "public"."soundbyte_profile_audiences" as permissive for update to public using ((true and ((EXISTS ( SELECT 1
   FROM (soundbyte_profiles sp
     JOIN boh_user bu ON ((sp.owner_user_id = bu.id)))
  WHERE ((sp.id = soundbyte_profile_audiences.soundbyte_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))) with check ((true and ((EXISTS ( SELECT 1
   FROM (soundbyte_profiles sp
     JOIN boh_user bu ON ((sp.owner_user_id = bu.id)))
  WHERE ((sp.id = soundbyte_profile_audiences.soundbyte_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_delete" on "public"."soundbyte_profile_audiences" as permissive for delete to public using ((true and ((EXISTS ( SELECT 1
   FROM (soundbyte_profiles sp
     JOIN boh_user bu ON ((sp.owner_user_id = bu.id)))
  WHERE ((sp.id = soundbyte_profile_audiences.soundbyte_id) AND (bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));

-- public.soundbyte_profiles
drop policy if exists "soundbyte_profiles_owner_write" on "public"."soundbyte_profiles";
drop policy if exists "soundbyte_profiles_read_all_boh" on "public"."soundbyte_profiles";
create policy "advisor_consolidated_select" on "public"."soundbyte_profiles" as permissive for select to public using ((true and ((owner_user_id IN ( SELECT bu.id
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))
    or (true and ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_insert" on "public"."soundbyte_profiles" as permissive for insert to public with check ((true and ((owner_user_id IN ( SELECT bu.id
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_update" on "public"."soundbyte_profiles" as permissive for update to public using ((true and ((owner_user_id IN ( SELECT bu.id
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text))))))) with check ((true and ((owner_user_id IN ( SELECT bu.id
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));
create policy "advisor_consolidated_delete" on "public"."soundbyte_profiles" as permissive for delete to public using ((true and ((owner_user_id IN ( SELECT bu.id
   FROM boh_user bu
  WHERE ((bu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (bu.status = 'active'::text)))))));

-- public.tablez_chair
drop policy if exists "boh_chair_delete_admin" on "public"."tablez_chair";
drop policy if exists "boh_chair_insert_internal" on "public"."tablez_chair";
drop policy if exists "boh_chair_read_internal" on "public"."tablez_chair";
drop policy if exists "boh_chair_read_own" on "public"."tablez_chair";
drop policy if exists "boh_chair_read_own_anon" on "public"."tablez_chair";
drop policy if exists "boh_chair_update_internal" on "public"."tablez_chair";
drop policy if exists "boh_chairs_delete_boh_only" on "public"."tablez_chair";
drop policy if exists "boh_chairs_insert_boh_only" on "public"."tablez_chair";
drop policy if exists "boh_chairs_select_boh_only" on "public"."tablez_chair";
drop policy if exists "boh_chairs_update_boh_only" on "public"."tablez_chair";
create policy "advisor_consolidated_select" on "public"."tablez_chair" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or ((((select auth.role()) = any (array['authenticated']))) and ((user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = ( SELECT auth.uid() AS uid))))))
    or ((((select auth.role()) = any (array['anon']))) and ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.id = tablez_chair.user_id) AND (u.auth_user_id = ( SELECT auth.uid() AS uid)))))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."tablez_chair" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."tablez_chair" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."tablez_chair" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (is_boh_user())));

-- public.tablez_chair_role
drop policy if exists "Read chair roles (authenticated)" on "public"."tablez_chair_role";
drop policy if exists "boh_chair_role_read_active" on "public"."tablez_chair_role";
drop policy if exists "boh_chair_role_read_anon" on "public"."tablez_chair_role";
drop policy if exists "boh_chair_role_read_authenticated" on "public"."tablez_chair_role";
drop policy if exists "boh_chair_role_write_service_only" on "public"."tablez_chair_role";
drop policy if exists "chair_role_select_authenticated" on "public"."tablez_chair_role";
drop policy if exists "read chair roles (authenticated)" on "public"."tablez_chair_role";
create policy "advisor_consolidated_select" on "public"."tablez_chair_role" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and ((is_active = true)))
    or ((((select auth.role()) = any (array['authenticated']))) and ((is_active = true)))
    or ((((select auth.role()) = any (array['anon']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and (true))
    or ((((select auth.role()) = any (array['service_role']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and (true))
    or ((((select auth.role()) = any (array['authenticated']))) and ((is_active = true))));
create policy "advisor_consolidated_insert" on "public"."tablez_chair_role" as permissive for insert to public with check (((((select auth.role()) = any (array['service_role']))) and (true)));
create policy "advisor_consolidated_update" on "public"."tablez_chair_role" as permissive for update to public using (((((select auth.role()) = any (array['service_role']))) and (true))) with check (((((select auth.role()) = any (array['service_role']))) and (true)));
create policy "advisor_consolidated_delete" on "public"."tablez_chair_role" as permissive for delete to public using (((((select auth.role()) = any (array['service_role']))) and (true)));

-- public.tablez_section
drop policy if exists "boh_section_delete_admin" on "public"."tablez_section";
drop policy if exists "boh_section_insert_internal" on "public"."tablez_section";
drop policy if exists "boh_section_read_internal" on "public"."tablez_section";
drop policy if exists "boh_section_update_internal" on "public"."tablez_section";
drop policy if exists "boh_sections_delete_boh_only" on "public"."tablez_section";
drop policy if exists "boh_sections_insert_boh_only" on "public"."tablez_section";
drop policy if exists "boh_sections_select_boh_only" on "public"."tablez_section";
drop policy if exists "boh_sections_update_boh_only" on "public"."tablez_section";
create policy "advisor_consolidated_select" on "public"."tablez_section" as permissive for select to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_insert" on "public"."tablez_section" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."tablez_section" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."tablez_section" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (is_boh_user())));

-- public.tablez_table
drop policy if exists "boh_table_delete_admin" on "public"."tablez_table";
drop policy if exists "boh_table_insert_internal" on "public"."tablez_table";
drop policy if exists "boh_table_read_active" on "public"."tablez_table";
drop policy if exists "boh_table_read_internal" on "public"."tablez_table";
drop policy if exists "boh_table_update_internal" on "public"."tablez_table";
drop policy if exists "boh_tables_delete_boh_only" on "public"."tablez_table";
drop policy if exists "boh_tables_insert_boh_only" on "public"."tablez_table";
drop policy if exists "boh_tables_select_boh_only" on "public"."tablez_table";
drop policy if exists "boh_tables_update_boh_only" on "public"."tablez_table";
drop policy if exists "read tables via chair" on "public"."tablez_table";
create policy "advisor_consolidated_select" on "public"."tablez_table" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and ((is_active = true)))
    or (true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text]))))
    or (true and (is_boh_user()))
    or (true and ((EXISTS ( SELECT 1
   FROM (tablez_chair c
     JOIN boh_user u ON ((u.id = c.user_id)))
  WHERE ((c.table_id = tablez_table.id) AND (u.auth_user_id = ( SELECT auth.uid() AS uid)) AND (c.is_active = true)))))));
create policy "advisor_consolidated_insert" on "public"."tablez_table" as permissive for insert to public with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_update" on "public"."tablez_table" as permissive for update to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user()))) with check ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))))
    or (true and (is_boh_user())));
create policy "advisor_consolidated_delete" on "public"."tablez_table" as permissive for delete to public using ((true and (((( SELECT auth.jwt() AS jwt) ->> 'boh_role'::text) = 'admin'::text)))
    or (true and (is_boh_user())));

-- public.tablez_task_priority
drop policy if exists "Allow authenticated read" on "public"."tablez_task_priority";
drop policy if exists "Deny writes" on "public"."tablez_task_priority";
create policy "advisor_consolidated_select" on "public"."tablez_task_priority" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (true))
    or (true and (false)));
create policy "advisor_consolidated_insert" on "public"."tablez_task_priority" as permissive for insert to public with check ((true and (false)));
create policy "advisor_consolidated_update" on "public"."tablez_task_priority" as permissive for update to public using ((true and (false))) with check ((true and (false)));
create policy "advisor_consolidated_delete" on "public"."tablez_task_priority" as permissive for delete to public using ((true and (false)));

-- public.tablez_task_status
drop policy if exists "Allow authenticated read" on "public"."tablez_task_status";
drop policy if exists "Deny writes" on "public"."tablez_task_status";
create policy "advisor_consolidated_select" on "public"."tablez_task_status" as permissive for select to public using (((((select auth.role()) = any (array['authenticated']))) and (true))
    or (true and (false)));
create policy "advisor_consolidated_insert" on "public"."tablez_task_status" as permissive for insert to public with check ((true and (false)));
create policy "advisor_consolidated_update" on "public"."tablez_task_status" as permissive for update to public using ((true and (false))) with check ((true and (false)));
create policy "advisor_consolidated_delete" on "public"."tablez_task_status" as permissive for delete to public using ((true and (false)));
