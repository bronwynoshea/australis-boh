// Personal Room Page Types

export interface PersonalRoomParticipant {
  id: string;
  profileId?: string;
  name: string;
  audio: boolean;
  video: boolean;
  isVideoOn: boolean;
  isLocal: boolean;
  isSpeaking: boolean;
  avatarUrl?: string;
  videoTrack?: MediaStreamTrack;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  userName: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

export type BackgroundMode = 'none' | 'blur';
export type SidebarTab = 'chat' | 'participants';

export interface PersonalRoomControlsProps {
  isMicOn: boolean;
  isVideoOn: boolean;
  isScreenShareOn: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onLeaveRoom: () => void;
  showChat?: boolean;
}

export interface PersonalRoomSidebarProps {
  daily: any;
  participants: any[];
  localParticipant: any | null;
  onClose: () => void;
}
