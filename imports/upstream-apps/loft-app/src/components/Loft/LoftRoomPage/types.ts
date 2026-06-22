import type { ReactNode } from 'react';
import { LoftRole } from '../../../types';

export interface Participant {
  id: string;
  userId?: string;
  profileId?: string;
  instanceId?: string;
  userData?: Record<string, any>;
  name: string;
  role: LoftRole;
  audio: boolean;
  video: boolean;
  avatarUrl?: string;
  isLocal?: boolean;
  isOnStage?: boolean;
  isVideoOn?: boolean;
  isHandRaised?: boolean;
  videoTrack?: MediaStreamTrack;
  joinedAt?: number;
}

export interface ChatMessage {
  id: string;
  userName: string;
  text: string;
  timestamp: string;
  isMe?: boolean;
}

export type BackgroundMode = 'none' | 'blur';
export type SidebarTab = 'chat' | 'qa' | 'polls' | 'queue';

export interface ReactionType {
  id: string;
  icon: ReactNode;
  emoji: string;
}
