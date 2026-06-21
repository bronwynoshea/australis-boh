import type { AppName } from '../../types';

/**
 * Maps database app slugs to AppName types
 */
export function slugToAppName(slug: string): AppName | null {
  const mapping: Record<string, AppName> = {
    'counter': 'counter',
    'career-studio': 'careerStudio',
    'careerstudio': 'careerStudio',
    'patron': 'patron',
    'talent': 'talent',
    'tablez': 'tablez',
    'cookbook': 'cookbook',
  };
  return mapping[slug.toLowerCase()] || null;
}

/**
 * Maps AppName to database slug
 */
export function appNameToSlug(appName: AppName): string {
  const mapping: Record<AppName, string> = {
    'counter': 'counter',
    'careerStudio': 'career-studio',
    'patron': 'patron',
    'talent': 'talent',
    'tablez': 'tablez',
    'cookbook': 'cookbook',
  };
  return mapping[appName];
}


