export const LOFT_CLIENT_INSTANCE_KEY = 'loft.client.instance_id';
export const LOFT_BACKDROP_SESSION_KEY = 'loft_backdrop_id';
export const LOFT_MIC_KEY = 'loft.mic.enabled';
export const LOFT_VIDEO_KEY = 'loft.video.enabled';
export const LOFT_THEME_KEY = 'loft-theme';
export const LOFT_DEBUG_DAILY_KEY = 'loft_debug_daily';
export const DAILY_SINGLETON_KEY = '__loftDailyCallObject';
export const DAILY_DOMAIN = 'jobzcafe.daily.co';
export const WAITING_FOR_HOST_MESSAGE =
  "The host hasn't opened this room yet. Keep this window open and you'll join automatically once they arrive.";
export const WAITING_ERROR_CODES = ['host_not_joined_yet', 'room_not_open_yet', 'room_not_open', 'host_absent'];
export const ROOM_ENDED_APP_MESSAGE = 'room_ended';
export const NONE_PROCESSOR = { type: 'none' } as const;
export const BLUR_PROCESSOR = { type: 'background-blur', config: { strength: 0.6 } } as const;
