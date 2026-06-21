export const targetConfigs = {
  boh: {
    label: "BOH",
    kind: "internal-control-plane",
    baseUrlEnv: "BOH_DEV_URL",
    supabaseUrlEnv: "BOH_TARGET_DEV_SUPABASE_URL",
    fallbackSupabaseUrlEnv: "CONTROL_SUPABASE_URL",
    supabaseAnonKeyEnv: "BOH_TARGET_DEV_SUPABASE_ANON_KEY",
    fallbackSupabaseAnonKeyEnv: "CONTROL_SUPABASE_ANON_KEY",
    emailEnv: "BOH_WALKTHROUGH_EMAIL",
    passwordEnv: "BOH_WALKTHROUGH_PASSWORD",
  },
  talent: {
    label: "Talent Recruiter",
    kind: "external-target-app",
    baseUrlEnv: "JOBZCAFE_DEV_URL",
    legacyBaseUrlEnv: "TALENT_DEV_URL",
    supabaseUrlEnv: "TARGET_DEV_SUPABASE_URL",
    supabaseAnonKeyEnv: "TARGET_DEV_SUPABASE_ANON_KEY",
    emailEnv: "TARGET_WALKTHROUGH_EMAIL",
    legacyEmailEnv: "WALKTHROUGH_DEMO_EMAIL",
    passwordEnv: "TARGET_WALKTHROUGH_PASSWORD",
    legacyPasswordEnv: "WALKTHROUGH_DEMO_PASSWORD",
  },
  jobzcafe: {
    label: "JOBZCAFE Jobseeker",
    kind: "external-target-app",
    baseUrlEnv: "JOBZCAFE_JOBSEEKER_DEV_URL",
    supabaseUrlEnv: "JOBZCAFE_JOBSEEKER_DEV_SUPABASE_URL",
    supabaseAnonKeyEnv: "JOBZCAFE_JOBSEEKER_DEV_SUPABASE_ANON_KEY",
    emailEnv: "JOBZCAFE_JOBSEEKER_WALKTHROUGH_EMAIL",
    passwordEnv: "JOBZCAFE_JOBSEEKER_WALKTHROUGH_PASSWORD",
  },
};

export function getTargetConfig(appKey) {
  return targetConfigs[appKey];
}
