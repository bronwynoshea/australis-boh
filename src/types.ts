// --- DATA & TYPE DEFINITIONS ---

// TODO: link BohUser to Counter agents via boh_user_id
/**
 * Internal BOH user that already has access
 * TODO: This will map to the `boh_user` table in Supabase.
 */
export type BohUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'Admin' | 'Support' | 'Viewer';
  createdAt: string; // ISO 8601 string
  lastActiveAt?: string; // ISO 8601 string
};

// TODO: when invite is accepted, create BohUser record and allow them to be added as a Counter agent.
/**
 * A pending invitation to join BOH.
 * Maps to the `boh_invite` table in Supabase.
 */
export type BohInvite = {
  id: string;
  email: string;
  role: 'Admin' | 'Support' | 'Viewer';
  invitedBy: string; // Full name of the inviter
  invitedAt: string; // ISO 8601 string
  status: 'pending' | 'accepted' | 'expired';
  apps?: string[]; // App slugs that will be granted on acceptance
};

export type AppStatus = 'none' | 'pending' | 'granted';

export type AppName = 'counter' | 'careerStudio' | 'patron' | 'talent' | 'tablez' | 'cookbook';

export type Section = 'dashboard-section' | 'team-access-section' | 'apps-access-section' | 'team-invites-section' | 'tablez-section' | 'releases-section' | 'settings-section';

export type User = {
  id: number;
  name: string;
  email: string;
  access: {
    counter: boolean;
    careerStudio: boolean;
    talent: boolean;
  };
};

export type Theme = 'light' | 'dark';

