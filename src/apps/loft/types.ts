export type LoftFunctionError = {
  error?: string;
  message?: string;
  details?: unknown;
};

export type PersonalRoom = {
  roomId: string;
  dailyRoomName: string;
  title: string;
  inviteCode: string;
  isNew: boolean;
};

export type LoftMember = {
  profileId: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string | null;
  role: string;
  isHandRaised?: boolean;
};

export type LoftJoinToken = {
  dailyRoomName: string;
  token: string;
  role: string;
  isRecorded: boolean;
  roomTitle: string;
  scheduledStartAt?: string;
  hostProfileId?: string;
  members?: LoftMember[];
  currentUserProfile?: {
    profileId: string;
    userId?: string;
    displayName: string;
    avatarUrl?: string | null;
    isHost?: boolean;
  };
  hostDetails?: {
    profileId: string;
    userId?: string;
    displayName: string;
    avatarUrl?: string | null;
    isHost?: boolean;
  };
};

export type PersonalRoomJoin = {
  token: string;
  dailyRoomName: string;
  roomTitle: string;
  hostName?: string;
};

export type WaitlistEntry = {
  id: string;
  guestName: string;
  guestEmail?: string | null;
  guestAvatarUrl?: string | null;
  status: string;
  requestedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
};
