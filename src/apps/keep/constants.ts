export const KEEP_SECTIONS = [
  { slug: 'commercial', label: 'Commercial', icon: 'briefcase' },
  { slug: 'executive', label: 'Executive', icon: 'crown' },
  { slug: 'operations', label: 'Operations', icon: 'settings' },
  { slug: 'product', label: 'Product', icon: 'box' },
  { slug: 'strategy', label: 'Strategy', icon: 'target' },
] as const;

export const FILE_TYPE_ICONS: Record<string, string> = {
  'application/vnd.google-apps.folder': 'folder',
  'application/vnd.google-apps.document': 'file-text',
  'application/vnd.google-apps.spreadsheet': 'file-spreadsheet',
  'application/vnd.google-apps.presentation': 'presentation',
  'application/pdf': 'file-text',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',
  'text/plain': 'file-text',
  'application/zip': 'file-archive',
  'application/x-zip-compressed': 'file-archive',
};

export const FILE_TYPE_COLORS: Record<string, string> = {
  folder: 'text-boh-primary dark:text-boh-text',
  document: 'text-boh-primary dark:text-boh-text',
  spreadsheet: 'text-boh-success dark:text-boh-text',
  presentation: 'text-boh-success dark:text-boh-text',
  pdf: 'text-boh-primary dark:text-boh-text',
  image: 'text-boh-primary dark:text-boh-text',
  archive: 'text-boh-success dark:text-boh-text',
  default: 'text-boh-primary dark:text-boh-text',
};

export const GRID_COLS = {
  mobile: 2,
  tablet: 3,
  desktop: 4,
  wide: 6,
};

// Helper functions for file icons and colors
export function getFileIcon(mimeType: string): string {
  return FILE_TYPE_ICONS[mimeType] || 'file-text';
}

// File Type Constants for type/subtype classification
export const FILE_TYPES = [
  { value: 'document', label: 'Document', description: 'Text-based files, PDFs, Word docs' },
  { value: 'image', label: 'Image', description: 'Photos, screenshots, diagrams' },
  { value: 'video', label: 'Video', description: 'Recorded meetings, presentations' },
  { value: 'audio', label: 'Audio', description: 'Voice memos, podcasts' },
  { value: 'spreadsheet', label: 'Spreadsheet', description: 'Excel, CSV data files' },
  { value: 'presentation', label: 'Presentation', description: 'Slide decks, PowerPoint' },
  { value: 'archive', label: 'Archive', description: 'ZIP, compressed files' },
  { value: 'other', label: 'Other', description: 'Miscellaneous files' },
] as const;

export type FileType = typeof FILE_TYPES[number]['value'];

// Subtypes organized by parent type
export const FILE_SUBTYPES: Record<FileType, Array<{ value: string; label: string }>> = {
  document: [
    { value: 'contract', label: 'Contract' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'report', label: 'Report' },
    { value: 'memo', label: 'Memo' },
    { value: 'policy', label: 'Policy' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'specification', label: 'Specification' },
    { value: 'other', label: 'Other Document' },
  ],
  image: [
    { value: 'photo', label: 'Photo' },
    { value: 'screenshot', label: 'Screenshot' },
    { value: 'diagram', label: 'Diagram' },
    { value: 'mockup', label: 'Mockup' },
    { value: 'logo', label: 'Logo' },
    { value: 'other', label: 'Other Image' },
  ],
  video: [
    { value: 'meeting', label: 'Meeting Recording' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'tutorial', label: 'Tutorial' },
    { value: 'demo', label: 'Demo' },
    { value: 'other', label: 'Other Video' },
  ],
  audio: [
    { value: 'meeting', label: 'Meeting Recording' },
    { value: 'podcast', label: 'Podcast' },
    { value: 'voicememo', label: 'Voice Memo' },
    { value: 'music', label: 'Music' },
    { value: 'other', label: 'Other Audio' },
  ],
  spreadsheet: [
    { value: 'budget', label: 'Budget' },
    { value: 'forecast', label: 'Forecast' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'other', label: 'Other Spreadsheet' },
  ],
  presentation: [
    { value: 'pitch', label: 'Pitch Deck' },
    { value: 'training', label: 'Training' },
    { value: 'report', label: 'Report' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'other', label: 'Other Presentation' },
  ],
  archive: [
    { value: 'backup', label: 'Backup' },
    { value: 'bundle', label: 'Bundle' },
    { value: 'other', label: 'Other Archive' },
  ],
  other: [
    { value: 'other', label: 'Other' },
  ],
};

// Helper to get type from mime type
export function inferFileType(mimeType: string): FileType {
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) return 'document';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('audio')) return 'audio';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  return 'other';
}

export function getFileColor(mimeType: string): string {
  const iconType = FILE_TYPE_ICONS[mimeType];
  if (!iconType) return FILE_TYPE_COLORS.default;
  
  // Map icon types to colors
  const typeToColor: Record<string, string> = {
    'folder': FILE_TYPE_COLORS.folder,
    'file-text': FILE_TYPE_COLORS.document,
    'file-spreadsheet': FILE_TYPE_COLORS.spreadsheet,
    'presentation': FILE_TYPE_COLORS.presentation,
    'image': FILE_TYPE_COLORS.image,
    'file-archive': FILE_TYPE_COLORS.archive,
  };
  
  return typeToColor[iconType] || FILE_TYPE_COLORS.default;
}
