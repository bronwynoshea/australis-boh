-- Remediate auth_rls_initplan advisor findings by wrapping auth/current_setting calls in SELECT.
drop policy if exists "boh_app_delete_admin" on "public"."boh_app";
create policy "boh_app_delete_admin" on "public"."boh_app" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_app_insert_admin" on "public"."boh_app";
create policy "boh_app_insert_admin" on "public"."boh_app" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_app_insert_internal" on "public"."boh_app";
create policy "boh_app_insert_internal" on "public"."boh_app" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_app_read_internal" on "public"."boh_app";
create policy "boh_app_read_internal" on "public"."boh_app" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_app_update_admin" on "public"."boh_app";
create policy "boh_app_update_admin" on "public"."boh_app" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text)) with check ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_app_update_internal" on "public"."boh_app";
create policy "boh_app_update_internal" on "public"."boh_app" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "BOH users can read boh_app_module" on "public"."boh_app_module";
create policy "BOH users can read boh_app_module" on "public"."boh_app_module" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Admins can manage campaign banners" on "public"."boh_campaign_banner";
create policy "Admins can manage campaign banners" on "public"."boh_campaign_banner" as permissive for all to authenticated using (((select auth.role()) = 'authenticated'::text)) with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "BOH users can manage bonus tiers" on "public"."boh_campaign_bonus_tier";
create policy "BOH users can manage bonus tiers" on "public"."boh_campaign_bonus_tier" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text))))) with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "Users can manage change requests they made" on "public"."boh_change_request";
create policy "Users can manage change requests they made" on "public"."boh_change_request" as permissive for all to public using ((requested_by = (select auth.uid())));
drop policy if exists "Users can review change requests assigned to them" on "public"."boh_change_request";
create policy "Users can review change requests assigned to them" on "public"."boh_change_request" as permissive for update to public using ((reviewed_by = (select auth.uid())));
drop policy if exists "Users can view change requests" on "public"."boh_change_request";
create policy "Users can view change requests" on "public"."boh_change_request" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "boh_conversation_delete_admin" on "public"."boh_conversation";
create policy "boh_conversation_delete_admin" on "public"."boh_conversation" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_conversation_insert_internal" on "public"."boh_conversation";
create policy "boh_conversation_insert_internal" on "public"."boh_conversation" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_conversation_read_internal" on "public"."boh_conversation";
create policy "boh_conversation_read_internal" on "public"."boh_conversation" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_conversation_update_internal" on "public"."boh_conversation";
create policy "boh_conversation_update_internal" on "public"."boh_conversation" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_conversation_member_delete_admin" on "public"."boh_conversation_member";
create policy "boh_conversation_member_delete_admin" on "public"."boh_conversation_member" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_conversation_member_insert_internal" on "public"."boh_conversation_member";
create policy "boh_conversation_member_insert_internal" on "public"."boh_conversation_member" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_conversation_member_read_internal" on "public"."boh_conversation_member";
create policy "boh_conversation_member_read_internal" on "public"."boh_conversation_member" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_conversation_member_update_internal" on "public"."boh_conversation_member";
create policy "boh_conversation_member_update_internal" on "public"."boh_conversation_member" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "Users can delete their own initiatives or any if super admin" on "public"."boh_initiative";
create policy "Users can delete their own initiatives or any if super admin" on "public"."boh_initiative" as permissive for delete to authenticated using (((owner_user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = (select auth.uid())) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin()));
drop policy if exists "Users can insert initiatives" on "public"."boh_initiative";
create policy "Users can insert initiatives" on "public"."boh_initiative" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = boh_initiative.owner_user_id) AND (bu.auth_user_id = (select auth.uid()))))));
drop policy if exists "Users can update their own initiatives or any if super admin" on "public"."boh_initiative";
create policy "Users can update their own initiatives or any if super admin" on "public"."boh_initiative" as permissive for update to authenticated using (((owner_user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = (select auth.uid())) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin()));
drop policy if exists "Users can view initiatives they own or all if super admin" on "public"."boh_initiative";
create policy "Users can view initiatives they own or all if super admin" on "public"."boh_initiative" as permissive for select to authenticated using (((owner_user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = (select auth.uid())) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin()));
drop policy if exists "boh_initiative_delete" on "public"."boh_initiative";
create policy "boh_initiative_delete" on "public"."boh_initiative" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "boh_initiative_insert" on "public"."boh_initiative";
create policy "boh_initiative_insert" on "public"."boh_initiative" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "boh_initiative_select" on "public"."boh_initiative";
create policy "boh_initiative_select" on "public"."boh_initiative" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "boh_initiative_update" on "public"."boh_initiative";
create policy "boh_initiative_update" on "public"."boh_initiative" as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text))))) with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "Allow admin delete forge status" on "public"."boh_initiative_forge_status";
create policy "Allow admin delete forge status" on "public"."boh_initiative_forge_status" as permissive for delete to public using ((EXISTS ( SELECT 1
   FROM ((boh_user bu
     JOIN boh_user_role bur ON ((bur.user_id = bu.id)))
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (br.code = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));
drop policy if exists "Allow admin insert forge status" on "public"."boh_initiative_forge_status";
create policy "Allow admin insert forge status" on "public"."boh_initiative_forge_status" as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM ((boh_user bu
     JOIN boh_user_role bur ON ((bur.user_id = bu.id)))
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (br.code = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));
drop policy if exists "Allow admin update forge status" on "public"."boh_initiative_forge_status";
create policy "Allow admin update forge status" on "public"."boh_initiative_forge_status" as permissive for update to public using ((EXISTS ( SELECT 1
   FROM ((boh_user bu
     JOIN boh_user_role bur ON ((bur.user_id = bu.id)))
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (br.code = ANY (ARRAY['admin'::text, 'super_admin'::text])))))) with check ((EXISTS ( SELECT 1
   FROM ((boh_user bu
     JOIN boh_user_role bur ON ((bur.user_id = bu.id)))
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (br.code = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));
drop policy if exists "Admin can manage planning stages" on "public"."boh_initiative_planning_stage";
create policy "Admin can manage planning stages" on "public"."boh_initiative_planning_stage" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM (boh_user_role ur
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.code = 'admin'::text)))));
drop policy if exists "Users can manage initiative-release relationships" on "public"."boh_initiative_release";
create policy "Users can manage initiative-release relationships" on "public"."boh_initiative_release" as permissive for all to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Users can view initiative-release relationships" on "public"."boh_initiative_release";
create policy "Users can view initiative-release relationships" on "public"."boh_initiative_release" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Users can view initiative statuses" on "public"."boh_initiative_status";
create policy "Users can view initiative statuses" on "public"."boh_initiative_status" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "boh_invite_delete_admin" on "public"."boh_invite";
create policy "boh_invite_delete_admin" on "public"."boh_invite" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_invite_insert_internal" on "public"."boh_invite";
create policy "boh_invite_insert_internal" on "public"."boh_invite" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_invite_invitee_can_select" on "public"."boh_invite";
create policy "boh_invite_invitee_can_select" on "public"."boh_invite" as permissive for select to public using ((((select auth.uid()) IS NOT NULL) AND (email = (select auth.email()))));
drop policy if exists "boh_invite_read_internal" on "public"."boh_invite";
create policy "boh_invite_read_internal" on "public"."boh_invite" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_invite_update_internal" on "public"."boh_invite";
create policy "boh_invite_update_internal" on "public"."boh_invite" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_message_delete_admin" on "public"."boh_message";
create policy "boh_message_delete_admin" on "public"."boh_message" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_message_insert_internal" on "public"."boh_message";
create policy "boh_message_insert_internal" on "public"."boh_message" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_message_read_internal" on "public"."boh_message";
create policy "boh_message_read_internal" on "public"."boh_message" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_message_update_internal" on "public"."boh_message";
create policy "boh_message_update_internal" on "public"."boh_message" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh admins can delete release versions" on "public"."boh_release_version";
create policy "boh admins can delete release versions" on "public"."boh_release_version" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text) AND (r.code = 'admin'::text)))));
drop policy if exists "boh admins can insert release versions" on "public"."boh_release_version";
create policy "boh admins can insert release versions" on "public"."boh_release_version" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text) AND (r.code = 'admin'::text)))));
drop policy if exists "boh admins can update release versions" on "public"."boh_release_version";
create policy "boh admins can update release versions" on "public"."boh_release_version" as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text) AND (r.code = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM ((boh_user u
     JOIN boh_user_role ur ON ((ur.user_id = u.id)))
     JOIN boh_role r ON ((r.id = ur.role_id)))
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text) AND (r.code = 'admin'::text)))));
drop policy if exists "boh users can delete release versions" on "public"."boh_release_version";
create policy "boh users can delete release versions" on "public"."boh_release_version" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text)))));
drop policy if exists "boh users can insert release versions" on "public"."boh_release_version";
create policy "boh users can insert release versions" on "public"."boh_release_version" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text)))));
drop policy if exists "boh users can read release versions" on "public"."boh_release_version";
create policy "boh users can read release versions" on "public"."boh_release_version" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text)))));
drop policy if exists "boh users can update release versions" on "public"."boh_release_version";
create policy "boh users can update release versions" on "public"."boh_release_version" as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text))))) with check ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.auth_user_id = (select auth.uid())) AND (u.status = 'active'::text)))));
drop policy if exists "boh_role_delete_admin" on "public"."boh_role";
create policy "boh_role_delete_admin" on "public"."boh_role" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_role_insert_internal" on "public"."boh_role";
create policy "boh_role_insert_internal" on "public"."boh_role" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_role_read_internal" on "public"."boh_role";
create policy "boh_role_read_internal" on "public"."boh_role" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_role_update_internal" on "public"."boh_role";
create policy "boh_role_update_internal" on "public"."boh_role" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text)) with check ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "Tasks can be created by authenticated users" on "public"."boh_task";
create policy "Tasks can be created by authenticated users" on "public"."boh_task" as permissive for insert to authenticated with check (((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))));
drop policy if exists "Tasks can be deleted by creator" on "public"."boh_task";
create policy "Tasks can be deleted by creator" on "public"."boh_task" as permissive for delete to authenticated using (((created_by IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR ((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))));
drop policy if exists "Tasks can be updated by assigned user or creator" on "public"."boh_task";
create policy "Tasks can be updated by assigned user or creator" on "public"."boh_task" as permissive for update to authenticated using (((assigned_to IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR (created_by IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR ((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))))) with check (((assigned_to IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR (created_by IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR ((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))));
drop policy if exists "Allow authenticated users to create comments" on "public"."boh_task_comment";
create policy "Allow authenticated users to create comments" on "public"."boh_task_comment" as permissive for insert to authenticated with check (((select auth.uid()) = author_id));
drop policy if exists "Allow users to delete their own comments" on "public"."boh_task_comment";
create policy "Allow users to delete their own comments" on "public"."boh_task_comment" as permissive for delete to authenticated using (((select auth.uid()) = author_id));
drop policy if exists "Allow users to update their own comments" on "public"."boh_task_comment";
create policy "Allow users to update their own comments" on "public"."boh_task_comment" as permissive for update to authenticated using (((select auth.uid()) = author_id)) with check (((select auth.uid()) = author_id));
drop policy if exists "boh_user_delete_admin" on "public"."boh_user";
create policy "boh_user_delete_admin" on "public"."boh_user" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_user_insert_internal" on "public"."boh_user";
create policy "boh_user_insert_internal" on "public"."boh_user" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_user_link_invited_auth_user" on "public"."boh_user";
create policy "boh_user_link_invited_auth_user" on "public"."boh_user" as permissive for update to authenticated using (((app_context = 'boh'::text) AND (auth_user_id IS NULL) AND (lower(email) = lower(( SELECT ((select auth.jwt()) ->> 'email'::text)))))) with check (((app_context = 'boh'::text) AND (auth_user_id = ( SELECT (select auth.uid()) AS uid)) AND (lower(email) = lower(( SELECT ((select auth.jwt()) ->> 'email'::text))))));
drop policy if exists "boh_user_read_internal" on "public"."boh_user";
create policy "boh_user_read_internal" on "public"."boh_user" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_user_select_login_bootstrap" on "public"."boh_user";
create policy "boh_user_select_login_bootstrap" on "public"."boh_user" as permissive for select to authenticated using (((app_context = 'boh'::text) AND ((auth_user_id = ( SELECT (select auth.uid()) AS uid)) OR (lower(email) = lower(( SELECT ((select auth.jwt()) ->> 'email'::text)))) OR private.is_boh_super_admin())));
drop policy if exists "boh_user_update_internal" on "public"."boh_user";
create policy "boh_user_update_internal" on "public"."boh_user" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_user_app_delete_admin" on "public"."boh_user_app";
create policy "boh_user_app_delete_admin" on "public"."boh_user_app" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_user_app_insert_internal" on "public"."boh_user_app";
create policy "boh_user_app_insert_internal" on "public"."boh_user_app" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_user_app_read_internal" on "public"."boh_user_app";
create policy "boh_user_app_read_internal" on "public"."boh_user_app" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_user_app_select_own" on "public"."boh_user_app";
create policy "boh_user_app_select_own" on "public"."boh_user_app" as permissive for select to public using ((((select auth.uid()) IS NOT NULL) AND (user_id = current_boh_user_id())));
drop policy if exists "boh_user_app_update_internal" on "public"."boh_user_app";
create policy "boh_user_app_update_internal" on "public"."boh_user_app" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_user_role_delete_admin" on "public"."boh_user_role";
create policy "boh_user_role_delete_admin" on "public"."boh_user_role" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_user_role_insert_internal" on "public"."boh_user_role";
create policy "boh_user_role_insert_internal" on "public"."boh_user_role" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_user_role_read_internal" on "public"."boh_user_role";
create policy "boh_user_role_read_internal" on "public"."boh_user_role" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_user_role_update_internal" on "public"."boh_user_role";
create policy "boh_user_role_update_internal" on "public"."boh_user_role" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text)) with check ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "Stories can be created by authenticated users" on "public"."boh_user_story";
create policy "Stories can be created by authenticated users" on "public"."boh_user_story" as permissive for insert to authenticated with check (((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))));
drop policy if exists "Stories can be deleted by owner or admins" on "public"."boh_user_story";
create policy "Stories can be deleted by owner or admins" on "public"."boh_user_story" as permissive for delete to authenticated using (((owner_user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR ((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))));
drop policy if exists "Stories can be updated by owner or admins" on "public"."boh_user_story";
create policy "Stories can be updated by owner or admins" on "public"."boh_user_story" as permissive for update to authenticated using (((owner_user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR ((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text))))) with check (((owner_user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))) OR ((select auth.uid()) IN ( SELECT boh_user.auth_user_id
   FROM boh_user
  WHERE (boh_user.status = 'active'::text)))));
drop policy if exists "boh_user_story_event_insert_authenticated" on "public"."boh_user_story_event";
create policy "boh_user_story_event_insert_authenticated" on "public"."boh_user_story_event" as permissive for insert to authenticated with check (((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = boh_user_story_event.changed_by) AND (bu.auth_user_id = (select auth.uid()))))) AND (EXISTS ( SELECT 1
   FROM (boh_user_story bus
     JOIN boh_user bu2 ON (((bu2.id = bus.created_by) OR (bu2.id = bus.owner_user_id))))
  WHERE ((bus.id = boh_user_story_event.user_story_id) AND (bu2.auth_user_id = (select auth.uid())))))));
drop policy if exists "Users can create workstreams" on "public"."boh_workstream";
create policy "Users can create workstreams" on "public"."boh_workstream" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Users can update workstreams assigned to them" on "public"."boh_workstream";
create policy "Users can update workstreams assigned to them" on "public"."boh_workstream" as permissive for update to public using ((assigned_to = (select auth.uid())));
drop policy if exists "Users can update workstreams they created" on "public"."boh_workstream";
create policy "Users can update workstreams they created" on "public"."boh_workstream" as permissive for update to public using ((created_by = (select auth.uid())));
drop policy if exists "Users can view workstreams" on "public"."boh_workstream";
create policy "Users can view workstreams" on "public"."boh_workstream" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Users can manage approvals they requested" on "public"."boh_workstream_approval";
create policy "Users can manage approvals they requested" on "public"."boh_workstream_approval" as permissive for all to public using ((requested_by = (select auth.uid())));
drop policy if exists "Users can review approvals assigned to them" on "public"."boh_workstream_approval";
create policy "Users can review approvals assigned to them" on "public"."boh_workstream_approval" as permissive for update to public using ((reviewed_by = (select auth.uid())));
drop policy if exists "Users can view approvals" on "public"."boh_workstream_approval";
create policy "Users can view approvals" on "public"."boh_workstream_approval" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Users can view workstream statuses" on "public"."boh_workstream_status";
create policy "Users can view workstream statuses" on "public"."boh_workstream_status" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "cellar_investor_access_verified_self_read" on "public"."cellar_investor_access";
create policy "cellar_investor_access_verified_self_read" on "public"."cellar_investor_access" as permissive for select to public using ((((select auth.uid()) IS NOT NULL) AND (auth_user_id = (select auth.uid()))));
drop policy if exists "cellar_investor_profiles_self_read" on "public"."cellar_investor_profiles";
create policy "cellar_investor_profiles_self_read" on "public"."cellar_investor_profiles" as permissive for select to public using ((((select auth.uid()) IS NOT NULL) AND (auth_user_id = (select auth.uid()))));
drop policy if exists "Allow authenticated insert actions" on "public"."central_agent_actions";
create policy "Allow authenticated insert actions" on "public"."central_agent_actions" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read actions" on "public"."central_agent_actions";
create policy "Allow authenticated read actions" on "public"."central_agent_actions" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated update actions" on "public"."central_agent_actions";
create policy "Allow authenticated update actions" on "public"."central_agent_actions" as permissive for update to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read access to agent budgets" on "public"."central_agent_budgets";
create policy "Allow authenticated read access to agent budgets" on "public"."central_agent_budgets" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated update own budget" on "public"."central_agent_budgets";
create policy "Allow authenticated update own budget" on "public"."central_agent_budgets" as permissive for update to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read agent capability bindings" on "public"."central_agent_capability_bindings";
create policy "Allow authenticated read agent capability bindings" on "public"."central_agent_capability_bindings" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated write agent capability bindings" on "public"."central_agent_capability_bindings";
create policy "Allow authenticated write agent capability bindings" on "public"."central_agent_capability_bindings" as permissive for all to public using (((select auth.role()) = 'authenticated'::text)) with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated insert conversations" on "public"."central_agent_conversations";
create policy "Allow authenticated insert conversations" on "public"."central_agent_conversations" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read access to conversations" on "public"."central_agent_conversations";
create policy "Allow authenticated read access to conversations" on "public"."central_agent_conversations" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated insert requests" on "public"."central_agent_creation_requests";
create policy "Allow authenticated insert requests" on "public"."central_agent_creation_requests" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read requests" on "public"."central_agent_creation_requests";
create policy "Allow authenticated read requests" on "public"."central_agent_creation_requests" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated update requests" on "public"."central_agent_creation_requests";
create policy "Allow authenticated update requests" on "public"."central_agent_creation_requests" as permissive for update to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read templates" on "public"."central_agent_persona_templates";
create policy "Allow authenticated read templates" on "public"."central_agent_persona_templates" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated insert agent profile documents" on "public"."central_agent_profile_documents";
create policy "Allow authenticated insert agent profile documents" on "public"."central_agent_profile_documents" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read agent profile documents" on "public"."central_agent_profile_documents";
create policy "Allow authenticated read agent profile documents" on "public"."central_agent_profile_documents" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated update agent profile documents" on "public"."central_agent_profile_documents";
create policy "Allow authenticated update agent profile documents" on "public"."central_agent_profile_documents" as permissive for update to public using (((select auth.role()) = 'authenticated'::text)) with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "central_agents_create_draft" on "public"."central_agents";
create policy "central_agents_create_draft" on "public"."central_agents" as permissive for insert to public with check (((agent_status = 'draft'::text) AND (created_by = (select auth.uid()))));
drop policy if exists "central_agents_update_own_draft" on "public"."central_agents";
create policy "central_agents_update_own_draft" on "public"."central_agents" as permissive for update to public using (((created_by = (select auth.uid())) AND (agent_status = ANY (ARRAY['draft'::text, 'pending_approval'::text]))));
drop policy if exists "central_agents_view_active" on "public"."central_agents";
create policy "central_agents_view_active" on "public"."central_agents" as permissive for select to public using (((agent_status = 'active'::text) OR ((agent_status = ANY (ARRAY['draft'::text, 'pending_approval'::text])) AND (created_by = (select auth.uid())))));
drop policy if exists "Allow authenticated read central capabilities" on "public"."central_capabilities";
create policy "Allow authenticated read central capabilities" on "public"."central_capabilities" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated write central capabilities" on "public"."central_capabilities";
create policy "Allow authenticated write central capabilities" on "public"."central_capabilities" as permissive for all to public using (((select auth.role()) = 'authenticated'::text)) with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Authenticated users can read credential audit events" on "public"."central_credential_audit_events";
create policy "Authenticated users can read credential audit events" on "public"."central_credential_audit_events" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Authenticated users can write credential audit events" on "public"."central_credential_audit_events";
create policy "Authenticated users can write credential audit events" on "public"."central_credential_audit_events" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Authenticated users can create credential metadata" on "public"."central_credentials";
create policy "Authenticated users can create credential metadata" on "public"."central_credentials" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Authenticated users can read credential metadata" on "public"."central_credentials";
create policy "Authenticated users can read credential metadata" on "public"."central_credentials" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Authenticated users can update credential metadata" on "public"."central_credentials";
create policy "Authenticated users can update credential metadata" on "public"."central_credentials" as permissive for update to public using (((select auth.role()) = 'authenticated'::text)) with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "central_lessons_learned_delete_boh_user" on "public"."central_lessons_learned";
create policy "central_lessons_learned_delete_boh_user" on "public"."central_lessons_learned" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_learned_insert_boh_user" on "public"."central_lessons_learned";
create policy "central_lessons_learned_insert_boh_user" on "public"."central_lessons_learned" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_learned_select_boh_user" on "public"."central_lessons_learned";
create policy "central_lessons_learned_select_boh_user" on "public"."central_lessons_learned" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_learned_update_boh_user" on "public"."central_lessons_learned";
create policy "central_lessons_learned_update_boh_user" on "public"."central_lessons_learned" as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_prevention_step_delete_boh_user" on "public"."central_lessons_prevention_step";
create policy "central_lessons_prevention_step_delete_boh_user" on "public"."central_lessons_prevention_step" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_prevention_step_insert_boh_user" on "public"."central_lessons_prevention_step";
create policy "central_lessons_prevention_step_insert_boh_user" on "public"."central_lessons_prevention_step" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_prevention_step_select_boh_user" on "public"."central_lessons_prevention_step";
create policy "central_lessons_prevention_step_select_boh_user" on "public"."central_lessons_prevention_step" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_prevention_step_update_boh_user" on "public"."central_lessons_prevention_step";
create policy "central_lessons_prevention_step_update_boh_user" on "public"."central_lessons_prevention_step" as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_related_delete_boh_user" on "public"."central_lessons_related";
create policy "central_lessons_related_delete_boh_user" on "public"."central_lessons_related" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_related_insert_boh_user" on "public"."central_lessons_related";
create policy "central_lessons_related_insert_boh_user" on "public"."central_lessons_related" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_related_select_boh_user" on "public"."central_lessons_related";
create policy "central_lessons_related_select_boh_user" on "public"."central_lessons_related" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_tag_map_delete_boh_user" on "public"."central_lessons_tag_map";
create policy "central_lessons_tag_map_delete_boh_user" on "public"."central_lessons_tag_map" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_tag_map_insert_boh_user" on "public"."central_lessons_tag_map";
create policy "central_lessons_tag_map_insert_boh_user" on "public"."central_lessons_tag_map" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "central_lessons_tag_map_select_boh_user" on "public"."central_lessons_tag_map";
create policy "central_lessons_tag_map_select_boh_user" on "public"."central_lessons_tag_map" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))));
drop policy if exists "Allow authenticated read access to sections" on "public"."central_sections";
create policy "Allow authenticated read access to sections" on "public"."central_sections" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated insert to tables" on "public"."central_tables";
create policy "Allow authenticated insert to tables" on "public"."central_tables" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read access to tables" on "public"."central_tables";
create policy "Allow authenticated read access to tables" on "public"."central_tables" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated update to tables" on "public"."central_tables";
create policy "Allow authenticated update to tables" on "public"."central_tables" as permissive for update to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated delete to tasks" on "public"."central_task";
create policy "Allow authenticated delete to tasks" on "public"."central_task" as permissive for delete to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated insert to tasks" on "public"."central_task";
create policy "Allow authenticated insert to tasks" on "public"."central_task" as permissive for insert to public with check (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated read access to tasks" on "public"."central_task";
create policy "Allow authenticated read access to tasks" on "public"."central_task" as permissive for select to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "Allow authenticated update to tasks" on "public"."central_task";
create policy "Allow authenticated update to tasks" on "public"."central_task" as permissive for update to public using (((select auth.role()) = 'authenticated'::text));
drop policy if exists "content_blueprint_delete_boh_user" on "public"."content_blueprint";
create policy "content_blueprint_delete_boh_user" on "public"."content_blueprint" as permissive for delete to public using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "content_blueprint_insert_boh_user" on "public"."content_blueprint";
create policy "content_blueprint_insert_boh_user" on "public"."content_blueprint" as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "content_blueprint_select_boh_user" on "public"."content_blueprint";
create policy "content_blueprint_select_boh_user" on "public"."content_blueprint" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "content_blueprint_update_boh_user" on "public"."content_blueprint";
create policy "content_blueprint_update_boh_user" on "public"."content_blueprint" as permissive for update to public using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text))))) with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "content_draft_delete_boh_user" on "public"."content_draft";
create policy "content_draft_delete_boh_user" on "public"."content_draft" as permissive for delete to public using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "content_draft_insert_boh_user" on "public"."content_draft";
create policy "content_draft_insert_boh_user" on "public"."content_draft" as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "content_draft_select_boh_user" on "public"."content_draft";
create policy "content_draft_select_boh_user" on "public"."content_draft" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "content_draft_update_boh_user" on "public"."content_draft";
create policy "content_draft_update_boh_user" on "public"."content_draft" as permissive for update to public using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text))))) with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "Forge walkthrough artifacts are readable by admins" on "public"."forge_walkthrough_artifact";
create policy "Forge walkthrough artifacts are readable by admins" on "public"."forge_walkthrough_artifact" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND ((bu.primary_role_hint = ANY (ARRAY['admin'::text, 'super_admin'::text])) OR (EXISTS ( SELECT 1
           FROM (boh_user_role bur
             JOIN boh_role br ON ((br.id = bur.role_id)))
          WHERE ((bur.user_id = bu.id) AND (bur.app_context = 'boh'::text) AND (br.code = ANY (ARRAY['admin'::text, 'super_admin'::text]))))))))));
drop policy if exists "Forge walkthrough recipes are readable by admins" on "public"."forge_walkthrough_recipe";
create policy "Forge walkthrough recipes are readable by admins" on "public"."forge_walkthrough_recipe" as permissive for select to authenticated using (((is_active = true) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND ((bu.primary_role_hint = ANY (ARRAY['admin'::text, 'super_admin'::text])) OR (EXISTS ( SELECT 1
           FROM (boh_user_role bur
             JOIN boh_role br ON ((br.id = bur.role_id)))
          WHERE ((bur.user_id = bu.id) AND (bur.app_context = 'boh'::text) AND (br.code = ANY (ARRAY['admin'::text, 'super_admin'::text])))))))))));
drop policy if exists "Forge walkthrough runs are readable by admins" on "public"."forge_walkthrough_run";
create policy "Forge walkthrough runs are readable by admins" on "public"."forge_walkthrough_run" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND ((bu.primary_role_hint = ANY (ARRAY['admin'::text, 'super_admin'::text])) OR (EXISTS ( SELECT 1
           FROM (boh_user_role bur
             JOIN boh_role br ON ((br.id = bur.role_id)))
          WHERE ((bur.user_id = bu.id) AND (bur.app_context = 'boh'::text) AND (br.code = ANY (ARRAY['admin'::text, 'super_admin'::text]))))))))));
drop policy if exists "Authenticated users can insert keep_activity" on "public"."keep_activity";
create policy "Authenticated users can insert keep_activity" on "public"."keep_activity" as permissive for insert to authenticated with check ((user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = (select auth.uid())) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)));
drop policy if exists "Users can view their own keep_activity" on "public"."keep_activity";
create policy "Users can view their own keep_activity" on "public"."keep_activity" as permissive for select to authenticated using (((user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = (select auth.uid())) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)) OR is_boh_super_admin()));
drop policy if exists "Users can view their own keep_user_access" on "public"."keep_user_access";
create policy "Users can view their own keep_user_access" on "public"."keep_user_access" as permissive for select to authenticated using ((user_id = ( SELECT boh_user.id
   FROM boh_user
  WHERE ((boh_user.auth_user_id = (select auth.uid())) AND (boh_user.app_context = 'boh'::text))
 LIMIT 1)));
drop policy if exists "keep_whiteboard_item_delete_own" on "public"."keep_whiteboard_item";
create policy "keep_whiteboard_item_delete_own" on "public"."keep_whiteboard_item" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_whiteboard_item.created_by) AND (bu.auth_user_id = (select auth.uid()))))));
drop policy if exists "keep_whiteboard_item_select_own" on "public"."keep_whiteboard_item";
create policy "keep_whiteboard_item_select_own" on "public"."keep_whiteboard_item" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.id = keep_whiteboard_item.created_by) AND (bu.auth_user_id = (select auth.uid()))))));
drop policy if exists "loft_room_waitlist_insert_authenticated_self" on "public"."loft_room_waitlist";
create policy "loft_room_waitlist_insert_authenticated_self" on "public"."loft_room_waitlist" as permissive for insert to authenticated with check ((user_id = (select auth.uid())));
drop policy if exists "loft_room_waitlist_select_authenticated_host_or_self" on "public"."loft_room_waitlist";
create policy "loft_room_waitlist_select_authenticated_host_or_self" on "public"."loft_room_waitlist" as permissive for select to authenticated using (((user_id = (select auth.uid())) OR private.loft_room_is_accessible(loft_room_id)));
drop policy if exists "loft_room_waitlist_update_authenticated_host_or_self" on "public"."loft_room_waitlist";
create policy "loft_room_waitlist_update_authenticated_host_or_self" on "public"."loft_room_waitlist" as permissive for update to authenticated using (((user_id = (select auth.uid())) OR private.loft_room_is_accessible(loft_room_id))) with check (((user_id = (select auth.uid())) OR private.loft_room_is_accessible(loft_room_id)));
drop policy if exists "Users can manage own calendar sync" on "public"."outlook_calendar_sync";
create policy "Users can manage own calendar sync" on "public"."outlook_calendar_sync" as permissive for all to public using (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id))));
drop policy if exists "Users can view own calendar sync" on "public"."outlook_calendar_sync";
create policy "Users can view own calendar sync" on "public"."outlook_calendar_sync" as permissive for select to public using (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_calendar_sync.staff_id))));
drop policy if exists "Users can delete own Outlook tokens" on "public"."outlook_oauth_tokens";
create policy "Users can delete own Outlook tokens" on "public"."outlook_oauth_tokens" as permissive for delete to public using (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_oauth_tokens.staff_id))));
drop policy if exists "Users can insert own Outlook tokens" on "public"."outlook_oauth_tokens";
create policy "Users can insert own Outlook tokens" on "public"."outlook_oauth_tokens" as permissive for insert to public with check (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_oauth_tokens.staff_id))));
drop policy if exists "Users can update own Outlook tokens" on "public"."outlook_oauth_tokens";
create policy "Users can update own Outlook tokens" on "public"."outlook_oauth_tokens" as permissive for update to public using (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_oauth_tokens.staff_id))));
drop policy if exists "Users can view own Outlook tokens" on "public"."outlook_oauth_tokens";
create policy "Users can view own Outlook tokens" on "public"."outlook_oauth_tokens" as permissive for select to public using (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_oauth_tokens.staff_id))));
drop policy if exists "Users can manage own synced events" on "public"."outlook_synced_events";
create policy "Users can manage own synced events" on "public"."outlook_synced_events" as permissive for all to public using (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id))));
drop policy if exists "Users can view own synced events" on "public"."outlook_synced_events";
create policy "Users can view own synced events" on "public"."outlook_synced_events" as permissive for select to public using (((select auth.uid()) IN ( SELECT scheduling_staff_profiles.user_id
   FROM scheduling_staff_profiles
  WHERE (scheduling_staff_profiles.id = outlook_synced_events.staff_id))));
drop policy if exists "patron_activity_bohrw" on "public"."patron_activity";
create policy "patron_activity_bohrw" on "public"."patron_activity" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_activity_delete_admin" on "public"."patron_activity";
create policy "patron_activity_delete_admin" on "public"."patron_activity" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_activity_insert_internal" on "public"."patron_activity";
create policy "patron_activity_insert_internal" on "public"."patron_activity" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_activity_read_internal" on "public"."patron_activity";
create policy "patron_activity_read_internal" on "public"."patron_activity" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_activity_update_internal" on "public"."patron_activity";
create policy "patron_activity_update_internal" on "public"."patron_activity" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_custom_field_bohrw" on "public"."patron_custom_field";
create policy "patron_custom_field_bohrw" on "public"."patron_custom_field" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_custom_field_delete_admin" on "public"."patron_custom_field";
create policy "patron_custom_field_delete_admin" on "public"."patron_custom_field" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_custom_field_insert_internal" on "public"."patron_custom_field";
create policy "patron_custom_field_insert_internal" on "public"."patron_custom_field" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_custom_field_read_internal" on "public"."patron_custom_field";
create policy "patron_custom_field_read_internal" on "public"."patron_custom_field" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_custom_field_update_internal" on "public"."patron_custom_field";
create policy "patron_custom_field_update_internal" on "public"."patron_custom_field" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_organisation_bohrw" on "public"."patron_organisation";
create policy "patron_organisation_bohrw" on "public"."patron_organisation" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_organisation_delete_admin" on "public"."patron_organisation";
create policy "patron_organisation_delete_admin" on "public"."patron_organisation" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_organisation_insert_internal" on "public"."patron_organisation";
create policy "patron_organisation_insert_internal" on "public"."patron_organisation" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_organisation_read_internal" on "public"."patron_organisation";
create policy "patron_organisation_read_internal" on "public"."patron_organisation" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_organisation_update_internal" on "public"."patron_organisation";
create policy "patron_organisation_update_internal" on "public"."patron_organisation" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_organisation_field_value_bohrw" on "public"."patron_organisation_field_value";
create policy "patron_organisation_field_value_bohrw" on "public"."patron_organisation_field_value" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_organisation_field_value_delete_admin" on "public"."patron_organisation_field_value";
create policy "patron_organisation_field_value_delete_admin" on "public"."patron_organisation_field_value" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_organisation_field_value_insert_internal" on "public"."patron_organisation_field_value";
create policy "patron_organisation_field_value_insert_internal" on "public"."patron_organisation_field_value" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_organisation_field_value_read_internal" on "public"."patron_organisation_field_value";
create policy "patron_organisation_field_value_read_internal" on "public"."patron_organisation_field_value" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_organisation_field_value_update_internal" on "public"."patron_organisation_field_value";
create policy "patron_organisation_field_value_update_internal" on "public"."patron_organisation_field_value" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_organisation_tag_bohrw" on "public"."patron_organisation_tag";
create policy "patron_organisation_tag_bohrw" on "public"."patron_organisation_tag" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_organisation_tag_delete_admin" on "public"."patron_organisation_tag";
create policy "patron_organisation_tag_delete_admin" on "public"."patron_organisation_tag" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_organisation_tag_insert_internal" on "public"."patron_organisation_tag";
create policy "patron_organisation_tag_insert_internal" on "public"."patron_organisation_tag" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_organisation_tag_read_internal" on "public"."patron_organisation_tag";
create policy "patron_organisation_tag_read_internal" on "public"."patron_organisation_tag" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_organisation_tag_update_internal" on "public"."patron_organisation_tag";
create policy "patron_organisation_tag_update_internal" on "public"."patron_organisation_tag" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_bohrw" on "public"."patron_person";
create policy "patron_person_bohrw" on "public"."patron_person" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_person_delete_admin" on "public"."patron_person";
create policy "patron_person_delete_admin" on "public"."patron_person" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_person_insert_internal" on "public"."patron_person";
create policy "patron_person_insert_internal" on "public"."patron_person" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_read_internal" on "public"."patron_person";
create policy "patron_person_read_internal" on "public"."patron_person" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_person_update_internal" on "public"."patron_person";
create policy "patron_person_update_internal" on "public"."patron_person" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_field_value_bohrw" on "public"."patron_person_field_value";
create policy "patron_person_field_value_bohrw" on "public"."patron_person_field_value" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_person_field_value_delete_admin" on "public"."patron_person_field_value";
create policy "patron_person_field_value_delete_admin" on "public"."patron_person_field_value" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_person_field_value_insert_internal" on "public"."patron_person_field_value";
create policy "patron_person_field_value_insert_internal" on "public"."patron_person_field_value" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_field_value_read_internal" on "public"."patron_person_field_value";
create policy "patron_person_field_value_read_internal" on "public"."patron_person_field_value" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_person_field_value_update_internal" on "public"."patron_person_field_value";
create policy "patron_person_field_value_update_internal" on "public"."patron_person_field_value" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_organisation_bohrw" on "public"."patron_person_organisation";
create policy "patron_person_organisation_bohrw" on "public"."patron_person_organisation" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_person_organisation_delete_admin" on "public"."patron_person_organisation";
create policy "patron_person_organisation_delete_admin" on "public"."patron_person_organisation" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_person_organisation_insert_internal" on "public"."patron_person_organisation";
create policy "patron_person_organisation_insert_internal" on "public"."patron_person_organisation" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_organisation_read_internal" on "public"."patron_person_organisation";
create policy "patron_person_organisation_read_internal" on "public"."patron_person_organisation" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_person_organisation_update_internal" on "public"."patron_person_organisation";
create policy "patron_person_organisation_update_internal" on "public"."patron_person_organisation" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_persona_delete_boh_staff" on "public"."patron_person_persona";
create policy "patron_person_persona_delete_boh_staff" on "public"."patron_person_persona" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "patron_person_persona_insert_boh_staff" on "public"."patron_person_persona";
create policy "patron_person_persona_insert_boh_staff" on "public"."patron_person_persona" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "patron_person_persona_select_boh_staff" on "public"."patron_person_persona";
create policy "patron_person_persona_select_boh_staff" on "public"."patron_person_persona" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "patron_person_persona_update_boh_staff" on "public"."patron_person_persona";
create policy "patron_person_persona_update_boh_staff" on "public"."patron_person_persona" as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text))))) with check ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "patron_person_tag_bohrw" on "public"."patron_person_tag";
create policy "patron_person_tag_bohrw" on "public"."patron_person_tag" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_person_tag_delete_admin" on "public"."patron_person_tag";
create policy "patron_person_tag_delete_admin" on "public"."patron_person_tag" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_person_tag_insert_internal" on "public"."patron_person_tag";
create policy "patron_person_tag_insert_internal" on "public"."patron_person_tag" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_tag_read_internal" on "public"."patron_person_tag";
create policy "patron_person_tag_read_internal" on "public"."patron_person_tag" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_person_tag_update_internal" on "public"."patron_person_tag";
create policy "patron_person_tag_update_internal" on "public"."patron_person_tag" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_person_type_select_boh_staff" on "public"."patron_person_type";
create policy "patron_person_type_select_boh_staff" on "public"."patron_person_type" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "patron_persona_select_boh_staff" on "public"."patron_persona";
create policy "patron_persona_select_boh_staff" on "public"."patron_persona" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE ((bu.auth_user_id = (select auth.uid())) AND (bu.status = 'active'::text)))));
drop policy if exists "Allow admin full access to pipeline stages" on "public"."patron_pipeline_stage";
create policy "Allow admin full access to pipeline stages" on "public"."patron_pipeline_stage" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM (boh_user_role bur
     JOIN boh_role br ON ((br.id = bur.role_id)))
  WHERE ((bur.user_id = (select auth.uid())) AND (br.code = 'admin'::text)))));
drop policy if exists "patron_recruiter_intake_insert_authenticated" on "public"."patron_recruiter_intake";
create policy "patron_recruiter_intake_insert_authenticated" on "public"."patron_recruiter_intake" as permissive for insert to authenticated with check (((select auth.uid()) IS NOT NULL));
drop policy if exists "patron_tag_bohrw" on "public"."patron_tag";
create policy "patron_tag_bohrw" on "public"."patron_tag" as permissive for all to public using (((select auth.role()) = 'boh'::text)) with check (((select auth.role()) = 'boh'::text));
drop policy if exists "patron_tag_delete_admin" on "public"."patron_tag";
create policy "patron_tag_delete_admin" on "public"."patron_tag" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "patron_tag_insert_internal" on "public"."patron_tag";
create policy "patron_tag_insert_internal" on "public"."patron_tag" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "patron_tag_read_internal" on "public"."patron_tag";
create policy "patron_tag_read_internal" on "public"."patron_tag" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "patron_tag_update_internal" on "public"."patron_tag";
create policy "patron_tag_update_internal" on "public"."patron_tag" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "Staff manage their rules" on "public"."scheduling_availability_rules";
create policy "Staff manage their rules" on "public"."scheduling_availability_rules" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_availability_rules.staff_id) AND (s.user_id = (select auth.uid()))))));
drop policy if exists "Staff manage their blackout dates" on "public"."scheduling_blackout_dates";
create policy "Staff manage their blackout dates" on "public"."scheduling_blackout_dates" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_blackout_dates.staff_id) AND (s.user_id = (select auth.uid()))))));
drop policy if exists "Staff update their own bookings" on "public"."scheduling_bookings";
create policy "Staff update their own bookings" on "public"."scheduling_bookings" as permissive for update to public using ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_bookings.staff_id) AND (s.user_id = (select auth.uid()))))));
drop policy if exists "Staff view their own bookings" on "public"."scheduling_bookings";
create policy "Staff view their own bookings" on "public"."scheduling_bookings" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_bookings.staff_id) AND (s.user_id = (select auth.uid()))))));
drop policy if exists "Users can delete their own bookings" on "public"."scheduling_bookings";
create policy "Users can delete their own bookings" on "public"."scheduling_bookings" as permissive for delete to public using (((select auth.uid()) IS NOT NULL));
drop policy if exists "Users can insert bookings" on "public"."scheduling_bookings";
create policy "Users can insert bookings" on "public"."scheduling_bookings" as permissive for insert to public with check (((select auth.uid()) IS NOT NULL));
drop policy if exists "Users can insert their own bookings" on "public"."scheduling_bookings";
create policy "Users can insert their own bookings" on "public"."scheduling_bookings" as permissive for insert to public with check (((select auth.uid()) IS NOT NULL));
drop policy if exists "Users can update their own bookings" on "public"."scheduling_bookings";
create policy "Users can update their own bookings" on "public"."scheduling_bookings" as permissive for update to public using (((select auth.uid()) IS NOT NULL));
drop policy if exists "Users can view their own bookings" on "public"."scheduling_bookings";
create policy "Users can view their own bookings" on "public"."scheduling_bookings" as permissive for select to public using (((select auth.uid()) IS NOT NULL));
drop policy if exists "Staff manage their own meeting types" on "public"."scheduling_meeting_types";
create policy "Staff manage their own meeting types" on "public"."scheduling_meeting_types" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM scheduling_staff_profiles s
  WHERE ((s.id = scheduling_meeting_types.staff_id) AND (s.user_id = (select auth.uid()))))));
drop policy if exists "Users can update their own profile" on "public"."scheduling_staff_profiles";
create policy "Users can update their own profile" on "public"."scheduling_staff_profiles" as permissive for update to public using (((select auth.uid()) = user_id));
drop policy if exists "boh_chair_delete_admin" on "public"."tablez_chair";
create policy "boh_chair_delete_admin" on "public"."tablez_chair" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_chair_insert_internal" on "public"."tablez_chair";
create policy "boh_chair_insert_internal" on "public"."tablez_chair" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_chair_read_internal" on "public"."tablez_chair";
create policy "boh_chair_read_internal" on "public"."tablez_chair" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_chair_read_own" on "public"."tablez_chair";
create policy "boh_chair_read_own" on "public"."tablez_chair" as permissive for select to authenticated using ((user_id IN ( SELECT boh_user.id
   FROM boh_user
  WHERE (boh_user.auth_user_id = (select auth.uid())))));
drop policy if exists "boh_chair_read_own_anon" on "public"."tablez_chair";
create policy "boh_chair_read_own_anon" on "public"."tablez_chair" as permissive for select to anon using ((EXISTS ( SELECT 1
   FROM boh_user u
  WHERE ((u.id = tablez_chair.user_id) AND (u.auth_user_id = (select auth.uid()))))));
drop policy if exists "boh_chair_update_internal" on "public"."tablez_chair";
create policy "boh_chair_update_internal" on "public"."tablez_chair" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_section_delete_admin" on "public"."tablez_section";
create policy "boh_section_delete_admin" on "public"."tablez_section" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_section_insert_internal" on "public"."tablez_section";
create policy "boh_section_insert_internal" on "public"."tablez_section" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_section_read_internal" on "public"."tablez_section";
create policy "boh_section_read_internal" on "public"."tablez_section" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_section_update_internal" on "public"."tablez_section";
create policy "boh_section_update_internal" on "public"."tablez_section" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_table_delete_admin" on "public"."tablez_table";
create policy "boh_table_delete_admin" on "public"."tablez_table" as permissive for delete to public using ((((select auth.jwt()) ->> 'boh_role'::text) = 'admin'::text));
drop policy if exists "boh_table_insert_internal" on "public"."tablez_table";
create policy "boh_table_insert_internal" on "public"."tablez_table" as permissive for insert to public with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "boh_table_read_internal" on "public"."tablez_table";
create policy "boh_table_read_internal" on "public"."tablez_table" as permissive for select to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text, 'viewer'::text])));
drop policy if exists "boh_table_update_internal" on "public"."tablez_table";
create policy "boh_table_update_internal" on "public"."tablez_table" as permissive for update to public using ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text]))) with check ((((select auth.jwt()) ->> 'boh_role'::text) = ANY (ARRAY['admin'::text, 'support'::text])));
drop policy if exists "read tables via chair" on "public"."tablez_table";
create policy "read tables via chair" on "public"."tablez_table" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM (tablez_chair c
     JOIN boh_user u ON ((u.id = c.user_id)))
  WHERE ((c.table_id = tablez_table.id) AND (u.auth_user_id = (select auth.uid())) AND (c.is_active = true)))));
drop policy if exists "tablez_tasks_delete" on "public"."tablez_task";
create policy "tablez_tasks_delete" on "public"."tablez_task" as permissive for delete to authenticated using (((app_context = 'tablez'::text) AND (assigned_to IN ( SELECT bu.id
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid()))))));
drop policy if exists "tablez_tasks_insert" on "public"."tablez_task";
create policy "tablez_tasks_insert" on "public"."tablez_task" as permissive for insert to authenticated with check (((app_context = 'tablez'::text) AND (assigned_to IN ( SELECT bu.id
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid()))))));
drop policy if exists "tablez_tasks_select" on "public"."tablez_task";
create policy "tablez_tasks_select" on "public"."tablez_task" as permissive for select to authenticated using (((app_context = 'tablez'::text) AND (EXISTS ( SELECT 1
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid()))))));
drop policy if exists "tablez_tasks_update" on "public"."tablez_task";
create policy "tablez_tasks_update" on "public"."tablez_task" as permissive for update to authenticated using (((app_context = 'tablez'::text) AND (assigned_to IN ( SELECT bu.id
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid())))))) with check (((app_context = 'tablez'::text) AND (assigned_to IN ( SELECT bu.id
   FROM boh_user bu
  WHERE (bu.auth_user_id = (select auth.uid()))))));
