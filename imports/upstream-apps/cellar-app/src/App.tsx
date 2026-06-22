import {
  Archive,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpenText,
  CalendarDays,
  ChevronDown,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  LayoutGrid,
  LockKeyhole,
  List,
  Mail,
  Maximize2,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Presentation,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Moon,
  Star,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type FormEvent } from 'react';
import { cellarSupabasePublishableKey, cellarSupabaseUrl, supabase } from './lib/supabase';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ThemeMode = 'dark' | 'light';
type AppSection = 'Home' | 'Pitch' | 'Questions' | 'Messages' | 'Updates';
type StaffSection =
  | 'Dashboard'
  | 'Investor Requests'
  | 'Investor Pipeline'
  | 'Investor Contacts'
  | 'Investor Messages'
  | 'Invites'
  | 'Access'
  | 'Presentations'
  | 'Q&A'
  | 'Team';
type DeckKey = `asset:${string}`;
type LegalDrawerKind = 'terms' | 'privacy' | 'investor-guide' | 'staff-guide';
type ContactDirectoryStatusFilter = 'active' | 'guest' | 'verified' | 'archived' | 'all';
type InvestorAsset = {
  id: string;
  presentation_id?: string | null;
  title: string;
  asset_type: string;
  visibility: string;
  status: string;
  tab_label: string | null;
  summary: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  sort_order?: number;
  slide_narratives?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
};
type StaffPresentation = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  sort_order: number;
  published_at: string | null;
  is_legacy?: boolean;
  asset_count?: number;
};
type InvestorPresentation = Pick<StaffPresentation, 'id' | 'title' | 'description' | 'status' | 'published_at'>;
type InvestorMessage = {
  id: string;
  sender_kind: 'investor' | 'staff' | 'system';
  sender_boh_user_id?: string | null;
  sender_display_name?: string | null;
  body: string;
  sent_at: string;
};
type InvestorMessageThread = {
  id: string;
  investor_access_id: string;
  subject: string;
  status: string;
  last_message_at: string | null;
  messages: InvestorMessage[];
};
type StaffMessageThread = InvestorMessageThread & {
  created_at: string;
  cellar_investor_access?: {
    email: string;
    full_name: string | null;
    company: string | null;
    title: string | null;
    access_status: string;
    pipeline_status: string | null;
  } | null;
};
type StaffContactActivityItem = {
  id: string;
  occurredAt: string | null;
  type: string;
  title: string;
  body: string;
  meta?: string;
};
type StaffContactNote = {
  id: string;
  investor_access_id: string;
  note_body: string;
  created_by_boh_user_id: string | null;
  updated_by_boh_user_id: string | null;
  created_at: string;
  updated_at: string;
};
type StaffActivityEvent = {
  id: string;
  investor_access_id: string | null;
  actor_kind: string;
  actor_boh_user_id: string | null;
  event_type: string;
  event_at: string;
  metadata: Record<string, unknown> | null;
};
type CellarInvestorRequest = {
  id: string;
  investor_access_id: string;
  email: string;
  first_name: string;
  last_name: string;
  investor_category: string;
  title: string | null;
  company: string | null;
  profile_status: string;
  submitted_at: string;
};
type StaffNotificationItem = {
  id: string;
  title: string;
  body: string;
  meta: string;
  targetSection?: StaffSection;
  targetId?: string;
};
type CellarInvestorPipelineRecord = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  title: string | null;
  access_status: string;
  pipeline_status: string;
  assigned_boh_user_id: string | null;
  verified_at: string | null;
  last_seen_at: string | null;
  guest_code_sent_at?: string | null;
  guest_code_sent_from_boh_user_id?: string | null;
  guest_code_sent_by_boh_user_id?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};
type PreparedQA = {
  id: string;
  question: string;
  answer: string;
  topic: string | null;
  status: string;
  visibility: string;
  related_asset_id: string | null;
  sort_order: number | null;
  published_at: string | null;
  updated_at: string | null;
  created_at: string;
};
type StaffAsset = InvestorAsset;
type CellarUploadAssetResult = {
  cellar_asset?: {
    id?: string;
    presentation_id?: string | null;
  };
};
type CellarStaffContentResult = {
  cellar_presentations?: StaffPresentation[];
  cellar_assets?: StaffAsset[];
  error?: string;
};
type CellarSelectOption = { value: string; label: string };
type CellarGuestAccessSummary = {
  guest_access_code_id: string;
  status: string;
  issued_at: string;
  expires_at: string;
  reset_at: string | null;
  days_remaining: number;
  cellar_guest_code?: string | null;
};
type StaffTeamRecord = {
  id: string;
  email: string | null;
  name: string;
};
type StaffContactEditSection = 'contact';
type StaffAuthState = {
  status: 'checking' | 'signed_out' | 'stale' | 'ready' | 'unmapped';
  email: string;
  bohUserId: string | null;
  message: string;
};
type CellarWorkspaceAccessState = {
  mode: 'anonymous' | 'staff' | 'investor' | 'unverified';
  canStaff: boolean;
  canInvestor: boolean;
  authUserId: string | null;
  bohUserId: string | null;
  investorAccessId: string | null;
  accessStatus: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  verifiedAt: string | null;
};
type CellarBookingProfile = {
  email: string;
  firstName: string;
  lastName: string;
};
type CellarLegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};
type CellarGuideVideo = {
  title: string;
  src: string;
  poster?: string;
  durationLabel?: string;
};
type CellarGuideModule = CellarGuideVideo & {
  id: string;
  description: string;
};
type CellarDrawerContent = {
  title: string;
  eyebrow: string;
  summary: string;
  updatedLabel?: string;
  video?: CellarGuideVideo;
  modules?: CellarGuideModule[];
  sections: CellarLegalSection[];
  externalUrl?: string;
};

function formatCompactDate(value?: string | null) {
  if (!value) {
    return 'No activity';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCompactDateTime(value?: string | null) {
  if (!value) {
    return 'Date not recorded';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatCellarLabel(value?: string | null) {
  if (!value) return 'Not set';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCellarAccountDate(value?: string | null) {
  if (!value) return 'Date not recorded';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getCellarInitials(value?: string | null) {
  const initials = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || 'C';
}

function getCellarStaffBadge(staff?: StaffTeamRecord | null) {
  const emailPrefix = staff?.email?.split('@')[0]?.replace(/[^a-z0-9]/gi, '') ?? '';
  if (emailPrefix.length >= 3) return emailPrefix.slice(0, 3).toUpperCase();
  return getCellarInitials(staff?.name || staff?.email || 'Staff');
}

function getPresentationUpdatedLabel(presentation: InvestorPresentation) {
  if (presentation.published_at) return `Updated ${formatCompactDate(presentation.published_at)}`;
  return 'No recent update';
}

function createCellarSlug(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'cellar-presentation'}-${Date.now().toString(36)}`;
}

function toCellarTitleCase(value: string) {
  return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function uppercaseFirstTypedCharacter(value: string) {
  return value.replace(/^(\s*)(\S)/, (_match, leadingSpace: string, firstCharacter: string) =>
    `${leadingSpace}${firstCharacter.toUpperCase()}`,
  );
}

function sanitizeCellarFileName(value: string) {
  const safeName = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return safeName || 'cellar-notes';
}

function escapePdfText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/®/g, '(R)')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapPdfLine(value: string, maxLength = 86) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [''];
}

function createCellarNotesPdf(title: string, entries: { title: string; note: string }[], generatedAt = new Date()) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const lineHeight = 16;
  const pageCount = Math.max(entries.length, 1);
  const fontObjectId = 1;
  const boldFontObjectId = 2;
  const pagesObjectId = pageCount * 2 + 3;
  const catalogObjectId = pagesObjectId + 1;
  const objects: string[] = [
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  (entries.length ? entries : [{ title: 'Notes', note: 'No notes added.' }]).forEach((entry, index) => {
    let cursorY = pageHeight - margin;
    const commands = [
      'q',
      '0.18 0.08 0.16 rg',
      `0 0 ${pageWidth} ${pageHeight} re f`,
      '0.97 0.95 0.96 rg',
      `${margin - 16} ${margin - 18} ${pageWidth - (margin * 2) + 32} ${pageHeight - (margin * 2) + 36} re f`,
      '0.76 0.63 0.71 RG',
      `${margin - 16} ${pageHeight - margin - 18} ${pageWidth - (margin * 2) + 32} 0 l S`,
      'Q',
      'BT',
    ];
    const writeLine = (text: string, size: number, gap = 0, font = 'F1') => {
      commands.push(`/${font} ${size} Tf`);
      commands.push('0.13 0.08 0.11 rg');
      commands.push(`1 0 0 1 ${margin} ${cursorY} Tm (${escapePdfText(text)}) Tj`);
      cursorY -= lineHeight + gap;
    };
    writeLine('CELLAR Investor Notes', 10, 4, 'F2');
    writeLine(title, 18, 10, 'F2');
    writeLine(`Generated ${generatedAt.toLocaleString()}`, 9, 18);
    writeLine(entry.title, 13, 12, 'F2');
    wrapPdfLine(entry.note.trim() || 'No notes added.', 82).forEach((line) => writeLine(line, 11, 1));
    commands.push('ET');
    const stream = commands.join('\n');
    const contentObjectId = index * 2 + 3;
    const pageObjectId = contentObjectId + 1;
    objects[contentObjectId - 1] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
    objects[pageObjectId - 1] = `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
  });

  const pageRefs = Array.from({ length: pageCount }, (_, index) => `${index * 2 + 4} 0 R`).join(' ');
  objects[pagesObjectId - 1] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>`;
  objects[catalogObjectId - 1] = `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`;

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(chunks.join('').length);
    chunks.push(`${index + 1} 0 obj\n${content}\nendobj\n`);
  });
  const xrefOffset = chunks.join('').length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}

async function saveCellarBlob(blob: Blob, fileName: string) {
  const maybeWindow = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  if (maybeWindow.showSaveFilePicker) {
    const handle = await maybeWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCellarBlobFromObjectUrl(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchCellarPresentationPdfBlob(asset: InvestorAsset) {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_get_asset_url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
      ...(sessionData.session?.access_token || cellarSupabasePublishableKey
        ? { Authorization: `Bearer ${sessionData.session?.access_token || cellarSupabasePublishableKey}` }
        : {}),
    },
    body: JSON.stringify({
      asset_id: asset.id,
      cellar_session_id: window.sessionStorage.getItem('cellar_guest_session_id'),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.signed_url) {
    throw new Error(result?.error || 'CELLAR_PRESENTATION_PDF_UNAVAILABLE');
  }

  const pdfResponse = await fetch(result.signed_url);
  if (!pdfResponse.ok) {
    throw new Error('CELLAR_PRESENTATION_PDF_FETCH_FAILED');
  }

  const blob = await pdfResponse.blob();
  const header = await blob.slice(0, 5).text();
  if (!header.startsWith('%PDF-')) {
    throw new Error('CELLAR_PRESENTATION_PDF_INVALID');
  }

  return blob;
}

function normalizeCellarSlideNarratives(value?: Record<string, string> | null) {
  return Object.entries(value ?? {})
    .map(([slide, narrative]) => ({
      slide: Number(slide),
      narrative: String(narrative ?? ''),
    }))
    .filter((entry) => Number.isInteger(entry.slide) && entry.slide > 0)
    .sort((left, right) => left.slide - right.slide);
}

function createCellarSlideNarrativeMap(rows: Array<{ slide: number; narrative: string }>) {
  return rows.reduce<Record<string, string>>((result, row) => {
    if (Number.isInteger(row.slide) && row.slide > 0 && row.narrative.trim()) {
      result[String(row.slide)] = row.narrative.trimEnd();
    }
    return result;
  }, {});
}

function getCellarSlideNarrativeSignature(value?: Record<string, string> | null) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value ?? {})
        .filter(([slide]) => Number.isInteger(Number(slide)) && Number(slide) > 0)
        .sort(([left], [right]) => Number(left) - Number(right)),
    ),
  );
}

function getFriendlyCellarError(error: unknown, fallback: string) {
  if (
    error instanceof Error &&
    error.message &&
    !error.message.toLowerCase().includes('fetch')
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

function getFriendlyCellarFunctionError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message || '';
    if (message.includes('Failed to send a request to the Edge Function')) {
      return 'CELLAR Edge Function is not reachable in BOH-DEV yet. Deploy the required cellar_ function, or run Supabase functions locally for this app.';
    }
    if (message.includes('CELLAR_STAFF_AUTH_REQUIRED') || message.includes('Invalid Refresh Token')) {
      return 'Connect a valid JOBZ CAFE® staff session before managing guest access codes.';
    }
    return getFriendlyCellarError(error, fallback);
  }

  return fallback;
}

async function readCellarFunctionError(response: Response, fallback: string) {
  const result = await response.json().catch(() => ({}));
  return typeof result?.error === 'string' && result.error.trim() ? result.error : fallback;
}

function getFriendlyColleagueShareError(error: string) {
  if (error === 'CELLAR_COLLEAGUE_EMAIL_INVALID') {
    return 'Enter a valid colleague email address.';
  }
  if (
    error === 'CELLAR_ASSET_ID_REQUIRED' ||
    error === 'CELLAR_PRESENTATION_URL_REQUIRED'
  ) {
    return 'This presentation link needs refreshing. Please refresh CELLAR and try again.';
  }
  if (
    error === 'CELLAR_ASSET_NOT_FOUND' ||
    error === 'CELLAR_ASSET_NOT_PUBLISHED' ||
    error === 'CELLAR_ASSET_SCOPE_DENIED' ||
    error === 'CELLAR_ASSET_FILE_MISSING' ||
    error === 'CELLAR_PRESENTATION_PDF_REQUIRED' ||
    error === 'CELLAR_SIGNED_URL_FAILED'
  ) {
    return 'We could not prepare the presentation PDF link. Please try again or contact JOBZ CAFE.';
  }
  if (
    error === 'CELLAR_EMAIL_PROVIDER_NOT_CONFIGURED' ||
    error === 'CELLAR_EMAIL_SEND_FAILED' ||
    error === 'CELLAR_PRESENTATION_EMAIL_SEND_FAILED' ||
    error === 'CELLAR_PRESENTATION_EMAIL_FAILED'
  ) {
    return 'We could not send the presentation email right now. Please try again shortly.';
  }
  if (error.startsWith('CELLAR_')) {
    return 'We could not send the presentation right now. Please try again shortly.';
  }
  return error || 'Unable to send the presentation.';
}

function getFriendlyInvestorNotesError(error: string) {
  if (error === 'CELLAR_NOTES_BODY_REQUIRED') {
    return 'Add a note before sending it to JOBZ CAFE.';
  }
  if (
    error === 'CELLAR_INVESTOR_NOTES_ACCESS_REQUIRED' ||
    error === 'CELLAR_VERIFIED_INVESTOR_REQUIRED'
  ) {
    return 'Use an investor access session before sending slide notes to JOBZ CAFE.';
  }
  if (
    error === 'CELLAR_EMAIL_PROVIDER_NOT_CONFIGURED' ||
    error === 'CELLAR_EMAIL_SEND_FAILED' ||
    error === 'CELLAR_INVESTOR_NOTES_EMAIL_FAILED' ||
    error === 'CELLAR_SEND_INVESTOR_NOTES_FAILED'
  ) {
    return 'We could not send your notes right now. Please try again shortly.';
  }
  if (error.startsWith('CELLAR_')) {
    return 'We could not send your notes right now. Please try again shortly.';
  }
  return error || 'Unable to send notes to JOBZ CAFE.';
}

function getFriendlyPresentationDownloadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (
    message === 'CELLAR_PRESENTATION_PDF_UNAVAILABLE' ||
    message === 'CELLAR_PRESENTATION_PDF_FETCH_FAILED' ||
    message === 'CELLAR_PRESENTATION_PDF_INVALID' ||
    message === 'CELLAR_ASSET_NOT_FOUND' ||
    message === 'CELLAR_ASSET_NOT_PUBLISHED' ||
    message === 'CELLAR_ASSET_SCOPE_DENIED' ||
    message === 'CELLAR_ASSET_FILE_MISSING'
  ) {
    return 'We could not prepare the presentation PDF. Please refresh CELLAR and try again.';
  }
  if (message.startsWith('CELLAR_')) {
    return 'Unable to download the presentation PDF right now. Please try again shortly.';
  }
  return message || 'Unable to download the presentation PDF.';
}

function CellarMark({
  className = '',
  tone = 'dark',
}: {
  className?: string;
  tone?: ThemeMode;
}) {
  return (
    <img
      className={className}
      src={tone === 'light' ? '/assets/cellar-mark-light.svg' : '/assets/cellar-mark-dark.svg'}
      alt="CELLAR Slide Chamber mark"
    />
  );
}

const accessCode = ['C', 'L', 'R', '7', '3', 'K', '9'];

const navItems: Array<{ label: AppSection; displayLabel?: string; icon: ComponentType<{ className?: string }> }> = [
  { label: 'Pitch', displayLabel: 'Presentations', icon: Presentation },
  { label: 'Questions', icon: HelpCircle },
  { label: 'Messages', icon: MessageSquareText },
  { label: 'Updates', icon: BookOpenText },
];

const staffNavItems: Array<{ label: StaffSection; icon: ComponentType<{ className?: string }> }> =
  [
    { label: 'Presentations', icon: Presentation },
    { label: 'Q&A', icon: HelpCircle },
  ];
const staffUtilityNavItems: Array<{ label: StaffSection; icon: ComponentType<{ className?: string }> }> = [
  { label: 'Invites', icon: Mail },
  { label: 'Access', icon: LockKeyhole },
];
const staffSuperAdminNavItems: Array<{ label: StaffSection; icon: ComponentType<{ className?: string }> }> = [
  { label: 'Team', icon: ShieldCheck },
];
const CELLAR_BOOKING_LINKS = [
  {
    host: 'Bronwyn OShea',
    role: 'CEO',
    url: 'https://slotz.jobzcafe.com/#/bronwyn-oshea/investor-call',
  },
  {
    host: 'Asa Lanum',
    role: 'COO',
    url: 'https://slotz.jobzcafe.com/#/asalanum@gmail.com-719c1238/investor-call',
  },
];
const CELLAR_NARRATIVE_EYEBROW = 'Founder Narrative';
const CELLAR_NARRATIVE_HEADING = "What I'd say live";
const CELLAR_INVESTOR_REPLY_NOTIFICATION_DELAY_MS = 5 * 60 * 1000;
const CELLAR_SEEN_INVESTOR_STAFF_MESSAGES_KEY = 'cellar_seen_investor_staff_message_ids';
const CELLAR_FAVORITE_PRESENTATION_IDS_KEY = 'cellar_favorite_presentation_ids';
const CELLAR_THEME_MODE_KEY = 'cellar_theme_mode';
const CELLAR_BOH_EMBED_PARENT_ORIGINS = [
  'https://boh.jobzcafe.com',
  'https://dev-boh.jobzcafe.com',
  'http://localhost:5173',
];
const CELLAR_BOH_EMBED_HANDOFF_MESSAGE = 'CELLAR_BOH_EMBED_HANDOFF';
const CELLAR_BOH_EMBED_READY_MESSAGE = 'CELLAR_BOH_EMBED_READY';
const CELLAR_BOH_EMBED_HANDOFF_RETRY_LIMIT = 2;

function applyCellarDocumentThemeMode(themeMode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.cellarTheme = themeMode;
  document.documentElement.style.colorScheme = themeMode;
}

function getStoredCellarThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const searchParams = new URLSearchParams(window.location.search);
  const queryTheme = searchParams.get('theme');
  const themeMode =
    queryTheme === 'light' || queryTheme === 'dark'
      ? queryTheme
      : window.localStorage.getItem(CELLAR_THEME_MODE_KEY) === 'light'
        ? 'light'
        : 'dark';
  applyCellarDocumentThemeMode(themeMode);
  return themeMode;
}

function setStoredCellarThemeMode(themeMode: ThemeMode) {
  applyCellarDocumentThemeMode(themeMode);
  if (isCellarEmbeddedBohMode()) {
    return;
  }
  window.localStorage.setItem(CELLAR_THEME_MODE_KEY, themeMode);
}

function getFavoritePresentationIds() {
  if (typeof window === 'undefined') return [];
  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(CELLAR_FAVORITE_PRESENTATION_IDS_KEY) ?? '[]');
    return Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function setFavoritePresentationIds(ids: string[]) {
  window.localStorage.setItem(CELLAR_FAVORITE_PRESENTATION_IDS_KEY, JSON.stringify(ids));
}

function getCellarSharedPresentationId() {
  return new URLSearchParams(window.location.search).get('presentation')?.trim() || null;
}

function isCellarEmbeddedBohMode() {
  return new URLSearchParams(window.location.search).get('embedded') === 'boh';
}

function getCellarViewUrl(view: 'dashboard' | 'staff' | '' = '', extraParams: Record<string, string | null> = {}) {
  const params = new URLSearchParams(window.location.search);
  if (view) {
    params.set('view', view);
  } else {
    params.delete('view');
  }
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `${window.location.pathname}?${query}` : window.location.pathname;
}

function getCellarInviteUrl() {
  const configuredUrl = String(import.meta.env.VITE_CELLAR_APP_URL ?? '').trim();
  const inviteUrl = new URL(configuredUrl || window.location.href);
  inviteUrl.search = '';
  inviteUrl.hash = '';
  return inviteUrl.toString();
}

function createCellarDmInviteMessage(firstName: string, accessCode: string) {
  const greeting = firstName.trim() ? `Hi ${firstName.trim()},` : 'Hi,';
  return [
    greeting,
    '',
    'I’m sharing access to the JOBZ CAFE® CELLAR investor workspace so you can review the current presentation materials.',
    '',
    `Open CELLAR here: ${getCellarInviteUrl()}`,
    `Access code: ${accessCode}`,
    '',
    'Please keep this link and code private.',
  ].join('\n');
}

function createCellarEmbedNonce() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function requestCellarBohEmbedHandoff() {
  if (!isCellarEmbeddedBohMode() || window.parent === window) {
    return;
  }

  const message = {
    type: CELLAR_BOH_EMBED_READY_MESSAGE,
    cellar_origin: window.location.origin,
    requested: 'staff_handoff',
    nonce: createCellarEmbedNonce(),
  };

  CELLAR_BOH_EMBED_PARENT_ORIGINS.forEach((origin) => {
    window.parent.postMessage(message, origin);
  });
}

function getNextCellarThemeMode(themeMode: ThemeMode): ThemeMode {
  return themeMode === 'dark' ? 'light' : 'dark';
}

function splitCellarFullName(fullName?: string | null) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' };
}

function getCellarBookingUrl(baseUrl: string, profile: CellarBookingProfile | null) {
  const [urlBeforeHash, hashRoute = ''] = baseUrl.split('#');
  const [route, existingQuery = ''] = urlBeforeHash.split('?');
  const params = new URLSearchParams(existingQuery);
  const cellarReturnUrl = `${window.location.origin}${window.location.pathname}?view=dashboard`;

  params.set('source', 'cellar');
  params.set('return_url', cellarReturnUrl);
  params.set('returnUrl', cellarReturnUrl);

  if (profile?.firstName) {
    params.set('first_name', profile.firstName);
    params.set('firstName', profile.firstName);
  }
  if (profile?.lastName) {
    params.set('last_name', profile.lastName);
    params.set('lastName', profile.lastName);
  }
  if (profile?.email) {
    params.set('email', profile.email);
  }

  const query = params.toString();
  const urlWithQuery = query ? `${route}?${query}` : route;
  return hashRoute ? `${urlWithQuery}#${hashRoute}` : urlWithQuery;
}

function getCellarInvestorPhone(investor: Pick<CellarInvestorPipelineRecord, 'metadata'> | null | undefined) {
  const metadata = investor?.metadata ?? {};
  const phone = metadata.phone ?? metadata.phone_number ?? metadata.mobile ?? metadata.mobile_phone;
  return typeof phone === 'string' && phone.trim() ? phone.trim() : '';
}

function getCellarActivitySortTime(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function getSeenInvestorStaffMessageIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CELLAR_SEEN_INVESTOR_STAFF_MESSAGES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function setSeenInvestorStaffMessageIds(messageIds: string[]) {
  window.localStorage.setItem(
    CELLAR_SEEN_INVESTOR_STAFF_MESSAGES_KEY,
    JSON.stringify(Array.from(new Set(messageIds)).slice(-100)),
  );
}
const investorCategoryOptions: CellarSelectOption[] = [
  { value: 'individual', label: 'Individual investor' },
  { value: 'angel', label: 'Angel investor' },
  { value: 'fund', label: 'Fund or VC' },
  { value: 'family_office', label: 'Family office' },
  { value: 'strategic', label: 'Strategic partner' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'other', label: 'Other' },
];

async function signOutToAccessScreen() {
  window.sessionStorage.removeItem('cellar_guest_session_id');
  window.sessionStorage.removeItem('cellar_entry_mode');
  await supabase.auth.signOut();
  window.location.replace(getCellarViewUrl('', { entry: null }));
}

function getCellarAccessCodeMessage(error: unknown) {
  const errorText = typeof error === 'string' ? error : '';
  if (
    errorText.includes('CELLAR_ACCESS_CODE_INVALID') ||
    errorText.includes('CELLAR_ACCESS_CODE_REQUIRED')
  ) {
    return 'That access code did not work. Please check the code or contact JOBZ CAFE® for an updated code.';
  }
  return 'We could not verify this access code. Please check the code or contact JOBZ CAFE® for an updated code.';
}

async function copyTextToClipboard(text: string) {
  const cleanText = text.trim();
  if (!cleanText) return false;
  try {
    await navigator.clipboard.writeText(cleanText);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = cleanText;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const didCopy = document.execCommand('copy');
    document.body.removeChild(textarea);
    return didCopy;
  }
}

function AccessScreen({
  onEnter,
  onVerifiedEnter,
}: {
  onEnter: () => void;
  onVerifiedEnter: () => void;
}) {
  const [code, setCode] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [legalDrawerKind, setLegalDrawerKind] = useState<LegalDrawerKind | null>(null);
  const isReady = useMemo(() => code.trim().length >= 6, [code]);

  const continueWithCode = async () => {
    if (!isReady || isCheckingCode) {
      return;
    }

    setIsCheckingCode(true);
    setAccessMessage('');

    try {
      const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_verify_access_code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
        },
        body: JSON.stringify({
          cellar_access_code: code,
          cellar_user_agent: window.navigator.userAgent,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.cellar_session?.session_id) {
        setAccessMessage(getCellarAccessCodeMessage(result?.error));
        return;
      }

      await supabase.auth.signOut().catch(() => undefined);
      window.sessionStorage.setItem('cellar_guest_session_id', result.cellar_session.session_id);
      window.sessionStorage.setItem('cellar_entry_mode', 'guest_code');
      onEnter();
    } catch (error) {
      setAccessMessage(getCellarAccessCodeMessage(error instanceof Error ? error.message : null));
    } finally {
      setIsCheckingCode(false);
    }
  };

  return (
    <main className="cellar-app min-h-screen overflow-hidden">
      <section className="cellar-login-shell">
        <div className="cellar-hero-panel" aria-hidden="true">
          <img className="cellar-hero-image" src="/assets/cellar-login-hero.png" alt="" />
          <div className="cellar-hero-scrim" />
          <div className="cellar-chamber-card">
            <CellarMark className="cellar-chamber-mark shrink-0" />
            <div>
              <p>The private layer beneath the pitch.</p>
              <span>Secure access to decks, walkthroughs, documents, and prepared responses.</span>
            </div>
          </div>
        </div>

        <div className="cellar-access-panel">
          <div className="cellar-access-card">
            <div className="cellar-brand-row">
              <CellarMark className="cellar-brand-mark shrink-0" />
              <p className="cellar-brand-name">CELLAR</p>
            </div>

            <div className="cellar-access-main">
              <div className="cellar-access-copy">
                <p className="cellar-access-eyebrow">Investor Access</p>
                <h2>Private Intelligence Workspace</h2>
              </div>

              <form
                className="cellar-code-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void continueWithCode();
                }}
              >
                <div className="cellar-code-heading">
                  <p>Enter your invited access code to continue without creating an account.</p>
                </div>
                <label htmlFor="access-code">Access code</label>
                <div className="cellar-code-input-wrap">
                  <input
                    id="access-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder={accessCode.join('')}
                    spellCheck={false}
                    autoComplete="one-time-code"
                    aria-describedby="access-code-help"
                  />
                  <BadgeCheck
                    className={`cellar-code-status-icon h-5 w-5 ${isReady ? 'is-ready' : ''}`}
                    aria-hidden="true"
                  />
                </div>
                <p id="access-code-help" className="cellar-option-helper">
                  {accessMessage || 'Private access session.'}
                </p>
                <button type="submit" disabled={!isReady || isCheckingCode} className="cellar-primary-action">
                  {isCheckingCode ? 'Checking access' : 'Continue with code'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>

              <button
                type="button"
                className="cellar-email-trigger"
                onClick={() => setIsDrawerOpen(true)}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Verified access
              </button>
            </div>

            <div className="cellar-security-note">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              <span>Secure, private, and prepared for invited access only.</span>
            </div>

            <footer className="cellar-footer">
              <div>
                <p>CELLAR by JOBZ CAFE&reg;</p>
                <span>&copy; 2026 JOBZ CAFE&reg;. All rights reserved.</span>
              </div>
              <div className="cellar-footer-legal" aria-label="Legal links">
                <button type="button" onClick={() => setLegalDrawerKind('terms')}>
                  Terms
                </button>
                <button type="button" onClick={() => setLegalDrawerKind('privacy')}>
                  Privacy
                </button>
                <button type="button" onClick={() => setLegalDrawerKind('investor-guide')}>
                  Guide
                </button>
              </div>
            </footer>
          </div>
        </div>
      </section>

      <VerifiedEmailAccessDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onConfirm={(staffAuth) => {
          if (staffAuth.status === 'ready') {
            window.location.href = getCellarViewUrl('staff');
            return;
          }

          onVerifiedEnter();
        }}
        onOpenLegal={setLegalDrawerKind}
      />
      <LegalInfoDrawer
        appName="CELLAR"
        kind={legalDrawerKind}
        onClose={() => setLegalDrawerKind(null)}
      />
    </main>
  );
}

function InvestorShell() {
  const [section, setSection] = useState<AppSection>(() =>
    getCellarSharedPresentationId() ? 'Pitch' : 'Home',
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredCellarThemeMode());
  const [isVerifiedDrawerOpen, setIsVerifiedDrawerOpen] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [colleaguePresentation, setColleaguePresentation] = useState<InvestorPresentation | null>(null);
  const [colleagueEmail, setColleagueEmail] = useState('');
  const [colleagueEmailStatus, setColleagueEmailStatus] = useState('');
  const [colleagueActionTone, setColleagueActionTone] = useState<'info' | 'success' | 'error'>('info');
  const [downloadDrawerPresentation, setDownloadDrawerPresentation] = useState<InvestorPresentation | null>(null);
  const [downloadDrawerStatus, setDownloadDrawerStatus] = useState('');
  const [downloadDrawerTone, setDownloadDrawerTone] = useState<'info' | 'success' | 'error'>('info');
  const [isDownloadDrawerBusy, setIsDownloadDrawerBusy] = useState(false);
  const [legalDrawerKind, setLegalDrawerKind] = useState<LegalDrawerKind | null>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<CellarWorkspaceAccessState | null>(null);
  const [isGuestAccess, setIsGuestAccess] = useState(() =>
    Boolean(window.sessionStorage.getItem('cellar_guest_session_id')),
  );
  const [pitchStartSignal, setPitchStartSignal] = useState(0);
  const [presentations, setPresentations] = useState<InvestorPresentation[]>([]);
  const [activePresentation, setActivePresentation] = useState<InvestorPresentation | null>(null);
  const [assets, setAssets] = useState<InvestorAsset[]>([]);
  const [isAssetsLoading, setIsAssetsLoading] = useState(true);
  const [messageThreads, setMessageThreads] = useState<InvestorMessageThread[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState('');
  const [isStaffInvestorPreview, setIsStaffInvestorPreview] = useState(false);
  const [isMessagesVerifiedRequired, setIsMessagesVerifiedRequired] = useState(false);
  const [canOpenStaffView, setCanOpenStaffView] = useState(false);
  const [bookingProfile, setBookingProfile] = useState<CellarBookingProfile | null>(null);
  const [seenInvestorStaffMessageIds, setSeenInvestorStaffMessageIdsState] = useState<string[]>(() =>
    getSeenInvestorStaffMessageIds(),
  );
  const isVerified = workspaceAccess?.canInvestor === true;
  const selectInvestorPresentation = (presentation: InvestorPresentation) => {
    window.localStorage.setItem('cellar_recent_presentation_id', presentation.id);
    setActivePresentation(presentation);
  };
  const openPitch = () => {
    setActivePresentation(null);
    setSection('Pitch');
  };
  const openPitchFromBeginning = () => {
    setPitchStartSignal((value) => value + 1);
    setSection('Pitch');
  };
  const investorWalkthroughVideo = CELLAR_DRAWER_CONTENT['investor-guide'].video;

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token && isGuestAccess) {
        if (!isCancelled) {
          setWorkspaceAccess(null);
          setCanOpenStaffView(false);
          setBookingProfile(null);
        }
        return;
      }

      const nextWorkspaceAccess = await getCellarWorkspaceAccess();
      if (!isCancelled) {
        setWorkspaceAccess(nextWorkspaceAccess);
        setCanOpenStaffView(nextWorkspaceAccess.canStaff);

        if (nextWorkspaceAccess.canInvestor || nextWorkspaceAccess.canStaff) {
          window.sessionStorage.removeItem('cellar_guest_session_id');
          window.sessionStorage.removeItem('cellar_entry_mode');
          setIsGuestAccess(false);
          if (new URLSearchParams(window.location.search).get('entry') === 'guest') {
            window.history.replaceState(null, '', getCellarViewUrl('dashboard', { entry: null }));
          }
        }

        if (nextWorkspaceAccess.mode === 'investor' && nextWorkspaceAccess.email) {
          const fallbackName = splitCellarFullName(nextWorkspaceAccess.fullName);
          setBookingProfile({
            email: nextWorkspaceAccess.email,
            firstName: nextWorkspaceAccess.firstName || fallbackName.firstName,
            lastName: nextWorkspaceAccess.lastName || fallbackName.lastName,
          });
        } else {
          setBookingProfile(null);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isGuestAccess]);

  useEffect(() => {
    let isCancelled = false;
    const loadInvestorAssets = async () => {
      setIsAssetsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const guestSessionId = sessionData.session?.access_token
        ? null
        : window.sessionStorage.getItem('cellar_guest_session_id');
      const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_list_assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
          ...(sessionData.session?.access_token || cellarSupabasePublishableKey
            ? { Authorization: `Bearer ${sessionData.session?.access_token || cellarSupabasePublishableKey}` }
            : {}),
        },
        body: JSON.stringify({
          cellar_session_id: guestSessionId,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!isCancelled) {
        const nextPresentations = (result?.cellar_presentations ?? []) as InvestorPresentation[];
        const fallbackPresentation = (result?.cellar_presentation ?? null) as InvestorPresentation | null;
        const sharedPresentationId = getCellarSharedPresentationId();
        const recentPresentationId = window.localStorage.getItem('cellar_recent_presentation_id');
        const nextActivePresentation =
          nextPresentations.find((nextPresentation) => nextPresentation.id === sharedPresentationId) ??
          nextPresentations.find((nextPresentation) => nextPresentation.id === recentPresentationId) ??
          nextPresentations[0] ??
          fallbackPresentation;
        setPresentations(nextPresentations);
        setActivePresentation(nextActivePresentation);
        if (sharedPresentationId && nextActivePresentation?.id === sharedPresentationId) {
          window.localStorage.setItem('cellar_recent_presentation_id', sharedPresentationId);
          setSection('Pitch');
        }
        setAssets((result?.cellar_assets ?? []) as InvestorAsset[]);
        setIsAssetsLoading(false);
      }
    };

    void loadInvestorAssets().catch(() => {
      if (!isCancelled) {
        setPresentations([]);
        setActivePresentation(null);
        setAssets([]);
        setIsAssetsLoading(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  const activeAssets = activePresentation
    ? assets.filter((asset) => asset.presentation_id === activePresentation.id)
    : [];
  const markInvestorStaffRepliesSeen = useCallback((messageIds: string[]) => {
    if (!messageIds.length) return;
    setSeenInvestorStaffMessageIdsState((currentIds) => {
      const nextIds = Array.from(new Set([...currentIds, ...messageIds])).slice(-100);
      setSeenInvestorStaffMessageIds(nextIds);
      return nextIds;
    });
  }, []);
  const investorMessageNotifications = useMemo<StaffNotificationItem[]>(() => {
    const seenIds = new Set(seenInvestorStaffMessageIds);
    const now = Date.now();

    return messageThreads.flatMap((thread) => {
      const latestMessage = thread.messages.at(-1);
      if (
        !latestMessage ||
        latestMessage.sender_kind !== 'staff' ||
        seenIds.has(latestMessage.id)
      ) {
        return [];
      }

      const sentTime = new Date(latestMessage.sent_at).getTime();
      if (Number.isFinite(sentTime) && now - sentTime < CELLAR_INVESTOR_REPLY_NOTIFICATION_DELAY_MS) {
        return [];
      }

      return [{
        id: latestMessage.id,
        title: 'Staff reply waiting',
        body: latestMessage.body,
        meta: `${thread.subject} - ${formatCompactDate(latestMessage.sent_at)}`,
      }];
    });
  }, [messageThreads, seenInvestorStaffMessageIds]);
  const latestStaffReplyIds = useMemo(
    () => messageThreads
      .map((thread) => thread.messages.at(-1))
      .filter((message): message is InvestorMessage => message?.sender_kind === 'staff')
      .map((message) => message.id),
    [messageThreads],
  );

  useEffect(() => {
    if (section !== 'Home' || isAssetsLoading || activePresentation || presentations.length === 0) {
      return;
    }

    const recentPresentationId = window.localStorage.getItem('cellar_recent_presentation_id');
    const nextPresentation =
      presentations.find((presentation) => presentation.id === recentPresentationId) ?? presentations[0];
    setActivePresentation(nextPresentation);
  }, [activePresentation, isAssetsLoading, presentations, section]);

  useEffect(() => {
    if (section === 'Messages') {
      markInvestorStaffRepliesSeen(latestStaffReplyIds);
    }
  }, [latestStaffReplyIds, markInvestorStaffRepliesSeen, section]);

  useEffect(() => {
    if (!isWalkthroughOpen) {
      return undefined;
    }

    document.documentElement.classList.add('cellar-modal-open');
    document.body.classList.add('cellar-modal-open');

    return () => {
      document.documentElement.classList.remove('cellar-modal-open');
      document.body.classList.remove('cellar-modal-open');
    };
  }, [isWalkthroughOpen]);

  const openPitchPresentation = (presentation: InvestorPresentation) => {
    selectInvestorPresentation(presentation);
    setSection('Pitch');
  };
  const openSendPitchToColleague = (presentation: InvestorPresentation | null = activePresentation) => {
    const nextPresentation = presentation ?? presentations[0] ?? null;
    if (!nextPresentation) {
      openPitch();
      return;
    }
    setColleaguePresentation(nextPresentation);
    setColleagueEmail('');
    setColleagueEmailStatus('');
    setColleagueActionTone('info');
  };
  const closeColleagueDrawer = () => {
    setColleaguePresentation(null);
    setColleagueEmail('');
    setColleagueEmailStatus('');
    setColleagueActionTone('info');
  };
  const openDownloadPresentationDrawer = (presentation: InvestorPresentation | null = activePresentation) => {
    const nextPresentation = presentation ?? presentations[0] ?? null;
    if (!nextPresentation) {
      openPitch();
      return;
    }
    setDownloadDrawerPresentation(nextPresentation);
    setDownloadDrawerStatus('');
    setDownloadDrawerTone('info');
    setIsDownloadDrawerBusy(false);
  };
  const closeDownloadPresentationDrawer = () => {
    setDownloadDrawerPresentation(null);
    setDownloadDrawerStatus('');
    setDownloadDrawerTone('info');
    setIsDownloadDrawerBusy(false);
  };
  const sendPresentationToColleague = async () => {
    if (!colleaguePresentation) return;
    const trimmedEmail = colleagueEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setColleagueActionTone('error');
      setColleagueEmailStatus('Enter a valid colleague email address.');
      return;
    }
    const presentationAssets = assets
      .filter((asset) => asset.presentation_id === colleaguePresentation.id)
      .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
    const presentationPdf = presentationAssets.find((asset) => isCellarPresentationAsset(asset) && asset.storage_path) ?? null;
    if (!presentationPdf) {
      setColleagueActionTone('error');
      setColleagueEmailStatus('No PDF file is available to send for this presentation.');
      return;
    }
    setColleagueActionTone('info');
    setColleagueEmailStatus('Sending presentation...');
    const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_send_presentation_to_colleague`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
      },
      body: JSON.stringify({
        cellar_colleague_email: trimmedEmail,
        cellar_presentation_title: colleaguePresentation.title,
        cellar_asset_id: presentationPdf.id,
      }),
    });
    if (!response.ok) {
      const functionError = await readCellarFunctionError(response, 'Unable to send the presentation.');
      setColleagueActionTone('error');
      setColleagueEmailStatus(getFriendlyColleagueShareError(functionError));
      return;
    }
    setColleagueEmail('');
    setColleagueActionTone('success');
    setColleagueEmailStatus('Presentation sent. We did not keep the colleague email address.');
  };
  const downloadPresentationPdf = async (presentation: InvestorPresentation) => {
    const presentationAssets = assets
      .filter((asset) => asset.presentation_id === presentation.id)
      .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
    const presentationPdf = presentationAssets.find((asset) => isCellarPresentationAsset(asset) && asset.storage_path) ?? null;
    if (!presentationPdf) {
      throw new Error('No PDF file is available to download for this presentation.');
    }

    const pdf = await fetchCellarPresentationPdfBlob(presentationPdf);
    downloadCellarBlobFromObjectUrl(pdf, `${sanitizeCellarFileName(presentation.title)}.pdf`);
  };
  const runDownloadDrawerPresentation = async () => {
    if (!downloadDrawerPresentation) return;
    setDownloadDrawerTone('info');
    setDownloadDrawerStatus('Preparing presentation PDF...');
    setIsDownloadDrawerBusy(true);
    try {
      await downloadPresentationPdf(downloadDrawerPresentation);
      setDownloadDrawerTone('success');
      setDownloadDrawerStatus('Presentation PDF downloaded.');
    } catch (error) {
      setDownloadDrawerTone('error');
      setDownloadDrawerStatus(getFriendlyPresentationDownloadError(error));
    } finally {
      setIsDownloadDrawerBusy(false);
    }
  };

  const loadInvestorMessages = useCallback(async () => {
    setIsMessagesLoading(true);
    setMessagesError('');
    setIsStaffInvestorPreview(false);
    setIsMessagesVerifiedRequired(!isVerified);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token && window.sessionStorage.getItem('cellar_guest_session_id')) {
      setMessageThreads([]);
      setIsMessagesVerifiedRequired(!isVerified);
      setIsMessagesLoading(false);
      return;
    }

    if (!sessionData.session?.access_token) {
      setMessageThreads([]);
      setIsMessagesVerifiedRequired(!isVerified);
      setIsMessagesLoading(false);
      return;
    }

    const staffAuth = await getStaffAuthState();

    if (staffAuth.status === 'ready') {
      setMessageThreads([]);
      setIsStaffInvestorPreview(true);
      setIsMessagesLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('cellar_list_messages', {
      body: {},
    });

    if (error) {
      throw new Error(error.message || 'Unable to load investor messages.');
    }

    setMessageThreads((data?.cellar_message_threads ?? []) as InvestorMessageThread[]);
    setIsMessagesVerifiedRequired(!isVerified && data?.cellar_messages_enabled !== true);
    setIsMessagesLoading(false);
  }, [isVerified]);

  useEffect(() => {
    let isCancelled = false;
    if (section !== 'Messages') {
      return () => {
        isCancelled = true;
      };
    }
    void loadInvestorMessages().catch((error) => {
      if (!isCancelled) {
        setMessageThreads([]);
        setMessagesError(
          getFriendlyCellarError(
            error,
            'Messages are not available for this investor session yet.',
          ),
        );
        setIsMessagesLoading(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [isVerified, loadInvestorMessages, section, workspaceAccess?.email]);

  const sendInvestorMessage = async (thread: InvestorMessageThread, body: string) => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.access_token) {
      throw new Error('Verify access before sending a private message.');
    }

    const { error } = await supabase.functions.invoke('cellar_send_investor_message', {
      body: {
        cellar_thread_id: thread.id,
        cellar_investor_access_id: thread.investor_access_id,
        cellar_body: body,
      },
    });

    if (error) {
      throw new Error(error.message || 'Unable to send this message.');
    }

    await loadInvestorMessages();
  };

  const startInvestorMessageThread = async (subject: string, body: string) => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.access_token) {
      throw new Error('Verify access before sending a private message.');
    }

    const { error } = await supabase.functions.invoke('cellar_create_investor_message_thread', {
      body: {
        cellar_subject: subject,
        cellar_body: body,
      },
    });

    if (error) {
      throw new Error(error.message || 'Unable to send this message.');
    }

    await loadInvestorMessages();
  };

  const renameInvestorMessageThread = async (thread: InvestorMessageThread, subject: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Verify access before renaming a private message.');
    }

    const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_manage_investor_message_thread`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        cellar_action: 'rename',
        cellar_thread_id: thread.id,
        cellar_subject: subject,
      }),
    });
    if (!response.ok) {
      const functionError = await readCellarFunctionError(response, 'Unable to rename this message.');
      throw new Error(functionError.startsWith('CELLAR_') ? 'Unable to rename this message.' : functionError);
    }
    await loadInvestorMessages();
  };

  const deleteInvestorMessageThread = async (thread: InvestorMessageThread) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Verify access before deleting a private message.');
    }

    const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_manage_investor_message_thread`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        cellar_action: 'delete',
        cellar_thread_id: thread.id,
      }),
    });
    if (!response.ok) {
      const functionError = await readCellarFunctionError(response, 'Unable to delete this message.');
      throw new Error(functionError.startsWith('CELLAR_') ? 'Unable to delete this message.' : functionError);
    }
    await loadInvestorMessages();
  };

  return (
    <main className={`investor-app ${themeMode === 'light' ? 'is-light' : 'is-dark'} ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <aside className="investor-sidebar">
        <div className="investor-sidebar-header">
          <button
            type="button"
            className={`investor-logo-lockup ${section === 'Home' ? 'is-home-selected' : ''}`}
            onClick={() => setSection('Home')}
            aria-label="Go to Home"
          >
            <CellarMark className="investor-logo-mark" />
            {!isSidebarCollapsed && (
              <div>
                <p>CELLAR</p>
              </div>
            )}
          </button>
          <div className="investor-sidebar-tools">
            <button
              type="button"
              className="investor-sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {!isSidebarCollapsed && <div className="investor-sidebar-rule" />}

        <nav className="investor-nav" aria-label="Investor workspace">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isPitch = item.label === 'Pitch';
            const itemLabel = item.displayLabel ?? item.label;
            return (
              <div className="investor-nav-group" key={item.label}>
                <button
                  type="button"
                  className={section === item.label ? 'is-selected' : ''}
                  onClick={() => {
                    if (item.label === 'Pitch') {
                      openPitch();
                      return;
                    }
                    if (item.label === 'Messages') {
                      markInvestorStaffRepliesSeen(latestStaffReplyIds);
                    }
                    setSection(item.label);
                  }}
                  aria-label={itemLabel}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {!isSidebarCollapsed && <span>{itemLabel}</span>}
                </button>
                {isPitch && !isSidebarCollapsed && presentations.length > 0 && (
                  <div className="investor-nav-subitems" aria-label="Pitch presentations">
                    {presentations.map((presentation) => {
                      const isSelected =
                        section === 'Pitch' &&
                        activePresentation?.id === presentation.id;
                      return (
                        <button
                          type="button"
                          className={isSelected ? 'is-selected' : ''}
                          key={presentation.id}
                          onClick={() => openPitchPresentation(presentation)}
                        >
                          {presentation.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="investor-sidebar-footer">
          <div className="investor-access-status">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {!isSidebarCollapsed && (
              <div>
                {isVerified ? (
                  <button type="button" onClick={() => setIsAccountDrawerOpen(true)}>
                    Profile
                  </button>
                ) : (
                  <span>Guest access</span>
                )}
              </div>
            )}
          </div>
          {!isSidebarCollapsed && (
            <footer className="investor-brand-footer">
              {canOpenStaffView && (
                <button
                  type="button"
                  className="investor-staff-view-link"
                  onClick={() => {
                    window.sessionStorage.removeItem('cellar_entry_mode');
                    window.sessionStorage.removeItem('cellar_guest_session_id');
                    window.location.href = getCellarViewUrl('staff');
                  }}
                >
                  Staff view
                </button>
              )}
              <p>CELLAR by JOBZ CAFE&reg;</p>
              <span>Private Intelligence Workspace</span>
              <div className="investor-legal-links" aria-label="Legal links">
                <button type="button" onClick={() => setLegalDrawerKind('terms')}>
                  Terms
                </button>
                <button type="button" onClick={() => setLegalDrawerKind('privacy')}>
                  Privacy
                </button>
                <button type="button" onClick={() => setLegalDrawerKind('investor-guide')}>
                  Guide
                </button>
              </div>
            </footer>
          )}
        </div>
      </aside>

      <section className={`investor-main ${section === 'Home' ? 'is-home-main' : ''}`}>
        <div className="investor-main-actions">
          <button
            type="button"
            className="investor-theme-toggle"
            onClick={() =>
              setThemeMode((mode) => {
                const nextMode = getNextCellarThemeMode(mode);
                setStoredCellarThemeMode(nextMode);
                return nextMode;
              })
            }
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme`}
          >
            {themeMode === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="investor-main-notification-button"
            onClick={() => setIsNotificationsDrawerOpen(true)}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {Boolean(investorMessageNotifications.length) && (
              <span>{investorMessageNotifications.length}</span>
            )}
          </button>
          <button type="button" className="investor-sign-out-button" onClick={signOutToAccessScreen}>
            Sign out
          </button>
        </div>
        {section === 'Home' && (
          <HomePage
            assets={assets}
            presentations={presentations}
            presentation={activePresentation}
            onOpenPresentation={openPitchPresentation}
            isAssetsLoading={isAssetsLoading}
            onOpenPitch={openPitch}
            onOpenPitchFromBeginning={openPitchFromBeginning}
            onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
            onOpenUpdates={() => setSection('Updates')}
            onOpenBooking={() => setIsBookingDrawerOpen(true)}
            onSendPitchToColleague={() => openSendPitchToColleague()}
            onDownloadPresentation={() => openDownloadPresentationDrawer()}
            onVerify={() => setIsVerifiedDrawerOpen(true)}
            isVerified={isVerified}
            workspaceAccess={workspaceAccess}
          />
        )}
        {section === 'Pitch' && (
          <PitchRoom
            resetSignal={pitchStartSignal}
            presentation={activePresentation}
            presentations={presentations}
            onSelectPresentation={selectInvestorPresentation}
            onSendToColleague={openSendPitchToColleague}
            onDownloadPresentation={downloadPresentationPdf}
            assets={activeAssets}
            isAssetsLoading={isAssetsLoading}
          />
        )}
        {section === 'Questions' && <QuestionsPage isVerified={isVerified} />}
        {section === 'Messages' && (
          <MessagesPage
            threads={messageThreads}
            isLoading={isMessagesLoading}
            error={messagesError}
            isStaffPreview={isStaffInvestorPreview}
            isVerifiedRequired={isMessagesVerifiedRequired}
            onVerify={() => setIsVerifiedDrawerOpen(true)}
            onSendMessage={sendInvestorMessage}
            onStartThread={startInvestorMessageThread}
            onRenameThread={renameInvestorMessageThread}
            onDeleteThread={deleteInvestorMessageThread}
          />
        )}
        {section === 'Updates' && (
          <UpdatesPage isVerified={isVerified} onVerify={() => setIsVerifiedDrawerOpen(true)} />
        )}
        {isWalkthroughOpen && investorWalkthroughVideo && (
          <div
            className={`fullscreen-slide-backdrop legal-video-backdrop ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}
            role="dialog"
            aria-modal="true"
          >
            <section className="fullscreen-slide-modal legal-video-modal">
              <header>
                <div>
                  <span>Walkthrough</span>
                  <h2>{investorWalkthroughVideo.title}</h2>
                </div>
                <button type="button" onClick={() => setIsWalkthroughOpen(false)} aria-label="Close walkthrough">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </header>
              <div className="legal-video-stage">
                <CellarWalkthroughVideo video={investorWalkthroughVideo} isExpanded autoPlay />
              </div>
            </section>
          </div>
        )}
      </section>

      <nav className="investor-bottom-nav" aria-label="Investor workspace mobile navigation">
        {navItems.map((item) => {
            const Icon = item.icon;
            const itemLabel = item.displayLabel ?? item.label;
            return (
            <button
              key={item.label}
              type="button"
              className={section === item.label ? 'is-selected' : ''}
              onClick={() => {
                if (item.label === 'Pitch') {
                  openPitch();
                  return;
                }
                if (item.label === 'Messages') {
                  markInvestorStaffRepliesSeen(latestStaffReplyIds);
                }
                setSection(item.label);
              }}
              aria-label={itemLabel}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{itemLabel}</span>
            </button>
          );
        })}
      </nav>

      <VerifiedAccessDrawer
        isOpen={isVerifiedDrawerOpen}
        onClose={() => setIsVerifiedDrawerOpen(false)}
        onOpenLegal={setLegalDrawerKind}
        isStaffSession={workspaceAccess?.canStaff === true}
        staffEmail={workspaceAccess?.email}
        onOpenStaffView={() => {
          window.sessionStorage.removeItem('cellar_entry_mode');
          window.sessionStorage.removeItem('cellar_guest_session_id');
          window.location.href = getCellarViewUrl('staff');
        }}
        onConfirm={(staffAuth) => {
          if (staffAuth.status === 'ready') {
            window.location.href = getCellarViewUrl('staff');
            return;
          }

          setIsVerifiedDrawerOpen(false);
        }}
      />
      <InvestorAccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
        workspaceAccess={workspaceAccess}
        themeMode={themeMode}
        onSaved={(nextAccess) => {
          setWorkspaceAccess(nextAccess);
          if (nextAccess.email) {
            const fallbackName = splitCellarFullName(nextAccess.fullName);
            setBookingProfile({
              email: nextAccess.email,
              firstName: nextAccess.firstName || fallbackName.firstName,
              lastName: nextAccess.lastName || fallbackName.lastName,
            });
          }
        }}
      />
      <NotificationsDrawer
        isOpen={isNotificationsDrawerOpen}
        onClose={() => setIsNotificationsDrawerOpen(false)}
        audience="investor"
        items={investorMessageNotifications}
        themeMode={themeMode}
        onSelectItem={(item) => {
          markInvestorStaffRepliesSeen([item.id]);
          setIsNotificationsDrawerOpen(false);
          setSection('Messages');
        }}
      />
      <BookingDrawer
        isOpen={isBookingDrawerOpen}
        bookingProfile={bookingProfile}
        onClose={() => setIsBookingDrawerOpen(false)}
      />
      <ColleaguePresentationDrawer
        presentation={colleaguePresentation}
        email={colleagueEmail}
        status={colleagueEmailStatus}
        statusTone={colleagueActionTone}
        onEmailChange={setColleagueEmail}
        onClose={closeColleagueDrawer}
        onSend={sendPresentationToColleague}
      />
      <PresentationDownloadDrawer
        presentation={downloadDrawerPresentation}
        status={downloadDrawerStatus}
        statusTone={downloadDrawerTone}
        isBusy={isDownloadDrawerBusy}
        onClose={closeDownloadPresentationDrawer}
        onDownload={runDownloadDrawerPresentation}
      />
      <LegalInfoDrawer
        appName="CELLAR"
        kind={legalDrawerKind}
        themeMode={themeMode}
        onClose={() => setLegalDrawerKind(null)}
      />
    </main>
  );
}

function HomePage({
  assets,
  presentations,
  presentation,
  onOpenPresentation,
  isAssetsLoading,
  onOpenPitch,
  onOpenPitchFromBeginning,
  onOpenWalkthrough,
  onOpenUpdates,
  onOpenBooking,
  onSendPitchToColleague,
  onDownloadPresentation,
  onVerify,
  isVerified,
  workspaceAccess,
}: {
  assets: InvestorAsset[];
  presentations: InvestorPresentation[];
  presentation: InvestorPresentation | null;
  onOpenPresentation: (presentation: InvestorPresentation) => void;
  isAssetsLoading: boolean;
  onOpenPitch: () => void;
  onOpenPitchFromBeginning: () => void;
  onOpenWalkthrough: () => void;
  onOpenUpdates: () => void;
  onOpenBooking: () => void;
  onSendPitchToColleague: () => void;
  onDownloadPresentation: () => void;
  onVerify: () => void;
  isVerified: boolean;
  workspaceAccess: CellarWorkspaceAccessState | null;
}) {
  const visiblePresentations =
    presentations.length > 0
      ? presentations
      : presentation
        ? [presentation]
        : [];
  return (
    <section className="home-page">
      <header className="investor-page-header home-header">
        <div>
          <p>Investor pitch room</p>
          <h1>Welcome to CELLAR</h1>
          <span>
            Start with the pitch, continue your notes, or check what has changed since your last
            visit.
          </span>
        </div>
      </header>

      <div className="home-grid">
        <article className="home-card home-primary-card">
          <div>
            <h2>Presentations</h2>
            <span>Choose a presentation to continue.</span>
          </div>

          <div className="home-presentation-list">
            {isAssetsLoading && (
              <div className="home-presentation-empty">
                <span>Loading presentations</span>
                <strong>Checking</strong>
              </div>
            )}
            {!isAssetsLoading && visiblePresentations.length === 0 && assets.length === 0 && (
              <div className="home-presentation-empty">
                <span>No presentations available yet</span>
              </div>
            )}
            {!isAssetsLoading &&
              visiblePresentations.map((nextPresentation) => {
                return (
                  <div
                    className={`home-presentation-row ${presentation?.id === nextPresentation.id ? 'is-selected' : ''}`}
                    key={nextPresentation.id}
                    aria-current={presentation?.id === nextPresentation.id ? 'true' : undefined}
                  >
                    <div>
                      <strong>{nextPresentation.title}</strong>
                      <button type="button" onClick={() => onOpenPresentation(nextPresentation)}>
                        Open
                      </button>
                    </div>
                    <small>{getPresentationUpdatedLabel(nextPresentation)}</small>
                  </div>
                );
              })}
          </div>
        </article>

        <article className="home-card home-room-card">
          <div className="home-card-header">
            <p>Actions</p>
            <h2>Suggested next steps</h2>
          </div>
          <div className="home-action-list" aria-label="Suggested next steps">
            <button type="button" className="home-action-row" onClick={onOpenWalkthrough}>
              <span>
                <strong>Watch walkthrough</strong>
                <small>See how to use the CELLAR workspace</small>
              </span>
              <Play className="h-4 w-4" aria-hidden="true" />
            </button>
            {presentation ? (
              <button type="button" className="home-action-row" onClick={onOpenPitchFromBeginning}>
                <span>
                  <strong>Open presentation</strong>
                  <small>Start with {presentation.title}</small>
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <div className="home-action-empty">
                <strong>No presentation selected</strong>
                <small>Select a presentation from the list.</small>
              </div>
            )}
            <button type="button" className="home-action-row" onClick={onOpenPitch}>
              <span>
                <strong>Browse presentations</strong>
                <small>View the available presentation list</small>
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="home-action-row" onClick={onOpenBooking}>
              <span>
                <strong>Book a briefing</strong>
                <small>Choose a private investor meeting slot</small>
              </span>
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="home-action-row" onClick={onDownloadPresentation}>
              <span>
                <strong>Download presentation</strong>
                <small>Save the current pitch PDF</small>
              </span>
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="home-action-row" onClick={onSendPitchToColleague}>
              <span>
                <strong>Send pitch to colleague</strong>
                <small>Email a colleague without us keeping their address</small>
              </span>
              <Mail className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </article>

        <article className="home-card home-updates-card">
          <div className="home-card-header">
            <p>Latest activity</p>
            <h2>Updates</h2>
            <span>Recent asset changes and team responses.</span>
          </div>
          <div className="home-update-list">
            <span>No updates yet</span>
          </div>
          <button type="button" onClick={onOpenUpdates}>
            Open
          </button>
        </article>

        <article className="home-card home-questions-card">
          <p>Access</p>
          <h2>{isVerified ? 'Investor verified' : 'Investor request'}</h2>
          <span>
            {isVerified
              ? workspaceAccess?.email ?? 'Verified investor'
              : 'Request access to private notes, prepared answers, and deeper items.'}
          </span>
          <div className="home-update-list">
            <span>
              {isVerified
                ? `Access verified ${formatCellarAccountDate(workspaceAccess?.verifiedAt)}`
                : 'Private workspace features'}
            </span>
            {!isVerified && <span>Additional items by approval</span>}
          </div>
          {!isVerified && (
            <button type="button" onClick={onVerify}>
              Request access
            </button>
          )}
        </article>

        <article className="home-card home-messages-card">
          <p>Investor support</p>
          <h2>Book a call</h2>
          <span>Schedule a private pitch briefing.</span>
          <div className="home-update-list">
            <span>Best for guided walkthroughs</span>
            <span>Use Messages for written questions</span>
          </div>
          <button type="button" onClick={onOpenBooking}>
            Book
          </button>
        </article>

      </div>
    </section>
  );
}

function PresentationDownloadDrawer({
  presentation,
  status,
  statusTone,
  isBusy,
  onClose,
  onDownload,
}: {
  presentation: InvestorPresentation | null;
  status: string;
  statusTone: 'info' | 'success' | 'error';
  isBusy: boolean;
  onClose: () => void;
  onDownload: () => Promise<void>;
}) {
  if (!presentation) return null;

  return (
    <div className="cellar-sheet-backdrop" role="presentation">
      <aside className="cellar-email-sheet verified-access-drawer notes-action-drawer pitch-download-drawer" aria-label="Download presentation" aria-modal="true" role="dialog">
        <button
          type="button"
          className="cellar-sheet-close"
          onClick={onClose}
          aria-label="Close presentation download"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="notes-action-panel">
          <Download className="h-6 w-6" aria-hidden="true" />
          <h2>Download presentation</h2>
          <p>Save the current pitch PDF to your device.</p>
          <div className="notes-action-summary">
            <strong>{presentation.title}</strong>
            <span>{getPresentationUpdatedLabel(presentation)}</span>
          </div>
          <div className="notes-action-buttons pitch-download-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" onClick={() => void onDownload()} disabled={isBusy}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {isBusy ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>
          {status && (
            <p className={`staff-upload-status is-${statusTone}`}>
              {status}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function ColleaguePresentationDrawer({
  presentation,
  email,
  status,
  statusTone,
  onEmailChange,
  onClose,
  onSend,
}: {
  presentation: InvestorPresentation | null;
  email: string;
  status: string;
  statusTone: 'info' | 'success' | 'error';
  onEmailChange: (email: string) => void;
  onClose: () => void;
  onSend: () => Promise<void>;
}) {
  if (!presentation) return null;

  return (
    <div className="cellar-sheet-backdrop" role="presentation">
      <aside className="cellar-email-sheet verified-access-drawer notes-action-drawer pitch-colleague-drawer" aria-label="Send presentation to a colleague" aria-modal="true" role="dialog">
        <button
          type="button"
          className="cellar-sheet-close"
          onClick={onClose}
          aria-label="Close colleague email"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="notes-action-panel">
          <Mail className="h-6 w-6" aria-hidden="true" />
          <h2>Send to a colleague</h2>
          <p>
            This presentation can be sent to a colleague without their email address being kept by us.
          </p>
          <label className="pitch-colleague-field">
            <span>Colleague email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
            />
          </label>
          <div className="notes-action-summary">
            <strong>Verified access is best</strong>
            <span>
              Each investor should verify their own access so they receive presentation updates and can message the
              JOBZ CAFE team about the presentation.
            </span>
          </div>
          <div className="notes-action-buttons pitch-colleague-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" onClick={() => void onSend()}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send from CELLAR
            </button>
          </div>
          {status && (
            <p className={`staff-upload-status is-${statusTone}`}>
              {status}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function PitchRoom({
  presentation,
  presentations,
  onSelectPresentation,
  onSendToColleague,
  onDownloadPresentation,
  assets,
  isAssetsLoading,
  resetSignal,
}: {
  presentation: InvestorPresentation | null;
  presentations: InvestorPresentation[];
  onSelectPresentation: (presentation: InvestorPresentation) => void;
  onSendToColleague: (presentation: InvestorPresentation) => void;
  onDownloadPresentation: (presentation: InvestorPresentation) => Promise<void>;
  assets: InvestorAsset[];
  isAssetsLoading: boolean;
  resetSignal: number;
}) {
  const [deck, setDeck] = useState<DeckKey | null>(null);
  const [assetNotes, setAssetNotes] = useState<Record<string, string>>({});
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [notesActionStatus, setNotesActionStatus] = useState('');
  const [notesActionTone, setNotesActionTone] = useState<'info' | 'success' | 'error'>('info');
  const [assetSlideNumbers, setAssetSlideNumbers] = useState<Record<string, number>>({});
  const [presentationSearch, setPresentationSearch] = useState('');
  const [presentationStatusFilter, setPresentationStatusFilter] = useState('all');
  const [presentationUpdatedFilter, setPresentationUpdatedFilter] = useState('all');
  const [presentationFavoriteFilter, setPresentationFavoriteFilter] = useState('all');
  const [isPresentationFilterPanelOpen, setIsPresentationFilterPanelOpen] = useState(false);
  const [openPresentationMenuId, setOpenPresentationMenuId] = useState<string | null>(null);
  const [favoritePresentationIds, setFavoritePresentationIdsState] = useState<string[]>(getFavoritePresentationIds);
  const [presentationDownloadStatus, setPresentationDownloadStatus] = useState('');
  const [presentationDownloadTone, setPresentationDownloadTone] = useState<'info' | 'success' | 'error'>('info');
  const [isPresentationDownloading, setIsPresentationDownloading] = useState(false);
  const selectedAssetId = deck?.replace('asset:', '') ?? null;
  const selectedAsset = selectedAssetId
    ? assets.find((asset) => asset.id === selectedAssetId) ?? null
    : assets[0] ?? null;
  const note = selectedAsset ? assetNotes[selectedAsset.id] ?? '' : '';
  const selectedSlideNumber = selectedAsset ? assetSlideNumbers[selectedAsset.id] ?? 1 : 1;
  const selectedSlideNarratives = selectedAsset?.slide_narratives ?? {};
  const narrativePanelText = selectedSlideNarratives[String(selectedSlideNumber)]?.trim() ?? '';
  const normalizedPresentationSearch = presentationSearch.trim().toLowerCase();
  const searchedPresentations = normalizedPresentationSearch
    ? presentations.filter((nextPresentation) =>
        [
          nextPresentation.title,
          nextPresentation.description ?? '',
          nextPresentation.status,
          getPresentationUpdatedLabel(nextPresentation),
        ].some((value) => value.toLowerCase().includes(normalizedPresentationSearch)),
      )
    : presentations;
  const filteredPresentations = [...searchedPresentations]
    .sort((left, right) => {
      const rightTime = Date.parse(right.published_at ?? '') || 0;
      const leftTime = Date.parse(left.published_at ?? '') || 0;
      return rightTime - leftTime;
    })
    .filter((nextPresentation) => {
      const matchesStatus = presentationStatusFilter === 'all' || nextPresentation.status === presentationStatusFilter;
      const matchesUpdated = presentationUpdatedFilter === 'all' || Boolean(nextPresentation.published_at);
      const matchesFavorite =
        presentationFavoriteFilter === 'all' || favoritePresentationIds.includes(nextPresentation.id);
      return matchesStatus && matchesUpdated && matchesFavorite;
    });
  const activePresentationFilterCount =
    (presentationStatusFilter === 'all' ? 0 : 1) +
    (presentationUpdatedFilter === 'all' ? 0 : 1);
  const presentationStatusFilterOptions = [
    { value: 'all', label: 'All presentation status' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'needs_repair', label: 'Needs repair' },
    { value: 'archived', label: 'Archived' },
  ];
  const presentationUpdatedFilterOptions = [
    { value: 'all', label: 'All update states' },
    { value: 'updated', label: 'Has updated date' },
  ];
  const openPresentation = (nextPresentation: InvestorPresentation) => {
    setOpenPresentationMenuId(null);
    onSelectPresentation(nextPresentation);
  };
  const toggleFavoritePresentation = (presentationId: string) => {
    setFavoritePresentationIdsState((currentIds) => {
      const nextIds = currentIds.includes(presentationId)
        ? currentIds.filter((id) => id !== presentationId)
        : [...currentIds, presentationId];
      setFavoritePresentationIds(nextIds);
      return nextIds;
    });
    setOpenPresentationMenuId(null);
  };
  const openSendToColleague = (nextPresentation: InvestorPresentation) => {
    setOpenPresentationMenuId(null);
    onSendToColleague(nextPresentation);
  };
  const downloadPresentation = async (nextPresentation: InvestorPresentation) => {
    setOpenPresentationMenuId(null);
    setPresentationDownloadTone('info');
    setPresentationDownloadStatus('Preparing presentation PDF...');
    setIsPresentationDownloading(true);
    try {
      await onDownloadPresentation(nextPresentation);
      setPresentationDownloadTone('success');
      setPresentationDownloadStatus('Presentation PDF downloaded.');
    } catch (error) {
      setPresentationDownloadTone('error');
      setPresentationDownloadStatus(getFriendlyPresentationDownloadError(error));
    } finally {
      setIsPresentationDownloading(false);
    }
  };
  const coreStoryAsset = assets[0] ?? selectedAsset;
  const selectedNotesEntries = coreStoryAsset
    ? [{
        id: coreStoryAsset.id,
        title: coreStoryAsset.tab_label || coreStoryAsset.title,
        note: assetNotes[coreStoryAsset.id] ?? '',
      }]
    : [];
  const handleAssetSlideChange = useCallback((assetId: string, slideNumber: number) => {
    setAssetSlideNumbers((currentSlides) => {
      if (currentSlides[assetId] === slideNumber) {
        return currentSlides;
      }
      return {
        ...currentSlides,
        [assetId]: slideNumber,
      };
    });
  }, []);

  const downloadNotesPdf = async () => {
    try {
      const fileName = `${sanitizeCellarFileName(presentation?.title || 'cellar')}-core-story-notes.pdf`;
      const pdf = createCellarNotesPdf(
        presentation?.title ? `${presentation.title} - Investor Notes` : 'CELLAR Investor Notes',
        selectedNotesEntries.map((entry) => ({ title: entry.title, note: entry.note })),
      );
      await saveCellarBlob(pdf, fileName);
      setNotesActionTone('success');
      setNotesActionStatus('Notes PDF prepared.');
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : '';
      if (errorName === 'AbortError') {
        setNotesActionTone('info');
        setNotesActionStatus('Download cancelled.');
        return;
      }
      setNotesActionTone('error');
      setNotesActionStatus('Unable to prepare the notes PDF.');
    }
  };

  const sendNotesToTeam = async () => {
    const notesBody = selectedNotesEntries
      .map((entry) => [
        `Source: ${entry.title}`,
        '',
        entry.note.trim() || 'No notes added.',
      ].join('\n'))
      .join('\n\n');
    setNotesActionStatus('');
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_send_investor_notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
        ...(sessionData.session?.access_token || cellarSupabasePublishableKey
          ? { Authorization: `Bearer ${sessionData.session?.access_token || cellarSupabasePublishableKey}` }
          : {}),
      },
      body: JSON.stringify({
        cellar_subject: `Investor notes: ${presentation?.title || 'CELLAR presentation'}`,
        cellar_body: notesBody,
        cellar_session_id: window.sessionStorage.getItem('cellar_guest_session_id'),
      }),
    });
    if (!response.ok) {
      const functionError = await readCellarFunctionError(response, 'Unable to send notes to JOBZ CAFE.');
      setNotesActionTone('error');
      setNotesActionStatus(getFriendlyInvestorNotesError(functionError));
      return;
    }
    setNotesActionTone('success');
    setNotesActionStatus('Notes sent to JOBZ CAFE.');
  };

  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      setDeck(`asset:${assets[0].id}`);
    }
  }, [assets, selectedAsset]);

  useEffect(() => {
    if (resetSignal > 0 && assets.length > 0) {
      setDeck(`asset:${assets[0].id}`);
    }
  }, [assets, resetSignal]);

  return (
    <div className={`pitch-room ${narrativePanelText ? 'has-narrative' : 'has-no-narrative'}`}>
      <header className="investor-page-header pitch-page-header">
        <div>
          <p>Investor pitch room</p>
          <h1>Presentations</h1>
          {presentation && <span>{presentation.title}</span>}
          {presentation?.description && <small>{presentation.description}</small>}
          {presentation && <small>{getPresentationUpdatedLabel(presentation)}</small>}
        </div>
        {presentation && (
          <div className="pitch-page-actions">
            <button
              type="button"
              onClick={() => void downloadPresentation(presentation)}
              disabled={isPresentationDownloading}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {isPresentationDownloading ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>
        )}
      </header>
      {presentationDownloadStatus && (
        <p className={`staff-upload-status pitch-download-status is-${presentationDownloadTone}`}>
          {presentationDownloadStatus}
        </p>
      )}
      {!presentation && isAssetsLoading ? (
        <InvestorEmptyState title="Loading pitch items" body="Checking the published CELLAR items for this investor room." />
      ) : !presentation ? (
        <section className="pitch-search-screen" aria-label="Investor presentations">
          <div className="pitch-search-toolbar">
            <label className="home-presentation-search pitch-presentation-search">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                value={presentationSearch}
                onChange={(event) => setPresentationSearch(event.target.value)}
                placeholder="Search presentations"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className={`pitch-search-filter-button pitch-search-favorite-toggle ${presentationFavoriteFilter === 'favorite' ? 'is-active' : ''}`}
              onClick={() => setPresentationFavoriteFilter((currentFilter) =>
                currentFilter === 'favorite' ? 'all' : 'favorite',
              )}
              aria-label="Show favorite presentations only"
              aria-pressed={presentationFavoriteFilter === 'favorite'}
              title="Favorites only"
            >
              <Star className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`pitch-search-filter-button ${activePresentationFilterCount ? 'is-active' : ''}`}
              onClick={() => setIsPresentationFilterPanelOpen((isOpen) => !isOpen)}
              aria-expanded={isPresentationFilterPanelOpen}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {activePresentationFilterCount > 0 && <span>{activePresentationFilterCount}</span>}
            </button>
          </div>

          {filteredPresentations.length ? (
            <div className="pitch-presentation-card-grid" aria-label="Featured investor presentations">
              {filteredPresentations.map((nextPresentation) => {
                const isFavoritePresentation = favoritePresentationIds.includes(nextPresentation.id);
                return (
                  <div
                    className={`pitch-presentation-card pitch-presentation-feature-card ${isFavoritePresentation ? 'is-favorite' : ''}`}
                    key={nextPresentation.id}
                  >
                    <button
                      type="button"
                      className="pitch-presentation-card-main"
                      onClick={() => openPresentation(nextPresentation)}
                    >
                      <span>Presentation</span>
                      <strong>{nextPresentation.title}</strong>
                      {nextPresentation.description && <small>{nextPresentation.description}</small>}
                      <small>{getPresentationUpdatedLabel(nextPresentation)}</small>
                      {isFavoritePresentation && (
                        <span className="pitch-favorite-label">
                          <Star className="h-3 w-3" aria-hidden="true" />
                          Favorite
                        </span>
                      )}
                    </button>
                    <div className="staff-overflow-menu pitch-presentation-overflow">
                      <button
                        type="button"
                        className="staff-overflow-trigger"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenPresentationMenuId((currentId) =>
                            currentId === nextPresentation.id ? null : nextPresentation.id,
                          );
                        }}
                        aria-expanded={openPresentationMenuId === nextPresentation.id}
                        aria-label={`Actions for ${nextPresentation.title}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {openPresentationMenuId === nextPresentation.id && (
                        <div className="staff-overflow-panel" role="menu">
                          <button type="button" onClick={() => openPresentation(nextPresentation)} role="menuitem">
                            Open
                          </button>
                          <button type="button" onClick={() => toggleFavoritePresentation(nextPresentation.id)} role="menuitem">
                            {isFavoritePresentation ? 'Unfavorite' : 'Favorite'}
                          </button>
                          <button type="button" onClick={() => void downloadPresentation(nextPresentation)} role="menuitem">
                            Download PDF
                          </button>
                          <button type="button" onClick={() => openSendToColleague(nextPresentation)} role="menuitem">
                            Send to colleague
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : presentations.length ? (
            <InvestorEmptyState title="No presentations match" body="Adjust the search or filters to see more presentations." />
          ) : (
            <InvestorEmptyState title="No presentations available yet" />
          )}
        </section>
      ) : selectedAsset ? (
        <>
          <DeckTabs assets={assets} selected={selectedAsset ? `asset:${selectedAsset.id}` : null} onSelect={setDeck} />
          <section className="pitch-layout">
            <BackendAssetView
              asset={selectedAsset}
              onSlideChange={(slideNumber) => handleAssetSlideChange(selectedAsset.id, slideNumber)}
            />
            <div className="pitch-side-rail">
              <SlideNotes
                label="Notes"
                note={note}
                onOpenActions={() => {
                  setNotesActionStatus('');
                  setIsNotesDrawerOpen(true);
                }}
                onChange={(nextNote) =>
                  setAssetNotes((currentNotes) => ({
                    ...currentNotes,
                    [selectedAsset.id]: nextNote,
                  }))
                }
              />
            </div>
          </section>
          {narrativePanelText && <NarrativePanel asset={selectedAsset} narrative={narrativePanelText} />}
        </>
      ) : (
        <InvestorEmptyState title="No presentation items available yet" />
      )}
      {isNotesDrawerOpen && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer notes-action-drawer" aria-label="Notes actions">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => setIsNotesDrawerOpen(false)}
              aria-label="Close notes actions"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="notes-action-panel">
              <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              <h2>Notes</h2>
              <p>Download or send notes for the core story item only.</p>
              <div className="notes-action-summary">
                <strong>{coreStoryAsset?.tab_label || coreStoryAsset?.title || 'Core story'}</strong>
                <span>{selectedNotesEntries.filter((entry) => entry.note.trim()).length} with notes</span>
              </div>
              <div className="notes-action-buttons">
                <button type="button" onClick={downloadNotesPdf}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download PDF
                </button>
                <button type="button" onClick={() => void sendNotesToTeam()}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send to JOBZ CAFE®
                </button>
              </div>
              {notesActionStatus && (
                <p className={`staff-upload-status is-${notesActionTone}`}>{notesActionStatus}</p>
              )}
            </div>
          </aside>
        </div>
      )}
      {isPresentationFilterPanelOpen && !presentation && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer notes-action-drawer pitch-search-filter-drawer" aria-label="Filter presentations" aria-modal="true" role="dialog">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => setIsPresentationFilterPanelOpen(false)}
              aria-label="Close presentation filters"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="notes-action-panel">
              <SlidersHorizontal className="h-6 w-6" aria-hidden="true" />
              <h2>Filters</h2>
              <p>Refine the investor presentation list.</p>
              <CellarSelect
                label="Presentation status"
                value={presentationStatusFilter}
                onChange={setPresentationStatusFilter}
                options={presentationStatusFilterOptions}
              />
              <CellarSelect
                label="Updated"
                value={presentationUpdatedFilter}
                onChange={setPresentationUpdatedFilter}
                options={presentationUpdatedFilterOptions}
              />
              <div className="notes-action-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setPresentationSearch('');
                    setPresentationStatusFilter('all');
                    setPresentationUpdatedFilter('all');
                    setPresentationFavoriteFilter('all');
                  }}
                >
                  Clear
                </button>
                <button type="button" onClick={() => setIsPresentationFilterPanelOpen(false)}>
                  Apply
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function BackendAssetView({
  asset,
  onSlideChange,
  selectedSlideNumber,
  canExpand = true,
}: {
  asset: InvestorAsset;
  onSlideChange?: (slideNumber: number, slideCount?: number) => void;
  selectedSlideNumber?: number;
  canExpand?: boolean;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(Boolean(asset.storage_path));
  const [urlError, setUrlError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const loadSignedUrl = async () => {
      if (!asset.storage_path) {
        setSignedUrl(null);
        setIsLoadingUrl(false);
        setUrlError('This asset does not have an uploaded file path yet.');
        return;
      }

      setIsLoadingUrl(true);
      setUrlError('');
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_get_asset_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
          ...(sessionData.session?.access_token || cellarSupabasePublishableKey
            ? { Authorization: `Bearer ${sessionData.session?.access_token || cellarSupabasePublishableKey}` }
            : {}),
        },
        body: JSON.stringify({
          asset_id: asset.id,
          cellar_session_id: window.sessionStorage.getItem('cellar_guest_session_id'),
        }),
      }).catch((error: unknown) => {
        throw new Error(error instanceof Error ? error.message : 'Unable to reach asset URL service.');
      });
      const result = await response.json().catch(() => ({}));

      if (isCancelled) {
        return;
      }

      if (!response.ok || !result?.signed_url) {
        setSignedUrl(null);
        setUrlError(result?.error || 'Unable to create a signed asset URL.');
      } else {
        setSignedUrl(result.signed_url);
      }
      setIsLoadingUrl(false);
    };

    void loadSignedUrl().catch((error: unknown) => {
      if (!isCancelled) {
        setSignedUrl(null);
        setUrlError(error instanceof Error ? error.message : 'Unable to create a signed asset URL.');
        setIsLoadingUrl(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [asset.id, asset.storage_bucket, asset.storage_path]);

  useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    document.documentElement.classList.add('cellar-modal-open');
    document.body.classList.add('cellar-modal-open');
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.classList.remove('cellar-modal-open');
      document.body.classList.remove('cellar-modal-open');
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isExpanded]);

  return (
    <>
      <section className="backend-asset-deck live-asset-viewer">
        <div className="live-asset-stage">
          {isLoadingUrl && <InvestorEmptyState title="Preparing asset" body="Creating a private viewing link for this file." />}
          {!isLoadingUrl && signedUrl && (
            <AssetPreview
              asset={asset}
              signedUrl={signedUrl}
              onExpand={canExpand ? () => setIsExpanded(true) : undefined}
              onSlideChange={onSlideChange}
              selectedSlideNumber={selectedSlideNumber}
            />
          )}
          {!isLoadingUrl && !signedUrl && (
            <InvestorEmptyState title="Asset file unavailable" body={urlError || 'The asset metadata is published, but no file can be opened yet.'} />
          )}
        </div>
      </section>

      {canExpand && isExpanded && signedUrl && (
        <div className="fullscreen-slide-backdrop" role="dialog" aria-modal="true">
          <section className="fullscreen-slide-modal live-asset-fullscreen">
            <header>
              <div>
                <span>{asset.tab_label || 'Published asset'}</span>
                <h2>{asset.title}</h2>
              </div>
              <button type="button" onClick={() => setIsExpanded(false)} aria-label="Close expanded asset">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="live-asset-fullscreen-stage">
              <AssetPreview
                asset={asset}
                signedUrl={signedUrl}
                onSlideChange={onSlideChange}
                selectedSlideNumber={selectedSlideNumber}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function AssetPreview({
  asset,
  signedUrl,
  onExpand,
  onSlideChange,
  selectedSlideNumber,
}: {
  asset: InvestorAsset;
  signedUrl: string;
  onExpand?: () => void;
  onSlideChange?: (slideNumber: number, slideCount?: number) => void;
  selectedSlideNumber?: number;
}) {
  if (asset.mime_type === 'application/pdf' || asset.storage_path?.toLowerCase().endsWith('.pdf')) {
    return (
      <PdfAssetPreview
        signedUrl={signedUrl}
        title={asset.title}
        onExpand={onExpand}
        onSlideChange={onSlideChange}
        selectedSlideNumber={selectedSlideNumber}
      />
    );
  }

  if (asset.mime_type?.startsWith('image/')) {
    return <img className="live-asset-image-preview" src={signedUrl} alt={asset.title} />;
  }

  if (asset.mime_type?.startsWith('video/')) {
    return <VideoAssetPreview signedUrl={signedUrl} title={asset.title} onExpand={onExpand} />;
  }

  return (
    <InvestorEmptyState
      title="Preview not available"
      body="This asset type can be listed in CELLAR, but an in-room preview has not been added yet."
    />
  );
}

function VideoAssetPreview({
  signedUrl,
  title,
  onExpand,
}: {
  signedUrl: string;
  title: string;
  onExpand?: () => void;
}) {
  return (
    <div className="video-asset-preview" aria-label={`${title} video preview`}>
      <video
        className="live-asset-video-preview"
        src={signedUrl}
        controls
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        preload="metadata"
        onContextMenu={(event) => event.preventDefault()}
      />
      {onExpand && (
        <div className="video-asset-controls">
          <span>Protected video asset</span>
          <button
            type="button"
            className="pdf-asset-icon-button"
            onClick={onExpand}
            aria-label="Expand video viewer"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function PdfAssetPreview({
  signedUrl,
  title,
  onExpand,
  onSlideChange,
  selectedSlideNumber,
}: {
  signedUrl: string;
  title: string;
  onExpand?: () => void;
  onSlideChange?: (slideNumber: number, slideCount?: number) => void;
  selectedSlideNumber?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [documentProxy, setDocumentProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState('');
  const [hasRenderedPage, setHasRenderedPage] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const updateSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPreviewSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    updateSize();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setDocumentProxy(null);
    setPageNumber(1);
    setPageCount(0);
    setError('');
    setHasRenderedPage(false);

    const loadDocument = async () => {
      const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
      const pdfDocument = await loadingTask.promise;
      if (!isCancelled) {
        setDocumentProxy(pdfDocument);
        setPageCount(pdfDocument.numPages);
      }
    };

    void loadDocument().catch((loadError: unknown) => {
      if (!isCancelled) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to preview this PDF.');
      }
    });

    return () => {
      isCancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [signedUrl]);

  useEffect(() => {
    onSlideChange?.(pageNumber, pageCount || undefined);
  }, [onSlideChange, pageCount, pageNumber]);

  useEffect(() => {
    if (!selectedSlideNumber || selectedSlideNumber < 1) {
      return;
    }
    setPageNumber(Math.min(selectedSlideNumber, pageCount || selectedSlideNumber));
  }, [pageCount, selectedSlideNumber]);

  useEffect(() => {
    if (!documentProxy || !canvasRef.current || previewSize.width === 0 || previewSize.height === 0) {
      return;
    }

    let isCancelled = false;

    const renderPage = async () => {
      renderTaskRef.current?.cancel();
      const page = await documentProxy.getPage(pageNumber);
      if (isCancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(previewSize.width - 24, 320);
      const availableHeight = Math.max(previewSize.height - 24, 260);
      const scale = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height);
      const viewport = page.getViewport({ scale });
      const preferredPixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 3), 4);
      const maxPixelRatioByArea = Math.sqrt(12_000_000 / Math.max(viewport.width * viewport.height, 1));
      const pixelRatio = Math.min(preferredPixelRatio, maxPixelRatioByArea);
      const nextCanvas = document.createElement('canvas');
      const nextContext = nextCanvas.getContext('2d');
      if (!nextContext) return;

      nextCanvas.width = Math.floor(viewport.width * pixelRatio);
      nextCanvas.height = Math.floor(viewport.height * pixelRatio);
      nextContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const renderTask = page.render({ canvasContext: nextContext, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      if (isCancelled || !canvasRef.current) return;

      const visibleContext = canvas.getContext('2d');
      if (!visibleContext) return;
      canvas.width = nextCanvas.width;
      canvas.height = nextCanvas.height;
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      visibleContext.setTransform(1, 0, 0, 1, 0, 0);
      visibleContext.drawImage(nextCanvas, 0, 0);
      setHasRenderedPage(true);
    };

    void renderPage().catch((renderError: unknown) => {
      if (!isCancelled && !(renderError instanceof Error && renderError.name === 'RenderingCancelledException')) {
        setError(renderError instanceof Error ? renderError.message : 'Unable to render this PDF page.');
      }
    });

    return () => {
      isCancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [documentProxy, pageNumber, previewSize.height, previewSize.width]);

  if (error) {
    return <InvestorEmptyState title="PDF preview unavailable" body={error} />;
  }

  return (
    <div className="pdf-asset-preview" aria-label={`${title} PDF preview`}>
      <div className="pdf-asset-canvas-wrap" ref={containerRef}>
        {!hasRenderedPage && <span>Preparing PDF preview</span>}
        <canvas className={hasRenderedPage ? 'is-ready' : ''} ref={canvasRef} />
      </div>
      {pageCount > 0 && (
        <div className="pdf-asset-controls">
          <span>Slide {pageNumber}</span>
          <div className="pdf-asset-page-actions">
            <button
              type="button"
              onClick={() => setPageNumber((currentPage) => Math.max(1, currentPage - 1))}
              disabled={pageNumber === 1}
            >
              Previous slide
            </button>
            <button
              type="button"
              onClick={() => setPageNumber((currentPage) => Math.min(pageCount, currentPage + 1))}
              disabled={pageNumber === pageCount}
            >
              Next slide
            </button>
          </div>
          <div className="pdf-asset-control-actions">
            {onExpand && (
              <button
                type="button"
                className="pdf-asset-icon-button"
                onClick={onExpand}
                aria-label="Expand asset viewer"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeckTabs({
  assets,
  selected,
  onSelect,
}: {
  assets: InvestorAsset[];
  selected: DeckKey | null;
  onSelect: (deck: DeckKey) => void;
}) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="deck-tabs" role="tablist" aria-label="Pitch items">
      {assets.map((asset) => {
        const key = `asset:${asset.id}` as DeckKey;
        return (
          <button
            key={asset.id}
            type="button"
            role="tab"
            aria-selected={selected === key}
            className={selected === key ? 'is-selected' : ''}
            onClick={() => onSelect(key)}
          >
            {asset.tab_label || asset.title}
          </button>
        );
      })}
    </div>
  );
}

function InvestorEmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <section className="locked-asset-card investor-empty-state">
      <FileText className="h-6 w-6" aria-hidden="true" />
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </section>
  );
}

function SlideNotes({
  label,
  note,
  onOpenActions,
  onChange,
}: {
  label: string;
  note: string;
  onOpenActions: () => void;
  onChange: (note: string) => void;
}) {
  return (
    <section className="slide-notes">
      <div className="slide-notes-header">
        <label htmlFor="asset-notes">{label}</label>
        <button type="button" onClick={onOpenActions}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export / send
        </button>
      </div>
      <textarea
        id="asset-notes"
        value={note}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write notes on this slide..."
      />
      <p>Guest notes are kept in this session only. Verify access to save and return later.</p>
    </section>
  );
}

function NarrativePanel({ asset, narrative }: { asset: InvestorAsset; narrative: string }) {
  const eyebrow =
    typeof asset.metadata?.narrative_eyebrow === 'string' && asset.metadata.narrative_eyebrow.trim()
      ? asset.metadata.narrative_eyebrow
      : CELLAR_NARRATIVE_EYEBROW;
  const heading =
    typeof asset.metadata?.narrative_heading === 'string' && asset.metadata.narrative_heading.trim()
      ? asset.metadata.narrative_heading
      : CELLAR_NARRATIVE_HEADING;
  return (
    <aside className="narrative-panel">
      <p>{eyebrow}</p>
      <h2>{heading}</h2>
      <span>{narrative}</span>
    </aside>
  );
}

function QuestionsPage({ isVerified }: { isVerified: boolean }) {
  const [qas, setQas] = useState<PreparedQA[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [selectedQaId, setSelectedQaId] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    const visibility = isVerified ? ['guest', 'verified'] : ['guest'];

    const { data, error: qaError } = await supabase
      .from('cellar_prepared_qa')
      .select('id, question, answer, topic, status, visibility, related_asset_id, sort_order, published_at, updated_at, created_at')
      .eq('status', 'published')
      .eq('investor_kb_scope', 'investor_kb')
      .in('visibility', visibility)
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false, nullsFirst: false });

    if (qaError) {
      setQas([]);
      setError(getFriendlyCellarError(qaError, 'Unable to load prepared answers.'));
    } else {
      setQas((data ?? []) as PreparedQA[]);
    }
    setIsLoading(false);
  }, [isVerified]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const topicOptions = useMemo(() => {
    const topics = Array.from(new Set(qas.map((qa) => qa.topic?.trim()).filter(Boolean) as string[]));
    return ['all', ...topics];
  }, [qas]);
  const visibleQas = topicFilter === 'all' ? qas : qas.filter((qa) => qa.topic === topicFilter);
  const selectedQa = visibleQas.find((qa) => qa.id === selectedQaId) ?? visibleQas[0] ?? null;

  useEffect(() => {
    if (selectedQa?.id && selectedQa.id !== selectedQaId) {
      setSelectedQaId(selectedQa.id);
    }
  }, [selectedQa, selectedQaId]);

  return (
    <section className="simple-page questions-page">
      <header className="investor-page-header">
        <div>
          <p>Prepared answers</p>
          <h1>Reference library</h1>
          <span>Browse prepared answers from the CELLAR investor knowledge base. Send new questions through Messages.</span>
        </div>
      </header>

      <div className="qa-topic-filters" role="group" aria-label="Prepared answer topics">
        {topicOptions.map((topic) => (
          <button
            type="button"
            key={topic}
            className={topicFilter === topic ? 'is-selected' : ''}
            onClick={() => {
              setTopicFilter(topic);
              setSelectedQaId(null);
            }}
          >
            {topic === 'all' ? 'All' : topic}
          </button>
        ))}
      </div>

      {isLoading && <InvestorEmptyState title="Loading prepared answers" body="Checking investor reference answers." />}
      {!isLoading && error && <InvestorEmptyState title="Prepared answers are unavailable" body="Please try again shortly." />}
      {!isLoading && !error && visibleQas.length === 0 && (
        <InvestorEmptyState
          title="No prepared answers available"
          body="Prepared answers will appear here when they are available. Use Messages for investor questions."
        />
      )}
      {!isLoading && !error && visibleQas.length > 0 && (
        <div className="qa-browser-layout">
          <div className="qa-question-list" aria-label="Prepared answers">
            {visibleQas.map((qa) => (
              <button
                type="button"
                className={`qa-question-card ${selectedQa?.id === qa.id ? 'is-selected' : ''}`}
                key={qa.id}
                onClick={() => setSelectedQaId(qa.id)}
              >
                <span>{qa.topic || 'Investor answers'}</span>
                <strong>{qa.question}</strong>
              </button>
            ))}
          </div>
          {selectedQa && (
            <article className="qa-answer-panel">
              <span>{selectedQa.topic || 'Investor answers'}</span>
              <h2>{selectedQa.question}</h2>
              <p>{selectedQa.answer}</p>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function getQaDefaultForm(source?: Partial<PreparedQA>): Omit<PreparedQA, 'id' | 'created_at' | 'updated_at' | 'published_at'> & { id?: string } {
  return {
    id: source?.id,
    question: source?.question ?? '',
    answer: source?.answer ?? '',
    topic: source?.topic ?? '',
    status: source?.status ?? 'draft',
    visibility: source?.visibility ?? 'guest',
    related_asset_id: source?.related_asset_id ?? null,
    sort_order: source?.sort_order ?? 0,
  };
}

function MessagesPage({
  threads,
  isLoading,
  error,
  isStaffPreview,
  isVerifiedRequired,
  onVerify,
  onSendMessage,
  onStartThread,
  onRenameThread,
  onDeleteThread,
}: {
  threads: InvestorMessageThread[];
  isLoading: boolean;
  error: string;
  isStaffPreview: boolean;
  isVerifiedRequired: boolean;
  onVerify: () => void;
  onSendMessage: (thread: InvestorMessageThread, body: string) => Promise<void>;
  onStartThread: (subject: string, body: string) => Promise<void>;
  onRenameThread: (thread: InvestorMessageThread, subject: string) => Promise<void>;
  onDeleteThread: (thread: InvestorMessageThread) => Promise<void>;
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isComposingNewThread, setIsComposingNewThread] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [renamingThread, setRenamingThread] = useState<InvestorMessageThread | null>(null);
  const [renameSubjectDraft, setRenameSubjectDraft] = useState('');
  const [deletingThread, setDeletingThread] = useState<InvestorMessageThread | null>(null);
  const investorMessageStreamRef = useRef<HTMLDivElement | null>(null);
  const investorMessageBottomRef = useRef<HTMLDivElement | null>(null);
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;
  const selectedThreadLastMessageId = selectedThread?.messages.at(-1)?.id ?? null;
  const getInvestorMessageSenderLabel = (message: InvestorMessage) => {
    if (message.sender_kind === 'investor') return 'You';
    return message.sender_display_name?.trim() || 'JOBZ CAFE';
  };

  useEffect(() => {
    if (!selectedThreadId && threads[0]) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThreadId, threads]);

  useEffect(() => {
    const stream = investorMessageStreamRef.current;
    if (!stream || isLoading || isComposingNewThread) return;
    const scrollToLatestMessage = () => {
      stream.scrollTop = stream.scrollHeight;
      investorMessageBottomRef.current?.scrollIntoView({ block: 'end' });
    };
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToLatestMessage();
      });
    });
    const timeoutId = window.setTimeout(() => {
      scrollToLatestMessage();
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [isComposingNewThread, isLoading, selectedThreadId, selectedThreadLastMessageId]);

  const submitMessage = async (event: FormEvent) => {
    event.preventDefault();
    const cleanDraft = draft.trim();

    if (!selectedThread || !cleanDraft) {
      return;
    }

    setIsSending(true);
    setSendError('');

    try {
      await onSendMessage(selectedThread, cleanDraft);
      setDraft('');
      setIsComposingNewThread(false);
    } catch (sendMessageError) {
      setSendError(
        sendMessageError instanceof Error
          ? sendMessageError.message
          : 'Unable to send this message.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const submitFirstMessage = async (event: FormEvent) => {
    event.preventDefault();
    const cleanSubject = subjectDraft.trim();
    const cleanDraft = draft.trim();

    if (!cleanSubject || !cleanDraft) {
      setSendError('Name the message and add your note before sending.');
      return;
    }

    setIsSending(true);
    setSendError('');

    try {
      await onStartThread(cleanSubject, cleanDraft);
      setSubjectDraft('');
      setDraft('');
      setIsComposingNewThread(false);
    } catch (sendMessageError) {
      setSendError(
        sendMessageError instanceof Error
          ? sendMessageError.message
          : 'Unable to send this message.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const renameThread = async (thread: InvestorMessageThread) => {
    const nextSubject = renameSubjectDraft.trim();
    if (!nextSubject || nextSubject === thread.subject) return;
    setIsSending(true);
    setSendError('');
    try {
      await onRenameThread(thread, nextSubject);
      setRenamingThread(null);
      setRenameSubjectDraft('');
    } catch (renameError) {
      setSendError(renameError instanceof Error ? renameError.message : 'Unable to rename this message.');
    } finally {
      setIsSending(false);
    }
  };

  const deleteThread = async (thread: InvestorMessageThread) => {
    setIsSending(true);
    setSendError('');
    try {
      await onDeleteThread(thread);
      setDeletingThread(null);
      if (selectedThreadId === thread.id) {
        setSelectedThreadId(null);
      }
    } catch (deleteError) {
      setSendError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="simple-page">
      <header className="investor-page-header">
        <div>
          <p>Private correspondence</p>
          <h1>Messages</h1>
        </div>
      </header>
      {isLoading && (
        <InvestorEmptyState title="Loading messages" body="Checking private investor messages." />
      )}
      {!isLoading && error && (
        <InvestorEmptyState title="Messages unavailable" body={error} />
      )}
      {!isLoading && !error && isStaffPreview && (
        <section className="message-panel message-access-panel">
          <div className="message-panel-header">
            <p>Verified investors only</p>
            <h2>Private correspondence</h2>
            <span>Messages are available when viewing CELLAR as a verified investor.</span>
          </div>
          <div className="message-access-actions">
            <button type="button" onClick={onVerify}>
              Verify access
            </button>
          </div>
        </section>
      )}
      {!isLoading && !error && !isStaffPreview && isVerifiedRequired && (
        <section className="message-panel message-access-panel">
          <div className="message-panel-header">
            <p>Verified access required</p>
            <h2>Private correspondence</h2>
            <span>Verify your email before starting a private message.</span>
          </div>
          <div className="message-access-actions">
            <button type="button" onClick={onVerify}>
              Verify access
            </button>
          </div>
        </section>
      )}
      {!isLoading && !error && !isStaffPreview && !isVerifiedRequired && threads.length === 0 && (
        <section className="message-panel message-first-panel">
          <div className="message-panel-header">
            <p>Private correspondence</p>
            <h2>Send a first message</h2>
            <span>Start a private message with the JOBZ CAFE team.</span>
          </div>
          <form className="message-composer message-composer-large" onSubmit={submitFirstMessage}>
            <label htmlFor="investor-first-message-subject">Message name</label>
            <input
              id="investor-first-message-subject"
              value={subjectDraft}
              onChange={(event) => setSubjectDraft(uppercaseFirstTypedCharacter(event.target.value))}
              placeholder="Name this message"
              spellCheck
            />
            <label htmlFor="investor-first-message">Message</label>
            <textarea
              id="investor-first-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write your question or request..."
              spellCheck
            />
            {sendError && <p className="staff-upload-status is-error">{sendError}</p>}
            <div className="message-composer-actions">
              <button type="submit" disabled={isSending || !subjectDraft.trim() || !draft.trim()}>
                {isSending ? 'Sending...' : 'Send message'}
              </button>
            </div>
          </form>
        </section>
      )}
      {!isLoading && !error && !isStaffPreview && !isVerifiedRequired && threads.length > 0 && (
        <div className="messages-workspace">
          <div className="message-workspace-toolbar">
            <div>
              <p>Scoped correspondence</p>
              <span>Messages are tied to your investor account and are not a shared inbox.</span>
            </div>
            <button
              type="button"
              className="message-new-thread-button"
            onClick={() => {
                setSubjectDraft('');
                setDraft('');
                setSendError('');
                setIsComposingNewThread(true);
              }}
            >
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              New message
            </button>
          </div>
          {sendError && <p className="staff-upload-status is-error">{sendError}</p>}
          <div className="messages-layout">
            <div className="message-thread-list">
            {threads.map((thread) => (
              <article
                key={thread.id}
                className={`message-thread-card ${selectedThread?.id === thread.id ? 'is-selected' : ''}`}
              >
                <button type="button" className="message-card-main" onClick={() => setSelectedThreadId(thread.id)}>
                  <div className="message-card-meta">
                    <span>{thread.status.replaceAll('_', ' ')}</span>
                    <span>{formatCompactDateTime(thread.last_message_at ?? thread.messages[0]?.sent_at)}</span>
                  </div>
                  <h2>{thread.subject}</h2>
                  <p>{thread.messages[0]?.body ?? 'No messages yet.'}</p>
                </button>
                <div className="staff-overflow-menu message-card-menu">
                  <button
                    type="button"
                    className="staff-overflow-trigger"
                    aria-label={`Actions for ${thread.subject}`}
                    aria-expanded={openMessageMenuId === thread.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMessageMenuId((currentId) => currentId === thread.id ? null : thread.id);
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {openMessageMenuId === thread.id && (
                    <div className="staff-overflow-panel" role="menu">
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        setOpenMessageMenuId(null);
                        setRenamingThread(thread);
                        setRenameSubjectDraft(thread.subject);
                      }} role="menuitem">
                        Rename
                      </button>
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        setOpenMessageMenuId(null);
                        setDeletingThread(thread);
                      }} role="menuitem">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            </div>

          {isComposingNewThread ? (
            <section className="message-panel message-first-panel">
              <div className="message-panel-header">
                <p>New conversation</p>
                <h2>New message</h2>
                <span>Start a separate private message with the JOBZ CAFE team.</span>
              </div>
              <form className="message-composer message-composer-large" onSubmit={submitFirstMessage}>
                <label htmlFor="investor-new-message-subject">Message name</label>
                <input
                  id="investor-new-message-subject"
                  value={subjectDraft}
                  onChange={(event) => setSubjectDraft(uppercaseFirstTypedCharacter(event.target.value))}
                  placeholder="Name this message"
                  spellCheck
                />
                <label htmlFor="investor-new-message">Message</label>
                <textarea
                  id="investor-new-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write your question or request..."
                  spellCheck
                />
                {sendError && <p className="staff-upload-status is-error">{sendError}</p>}
                <div className="message-composer-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectDraft('');
                      setDraft('');
                      setSendError('');
                      setIsComposingNewThread(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isSending || !subjectDraft.trim() || !draft.trim()}>
                    {isSending ? 'Sending...' : 'Send message'}
                  </button>
                </div>
              </form>
            </section>
          ) : selectedThread && (
            <section className="message-panel">
              <div className="message-panel-header">
                <p>Conversation</p>
                <h2>{selectedThread.subject}</h2>
                <span>{selectedThread.status.replaceAll('_', ' ')}</span>
              </div>
              <div className="message-stream" ref={investorMessageStreamRef}>
                {selectedThread.messages.length === 0 && (
                  <InvestorEmptyState title="No messages yet" body="This message is open but has no replies yet." />
                )}
                {selectedThread.messages.map((message) => (
                  <article
                    className={`message-bubble ${message.sender_kind === 'investor' ? 'is-user' : ''}`}
                    key={message.id}
                  >
                    <strong>{getInvestorMessageSenderLabel(message)}</strong>
                    <p>{message.body}</p>
                  </article>
                ))}
                <div className="message-stream-anchor" ref={investorMessageBottomRef} aria-hidden="true" />
              </div>
              <form className="message-composer" onSubmit={submitMessage}>
                <label htmlFor="investor-message-draft">Reply</label>
                <textarea
                  id="investor-message-draft"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a private message..."
                  spellCheck
                />
                {sendError && <p className="staff-upload-status is-error">{sendError}</p>}
                <button type="submit" disabled={isSending || !draft.trim()}>
                  {isSending ? 'Sending...' : 'Send message'}
                </button>
              </form>
            </section>
          )}
          </div>
        </div>
      )}
      {renamingThread && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer notes-action-drawer message-action-drawer" aria-label="Rename message" aria-modal="true" role="dialog">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => {
                setRenamingThread(null);
                setRenameSubjectDraft('');
              }}
              aria-label="Close rename message"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="notes-action-panel">
              <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              <h2>Rename message</h2>
              <p>Update the name shown for this message group.</p>
              <label className="pitch-colleague-field">
                <span>Message name</span>
                <input
                  value={renameSubjectDraft}
                  onChange={(event) => setRenameSubjectDraft(uppercaseFirstTypedCharacter(event.target.value))}
                  placeholder="Message name"
                />
              </label>
              <div className="notes-action-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setRenamingThread(null);
                    setRenameSubjectDraft('');
                  }}
                >
                  Cancel
                </button>
                <button type="button" onClick={() => void renameThread(renamingThread)} disabled={isSending || !renameSubjectDraft.trim()}>
                  Save name
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
      {deletingThread && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer notes-action-drawer message-action-drawer" aria-label="Delete message" aria-modal="true" role="dialog">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => setDeletingThread(null)}
              aria-label="Close delete message"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="notes-action-panel">
              <Trash2 className="h-6 w-6" aria-hidden="true" />
              <h2>Delete message</h2>
              <p>All individual messages within this group will be permanently deleted and cannot be retrieved.</p>
              <div className="notes-action-summary">
                <strong>{deletingThread.subject}</strong>
                <span>{deletingThread.messages.length} individual message{deletingThread.messages.length === 1 ? '' : 's'} will be deleted.</span>
              </div>
              <div className="notes-action-buttons">
                <button type="button" onClick={() => setDeletingThread(null)}>
                  Cancel
                </button>
                <button type="button" onClick={() => void deleteThread(deletingThread)} disabled={isSending}>
                  Delete message
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function UpdatesPage({ isVerified, onVerify }: { isVerified: boolean; onVerify: () => void }) {
  return (
    <section className="simple-page">
      <header className="investor-page-header">
        <div>
          <p>Investor updates</p>
          <h1>Updates</h1>
        </div>
      </header>
      {!isVerified ? (
        <section className="message-panel message-access-panel">
          <div className="message-panel-header">
            <p>Verified access required</p>
            <h2>Private update stream</h2>
            <span>Verify your email to view investor-specific updates and team responses.</span>
          </div>
          <div className="message-access-actions">
            <button type="button" onClick={onVerify}>
              Verify access
            </button>
          </div>
        </section>
      ) : (
        <section className="updates-feed">
          <InvestorEmptyState
            title="No updates yet"
            body="Published update events will appear here after the backend update feed is connected."
          />
        </section>
      )}
    </section>
  );
}

function VerifiedEmailAccessDrawer({
  isOpen,
  onClose,
  onConfirm,
  onOpenLegal,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (staffAuth: StaffAuthState) => void;
  onOpenLegal?: (kind: LegalDrawerKind) => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'info' | 'error' | 'success'>('info');

  const sendVerificationCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setTone('error');
      setMessage('Enter your email address before requesting a code.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const { data: accessCheck, error: accessCheckError } = await supabase.functions.invoke(
        'cellar_check_verified_access_email',
        {
          body: {
            cellar_email: normalizedEmail,
          },
        },
      );

      if (accessCheckError || accessCheck?.cellar_can_send_code !== true) {
        setTone('error');
        setMessage('That email is not ready for verified CELLAR access. Please check the address or request access for staff review.');
        setSent(false);
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}?view=dashboard`,
          shouldCreateUser: false,
        },
      });

      if (error) {
        setTone('error');
        setMessage(error.message || 'Unable to send the verification code.');
        return;
      }

      setTone('success');
      setMessage(`Verification code sent to ${normalizedEmail}. Please check your inbox, Junk, or Spam.`);
      setSent(true);
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'Unable to send the verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmVerificationCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!normalizedEmail || !cleanCode) {
      setTone('error');
      setMessage('Enter the email address and verification code.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanCode,
        type: 'email',
      });

      if (error) {
        setTone('error');
        setMessage(error.message || 'The verification code could not be confirmed.');
        return;
      }

      const workspaceAccess = await getCellarWorkspaceAccess();
      setTone('success');
      setMessage('Access session connected.');
      onConfirm?.(
        workspaceAccess.canStaff
          ? {
              status: 'ready',
              email: normalizedEmail,
              bohUserId: workspaceAccess.bohUserId,
              message: 'Staff session ready.',
            }
          : {
              status: 'signed_out',
              email: normalizedEmail,
              bohUserId: null,
              message: 'Investor session ready.',
            },
      );
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'The verification code could not be confirmed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="cellar-sheet-backdrop" role="presentation">
      <aside className="cellar-email-sheet verified-access-drawer" aria-label="Verified access">
        <button
          type="button"
          className="cellar-sheet-close"
          onClick={onClose}
          aria-label="Close verified access"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="cellar-option-icon">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2>Verified access</h2>
        <p>Use your approved investor email to receive a secure verification code.</p>
        <label htmlFor="login-verified-email">Email address</label>
        <input
          id="login-verified-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          spellCheck={false}
        />
        {sent && (
          <>
            <label htmlFor="login-verified-code">Verification code</label>
            <input
              id="login-verified-code"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              autoComplete="one-time-code"
              spellCheck={false}
            />
            <div className="verified-access-actions">
              <button
                type="button"
                className="cellar-primary-action"
                onClick={confirmVerificationCode}
                disabled={isSubmitting || !code.trim()}
              >
                {isSubmitting ? 'Checking...' : 'Continue'}
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="verified-access-resend"
                onClick={sendVerificationCode}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Resend code'}
              </button>
            </div>
          </>
        )}
        {!sent && (
          <button
            type="button"
            className="cellar-primary-action"
            onClick={sendVerificationCode}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send verification code'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {message && <p className={`staff-upload-status is-${tone}`}>{message}</p>}
        <div className="verified-access-consent">
          <p>
            By continuing, you agree to the
            <br />
            <button type="button" onClick={() => onOpenLegal?.('terms')}>
              Terms
            </button>{' '}
            and{' '}
            <button type="button" onClick={() => onOpenLegal?.('privacy')}>
              Privacy Policy
            </button>
            .
          </p>
          <span>JOBZ CAFE&reg;</span>
        </div>
      </aside>
    </div>
  );
}

function VerifiedAccessDrawer({
  isOpen,
  onClose,
  onOpenLegal,
  isStaffSession = false,
  staffEmail,
  onOpenStaffView,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (staffAuth: StaffAuthState) => void;
  onOpenLegal?: (kind: LegalDrawerKind) => void;
  isStaffSession?: boolean;
  staffEmail?: string | null;
  onOpenStaffView?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [investorCategory, setInvestorCategory] = useState('individual');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'info' | 'error' | 'success'>('info');

  const submitAccessRequest = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setTone('error');
      setMessage('Enter your email address before requesting access.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setTone('error');
      setMessage('Enter your first and last name before requesting access.');
      return;
    }

    if (!investorCategory.trim()) {
      setTone('error');
      setMessage('Select the investor type that best describes you.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    const { data, error } = await supabase.functions.invoke('cellar_submit_investor_access_request', {
      body: {
        cellar_email: normalizedEmail,
        cellar_first_name: firstName,
        cellar_last_name: lastName,
        cellar_investor_category: investorCategory,
        cellar_title: title,
        cellar_company: company,
      },
    });

    if (error) {
      setTone('error');
      setMessage(getFriendlyCellarFunctionError(error, 'Unable to submit the investor access request.'));
    } else if (data?.cellar_staff_email) {
      setTone('info');
      setMessage('That email belongs to a JOBZ CAFE staff account, so no investor profile was created.');
    } else {
      setTone('success');
      setMessage('');
      setIsSubmitted(true);
    }

    setIsSubmitting(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="cellar-sheet-backdrop" role="presentation">
      <aside className="cellar-email-sheet verified-access-drawer" aria-label="Verified access">
        <button
          type="button"
          className="cellar-sheet-close"
          onClick={onClose}
          aria-label="Close verified access"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="cellar-option-icon">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </div>
        {isStaffSession ? (
          <>
            <h2>Staff access already connected</h2>
            <p>
              You are signed in as JOBZ CAFE staff, so investor verification is not required for
              this session.
            </p>
            <div className="verified-access-confirmation">
              <strong>{staffEmail ?? 'Staff session'}</strong>
              <span>
                Use Staff view to manage investors, access, messages, presentations, and internal
                workflow. Investor verification is only for external investor accounts.
              </span>
            </div>
            <button type="button" className="cellar-primary-action" onClick={onOpenStaffView ?? onClose}>
              Open staff view
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="verified-access-resend" onClick={onClose}>
              Stay in investor preview
            </button>
          </>
        ) : isSubmitted ? (
          <>
            <h2>Request received</h2>
            <p>
              We will review your investor access request and confirm the next step by email.
              Please check your inbox and Junk or Spam folder.
            </p>
            <div className="verified-access-confirmation">
              <strong>Keep reviewing the pitch</strong>
              <span>
                You can return to the pitch deck while we confirm access. Private messages and deeper
                investor materials will unlock after approval.
              </span>
            </div>
            <button type="button" className="cellar-primary-action" onClick={onClose}>
              Return to pitch
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <h2>Request access</h2>
            <p>Submit an investor request. Staff review is required before access is granted.</p>
            <div className="verified-access-name-grid">
              <label htmlFor="verified-first-name">
                First name
                <input
                  id="verified-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Required"
                  autoComplete="given-name"
                />
              </label>
              <label htmlFor="verified-last-name">
                Last name
                <input
                  id="verified-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Required"
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label htmlFor="verified-email">Email address</label>
            <input
              id="verified-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              spellCheck={false}
            />
            <div className="verified-access-select-row">
              <CellarSelect
                label="Investor type"
                value={investorCategory}
                onChange={setInvestorCategory}
                options={investorCategoryOptions}
              />
            </div>
            <label htmlFor="verified-title">Title</label>
            <input
              id="verified-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional"
              autoComplete="organization-title"
            />
            <label htmlFor="verified-company">Company</label>
            <input
              id="verified-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Optional"
              autoComplete="organization"
            />
            <button
              type="button"
              className="cellar-primary-action"
              onClick={submitAccessRequest}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit request'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {message && <p className={`staff-upload-status is-${tone}`}>{message}</p>}
            <div className="verified-access-consent">
              <p>
                By continuing, you agree to the
                <br />
                <button type="button" onClick={() => onOpenLegal?.('terms')}>
                  Terms
                </button>{' '}
                and{' '}
                <button type="button" onClick={() => onOpenLegal?.('privacy')}>
                  Privacy Policy
                </button>
                .
              </p>
              <span>JOBZ CAFE&reg;</span>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function InvestorAccountDrawer({
  isOpen,
  onClose,
  workspaceAccess,
  themeMode,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceAccess: CellarWorkspaceAccessState | null;
  themeMode: ThemeMode;
  onSaved: (workspaceAccess: CellarWorkspaceAccessState) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fallbackName = splitCellarFullName(workspaceAccess?.fullName);
    setFirstName(workspaceAccess?.firstName ?? fallbackName.firstName);
    setLastName(workspaceAccess?.lastName ?? fallbackName.lastName);
    setTitle(workspaceAccess?.title ?? '');
    setCompany(workspaceAccess?.company ?? '');
    setPhone(workspaceAccess?.phone ?? '');
    setStatus('');
    setTone('info');
  }, [isOpen, workspaceAccess]);

  if (!isOpen) {
    return null;
  }

  const email = workspaceAccess?.email ?? 'Verified investor';
  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setTone('error');
      setStatus('First and last name are required.');
      return;
    }

    setIsSaving(true);
    setStatus('');
    const { error } = await supabase.functions.invoke('cellar_update_investor_profile', {
      body: {
        cellar_first_name: firstName,
        cellar_last_name: lastName,
        cellar_title: title,
        cellar_company: company,
        cellar_phone: phone,
      },
    });

    if (error) {
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(error, 'Unable to update your investor profile.'));
      setIsSaving(false);
      return;
    }

    const nextAccess = await getCellarWorkspaceAccess();
    onSaved(nextAccess);
    setTone('success');
    setStatus('Profile updated.');
    setIsSaving(false);
  };

  return (
    <div
      className={`cellar-sheet-backdrop themed-sheet-backdrop ${themeMode === 'light' ? 'is-light' : ''}`}
      role="presentation"
    >
      <aside className="cellar-email-sheet verified-access-drawer" aria-label="Investor account">
        <button
          type="button"
          className="cellar-sheet-close"
          onClick={onClose}
          aria-label="Close investor account"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="cellar-option-icon">
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2>Investor profile</h2>
        <p>Keep your investor details current. The sign-in email is locked for this workspace.</p>
        <div className="investor-profile-form">
          <label htmlFor="investor-profile-email">
            Email
            <input id="investor-profile-email" value={email} disabled readOnly />
          </label>
          <div className="verified-access-name-grid">
            <label htmlFor="investor-profile-first-name">
              First name
              <input
                id="investor-profile-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </label>
            <label htmlFor="investor-profile-last-name">
              Last name
              <input
                id="investor-profile-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </label>
          </div>
          <label htmlFor="investor-profile-company">
            Company
            <input
              id="investor-profile-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Optional"
              autoComplete="organization"
            />
          </label>
          <label htmlFor="investor-profile-title">
            Title
            <input
              id="investor-profile-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional"
              autoComplete="organization-title"
            />
          </label>
          <label htmlFor="investor-profile-phone">
            Phone
            <input
              id="investor-profile-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Optional"
              autoComplete="tel"
            />
          </label>
        </div>
        {status && <p className={`staff-upload-status is-${tone}`}>{status}</p>}
        <button type="button" className="cellar-primary-action" onClick={saveProfile} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save profile'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </aside>
    </div>
  );
}

function BookingDrawer({
  isOpen,
  bookingProfile,
  onClose,
}: {
  isOpen: boolean;
  bookingProfile: CellarBookingProfile | null;
  onClose: () => void;
}) {
  const [embeddedBookingMessage, setEmbeddedBookingMessage] = useState('');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="cellar-sheet-backdrop" role="presentation">
      <aside className="cellar-email-sheet verified-access-drawer" aria-label="Book a briefing">
        <button
          type="button"
          className="cellar-sheet-close"
          onClick={onClose}
          aria-label="Close booking"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="cellar-option-icon">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2>Investor Relations</h2>
        <p>
          Choose a private CELLAR investor briefing with the CEO or COO.
        </p>
        <div className="booking-access-note">
          Booking a call does not automatically verify investor access.
        </div>
        <div className="booking-slot-list">
          {CELLAR_BOOKING_LINKS.map((bookingLink) => (
            <button
              type="button"
              className="booking-slot-row"
              key={bookingLink.url}
              onClick={() => {
                if (isCellarEmbeddedBohMode()) {
                  setEmbeddedBookingMessage('Open the full CELLAR investor view to use external booking links.');
                  return;
                }
                window.location.assign(getCellarBookingUrl(bookingLink.url, bookingProfile));
              }}
            >
              <span className="booking-slot-role">{bookingLink.role}</span>
              <div>
                <strong>{bookingLink.host}</strong>
                <small>Open Slotz</small>
              </div>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>
        {embeddedBookingMessage && <p className="staff-upload-status is-info">{embeddedBookingMessage}</p>}
      </aside>
    </div>
  );
}

const CELLAR_TERMS_SECTIONS: CellarLegalSection[] = [
  {
    heading: 'CELLAR Investor Room Disclaimer',
    paragraphs: [
      'CELLAR is a private investor information workspace. Nothing in CELLAR, including presentations, updates, messages, notes, booking links, Q&A, financial information, forecasts, or other materials, is an offer to sell, a solicitation of an offer to buy, or a recommendation to purchase any securities or other investment interest.',
      'Any securities offering, if made, will be made only through definitive offering documents, subscription materials, and other legally required disclosures supplied by the issuer or its authorized representatives, and only to eligible investors under an available exemption from registration or another lawful offering pathway.',
      'Access to CELLAR does not verify investor eligibility, grant investment rights, create a broker-dealer, investment adviser, fiduciary, or agency relationship, or replace independent legal, tax, accounting, or investment advice. JOBZ CAFE and CELLAR are not responsible for any investment decision made from draft, summary, preliminary, or discussion materials.',
    ],
    bullets: [
      'Do not rely on CELLAR materials as a complete basis for an investment decision.',
      'Forward-looking statements, projections, plans, and market information are subject to risk, uncertainty, change, and correction.',
      'Final securities-law legends and investor eligibility language should be reviewed and approved by qualified securities counsel before production use.',
    ],
  },
  {
    heading: 'Contractual Relationship',
    paragraphs: [
      'These Terms of Use govern your access to or use of the applications, websites, content, products, and services made available by Jobz Cafe, Inc. and its parents, subsidiaries, representatives, affiliates, officers, and directors. Jobz Cafe, Inc. is a Delaware corporation. Notices may be sent to Jobz Cafe, Inc., 16192 Coastal Highway, Lewes, Delaware 19958, United States, or to info@jobzcafe.com.',
      'By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, you may not access or use the Services. Jobz Cafe may amend these Terms by posting updated Terms. Continued use after posting confirms your consent to the amended Terms.',
    ],
  },
  {
    heading: 'Arbitration Agreement',
    paragraphs: [
      'You and Jobz Cafe agree that disputes arising out of or relating to these Terms or the Services will be resolved by binding individual arbitration, not in court, except for individual small claims matters and requests for injunctive or equitable relief to protect intellectual property rights.',
      'You and Jobz Cafe each waive the right to a jury trial and to participate in a class, collective, consolidated, or representative action. Arbitration will be administered by the American Arbitration Association under its Consumer Arbitration Rules.',
    ],
  },
  {
    heading: 'The Services',
    paragraphs: [
      'The Services comprise websites, applications, content, products, and related services that enable users to engage with the JOBZ CAFE community, career, recruiting, talent, investor, and business services, and to purchase or access certain goods or services from Jobz Cafe or third parties under agreement with Jobz Cafe or its affiliates.',
      'Subject to your compliance with these Terms, Jobz Cafe grants you a limited, non-exclusive, non-sublicensable, revocable, non-transferable license to access and use the Services for your permitted personal, noncommercial, or internal business purposes.',
    ],
    bullets: [
      'You may not copy, modify, reverse engineer, scrape, frame, resell, interfere with, or attempt to gain unauthorized access to any portion of the Services except as expressly permitted by Jobz Cafe or applicable law.',
      'The Services may be accessed in connection with third-party services and content that Jobz Cafe does not control. Different terms and privacy policies may apply to those third-party services.',
      'The Services and all rights in them remain Jobz Cafe property or the property of Jobz Cafe licensors.',
    ],
  },
  {
    heading: 'Access and Use',
    paragraphs: [
      'To use many aspects of the Services, you may need to register for and maintain an active account or verified access record. You must be at least 18 years old, or the age of legal majority in your jurisdiction if different, unless a specific Service permits otherwise.',
      'You agree to maintain accurate, complete, and current information and to keep your login credentials secure. You agree to use the Services only for lawful purposes and in compliance with applicable laws.',
      'Jobz Cafe may contact you using phone, email, text messages, or in-product notices as permitted by law and described in the Privacy Policy. Message and data rates may apply.',
    ],
  },
  {
    heading: 'User Content',
    paragraphs: [
      'Jobz Cafe may permit you to submit, upload, publish, or otherwise make available text, audio, visual content, comments, feedback, support requests, and other materials. You retain ownership of your User Content, but grant Jobz Cafe a worldwide, perpetual, irrevocable, transferable, royalty-free license to use, copy, modify, distribute, display, perform, and otherwise exploit that User Content in connection with the Services and Jobz Cafe business.',
    ],
  },
  {
    heading: 'Payment',
    paragraphs: [
      'Use of the Services may result in charges for services, goods, subscriptions, memberships, or other purchases. Charges may include applicable taxes where required by law. Charges are final and non-refundable unless otherwise determined by Jobz Cafe or required by applicable law.',
    ],
  },
  {
    heading: 'Disclaimers, Liability, and Indemnity',
    paragraphs: [
      'The Services are provided as is and as available. Jobz Cafe disclaims all representations and warranties, express, implied, or statutory, not expressly set out in these Terms, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.',
      'To the maximum extent permitted by applicable law, Jobz Cafe shall not be liable for indirect, incidental, special, exemplary, punitive, or consequential damages, including lost profits, lost data, personal injury, or property damage arising from or related to your use of the Services.',
      'You agree to indemnify and hold Jobz Cafe, its affiliates, officers, directors, employees, and agents harmless from claims, demands, losses, liabilities, and expenses, including attorneys fees, arising out of or related to your use of the Services, your breach of these Terms, Jobz Cafe use of your User Content, or your violation of third-party rights.',
    ],
  },
  {
    heading: 'Other Provisions',
    paragraphs: [
      'These Terms are governed by and construed in accordance with the laws of the State of Delaware, without giving effect to conflict-of-law principles, except as otherwise provided in the Arbitration Agreement above or in supplemental terms applicable to a particular Service.',
      'Jobz Cafe may provide notice through the Services, by email, by telephone or text message, or by mail to an address connected with your account. Claims of copyright infringement and other legal questions may be sent to info@jobzcafe.com or to Jobz Cafe, Inc., 16192 Coastal Highway, Lewes, Delaware 19958, United States.',
    ],
  },
];

const CELLAR_PRIVACY_SECTIONS: CellarLegalSection[] = [
  {
    heading: 'Overview',
    paragraphs: [
      'This Privacy Policy describes JOBZ CAFE policies and procedures on the collection, use, and disclosure of your information when you use the Service, and tells you about your privacy rights and how the law protects you.',
      'We use personal data to provide and improve the Service. By using the Service, you agree to the collection and use of information in accordance with this Privacy Policy.',
    ],
  },
  {
    heading: 'Information We Collect',
    paragraphs: [
      'While using our Service, we may ask you to provide personally identifiable information that can be used to contact or identify you. This may include email address, first and last name, phone number, address, and other profile or account details.',
      'Usage Data is collected automatically when using the Service. Usage Data may include IP address, browser type, browser version, pages visited, time and date of visit, time spent on pages, unique device identifiers, and diagnostic data.',
    ],
  },
  {
    heading: 'Cookies and Tracking Technologies',
    paragraphs: [
      'We use cookies and similar tracking technologies to track activity on our Service and store certain information. Tracking technologies may include beacons, tags, and scripts to collect and track information and to improve and analyze our Service.',
      'You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. If you do not accept cookies, some parts of the Service may not function properly.',
    ],
  },
  {
    heading: 'Use of Personal Data',
    bullets: [
      'To provide and maintain our Service, including monitoring usage.',
      'To manage your account or verified access record.',
      'To perform contracts for products, services, subscriptions, or other purchases.',
      'To contact you by email, telephone, SMS, in-product notices, or equivalent communication.',
      'To provide news, offers, updates, and information about goods, services, or events, unless you opt out where applicable.',
      'To manage your requests and improve our Service, products, services, marketing, and user experience.',
    ],
  },
  {
    heading: 'Sharing Personal Information',
    bullets: [
      'With service providers who help us operate, analyze, maintain, or contact users through the Service.',
      'For business transfers, including mergers, financing, acquisitions, or asset sales.',
      'With affiliates, where we require those affiliates to honor this Privacy Policy.',
      'With business partners where needed to offer certain products, services, or promotions.',
      'With your consent, or where required to comply with legal obligations and protect rights, safety, property, or against legal liability.',
    ],
  },
  {
    heading: 'Retention and Transfer',
    paragraphs: [
      'We retain personal data only for as long as necessary for the purposes set out in this Privacy Policy, and to comply with legal obligations, resolve disputes, and enforce legal agreements and policies.',
      'Your information may be transferred to and maintained on computers located outside your state, province, country, or other governmental jurisdiction where data protection laws may differ. We take steps reasonably necessary to ensure that your data is treated securely and in accordance with this Privacy Policy.',
    ],
  },
  {
    heading: 'Your Data Rights',
    paragraphs: [
      'You may have the right to access, update, amend, or delete personal information that we have collected about you. You may contact us to request access to, correction of, or deletion of personal information you have provided to us.',
      'Please note that we may need to retain certain information when we have a legal obligation or lawful basis to do so.',
    ],
  },
  {
    heading: 'Security, Children, and Third-Party Links',
    paragraphs: [
      'The security of your personal data is important to us, but no method of transmission over the Internet or electronic storage is 100 percent secure. We use commercially acceptable means to protect personal data but cannot guarantee absolute security.',
      'Our Service does not address anyone under the age of 13, and we do not knowingly collect personally identifiable information from anyone under 13.',
      'Our Service may contain links to websites not operated by us. We strongly advise you to review the privacy policy of every site you visit.',
    ],
  },
  {
    heading: 'Changes and Contact',
    paragraphs: [
      'We may update this Privacy Policy from time to time. We will notify you of changes by posting the new Privacy Policy on this page and, where appropriate, by email or prominent notice.',
      'If you have questions about this Privacy Policy, you can contact us by email at info@jobzcafe.com.',
    ],
  },
];

const CELLAR_INVESTOR_GUIDE_SECTIONS: CellarLegalSection[] = [
  {
    heading: 'Access',
    paragraphs: [
      'Use the access code or verified access link provided by JOBZ CAFE®. The workspace is private and prepared for invited presentation review.',
    ],
    bullets: [
      'Keep the code and workspace link private.',
      'Verified access lets you return to saved investor workspace activity.',
      'If access fails, contact the JOBZ CAFE® team member who invited you.',
    ],
  },
  {
    heading: 'Presentation Review',
    paragraphs: [
      'The presentation area contains the current materials selected for investor review. Published materials may be updated as the opportunity progresses.',
    ],
    bullets: [
      'Open the pitch, supporting files, updates, and prepared answers from the sidebar.',
      'Download the current pitch PDF when you need an offline copy.',
      'Send the pitch PDF to a colleague without JOBZ CAFE storing their email address.',
      'Use the latest visible materials as the working version inside CELLAR.',
    ],
  },
  {
    heading: 'Messages and Questions',
    paragraphs: [
      'Use Messages for direct conversation with the JOBZ CAFE® team. Use Questions and answers as a prepared-answer reference for presentation review.',
    ],
    bullets: [
      'Messages are visible to staff managing investor communications.',
      'Replies from staff appear in your workspace messages.',
      'Create a message group when you need a separate private conversation.',
      'Send new investor questions through Messages for staff follow-up.',
    ],
  },
  {
    heading: 'Notes and Bookings',
    paragraphs: [
      'Notes support your review of the presentation materials. Booking tools are available when the team has enabled them for follow-up conversations.',
    ],
    bullets: [
      'Investor notes are separate from internal staff contact notes.',
      'Send slide notes to JOBZ CAFE from the presentation notes tools.',
      'Use verified access when you need continuity across sessions.',
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'CELLAR is an invitation-first workspace. Do not forward private materials, access codes, or workspace links unless JOBZ CAFE® has approved sharing.',
    ],
  },
];

const CELLAR_STAFF_GUIDE_SECTIONS: CellarLegalSection[] = [
  {
    heading: 'Staff Access',
    paragraphs: [
      'Staff sign in with the standard JOBZ CAFE® BOH account pattern. CELLAR uses BOH users for staff identity, ownership, and audit activity.',
    ],
    bullets: [
      'All staff can currently view investor contacts.',
      'Contact ownership should be assigned to the staff member responsible for the relationship.',
    ],
  },
  {
    heading: 'Dashboard',
    paragraphs: [
      'The dashboard is for operational status: verified investors, verification approvals, invitation conversion, and open action items.',
    ],
    bullets: [
      'Action items cover staff follow-up work such as access requests and investor messages.',
      'Invitation conversion compares sent access emails with investors who later become verified.',
    ],
  },
  {
    heading: 'Invitations and Access',
    paragraphs: [
      'Use Access to manage investor entry into CELLAR. Sending an access-code email and resetting the shared guest code are separate staff tasks.',
    ],
    bullets: [
      'Use Send email to share the current access code with an investor.',
      'Sent from sets the relationship owner shown on the investor contact.',
      'Sent by records the staff user who performed the access-code action.',
      'Reset shared code only when the existing code should stop working before its normal rotation.',
      'The shared guest code rotates every 14 days if staff do not reset it sooner.',
      'Existing Patron emails can receive access-code emails when they are not BOH staff users.',
    ],
  },
  {
    heading: 'Pipeline and Contacts',
    paragraphs: [
      'Use Pipeline and Contacts to manage the investor relationship after an access-code email, access request, or message. Guest access cards progress through access activity; relationship follow-up happens from the contact workspace.',
    ],
    bullets: [
      'Use Contacts for the profile, activity, messages, and internal notes for each investor.',
      'Update the owner when responsibility for the investor relationship changes.',
      'Pipeline moves and ownership changes appear in the contact activity stream.',
    ],
  },
  {
    heading: 'Messages and Notes',
    paragraphs: [
      'Messages are for staff-to-investor communication. Notes are internal CRM notes for the investor relationship and are not investor presentation notes.',
    ],
    bullets: [
      'Reply from the Messages tab or the investor contact Messages tab.',
      'Use Notes for staff context, follow-up detail, and relationship history.',
    ],
  },
  {
    heading: 'Presentations and Assets',
    paragraphs: [
      'Use Presentations to manage the published investor deck and supporting files. Publish only materials intended for investor review.',
    ],
    bullets: [
      'Use the asset menu to edit details, swap the file, or open Slide narratives for deck assets.',
      'Slide narratives are edited in the presentation workspace so staff can preview the deck while writing the investor-facing narration.',
      'A blank slide can stay blank; CELLAR will still show narratives for later slides that have text.',
      'Use guest visibility for materials that should appear after guest-code access.',
    ],
  },
  {
    heading: 'Questions and Answers',
    paragraphs: [
      'Use Questions and answers as a prepared-answer reference library tied to the presentation. Keep answers concise, current, and aligned with the published investor materials.',
    ],
    bullets: [
      'Publish only responses ready for investor review.',
      'Use the source asset when a response belongs to a specific presentation or document.',
      'Route new investor questions through Messages for staff follow-up.',
    ],
  },
];

const CELLAR_STAFF_GUIDE_MODULES: CellarGuideModule[] = [
  {
    id: 'staff-dashboard',
    title: 'Staff dashboard',
    src: '/walkthroughs/cellar/staff/01-staff-dashboard.mp4',
    durationLabel: '18 sec',
    description: 'Monitor verified investors, approvals, invitation conversion, and action items from one operating view.',
  },
  {
    id: 'investor-requests',
    title: 'Investor requests',
    src: '/walkthroughs/cellar/staff/02-investor-requests.mp4',
    durationLabel: '14 sec',
    description: 'Review verified-access requests before approving deeper investor workspace access.',
  },
  {
    id: 'investor-contacts',
    title: 'Investor contacts',
    src: '/walkthroughs/cellar/staff/03-investor-contacts.mp4',
    durationLabel: '16 sec',
    description: 'Maintain investor records with ownership, access status, and recent relationship context.',
  },
  {
    id: 'investor-messages',
    title: 'Investor messages',
    src: '/walkthroughs/cellar/staff/04-investor-messages.mp4',
    durationLabel: '15 sec',
    description: 'Keep private investor correspondence tied to the correct contact and staff workflow.',
  },
  {
    id: 'presentations',
    title: 'Presentations',
    src: '/walkthroughs/cellar/staff/05-presentations.mp4',
    durationLabel: '17 sec',
    description: 'Review presentation details, then open slide narratives to update the investor-facing story.',
  },
  {
    id: 'qa-library',
    title: 'Questions and answers',
    src: '/walkthroughs/cellar/staff/06-qa-library.mp4',
    durationLabel: '14 sec',
    description: 'Prepare consistent answers by topic, audience, source, and status.',
  },
  {
    id: 'invitations',
    title: 'Investor invitations',
    src: '/walkthroughs/cellar/staff/07-invites.mp4',
    durationLabel: '16 sec',
    description: 'Prepare controlled investor access invitations from the updated aligned form.',
  },
  {
    id: 'access-management',
    title: 'Access management',
    src: '/walkthroughs/cellar/staff/08-access-management.mp4',
    durationLabel: '14 sec',
    description: 'Manage the active shared access code and staff-controlled entry points.',
  },
  {
    id: 'team-access',
    title: 'Team access',
    src: '/walkthroughs/cellar/staff/09-team-access.mp4',
    durationLabel: '13 sec',
    description: 'Review internal staff access and keep investor operations owned by the right people.',
  },
];

const CELLAR_DRAWER_CONTENT: Record<LegalDrawerKind, CellarDrawerContent> = {
  terms: {
    title: 'Terms of Use',
    eyebrow: 'U.S. Terms of Use',
    summary:
      'CELLAR is an invitation-first investor workspace for private review, communication, booking, and discussion. CELLAR materials are not an offer to sell, solicitation, investment recommendation, or substitute for definitive offering documents.',
    updatedLabel: 'Effective January 28, 2019. Updated May 21, 2026.',
    sections: CELLAR_TERMS_SECTIONS,
    externalUrl: 'https://jobzcafe.com/terms-of-use',
  },
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'JOBZ CAFE privacy framework',
    summary:
      'CELLAR uses the JOBZ CAFE platform privacy framework for investor access, profile details, messages, questions, notes, booking activity, and presentation-room interactions.',
    updatedLabel: 'JOBZ CAFE platform privacy policy',
    sections: CELLAR_PRIVACY_SECTIONS,
    externalUrl: 'https://jobzcafe.com/privacy',
  },
  'investor-guide': {
    title: 'Guide',
    eyebrow: 'Workspace guide',
    summary:
      'A brief guide for invited investors using CELLAR to review the JOBZ CAFE® presentation, reference prepared answers, exchange messages, and manage review notes.',
    video: {
      title: 'CELLAR investor overview',
      src: '/walkthroughs/cellar/cellar-investor-overview-current.mp4',
      durationLabel: '2 min 35 sec',
    },
    sections: CELLAR_INVESTOR_GUIDE_SECTIONS,
  },
  'staff-guide': {
    title: 'Guide',
    eyebrow: 'Workspace guide',
    summary:
      'A concise operating guide for CELLAR staff managing investor access invitations, access requests, pipeline movement, contacts, messages, and internal notes.',
    video: {
      title: 'CELLAR staff library review reel',
      src: '/walkthroughs/cellar/staff/cellar-staff-library-review-reel.mp4',
      durationLabel: '2 min 15 sec',
    },
    modules: CELLAR_STAFF_GUIDE_MODULES,
    sections: CELLAR_STAFF_GUIDE_SECTIONS,
  },
};

function CellarWalkthroughVideo({
  video,
  onExpand,
  isExpanded = false,
  autoPlay = false,
}: {
  video: NonNullable<CellarDrawerContent['video']>;
  onExpand?: () => void;
  isExpanded?: boolean;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return undefined;
    player.muted = isMuted;
    if (autoPlay) {
      void player.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
    return () => {
      player.pause();
    };
  }, [autoPlay, isMuted]);

  const openOrPlayVideo = async () => {
    if (onExpand && !isExpanded) {
      onExpand();
      return;
    }
    const player = videoRef.current;
    if (!player) return;
    await player.play();
    setIsPlaying(true);
  };

  const pauseVideo = () => {
    const player = videoRef.current;
    if (!player) return;
    player.pause();
    setIsPlaying(false);
  };

  const toggleVolume = () => {
    setIsMuted((current) => !current);
  };

  return (
    <div className={`legal-video-player ${isExpanded ? 'is-expanded' : ''} ${isPlaying ? 'is-playing' : ''}`}>
      {onExpand && (
        <button
          type="button"
          className="legal-video-expand"
          onClick={() => {
            videoRef.current?.pause();
            setIsPlaying(false);
            onExpand();
          }}
          aria-label="Expand walkthrough video"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <video
        ref={videoRef}
        preload="auto"
        src={video.src}
        poster={video.poster}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={() => {
          if (onExpand && !isExpanded) {
            onExpand();
            return;
          }
          if (isPlaying) {
            pauseVideo();
          } else {
            void openOrPlayVideo();
          }
        }}
      >
        <a href={video.src}>Open walkthrough video</a>
      </video>
      <div className="legal-video-controls" aria-label={`${video.title} controls`}>
        <button
          type="button"
          className="legal-video-play-toggle"
          onClick={() => {
            if (isPlaying) {
              pauseVideo();
            } else {
              void openOrPlayVideo();
            }
          }}
          aria-label={onExpand && !isExpanded ? 'Open walkthrough video' : isPlaying ? 'Pause walkthrough video' : 'Play walkthrough video'}
        >
          {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="legal-video-volume-toggle"
          onClick={toggleVolume}
          aria-label={isMuted ? 'Turn walkthrough audio on' : 'Mute walkthrough audio'}
        >
          {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        </button>
        {video.durationLabel && <span>{video.durationLabel}</span>}
      </div>
    </div>
  );
}

function LegalInfoDrawer({
  appName,
  kind,
  themeMode = 'dark',
  onClose,
}: {
  appName: string;
  kind: LegalDrawerKind | null;
  themeMode?: ThemeMode;
  onClose: () => void;
}) {
  const [expandedVideo, setExpandedVideo] = useState<CellarDrawerContent['video'] | null>(null);

  useEffect(() => {
    if (!kind) {
      setExpandedVideo(null);
    }
  }, [kind]);

  useEffect(() => {
    if (!expandedVideo) {
      return undefined;
    }

    document.documentElement.classList.add('cellar-modal-open');
    document.body.classList.add('cellar-modal-open');

    return () => {
      document.documentElement.classList.remove('cellar-modal-open');
      document.body.classList.remove('cellar-modal-open');
    };
  }, [expandedVideo]);

  if (!kind) {
    return null;
  }

  const content = CELLAR_DRAWER_CONTENT[kind];

  return (
    <div
      className={`legal-drawer-backdrop ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-drawer-title"
    >
      <button
        type="button"
        className="legal-drawer-scrim"
        onClick={onClose}
        aria-label="Close legal drawer"
      />
      <aside
        className="legal-info-drawer"
        aria-label={`${appName} ${content.title}`}
      >
        <header className="legal-info-header">
          <div>
            <p>{appName} by JOBZ CAFE&reg;</p>
            <h2 id="legal-drawer-title">{content.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${content.title}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="legal-info-content">
          <section className="legal-document-intro">
            <span>{content.eyebrow}</span>
            <p>{content.summary}</p>
            {content.updatedLabel && <small>{content.updatedLabel}</small>}
          </section>
          {content.video && !content.modules?.length && (
            <section className="legal-document-video" aria-label={content.video.title}>
              <CellarWalkthroughVideo
                video={content.video}
                onExpand={() => setExpandedVideo(content.video ?? null)}
              />
            </section>
          )}
          {content.modules?.length ? (
            <section className="legal-guide-modules" aria-label="Staff guide videos">
              <div className="legal-guide-modules-heading">
                <span>Video library</span>
                <p>Choose a staff module to watch inside CELLAR.</p>
              </div>
              <div className="legal-guide-module-grid">
                {content.modules.map((module) => (
                  <button
                    type="button"
                    className="legal-guide-module"
                    key={module.id}
                    onClick={() => setExpandedVideo(module)}
                  >
                    <strong>{module.title}</strong>
                    <span>{module.durationLabel}</span>
                    <p>{module.description}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <div className="legal-document-sections">
            {content.sections.map((section) => (
              <article className="legal-document-section" key={section.heading}>
                <h3>{section.heading}</h3>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <footer className="legal-info-footer">
          {content.externalUrl ? (
            <a
              href={content.externalUrl}
              target={isCellarEmbeddedBohMode() ? undefined : '_blank'}
              rel={isCellarEmbeddedBohMode() ? undefined : 'noreferrer'}
            >
              Open full page
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <span>{content.eyebrow}</span>
          )}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>
      {expandedVideo && (
        <div
          className={`fullscreen-slide-backdrop legal-video-backdrop ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}
          role="dialog"
          aria-modal="true"
        >
          <section className="fullscreen-slide-modal legal-video-modal">
            <header>
              <div>
                <span>Walkthrough</span>
                <h2>{expandedVideo.title}</h2>
              </div>
              <button type="button" onClick={() => setExpandedVideo(null)} aria-label="Close expanded walkthrough">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="legal-video-stage">
              <CellarWalkthroughVideo video={expandedVideo} isExpanded autoPlay />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function NotificationsDrawer({
  isOpen,
  onClose,
  audience,
  items = [],
  onSelectItem,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  audience: 'investor' | 'staff';
  items?: StaffNotificationItem[];
  onSelectItem?: (item: StaffNotificationItem) => void;
  themeMode?: ThemeMode;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`cellar-sheet-backdrop notification-sheet-backdrop themed-sheet-backdrop ${themeMode === 'light' ? 'is-light' : ''}`}
      role="presentation"
    >
      <aside className="cellar-email-sheet verified-access-drawer" aria-label="Notifications">
        <button
          type="button"
          className="cellar-sheet-close"
          onClick={onClose}
          aria-label="Close notifications"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="cellar-option-icon">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2>Notifications</h2>
        <p>
          {audience === 'staff'
            ? 'Operational items that need staff awareness or response.'
            : 'Updates about replies, access, and new investor assets.'}
        </p>
        <div className="notification-list">
          {items.length ? items.map((item) => (
            <button
              type="button"
              className="notification-row"
              key={item.id}
              onClick={() => onSelectItem?.(item)}
            >
              <span />
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{item.meta}</small>
              </div>
            </button>
          )) : (
            <StaffEmptyState
              title="No notifications yet"
              body={audience === 'staff'
                ? 'New investor requests and response items will appear here.'
                : 'Staff replies and access updates will appear here.'}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function StaffShell({
  onOpenInvestorView,
  onAccessDenied,
}: {
  onOpenInvestorView: () => void;
  onAccessDenied: (target: 'dashboard' | 'access') => void;
}) {
  const [section, setSection] = useState<StaffSection>('Dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [legalDrawerKind, setLegalDrawerKind] = useState<LegalDrawerKind | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredCellarThemeMode());
  const [workspaceAccessStatus, setWorkspaceAccessStatus] = useState<'checking' | 'ready'>('checking');
  const [embeddedStatusMessage, setEmbeddedStatusMessage] = useState(
    isCellarEmbeddedBohMode()
      ? 'Waiting for BOH to hand off this verified staff session.'
      : 'Confirming this session is linked to a BOH staff user.',
  );
  const embeddedHandoffRetryCountRef = useRef(0);
  const [staffNotifications, setStaffNotifications] = useState<StaffNotificationItem[]>([]);
  const [prefetchedStaffMessageThreads, setPrefetchedStaffMessageThreads] = useState<StaffMessageThread[]>([]);
  const [staffPipelineCount, setStaffPipelineCount] = useState(0);
  const [focusedInvestorRequestId, setFocusedInvestorRequestId] = useState<string | null>(null);
  const [focusedInvestorContactId, setFocusedInvestorContactId] = useState<string | null>(null);
  const [focusedMessageThreadId, setFocusedMessageThreadId] = useState<string | null>(null);
  const [contactDirectoryResetKey, setContactDirectoryResetKey] = useState(0);
  const isInvestorSection =
    section === 'Investor Requests' ||
    section === 'Investor Pipeline' ||
    section === 'Investor Contacts' ||
    section === 'Investor Messages';
  const staffRequestNotificationCount = staffNotifications.filter(
    (item) => item.targetSection === 'Investor Requests',
  ).length;
  const staffMessageNotificationCount = staffNotifications.filter(
    (item) => item.targetSection === 'Investor Messages',
  ).length;
  const staffWalkthroughVideo = CELLAR_DRAWER_CONTENT['staff-guide'].video;

  const loadStaffNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('cellar_investor_profiles')
      .select('id, email, first_name, last_name, investor_category, profile_status, submitted_at')
      .in('profile_status', ['verification_pending', 'needs_more_info'])
      .order('submitted_at', { ascending: false })
      .limit(10);
    const messageResponse = await supabase.functions.invoke('cellar_list_staff_messages', { body: {} });

    if (error && messageResponse.error) {
      setStaffNotifications([]);
      setPrefetchedStaffMessageThreads([]);
      return;
    }
    const notificationThreads = messageResponse.error
      ? []
      : ((messageResponse.data?.cellar_message_threads ?? []) as StaffMessageThread[]);

    const requestNotifications = error ? [] : (data ?? []).map((request) => ({
      id: request.id,
      title: 'Investor access request',
      body: `${request.first_name} ${request.last_name} requested ${formatCellarLabel(request.investor_category)} access.`,
      meta: `${request.email} • ${formatCompactDate(request.submitted_at)}`,
      targetSection: 'Investor Requests',
    }));
    const messageNotifications = messageResponse.error
      ? []
      : (notificationThreads
          .filter((thread) => thread.status === 'waiting_on_staff')
          .map((thread) => {
            const latestInvestorMessage = [...(thread.messages ?? [])]
              .reverse()
              .find((message) => message.sender_kind === 'investor');
            const investor = thread.cellar_investor_access;
            const investorName = investor?.full_name || investor?.email || 'Investor';
            return {
              id: thread.id,
              title: 'Investor message',
              body: `${investorName} sent a message that needs a staff reply.`,
              meta: latestInvestorMessage
                ? `${formatCompactDateTime(latestInvestorMessage.sent_at)} • ${thread.subject}`
                : thread.subject,
              targetSection: 'Investor Messages' as StaffSection,
              targetId: thread.id,
            };
          }));

    setStaffNotifications([...messageNotifications, ...requestNotifications]);
    setPrefetchedStaffMessageThreads(notificationThreads);
  }, []);

  const loadStaffPipelineCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('cellar_investor_access')
      .select('id', { count: 'exact', head: true })
      .or('access_status.in.(verified,appendix_requested,appendix_granted,paused),pipeline_status.eq.guest_code_sent');

    if (error) {
      setStaffPipelineCount(0);
      return;
    }
    setStaffPipelineCount(count ?? 0);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const isEmbeddedBoh = isCellarEmbeddedBohMode();
    const activateStaffWorkspace = () => {
      setWorkspaceAccessStatus('ready');
      void loadStaffNotifications();
      void loadStaffPipelineCount();
    };

    const handleEmbeddedHandoff = async (event: MessageEvent) => {
      if (!isEmbeddedBoh || !CELLAR_BOH_EMBED_PARENT_ORIGINS.includes(event.origin)) {
        return;
      }

      const payload = event.data as {
        type?: string;
        email?: string;
        token_hash?: string;
        tokenHash?: string;
      };
      if (payload?.type !== CELLAR_BOH_EMBED_HANDOFF_MESSAGE) {
        return;
      }

      const email = String(payload.email ?? '').trim().toLowerCase();
      const tokenHash = String(payload.token_hash ?? payload.tokenHash ?? '').trim();
      if (!email || !tokenHash) {
        setEmbeddedStatusMessage('BOH sent an incomplete CELLAR staff handoff.');
        return;
      }

      setEmbeddedStatusMessage('Completing BOH staff handoff.');
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      if (error) {
        if (embeddedHandoffRetryCountRef.current < CELLAR_BOH_EMBED_HANDOFF_RETRY_LIMIT) {
          embeddedHandoffRetryCountRef.current += 1;
          setEmbeddedStatusMessage('The BOH staff handoff expired. Requesting a fresh handoff.');
          requestCellarBohEmbedHandoff();
        } else {
          setEmbeddedStatusMessage(error.message || 'The BOH staff handoff could not be verified.');
        }
        return;
      }

      const workspaceAccess = await getCellarWorkspaceAccess();
      if (isCancelled) return;
      if (workspaceAccess.canStaff) {
        embeddedHandoffRetryCountRef.current = 0;
        activateStaffWorkspace();
      } else {
        setEmbeddedStatusMessage('The BOH session was verified, but this user is not linked to CELLAR staff access.');
      }
    };

    if (isEmbeddedBoh) {
      window.addEventListener('message', handleEmbeddedHandoff);
    }

    void getCellarWorkspaceAccess().then((workspaceAccess) => {
      if (isCancelled) return;
      if (workspaceAccess.canStaff) {
        activateStaffWorkspace();
        return;
      }
      if (isEmbeddedBoh) {
        setEmbeddedStatusMessage('Waiting for BOH to hand off this verified staff session.');
        requestCellarBohEmbedHandoff();
        return;
      }
      onAccessDenied(workspaceAccess.canInvestor ? 'dashboard' : 'access');
    });

    return () => {
      isCancelled = true;
      if (isEmbeddedBoh) {
        window.removeEventListener('message', handleEmbeddedHandoff);
      }
    };
  }, [loadStaffNotifications, loadStaffPipelineCount, onAccessDenied]);

  useEffect(() => {
    if (workspaceAccessStatus !== 'ready') return undefined;
    const intervalId = window.setInterval(() => {
      void loadStaffNotifications();
      void loadStaffPipelineCount();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadStaffNotifications, loadStaffPipelineCount, workspaceAccessStatus]);

  if (workspaceAccessStatus === 'checking') {
    return (
      <main className={`staff-app ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}>
        <section className="staff-main">
          <StaffEmptyState title="Checking staff access" body={embeddedStatusMessage} />
        </section>
      </main>
    );
  }

  const renderStaffNavButton = (item: { label: StaffSection; icon: ComponentType<{ className?: string }> }) => {
    const Icon = item.icon;
    return (
      <button
        key={item.label}
        type="button"
        className={section === item.label ? 'is-selected' : ''}
        onClick={() => setSection(item.label)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {!isSidebarCollapsed && <span>{item.label}</span>}
      </button>
    );
  };

  return (
    <main
      className={`staff-app ${themeMode === 'light' ? 'is-light' : 'is-dark'} ${
        isSidebarCollapsed ? 'is-sidebar-collapsed' : ''
      }`}
    >
      <aside className="staff-sidebar">
        <div className="staff-sidebar-header">
          <button
            type="button"
            className="staff-logo-lockup"
            onClick={() => setSection('Dashboard')}
            aria-label="Go to staff dashboard"
          >
            <CellarMark className="investor-logo-mark" />
            {!isSidebarCollapsed && <p>CELLAR</p>}
          </button>
        </div>
        <div className="staff-sidebar-context-row">
          {!isSidebarCollapsed && (
          <button
            type="button"
            className="staff-sidebar-context"
            onClick={onOpenInvestorView}
          >
            Investor view
          </button>
          )}
          <button
            type="button"
            className="investor-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {!isSidebarCollapsed && <div className="investor-sidebar-rule" />}

        <nav className="staff-nav" aria-label="Staff workspace">
          <button
            type="button"
            className={isSidebarCollapsed && isInvestorSection ? 'is-selected' : ''}
            onClick={() => setSection('Investor Requests')}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            {!isSidebarCollapsed && <span>Investors</span>}
          </button>
          {!isSidebarCollapsed && (
            <div className="staff-nav-subitems" aria-label="Investor workspace sections">
              <button
                type="button"
                className={section === 'Investor Requests' ? 'is-selected' : ''}
                onClick={() => setSection('Investor Requests')}
              >
                Requests
                {Boolean(staffRequestNotificationCount) && (
                  <small className="staff-nav-count">{staffRequestNotificationCount}</small>
                )}
              </button>
              <button
                type="button"
                className={section === 'Investor Pipeline' ? 'is-selected' : ''}
                onClick={() => setSection('Investor Pipeline')}
              >
                Pipeline
                {Boolean(staffPipelineCount) && (
                  <small className="staff-nav-count">{staffPipelineCount}</small>
                )}
              </button>
              <button
                type="button"
                className={section === 'Investor Contacts' ? 'is-selected' : ''}
                onClick={() => {
                  setFocusedInvestorContactId(null);
                  setContactDirectoryResetKey((key) => key + 1);
                  setSection('Investor Contacts');
                }}
              >
                Contacts
              </button>
              <button
                type="button"
                className={section === 'Investor Messages' ? 'is-selected' : ''}
                onClick={() => setSection('Investor Messages')}
              >
                Messages
                {Boolean(staffMessageNotificationCount) && (
                  <small className="staff-nav-count">{staffMessageNotificationCount}</small>
                )}
              </button>
            </div>
          )}
          {staffNavItems.map(renderStaffNavButton)}
        </nav>

        <nav className="staff-nav staff-nav-utility" aria-label="Staff utilities">
          {!isSidebarCollapsed && <p>Tools</p>}
          {staffUtilityNavItems.map(renderStaffNavButton)}
          {staffSuperAdminNavItems.map(renderStaffNavButton)}
        </nav>

        <footer className="staff-sidebar-footer">
          {!isSidebarCollapsed && (
            <div>
              <span>Staff workspace</span>
              <p>CELLAR by JOBZ CAFE&reg;</p>
              <button
                type="button"
                className="staff-sidebar-guide"
                onClick={() => setLegalDrawerKind('staff-guide')}
              >
                Guide
              </button>
            </div>
          )}
        </footer>
      </aside>

      <section className="staff-main">
        <StaffTopBar
          section={section}
          themeMode={themeMode}
          onToggleTheme={() =>
            setThemeMode((mode) => {
              const nextMode = getNextCellarThemeMode(mode);
              setStoredCellarThemeMode(nextMode);
              return nextMode;
            })
          }
          notificationCount={staffNotifications.length}
          onOpenNotifications={() => {
            void loadStaffNotifications();
            setIsNotificationsDrawerOpen(true);
          }}
        />
        {section === 'Dashboard' && (
          <StaffDashboard
            onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
            onOpenMessages={() => setSection('Investor Messages')}
            onOpenRequests={() => setSection('Investor Requests')}
          />
        )}
        {section === 'Investor Requests' && (
          <StaffInvestorRequests focusedRequestId={focusedInvestorRequestId} />
        )}
        {section === 'Investor Pipeline' && (
          <StaffInvestorPipelineScreen
            onOpenInvestor={(investorId) => {
              setFocusedInvestorContactId(investorId);
              setSection('Investor Contacts');
            }}
          />
        )}
        {section === 'Investor Contacts' && (
          <StaffInvestorContactsScreen
            focusedInvestorId={focusedInvestorContactId}
            directoryResetKey={contactDirectoryResetKey}
          />
        )}
        {section === 'Investor Messages' && (
          <StaffInvestorMessagesScreen
            focusedThreadId={focusedMessageThreadId}
            initialThreads={prefetchedStaffMessageThreads}
            onFocusedThreadHandled={() => setFocusedMessageThreadId(null)}
          />
        )}
        {section === 'Invites' && <StaffInvites />}
        {section === 'Access' && <StaffAccess />}
        {section === 'Presentations' && <StaffAssets />}
        {section === 'Q&A' && <StaffQA />}
        {section === 'Team' && <StaffTeam />}
        {isWalkthroughOpen && staffWalkthroughVideo && (
          <div
            className={`fullscreen-slide-backdrop legal-video-backdrop ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}
            role="dialog"
            aria-modal="true"
          >
            <section className="fullscreen-slide-modal legal-video-modal">
              <header>
                <div>
                  <span>Walkthrough</span>
                  <h2>{staffWalkthroughVideo.title}</h2>
                </div>
                <button type="button" onClick={() => setIsWalkthroughOpen(false)} aria-label="Close walkthrough">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </header>
              <div className="legal-video-stage">
                <CellarWalkthroughVideo video={staffWalkthroughVideo} isExpanded autoPlay />
              </div>
            </section>
          </div>
        )}
      </section>
      <NotificationsDrawer
        isOpen={isNotificationsDrawerOpen}
        onClose={() => setIsNotificationsDrawerOpen(false)}
        audience="staff"
        items={staffNotifications}
        themeMode={themeMode}
        onSelectItem={(item) => {
          if (item.targetSection) {
            setSection(item.targetSection);
          }
          if (item.targetSection === 'Investor Requests') {
            setFocusedInvestorRequestId(item.id);
          }
          if (item.targetSection === 'Investor Messages') {
            setFocusedMessageThreadId(item.targetId ?? item.id);
          }
          setIsNotificationsDrawerOpen(false);
        }}
      />
      <LegalInfoDrawer
        appName="CELLAR"
        kind={legalDrawerKind}
        themeMode={themeMode}
        onClose={() => setLegalDrawerKind(null)}
      />
    </main>
  );
}

function StaffTopBar({
  section,
  themeMode,
  notificationCount,
  onToggleTheme,
  onOpenNotifications,
}: {
  section: StaffSection;
  themeMode: ThemeMode;
  notificationCount?: number;
  onToggleTheme: () => void;
  onOpenNotifications: () => void;
}) {
  return (
    <header className="staff-topbar">
      <div>
        <p>Internal workspace</p>
        <h1>{section}</h1>
      </div>
      <div className="staff-topbar-actions">
        <button
          type="button"
          className="staff-theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme`}
        >
          {themeMode === 'dark' ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <button type="button" onClick={onOpenNotifications} aria-label="Notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {Boolean(notificationCount) && <span>{notificationCount}</span>}
        </button>
        <button
          type="button"
          className="staff-sign-out-button"
          onClick={signOutToAccessScreen}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function StaffEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="staff-empty-state">
      <p>{title}</p>
      <span>{body}</span>
    </div>
  );
}

function formatVisibility(value: string) {
  const labels: Record<string, string> = {
    guest: 'Guest + verified',
    verified: 'Verified only',
    appendix_granted: 'Appendix granted',
    staff_only: 'Staff only',
  };
  return labels[value] ?? value;
}

function formatAssetStatus(value: string) {
  const labels: Record<string, string> = {
    draft: 'Draft',
    needs_review: 'Needs review',
    published: 'Published',
    archived: 'Archived',
  };
  return labels[value] ?? value;
}

function isCellarPresentationAsset(asset: Pick<StaffAsset, 'asset_type' | 'mime_type' | 'storage_path'>) {
  return asset.asset_type === 'deck' || asset.mime_type === 'application/pdf' || asset.storage_path?.toLowerCase().endsWith('.pdf');
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function getStaffAuthState(): Promise<StaffAuthState> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session) {
    return {
      status: 'signed_out',
      email: '',
      bohUserId: null,
      message: 'This browser does not currently have a valid Supabase staff session.',
    };
  }

  const email = session.user.email ?? '';
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      status: 'stale',
      email,
      bohUserId: null,
      message: 'Your cached staff session is stale. Sign out and reconnect your JOBZ CAFE® staff email before changing guest codes.',
    };
  }

  const { data, error } = await supabase
    .from('boh_user')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();

  if (error || !data?.id) {
    return {
      status: 'unmapped',
      email,
      bohUserId: null,
      message: 'This Supabase Auth user is not linked to a BOH staff record yet.',
    };
  }

  return {
    status: 'ready',
    email,
    bohUserId: String(data.id),
    message: 'Staff session ready.',
  };
}

async function loadBohStaffUsers(): Promise<{ data: StaffTeamRecord[]; error: unknown | null }> {
  const { data: bohUsers, error } = await supabase
    .from('boh_user')
    .select('id, email, name:display_name')
    .ilike('email', '%@jobzcafe.com')
    .order('display_name', { ascending: true });

  if (error) {
    return { data: [], error };
  }

  return {
    data: ((bohUsers ?? []) as Array<{ id: string | number; email: string | null; name: string | null }>)
      .map((user) => ({
        id: String(user.id),
        email: user.email,
        name: user.name?.trim() ?? '',
      })),
    error: null,
  };
}

function CellarSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: CellarSelectOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? 'Select';

  return (
    <div className="cellar-select-field">
      <span>{label}</span>
      <div className="cellar-select" onBlur={() => setIsOpen(false)}>
        <button
          type="button"
          className="cellar-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          disabled={!options.length}
        >
          <span>{selectedLabel}</span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
        {isOpen && (
          <div className="cellar-select-menu" role="listbox">
            {options.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? 'is-selected' : ''}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StaffAuthPanel({
  onReady,
  body = 'Uploads use the standard JOBZ CAFE® Supabase Auth session and BOH staff mapping.',
}: {
  onReady: (state: StaffAuthState) => void;
  body?: string;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'info' | 'error' | 'success'>('info');

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setTone('error');
      setMessage('Enter your staff email before requesting a verification code.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false },
    });

    if (error) {
      setTone('error');
      setMessage(error.message || 'Unable to send the verification code.');
    } else {
      setTone('success');
      setMessage(`Verification code sent to ${normalizedEmail}. If it is not in your inbox, please check Junk or Spam.`);
      setStep('code');
    }
    setIsSubmitting(false);
  };

  const confirmCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    if (!normalizedEmail || !cleanCode) {
      setTone('error');
      setMessage('Enter the staff email and verification code.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanCode,
      type: 'email',
    });

    if (error) {
      setTone('error');
      setMessage(error.message || 'The verification code could not be confirmed.');
      setIsSubmitting(false);
      return;
    }

    const nextState = await getStaffAuthState();
    onReady(nextState);
    if (nextState.status === 'ready') {
      setTone('success');
      setMessage('Staff session connected. You can upload now.');
    } else {
      setTone('error');
      setMessage(nextState.message);
    }
    setIsSubmitting(false);
  };

  return (
    <section className="staff-auth-panel" aria-label="Staff sign in">
      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      <div>
        <h3>Connect staff session</h3>
        <p>{body}</p>
      </div>
      {step === 'email' ? (
        <div className="staff-auth-form">
          <label>
            <span>Staff email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@jobzcafe.com"
              autoComplete="email"
              spellCheck={false}
              aria-required="true"
            />
          </label>
          <button type="button" onClick={sendCode} disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send verification code'}
          </button>
        </div>
      ) : (
        <div className="staff-auth-form">
          <label>
            <span>Verification code</span>
            <input
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="6-digit code"
              autoComplete="one-time-code"
              spellCheck={false}
              aria-required="true"
            />
          </label>
          <button type="button" onClick={confirmCode} disabled={isSubmitting}>
            {isSubmitting ? 'Checking...' : 'Confirm staff session'}
          </button>
          <button type="button" onClick={() => setStep('email')}>
            Use another email
          </button>
        </div>
      )}
      {message && <p className={`staff-upload-status is-${tone}`}>{message}</p>}
    </section>
  );
}

function StaffDashboard({
  onOpenWalkthrough,
  onOpenMessages,
  onOpenRequests,
}: {
  onOpenWalkthrough: () => void;
  onOpenMessages: () => void;
  onOpenRequests: () => void;
}) {
  const [threads, setThreads] = useState<StaffMessageThread[]>([]);
  const [requests, setRequests] = useState<CellarInvestorRequest[]>([]);
  const [verifiedInvestorCount, setVerifiedInvestorCount] = useState(0);
  const [verificationRequestCount, setVerificationRequestCount] = useState(0);
  const [approvedVerificationCount, setApprovedVerificationCount] = useState(0);
  const [inviteSentCount, setInviteSentCount] = useState(0);
  const [inviteConvertedCount, setInviteConvertedCount] = useState(0);
  const [status, setStatus] = useState('Loading staff summary.');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');
  const [isLoading, setIsLoading] = useState(true);
  const waitingThreads = threads.filter((thread) => thread.status === 'waiting_on_staff');
  const actionItemCount = waitingThreads.length + requests.length;
  const visibleActionItemCount = actionItemCount + 1;
  const metrics = [
    [
      'Verified investors',
      String(verifiedInvestorCount),
      verifiedInvestorCount ? 'Approved investor contacts' : 'Waiting for verified access records',
    ],
    [
      'Verification approvals',
      verificationRequestCount ? `${approvedVerificationCount}/${verificationRequestCount}` : '0/0',
      verificationRequestCount ? 'Approved from submitted requests' : 'No verification requests yet',
    ],
    [
      'Invite conversion',
      inviteSentCount ? `${inviteConvertedCount}/${inviteSentCount}` : '0/0',
      inviteSentCount ? `${inviteSentCount} invites sent` : 'No invites sent yet',
    ],
    [
      'Action items',
      String(visibleActionItemCount),
      actionItemCount ? 'Walkthrough plus open staff review items' : 'Staff walkthrough ready',
    ],
  ];

  const loadStaffSummary = useCallback(async () => {
    setIsLoading(true);
    setTone('info');
    setStatus('Loading staff summary.');
    const [
      messageResponse,
      requestResponse,
      investorResponse,
      verificationRequestResponse,
      approvedVerificationResponse,
      inviteSentResponse,
      inviteConvertedResponse,
    ] = await Promise.all([
      supabase.functions.invoke('cellar_list_staff_messages', { body: {} }),
      supabase
        .from('cellar_investor_profiles')
        .select('id, investor_access_id, email, first_name, last_name, investor_category, title, company, profile_status, submitted_at')
        .in('profile_status', ['verification_pending', 'needs_more_info'])
        .order('submitted_at', { ascending: false })
        .limit(8),
      supabase
        .from('cellar_investor_access')
        .select('id', { count: 'exact', head: true })
        .in('access_status', ['verified', 'appendix_requested', 'appendix_granted', 'paused']),
      supabase
        .from('cellar_investor_profiles')
        .select('id', { count: 'exact', head: true })
        .neq('profile_status', 'archived'),
      supabase
        .from('cellar_investor_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('profile_status', 'verified'),
      supabase
        .from('cellar_investor_access')
        .select('id', { count: 'exact', head: true })
        .or('guest_code_sent_at.not.is.null,pipeline_status.eq.guest_code_sent'),
      supabase
        .from('cellar_investor_access')
        .select('id', { count: 'exact', head: true })
        .not('guest_code_sent_at', 'is', null)
        .in('access_status', ['verified', 'appendix_requested', 'appendix_granted', 'paused']),
    ]);

    if (messageResponse.error && requestResponse.error) {
      setThreads([]);
      setRequests([]);
      setVerifiedInvestorCount(0);
      setVerificationRequestCount(0);
      setApprovedVerificationCount(0);
      setInviteSentCount(0);
      setInviteConvertedCount(0);
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(messageResponse.error, 'Unable to load staff summary.'));
      setIsLoading(false);
      return;
    }

    const nextThreads = messageResponse.error
      ? []
      : ((messageResponse.data?.cellar_message_threads ?? []) as StaffMessageThread[]);
    const nextRequests = requestResponse.error ? [] : ((requestResponse.data ?? []) as CellarInvestorRequest[]);
    setThreads(nextThreads);
    setRequests(nextRequests);
    setVerifiedInvestorCount(investorResponse.error ? 0 : investorResponse.count ?? 0);
    setVerificationRequestCount(verificationRequestResponse.error ? 0 : verificationRequestResponse.count ?? 0);
    setApprovedVerificationCount(approvedVerificationResponse.error ? 0 : approvedVerificationResponse.count ?? 0);
    setInviteSentCount(inviteSentResponse.error ? 0 : inviteSentResponse.count ?? 0);
    setInviteConvertedCount(inviteConvertedResponse.error ? 0 : inviteConvertedResponse.count ?? 0);
    const partialLoadFailures = [
      messageResponse.error ? 'messages' : '',
      requestResponse.error ? 'verification requests' : '',
      investorResponse.error ? 'verified investor count' : '',
      verificationRequestResponse.error ? 'request count' : '',
      approvedVerificationResponse.error ? 'approved request count' : '',
      inviteSentResponse.error ? 'invite sent count' : '',
      inviteConvertedResponse.error ? 'invite conversion count' : '',
    ].filter(Boolean);
    setStatus(
      partialLoadFailures.length
        ? `Some action items could not be loaded (${partialLoadFailures.join(', ')}). Showing the reachable queue items.`
        : '',
    );
    setTone('info');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadStaffSummary();
  }, [loadStaffSummary]);

  const getInvestorLabel = (thread: StaffMessageThread) =>
    thread.cellar_investor_access?.full_name ||
    thread.cellar_investor_access?.company ||
    thread.cellar_investor_access?.email ||
    'Verified investor';

  return (
    <section className="staff-dashboard">
      <div className="staff-metric-grid">
        {metrics.map(([label, value, detail]) => (
          <article className="staff-metric-card" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{detail}</span>
          </article>
        ))}
      </div>

      <div className="staff-dashboard-grid staff-dashboard-task-grid">
        <section className="staff-panel staff-action-items-panel">
          <div className="staff-panel-heading">
            <div>
              <p>Investor operations</p>
              <h2>Action items</h2>
            </div>
            <button type="button" onClick={loadStaffSummary} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {isLoading && <StaffEmptyState title="Loading action items" body="Checking investor requests and message activity." />}
          {!isLoading && tone !== 'error' && (
            <div className="staff-pipeline-cards">
              <button type="button" className="staff-message-thread-card" onClick={onOpenWalkthrough}>
                <div>
                  <span>Guide</span>
                  <span>Walkthrough</span>
                </div>
                <strong>Watch staff walkthrough</strong>
                <p>Review the staff workflow for invites, contacts, messages, and investor follow-up.</p>
              </button>
              {requests.map((request) => (
                <button
                  type="button"
                  className="staff-message-thread-card"
                  key={request.id}
                  onClick={onOpenRequests}
                >
                  <div>
                    <span>{formatCellarLabel(request.profile_status)}</span>
                    <span>{formatCompactDate(request.submitted_at)}</span>
                  </div>
                  <strong>{`${request.first_name} ${request.last_name}`.trim() || request.email}</strong>
                  <p>{`${request.email} requested ${formatCellarLabel(request.investor_category)} access.`}</p>
                </button>
              ))}
              {waitingThreads.slice(0, 4).map((thread) => {
                const latestMessage = thread.messages.at(-1);
                return (
                  <button
                    type="button"
                    className="staff-message-thread-card"
                    key={thread.id}
                    onClick={onOpenMessages}
                  >
                    <div>
                      <span>{formatCellarLabel(thread.status)}</span>
                      <span>{formatCompactDate(thread.last_message_at ?? thread.created_at)}</span>
                    </div>
                    <strong>{getInvestorLabel(thread)}</strong>
                    <p>{latestMessage?.body ?? thread.subject}</p>
                  </button>
                );
              })}
            </div>
          )}
          {!isLoading && tone === 'error' && (
            <StaffEmptyState
              title="Unable to load action items"
              body="Refresh the staff summary to check investor requests and message activity again."
            />
          )}
          {status && <p className={`staff-upload-status is-${tone}`}>{status}</p>}
        </section>
      </div>
    </section>
  );
}

function StaffInvestorMessagesScreen({
  focusedThreadId,
  initialThreads = [],
  onFocusedThreadHandled,
}: {
  focusedThreadId?: string | null;
  initialThreads?: StaffMessageThread[];
  onFocusedThreadHandled?: () => void;
}) {
  const [threads, setThreads] = useState<StaffMessageThread[]>(initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Loading staff message queue.');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');
  const [isLoading, setIsLoading] = useState(initialThreads.length === 0);
  const [isSending, setIsSending] = useState(false);
  const staffMessageStreamRef = useRef<HTMLDivElement | null>(null);
  const staffMessageBottomRef = useRef<HTMLDivElement | null>(null);
  const [teamMembers, setTeamMembers] = useState<StaffTeamRecord[]>([]);
  const [currentStaffBadge, setCurrentStaffBadge] = useState('ST');
  const getInvestorLabel = (thread: StaffMessageThread) =>
    thread.cellar_investor_access?.full_name ||
    thread.cellar_investor_access?.company ||
    thread.cellar_investor_access?.email ||
    'Verified investor';
  const getThreadTimestamp = (thread: InvestorMessageThread | StaffMessageThread) =>
    Date.parse(thread.last_message_at ?? thread.messages.at(-1)?.sent_at ?? '') ||
    Date.parse((thread as StaffMessageThread).created_at ?? '') ||
    0;
  const staffMessageContacts = useMemo(() => {
    const grouped = new Map<string, {
      id: string;
      label: string;
      email: string;
      latestThread: StaffMessageThread;
      threads: StaffMessageThread[];
      lastTimestamp: number;
    }>();

    threads.forEach((thread) => {
      const id = thread.investor_access_id;
      const currentTimestamp = getThreadTimestamp(thread);
      const currentGroup = grouped.get(id);
      if (!currentGroup) {
        grouped.set(id, {
          id,
          label: getInvestorLabel(thread),
          email: thread.cellar_investor_access?.email ?? '',
          latestThread: thread,
          threads: [thread],
          lastTimestamp: currentTimestamp,
        });
        return;
      }
      currentGroup.threads.push(thread);
      if (currentTimestamp > currentGroup.lastTimestamp) {
        currentGroup.latestThread = thread;
        currentGroup.lastTimestamp = currentTimestamp;
      }
    });

    return [...grouped.values()].sort((left, right) => right.lastTimestamp - left.lastTimestamp);
  }, [threads]);
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;
  const selectedContactThreads = selectedThread
    ? staffMessageContacts.find((contact) => contact.id === selectedThread.investor_access_id)?.threads
      .slice()
      .sort((left, right) => getThreadTimestamp(right) - getThreadTimestamp(left)) ?? []
    : [];
  const hasLoadError = tone === 'error' && !isLoading;
  const selectedThreadLastMessageId = selectedThread?.messages.at(-1)?.id ?? null;

  const loadStaffMessages = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setTone('info');
    if (showLoading) {
      setStatus('Loading staff message queue.');
    }
    const { data, error } = await supabase.functions.invoke('cellar_list_staff_messages', {
      body: {},
    });

    if (error) {
      setThreads([]);
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(error, 'Unable to load staff messages.'));
      setIsLoading(false);
      return;
    }

    const nextThreads = (data?.cellar_message_threads ?? []) as StaffMessageThread[];
    const teamResponse = await loadBohStaffUsers();
    setThreads(nextThreads);
    setTeamMembers(teamResponse.data);
    setSelectedThreadId((currentThreadId) =>
      focusedThreadId && nextThreads.some((thread) => thread.id === focusedThreadId)
        ? focusedThreadId
        : currentThreadId && nextThreads.some((thread) => thread.id === currentThreadId)
          ? currentThreadId
        : nextThreads[0]?.id ?? null,
    );
    if (focusedThreadId && nextThreads.some((thread) => thread.id === focusedThreadId)) {
      onFocusedThreadHandled?.();
    }
    setStatus(nextThreads.length ? '' : 'No CELLAR messages are waiting yet.');
    setTone('info');
    setIsLoading(false);
  }, [focusedThreadId, onFocusedThreadHandled]);

  useEffect(() => {
    if (initialThreads.length > 0) {
      setThreads(initialThreads);
      setSelectedThreadId((currentThreadId) =>
        focusedThreadId && initialThreads.some((thread) => thread.id === focusedThreadId)
          ? focusedThreadId
          : currentThreadId && initialThreads.some((thread) => thread.id === currentThreadId)
            ? currentThreadId
            : initialThreads[0]?.id ?? null,
      );
      if (focusedThreadId && initialThreads.some((thread) => thread.id === focusedThreadId)) {
        onFocusedThreadHandled?.();
      }
      setIsLoading(false);
      void loadStaffMessages(false);
      return;
    }
    void loadStaffMessages(true);
  }, [focusedThreadId, initialThreads, loadStaffMessages, onFocusedThreadHandled]);

  useEffect(() => {
    let isCancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (isCancelled) return;
      const email = data.user?.email ?? '';
      const emailPrefix = email.split('@')[0]?.replace(/[^a-z0-9]/gi, '') ?? '';
      setCurrentStaffBadge(emailPrefix.length >= 3 ? emailPrefix.slice(0, 3).toUpperCase() : getCellarInitials(email || 'Staff'));
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const stream = staffMessageStreamRef.current;
    if (!stream || isLoading) return;
    const scrollToLatestMessage = () => {
      stream.scrollTop = stream.scrollHeight;
      staffMessageBottomRef.current?.scrollIntoView({ block: 'end' });
    };
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToLatestMessage();
      });
    });
    const timeoutId = window.setTimeout(() => {
      scrollToLatestMessage();
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading, selectedThreadId, selectedThreadLastMessageId]);

  const sendStaffReply = async (event: FormEvent) => {
    event.preventDefault();
    const cleanDraft = draft.trim();
    if (!selectedThread || !cleanDraft) return;

    setIsSending(true);
    setTone('info');
    setStatus('Sending staff reply.');
    const { error } = await supabase.functions.invoke('cellar_send_staff_message', {
      body: {
        cellar_thread_id: selectedThread.id,
        cellar_body: cleanDraft,
      },
    });

    if (error) {
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(error, 'Unable to send this staff reply.'));
      setIsSending(false);
      return;
    }

    setDraft('');
    setTone('success');
    setStatus('Reply sent to the investor.');
    setIsSending(false);
    await loadStaffMessages();
  };

  const getMessageSenderBadge = (message: InvestorMessage, thread: StaffMessageThread) => {
    if (message.sender_kind !== 'staff') return getCellarInitials(getInvestorLabel(thread));
    const staff = teamMembers.find((member) => member.id === message.sender_boh_user_id);
    return staff ? getCellarStaffBadge(staff) : currentStaffBadge;
  };
  const selectedInvestor = selectedThread?.cellar_investor_access ?? null;

  return (
    <>
      <section className="staff-dashboard staff-message-screen">
        <div className="staff-dashboard-grid staff-message-content-grid">
          <section className="staff-panel staff-message-inbox">
            <div className="staff-panel-heading">
              <div>
                <p>Investor messages</p>
                <h2>Messages</h2>
              </div>
              <button type="button" onClick={loadStaffMessages} disabled={isLoading}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {isLoading && <StaffEmptyState title="Loading messages" body="Checking CELLAR messages." />}
            {!isLoading && !hasLoadError && !threads.length && (
              <StaffEmptyState
                title="No messages yet"
                body="Investor messages will appear here after a verified investor starts a CELLAR message."
              />
            )}
            {!isLoading && !hasLoadError && threads.length > 0 && (
              <div className="staff-message-workspace">
                <div className="staff-message-thread-list" aria-label="Staff message contacts">
                  {staffMessageContacts.map((contact) => (
                    <button
                      type="button"
                      className={`staff-message-thread-card ${selectedThread?.investor_access_id === contact.id ? 'is-selected' : ''}`}
                      key={contact.id}
                      onClick={() => setSelectedThreadId(contact.latestThread.id)}
                    >
                      <div className="staff-message-card-meta">
                        <span>{contact.threads.length} message group{contact.threads.length === 1 ? '' : 's'}</span>
                        <span>{formatCompactDateTime(contact.latestThread.last_message_at ?? contact.latestThread.created_at)}</span>
                      </div>
                      <strong>{contact.label}</strong>
                      {contact.email && <p>{contact.email}</p>}
                    </button>
                  ))}
                </div>

                {selectedThread && (
                  <section className="staff-message-detail" aria-label="Selected message">
                    <div className="staff-message-detail-header">
                      <div>
                        <p>Contact</p>
                        <h3>{getInvestorLabel(selectedThread)}</h3>
                        <span>
                          {[selectedInvestor?.title, selectedInvestor?.company, selectedInvestor?.email]
                            .filter(Boolean)
                            .join(' Â· ') || 'Cellar investor'}
                        </span>
                      </div>
                      <strong>{formatCellarLabel(selectedThread.status)}</strong>
                    </div>
                    {selectedContactThreads.length > 1 && (
                      <div className="staff-message-thread-tabs" aria-label="Message groups for this contact">
                        {selectedContactThreads.map((thread) => (
                          <button
                            type="button"
                            className={selectedThread.id === thread.id ? 'is-selected' : ''}
                            key={thread.id}
                            onClick={() => setSelectedThreadId(thread.id)}
                            title={`${thread.subject} - ${formatCompactDateTime(thread.last_message_at ?? thread.created_at)}`}
                          >
                            <span>{thread.subject}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="message-stream" ref={staffMessageStreamRef}>
                      {selectedThread.messages.map((message) => (
                        <article
                          className={`message-bubble ${message.sender_kind === 'staff' ? 'is-user' : ''}`}
                          key={message.id}
                        >
                          <strong>{getMessageSenderBadge(message, selectedThread)}</strong>
                          <p>{message.body}</p>
                        </article>
                      ))}
                      <div className="message-stream-anchor" ref={staffMessageBottomRef} aria-hidden="true" />
                    </div>
                    <form className="message-composer" onSubmit={sendStaffReply}>
                      <label htmlFor="staff-message-reply">Reply</label>
                      <textarea
                        id="staff-message-reply"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Write a private Cellar reply..."
                        spellCheck
                      />
                      <button type="submit" disabled={isSending || !draft.trim()}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {isSending ? 'Sending...' : 'Send'}
                      </button>
                    </form>
                  </section>
                )}
              </div>
            )}
            {status && <p className={`staff-upload-status is-${tone}`}>{status}</p>}
          </section>
        </div>
      </section>
    </>
  );
}

async function getCellarWorkspaceAccess(): Promise<CellarWorkspaceAccessState> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return {
      mode: 'anonymous',
      canStaff: false,
      canInvestor: false,
      authUserId: null,
      bohUserId: null,
      investorAccessId: null,
      accessStatus: null,
      email: null,
      firstName: null,
      lastName: null,
      fullName: null,
      title: null,
      company: null,
      phone: null,
      verifiedAt: null,
    };
  }

  const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_resolve_workspace_access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });
  const result = await response.json().catch(() => ({}));
  const access = result?.cellar_workspace_access ?? {};

  if (!response.ok) {
    return {
      mode: 'anonymous',
      canStaff: false,
      canInvestor: false,
      authUserId: null,
      bohUserId: null,
      investorAccessId: null,
      accessStatus: null,
      email: null,
      firstName: null,
      lastName: null,
      fullName: null,
      title: null,
      company: null,
      phone: null,
      verifiedAt: null,
    };
  }

  return {
    mode: access.mode === 'staff' || access.mode === 'investor' || access.mode === 'unverified'
      ? access.mode
      : 'anonymous',
    canStaff: access.can_staff === true,
    canInvestor: access.can_investor === true,
    authUserId: access.auth_user_id ?? null,
    bohUserId: access.boh_user_id ?? null,
    investorAccessId: access.investor_access_id ?? null,
    accessStatus: access.access_status ?? null,
    email: access.email ?? null,
    firstName: access.first_name ?? null,
    lastName: access.last_name ?? null,
    fullName: access.full_name ?? null,
    title: access.title ?? null,
    company: access.company ?? null,
    phone: access.phone ?? null,
    verifiedAt: access.verified_at ?? null,
  };
}

function StaffInvestorRequests({ focusedRequestId }: { focusedRequestId?: string | null }) {
  const [requests, setRequests] = useState<CellarInvestorRequest[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setStatus('');
    const { data, error } = await supabase
      .from('cellar_investor_profiles')
      .select('id, investor_access_id, email, first_name, last_name, investor_category, title, company, profile_status, submitted_at')
      .in('profile_status', ['verification_pending', 'needs_more_info'])
      .order('submitted_at', { ascending: false });

    if (error) {
      setRequests([]);
      setTone('error');
      setStatus(getFriendlyCellarError(error, 'Unable to load investor requests.'));
    } else {
      setRequests((data ?? []) as CellarInvestorRequest[]);
      setStatus('');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!focusedRequestId) return;
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-cellar-request-id="${focusedRequestId}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [focusedRequestId, requests]);

  const reviewRequest = async (request: CellarInvestorRequest, action: 'approve' | 'need_more_info' | 'decline') => {
    setTone('info');
    setStatus(`Updating ${request.first_name} ${request.last_name}.`);
    const { data, error } = await supabase.functions.invoke('cellar_review_investor_request', {
      body: {
        cellar_investor_profile_id: request.id,
        cellar_review_action: action,
      },
    });

    if (error) {
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(error, 'Unable to review this investor request.'));
      return;
    }

    const actionLabel = action === 'approve' ? 'approved' : action === 'need_more_info' ? 'marked for follow-up' : 'declined';
    setTone('success');
    setStatus(`${request.first_name} ${request.last_name} ${actionLabel}.`);
    if (data?.cellar_review) {
      await loadRequests();
    }
  };

  return (
    <section className="staff-panel staff-investor-requests is-full-height">
      <div className="staff-panel-heading">
        <div>
          <p>Investor approval inbox</p>
          <h2>New requests</h2>
        </div>
        <div className="staff-request-toolbar">
          <div className="staff-view-toggle" aria-label="Investor request view">
            <button
              type="button"
              className={viewMode === 'cards' ? 'is-selected' : ''}
              onClick={() => setViewMode('cards')}
              aria-label="Card view"
              data-tooltip="Card view"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'is-selected' : ''}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              data-tooltip="List view"
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={loadRequests}>
            Refresh
          </button>
        </div>
      </div>

      {isLoading && <StaffEmptyState title="Loading requests" body="Checking pending CELLAR investor requests." />}
      {!isLoading && tone === 'error' && status && (
        <StaffEmptyState
          title="Investor requests unavailable"
          body={status}
        />
      )}
      {!isLoading && tone !== 'error' && !requests.length && (
        <StaffEmptyState
          title="No investor requests"
          body="New investor access requests will appear here after a profile is submitted."
        />
      )}
      {!isLoading && tone !== 'error' && requests.length > 0 && (
        <div className={`staff-request-inbox is-${viewMode}`}>
          {requests.map((request) => (
            <article
              className={`staff-request-card ${focusedRequestId === request.id ? 'is-focused' : ''}`}
              data-cellar-request-id={request.id}
              key={request.id}
            >
              <div className="staff-request-main">
                <div>
                  <p>{formatCellarLabel(request.investor_category)}</p>
                  <h3>{request.first_name} {request.last_name}</h3>
                  <span>{request.email}</span>
                </div>
                <strong>{formatCellarLabel(request.profile_status)}</strong>
              </div>
              <div className="staff-request-meta">
                <span>{request.company || 'Company not supplied'}</span>
                <span>{request.title || 'Title not supplied'}</span>
                <span>Submitted {formatCompactDate(request.submitted_at)}</span>
              </div>
              <div className="staff-request-actions">
                <button type="button" onClick={() => void reviewRequest(request, 'approve')}>
                  Approve access
                </button>
                <button type="button" onClick={() => void reviewRequest(request, 'need_more_info')}>
                  Need more info
                </button>
                <button type="button" onClick={() => void reviewRequest(request, 'decline')}>
                  Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {status && tone !== 'error' && <p className={`staff-upload-status is-${tone}`}>{status}</p>}
    </section>
  );
}

const staffPipelineStages: Array<{ key: string; title: string }> = [
  { key: 'guest_code_sent', title: 'Invite sent' },
  { key: 'new_investor', title: 'New investor' },
  { key: 'reviewing_assets', title: 'Reviewing' },
  { key: 'briefing_booked', title: 'Briefing' },
  { key: 'diligence', title: 'Diligence' },
  { key: 'follow_up', title: 'Follow-up' },
  { key: 'committed', title: 'Committed' },
  { key: 'paused', title: 'Paused' },
];

function getStaffPipelineStageTitle(stageKey?: string | null) {
  return staffPipelineStages.find((stage) => stage.key === stageKey)?.title ?? formatCellarLabel(stageKey || 'new_investor');
}

function StaffInvestorPipelineScreen({ onOpenInvestor }: { onOpenInvestor: (investorId: string) => void }) {
  const [investors, setInvestors] = useState<CellarInvestorPipelineRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<StaffTeamRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [draggingInvestorId, setDraggingInvestorId] = useState<string | null>(null);
  const [dropTargetStageKey, setDropTargetStageKey] = useState<string | null>(null);
  const [updatingInvestorId, setUpdatingInvestorId] = useState<string | null>(null);
  const pipelineDragStartedRef = useRef(false);
  const [visibleStageKeys, setVisibleStageKeys] = useState(() => staffPipelineStages.map((stage) => stage.key));

  const loadInvestors = useCallback(async () => {
    setIsLoading(true);
    setStatus('');
    const [{ data, error }, teamResponse] = await Promise.all([
      supabase
        .from('cellar_investor_access')
        .select('id, email, full_name, company, title, access_status, pipeline_status, assigned_boh_user_id, verified_at, last_seen_at, created_at, metadata')
        .or('access_status.in.(verified,appendix_requested,appendix_granted,paused),pipeline_status.eq.guest_code_sent')
        .order('verified_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      loadBohStaffUsers(),
    ]);

    if (error) {
      setInvestors([]);
      setStatus(getFriendlyCellarError(error, 'Unable to load investor pipeline.'));
    } else {
      setInvestors((data ?? []) as CellarInvestorPipelineRecord[]);
    }
    setTeamMembers(teamResponse.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadInvestors();
  }, [loadInvestors]);

  const grouped = staffPipelineStages.map((stage) => ({
    ...stage,
    investors: investors.filter((investor) => (investor.pipeline_status || 'new_investor') === stage.key),
  }));
  const uncategorized = investors.filter(
    (investor) => !staffPipelineStages.some((stage) => stage.key === (investor.pipeline_status || 'new_investor')),
  );

  const visibleColumns = [
    ...grouped.filter((column) => visibleStageKeys.includes(column.key)),
    ...(uncategorized.length ? [{ key: 'other', title: 'Other', investors: uncategorized }] : []),
  ];

  const getPipelineOwnerLabel = (investor: CellarInvestorPipelineRecord) => {
    if (!investor.assigned_boh_user_id) return 'Unassigned';
    const owner = teamMembers.find((member) => member.id === investor.assigned_boh_user_id);
    return owner?.name || 'Name not set in BOH';
  };

  const canStaffMovePipelineCard = (investor: CellarInvestorPipelineRecord) =>
    investor.access_status !== 'guest';

  const moveInvestorToStage = async (investorId: string, nextStageKey: string) => {
    if (nextStageKey === 'other') return;
    const investor = investors.find((item) => item.id === investorId);
    if (!investor) return;
    if (!canStaffMovePipelineCard(investor)) {
      setStatus('Guest invites move after the investor requests access and staff approve them.');
      return;
    }
    const currentStageKey = investor.pipeline_status || 'new_investor';
    if (currentStageKey === nextStageKey) return;

    setUpdatingInvestorId(investorId);
    setStatus('');
    const staffAuth = await getStaffAuthState();
    if (staffAuth.status !== 'ready') {
      setStatus('Unable to move investor right now.');
      setUpdatingInvestorId(null);
      return;
    }

    setInvestors((current) =>
      current.map((item) => (item.id === investorId ? { ...item, pipeline_status: nextStageKey } : item)),
    );

    const { error } = await supabase
      .from('cellar_investor_access')
      .update({ pipeline_status: nextStageKey, updated_by_boh_user_id: staffAuth.bohUserId })
      .eq('id', investorId);

    if (error) {
      setInvestors((current) =>
        current.map((item) => (item.id === investorId ? { ...item, pipeline_status: currentStageKey } : item)),
      );
      setStatus(getFriendlyCellarError(error, 'Unable to move investor right now.'));
    } else {
      await supabase.from('cellar_activity_events').insert({
        investor_access_id: investorId,
        actor_kind: 'staff',
        actor_auth_user_id: staffAuth.authUserId,
        actor_boh_user_id: staffAuth.bohUserId,
        event_type: 'pipeline_stage_changed',
        metadata: {
          previous_stage: currentStageKey,
          next_stage: nextStageKey,
        },
      });
    }
    setUpdatingInvestorId(null);
  };

  return (
    <section className="staff-panel staff-investor-table is-full-height">
      <div className="staff-panel-heading">
        <div>
          <p>Investor pipeline</p>
          <h2>Investor pipeline</h2>
        </div>
        <button type="button" onClick={loadInvestors}>Refresh</button>
      </div>
      <div className="staff-pipeline-stage-toggle" aria-label="Pipeline columns">
        <span className="staff-pipeline-stage-toggle-label">Columns</span>
        <div>
          {grouped.map((column) => {
            const isVisible = visibleStageKeys.includes(column.key);
            return (
              <button
                type="button"
                aria-pressed={isVisible}
                className={isVisible ? 'is-selected' : ''}
                key={column.key}
                onClick={() => {
                  setVisibleStageKeys((current) => {
                    if (current.includes(column.key) && current.length > 1) {
                      return current.filter((key) => key !== column.key);
                    }
                    if (current.includes(column.key)) return current;
                    return [...current, column.key];
                  });
                }}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {column.title}
                <span>{column.investors.length}</span>
              </button>
            );
          })}
        </div>
      </div>
      {isLoading && <StaffEmptyState title="Loading pipeline" body="Checking CELLAR investor records." />}
      {!isLoading && !investors.length && (
        <StaffEmptyState
          title="No investors in pipeline"
          body="Guest invites and approved investors will appear here."
        />
      )}
      {!isLoading && investors.length > 0 && (
        <div className="staff-pipeline-board" style={{ '--pipeline-column-count': visibleColumns.length } as CSSProperties}>
          {visibleColumns.map((column) => (
            <section
              className={`staff-pipeline-column ${dropTargetStageKey === column.key ? 'is-drop-target' : ''}`}
              key={column.key}
              onDragEnter={(event) => {
                if (!draggingInvestorId || column.key === 'other') return;
                event.preventDefault();
                setDropTargetStageKey(column.key);
              }}
              onDragOver={(event) => {
                if (!draggingInvestorId || column.key === 'other') return;
                event.preventDefault();
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDropTargetStageKey(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const investorId = event.dataTransfer.getData('text/plain') || draggingInvestorId;
                setDropTargetStageKey(null);
                setDraggingInvestorId(null);
                if (investorId) {
                  void moveInvestorToStage(investorId, column.key);
                }
              }}
            >
              <div className="staff-pipeline-heading">
                <h3>{column.title}</h3>
                <span>{column.investors.length}</span>
              </div>
              <div className="staff-pipeline-cards">
                {column.investors.map((investor) => {
                  const canMoveCard = canStaffMovePipelineCard(investor);
                  const lockedGuestMoveMessage = 'Guest invites move automatically once the investor is verified.';
                  return (
                    <button
                      type="button"
                      className={`staff-pipeline-card ${draggingInvestorId === investor.id ? 'is-dragging' : ''} ${canMoveCard ? '' : 'is-locked'}`}
                      draggable={canMoveCard && updatingInvestorId !== investor.id}
                      key={investor.id}
                      aria-describedby={canMoveCard ? undefined : `pipeline-guest-hint-${investor.id}`}
                      onClick={() => {
                        if (pipelineDragStartedRef.current) return;
                        onOpenInvestor(investor.id);
                      }}
                      onDragStart={(event) => {
                        if (!canMoveCard) {
                          event.preventDefault();
                          return;
                        }
                        pipelineDragStartedRef.current = true;
                        setDraggingInvestorId(investor.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', investor.id);
                      }}
                      onDragEnd={() => {
                        setDraggingInvestorId(null);
                        setDropTargetStageKey(null);
                        window.setTimeout(() => {
                          pipelineDragStartedRef.current = false;
                        }, 0);
                      }}
                    >
                      <div className="staff-pipeline-card-topline">
                        <strong>{investor.full_name || investor.email}</strong>
                        <span>{getPipelineOwnerLabel(investor)}</span>
                      </div>
                      <span>{investor.company || investor.title || investor.email}</span>
                      <footer>
                        <small>
                          {investor.verified_at
                            ? `Approved ${formatCompactDate(investor.verified_at)}`
                            : `Invite sent ${formatCompactDate(investor.created_at)}`}
                        </small>
                        <p>{formatCellarLabel(investor.access_status)}</p>
                      </footer>
                      {!canMoveCard && (
                        <span className="staff-pipeline-card-tooltip" id={`pipeline-guest-hint-${investor.id}`}>
                          {lockedGuestMoveMessage}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {status && <p className="staff-upload-status is-error">{status}</p>}
    </section>
  );
}

function StaffInvestorContactsScreen({
  focusedInvestorId,
  directoryResetKey,
}: {
  focusedInvestorId?: string | null;
  directoryResetKey: number;
}) {
  const [investors, setInvestors] = useState<CellarInvestorPipelineRecord[]>([]);
  const [threads, setThreads] = useState<StaffMessageThread[]>([]);
  const [teamMembers, setTeamMembers] = useState<StaffTeamRecord[]>([]);
  const [contactNotes, setContactNotes] = useState<StaffContactNote[]>([]);
  const [activityEvents, setActivityEvents] = useState<StaffActivityEvent[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(focusedInvestorId ?? null);
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'messages' | 'notes'>('profile');
  const [editSection, setEditSection] = useState<StaffContactEditSection | null>(null);
  const [ownerDraft, setOwnerDraft] = useState('');
  const [contactMessageDraft, setContactMessageDraft] = useState('');
  const [contactNoteDraft, setContactNoteDraft] = useState('');
  const [selectedContactNoteId, setSelectedContactNoteId] = useState<string | null>(null);
  const [contactNotesError, setContactNotesError] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactDirectoryStatusFilter>('active');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [resendCandidateInvestorId, setResendCandidateInvestorId] = useState<string | null>(null);
  const [archiveCandidateInvestorId, setArchiveCandidateInvestorId] = useState<string | null>(null);
  const [resendInviteStatus, setResendInviteStatus] = useState('');
  const [resendInviteTone, setResendInviteTone] = useState<'info' | 'success' | 'error'>('info');
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSendingContactMessage, setIsSendingContactMessage] = useState(false);
  const [isSavingContactNote, setIsSavingContactNote] = useState(false);
  const [isResendingInvite, setIsResendingInvite] = useState(false);
  const [isArchivingContact, setIsArchivingContact] = useState(false);
  const [currentStaffBadge, setCurrentStaffBadge] = useState('ST');
  const [status, setStatus] = useState('Loading investor contacts.');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');
  const [isLoading, setIsLoading] = useState(true);
  const contactMessageStreamRef = useRef<HTMLDivElement | null>(null);
  const lastDirectoryResetKeyRef = useRef(directoryResetKey);

  const loadContacts = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent === true;
    if (!isSilent) {
      setIsLoading(true);
      setTone('info');
      setStatus('Loading investor contacts.');
    }
    const [{ data: investorData, error: investorError }, messageResponse, teamResponse, notesResponse, activityResponse] = await Promise.all([
      supabase
        .from('cellar_investor_access')
        .select('id, email, full_name, company, title, access_status, pipeline_status, assigned_boh_user_id, verified_at, last_seen_at, guest_code_sent_at, guest_code_sent_from_boh_user_id, guest_code_sent_by_boh_user_id, created_at, metadata')
        .or('access_status.in.(verified,appendix_requested,appendix_granted,paused),pipeline_status.eq.guest_code_sent')
        .order('verified_at', { ascending: false, nullsFirst: false }),
      supabase.functions.invoke('cellar_list_staff_messages', { body: {} }),
      loadBohStaffUsers(),
      supabase
        .from('cellar_staff_contact_notes')
        .select('id, investor_access_id, note_body, created_by_boh_user_id, updated_by_boh_user_id, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('cellar_activity_events')
        .select('id, investor_access_id, actor_kind, actor_boh_user_id, event_type, event_at, metadata')
        .order('event_at', { ascending: false }),
    ]);

    if (investorError) {
      setInvestors([]);
      setThreads([]);
      setTone('error');
      setStatus(getFriendlyCellarError(investorError, 'Unable to load investor contacts.'));
      setIsLoading(false);
      return;
    }

    const nextInvestors = (investorData ?? []) as CellarInvestorPipelineRecord[];
    const nextThreads = messageResponse.error
      ? []
      : ((messageResponse.data?.cellar_message_threads ?? []) as StaffMessageThread[]);

    setInvestors(nextInvestors);
    setThreads(nextThreads);
    setTeamMembers(teamResponse.data);
    setContactNotes(notesResponse.error ? [] : ((notesResponse.data ?? []) as StaffContactNote[]));
    setActivityEvents(activityResponse.error ? [] : ((activityResponse.data ?? []) as StaffActivityEvent[]));
    setContactNotesError(notesResponse.error ? 'Notes are not available right now.' : '');
    if (!isSilent) {
      setTone('info');
      setStatus(messageResponse.error ? 'Contacts loaded. Messages are not reachable yet.' : '');
      setIsLoading(false);
    }
  }, [focusedInvestorId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    let isCancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (isCancelled) return;
      const email = data.user?.email ?? '';
      const emailPrefix = email.split('@')[0]?.replace(/[^a-z0-9]/gi, '') ?? '';
      setCurrentStaffBadge(emailPrefix.length >= 3 ? emailPrefix.slice(0, 3).toUpperCase() : getCellarInitials(email || 'Staff'));
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (focusedInvestorId) {
      setSelectedInvestorId(focusedInvestorId);
      setActiveTab('profile');
      setEditSection(null);
    }
  }, [focusedInvestorId]);

  useEffect(() => {
    if (directoryResetKey === lastDirectoryResetKeyRef.current) {
      return;
    }
    lastDirectoryResetKeyRef.current = directoryResetKey;
    setSelectedInvestorId(null);
    setActiveTab('profile');
    setEditSection(null);
  }, [directoryResetKey]);

  const selectedInvestor = investors.find((investor) => investor.id === selectedInvestorId) ?? null;
  const resendCandidateInvestor = investors.find((investor) => investor.id === resendCandidateInvestorId) ?? null;
  const archiveCandidateInvestor = investors.find((investor) => investor.id === archiveCandidateInvestorId) ?? null;
  const selectedInvestorName = selectedInvestor?.full_name || selectedInvestor?.email || 'Contact';
  const selectedInvestorInviteSentAt = selectedInvestor?.guest_code_sent_at ?? selectedInvestor?.created_at ?? null;
  const canResendSelectedInvestorInvite =
    Boolean(selectedInvestor?.email) &&
    selectedInvestor?.access_status === 'guest' &&
    (selectedInvestor?.pipeline_status ?? '') === 'guest_code_sent';
  const canResendContactInvite = useCallback(
    (investor: CellarInvestorPipelineRecord) =>
      Boolean(investor.email) &&
      investor.access_status === 'guest' &&
      (investor.pipeline_status ?? '') === 'guest_code_sent',
    [],
  );
  const openResendInviteConfirmation = useCallback(
    (investor: CellarInvestorPipelineRecord) => {
      setResendInviteStatus('');
      setResendInviteTone('info');
      setResendCandidateInvestorId(investor.id);
    },
    [],
  );
  const openArchiveContactConfirmation = useCallback((investor: CellarInvestorPipelineRecord) => {
    setArchiveCandidateInvestorId(investor.id);
  }, []);
  const investorThreads = selectedInvestor
    ? threads.filter((thread) => thread.investor_access_id === selectedInvestor.id)
    : [];
  const selectedContactMessageThread = useMemo(
    () =>
      [...investorThreads].sort(
        (left, right) =>
          getCellarActivitySortTime(right.last_message_at ?? right.created_at) -
          getCellarActivitySortTime(left.last_message_at ?? left.created_at),
      )[0] ?? null,
    [investorThreads],
  );
  const selectedInvestorThreadCount = investorThreads.length;
  const selectedInvestorMessageCount = useMemo(
    () => investorThreads.reduce((count, thread) => count + (thread.messages?.length ?? 0), 0),
    [investorThreads],
  );
  const selectedInvestorNotes = useMemo(
    () =>
      selectedInvestor
        ? contactNotes
            .filter((note) => note.investor_access_id === selectedInvestor.id)
            .sort(
              (left, right) =>
                getCellarActivitySortTime(right.created_at) - getCellarActivitySortTime(left.created_at),
            )
        : [],
    [contactNotes, selectedInvestor],
  );
  const selectedContactNote =
    selectedInvestorNotes.find((note) => note.id === selectedContactNoteId) ?? selectedInvestorNotes[0] ?? null;
  const selectedInvestorActivityEvents = useMemo(
    () =>
      selectedInvestor
        ? activityEvents.filter((event) => event.investor_access_id === selectedInvestor.id)
        : [],
    [activityEvents, selectedInvestor],
  );
  const selectedInvestorLastMessageAt = useMemo(
    () =>
      investorThreads
        .flatMap((thread) => [
          thread.last_message_at,
          thread.created_at,
          ...(thread.messages ?? []).map((message) => message.sent_at),
        ])
        .filter(Boolean)
        .sort((left, right) => getCellarActivitySortTime(right) - getCellarActivitySortTime(left))[0] ?? null,
    [investorThreads],
  );
  const getContactOwnerLabel = useCallback(
    (investor: CellarInvestorPipelineRecord) => {
      const bohUserId = investor.assigned_boh_user_id;
      if (!bohUserId) return 'Unassigned';
      const owner = teamMembers.find((member) => member.id === bohUserId);
      return owner ? owner.name || 'Name not set in BOH' : 'Unassigned';
    },
    [teamMembers],
  );
  const isArchivedContact = useCallback(
    (investor: CellarInvestorPipelineRecord) =>
      investor.access_status === 'paused' || investor.pipeline_status === 'paused',
    [],
  );
  const canArchiveSelectedInvestor = selectedInvestor ? !isArchivedContact(selectedInvestor) : false;
  const getContactAccessLabel = useCallback((investor: CellarInvestorPipelineRecord) => {
    if (isArchivedContact(investor)) return 'Archived';
    if (investor.access_status === 'guest' || investor.pipeline_status === 'guest_code_sent') return 'Guest';
    return formatCellarLabel(investor.access_status || 'verified');
  }, [isArchivedContact]);
  const getContactAccessTone = useCallback((investor: CellarInvestorPipelineRecord) => {
    if (isArchivedContact(investor)) return 'is-muted';
    if (investor.access_status === 'guest' || investor.pipeline_status === 'guest_code_sent') return 'is-guest';
    if (investor.access_status === 'paused' || investor.access_status === 'revoked') return 'is-muted';
    return 'is-success';
  }, [isArchivedContact]);
  const getContactLatestThreadDate = useCallback(
    (investorId: string) =>
      threads
        .filter((thread) => thread.investor_access_id === investorId)
        .map((thread) => thread.last_message_at ?? thread.created_at)
        .filter(Boolean)
        .sort((left, right) => getCellarActivitySortTime(right) - getCellarActivitySortTime(left))[0] ?? null,
    [threads],
  );
  const filteredInvestors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return investors.filter((investor) => {
      const ownerLabel = getContactOwnerLabel(investor);
      const isArchived = isArchivedContact(investor);
      const matchesSearch =
        !query ||
        [
          investor.full_name,
          investor.email,
          investor.company,
          investor.title,
          ownerLabel,
          getContactAccessLabel(investor),
          getStaffPipelineStageTitle(investor.pipeline_status || 'new_investor'),
          investor.pipeline_status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const isGuest = investor.access_status === 'guest' || investor.pipeline_status === 'guest_code_sent';
      const isVerified = !isGuest && !isArchived;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isArchived) ||
        (statusFilter === 'guest' && isGuest && !isArchived) ||
        (statusFilter === 'verified' && isVerified) ||
        (statusFilter === 'archived' && isArchived);
      const matchesOwner =
        ownerFilter === 'all' ||
        (ownerFilter === 'unassigned'
          ? !investor.assigned_boh_user_id
          : investor.assigned_boh_user_id === ownerFilter);
      return matchesSearch && matchesStatus && matchesOwner;
    }).sort((left, right) => {
      const leftLatest =
        getContactLatestThreadDate(left.id) ??
        left.last_seen_at ??
        left.guest_code_sent_at ??
        left.verified_at ??
        left.created_at;
      const rightLatest =
        getContactLatestThreadDate(right.id) ??
        right.last_seen_at ??
        right.guest_code_sent_at ??
        right.verified_at ??
        right.created_at;
      const latestDelta = getCellarActivitySortTime(rightLatest) - getCellarActivitySortTime(leftLatest);
      if (latestDelta !== 0) return latestDelta;
      return (left.full_name || left.email).localeCompare(right.full_name || right.email);
    });
  }, [
    getContactAccessLabel,
    getContactLatestThreadDate,
    getContactOwnerLabel,
    investors,
    isArchivedContact,
    ownerFilter,
    searchQuery,
    statusFilter,
  ]);
  const activeFilterCount = (statusFilter === 'active' ? 0 : 1) + (ownerFilter === 'all' ? 0 : 1);
  const ownerFilterOptions: CellarSelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'All owners' },
      { value: 'unassigned', label: 'Unassigned' },
      ...teamMembers.map((member) => ({ value: member.id, label: member.name || 'Name not set in BOH' })),
    ],
    [teamMembers],
  );
  const contactStatusFilterOptions: CellarSelectOption[] = [
    { value: 'active', label: 'Active contacts' },
    { value: 'guest', label: 'Guest invites' },
    { value: 'verified', label: 'Verified investors' },
    { value: 'archived', label: 'Archived contacts' },
    { value: 'all', label: 'All contacts' },
  ];
  const getContactMessageSenderBadge = useCallback(
    (message: InvestorMessage) => {
      if (message.sender_kind !== 'staff') return getCellarInitials(selectedInvestorName);
      const staff = teamMembers.find((member) => member.id === message.sender_boh_user_id);
      return staff ? getCellarStaffBadge(staff) : currentStaffBadge;
    },
    [currentStaffBadge, selectedInvestorName, teamMembers],
  );
  const getContactNoteAuthorLabel = useCallback(
    (note: StaffContactNote) => {
      const author = teamMembers.find((member) => member.id === note.created_by_boh_user_id);
      return author?.name || 'Name not set in BOH';
    },
    [teamMembers],
  );
  const getActivityActorLabel = useCallback(
    (event: StaffActivityEvent) => {
      if (event.actor_kind !== 'staff') return formatCellarLabel(event.actor_kind);
      const actor = teamMembers.find((member) => member.id === event.actor_boh_user_id);
      return actor?.name || 'CELLAR staff';
    },
    [teamMembers],
  );
  useEffect(() => {
    if (selectedInvestor && editSection) {
      setOwnerDraft(selectedInvestor.assigned_boh_user_id ?? '');
    }
  }, [editSection, selectedInvestor]);

  useEffect(() => {
    setContactNoteDraft('');
    setSelectedContactNoteId(null);
  }, [selectedInvestorId]);

  useEffect(() => {
    if (!selectedInvestorNotes.length) {
      setSelectedContactNoteId(null);
      return;
    }
    setSelectedContactNoteId((currentId) =>
      currentId && selectedInvestorNotes.some((note) => note.id === currentId)
        ? currentId
        : selectedInvestorNotes[0].id,
    );
  }, [selectedInvestorNotes]);

  useEffect(() => {
    if (activeTab !== 'messages') return;
    const stream = contactMessageStreamRef.current;
    if (!stream) return;
    window.requestAnimationFrame(() => {
      stream.scrollTop = stream.scrollHeight;
    });
  }, [activeTab, selectedInvestorId, selectedInvestorMessageCount]);

  const saveContactOwner = async () => {
    if (!selectedInvestor) return;
    const nextOwnerId = ownerDraft || null;
    if ((selectedInvestor.assigned_boh_user_id ?? '') === (nextOwnerId ?? '')) {
      setEditSection(null);
      return;
    }

    setIsSavingContact(true);
    setTone('info');
    setStatus('Saving contact owner.');
    const staffAuth = await getStaffAuthState();
    if (staffAuth.status !== 'ready') {
      setTone('error');
      setStatus(staffAuth.message);
      setIsSavingContact(false);
      return;
    }

    const { error } = await supabase
      .from('cellar_investor_access')
      .update({ assigned_boh_user_id: nextOwnerId, updated_by_boh_user_id: staffAuth.bohUserId })
      .eq('id', selectedInvestor.id);

    if (error) {
      setTone('error');
      setStatus(getFriendlyCellarError(error, 'Unable to save contact owner.'));
      setIsSavingContact(false);
      return;
    }

    setInvestors((current) =>
      current.map((investor) =>
        investor.id === selectedInvestor.id ? { ...investor, assigned_boh_user_id: nextOwnerId } : investor,
      ),
    );
    setTone('success');
    setStatus('Contact owner updated.');
    setIsSavingContact(false);
    setEditSection(null);
    await supabase.from('cellar_activity_events').insert({
      investor_access_id: selectedInvestor.id,
      actor_kind: 'staff',
      actor_auth_user_id: staffAuth.authUserId,
      actor_boh_user_id: staffAuth.bohUserId,
      event_type: 'contact_owner_changed',
      metadata: {
        previous_owner_boh_user_id: selectedInvestor.assigned_boh_user_id,
        next_owner_boh_user_id: nextOwnerId,
      },
    });
  };

  const saveContactNote = async (event: FormEvent) => {
    event.preventDefault();
    const cleanDraft = contactNoteDraft.trim();
    if (!selectedInvestor || !cleanDraft) return;

    setIsSavingContactNote(true);
    setContactNotesError('');
    const staffAuth = await getStaffAuthState();
    if (staffAuth.status !== 'ready') {
      setContactNotesError('Unable to save note right now.');
      setIsSavingContactNote(false);
      return;
    }

    const { data, error } = await supabase
      .from('cellar_staff_contact_notes')
      .insert({
        investor_access_id: selectedInvestor.id,
        note_body: cleanDraft,
        created_by_boh_user_id: staffAuth.bohUserId,
        updated_by_boh_user_id: staffAuth.bohUserId,
      })
      .select('id, investor_access_id, note_body, created_by_boh_user_id, updated_by_boh_user_id, created_at, updated_at')
      .single();

    if (error) {
      setContactNotesError('Unable to save note right now.');
      setIsSavingContactNote(false);
      return;
    }

    const nextNote = data as StaffContactNote;
    setContactNotes((current) => [nextNote, ...current]);
    setSelectedContactNoteId(nextNote.id);
    setContactNoteDraft('');
    setIsSavingContactNote(false);
  };

  const sendContactMessageReply = async (event: FormEvent) => {
    event.preventDefault();
    const cleanDraft = contactMessageDraft.trim();
    if (!selectedContactMessageThread || !cleanDraft) return;

    setIsSendingContactMessage(true);
    const { error } = await supabase.functions.invoke('cellar_send_staff_message', {
      body: {
        cellar_thread_id: selectedContactMessageThread.id,
        cellar_body: cleanDraft,
      },
    });

    if (error) {
      setIsSendingContactMessage(false);
      return;
    }

    setContactMessageDraft('');
    setIsSendingContactMessage(false);
    await loadContacts({ silent: true });
  };

  const resendContactInvite = async (investor = selectedInvestor) => {
    if (!investor?.email) return;

    setIsResendingInvite(true);
    setResendInviteTone('info');
    setResendInviteStatus(`Preparing invite for ${investor.email}.`);
    const staffAuth = await getStaffAuthState();
    if (staffAuth.status !== 'ready') {
      setResendInviteTone('error');
      setResendInviteStatus(staffAuth.message);
      setIsResendingInvite(false);
      return;
    }

    const { error } = await supabase.functions.invoke('cellar_send_investor_invite', {
      body: {
        cellar_email: investor.email,
        cellar_full_name: investor.full_name,
        cellar_company: investor.company,
        cellar_title: investor.title,
        cellar_sent_from_boh_user_id: investor.assigned_boh_user_id || staffAuth.bohUserId,
      },
    });

    if (error) {
      setResendInviteTone('error');
      setResendInviteStatus(getFriendlyCellarFunctionError(error, 'Unable to resend the investor invite.'));
      setIsResendingInvite(false);
      return;
    }

    await supabase.from('cellar_activity_events').insert({
      investor_access_id: investor.id,
      actor_kind: 'staff',
      actor_auth_user_id: staffAuth.authUserId,
      actor_boh_user_id: staffAuth.bohUserId,
      event_type: 'guest_invite_resent',
      metadata: {
        email: investor.email,
      },
    });

    setResendInviteTone('success');
    setResendInviteStatus(`Invite resent to ${investor.email}.`);
    setIsResendingInvite(false);
    await loadContacts({ silent: true });
  };

  const archiveContact = async (investor = selectedInvestor) => {
    if (!investor) return;

    setIsArchivingContact(true);
    setTone('info');
    setStatus(`Archiving ${investor.full_name || investor.email}.`);
    const staffAuth = await getStaffAuthState();
    if (staffAuth.status !== 'ready') {
      setTone('error');
      setStatus(staffAuth.message);
      setIsArchivingContact(false);
      return;
    }

    const { error } = await supabase
      .from('cellar_investor_access')
      .update({
        access_status: 'paused',
        pipeline_status: 'paused',
        updated_by_boh_user_id: staffAuth.bohUserId,
      })
      .eq('id', investor.id);

    if (error) {
      setTone('error');
      setStatus(getFriendlyCellarError(error, 'Unable to archive this contact.'));
      setIsArchivingContact(false);
      return;
    }

    const archivedInvestor = { ...investor, access_status: 'paused', pipeline_status: 'paused' };
    setInvestors((current) => current.map((item) => (item.id === investor.id ? archivedInvestor : item)));
    await supabase.from('cellar_activity_events').insert({
      investor_access_id: investor.id,
      actor_kind: 'staff',
      actor_auth_user_id: staffAuth.authUserId,
      actor_boh_user_id: staffAuth.bohUserId,
      event_type: 'contact_archived',
      metadata: {
        previous_access_status: investor.access_status,
        previous_pipeline_status: investor.pipeline_status,
      },
    });

    setTone('success');
    setStatus(`${investor.full_name || investor.email} archived.`);
    setArchiveCandidateInvestorId(null);
    setIsArchivingContact(false);
    await loadContacts({ silent: true });
  };

  const activityItems = useMemo<StaffContactActivityItem[]>(() => {
    if (!selectedInvestor) return [];
    const items: StaffContactActivityItem[] = [];
    for (const event of selectedInvestorActivityEvents) {
      if (event.event_type === 'pipeline_stage_changed') {
        const previousStage = String(event.metadata?.previous_stage ?? '');
        const nextStage = String(event.metadata?.next_stage ?? '');
        items.push({
          id: event.id,
          occurredAt: event.event_at,
          type: 'Pipeline',
          title: 'Pipeline stage changed',
          body: `Moved from ${getStaffPipelineStageTitle(previousStage)} to ${getStaffPipelineStageTitle(nextStage)}.`,
          meta: getActivityActorLabel(event),
        });
      }
      if (event.event_type === 'contact_owner_changed') {
        items.push({
          id: event.id,
          occurredAt: event.event_at,
          type: 'Owner',
          title: 'Contact owner changed',
          body: 'The assigned owner for this investor contact was updated.',
          meta: getActivityActorLabel(event),
        });
      }
      if (event.event_type === 'guest_invite_resent') {
        items.push({
          id: event.id,
          occurredAt: event.event_at,
          type: 'Invite',
          title: 'Guest invite resent',
          body: `${selectedInvestor.full_name || selectedInvestor.email} was resent the shared CELLAR guest access code.`,
          meta: getActivityActorLabel(event),
        });
      }
      if (event.event_type === 'contact_archived') {
        items.push({
          id: event.id,
          occurredAt: event.event_at,
          type: 'Access',
          title: 'Contact archived',
          body: `${selectedInvestor.full_name || selectedInvestor.email} was moved out of the active investor directory.`,
          meta: getActivityActorLabel(event),
        });
      }
    }
    if (selectedInvestor.verified_at) {
      items.push({
        id: 'verified',
        occurredAt: selectedInvestor.verified_at,
        type: 'Access',
        title: 'Investor verified',
        body: `${selectedInvestor.full_name || selectedInvestor.email} was approved for CELLAR access.`,
        meta: formatCellarLabel(selectedInvestor.pipeline_status || 'new_investor'),
      });
    }
    if (selectedInvestor.guest_code_sent_at) {
      items.push({
        id: 'guest-invite-sent',
        occurredAt: selectedInvestor.guest_code_sent_at,
        type: 'Invite',
        title: 'Guest invite sent',
        body: `${selectedInvestor.full_name || selectedInvestor.email} was sent the shared CELLAR guest access code.`,
        meta: selectedInvestor.email,
      });
    }
    if (selectedInvestor.last_seen_at) {
      items.push({
        id: 'last-seen',
        occurredAt: selectedInvestor.last_seen_at,
        type: 'Presentation',
        title: 'Investor returned to CELLAR',
        body: 'Last recorded workspace activity for this investor.',
        meta: selectedInvestor.email,
      });
    }
    return items.sort((left, right) => getCellarActivitySortTime(right.occurredAt) - getCellarActivitySortTime(left.occurredAt));
  }, [getActivityActorLabel, selectedInvestor, selectedInvestorActivityEvents]);

  return (
    <>
    <section className="staff-panel staff-contact-workspace is-full-height">
        <div className="staff-panel-heading">
          <div>
            <p>Investor directory</p>
            {selectedInvestor && <h2>{selectedInvestor.full_name || selectedInvestor.email}</h2>}
          </div>
        {!selectedInvestor && <span>{filteredInvestors.length}/{investors.length} contacts</span>}
      </div>

      {!selectedInvestor && (
        <div className="staff-contact-toolbar">
          <label className="staff-contact-search" htmlFor="staff-contact-search">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input
              id="staff-contact-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search contacts"
            />
          </label>
          <button
            type="button"
            className={`staff-contact-filter-button ${activeFilterCount ? 'is-active' : ''}`}
            onClick={() => setIsFilterDrawerOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
          <div className="staff-view-toggle" aria-label="Investor contact view">
            <button
              type="button"
              className={viewMode === 'cards' ? 'is-selected' : ''}
              onClick={() => setViewMode('cards')}
              aria-label="Card view"
              data-tooltip="Card view"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'is-selected' : ''}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              data-tooltip="List view"
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {isLoading && <StaffEmptyState title="Loading contacts" body="Checking verified CELLAR investor records." />}
      {!isLoading && tone === 'error' && status && (
        <StaffEmptyState title="Investor contacts unavailable" body={status} />
      )}
      {!isLoading && tone !== 'error' && !investors.length && (
        <StaffEmptyState
          title="No investor contacts"
          body="Invited and approved investor records will appear here."
        />
      )}
      {!isLoading && tone !== 'error' && investors.length > 0 && !filteredInvestors.length && !selectedInvestor && (
        <StaffEmptyState
          title="No contacts match"
          body="Adjust the search or filters to see more investor contacts."
        />
      )}
      {!isLoading && tone !== 'error' && filteredInvestors.length > 0 && !selectedInvestor && viewMode === 'cards' && (
        <div className="staff-contact-card-grid" aria-label="Investor contacts">
          {filteredInvestors.map((investor) => {
            const latestThreadDate = getContactLatestThreadDate(investor.id);
            const displayName = investor.full_name || investor.email;
            const initials = getCellarInitials(displayName);
            return (
              <article
                role="button"
                tabIndex={0}
                className="staff-contact-summary-card"
                key={investor.id}
                onClick={() => {
                  setSelectedInvestorId(investor.id);
                  setActiveTab('profile');
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setSelectedInvestorId(investor.id);
                  setActiveTab('profile');
                }}
              >
                <div className="staff-contact-card-identity">
                  <div className="staff-contact-avatar" aria-hidden="true">{initials}</div>
                  <div className="staff-contact-card-name">
                    <h3>{displayName}</h3>
                    <p>{investor.email}</p>
                    <p className="staff-contact-card-subtitle">
                      {[investor.title, investor.company].filter(Boolean).join(' at ') || 'Organisation not supplied'}
                    </p>
                    <p className="staff-contact-card-owner">
                      <span>Owner</span>
                      <strong>{getContactOwnerLabel(investor)}</strong>
                    </p>
                  </div>
                </div>
                <div className="staff-contact-card-meta">
                  <span>
                    {investor.verified_at
                      ? `Verified ${formatCompactDate(investor.verified_at)}`
                      : investor.guest_code_sent_at
                        ? `Invite sent ${formatCompactDate(investor.guest_code_sent_at)}`
                        : `Created ${formatCompactDate(investor.created_at)}`}
                  </span>
                  <span>{latestThreadDate ? `Last message ${formatCompactDate(latestThreadDate)}` : 'No messages yet'}</span>
                  <span className="staff-contact-card-meta-row">
                    <span>{investor.last_seen_at ? `Last seen ${formatCompactDate(investor.last_seen_at)}` : 'No recorded activity'}</span>
                    <span className={`staff-contact-access-pill ${getContactAccessTone(investor)}`}>
                      {getContactAccessLabel(investor)}
                    </span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!isLoading && tone !== 'error' && filteredInvestors.length > 0 && !selectedInvestor && viewMode === 'list' && (
        <div className="staff-contact-table" aria-label="Investor contacts">
          <div className="staff-contact-table-head">
            <span>Contact</span>
            <span>Access</span>
            <span>Pipeline</span>
            <span>Owner</span>
            <span>Latest</span>
          </div>
          {filteredInvestors.map((investor) => {
            const latestThreadDate = getContactLatestThreadDate(investor.id);
            const displayName = investor.full_name || investor.email;
            return (
              <article
                role="button"
                tabIndex={0}
                className="staff-contact-table-row"
                key={investor.id}
                onClick={() => {
                  setSelectedInvestorId(investor.id);
                  setActiveTab('profile');
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setSelectedInvestorId(investor.id);
                  setActiveTab('profile');
                }}
              >
                <span>
                  <strong>{displayName}</strong>
                  <small>{investor.email}</small>
                </span>
                <span>
                  <small className={`staff-contact-access-pill ${getContactAccessTone(investor)}`}>
                    {getContactAccessLabel(investor)}
                  </small>
                </span>
                <span>
                  <small>{getStaffPipelineStageTitle(investor.pipeline_status || 'new_investor')}</small>
                </span>
                <span>
                  <small>{getContactOwnerLabel(investor)}</small>
                </span>
                <span>
                  <small>
                    {latestThreadDate
                      ? `Message ${formatCompactDate(latestThreadDate)}`
                      : investor.guest_code_sent_at
                        ? `Invite ${formatCompactDate(investor.guest_code_sent_at)}`
                        : `Created ${formatCompactDate(investor.created_at)}`}
                  </small>
                </span>
              </article>
            );
          })}
        </div>
      )}
      {!isLoading && tone !== 'error' && selectedInvestor && (
        <div className="staff-contact-detail-body">
          <div className="staff-contact-tabs" role="tablist" aria-label="Investor record tabs">
            {(['profile', 'activity', 'messages', 'notes'] as const).map((tab) => (
              <button
                type="button"
                className={activeTab === tab ? 'is-selected' : ''}
                key={tab}
                onClick={() => setActiveTab(tab)}
              >
                {formatCellarLabel(tab)}
                {tab === 'activity' && Boolean(activityItems.length) && <span>{activityItems.length}</span>}
                {tab === 'messages' && Boolean(selectedInvestorThreadCount) && <span>{selectedInvestorThreadCount}</span>}
                {tab === 'notes' && Boolean(selectedInvestorNotes.length) && <span>{selectedInvestorNotes.length}</span>}
              </button>
            ))}
          </div>

          {activeTab === 'profile' && (
            <div className="staff-contact-profile">
              <article className="staff-contact-profile-card is-primary">
                <div className="staff-contact-card-heading">
                  <span>Personal information</span>
                  <button
                    type="button"
                    aria-label="Edit investor name and contact details"
                    data-tooltip="Edit contact details"
                    onClick={() => setEditSection('contact')}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Name</dt>
                    <dd>{selectedInvestor.full_name || 'Name not supplied'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedInvestor.email}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{getCellarInvestorPhone(selectedInvestor) || 'Not supplied'}</dd>
                  </div>
                  <div>
                    <dt>Company</dt>
                    <dd>{selectedInvestor.company || 'Not supplied'}</dd>
                  </div>
                  <div>
                    <dt>Title</dt>
                    <dd>{selectedInvestor.title || 'Not supplied'}</dd>
                  </div>
                </dl>
              </article>
              <article className="staff-contact-profile-card">
                <div className="staff-contact-card-heading">
                  <span>Pipeline</span>
                  <div className="staff-contact-heading-actions">
                    {canResendSelectedInvestorInvite && (
                      <button
                        type="button"
                        onClick={() => openResendInviteConfirmation(selectedInvestor)}
                        disabled={isResendingInvite}
                        aria-label="Resend guest invite"
                        data-tooltip="Resend guest invite"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    {canArchiveSelectedInvestor && (
                      <button
                        type="button"
                        onClick={() => openArchiveContactConfirmation(selectedInvestor)}
                        disabled={isArchivingContact}
                        aria-label="Archive contact"
                        data-tooltip="Archive contact"
                      >
                        <Archive className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Stage</dt>
                    <dd>
                      <span className="staff-status-pill">
                        {formatCellarLabel(selectedInvestor.pipeline_status || 'new_investor')}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Access</dt>
                    <dd>
                      <span className={`staff-status-pill ${getContactAccessTone(selectedInvestor)}`}>
                        {getContactAccessLabel(selectedInvestor)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{getContactOwnerLabel(selectedInvestor)}</dd>
                  </div>
                  <div>
                    <dt>Invite sent</dt>
                    <dd>{selectedInvestorInviteSentAt ? formatCompactDate(selectedInvestorInviteSentAt) : 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Verified</dt>
                    <dd>{selectedInvestor.verified_at ? formatCompactDate(selectedInvestor.verified_at) : 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Last seen</dt>
                    <dd>{selectedInvestor.last_seen_at ? formatCompactDate(selectedInvestor.last_seen_at) : 'No activity yet'}</dd>
                  </div>
                  <div>
                    <dt>Messages</dt>
                    <dd>{selectedInvestorLastMessageAt ? formatCompactDate(selectedInvestorLastMessageAt) : 'No messages yet'}</dd>
                  </div>
                </dl>
              </article>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="staff-contact-activity-timeline">
              {activityItems.length ? (
                activityItems.map((item) => (
                  <article key={item.id}>
                    <time>{formatCompactDate(item.occurredAt)}</time>
                    <div>
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                      {item.meta && <small>{item.meta}</small>}
                    </div>
                  </article>
                ))
              ) : (
                <StaffEmptyState
                  title="No activity yet"
                  body="Presentation views, questions, shared notes, bookings, and messages will appear here as they are recorded."
                />
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="staff-contact-messages">
              {investorThreads.length ? (
                <>
                  <div className="message-stream" ref={contactMessageStreamRef}>
                    {investorThreads.flatMap((thread) =>
                      thread.messages.map((message) => (
                        <article
                          className={`message-bubble ${message.sender_kind === 'staff' ? 'is-user' : ''}`}
                          key={message.id}
                        >
                          <strong>{getContactMessageSenderBadge(message)}</strong>
                          <p>{message.body}</p>
                        </article>
                      )),
                    )}
                  </div>
                  <form className="message-composer" onSubmit={sendContactMessageReply}>
                    <label htmlFor="staff-contact-message-reply">Reply</label>
                    <textarea
                      id="staff-contact-message-reply"
                      aria-label="Reply"
                      value={contactMessageDraft}
                      onChange={(event) => setContactMessageDraft(event.target.value)}
                      placeholder={`Reply to ${selectedInvestorName}...`}
                      spellCheck
                    />
                    <button type="submit" disabled={isSendingContactMessage || !contactMessageDraft.trim()}>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {isSendingContactMessage ? 'Sending...' : 'Send'}
                    </button>
                  </form>
                </>
              ) : (
                <StaffEmptyState
                  title="No messages yet"
                  body="Private CELLAR messages appear here after this investor starts a message."
                />
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="staff-contact-notes">
              <form className="staff-contact-note-composer" onSubmit={saveContactNote}>
                <label htmlFor="staff-contact-note">Note</label>
                <textarea
                  id="staff-contact-note"
                  aria-label="Note"
                  value={contactNoteDraft}
                  onChange={(event) => setContactNoteDraft(event.target.value)}
                  placeholder={`Add a private note for ${selectedInvestorName}...`}
                  disabled={Boolean(contactNotesError)}
                  spellCheck
                />
                <button type="submit" disabled={Boolean(contactNotesError) || isSavingContactNote || !contactNoteDraft.trim()}>
                  {isSavingContactNote ? 'Saving...' : 'Add note'}
                </button>
              </form>
              {contactNotesError && <p className="staff-contact-note-status">{contactNotesError}</p>}
              {!contactNotesError && selectedInvestorNotes.length ? (
                <div className="staff-contact-note-workspace">
                  <div className="staff-contact-note-list" aria-label="Contact notes">
                    {selectedInvestorNotes.map((note) => (
                      <button
                        type="button"
                        className={selectedContactNote?.id === note.id ? 'is-selected' : ''}
                        key={note.id}
                        onClick={() => setSelectedContactNoteId(note.id)}
                      >
                        <time>{formatCompactDateTime(note.created_at)}</time>
                        <span>{getContactNoteAuthorLabel(note)}</span>
                      </button>
                    ))}
                  </div>
                  {selectedContactNote && (
                    <article className="staff-contact-note-card">
                      <div>
                        <span>{getContactNoteAuthorLabel(selectedContactNote)}</span>
                        <time>{formatCompactDateTime(selectedContactNote.created_at)}</time>
                      </div>
                      <p>{selectedContactNote.note_body}</p>
                    </article>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
      {status && tone !== 'error' && <p className={`staff-upload-status is-${tone}`}>{status}</p>}
    </section>
    {isFilterDrawerOpen && !selectedInvestor && (
      <div className="staff-contact-edit-backdrop" role="presentation">
        <aside className="staff-contact-edit-drawer staff-contact-filter-drawer" aria-label="Filter investor contacts" aria-modal="true" role="dialog">
          <button
            type="button"
            className="staff-contact-edit-close"
            onClick={() => setIsFilterDrawerOpen(false)}
            aria-label="Close contact filters"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <p>Investor directory</p>
          <h2>Filters</h2>
          <div className="staff-contact-edit-fields">
            <CellarSelect
              label="Access"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as ContactDirectoryStatusFilter)}
              options={contactStatusFilterOptions}
            />
            <CellarSelect
              label="Owner"
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={ownerFilterOptions}
            />
          </div>
          <div className="staff-contact-edit-footer">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('active');
                setOwnerFilter('all');
              }}
            >
              Clear
            </button>
            <button type="button" onClick={() => setIsFilterDrawerOpen(false)}>
              Apply
            </button>
          </div>
        </aside>
      </div>
    )}
    {resendCandidateInvestor && (
      <div className="staff-contact-edit-backdrop" role="presentation">
        <aside className="staff-contact-edit-drawer staff-contact-confirm-drawer" aria-label="Confirm resend invite" aria-modal="true" role="dialog">
          <button
            type="button"
            className="staff-contact-edit-close"
            onClick={() => {
              setResendCandidateInvestorId(null);
              setResendInviteStatus('');
            }}
            aria-label="Close resend confirmation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <p>Guest invite</p>
          <h2>Resend invite?</h2>
          <div className="staff-contact-confirm-summary">
            <span>Recipient</span>
            <strong>{resendCandidateInvestor.full_name || resendCandidateInvestor.email}</strong>
            <small>{resendCandidateInvestor.email}</small>
            <span>Last invite</span>
            <small>
              {resendCandidateInvestor.guest_code_sent_at
                ? formatCompactDateTime(resendCandidateInvestor.guest_code_sent_at)
              : 'Not recorded'}
            </small>
          </div>
          {resendInviteStatus && (
            <p className={`staff-contact-confirm-status is-${resendInviteTone}`}>
              {resendInviteStatus}
            </p>
          )}
          <div className="staff-contact-edit-footer">
            <button
              type="button"
              onClick={() => {
                setResendCandidateInvestorId(null);
                setResendInviteStatus('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void resendContactInvite(resendCandidateInvestor)}
              disabled={isResendingInvite || resendInviteTone === 'success'}
            >
              {isResendingInvite ? 'Sending...' : 'Resend invite'}
            </button>
          </div>
        </aside>
      </div>
    )}
    {archiveCandidateInvestor && (
      <div className="staff-contact-edit-backdrop" role="presentation">
        <aside className="staff-contact-edit-drawer staff-contact-confirm-drawer" aria-label="Confirm archive contact" aria-modal="true" role="dialog">
          <button
            type="button"
            className="staff-contact-edit-close"
            onClick={() => setArchiveCandidateInvestorId(null)}
            aria-label="Close archive confirmation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <p>Investor directory</p>
          <h2>Archive contact?</h2>
          <div className="staff-contact-confirm-summary">
            <span>Contact</span>
            <strong>{archiveCandidateInvestor.full_name || archiveCandidateInvestor.email}</strong>
            <small>{archiveCandidateInvestor.email}</small>
            <span>Current status</span>
            <small>
              {getContactAccessLabel(archiveCandidateInvestor)} / {getStaffPipelineStageTitle(archiveCandidateInvestor.pipeline_status || 'new_investor')}
            </small>
          </div>
          <p className="staff-contact-confirm-note">
            Archived contacts are hidden from the active directory and can be found with the Archived contacts filter.
          </p>
          <div className="staff-contact-edit-footer">
            <button type="button" onClick={() => setArchiveCandidateInvestorId(null)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void archiveContact(archiveCandidateInvestor)}
              disabled={isArchivingContact}
            >
              {isArchivingContact ? 'Archiving...' : 'Archive contact'}
            </button>
          </div>
        </aside>
      </div>
    )}
    {selectedInvestor && editSection && (
      <div className="staff-contact-edit-backdrop" role="presentation">
        <aside className="staff-contact-edit-drawer" aria-label="Edit investor contact" aria-modal="true" role="dialog">
          <button
            type="button"
            className="staff-contact-edit-close"
            onClick={() => setEditSection(null)}
            aria-label="Close contact editor"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <p>Investor directory</p>
          <h2>Contact details</h2>
          <div className="staff-contact-edit-fields">
            <label>
              <span>Name</span>
              <input value={selectedInvestor.full_name || ''} readOnly />
            </label>
            <label>
              <span>Phone</span>
              <input value={getCellarInvestorPhone(selectedInvestor) || ''} readOnly />
            </label>
            <label>
              <span>Company</span>
              <input value={selectedInvestor.company || ''} readOnly />
            </label>
            <label>
              <span>Title</span>
              <input value={selectedInvestor.title || ''} readOnly />
            </label>
            <label>
              <CellarSelect
                label="Owner"
                value={ownerDraft}
                onChange={setOwnerDraft}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...teamMembers.map((member) => ({
                    value: member.id,
                    label: member.name || 'Name not set in BOH',
                  })),
                ]}
              />
            </label>
          </div>
          <div className="staff-contact-edit-footer">
            <button type="button" onClick={() => setEditSection(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={isSavingContact || (selectedInvestor.assigned_boh_user_id ?? '') === ownerDraft}
              onClick={() => void saveContactOwner()}
            >
              {isSavingContact ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </aside>
      </div>
    )}
    </>
  );
}

function StaffAccess() {
  return (
    <section className="staff-access-workspace">
      <StaffGuestAccessCodePanel mode="code" />
    </section>
  );
}

function StaffInvites() {
  return (
    <section className="staff-access-workspace">
      <StaffGuestAccessCodePanel mode="invite" />
    </section>
  );
}

function StaffGuestAccessCodePanel({ mode = 'all' }: { mode?: 'all' | 'invite' | 'code' }) {
  const [summary, setSummary] = useState<CellarGuestAccessSummary | null>(null);
  const [staffAuth, setStaffAuth] = useState<StaffAuthState>({
    status: 'checking',
    email: '',
    bohUserId: null,
    message: 'Checking staff session.',
  });
  const [newCode, setNewCode] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [recipientLastName, setRecipientLastName] = useState('');
  const [teamMembers, setTeamMembers] = useState<StaffTeamRecord[]>([]);
  const [sentFromBohUserId, setSentFromBohUserId] = useState('');
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');
  const [isBusy, setIsBusy] = useState(false);

  const invokeGuestCodeManager = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('cellar_manage_guest_access_code', {
      body,
    });
    if (error) {
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      const payload = await context?.json?.().catch(() => null);
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        throw new Error(payload.error);
      }
      throw error;
    }
    return data as {
      cellar_guest_access_code?: CellarGuestAccessSummary | null;
      cellar_guest_code?: string;
      cellar_send_status?: string;
      cellar_message?: string;
      cellar_email?: { to: string; from_name?: string | null; from_email?: string | null };
    };
  }, []);

  const invokeInvestorInvite = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('cellar_send_investor_invite', {
      body,
    });
    if (error) {
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      const payload = await context?.json?.().catch(() => null);
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        throw new Error(payload.error);
      }
      throw error;
    }
    return data as {
      cellar_guest_access_code?: CellarGuestAccessSummary | null;
      cellar_guest_code?: string;
      cellar_send_status?: string;
      cellar_email?: { to: string; from_name?: string | null; from_email?: string | null };
    };
  }, []);

  const loadSummary = useCallback(async () => {
    if (staffAuth.status !== 'ready') {
      setTone('info');
      setStatus('');
      return;
    }

    try {
      const result = await invokeGuestCodeManager({ cellar_action: 'summary' });
      setSummary(result.cellar_guest_access_code ?? null);
      setTone('info');
      setStatus('');
    } catch (error) {
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(error, 'Unable to load guest code status.'));
    }
  }, [invokeGuestCodeManager, staffAuth.status]);

  useEffect(() => {
    void getStaffAuthState().then((nextState) => {
      setStaffAuth(nextState);
      if (nextState.status === 'ready') {
        setTone('info');
        setStatus('');
        setSentFromBohUserId((current) => current || nextState.bohUserId || '');
      }
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;
    void loadBohStaffUsers().then((response) => {
      if (isCancelled) return;
      setTeamMembers(response.data);
      setSentFromBohUserId((current) => current || staffAuth.bohUserId || response.data[0]?.id || '');
    });
    return () => {
      isCancelled = true;
    };
  }, [staffAuth.bohUserId]);

  useEffect(() => {
    if (staffAuth.status === 'ready') {
      void loadSummary();
    }
  }, [loadSummary, staffAuth.status]);

  useEffect(() => {
    if (!status || tone === 'error') return undefined;
    const timeoutId = window.setTimeout(() => setStatus(''), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [status, tone]);

  const resetCode = async () => {
    setTone('info');
    setStatus('Checking whether this staff session can reset the shared code.');

    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setTone('error');
      setStatus(`Reset not run: ${nextAuth.message}`);
      return;
    }

    setIsBusy(true);
    setNewCode('');
    try {
      const result = await invokeGuestCodeManager({
        cellar_action: 'reset',
        cellar_reset_reason: 'manual_staff_reset',
      });
      setSummary(result.cellar_guest_access_code ?? null);
      setNewCode(result.cellar_guest_code ?? '');
      setTone('success');
      setStatus('New shared guest code generated.');
    } catch (error) {
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(error, 'Unable to reset the shared guest code.'));
    } finally {
      setIsBusy(false);
    }
  };

  const sendCode = async () => {
    setTone('info');
    setStatus('Checking whether this staff session can prepare an invite.');

    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setTone('error');
      setStatus(`Send not run: ${nextAuth.message}`);
      return;
    }

    const email = recipientEmail.trim().toLowerCase();
    if (!email) {
      setTone('error');
      setStatus('Enter an investor email before preparing the send.');
      return;
    }
    const firstName = recipientFirstName.trim();
    const lastName = recipientLastName.trim();
    if (!firstName || !lastName) {
      setTone('error');
      setStatus('Enter the investor first and last name before preparing the send.');
      return;
    }

    setIsBusy(true);
    setNewCode('');
    try {
      const result = await invokeInvestorInvite({
        cellar_email: email,
        cellar_full_name: `${firstName} ${lastName}`,
        cellar_sent_from_boh_user_id: sentFromBohUserId,
      });

      setSummary(result.cellar_guest_access_code ?? null);
      setNewCode(result.cellar_guest_code ?? '');
      if (result.cellar_send_status === 'sent') {
        setTone('success');
        setStatus(`Invite sent to ${result.cellar_email?.to ?? email}.`);
      } else {
        setTone('info');
        setStatus(`Investor record prepared for ${result.cellar_email?.to ?? email}. Email was not sent.`);
      }
    } catch (error) {
      setTone('error');
      setStatus(getFriendlyCellarFunctionError(error, 'Unable to send the investor invite.'));
    } finally {
      setIsBusy(false);
    }
  };

  const copyNewCode = async () => {
    const displayedGuestCode = newCode || summary?.cellar_guest_code || '';
    if (!displayedGuestCode) return;
    const didCopy = await copyTextToClipboard(displayedGuestCode);
    setTone(didCopy ? 'success' : 'error');
    setStatus(didCopy ? 'Copied the shared guest code.' : 'Copy failed. Select the code and copy it manually.');
  };

  const copyDmMessage = async () => {
    const displayedGuestCode = newCode || summary?.cellar_guest_code || '';
    if (!displayedGuestCode) {
      setTone('error');
      setStatus('No active shared guest code is available to copy into a DM.');
      return;
    }
    const didCopy = await copyTextToClipboard(createCellarDmInviteMessage(recipientFirstName, displayedGuestCode));
    setTone(didCopy ? 'success' : 'error');
    setStatus(didCopy ? 'Copied a DM-ready access message.' : 'Copy failed. Select the code and copy it manually.');
  };

  const displayedGuestCode = newCode || summary?.cellar_guest_code || '';
  const sentByStaff = teamMembers.find((member) => member.id === staffAuth.bohUserId);
  const sentByLabel = sentByStaff?.name ?? '';
  const showInvitePane = mode !== 'code';
  const showCodePane = mode !== 'invite';

  return (
    <section className="staff-panel staff-guest-code-panel">
      <div className="staff-panel-heading">
        <div>
          <p>{mode === 'invite' ? 'Investor outreach' : 'Shared guest access'}</p>
          <h2>{mode === 'invite' ? 'Investor invites' : 'Shared access code'}</h2>
        </div>
      </div>

      <div className={`staff-guest-code-grid ${mode !== 'all' ? 'is-single-pane' : ''}`}>
        {showInvitePane && (
        <section className="staff-guest-code-pane staff-guest-invite-pane">
          <div className="staff-guest-code-pane-heading">
            <Mail className="h-5 w-5" aria-hidden="true" />
            <div>
              <p>Send invite</p>
              <h3>Email an investor</h3>
            </div>
          </div>
          <div className="staff-guest-code-actions">
            <label>
              <span>Investor email</span>
              <input
                type="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="investor@example.com"
                spellCheck={false}
              />
            </label>
            <div className="staff-guest-code-form-grid">
              <label>
                <span>First name</span>
                <input
                  value={recipientFirstName}
                  onChange={(event) => setRecipientFirstName(event.target.value)}
                  placeholder="Required"
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  value={recipientLastName}
                  onChange={(event) => setRecipientLastName(event.target.value)}
                  placeholder="Required"
                />
              </label>
            </div>
            <div className="staff-guest-code-send-meta">
              <CellarSelect
                label="Sent from"
                value={sentFromBohUserId}
                onChange={setSentFromBohUserId}
                options={teamMembers.map((member) => ({
                  value: member.id,
                  label: member.name || 'Name not set in BOH',
                }))}
              />
              <label>
                <span>Sent by</span>
                <input value={sentByLabel} readOnly />
              </label>
            </div>
          </div>
          <div className="staff-guest-code-footer">
            <button type="button" onClick={copyDmMessage} disabled={isBusy || !displayedGuestCode}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy DM message
            </button>
            <button type="button" onClick={sendCode} disabled={isBusy || !sentFromBohUserId}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Prepare send
            </button>
          </div>
        </section>
        )}

        {showCodePane && (
        <section className="staff-guest-code-pane staff-guest-code-cycle-pane">
          <div className="staff-guest-code-state">
            <span>Current code</span>
            <strong>{displayedGuestCode || 'Not generated'}</strong>
            <p>
              {summary
                ? `Active until ${formatCompactDate(summary.expires_at)}${
                    typeof summary.days_remaining === 'number' ? `. ${summary.days_remaining} days remaining.` : '.'
                  }`
                : 'No active shared guest code found. Reset to generate one.'}
            </p>
            <p>Codes rotate every 14 days unless staff reset the active code sooner.</p>
          </div>
          <div className="staff-guest-code-action-row">
            {displayedGuestCode && (
              <button type="button" className="staff-guest-copy-action" onClick={copyNewCode}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy code
              </button>
            )}
            <button
              type="button"
              className="staff-guest-reset-action"
              onClick={resetCode}
              disabled={isBusy}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reset shared code
            </button>
          </div>
        </section>
        )}
      </div>
      {status && <p className={`staff-upload-status staff-guest-code-status is-${tone}`}>{status}</p>}
    </section>
  );
}

function StaffAssets() {
  const [presentations, setPresentations] = useState<StaffPresentation[]>([]);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [assets, setAssets] = useState<StaffAsset[]>([]);
  const [presentationSearchAssets, setPresentationSearchAssets] = useState<StaffAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [isPresentationDrawerOpen, setIsPresentationDrawerOpen] = useState(false);
  const [isPresentationFilterDrawerOpen, setIsPresentationFilterDrawerOpen] = useState(false);
  const [isPresentationEditDrawerOpen, setIsPresentationEditDrawerOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<StaffAsset | null>(null);
  const [isAssetDetailsDrawerOpen, setIsAssetDetailsDrawerOpen] = useState(false);
  const [swappingAsset, setSwappingAsset] = useState<StaffAsset | null>(null);
  const [openPresentationMenuId, setOpenPresentationMenuId] = useState<string | null>(null);
  const [openAssetMenuId, setOpenAssetMenuId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingPresentation, setIsCreatingPresentation] = useState(false);
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadTone, setUploadTone] = useState<'info' | 'success' | 'error'>('info');
  const [assetActionStatus, setAssetActionStatus] = useState('');
  const [assetActionTone, setAssetActionTone] = useState<'info' | 'success' | 'error'>('info');
  const [presentationFormStatus, setPresentationFormStatus] = useState('');
  const [presentationFormTone, setPresentationFormTone] = useState<'info' | 'success' | 'error'>('info');
  const [presentationQuery, setPresentationQuery] = useState('');
  const [presentationStatusFilter, setPresentationStatusFilter] = useState('active');
  const [assetStatusFilter, setAssetStatusFilter] = useState('all');
  const [assetVisibilityFilter, setAssetVisibilityFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [tabLabel, setTabLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [assetType, setAssetType] = useState('deck');
  const [visibility, setVisibility] = useState('guest');
  const [status, setStatus] = useState('published');
  const [presentationTitle, setPresentationTitle] = useState('');
  const [presentationDescription, setPresentationDescription] = useState('');
  const [presentationStatus, setPresentationStatus] = useState('draft');
  const [editPresentationTitle, setEditPresentationTitle] = useState('');
  const [editPresentationDescription, setEditPresentationDescription] = useState('');
  const [editPresentationStatus, setEditPresentationStatus] = useState('draft');
  const [editAssetTitle, setEditAssetTitle] = useState('');
  const [editAssetTabLabel, setEditAssetTabLabel] = useState('');
  const [editAssetType, setEditAssetType] = useState('deck');
  const [editAssetVisibility, setEditAssetVisibility] = useState('guest');
  const [editAssetStatus, setEditAssetStatus] = useState('published');
  const [editAssetSummary, setEditAssetSummary] = useState('');
  const [editNarrativeEyebrow, setEditNarrativeEyebrow] = useState(CELLAR_NARRATIVE_EYEBROW);
  const [editNarrativeHeading, setEditNarrativeHeading] = useState(CELLAR_NARRATIVE_HEADING);
  const [editSlideNarratives, setEditSlideNarratives] = useState<Array<{ slide: number; narrative: string }>>([]);
  const [isNarrativeOrganizerOpen, setIsNarrativeOrganizerOpen] = useState(false);
  const [activeSlideNarrativeIndex, setActiveSlideNarrativeIndex] = useState(0);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [savingSlideNarrativeIndex, setSavingSlideNarrativeIndex] = useState<number | null>(null);
  const [slideNarrativeStatus, setSlideNarrativeStatus] = useState('');
  const [isSwappingAsset, setIsSwappingAsset] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [swapFile, setSwapFile] = useState<File | null>(null);
  const [staffAuth, setStaffAuth] = useState<StaffAuthState>({
    status: 'checking',
    email: '',
    bohUserId: null,
    message: 'Checking staff session.',
  });

  const selectedPresentation = presentations.find((presentation) => presentation.id === selectedPresentationId) ?? null;
  const narrativeRowsBySlide = new Map<number, { slide: number; narrative: string; index: number; hasNarrative: boolean }>();
  editSlideNarratives.forEach((row, index) => {
    if (Number.isInteger(row.slide) && row.slide > 0 && !narrativeRowsBySlide.has(row.slide)) {
      narrativeRowsBySlide.set(row.slide, { ...row, index, hasNarrative: Boolean(row.narrative.trim()) });
    }
  });
  const narrativeCount = editSlideNarratives.filter((row) => row.narrative.trim()).length;
  const hasSlideOneNarrative = editSlideNarratives.some((row) => row.slide === 1 && row.narrative.trim());
  const hasDuplicateNarrativeSlides =
    new Set(editSlideNarratives.map((row) => row.slide).filter((slide) => Number.isInteger(slide) && slide > 0)).size <
    editSlideNarratives.filter((row) => Number.isInteger(row.slide) && row.slide > 0).length;
  const activeSlideNarrative = editSlideNarratives[activeSlideNarrativeIndex] ?? editSlideNarratives[0] ?? { slide: 1, narrative: '' };
  const draftSlideNarratives = createCellarSlideNarrativeMap(editSlideNarratives);
  const savedNarrativeEyebrow =
    typeof editingAsset?.metadata?.narrative_eyebrow === 'string' && editingAsset.metadata.narrative_eyebrow.trim()
      ? editingAsset.metadata.narrative_eyebrow
      : CELLAR_NARRATIVE_EYEBROW;
  const savedNarrativeHeading =
    typeof editingAsset?.metadata?.narrative_heading === 'string' && editingAsset.metadata.narrative_heading.trim()
      ? editingAsset.metadata.narrative_heading
      : CELLAR_NARRATIVE_HEADING;
  const hasSlideNarrativeChanges = Boolean(
    editingAsset &&
      !hasDuplicateNarrativeSlides &&
      Number.isInteger(activeSlideNarrative.slide) &&
      activeSlideNarrative.slide > 0 &&
      (
        getCellarSlideNarrativeSignature(draftSlideNarratives) !==
          getCellarSlideNarrativeSignature(editingAsset.slide_narratives) ||
        (editNarrativeEyebrow.trim() || CELLAR_NARRATIVE_EYEBROW) !== savedNarrativeEyebrow ||
        (editNarrativeHeading.trim() || CELLAR_NARRATIVE_HEADING) !== savedNarrativeHeading
      ),
  );
  const hasAssetDetailsChanges = Boolean(
    editingAsset &&
      (
        editAssetTitle.trim() !== editingAsset.title ||
        editAssetTabLabel.trim() !== (editingAsset.tab_label ?? '') ||
        editAssetType !== (editingAsset.asset_type || 'deck') ||
        editAssetVisibility !== (editingAsset.visibility || 'guest') ||
        editAssetStatus !== (editingAsset.status || 'published') ||
        editAssetSummary.trim() !== (editingAsset.summary ?? '')
      ),
  );
  const hasPresentationChanges = Boolean(
    selectedPresentation &&
      (
        editPresentationTitle.trim() !== selectedPresentation.title ||
        editPresentationDescription.trim() !== (selectedPresentation.description ?? '') ||
        editPresentationStatus !== selectedPresentation.status
      ),
  );
  const normalizedPresentationQuery = presentationQuery.trim().toLowerCase();
  const filteredPresentations = presentations.filter((presentation) => {
    const matchesQuery = normalizedPresentationQuery
      ? (() => {
          const searchableAssets = presentationSearchAssets.filter((asset) =>
            presentation.is_legacy
              ? !asset.presentation_id
              : asset.presentation_id === presentation.id,
          );
          return [
            presentation.title,
            presentation.description ?? '',
            presentation.status,
            ...searchableAssets.flatMap((asset) => [
              asset.title,
              asset.tab_label ?? '',
              asset.summary ?? '',
              asset.status,
              asset.visibility,
            ]),
          ].some((value) => value.toLowerCase().includes(normalizedPresentationQuery));
        })()
      : true;
    const matchesStatus =
      presentationStatusFilter === 'all' ||
      (presentationStatusFilter === 'active'
        ? presentation.status !== 'archived'
        : presentation.status === presentationStatusFilter);
    return matchesQuery && matchesStatus;
  });
  const filteredAssets = assets.filter((asset) => {
    const matchesStatus = assetStatusFilter === 'all' || asset.status === assetStatusFilter;
    const matchesVisibility = assetVisibilityFilter === 'all' || asset.visibility === assetVisibilityFilter;
    return matchesStatus && matchesVisibility;
  });
  const activePresentationFilterCount =
    (normalizedPresentationQuery ? 1 : 0) +
    (presentationStatusFilter === 'active' ? 0 : 1) +
    (assetStatusFilter === 'all' ? 0 : 1) +
    (assetVisibilityFilter === 'all' ? 0 : 1);
  const presentationCountLabel =
    filteredPresentations.length === presentations.length
      ? `${presentations.length} presentation${presentations.length === 1 ? '' : 's'}`
      : `${filteredPresentations.length}/${presentations.length} presentations`;
  const presentationStatusFilterOptions = [
    { value: 'active', label: 'Active presentations' },
    { value: 'all', label: 'All presentation status' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'needs_repair', label: 'Needs repair' },
    { value: 'archived', label: 'Archived' },
  ];
  const assetStatusFilterOptions = [
    { value: 'all', label: 'All asset status' },
    { value: 'draft', label: 'Draft' },
    { value: 'needs_review', label: 'Needs review' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
  ];
  const assetVisibilityFilterOptions = [
    { value: 'all', label: 'All visibility' },
    { value: 'guest', label: 'Guest + verified' },
    { value: 'verified', label: 'Verified only' },
    { value: 'appendix_granted', label: 'Appendix granted' },
    { value: 'staff_only', label: 'Staff only' },
  ];

  const closeOverflowMenus = useCallback(() => {
    setOpenPresentationMenuId(null);
    setOpenAssetMenuId(null);
  }, []);

  const attachUnassignedAssetsToPresentation = useCallback(async (
    targetPresentationId: string,
    orphanAssets: StaffAsset[],
  ) => {
    if (!orphanAssets.length) return false;
    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') return false;

    const results = await Promise.all(
      orphanAssets.map((asset) =>
        supabase
          .from('cellar_assets')
          .update({ presentation_id: targetPresentationId, updated_by_boh_user_id: nextAuth.bohUserId })
          .eq('id', asset.id),
      ),
    );
    return results.every((result) => !result.error);
  }, []);

  const fetchStaffContent = useCallback(async (presentationId?: string | null): Promise<CellarStaffContentResult> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error('Connect your standard JOBZ CAFE® staff session before loading presentations.');
    }

    const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_list_assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cellarSupabasePublishableKey ? { apikey: cellarSupabasePublishableKey } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cellar_staff_workspace: true,
        ...(presentationId ? { cellar_presentation_id: presentationId } : {}),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as CellarStaffContentResult;
    if (!response.ok) {
      throw new Error(
        result.error === 'CELLAR_STAFF_AUTH_REQUIRED'
          ? 'Your auth session is not linked to a BOH staff record yet.'
          : result.error ?? 'Unable to load CELLAR staff content.',
      );
    }
    return result;
  }, []);

  const loadPresentations = useCallback(async () => {
    try {
      const result = await fetchStaffContent();
      const nextPresentations = result.cellar_presentations ?? [];
      setPresentationSearchAssets(result.cellar_assets ?? []);
      let orphanAssets = result.cellar_assets?.filter((asset) => !asset.presentation_id) ?? [];
      if (orphanAssets.length > 0 && nextPresentations.length === 1) {
        const repaired = await attachUnassignedAssetsToPresentation(nextPresentations[0].id, orphanAssets);
        if (repaired) {
          orphanAssets = [];
        }
      }
      const orphanCount = orphanAssets.length;
      const presentationsWithLegacy =
        orphanCount > 0
          ? [
              ...nextPresentations,
              {
                id: 'cellar_legacy_unassigned',
                title: 'Unassigned assets',
                slug: 'cellar-legacy-unassigned',
                description: 'Published assets need a real presentation before investors can see them.',
                status: 'needs_repair',
                sort_order: 9999,
                published_at: null,
                is_legacy: true,
                asset_count: orphanCount,
              },
            ]
          : nextPresentations;
      setPresentations(presentationsWithLegacy);
      setSelectedPresentationId((current) =>
        current && presentationsWithLegacy.some((presentation) => presentation.id === current)
          ? current
          : presentationsWithLegacy[0]?.id ?? null,
      );
    } catch (error) {
      setAssetActionTone('error');
      setAssetActionStatus(error instanceof Error ? error.message : 'Unable to load Pitch Room Presentations.');
    }
  }, [attachUnassignedAssetsToPresentation, fetchStaffContent]);

  const loadAssets = useCallback(async () => {
    if (!selectedPresentationId) {
      setAssets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchStaffContent(
        selectedPresentationId === 'cellar_legacy_unassigned' ? null : selectedPresentationId,
      );
      setAssets(result.cellar_assets ?? []);
    } catch (error) {
      setAssetActionTone('error');
      setAssetActionStatus(error instanceof Error ? error.message : 'Unable to load presentation items.');
      setAssets([]);
    }
    setIsLoading(false);
  }, [fetchStaffContent, selectedPresentationId]);

  useEffect(() => {
    void loadPresentations();

    void getStaffAuthState().then(setStaffAuth);
    const { data } = supabase.auth.onAuthStateChange(() => {
      void getStaffAuthState().then(setStaffAuth);
    });
    return () => data.subscription.unsubscribe();
  }, [loadPresentations]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    setEditPresentationTitle(selectedPresentation?.title ?? '');
    setEditPresentationDescription(selectedPresentation?.description ?? '');
    setEditPresentationStatus(selectedPresentation?.status ?? 'draft');
  }, [selectedPresentation]);

  useEffect(() => {
    if (!openPresentationMenuId) {
      return undefined;
    }

    window.addEventListener('resize', closeOverflowMenus);
    return () => {
      window.removeEventListener('resize', closeOverflowMenus);
    };
  }, [closeOverflowMenus, openPresentationMenuId]);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadStatus('');
    if (!selectedPresentation || selectedPresentation.is_legacy) {
      setUploadTone('error');
      setUploadStatus('Select a Pitch Room Presentation before adding assets.');
      return;
    }
    if (!file) {
      setUploadTone('error');
      setUploadStatus('Choose a deck or asset file first.');
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setUploadTone('error');
      setUploadStatus('Add a title before uploading. Assets cannot be created from fallback file names.');
      return;
    }
    const cleanTabLabel = tabLabel.trim();
    if (!cleanTabLabel) {
      setUploadTone('error');
      setUploadStatus('Add a tab label before uploading. This is the investor-facing tab name.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setUploadTone('error');
      setUploadStatus('Connect your standard JOBZ CAFE® staff session before uploading.');
      return;
    }
    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setUploadTone('error');
      setUploadStatus(nextAuth.message);
      return;
    }
    const body = new FormData();
    body.append('cellar_file', file);
    body.append('cellar_title', cleanTitle);
    body.append('cellar_tab_label', cleanTabLabel);
    body.append('cellar_summary', summary);
    body.append('cellar_asset_type', assetType);
    body.append('cellar_visibility', visibility);
    body.append('cellar_status', status);
    body.append('cellar_presentation_id', selectedPresentation.id);

    setIsUploading(true);
    try {
      const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_upload_asset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const result = (await response.json()) as CellarUploadAssetResult & { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error === 'CELLAR_STAFF_AUTH_REQUIRED'
            ? 'Your auth session is not linked to a BOH staff record yet. Confirm public.boh_user.auth_user_id matches the signed-in Supabase Auth user.'
            : result.error ?? 'CELLAR_UPLOAD_FAILED',
        );
      }
      const uploadedAsset = result.cellar_asset;
      if (uploadedAsset?.id && uploadedAsset.presentation_id !== selectedPresentation.id) {
        const { error: assignmentError } = await supabase
          .from('cellar_assets')
          .update({ presentation_id: selectedPresentation.id })
          .eq('id', uploadedAsset.id);
        if (assignmentError) {
          throw new Error(assignmentError.message || 'Uploaded, but the asset could not be assigned to the presentation.');
        }
      }
      setUploadTone('success');
      setUploadStatus('Uploaded. The asset is now in the list; use Status and Visibility to control investor access.');
      setTitle('');
      setTabLabel('');
      setSummary('');
      setStatus('published');
      setFile(null);
      await loadPresentations();
      await loadAssets();
      setIsUploadDrawerOpen(false);
    } catch (error) {
      setUploadTone('error');
      setUploadStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const canUploadAsset =
    staffAuth.status === 'ready' &&
    Boolean(selectedPresentation && !selectedPresentation.is_legacy) &&
    Boolean(file) &&
    Boolean(title.trim()) &&
    Boolean(tabLabel.trim());

  const openAssetEditor = (asset: StaffAsset, mode: 'details' | 'narratives' = 'details') => {
    setEditingAsset(asset);
    setIsAssetDetailsDrawerOpen(mode === 'details');
    setIsNarrativeOrganizerOpen(mode === 'narratives');
    setEditAssetTitle(asset.title);
    setEditAssetTabLabel(asset.tab_label ?? '');
    setEditAssetType(asset.asset_type || 'deck');
    setEditAssetVisibility(asset.visibility || 'guest');
    setEditAssetStatus(asset.status || 'published');
    setEditAssetSummary(asset.summary ?? '');
    setEditNarrativeEyebrow(
      typeof asset.metadata?.narrative_eyebrow === 'string' && asset.metadata.narrative_eyebrow.trim()
        ? asset.metadata.narrative_eyebrow
        : CELLAR_NARRATIVE_EYEBROW,
    );
    setEditNarrativeHeading(
      typeof asset.metadata?.narrative_heading === 'string' && asset.metadata.narrative_heading.trim()
        ? asset.metadata.narrative_heading
        : CELLAR_NARRATIVE_HEADING,
    );
    const narratives = normalizeCellarSlideNarratives(asset.slide_narratives);
    setEditSlideNarratives(narratives.length ? narratives : [{ slide: 1, narrative: '' }]);
    setActiveSlideNarrativeIndex(0);
    setIsNarrativeOrganizerOpen(mode === 'narratives');
    setSlideNarrativeStatus('');
    setAssetActionStatus('');
  };

  const openAssetSwap = (asset: StaffAsset) => {
    setSwappingAsset(asset);
    setSwapFile(null);
    setAssetActionStatus('');
  };

  const openPresentationEditor = (presentation: StaffPresentation) => {
    setSelectedPresentationId(presentation.id);
    setEditPresentationTitle(presentation.title);
    setEditPresentationDescription(presentation.description ?? '');
    setEditPresentationStatus(presentation.status);
    setAssetActionStatus('');
    setIsPresentationEditDrawerOpen(true);
  };

  const updateSlideNarrativeRow = (index: number, nextRow: Partial<{ slide: number; narrative: string }>) => {
    setEditSlideNarratives((currentRows) =>
      currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...nextRow } : row)),
    );
  };

  const removeSlideNarrativeRow = (index: number) => {
    setEditSlideNarratives((currentRows) => {
      const nextRows =
        currentRows.length === 1
          ? [{ slide: 1, narrative: '' }]
          : currentRows.filter((_, rowIndex) => rowIndex !== index);
      setActiveSlideNarrativeIndex((currentIndex) => Math.max(0, Math.min(currentIndex, nextRows.length - 1)));
      return nextRows;
    });
  };

  const selectSlideNarrative = (slide: number, rowIndex: number | null) => {
    if (rowIndex !== null) {
      setActiveSlideNarrativeIndex(rowIndex);
      return;
    }
    setEditSlideNarratives((currentRows) => {
      const existingIndex = currentRows.findIndex((row) => row.slide === slide);
      if (existingIndex >= 0) {
        setActiveSlideNarrativeIndex(existingIndex);
        return currentRows;
      }
      const nextRows = [...currentRows, { slide, narrative: '' }];
      setActiveSlideNarrativeIndex(nextRows.length - 1);
      return nextRows;
    });
  };

  const saveSlideNarrative = async (index: number) => {
    if (!editingAsset) return;
    const row = editSlideNarratives[index];
    if (!row || !Number.isInteger(row.slide) || row.slide < 1) {
      setSlideNarrativeStatus('Use a valid slide number before saving.');
      return;
    }

    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setSlideNarrativeStatus(nextAuth.message);
      return;
    }

    const slideNarratives = editSlideNarratives.reduce<Record<string, string>>((result, currentRow) => {
      if (Number.isInteger(currentRow.slide) && currentRow.slide > 0 && currentRow.narrative.trim()) {
        result[String(currentRow.slide)] = currentRow.narrative.trimEnd();
      }
      return result;
    }, {});
    const nextMetadata = {
      ...((editingAsset.metadata && typeof editingAsset.metadata === 'object') ? editingAsset.metadata : {}),
      narrative_eyebrow: editNarrativeEyebrow.trim() || CELLAR_NARRATIVE_EYEBROW,
      narrative_heading: editNarrativeHeading.trim() || CELLAR_NARRATIVE_HEADING,
    };

    setSavingSlideNarrativeIndex(index);
    const { error } = await supabase
      .from('cellar_assets')
      .update({
        slide_narratives: slideNarratives,
        metadata: nextMetadata,
        updated_by_boh_user_id: nextAuth.bohUserId,
      })
      .eq('id', editingAsset.id);

    if (error) {
      setSlideNarrativeStatus(error.message || 'Unable to save slide narrative.');
    } else {
      setSlideNarrativeStatus(`Slide ${row.slide} narrative saved.`);
      const updatedAsset = { ...editingAsset, slide_narratives: slideNarratives, metadata: nextMetadata };
      setEditingAsset(updatedAsset);
      setAssets((currentAssets) =>
        currentAssets.map((asset) => (asset.id === editingAsset.id ? updatedAsset : asset)),
      );
    }
    setSavingSlideNarrativeIndex(null);
  };

  const saveAssetDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAsset) return;
    const cleanTitle = editAssetTitle.trim();
    const cleanTabLabel = editAssetTabLabel.trim();
    if (!cleanTitle || !cleanTabLabel) {
      setAssetActionTone('error');
      setAssetActionStatus('Asset title and tab label are required.');
      return;
    }

    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setAssetActionTone('error');
      setAssetActionStatus(nextAuth.message);
      return;
    }

    const slideNarratives = editSlideNarratives.reduce<Record<string, string>>((result, row) => {
      if (Number.isInteger(row.slide) && row.slide > 0 && row.narrative.trim()) {
        result[String(row.slide)] = row.narrative.trimEnd();
      }
      return result;
    }, {});
    const nextMetadata = {
      ...((editingAsset.metadata && typeof editingAsset.metadata === 'object') ? editingAsset.metadata : {}),
      narrative_eyebrow: editNarrativeEyebrow.trim() || CELLAR_NARRATIVE_EYEBROW,
      narrative_heading: editNarrativeHeading.trim() || CELLAR_NARRATIVE_HEADING,
    };

    setIsSavingAsset(true);
    const { error } = await supabase
      .from('cellar_assets')
      .update({
        title: cleanTitle,
        tab_label: cleanTabLabel,
        asset_type: editAssetType,
        visibility: editAssetVisibility,
        status: editAssetStatus,
        summary: editAssetSummary.trim() || null,
        slide_narratives: slideNarratives,
        metadata: nextMetadata,
        published_at: editAssetStatus === 'published' ? new Date().toISOString() : null,
        updated_by_boh_user_id: nextAuth.bohUserId,
      })
      .eq('id', editingAsset.id);

    if (error) {
      setAssetActionTone('error');
      setAssetActionStatus(error.message || 'Unable to save asset.');
    } else {
      setAssetActionTone('success');
      setAssetActionStatus(`${cleanTitle} saved.`);
      setEditingAsset(null);
      setIsAssetDetailsDrawerOpen(false);
      setIsNarrativeOrganizerOpen(false);
      await loadAssets();
      await loadPresentations();
    }
    setIsSavingAsset(false);
  };

  const swapAssetFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!swappingAsset || !swapFile) {
      setAssetActionTone('error');
      setAssetActionStatus('Choose a replacement file first.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setAssetActionTone('error');
      setAssetActionStatus('Connect your standard JOBZ CAFE® staff session before swapping the file.');
      return;
    }

    const body = new FormData();
    body.append('cellar_asset_id', swappingAsset.id);
    body.append('cellar_file', swapFile);
    setIsSwappingAsset(true);
    setAssetActionStatus('');

    try {
      const response = await fetch(`${cellarSupabaseUrl}/functions/v1/cellar_swap_asset_file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? 'CELLAR_SWAP_ASSET_FAILED');
      }

      setAssetActionTone('success');
      setAssetActionStatus(`${swappingAsset.title} file replaced.`);
      setSwappingAsset(null);
      setSwapFile(null);
      await loadAssets();
    } catch (error) {
      setAssetActionTone('error');
      setAssetActionStatus(error instanceof Error ? error.message : 'Unable to swap asset file.');
    } finally {
      setIsSwappingAsset(false);
    }
  };

  const createPresentation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPresentationFormStatus('');
    const cleanTitle = presentationTitle.trim();
    if (!cleanTitle) {
      setPresentationFormTone('error');
      setPresentationFormStatus('Add a presentation title before creating it.');
      return;
    }

    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setPresentationFormTone('error');
      setPresentationFormStatus(nextAuth.message);
      return;
    }

    setIsCreatingPresentation(true);
    const { data, error } = await supabase
      .from('cellar_presentations')
      .insert({
        title: cleanTitle,
        slug: createCellarSlug(cleanTitle),
        description: presentationDescription.trim() || null,
        status: presentationStatus,
        published_at: presentationStatus === 'published' ? new Date().toISOString() : null,
        created_by_boh_user_id: nextAuth.bohUserId,
        updated_by_boh_user_id: nextAuth.bohUserId,
      })
      .select('id')
      .single();

    if (error) {
      setPresentationFormTone('error');
      setPresentationFormStatus(error.message || 'Unable to create presentation.');
    } else {
      setPresentationFormTone('success');
      setPresentationFormStatus(`${cleanTitle} created.`);
      setAssetActionTone('success');
      setAssetActionStatus(`${cleanTitle} created.`);
      setPresentationTitle('');
      setPresentationDescription('');
      setPresentationStatus('draft');
      setIsPresentationDrawerOpen(false);
      await loadPresentations();
      setSelectedPresentationId(data.id);
    }
    setIsCreatingPresentation(false);
  };

  const updatePresentationStatus = async (presentation: StaffPresentation, nextStatus: 'draft' | 'published' | 'archived') => {
    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setAssetActionTone('error');
      setAssetActionStatus(nextAuth.message);
      return;
    }

    const { error } = await supabase
      .from('cellar_presentations')
      .update({
        status: nextStatus,
        published_at: nextStatus === 'published' ? new Date().toISOString() : null,
        updated_by_boh_user_id: nextAuth.bohUserId,
      })
      .eq('id', presentation.id);

    if (error) {
      setAssetActionTone('error');
      setAssetActionStatus(error.message || 'Unable to update presentation.');
    } else {
      setAssetActionTone('success');
      setAssetActionStatus(
        nextStatus === 'archived'
          ? `${presentation.title} removed from Pitch Room Presentations.`
          : `${presentation.title} moved to ${formatAssetStatus(nextStatus)}.`,
      );
      await loadPresentations();
    }
  };

  const savePresentation = async () => {
    if (!selectedPresentation) return;
    const cleanTitle = editPresentationTitle.trim();
    if (!cleanTitle) {
      setAssetActionTone('error');
      setAssetActionStatus('Presentation title is required.');
      return;
    }

    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setAssetActionTone('error');
      setAssetActionStatus(nextAuth.message);
      return;
    }

    const { error } = await supabase
      .from('cellar_presentations')
      .update({
        title: cleanTitle,
        description: editPresentationDescription.trim() || null,
        status: editPresentationStatus,
        published_at: editPresentationStatus === 'published'
          ? selectedPresentation.published_at || new Date().toISOString()
          : null,
        updated_by_boh_user_id: nextAuth.bohUserId,
      })
      .eq('id', selectedPresentation.id);

    if (error) {
      setAssetActionTone('error');
      setAssetActionStatus(error.message || 'Unable to save presentation.');
    } else {
      setAssetActionTone('success');
      setAssetActionStatus(`${cleanTitle} saved.`);
      setIsPresentationEditDrawerOpen(false);
      await loadPresentations();
    }
  };

  const updateAssetStatus = async (asset: StaffAsset, nextStatus: 'draft' | 'published' | 'archived') => {
    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setAssetActionTone('error');
      setAssetActionStatus(nextAuth.message);
      return;
    }

    setUpdatingAssetId(asset.id);
    setAssetActionStatus('');
    const { error } = await supabase
      .from('cellar_assets')
      .update({ status: nextStatus })
      .eq('id', asset.id);

    if (error) {
      setAssetActionTone('error');
      setAssetActionStatus(error.message || 'Unable to update asset status.');
    } else {
      setAssetActionTone('success');
      setAssetActionStatus(
        nextStatus === 'archived'
          ? `${asset.title} removed.`
          : `${asset.title} moved to ${formatAssetStatus(nextStatus)}.`,
      );
      setAssets((current) =>
        nextStatus === 'archived'
          ? current.filter((item) => item.id !== asset.id)
          : current.map((item) => (item.id === asset.id ? { ...item, status: nextStatus } : item)),
      );
      if (nextStatus === 'archived') {
        await loadPresentations();
      }
    }
    setUpdatingAssetId(null);
  };

  const saveAssetOrder = async (orderedAssets: StaffAsset[], movedAsset: StaffAsset) => {
    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setAssetActionTone('error');
      setAssetActionStatus(nextAuth.message);
      return;
    }

    const orderedUpdates = orderedAssets.map((item, index) => ({
      ...item,
      sort_order: (index + 1) * 10,
    }));

    setUpdatingAssetId(movedAsset.id);
    setAssetActionStatus('');
    const results = await Promise.all(
      orderedUpdates.map((item) =>
        supabase
          .from('cellar_assets')
          .update({ sort_order: item.sort_order, updated_by_boh_user_id: nextAuth.bohUserId })
          .eq('id', item.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setAssetActionTone('error');
      setAssetActionStatus(failed.error.message || 'Unable to reorder assets.');
    } else {
      setAssets(orderedUpdates);
      setAssetActionTone('success');
      setAssetActionStatus(`${movedAsset.tab_label || movedAsset.title} reordered.`);
    }
    setUpdatingAssetId(null);
  };

  const createPresentationFromUnassigned = async () => {
    if (!assets.length) return;
    const nextAuth = await getStaffAuthState();
    setStaffAuth(nextAuth);
    if (nextAuth.status !== 'ready') {
      setAssetActionTone('error');
      setAssetActionStatus(nextAuth.message);
      return;
    }

    const baseTitle = assets.find((asset) => asset.asset_type === 'deck')?.title || 'Pitch Room Presentation';
    const { data: presentation, error: presentationError } = await supabase
      .from('cellar_presentations')
      .insert({
        title: toCellarTitleCase(baseTitle),
        slug: createCellarSlug(baseTitle),
        description: 'Recovered from published Pitch Room items.',
        status: 'published',
        published_at: new Date().toISOString(),
        created_by_boh_user_id: nextAuth.bohUserId,
        updated_by_boh_user_id: nextAuth.bohUserId,
      })
      .select('id')
      .single();
    if (presentationError || !presentation?.id) {
      setAssetActionTone('error');
      setAssetActionStatus(presentationError?.message || 'Unable to create a presentation for these items.');
      return;
    }

    const { error: updateError } = await supabase
      .from('cellar_assets')
      .update({ presentation_id: presentation.id, updated_by_boh_user_id: nextAuth.bohUserId })
      .is('presentation_id', null)
      .neq('status', 'archived');
    if (updateError) {
      setAssetActionTone('error');
      setAssetActionStatus(updateError.message || 'Presentation created, but the items could not be attached.');
      return;
    }

    setAssetActionTone('success');
    setAssetActionStatus(`${toCellarTitleCase(baseTitle)} created from the existing items.`);
    await loadPresentations();
    setSelectedPresentationId(presentation.id);
  };

  const dropAssetOn = async (targetAsset: StaffAsset) => {
    if (!draggingAssetId || draggingAssetId === targetAsset.id) {
      setDraggingAssetId(null);
      return;
    }
    const fromIndex = assets.findIndex((item) => item.id === draggingAssetId);
    const toIndex = assets.findIndex((item) => item.id === targetAsset.id);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingAssetId(null);
      return;
    }

    const reordered = [...assets];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setDraggingAssetId(null);
    await saveAssetOrder(reordered, moved);
  };

  const assetCounts = {
    total: assets.length,
    published: assets.filter((asset) => asset.status === 'published').length,
    locked: assets.filter((asset) =>
      ['verified', 'appendix_granted', 'staff_only'].includes(asset.visibility),
    ).length,
  };

  const narrativeOrganizer =
    editingAsset && isNarrativeOrganizerOpen && isCellarPresentationAsset(editingAsset) ? (
      <section className="staff-narrative-organizer" aria-label="Slide narrative organizer">
        <header className="staff-narrative-organizer-header">
          <div>
            <span>Pitch deck narrative</span>
            <h2>{editingAsset.tab_label || editingAsset.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsNarrativeOrganizerOpen(false)}
          >
            Back to presentation
          </button>
        </header>
        <div className="staff-narrative-organizer-body">
          <section className="staff-narrative-slide-map" aria-label="Slide narrative navigator">
            <div className="staff-narrative-map-toolbar">
              <strong>{narrativeCount} with {narrativeCount === 1 ? 'narrative' : 'narratives'}</strong>
            </div>
            {hasDuplicateNarrativeSlides && (
              <p className="staff-narrative-map-warning">Two rows use the same slide number. Review before saving.</p>
            )}
          </section>
          <div className="staff-narrative-workbench">
            <section className="staff-narrative-preview" aria-label="Selected slide preview">
              <section className="staff-narrative-display-settings" aria-label="Narrative display settings">
                <header>
                  <span>Narrative display</span>
                </header>
                <div className="staff-narrative-label-grid">
                  <label>
                    <span>Narrative label</span>
                    <input
                      value={editNarrativeEyebrow}
                      onChange={(event) => setEditNarrativeEyebrow(event.target.value)}
                      placeholder={CELLAR_NARRATIVE_EYEBROW}
                      spellCheck
                    />
                  </label>
                  <label>
                    <span>Narrative heading</span>
                    <input
                      value={editNarrativeHeading}
                      onChange={(event) => setEditNarrativeHeading(event.target.value)}
                      placeholder={CELLAR_NARRATIVE_HEADING}
                      spellCheck
                    />
                  </label>
                </div>
              </section>
              <BackendAssetView
                asset={editingAsset}
                selectedSlideNumber={activeSlideNarrative.slide}
                canExpand={false}
                onSlideChange={(slideNumber) =>
                  selectSlideNarrative(slideNumber, narrativeRowsBySlide.get(slideNumber)?.index ?? null)
                }
              />
            </section>
            <div className="staff-narrative-editor">
              <article className="staff-slide-narrative-row staff-slide-narrative-editor-card">
                <header>
                  <div className="staff-selected-slide-label">
                    <span>Selected slide</span>
                    <strong>{activeSlideNarrative.slide}</strong>
                  </div>
                  <div className="staff-slide-row-actions">
                  </div>
                </header>
                <label>
                  <span>Narrative</span>
                  <textarea
                    value={activeSlideNarrative.narrative}
                    onChange={(event) =>
                      updateSlideNarrativeRow(activeSlideNarrativeIndex, { narrative: event.target.value })
                    }
                    placeholder="What the founder would say live on this slide"
                    spellCheck
                  />
                </label>
                <footer>
                  {slideNarrativeStatus && <p className="staff-slide-narrative-status">{slideNarrativeStatus}</p>}
                  <button
                    type="button"
                    className="staff-slide-save"
                    onClick={() => void saveSlideNarrative(activeSlideNarrativeIndex)}
                    disabled={
                      savingSlideNarrativeIndex === activeSlideNarrativeIndex ||
                      !hasSlideNarrativeChanges
                    }
                  >
                    {savingSlideNarrativeIndex === activeSlideNarrativeIndex ? 'Saving' : 'Save narrative'}
                  </button>
                </footer>
              </article>
            </div>
          </div>
        </div>
      </section>
    ) : null;

  return (
    <>
      <section className={`staff-panel staff-asset-workspace is-full-height ${narrativeOrganizer ? 'is-organizing-narratives' : ''}`}>
        <div className="staff-panel-heading staff-asset-heading">
          <div>
            <p>Pitch room</p>
            <h2>Presentation library</h2>
            {!narrativeOrganizer && <span>{presentationCountLabel}</span>}
          </div>
          <div className="staff-asset-heading-actions">
            <button
              type="button"
              className={`staff-contact-filter-button ${activePresentationFilterCount ? 'is-active' : ''}`}
              onClick={() => setIsPresentationFilterDrawerOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {activePresentationFilterCount > 0 && <span>{activePresentationFilterCount}</span>}
            </button>
            <button type="button" className="staff-button-primary" onClick={() => setIsPresentationDrawerOpen(true)}>
              New presentation
            </button>
          </div>
        </div>
        <div className="staff-assets-split">
          {narrativeOrganizer ? (
            narrativeOrganizer
          ) : (
          <>
          <aside className="staff-asset-project-list" aria-label="Pitch Room Presentations">
            {filteredPresentations.length ? filteredPresentations.map((presentation) => (
              <div
                className={`staff-asset-project-card ${selectedPresentationId === presentation.id ? 'is-selected' : ''}`}
                key={presentation.id}
              >
                <button
                  type="button"
                  className="staff-asset-project-item"
                  onClick={() => setSelectedPresentationId(presentation.id)}
                >
                  <span>{presentation.is_legacy ? 'Needs repair' : formatAssetStatus(presentation.status)}</span>
                  <strong>{presentation.title}</strong>
                  <small>{presentation.description || 'Pitch Room Presentation'}</small>
                  {selectedPresentationId === presentation.id && (
                    <div className="staff-asset-project-stats">
                      <span>{assetCounts.total} assets</span>
                      <span>{assetCounts.published} published</span>
                      <span>{assetCounts.locked} restricted</span>
                    </div>
                  )}
                </button>
                {!presentation.is_legacy && (
                  <div className="staff-overflow-menu">
                      <button
                        type="button"
                        className="staff-overflow-trigger"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (openPresentationMenuId === presentation.id) {
                            closeOverflowMenus();
                            return;
                          }
                          setOpenPresentationMenuId(presentation.id);
                        }}
                        aria-label={`Open actions for ${presentation.title}`}
                        aria-expanded={openPresentationMenuId === presentation.id}
                      >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {openPresentationMenuId === presentation.id && (
                      <div className="staff-overflow-panel">
                        <button
                          type="button"
                          onClick={() => {
                            closeOverflowMenus();
                            openPresentationEditor(presentation);
                          }}
                        >
                          Edit details
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeOverflowMenus();
                            setSelectedPresentationId(presentation.id);
                            setIsUploadDrawerOpen(true);
                          }}
                        >
                          Add asset
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeOverflowMenus();
                            void updatePresentationStatus(
                              presentation,
                              presentation.status === 'published' ? 'draft' : 'published',
                            );
                          }}
                        >
                          {presentation.status === 'published' ? 'Move to draft' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => {
                            closeOverflowMenus();
                            void updatePresentationStatus(presentation, 'archived');
                          }}
                        >
                          Archive presentation
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )) : (
              <StaffEmptyState
                title={presentations.length ? 'No presentations match' : 'No presentations yet'}
                body={
                  presentations.length
                    ? 'Adjust the search filter to see more Pitch Room Presentations.'
                    : 'Create a Pitch Room Presentation before adding investor-facing assets.'
                }
              />
            )}
          </aside>
          <div className="staff-asset-list-panel">
            <div className="staff-asset-list-heading">
              <div>
                <p>Details</p>
                <h3>{selectedPresentation?.title || 'Select a presentation'}</h3>
              </div>
            </div>
            {selectedPresentation?.is_legacy && (
              <section className="staff-presentation-editor" aria-label="Unassigned assets details">
                <div>
                  <strong>Unassigned assets</strong>
                  <p>
                    These items are published but are not attached to a Pitch Room Presentation yet.
                  </p>
                </div>
                <div className="staff-presentation-editor-actions">
                  <button type="button" onClick={() => void createPresentationFromUnassigned()}>
                    Create presentation from these items
                  </button>
                  <span>{assets.length} item{assets.length === 1 ? '' : 's'} ready to attach</span>
                </div>
              </section>
            )}
            <div className="staff-asset-scroll-region">
              {isLoading && (
                <StaffEmptyState title="Loading assets" body="Checking BOH-DEV for uploaded CELLAR assets." />
              )}
              {!isLoading && !selectedPresentation && (
                <StaffEmptyState
                  title="No presentation selected"
                  body="Create or select a Pitch Room Presentation before adding assets."
                />
              )}
              {!isLoading && selectedPresentation && !assets.length && !assetActionStatus && (
                <StaffEmptyState title="No assets yet" body="Use Add asset to add the first tab, deck, video, or document to this presentation." />
              )}
              {!isLoading && selectedPresentation && Boolean(assets.length) && !filteredAssets.length && !assetActionStatus && (
                <StaffEmptyState title="No assets match" body="Adjust the asset status or visibility filters to see more assets." />
              )}
              {!isLoading && selectedPresentation && Boolean(filteredAssets.length) && (
                <div className="staff-asset-table" aria-label="Uploaded assets">
                  <div className="staff-asset-table-head">
                    <span aria-hidden="true" />
                    <span>Tab</span>
                    <span>Asset</span>
                    <span>Visibility</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {filteredAssets.map((asset) => (
                    <div
                      className={`staff-asset-row ${draggingAssetId === asset.id ? 'is-dragging' : ''}`}
                      key={asset.id}
                      draggable={filteredAssets.length > 1 && updatingAssetId !== asset.id}
                      onDragStart={(event) => {
                        const dragTarget = event.target as HTMLElement;
                        if (dragTarget.closest('button')) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', asset.id);
                        setDraggingAssetId(asset.id);
                      }}
                      onDragOver={(event) => {
                        if (draggingAssetId && draggingAssetId !== asset.id) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        void dropAssetOn(asset);
                      }}
                      onDragEnd={() => setDraggingAssetId(null)}
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      <div>
                        <strong>{asset.tab_label || asset.title}</strong>
                      </div>
                      <div>
                        <strong>{asset.title}</strong>
                      </div>
                      <p>{formatVisibility(asset.visibility)}</p>
                      <p>{formatAssetStatus(asset.status)}</p>
                      <div className="staff-asset-actions-cell">
                        <div className="staff-overflow-menu">
                          <button
                            type="button"
                            className="staff-overflow-trigger"
                            draggable={false}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setOpenPresentationMenuId(null);
                              setOpenAssetMenuId((current) => (current === asset.id ? null : asset.id));
                            }}
                            aria-label={`Open actions for ${asset.title}`}
                            aria-expanded={openAssetMenuId === asset.id}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {openAssetMenuId === asset.id && (
                            <div className="staff-overflow-panel" role="menu">
                              {isCellarPresentationAsset(asset) && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    closeOverflowMenus();
                                    openAssetEditor(asset, 'narratives');
                                  }}
                                >
                                  Slide narratives
                                </button>
                              )}
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeOverflowMenus();
                                  openAssetEditor(asset, 'details');
                                }}
                              >
                                Edit details
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {assetActionStatus && (
              <p className={`staff-upload-status is-${assetActionTone}`}>{assetActionStatus}</p>
            )}
          </div>
          </>
          )}
        </div>
      </section>
      {isUploadDrawerOpen && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer staff-asset-upload-drawer" aria-label="Upload asset">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => setIsUploadDrawerOpen(false)}
              aria-label="Close upload asset"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <form className="staff-upload-panel" onSubmit={handleUpload} noValidate>
              <Upload className="h-6 w-6" aria-hidden="true" />
              <h2>Add asset</h2>
              <p>
                Add a tab, deck, video, or document to {selectedPresentation?.title || 'the selected Pitch Room Presentation'}.
              </p>
              {staffAuth.status !== 'ready' ? (
                <StaffAuthPanel onReady={setStaffAuth} />
              ) : (
                <div className="staff-session-pill">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>{staffAuth.email}</span>
                </div>
              )}
              <label>
                <span>File</span>
                <input
                  id="staff-asset-file"
                  className="staff-upload-native-file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    if (nextFile) {
                      setUploadTone('info');
                      setUploadStatus(`${nextFile.name} selected. Confirm title, type, visibility, and status, then upload.`);
                    }
                  }}
                />
              </label>
              <div className="staff-upload-file-row">
                <label className="staff-file-picker" htmlFor="staff-asset-file">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Choose file
                </label>
                <div className="staff-upload-file-state">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <strong>{file ? file.name : 'No file selected'}</strong>
                  {file && <span>{formatFileSize(file.size)}</span>}
                </div>
              </div>
              <label>
                <span>Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Core pitch deck"
                  aria-required="true"
                  required
                  spellCheck
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Tab label</span>
                <input
                  value={tabLabel}
                  onChange={(event) => setTabLabel(event.target.value)}
                  placeholder="Core Story"
                  aria-required="true"
                  required
                  spellCheck
                  autoComplete="off"
                />
              </label>
              <div className="staff-upload-selects">
                <CellarSelect label="Type" value={assetType} onChange={setAssetType} options={[
                  { value: 'deck', label: 'Deck' },
                  { value: 'document', label: 'Document' },
                  { value: 'video', label: 'Video' },
                ]} />
                <CellarSelect label="Visibility" value={visibility} onChange={setVisibility} options={[
                  { value: 'guest', label: 'Guest + verified' },
                  { value: 'verified', label: 'Verified only' },
                  { value: 'appendix_granted', label: 'Appendix granted' },
                  { value: 'staff_only', label: 'Staff only' },
                ]} />
                <CellarSelect label="Status" value={status} onChange={setStatus} options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                ]} />
              </div>
              <label>
                <span>Summary</span>
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Short investor-facing context" />
              </label>
              <div className="staff-upload-actions">
                <button type="submit" disabled={isUploading || !canUploadAsset}>
                  {isUploading ? 'Uploading...' : 'Upload selected asset'}
                </button>
              </div>
              {uploadStatus && <p className={`staff-upload-status is-${uploadTone}`}>{uploadStatus}</p>}
            </form>
          </aside>
        </div>
      )}
      {editingAsset && isAssetDetailsDrawerOpen && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer staff-asset-upload-drawer" aria-label="Edit asset">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => {
                setEditingAsset(null);
                setIsAssetDetailsDrawerOpen(false);
                setIsNarrativeOrganizerOpen(false);
              }}
              aria-label="Close edit asset"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <form className="staff-upload-panel" onSubmit={saveAssetDetails} noValidate>
              <FileText className="h-6 w-6" aria-hidden="true" />
              <h2>Edit asset</h2>
              <p>Update the investor-facing tab, publishing status, and slide narrative for this asset.</p>
              <label>
                <span>Asset title</span>
                <input
                  value={editAssetTitle}
                  onChange={(event) => setEditAssetTitle(event.target.value)}
                  placeholder="Core pitch deck"
                  required
                  spellCheck
                />
              </label>
              <label>
                <span>Tab label</span>
                <input
                  value={editAssetTabLabel}
                  onChange={(event) => setEditAssetTabLabel(event.target.value)}
                  placeholder="Core Story"
                  required
                  spellCheck
                />
              </label>
              <div className="staff-upload-selects">
                <CellarSelect label="Type" value={editAssetType} onChange={setEditAssetType} options={[
                  { value: 'deck', label: 'Deck' },
                  { value: 'document', label: 'Document' },
                  { value: 'video', label: 'Video' },
                ]} />
                <CellarSelect label="Visibility" value={editAssetVisibility} onChange={setEditAssetVisibility} options={[
                  { value: 'guest', label: 'Guest + verified' },
                  { value: 'verified', label: 'Verified only' },
                  { value: 'appendix_granted', label: 'Appendix granted' },
                  { value: 'staff_only', label: 'Staff only' },
                ]} />
                <CellarSelect label="Status" value={editAssetStatus} onChange={setEditAssetStatus} options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                ]} />
              </div>
              <label>
                <span>Asset summary</span>
                <textarea
                  value={editAssetSummary}
                  onChange={(event) => setEditAssetSummary(event.target.value)}
                  placeholder="Short fallback narrative if slide narrative has not been entered yet"
                  spellCheck
                />
              </label>
              <section className="staff-asset-actions" aria-label="Asset actions">
                <div>
                  <span>Asset actions</span>
                  <p>Save metadata changes, replace the underlying file, or remove this asset.</p>
                </div>
                <div className="staff-upload-actions">
                  <button
                    type="submit"
                    disabled={
                      isSavingAsset ||
                      !editAssetTitle.trim() ||
                      !editAssetTabLabel.trim() ||
                      !hasAssetDetailsChanges
                    }
                  >
                    {isSavingAsset ? 'Saving...' : 'Save asset details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingAsset) return;
                      openAssetSwap(editingAsset);
                    }}
                  >
                    Swap file
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAsset(null);
                      setIsAssetDetailsDrawerOpen(false);
                      setIsNarrativeOrganizerOpen(false);
                    }}
                  >
                    Close
                  </button>
                </div>
                {editingAsset && (
                  <button
                    type="button"
                    className="staff-asset-remove-action"
                    disabled={updatingAssetId === editingAsset.id}
                    onClick={() => {
                      void updateAssetStatus(editingAsset, 'archived');
                      setEditingAsset(null);
                      setIsAssetDetailsDrawerOpen(false);
                      setIsNarrativeOrganizerOpen(false);
                    }}
                  >
                    Remove asset
                  </button>
                )}
              </section>
            </form>
          </aside>
        </div>
      )}
      {swappingAsset && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer staff-asset-upload-drawer" aria-label="Swap asset file">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => setSwappingAsset(null)}
              aria-label="Close swap asset file"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <form className="staff-upload-panel" onSubmit={swapAssetFile} noValidate>
              <RefreshCw className="h-6 w-6" aria-hidden="true" />
              <h2>Swap file</h2>
              <p>Replace the uploaded file for {swappingAsset.title}. The asset title, tab, order, status, and slide narrative stay in place.</p>
              <label>
                <span>Replacement file</span>
                <input
                  id="staff-swap-asset-file"
                  className="staff-upload-native-file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  onChange={(event) => setSwapFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <div className="staff-upload-file-row">
                <label className="staff-file-picker" htmlFor="staff-swap-asset-file">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Choose file
                </label>
                <div className="staff-upload-file-state">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <strong>{swapFile ? swapFile.name : 'No file selected'}</strong>
                  {swapFile && <span>{formatFileSize(swapFile.size)}</span>}
                </div>
              </div>
              <div className="staff-upload-actions">
                <button type="submit" disabled={isSwappingAsset || !swapFile}>
                  {isSwappingAsset ? 'Swapping...' : 'Swap file'}
                </button>
                <button type="button" onClick={() => setSwappingAsset(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
      {isPresentationEditDrawerOpen && selectedPresentation && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer staff-asset-upload-drawer" aria-label="Edit presentation">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => setIsPresentationEditDrawerOpen(false)}
              aria-label="Close edit presentation"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <form
              className="staff-upload-panel"
              onSubmit={(event) => {
                event.preventDefault();
                void savePresentation();
              }}
              noValidate
            >
              <Presentation className="h-6 w-6" aria-hidden="true" />
              <h2>Edit presentation</h2>
              <p>Update the presentation name, description, and publishing state.</p>
              <label>
                <span>Presentation title</span>
                <input
                  value={editPresentationTitle}
                  onChange={(event) => setEditPresentationTitle(uppercaseFirstTypedCharacter(event.target.value))}
                  placeholder="Presentation title"
                  required
                  spellCheck
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={editPresentationDescription}
                  onChange={(event) => setEditPresentationDescription(event.target.value)}
                  placeholder="Short staff-facing context"
                  spellCheck
                />
              </label>
              <CellarSelect label="Status" value={editPresentationStatus} onChange={setEditPresentationStatus} options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]} />
              <div className="staff-upload-actions">
                <button type="submit" disabled={!editPresentationTitle.trim() || !hasPresentationChanges}>
                  Save presentation
                </button>
                <button type="button" onClick={() => setIsPresentationEditDrawerOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
      {isPresentationDrawerOpen && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer staff-asset-upload-drawer" aria-label="New presentation">
            <button
              type="button"
              className="cellar-sheet-close"
              onClick={() => setIsPresentationDrawerOpen(false)}
              aria-label="Close new presentation"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <form className="staff-upload-panel" onSubmit={createPresentation} noValidate>
              <Presentation className="h-6 w-6" aria-hidden="true" />
              <h2>New presentation</h2>
              <p>Create a Pitch Room Presentation, then add assets inside it.</p>
              {staffAuth.status !== 'ready' ? (
                <StaffAuthPanel onReady={setStaffAuth} />
              ) : (
                <div className="staff-session-pill">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>{staffAuth.email}</span>
                </div>
              )}
              <label>
                <span>Presentation title</span>
                <input
                  value={presentationTitle}
                  onChange={(event) => setPresentationTitle(uppercaseFirstTypedCharacter(event.target.value))}
                  placeholder="Seed round pitch"
                  aria-required="true"
                  required
                  spellCheck
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={presentationDescription}
                  onChange={(event) => setPresentationDescription(event.target.value)}
                  placeholder="Short staff-facing context"
                  spellCheck
                />
              </label>
              <CellarSelect label="Status" value={presentationStatus} onChange={setPresentationStatus} options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
              ]} />
              <div className="staff-upload-actions">
                <button type="submit" disabled={isCreatingPresentation || !presentationTitle.trim()}>
                  {isCreatingPresentation ? 'Creating...' : 'Create presentation'}
                </button>
              </div>
              {presentationFormStatus && (
                <p className={`staff-upload-status is-${presentationFormTone}`}>{presentationFormStatus}</p>
              )}
            </form>
          </aside>
        </div>
      )}
      {isPresentationFilterDrawerOpen && !narrativeOrganizer && (
        <div className="staff-contact-edit-backdrop" role="presentation">
          <aside className="staff-contact-edit-drawer staff-contact-filter-drawer" aria-label="Filter presentations" aria-modal="true" role="dialog">
            <button
              type="button"
              className="staff-contact-edit-close"
              onClick={() => setIsPresentationFilterDrawerOpen(false)}
              aria-label="Close presentation filters"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <p>Presentation library</p>
            <h2>Filters</h2>
            <div className="staff-contact-edit-fields">
              <label>
                <span>Search</span>
                <input
                  value={presentationQuery}
                  onChange={(event) => setPresentationQuery(event.target.value)}
                  placeholder="Search presentations and assets"
                  spellCheck={false}
                />
              </label>
              <CellarSelect
                label="Presentation status"
                value={presentationStatusFilter}
                onChange={setPresentationStatusFilter}
                options={presentationStatusFilterOptions}
              />
              <CellarSelect
                label="Asset status"
                value={assetStatusFilter}
                onChange={setAssetStatusFilter}
                options={assetStatusFilterOptions}
              />
              <CellarSelect
                label="Asset visibility"
                value={assetVisibilityFilter}
                onChange={setAssetVisibilityFilter}
                options={assetVisibilityFilterOptions}
              />
              <p className="staff-contact-confirm-note">
                Showing {filteredPresentations.length} of {presentations.length} presentations
                {selectedPresentation ? ` and ${filteredAssets.length} of ${assets.length} assets.` : '.'}
              </p>
            </div>
            <div className="staff-contact-edit-footer">
              <button
                type="button"
                onClick={() => {
                  setPresentationQuery('');
                  setPresentationStatusFilter('active');
                  setAssetStatusFilter('all');
                  setAssetVisibilityFilter('all');
                }}
              >
                Clear
              </button>
              <button type="button" onClick={() => setIsPresentationFilterDrawerOpen(false)}>
                Apply
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function StaffQA() {
  const [qas, setQas] = useState<PreparedQA[]>([]);
  const [presentations, setPresentations] = useState<StaffPresentation[]>([]);
  const [assets, setAssets] = useState<StaffAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [selectedPresentationId, setSelectedPresentationId] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState(getQaDefaultForm());
  const [isSaving, setIsSaving] = useState(false);

  const loadStaffQa = useCallback(async () => {
    setIsLoading(true);
    setStatus('');
    const [qaResult, presentationResult, assetResult] = await Promise.all([
      supabase
        .from('cellar_prepared_qa')
        .select('id, question, answer, topic, status, visibility, related_asset_id, sort_order, published_at, updated_at, created_at')
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('cellar_presentations')
        .select('id, title, slug, description, status, sort_order, published_at')
        .order('sort_order', { ascending: true }),
      supabase
        .from('cellar_assets')
        .select('id, presentation_id, title, asset_type, visibility, status, tab_label, summary, storage_bucket, storage_path, mime_type, sort_order, slide_narratives, metadata')
        .order('sort_order', { ascending: true }),
    ]);

    const firstError = qaResult.error ?? presentationResult.error ?? assetResult.error;
    if (firstError) {
      setTone('error');
      setStatus(getFriendlyCellarError(firstError, 'Unable to load Q&A workspace.'));
      setQas([]);
      setPresentations([]);
      setAssets([]);
    } else {
      setQas((qaResult.data ?? []) as PreparedQA[]);
      setPresentations((presentationResult.data ?? []) as StaffPresentation[]);
      setAssets((assetResult.data ?? []) as StaffAsset[]);
      setSelectedPresentationId((current) => current);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadStaffQa();
  }, [loadStaffQa]);

  const qaStatusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'needs_review', label: 'Needs review' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
  ];
  const qaStatusFilterOptions = [{ value: 'all', label: 'All status' }, ...qaStatusOptions];
  const qaAudienceOptions = [
    { value: 'guest', label: 'Guest' },
    { value: 'verified', label: 'Verified investor' },
    { value: 'appendix_granted', label: 'Appendix granted' },
    { value: 'staff_only', label: 'Staff only' },
  ];
  const qaAudienceFilterOptions = [{ value: 'all', label: 'All audience' }, ...qaAudienceOptions];
  const activeSourcePresentations = presentations.filter((presentation) => presentation.status !== 'archived');
  const activeSourcePresentationIds = new Set(activeSourcePresentations.map((presentation) => presentation.id));
  const visibleSourceAssets = assets.filter(
    (asset) =>
      asset.status !== 'archived' &&
      (!asset.presentation_id || activeSourcePresentationIds.has(asset.presentation_id)),
  );
  const presentationSourceOptions = [
    { value: '', label: 'All active sources' },
    ...activeSourcePresentations.map((presentation) => ({ value: presentation.id, label: presentation.title })),
  ];
  const sourceAssetOptions = [
    { value: '', label: 'Manual / no source' },
    ...visibleSourceAssets.map((asset) => ({ value: asset.id, label: asset.tab_label || asset.title })),
  ];

  const filteredQas = qas.filter((qa) => {
    const matchesStatus = statusFilter === 'all' ? qa.status !== 'archived' : qa.status === statusFilter;
    const matchesAudience = audienceFilter === 'all' || qa.visibility === audienceFilter;
    const relatedAsset = qa.related_asset_id ? assets.find((asset) => asset.id === qa.related_asset_id) : null;
    const matchesSource = selectedPresentationId
      ? relatedAsset?.presentation_id === selectedPresentationId
      : !relatedAsset || relatedAsset.status !== 'archived';
    const text = `${qa.question} ${qa.answer} ${qa.topic ?? ''}`.toLowerCase();
    return matchesStatus && matchesAudience && matchesSource && text.includes(query.trim().toLowerCase());
  });

  const openEditor = (qa?: PreparedQA) => {
    setForm(getQaDefaultForm(qa));
    setStatus('');
    setIsEditorOpen(true);
  };

  const saveQa = async (event: FormEvent) => {
    event.preventDefault();
    const cleanQuestion = form.question.trim();
    const cleanAnswer = form.answer.trim();
    if (!cleanQuestion || !cleanAnswer) {
      setTone('error');
      setStatus('Add a question and answer before saving.');
      return;
    }

    const staffAuth = await getStaffAuthState();
    if (staffAuth.status !== 'ready') {
      setTone('error');
      setStatus(staffAuth.message);
      return;
    }

    const payload = {
      question: cleanQuestion,
      answer: cleanAnswer,
      topic: form.topic?.trim() || null,
      status: form.status,
      visibility: form.visibility,
      related_asset_id: form.related_asset_id || null,
      sort_order: Number(form.sort_order) || 0,
      published_at: form.status === 'published' ? new Date().toISOString() : null,
      updated_by_boh_user_id: staffAuth.bohUserId,
      ...(form.id ? {} : { created_by_boh_user_id: staffAuth.bohUserId }),
    };

    setIsSaving(true);
    const result = form.id
      ? await supabase.from('cellar_prepared_qa').update(payload).eq('id', form.id)
      : await supabase.from('cellar_prepared_qa').insert(payload);
    setIsSaving(false);

    if (result.error) {
      setTone('error');
      setStatus(getFriendlyCellarError(result.error, 'Unable to save Q&A.'));
      return;
    }

    setTone('success');
    setStatus('Q&A saved.');
    setIsEditorOpen(false);
    await loadStaffQa();
  };

  return (
    <>
      <section className="staff-panel staff-qa-workspace is-full-height">
        <div className="staff-panel-heading">
          <div>
            <p>Prepared answers</p>
            <h2>Questions and answers</h2>
          </div>
          <div className="staff-qa-heading-actions">
            <button type="button" onClick={() => openEditor()}>
              Add Q&A
            </button>
          </div>
        </div>

        <div className="staff-qa-controls">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Q&A" />
          <CellarSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={qaStatusFilterOptions} />
          <CellarSelect label="Audience" value={audienceFilter} onChange={setAudienceFilter} options={qaAudienceFilterOptions} />
          <CellarSelect
            label="Source"
            value={selectedPresentationId}
            onChange={setSelectedPresentationId}
            options={presentationSourceOptions}
          />
        </div>

        {isLoading && <StaffEmptyState title="Loading prepared answers" body="Checking prepared answers and presentation assets." />}
        {!isLoading && status && <p className={`staff-upload-status is-${tone}`}>{status}</p>}
        {!isLoading && !filteredQas.length && !status && (
          <StaffEmptyState
            title="No prepared answers yet"
            body="Use Add Q&A to create prepared investor answers."
          />
        )}
        {!isLoading && filteredQas.length > 0 && (
          <div className="staff-qa-card-grid">
            {filteredQas.map((qa) => {
              return (
                <button type="button" className="staff-qa-card" key={qa.id} onClick={() => openEditor(qa)}>
                  <div>
                    <span>{qa.topic || 'Investor answers'}</span>
                    <strong>{formatAssetStatus(qa.status)}</strong>
                  </div>
                  <h3>{qa.question}</h3>
                  <p>{qa.answer}</p>
                  <footer>
                    <span>{formatVisibility(qa.visibility)}</span>
                  </footer>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {isEditorOpen && (
        <div className="cellar-sheet-backdrop" role="presentation">
          <aside className="cellar-email-sheet verified-access-drawer staff-asset-upload-drawer" aria-label="Edit Q&A">
            <button type="button" className="cellar-sheet-close" onClick={() => setIsEditorOpen(false)} aria-label="Close Q&A editor">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <form className="staff-upload-panel" onSubmit={saveQa} noValidate>
              <HelpCircle className="h-6 w-6" aria-hidden="true" />
              <h2>{form.id ? 'Edit Q&A' : 'Add Q&A'}</h2>
              <p>Review, label, and publish investor-facing answers from the CELLAR knowledge layer.</p>
              <label>
                <span>Question</span>
                <input value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} />
              </label>
              <label>
                <span>Answer</span>
                <textarea value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />
              </label>
              <div className="staff-upload-selects">
                <CellarSelect label="Audience" value={form.visibility} onChange={(value) => setForm({ ...form, visibility: value })} options={qaAudienceOptions} />
                <CellarSelect label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={qaStatusOptions} />
              </div>
              <label>
                <span>Topic</span>
                <input value={form.topic ?? ''} onChange={(event) => setForm({ ...form, topic: event.target.value })} />
              </label>
              <CellarSelect
                label="Source asset"
                value={form.related_asset_id ?? ''}
                onChange={(value) => setForm({ ...form, related_asset_id: value || null })}
                options={sourceAssetOptions}
              />
              <div className="staff-upload-actions">
                <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Q&A'}</button>
                <button type="button" onClick={() => setIsEditorOpen(false)}>Close</button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

function StaffTeam() {
  const [teamMembers, setTeamMembers] = useState<StaffTeamRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');

  const loadTeamMembers = useCallback(async () => {
    setIsLoading(true);
    setStatus('');
    const { data, error } = await loadBohStaffUsers();

    if (error) {
      setTeamMembers([]);
      setTone('error');
      setStatus(getFriendlyCellarError(error, 'Unable to load BOH staff records.'));
    } else {
      setTeamMembers((data ?? []) as StaffTeamRecord[]);
      setTone('info');
      setStatus('');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadTeamMembers();
  }, [loadTeamMembers]);

  return (
    <section className="staff-panel staff-team-grid">
      <div className="staff-panel-heading">
        <div>
          <p>Access and ownership</p>
          <h2>Internal team</h2>
        </div>
        <button type="button" onClick={() => void loadTeamMembers()}>
          Refresh
        </button>
      </div>

      {isLoading && <StaffEmptyState title="Loading team" body="Checking BOH user records." />}
      {!isLoading && tone === 'error' && status && (
        <StaffEmptyState title="Team unavailable" body={status} />
      )}
      {!isLoading && tone !== 'error' && teamMembers.length ? (
        <div className="staff-team-list">
          <div className="staff-team-card is-header" aria-hidden="true">
            <span>Name</span>
            <span>Email</span>
            <span>Maintain access</span>
          </div>
          {teamMembers.map((member) => (
            <article className="staff-team-card" key={member.id}>
              <div>
                <strong>{member.name || 'Name not set in BOH'}</strong>
              </div>
              <span>{member.email}</span>
              <p>BOH managed</p>
            </article>
          ))}
        </div>
      ) : (
        !isLoading && tone !== 'error' && (
          <StaffEmptyState
            title="No staff records yet"
            body="Team access will appear after staff records are maintained in BOH."
          />
        )
      )}
      {status && tone !== 'error' && <p className={`staff-upload-status is-${tone}`}>{status}</p>}
    </section>
  );
}

export default function App() {
  const initialSearchParams = new URLSearchParams(window.location.search);
  const initialView = initialSearchParams.get('view') ?? '';
  const initialIsEmbeddedBoh = initialSearchParams.get('embedded') === 'boh';
  if (initialIsEmbeddedBoh) {
    window.sessionStorage.removeItem('cellar_entry_mode');
    window.sessionStorage.removeItem('cellar_guest_session_id');
  }
  const initialIsGuestEntry =
    initialSearchParams.get('entry') === 'guest' ||
    window.sessionStorage.getItem('cellar_entry_mode') === 'guest_code' ||
    Boolean(window.sessionStorage.getItem('cellar_guest_session_id'));
  const [workspaceView, setWorkspaceView] = useState(
    () => (initialIsEmbeddedBoh ? 'staff' : initialIsGuestEntry && initialView !== 'staff' ? 'dashboard' : initialView),
  );
  const [isCheckingEntry, setIsCheckingEntry] = useState(
    () => !initialIsEmbeddedBoh && !initialIsGuestEntry && (!initialView || initialView === 'staff'),
  );

  useEffect(() => {
    if (!isCheckingEntry) {
      return;
    }

    if (
      window.sessionStorage.getItem('cellar_entry_mode') === 'guest_code' ||
      window.sessionStorage.getItem('cellar_guest_session_id')
    ) {
      window.history.replaceState(null, '', getCellarViewUrl('dashboard', { entry: 'guest' }));
      setWorkspaceView('dashboard');
      setIsCheckingEntry(false);
      return;
    }

    let isCancelled = false;
    void getCellarWorkspaceAccess().then((workspaceAccess) => {
      if (isCancelled) {
        return;
      }

      if (workspaceAccess.canStaff) {
        window.history.replaceState(null, '', getCellarViewUrl('staff'));
        setWorkspaceView('staff');
      } else if (workspaceAccess.canInvestor && initialView === 'staff') {
        window.history.replaceState(null, '', getCellarViewUrl('dashboard'));
        setWorkspaceView('dashboard');
      } else if (initialView === 'staff') {
        window.history.replaceState(null, '', getCellarViewUrl(''));
        setWorkspaceView('');
      }
      setIsCheckingEntry(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isCheckingEntry]);

  const openWorkspaceView = (view: 'dashboard' | 'staff') => {
    window.sessionStorage.removeItem('cellar_entry_mode');
    window.sessionStorage.removeItem('cellar_guest_session_id');
    window.history.replaceState(null, '', getCellarViewUrl(view, { entry: null }));
    setWorkspaceView(view);
  };

  const openGuestWorkspaceView = () => {
    if (isCellarEmbeddedBohMode()) {
      openWorkspaceView('staff');
      return;
    }
    window.sessionStorage.setItem('cellar_entry_mode', 'guest_code');
    window.history.replaceState(null, '', getCellarViewUrl('dashboard', { entry: 'guest' }));
    setWorkspaceView('dashboard');
  };

  const openAccessScreen = () => {
    if (isCellarEmbeddedBohMode()) {
      openWorkspaceView('staff');
      return;
    }
    window.sessionStorage.removeItem('cellar_entry_mode');
    window.sessionStorage.removeItem('cellar_guest_session_id');
    window.history.replaceState(null, '', getCellarViewUrl('', { entry: null }));
    setWorkspaceView('');
  };

  if (isCheckingEntry) {
    return (
      <main className="cellar-app min-h-screen">
        <section className="cellar-login-shell">
          <div className="cellar-access-panel">
            <div className="cellar-access-card">
              <div className="cellar-brand-row">
                <CellarMark className="cellar-brand-mark shrink-0" />
                <p className="cellar-brand-name">CELLAR</p>
              </div>
              <div className="cellar-access-main">
                <div className="cellar-access-copy">
                  <p className="cellar-access-eyebrow">Access</p>
                  <h2>Checking workspace</h2>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (workspaceView === 'dashboard') {
    return <InvestorShell />;
  }

  if (workspaceView === 'staff') {
    return (
      <StaffShell
        onOpenInvestorView={() => openWorkspaceView('dashboard')}
        onAccessDenied={(target) => {
          if (target === 'dashboard') {
            openWorkspaceView('dashboard');
          } else {
            openAccessScreen();
          }
        }}
      />
    );
  }

  if (isCellarEmbeddedBohMode()) {
    return (
      <StaffShell
        onOpenInvestorView={() => openWorkspaceView('staff')}
        onAccessDenied={() => openWorkspaceView('staff')}
      />
    );
  }

  return (
    <AccessScreen
      onEnter={openGuestWorkspaceView}
      onVerifiedEnter={() => openWorkspaceView('dashboard')}
    />
  );
}



