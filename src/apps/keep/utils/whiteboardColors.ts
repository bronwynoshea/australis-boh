// Whiteboard Card Style Variants - Glass-Style Modern UI
// Design Principles:
// 1. Glass-style cards with backdrop blur and transparency
// 2. Left color bar (3-4px) as primary identity indicator
// 3. No heavy dark boxes - integrate with page background
// 4. Floating panel effect, not solid blocks
// 5. Items sit above lanes with subtle elevation

export type WhiteboardVariant = 'primary-accent' | 'success-accent' | 'neutral-accent' | 'surface-accent';

export interface WhiteboardCardStyle {
  // Card shell (lane container)
  card: string;
  // Header
  header: string;
  headerBorder: string;
  headerTitle: string;
  headerDescription: string;
  // Add button
  addButton: string;
  addButtonHover: string;
  addButtonIcon: string;
  // Card body
  body: string;
  // Items within card
  itemCard: string;
  itemCardHover: string;
  itemTitle: string;
  itemDescription: string;
  itemDate: string;
}

// Color System - Left bar accents only
const COLOR_BARS = {
  // Agenda Items - Purple
  primary: {
    bar: 'bg-purple-500 dark:bg-purple-400',
    headerText: 'text-purple-700 dark:text-purple-300',
    headerSub: 'text-purple-600/70 dark:text-purple-400/70',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  // Research Topics - Blue
  success: {
    bar: 'bg-blue-500 dark:bg-blue-400',
    headerText: 'text-blue-700 dark:text-blue-300',
    headerSub: 'text-blue-600/70 dark:text-blue-400/70',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  // Questions - Fuchsia/Plum
  neutral: {
    bar: 'bg-fuchsia-500 dark:bg-fuchsia-400',
    headerText: 'text-fuchsia-700 dark:text-fuchsia-300',
    headerSub: 'text-fuchsia-600/70 dark:text-fuchsia-400/70',
    icon: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  // New Ideas - Violet
  surface: {
    bar: 'bg-violet-500 dark:bg-violet-400',
    headerText: 'text-violet-700 dark:text-violet-300',
    headerSub: 'text-violet-600/70 dark:text-violet-400/70',
    icon: 'text-violet-600 dark:text-violet-400',
  },
};

// Glass-style surfaces with transparency and blur
const GLASS = {
  // Lane container: glass panel floating above page
  laneCard: 'backdrop-blur-md bg-white/60 dark:bg-slate-900/40 border border-white/40 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-black/30 overflow-hidden',
  // Lane header: use BOH theme surface color
  laneHeader: 'bg-white/80 dark:bg-boh-surface border-b border-white/60 dark:border-boh-border backdrop-blur-sm',
  // Lane body: transparent to show page background through
  laneBody: 'bg-transparent',
  // Item cards: completely transparent, subtle border
  itemCard: 'bg-transparent backdrop-blur-sm border border-white/20 dark:border-white/5 shadow-sm',
  itemCardHover: 'hover:shadow-md hover:bg-white/80 dark:hover:bg-transparent hover:border-white/60 dark:hover:border-white/30',
  // Text with strong readability
  itemTitle: 'text-boh-text-light dark:text-boh-text font-medium',
  itemDescription: 'text-boh-text-sub-light dark:text-boh-text-sub',
  itemDate: 'text-boh-text-sub-light/70 dark:text-boh-text-sub/70',
  // Glass add button
  addButton: 'bg-white/70 dark:bg-slate-700/40 border border-white/60 dark:border-slate-600/60 backdrop-blur-sm',
  addButtonHover: 'hover:bg-white dark:hover:bg-slate-600/60 hover:border-slate-300 dark:hover:border-slate-500',
  addButtonIcon: 'text-slate-500 dark:text-slate-400',
};

// Wrapper div for left color bar
const getLaneWrapper = (barColor: string) => `relative flex rounded-lg overflow-hidden`;
const getColorBar = (barColor: string) => `absolute left-0 top-0 bottom-0 w-1 ${barColor}`;

const styleVariants: Record<string, WhiteboardCardStyle> = {
  // Agenda Items - Purple accent
  'primary-accent': {
    card: `${GLASS.laneCard}`,
    header: GLASS.laneHeader,
    headerBorder: 'border-white/60 dark:border-slate-700/50',
    headerTitle: `${COLOR_BARS.primary.headerText}`,
    headerDescription: `${COLOR_BARS.primary.headerSub}`,
    addButton: GLASS.addButton,
    addButtonHover: GLASS.addButtonHover,
    addButtonIcon: COLOR_BARS.primary.icon,
    body: GLASS.laneBody,
    itemCard: `${GLASS.itemCard} hover:border-purple-300/50 dark:hover:border-purple-500/30`,
    itemCardHover: GLASS.itemCardHover,
    itemTitle: GLASS.itemTitle,
    itemDescription: GLASS.itemDescription,
    itemDate: GLASS.itemDate,
  },
  // Research Topics - Blue accent
  'success-accent': {
    card: `${GLASS.laneCard}`,
    header: GLASS.laneHeader,
    headerBorder: 'border-white/60 dark:border-slate-700/50',
    headerTitle: `${COLOR_BARS.success.headerText}`,
    headerDescription: `${COLOR_BARS.success.headerSub}`,
    addButton: GLASS.addButton,
    addButtonHover: GLASS.addButtonHover,
    addButtonIcon: COLOR_BARS.success.icon,
    body: GLASS.laneBody,
    itemCard: `${GLASS.itemCard} hover:border-blue-300/50 dark:hover:border-blue-500/30`,
    itemCardHover: GLASS.itemCardHover,
    itemTitle: GLASS.itemTitle,
    itemDescription: GLASS.itemDescription,
    itemDate: GLASS.itemDate,
  },
  // Questions - Fuchsia/Plum accent
  'neutral-accent': {
    card: `${GLASS.laneCard}`,
    header: GLASS.laneHeader,
    headerBorder: 'border-white/60 dark:border-slate-700/50',
    headerTitle: `${COLOR_BARS.neutral.headerText}`,
    headerDescription: `${COLOR_BARS.neutral.headerSub}`,
    addButton: GLASS.addButton,
    addButtonHover: GLASS.addButtonHover,
    addButtonIcon: COLOR_BARS.neutral.icon,
    body: GLASS.laneBody,
    itemCard: `${GLASS.itemCard} hover:border-fuchsia-300/50 dark:hover:border-fuchsia-500/30`,
    itemCardHover: GLASS.itemCardHover,
    itemTitle: GLASS.itemTitle,
    itemDescription: GLASS.itemDescription,
    itemDate: GLASS.itemDate,
  },
  // New Ideas - Violet accent
  'surface-accent': {
    card: `${GLASS.laneCard}`,
    header: GLASS.laneHeader,
    headerBorder: 'border-white/60 dark:border-slate-700/50',
    headerTitle: `${COLOR_BARS.surface.headerText}`,
    headerDescription: `${COLOR_BARS.surface.headerSub}`,
    addButton: GLASS.addButton,
    addButtonHover: GLASS.addButtonHover,
    addButtonIcon: COLOR_BARS.surface.icon,
    body: GLASS.laneBody,
    itemCard: `${GLASS.itemCard} hover:border-violet-300/50 dark:hover:border-violet-500/30`,
    itemCardHover: GLASS.itemCardHover,
    itemTitle: GLASS.itemTitle,
    itemDescription: GLASS.itemDescription,
    itemDate: GLASS.itemDate,
  },
};

// Export color bar colors for use in component wrapper
export const COLOR_BAR_COLORS = {
  'primary-accent': COLOR_BARS.primary.bar,
  'success-accent': COLOR_BARS.success.bar,
  'neutral-accent': COLOR_BARS.neutral.bar,
  'surface-accent': COLOR_BARS.surface.bar,
};

// Valid BOH style variants that can be stored in color_token
// These are the only options - keeping the system constrained to BOH tokens
const VALID_VARIANTS: WhiteboardVariant[] = [
  'primary-accent',
  'success-accent',
  'neutral-accent',
  'surface-accent'
];

/**
 * Get card style based on color_token from database.
 * The color_token should contain a valid BOH variant name.
 * This allows new cards to be added to DB without code changes.
 */
export function getCardStyle(colorToken: string | null): WhiteboardCardStyle {
  if (!colorToken) {
    throw new Error('color_token is required but was null or undefined');
  }

  // Trim and normalize the token
  const variant = colorToken.trim().toLowerCase() as WhiteboardVariant;

  // Check if it's a valid variant
  if (!VALID_VARIANTS.includes(variant)) {
    throw new Error(
      `Invalid color_token: "${colorToken}". Must be one of: ${VALID_VARIANTS.join(', ')}`
    );
  }

  return styleVariants[variant];
}

// Helper to get empty state message based on card key
export function getEmptyStateMessage(cardKey: string): string {
  const messages: Record<string, string> = {
    idea: 'No ideas yet',
    topic: 'No topics yet',
    agenda: 'No agenda items yet',
    question: 'No questions yet',
  };
  return messages[cardKey] || 'No items yet';
}
