
export enum AppContext {
  CAFE = 'cafe',
  JOURNEY = 'journey',
  COACH = 'coach',
  MENTOR = 'mentor',
  DNA = 'dna'
}

export enum LoftRoomStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended'
}

export enum LoftVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private'
}

export enum LoftRole {
  HOST = 'host',
  COHOST = 'cohost',
  SPEAKER = 'speaker',
  LISTENER = 'listener'
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string | null;
  defaultBgId?: string;
  can_host_loft: boolean;
  can_use_personal_room?: boolean;
  canUsePersonalRoom: boolean;
  personalRoomSlug?: string;
  personal_room_slug?: string;
  personalRoomId?: string;
  personal_room_id?: string;
  is_loft_admin?: boolean;
  user_type_id?: number | null;
}

export interface LoftQuestion {
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
    isAnswered?: boolean;
    isAnonymous?: boolean;
    upvotes: number;
}

export interface LoftPollOption {
    id: string;
    text: string;
    votes: number;
}

export interface LoftPoll {
    id: string;
    question: string;
    options: LoftPollOption[];
    totalVotes: number;
    hasVoted?: boolean;
    createdAt: string;
}

export interface LoftRoom {
  id: string;
  app_context: AppContext;
  host_profile_id: string;
  host_name?: string; 
  host_avatar_url?: string;
  title: string;
  description: string;
  status: LoftRoomStatus;
  is_open?: boolean;
  visibility: LoftVisibility;
  is_recorded: boolean; 
  tags: string[]; 
  scheduled_start_at?: string;
  started_at?: string;
  ended_at?: string;
  daily_room_name: string;
  invite_code?: string | null;
  guest_join_code?: string | null;
  participant_count: number;
  max_participants?: number; 
  active_speakers?: string[]; 
  created_at: string;
  is_registered?: boolean; 
  questions?: LoftQuestion[]; 
  max_questions?: number; 
  summary?: string; 
  recording_url?: string;
}

export interface LoftRoomMember {
  id: string;
  loft_room_id: string;
  profile_id: string;
  name: string;
  role: LoftRole;
  joined_at: string;
  is_hand_raised?: boolean; 
  hand_raised_at?: string;
}

export interface CreateRoomPayload {
  title: string;
  description?: string;
  visibility: LoftVisibility;
  isRecorded: boolean; 
  tags: string[]; 
  scheduledStartAt?: string;
  appContext: AppContext;
  maxParticipants?: number;
  recurrence?: {
    type: 'daily' | 'weekly'; 
    endDate: string; 
  };
}

export interface JoinTokenResponse {
  dailyRoomName: string;
  dailyRoomUrl?: string;
  token: string;
  role: LoftRole;
  isRecorded: boolean;
  roomTitle?: string;
  scheduledStartAt?: string;
  questions?: LoftQuestion[]; 
  members?: LoftMemberHydration[];
  currentUserProfile?: LoftProfileSummary;
  hostProfileId?: string;
}

export interface LoftMemberHydration {
  profileId: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string | null;
  role: LoftRole;
  isHandRaised?: boolean;
}

export interface LoftProfileSummary {
  profileId: string;
  displayName: string;
  avatarUrl?: string | null;
}
