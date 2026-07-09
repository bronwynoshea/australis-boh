const PERSONAL_ROOM_GUEST_ACCESS_KEYS = [
  'guestName',
  'personalRoomToken',
  'personalRoomSlug',
  'personalRoomTitle',
  'personalRoomHostName',
  'personalRoomLeaveToken',
  'personalRoomGuestEmail',
  'personalRoomAccessRequestedAt',
  'isPersonalRoomGuest',
  'loft_approval_status',
] as const;

export interface PersonalRoomGuestAccessState {
  guestName: string;
  guestEmail: string;
  approvalStatus: string | null;
  slug: string | null;
}

export const clearPersonalGuestAccessState = () => {
  PERSONAL_ROOM_GUEST_ACCESS_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
};

export const readPersonalGuestAccessState = (): PersonalRoomGuestAccessState => ({
  guestName: localStorage.getItem('guestName') || '',
  guestEmail: localStorage.getItem('personalRoomGuestEmail') || '',
  approvalStatus: localStorage.getItem('loft_approval_status'),
  slug: localStorage.getItem('personalRoomSlug'),
});

export const clearStalePersonalGuestAccessState = (currentSlug: string) => {
  const state = readPersonalGuestAccessState();
  const hasGuestAccessState =
    !!state.guestName ||
    !!state.guestEmail ||
    !!state.approvalStatus ||
    !!localStorage.getItem('personalRoomToken') ||
    localStorage.getItem('isPersonalRoomGuest') === 'true';

  if (!hasGuestAccessState) {
    return readPersonalGuestAccessState();
  }

  if (state.slug !== currentSlug) {
    clearPersonalGuestAccessState();
    return readPersonalGuestAccessState();
  }

  return state;
};
