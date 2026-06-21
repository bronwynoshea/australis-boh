export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string;
  isFolder: boolean;
}

export interface KeepSection {
  id: string;
  section_slug: string;
  drive_folder_id: string;
  label: string;
  icon: string | null;
  access_level: 'all' | 'section_admins' | 'super_admin_only';
}

export interface KeepUserAccess {
  id: string;
  user_id: string;
  section_slug: string;
  access_granted_by: string | null;
  created_at: string;
}

export interface KeepActivity {
  id: string;
  user_id: string;
  action: 'view' | 'upload' | 'download' | 'create_folder' | 'move' | 'delete';
  drive_file_id: string | null;
  drive_file_name: string | null;
  section_slug: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  folderId: string | null;
}

export interface UploadFile {
  file: File;
  relativePath?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// New Supabase-backed types
export interface KeepFolder {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  area: 'workspace' | 'gold_library';
  folder_type: string;
  path: string;
  sort_order: number;
  is_system_folder: boolean;
  allow_user_created_children: boolean;
  is_active: boolean;
  file_count?: number;
  gold_library_copy_count?: number;
  has_gold_library_copy?: boolean;
  gold_library_status?: string | null;
}

export interface KeepFile {
  id: string;
  folder_id: string;
  file_name: string;
  file_ext: string;
  mime_type: string;
  file_size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  area: 'workspace' | 'gold_library';
  lifecycle_status: string;
  source_file_id: string | null;
  has_gold_library_copy?: boolean;
  gold_library_file_id?: string | null;
  gold_library_status?: string | null;
  is_current: boolean;
  is_active: boolean;
  uploaded_by: string;
  type: string | null;
  subtype: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeepFileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string;
  isFolder: boolean;
  fileExt?: string;
  folderId?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  fileCount?: number;
  hasGoldLibraryCopy?: boolean;
  goldLibraryFileId?: string | null;
  goldLibraryStatus?: string | null;
  type?: string;
  subtype?: string;
}

export interface QuickLink {
  id: string;
  label: string;
  targetType: 'folder' | 'file';
  targetId: string;
  subtitle?: string;
  description?: string;
  sortOrder: number;
}

export interface WhiteboardCard {
  id: string;
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  color_token: string | null;
  icon_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhiteboardItem {
  id: string;
  card_id: string | null;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
