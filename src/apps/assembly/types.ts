export type AssemblyStatus = 'draft' | 'submitted' | 'accepted' | 'scheduled' | 'recorded' | 'closed';

export type AssemblyMemo = {
  id: string;
  tenant_id: string;
  title: string;
  what_text: string;
  how_text: string;
  now_text: string;
  status: 'draft' | 'submitted' | 'accepted' | 'deferred' | 'closed';
  memo_type: 'operating' | 'governance' | 'review';
  priority: 'low' | 'normal' | 'high';
  author_id: string | null;
  requested_decision: string | null;
  created_at: string;
  updated_at: string;
};

export type AssemblyMeeting = {
  id: string;
  tenant_id: string;
  title: string;
  meeting_type: 'operating' | 'board' | 'shareholder' | 'review';
  scheduled_at: string | null;
  chair_id: string | null;
  status: 'planned' | 'in_session' | 'minutes_draft' | 'closed';
  minutes_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type AssemblyAgendaItem = {
  id: string;
  tenant_id: string;
  meeting_id: string;
  memo_id: string;
  title: string;
  purpose: 'inform' | 'discuss' | 'decide' | 'approve' | 'resolve' | 'defer';
  sort_order: number;
  timebox_minutes: number | null;
  status: 'planned' | 'covered' | 'deferred';
  memo?: Pick<AssemblyMemo, 'id' | 'title' | 'author_id' | 'priority' | 'requested_decision'> | null;
};

export type AssemblyOutcome = {
  id: string;
  tenant_id: string;
  meeting_id: string | null;
  agenda_item_id: string | null;
  memo_id: string | null;
  title: string;
  outcome_type: 'action' | 'decision' | 'approval' | 'deferral' | 'escalation' | 'resolution';
  summary: string;
  owner_id: string | null;
  due_date: string | null;
  handoff_target: 'tablez' | 'menu_review' | 'counter' | 'patron' | 'keep' | 'none';
  handoff_status: 'not_required' | 'pending' | 'sent' | 'unavailable';
  external_record_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AssemblyResolution = {
  id: string;
  tenant_id: string;
  meeting_id: string | null;
  title: string;
  resolution_type: 'board' | 'shareholder' | 'written_consent';
  status: 'draft' | 'approved' | 'rejected' | 'filed';
  approved_at: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type AssemblyReview = {
  id: string;
  tenant_id: string;
  title: string;
  cadence: 'weekly' | 'quarterly' | 'annual';
  status: 'open' | 'in_review' | 'closed';
  period_label: string;
  meeting_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AssemblyUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type AssemblyDashboard = {
  memos: AssemblyMemo[];
  meetings: AssemblyMeeting[];
  agendaItems: AssemblyAgendaItem[];
  outcomes: AssemblyOutcome[];
  resolutions: AssemblyResolution[];
  reviews: AssemblyReview[];
  users: AssemblyUser[];
  currentUserId: string | null;
};

export type CreateMemoInput = Pick<AssemblyMemo, 'title' | 'what_text' | 'how_text' | 'now_text' | 'memo_type' | 'priority'> & {
  requested_decision?: string | null;
};

export type CreateMeetingInput = Pick<AssemblyMeeting, 'title' | 'meeting_type'> & {
  scheduled_at?: string | null;
  chair_id?: string | null;
};

export type CreateOutcomeInput = Pick<AssemblyOutcome, 'title' | 'outcome_type' | 'summary' | 'owner_id' | 'due_date' | 'handoff_target'> & {
  meeting_id?: string | null;
  agenda_item_id?: string | null;
  memo_id?: string | null;
};
