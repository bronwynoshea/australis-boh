import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import {
  acceptMemoToAgenda,
  createAssemblyMeeting,
  createAssemblyMemo,
  createAssemblyOutcome,
  createOwnerTaskFromOutcome,
  fetchAssemblyDashboard,
  isAssemblySchemaUnavailable,
  updateMeetingMinutes,
} from './assemblyApi';
import type { AssemblyDashboard, AssemblyMeeting, AssemblyMemo, AssemblyOutcome } from './types';

interface AssemblyAppProps {
  isAdmin?: boolean;
}

type TabKey = 'overview' | 'memos' | 'meetings' | 'governance' | 'reviews' | 'outcomes';

const tabCopy: Record<TabKey, { title: string; eyebrow: string; description: string }> = {
  overview: {
    eyebrow: 'Decision operating layer',
    title: 'Assembly',
    description: 'Memos become agendas, meetings become records, and outcomes become accountable follow-up.',
  },
  memos: {
    eyebrow: 'Memo discipline',
    title: 'Memos',
    description: 'Capture the context required before an item reaches an agenda.',
  },
  meetings: {
    eyebrow: 'Meeting preparation',
    title: 'Meetings',
    description: 'Build agendas from accepted memos and keep minutes in one formal record.',
  },
  governance: {
    eyebrow: 'Company records',
    title: 'Governance',
    description: 'Separate board, shareholder, and written-consent records from day-to-day notes.',
  },
  reviews: {
    eyebrow: 'Operating cadence',
    title: 'Reviews',
    description: 'Track weekly, quarterly, and annual review cycles fed by memo-based input.',
  },
  outcomes: {
    eyebrow: 'Accountability',
    title: 'Outcomes & Tasks',
    description: 'Record decisions and send action-type outcomes to the right owner.',
  },
};

const statusLabel = (status: string) => status.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const badgeClasses = (tone: 'blue' | 'green' | 'amber' | 'slate' | 'purple' = 'slate') => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/30',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30',
    slate: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-boh-text-sub dark:border-boh-border',
    purple: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:border-violet-500/30',
  };
  return `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`;
};

const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <section className={`rounded-2xl border border-boh-border-light bg-boh-surface-light p-5 shadow-sm dark:border-boh-border dark:bg-boh-surface ${className}`}>
    {children}
  </section>
);

const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`rounded-xl bg-boh-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-boh-primary-dark disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
  />
);

const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`rounded-xl border border-boh-border-light bg-white px-4 py-2.5 text-sm font-semibold text-boh-text-light transition-colors hover:bg-boh-bg-light disabled:cursor-not-allowed disabled:opacity-60 dark:border-boh-border dark:bg-boh-card dark:text-boh-text dark:hover:bg-boh-surface ${className}`}
  />
);

const assemblyFieldClass = 'w-full rounded-xl border border-boh-border-light bg-boh-surface-light px-3 py-2 text-sm text-boh-text-light shadow-sm outline-none transition-colors placeholder:text-boh-text-sub-light focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/20 dark:border-boh-border dark:bg-boh-card dark:text-boh-text dark:placeholder:text-boh-text-sub dark:focus:border-boh-accent dark:focus:ring-boh-accent/20';
const assemblySelectButtonClass = `${assemblyFieldClass} flex items-center justify-between gap-3 text-left`;

type AssemblySelectOption = { value: string; label: string };

const ThemedSelect: React.FC<{
  value: string;
  options: AssemblySelectOption[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}> = ({ value, options, onChange, label = 'Select option', className = '' }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className={`relative ${className}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button type="button" className={assemblySelectButtonClass} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((next) => !next)}>
        <span className={selected ? '' : 'text-boh-text-sub-light dark:text-boh-text-sub'}>{selected?.label ?? label}</span>
        <span aria-hidden="true" className="text-boh-text-sub-light dark:text-boh-text-sub">⌄</span>
      </button>
      {open && (
        <div role="listbox" className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-boh-border-light bg-boh-surface-light p-1 text-sm shadow-xl shadow-slate-900/10 dark:border-boh-border dark:bg-boh-card dark:shadow-black/30">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${active ? 'bg-boh-primary text-white' : 'text-boh-text-light hover:bg-boh-bg-light dark:text-boh-text dark:hover:bg-boh-surface'}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onChange(option.value); setOpen(false); }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

function currentTab(pathname: string): TabKey {
  if (pathname.includes('/memos')) return 'memos';
  if (pathname.includes('/meetings')) return 'meetings';
  if (pathname.includes('/governance')) return 'governance';
  if (pathname.includes('/reviews')) return 'reviews';
  if (pathname.includes('/outcomes')) return 'outcomes';
  return 'overview';
}

const AssemblyMobileHeader: React.FC = () => {
  const copy = tabCopy[currentTab(useLocation().pathname)];
  return (
    <header className="lg:hidden border-b border-boh-border-light bg-boh-surface-light p-4 dark:border-boh-border dark:bg-boh-surface">
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{copy.eyebrow}</p>
      <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{copy.title}</h1>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{copy.description}</p>
    </header>
  );
};

const AssemblyPageHeader: React.FC = () => {
  const copy = tabCopy[currentTab(useLocation().pathname)];
  return (
    <div className="mb-6 hidden lg:block">
      <p className="mb-1 text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{copy.eyebrow}</p>
      <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">{copy.title}</h1>
      <p className="mt-1 max-w-3xl text-boh-text-sub-light dark:text-boh-text-sub">{copy.description}</p>
    </div>
  );
};

const EmptyState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-2xl border border-dashed border-boh-border-light p-8 text-center dark:border-boh-border">
    <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{title}</h3>
    <p className="mx-auto mt-2 max-w-xl text-sm text-boh-text-sub-light dark:text-boh-text-sub">{body}</p>
  </div>
);

const OverviewPage: React.FC<{ data: AssemblyDashboard }> = ({ data }) => {
  const openOutcomes = data.outcomes.filter((item) => item.handoff_status === 'pending').length;
  const acceptedMemos = data.memos.filter((memo) => memo.status === 'accepted').length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Submitted memos', data.memos.length],
          ['Accepted for agenda', acceptedMemos],
          ['Meetings planned', data.meetings.filter((meeting) => meeting.status === 'planned').length],
          ['Open outcomes', openOutcomes],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-boh-text-light dark:text-boh-text">{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className={badgeClasses('purple')}>No memo, no agenda item</p>
            <h2 className="mt-4 text-xl font-semibold text-boh-text-light dark:text-boh-text">Assembly owns the decision record.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-boh-text-sub-light dark:text-boh-text-sub">
              Assembly keeps the memo, agenda, minutes, outcome, resolution, and review record together. Follow-up work is handed to Tablez & Chairz, while initiative review belongs in Menu. Assembly does not create Forge workstreams.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Recent memos</h2>
          <div className="mt-4 space-y-3">
            {data.memos.slice(0, 4).map((memo) => <MemoRow key={memo.id} memo={memo} />)}
            {data.memos.length === 0 && <EmptyState title="No memos yet" body="Create a memo with What, How, and Now before it can be considered for an agenda." />}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Open outcomes</h2>
          <div className="mt-4 space-y-3">
            {data.outcomes.filter((outcome) => outcome.handoff_status === 'pending').slice(0, 4).map((outcome) => <OutcomeRow key={outcome.id} outcome={outcome} data={data} />)}
            {openOutcomes === 0 && <EmptyState title="No pending handoffs" body="When an action needs an owner, record the outcome and send it to the appropriate follow-up lane." />}
          </div>
        </Card>
      </div>
    </div>
  );
};

const MemoRow: React.FC<{ memo: AssemblyMemo }> = ({ memo }) => (
  <div className="rounded-xl border border-boh-border-light p-4 dark:border-boh-border">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-boh-text-light dark:text-boh-text">{memo.title}</h3>
      <span className={badgeClasses(memo.status === 'accepted' ? 'green' : memo.priority === 'high' ? 'amber' : 'slate')}>{statusLabel(memo.status)}</span>
    </div>
    <p className="mt-2 line-clamp-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{memo.what_text}</p>
  </div>
);

const MemosPage: React.FC<{ data: AssemblyDashboard; refresh: () => Promise<void>; notify: (message: string, tone?: 'success' | 'error') => void }> = ({ data, refresh, notify }) => {
  const [form, setForm] = useState({ title: '', what_text: '', how_text: '', now_text: '', requested_decision: '', memo_type: 'operating' as const, priority: 'normal' as const });
  const [isSaving, setIsSaving] = useState(false);
  const nextMeeting = data.meetings.find((meeting) => meeting.status !== 'closed');

  const submitMemo = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await createAssemblyMemo(form);
      setForm({ title: '', what_text: '', how_text: '', now_text: '', requested_decision: '', memo_type: 'operating', priority: 'normal' });
      await refresh();
      notify('Memo submitted for agenda review.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Memo could not be saved.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const acceptMemo = async (memo: AssemblyMemo) => {
    if (!nextMeeting) {
      notify('Create a meeting before accepting memos onto an agenda.', 'error');
      return;
    }
    await acceptMemoToAgenda(memo, nextMeeting.id, memo.memo_type === 'governance' ? 'resolve' : 'decide');
    await refresh();
    notify('Memo accepted onto the next agenda.', 'success');
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Memo queue</h2>
        <div className="mt-4 space-y-3">
          {data.memos.map((memo) => (
            <div key={memo.id} className="rounded-xl border border-boh-border-light p-4 dark:border-boh-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-boh-text-light dark:text-boh-text">{memo.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={badgeClasses(memo.status === 'accepted' ? 'green' : 'slate')}>{statusLabel(memo.status)}</span>
                    <span className={badgeClasses(memo.priority === 'high' ? 'amber' : 'slate')}>{statusLabel(memo.priority)} priority</span>
                  </div>
                </div>
                <SecondaryButton disabled={memo.status === 'accepted'} onClick={() => void acceptMemo(memo)}>Accept to agenda</SecondaryButton>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">What</p><p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{memo.what_text}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">How</p><p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{memo.how_text}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Now</p><p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{memo.now_text}</p></div>
              </div>
            </div>
          ))}
          {data.memos.length === 0 && <EmptyState title="No memos submitted" body="Agenda items start here. Capture the problem, options, and requested decision first." />}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Submit memo</h2>
        <form className="mt-4 space-y-4" onSubmit={submitMemo}>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Memo title" className={assemblyFieldClass} />
          {(['what_text', 'how_text', 'now_text'] as const).map((field) => (
            <textarea key={field} required rows={4} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder={field === 'what_text' ? 'What is the problem, opportunity, or decision?' : field === 'how_text' ? 'How should the options, risks, and tradeoffs be understood?' : 'Now what recommendation, decision, or next step is needed?'} className={assemblyFieldClass} />
          ))}
          <textarea rows={3} value={form.requested_decision} onChange={(e) => setForm({ ...form, requested_decision: e.target.value })} placeholder="Requested decision" className={assemblyFieldClass} />
          <div className="grid grid-cols-2 gap-3">
            <ThemedSelect value={form.memo_type} label="Memo type" onChange={(value) => setForm({ ...form, memo_type: value as typeof form.memo_type })} options={[{ value: 'operating', label: 'Operating' }, { value: 'governance', label: 'Governance' }, { value: 'review', label: 'Review' }]} />
            <ThemedSelect value={form.priority} label="Priority" onChange={(value) => setForm({ ...form, priority: value as typeof form.priority })} options={[{ value: 'normal', label: 'Normal priority' }, { value: 'high', label: 'High priority' }, { value: 'low', label: 'Low priority' }]} />
          </div>
          <PrimaryButton disabled={isSaving} type="submit">Submit memo</PrimaryButton>
        </form>
      </Card>
    </div>
  );
};

const MeetingsPage: React.FC<{ data: AssemblyDashboard; refresh: () => Promise<void>; notify: (message: string, tone?: 'success' | 'error') => void }> = ({ data, refresh, notify }) => {
  const [title, setTitle] = useState('');
  const [minutesByMeeting, setMinutesByMeeting] = useState<Record<string, string>>({});

  const createMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    await createAssemblyMeeting({ title, meeting_type: 'operating' });
    setTitle('');
    await refresh();
    notify('Meeting created.', 'success');
  };

  const saveMinutes = async (meeting: AssemblyMeeting) => {
    await updateMeetingMinutes(meeting.id, minutesByMeeting[meeting.id] || '');
    await refresh();
    notify('Minutes saved.', 'success');
  };

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={createMeeting} className="flex flex-col gap-3 md:flex-row">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New meeting title" className={`${assemblyFieldClass} min-w-0 flex-1`} />
          <PrimaryButton type="submit">Create meeting</PrimaryButton>
        </form>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {data.meetings.map((meeting) => {
          const agenda = data.agendaItems.filter((item) => item.meeting_id === meeting.id);
          return (
            <Card key={meeting.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{meeting.title}</h2>
                  <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{agenda.length} agenda items</p>
                </div>
                <span className={badgeClasses('blue')}>{statusLabel(meeting.status)}</span>
              </div>
              <div className="mt-4 space-y-2">
                {agenda.map((item) => <div key={item.id} className="rounded-xl bg-boh-bg-light p-3 text-sm dark:bg-boh-card"><span className="font-medium text-boh-text-light dark:text-boh-text">{item.sort_order}. {item.title}</span><span className="ml-2 text-boh-text-sub-light dark:text-boh-text-sub">{statusLabel(item.purpose)}</span></div>)}
                {agenda.length === 0 && <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Accept memos to build this agenda.</p>}
              </div>
              <textarea rows={4} value={minutesByMeeting[meeting.id] ?? meeting.minutes_summary ?? ''} onChange={(e) => setMinutesByMeeting({ ...minutesByMeeting, [meeting.id]: e.target.value })} placeholder="Record minutes and discussion summary" className={`${assemblyFieldClass} mt-4`} />
              <SecondaryButton onClick={() => void saveMinutes(meeting)}>Save minutes</SecondaryButton>
            </Card>
          );
        })}
        {data.meetings.length === 0 && <EmptyState title="No meetings planned" body="Create a meeting, then accept submitted memos onto the agenda." />}
      </div>
    </div>
  );
};

const OutcomeRow: React.FC<{ outcome: AssemblyOutcome; data: AssemblyDashboard }> = ({ outcome, data }) => {
  const owner = data.users.find((user) => user.id === outcome.owner_id);
  return (
    <div className="rounded-xl border border-boh-border-light p-4 dark:border-boh-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-boh-text-light dark:text-boh-text">{outcome.title}</h3>
        <span className={badgeClasses(outcome.handoff_status === 'sent' ? 'green' : outcome.handoff_status === 'unavailable' ? 'amber' : 'slate')}>{statusLabel(outcome.handoff_status)}</span>
      </div>
      <p className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{outcome.summary}</p>
      <p className="mt-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">Owner: {owner?.full_name || owner?.email || 'Not assigned'}</p>
    </div>
  );
};

const OutcomesPage: React.FC<{ data: AssemblyDashboard; refresh: () => Promise<void>; notify: (message: string, tone?: 'success' | 'error') => void }> = ({ data, refresh, notify }) => {
  const [form, setForm] = useState({ title: '', summary: '', outcome_type: 'action' as const, owner_id: '', handoff_target: 'tablez' as const, due_date: '' });
  const [isSaving, setIsSaving] = useState(false);

  const createOutcome = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await createAssemblyOutcome({ ...form, owner_id: form.owner_id || null, due_date: form.due_date || null });
      setForm({ title: '', summary: '', outcome_type: 'action', owner_id: '', handoff_target: 'tablez', due_date: '' });
      await refresh();
      notify('Outcome recorded.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Outcome could not be saved.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const sendTask = async (outcome: AssemblyOutcome) => {
    try {
      const result = await createOwnerTaskFromOutcome(outcome);
      await refresh();
      if ('taskId' in result) {
        notify('Owner task created in Tablez & Chairz.', 'success');
      } else {
        notify(result.message, 'error');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Owner task could not be created.', 'error');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Outcome record</h2>
        <div className="mt-4 space-y-3">
          {data.outcomes.map((outcome) => (
            <div key={outcome.id}>
              <OutcomeRow outcome={outcome} data={data} />
              {outcome.handoff_target === 'tablez' && outcome.handoff_status === 'pending' && <SecondaryButton className="mt-2" onClick={() => void sendTask(outcome)}>Create owner task</SecondaryButton>}
            </div>
          ))}
          {data.outcomes.length === 0 && <EmptyState title="No outcomes recorded" body="Every decision should have an owner, a clear record, and a next step." />}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Record outcome</h2>
        <form className="mt-4 space-y-4" onSubmit={createOutcome}>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Outcome title" className={assemblyFieldClass} />
          <textarea required rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Decision, action, approval, or deferral summary" className={assemblyFieldClass} />
          <ThemedSelect value={form.outcome_type} label="Outcome type" onChange={(value) => setForm({ ...form, outcome_type: value as typeof form.outcome_type })} options={[{ value: 'action', label: 'Action' }, { value: 'decision', label: 'Decision' }, { value: 'approval', label: 'Approval' }, { value: 'deferral', label: 'Deferral' }, { value: 'escalation', label: 'Escalation' }, { value: 'resolution', label: 'Resolution' }]} />
          <ThemedSelect value={form.owner_id} label="Select owner" onChange={(value) => setForm({ ...form, owner_id: value })} options={[{ value: '', label: 'Select owner' }, ...data.users.map((user) => ({ value: user.id, label: user.full_name || user.email }))]} />
          <input type="text" inputMode="numeric" pattern="\\d{4}-\\d{2}-\\d{2}" placeholder="YYYY-MM-DD" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={assemblyFieldClass} />
          <ThemedSelect value={form.handoff_target} label="Follow-up target" onChange={(value) => setForm({ ...form, handoff_target: value as typeof form.handoff_target })} options={[{ value: 'tablez', label: 'Owner task in Tablez & Chairz' }, { value: 'menu_review', label: 'Menu initiative review task' }, { value: 'none', label: 'Record only' }]} />
          <PrimaryButton disabled={isSaving} type="submit">Record outcome</PrimaryButton>
        </form>
      </Card>
    </div>
  );
};

const GovernancePage: React.FC<{ data: AssemblyDashboard }> = ({ data }) => (
  <div className="grid gap-6 lg:grid-cols-2">
    <Card><h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Governance meetings</h2><div className="mt-4 space-y-3">{data.meetings.filter((meeting) => ['board', 'shareholder'].includes(meeting.meeting_type)).map((meeting) => <div key={meeting.id} className="rounded-xl border border-boh-border-light p-4 dark:border-boh-border"><h3 className="font-semibold text-boh-text-light dark:text-boh-text">{meeting.title}</h3><p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{statusLabel(meeting.meeting_type)} meeting</p></div>)}{data.meetings.filter((meeting) => ['board', 'shareholder'].includes(meeting.meeting_type)).length === 0 && <EmptyState title="No governance meetings" body="Board and shareholder records are kept separate from informal operating notes." />}</div></Card>
    <Card><h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Resolutions</h2><div className="mt-4 space-y-3">{data.resolutions.map((resolution) => <div key={resolution.id} className="rounded-xl border border-boh-border-light p-4 dark:border-boh-border"><h3 className="font-semibold text-boh-text-light dark:text-boh-text">{resolution.title}</h3><span className={badgeClasses(resolution.status === 'approved' ? 'green' : 'slate')}>{statusLabel(resolution.status)}</span></div>)}{data.resolutions.length === 0 && <EmptyState title="No resolutions recorded" body="Formal approvals and written consents will appear here once recorded." />}</div></Card>
  </div>
);

const ReviewsPage: React.FC<{ data: AssemblyDashboard }> = ({ data }) => (
  <Card>
    <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Review cadence</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {(['weekly', 'quarterly', 'annual'] as const).map((cadence) => {
        const count = data.reviews.filter((review) => review.cadence === cadence).length;
        return <div key={cadence} className="rounded-xl border border-boh-border-light p-4 dark:border-boh-border"><p className="font-semibold text-boh-text-light dark:text-boh-text">{statusLabel(cadence)}</p><p className="mt-2 text-3xl font-semibold text-boh-text-light dark:text-boh-text">{count}</p><p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">review records</p></div>;
      })}
    </div>
  </Card>
);

const AssemblyApp: React.FC<AssemblyAppProps> = ({ isAdmin = false }) => {
  const [data, setData] = useState<AssemblyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const refresh = async () => {
    const next = await fetchAssemblyDashboard();
    setData(next);
    setError(null);
    setSchemaUnavailable(false);
  };

  useEffect(() => {
    refresh().catch((loadError) => {
      setSchemaUnavailable(isAssemblySchemaUnavailable(loadError));
      setError(loadError instanceof Error ? loadError.message : 'Assembly could not be loaded.');
    });
  }, []);

  const notify = (message: string, tone: 'success' | 'error' = 'success') => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const content = useMemo(() => {
    if (schemaUnavailable) {
      return <EmptyState title="Assembly data is not installed yet" body="The app is ready, but the Assembly database migration must be applied in the approved BOH environment before records can be created." />;
    }
    if (error) return <EmptyState title="Assembly could not be loaded" body={error} />;
    if (!data) return <div className="py-16 text-center text-boh-text-sub-light dark:text-boh-text-sub">Loading Assembly…</div>;

    return (
      <Routes>
        <Route index element={<Navigate to="/assembly/overview" replace />} />
        <Route path="overview" element={<OverviewPage data={data} />} />
        <Route path="memos" element={<MemosPage data={data} refresh={refresh} notify={notify} />} />
        <Route path="meetings" element={<MeetingsPage data={data} refresh={refresh} notify={notify} />} />
        <Route path="governance" element={<GovernancePage data={data} />} />
        <Route path="reviews" element={<ReviewsPage data={data} />} />
        <Route path="outcomes" element={<OutcomesPage data={data} refresh={refresh} notify={notify} />} />
        <Route path="*" element={<Navigate to="/assembly/overview" replace />} />
      </Routes>
    );
  }, [data, error, schemaUnavailable]);

  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} mobileHeader={<AssemblyMobileHeader />}>
      <AssemblyPageHeader />
      {notice && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'}`}>{notice.message}</div>}
      {content}
    </BOHShell>
  );
};

export default AssemblyApp;
