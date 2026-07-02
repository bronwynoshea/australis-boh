import { LoftRoom, LoftRoomStatus } from '../../types';

export type RoomDisplayStatus = {
  kind: 'ended' | 'live' | 'scheduled';
  label: string;
  isLate?: boolean;
};

const hasValidDate = (value?: string | null) => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t) : null;
};

export const getRoomDisplayStatus = (
  room: Pick<LoftRoom, 'status' | 'scheduled_start_at' | 'ended_at'>,
  now: Date = new Date()
): RoomDisplayStatus => {
  const ended = room.status === LoftRoomStatus.ENDED || !!room.ended_at;
  if (ended) {
    return { kind: 'ended', label: 'Ended' };
  }

  if (room.status === LoftRoomStatus.LIVE) {
    // For live rooms, show the scheduled date with "(LIVE)" indicator
    const scheduledAt = hasValidDate(room.scheduled_start_at);
    
    if (scheduledAt) {
      const dateStr = scheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return { kind: 'live', label: `${dateStr} (LIVE)` };
    }
    
    return { kind: 'live', label: 'Live' };
  }

  const scheduledAt = hasValidDate(room.scheduled_start_at);
  const isLate = scheduledAt ? scheduledAt.getTime() < now.getTime() : false;
  
  // Format date for scheduled rooms
  if (scheduledAt) {
    const dateStr = scheduledAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return {
      kind: 'scheduled',
      label: isLate ? `${dateStr} (Late)` : dateStr,
      isLate,
    };
  }
  
  return {
    kind: 'scheduled',
    label: 'Scheduled',
    isLate,
  };
};

export const getRoomSortTimestamp = (room: LoftRoom) => {
  if (room.status === LoftRoomStatus.LIVE && room.started_at) {
    const t = new Date(room.started_at).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (room.scheduled_start_at) {
    const t = new Date(room.scheduled_start_at).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (room.created_at) {
    const t = new Date(room.created_at).getTime();
    if (Number.isFinite(t)) return t;
  }
  return Number.MAX_SAFE_INTEGER;
};
