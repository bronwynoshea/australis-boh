import { getCurrentBohUserContext } from '../../boh/api/bohApi';
import { supabase } from '../../lib/supabase';
import { createTask, fetchTaskPriorities, fetchTaskStatuses } from '../tablez/api/tablezTasksApi';
import type {
  AssemblyAgendaItem,
  AssemblyDashboard,
  AssemblyMeeting,
  AssemblyMemo,
  AssemblyOutcome,
  AssemblyResolution,
  AssemblyReview,
  AssemblyUser,
  CreateMeetingInput,
  CreateMemoInput,
  CreateOutcomeInput,
} from './types';

async function getContext() {
  const context = await getCurrentBohUserContext();
  if (!context?.tenant_id) {
    throw new Error('Your BOH tenant could not be resolved.');
  }
  return context;
}

function isMissingAssemblySchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('assembly_') || message.includes('schema cache') || message.includes('does not exist');
}

export function isAssemblySchemaUnavailable(error: unknown): boolean {
  return isMissingAssemblySchema(error);
}

export async function fetchAssemblyDashboard(): Promise<AssemblyDashboard> {
  const context = await getContext();
  const tenantId = context.tenant_id;

  const [memos, meetings, agendaItems, outcomes, resolutions, reviews, users] = await Promise.all([
    supabase.from('assembly_memo').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }),
    supabase.from('assembly_meeting').select('*').eq('tenant_id', tenantId).order('scheduled_at', { ascending: true, nullsFirst: false }),
    supabase.from('assembly_agenda_item').select('*, memo:assembly_memo(id,title,author_id,priority,requested_decision)').eq('tenant_id', tenantId).order('sort_order', { ascending: true }),
    supabase.from('assembly_outcome').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }),
    supabase.from('assembly_resolution').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }),
    supabase.from('assembly_review').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('boh_user').select('id, full_name, email').eq('tenant_id', tenantId).eq('app_context', 'boh').eq('status', 'active').order('full_name', { ascending: true }),
  ]);

  const responses = [memos, meetings, agendaItems, outcomes, resolutions, reviews, users];
  const firstError = responses.find((response) => response.error)?.error;
  if (firstError) throw firstError;

  return {
    memos: (memos.data || []) as AssemblyMemo[],
    meetings: (meetings.data || []) as AssemblyMeeting[],
    agendaItems: (agendaItems.data || []) as unknown as AssemblyAgendaItem[],
    outcomes: (outcomes.data || []) as AssemblyOutcome[],
    resolutions: (resolutions.data || []) as AssemblyResolution[],
    reviews: (reviews.data || []) as AssemblyReview[],
    users: (users.data || []) as AssemblyUser[],
    currentUserId: context.id,
  };
}

export async function createAssemblyMemo(input: CreateMemoInput): Promise<AssemblyMemo> {
  const context = await getContext();
  const { data, error } = await supabase
    .from('assembly_memo')
    .insert({
      ...input,
      title: input.title.trim(),
      requested_decision: input.requested_decision?.trim() || null,
      author_id: context.id,
      tenant_id: context.tenant_id,
      status: 'submitted',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AssemblyMemo;
}

export async function createAssemblyMeeting(input: CreateMeetingInput): Promise<AssemblyMeeting> {
  const context = await getContext();
  const { data, error } = await supabase
    .from('assembly_meeting')
    .insert({
      ...input,
      title: input.title.trim(),
      tenant_id: context.tenant_id,
      status: 'planned',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AssemblyMeeting;
}

export async function acceptMemoToAgenda(memo: AssemblyMemo, meetingId: string, purpose: AssemblyAgendaItem['purpose']): Promise<AssemblyAgendaItem> {
  const context = await getContext();
  const { count, error: countError } = await supabase
    .from('assembly_agenda_item')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', context.tenant_id)
    .eq('meeting_id', meetingId);

  if (countError) throw countError;

  const { data, error } = await supabase
    .from('assembly_agenda_item')
    .insert({
      tenant_id: context.tenant_id,
      meeting_id: meetingId,
      memo_id: memo.id,
      title: memo.title,
      purpose,
      sort_order: (count || 0) + 1,
      status: 'planned',
    })
    .select('*, memo:assembly_memo(id,title,author_id,priority,requested_decision)')
    .single();

  if (error) throw error;

  await supabase
    .from('assembly_memo')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', memo.id)
    .eq('tenant_id', context.tenant_id);

  return data as unknown as AssemblyAgendaItem;
}

export async function updateMeetingMinutes(meetingId: string, minutesSummary: string): Promise<void> {
  const context = await getContext();
  const { error } = await supabase
    .from('assembly_meeting')
    .update({ minutes_summary: minutesSummary.trim(), status: 'minutes_draft', updated_at: new Date().toISOString() })
    .eq('id', meetingId)
    .eq('tenant_id', context.tenant_id);

  if (error) throw error;
}

export async function createAssemblyOutcome(input: CreateOutcomeInput): Promise<AssemblyOutcome> {
  const context = await getContext();
  const handoffStatus = input.handoff_target === 'none' ? 'not_required' : 'pending';
  const { data, error } = await supabase
    .from('assembly_outcome')
    .insert({
      ...input,
      title: input.title.trim(),
      summary: input.summary.trim(),
      tenant_id: context.tenant_id,
      handoff_status: handoffStatus,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AssemblyOutcome;
}

export async function markOutcomeHandoffUnavailable(outcomeId: string, reason: string): Promise<void> {
  const context = await getContext();
  const { error } = await supabase
    .from('assembly_handoff')
    .insert({
      tenant_id: context.tenant_id,
      outcome_id: outcomeId,
      target_app: 'tablez',
      status: 'unavailable',
      message: reason,
    });
  if (error) throw error;

  await supabase
    .from('assembly_outcome')
    .update({ handoff_status: 'unavailable', updated_at: new Date().toISOString() })
    .eq('id', outcomeId)
    .eq('tenant_id', context.tenant_id);
}

export async function createOwnerTaskFromOutcome(outcome: AssemblyOutcome): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  if (!outcome.owner_id) {
    return { ok: false, message: 'Select an owner before sending this outcome to Tablez & Chairz.' };
  }

  const context = await getContext();
  const [{ data: table }, statuses, priorities] = await Promise.all([
    supabase.from('boh_table').select('id, section_id').eq('tenant_id', context.tenant_id).eq('is_active', true).limit(1).maybeSingle(),
    fetchTaskStatuses(),
    fetchTaskPriorities(),
  ]);

  const status = statuses.find((item) => ['todo', 'to_do', 'open', 'new'].includes(item.key)) || statuses[0];
  const priority = priorities.find((item) => ['normal', 'medium'].includes(item.key)) || priorities[0];

  if (!table?.id || !table?.section_id || !status?.id || !priority?.id) {
    const message = 'Owner task creation is not available because Tablez & Chairz default task settings are incomplete. The Assembly outcome remains recorded for follow-up.';
    await markOutcomeHandoffUnavailable(outcome.id, message);
    return { ok: false, message };
  }

  const task = await createTask({
    title: outcome.title,
    description: `${outcome.summary}\n\nSource: Assembly outcome`,
    assigned_to: outcome.owner_id,
    created_by: context.id,
    due_date: outcome.due_date || undefined,
    section_id: table.section_id,
    table_id: table.id,
    status_id: status.id,
    priority_id: priority.id,
  });

  const { error: handoffError } = await supabase.from('assembly_handoff').insert({
    tenant_id: context.tenant_id,
    outcome_id: outcome.id,
    target_app: 'tablez',
    status: 'sent',
    external_record_id: task.id,
    message: 'Owner task created in Tablez & Chairz.',
  });
  if (handoffError) throw handoffError;

  const { error: outcomeError } = await supabase
    .from('assembly_outcome')
    .update({ handoff_status: 'sent', external_record_id: task.id, updated_at: new Date().toISOString() })
    .eq('id', outcome.id)
    .eq('tenant_id', context.tenant_id);
  if (outcomeError) throw outcomeError;

  return { ok: true, taskId: task.id };
}
